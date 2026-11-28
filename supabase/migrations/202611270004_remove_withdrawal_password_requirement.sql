-- Remove mandatory withdrawal password / PIN check from withdrawal requests
CREATE OR REPLACE FUNCTION public.submit_withdrawal_request(
  p_amount NUMERIC,
  p_bank_account_id UUID,
  p_withdrawal_password TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_maint TEXT;
  v_min_w NUMERIC(14,2);
  v_max_w NUMERIC(14,2);
  v_fee_pct NUMERIC(5,2);
  v_bank public.bank_accounts%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_existing public.withdrawals%ROWTYPE;
  v_before NUMERIC(14,2);
  v_after NUMERIC(14,2);
  v_fee_amt NUMERIC(14,2);
  v_net_amt NUMERIC(14,2);
  v_w_id UUID := gen_random_uuid();
  v_w_ref TEXT;
  v_tx_id UUID := gen_random_uuid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_existing FROM public.withdrawals WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', TRUE,
      'deduplicated', TRUE,
      'withdrawalId', v_existing.id,
      'withdrawalRef', v_existing.withdrawal_ref,
      'netAmount', v_existing.net_amount
    );
  END IF;

  SELECT value INTO v_maint FROM public.admin_settings WHERE key = 'maintenanceMode';
  IF v_maint = 'true' THEN
    RAISE EXCEPTION 'Platform is temporarily in maintenance mode.';
  END IF;

  SELECT COALESCE((SELECT value::NUMERIC FROM public.admin_settings WHERE key = 'minWithdraw'), 120) INTO v_min_w;
  SELECT COALESCE((SELECT value::NUMERIC FROM public.admin_settings WHERE key = 'maxWithdraw'), 50000) INTO v_max_w;
  SELECT COALESCE((SELECT value::NUMERIC FROM public.admin_settings WHERE key = 'withdrawFeePercent'), 10) INTO v_fee_pct;

  IF p_amount IS NULL OR p_amount < v_min_w OR p_amount > v_max_w THEN
    RAISE EXCEPTION 'Withdrawal amount must be between ₹% and ₹%.', v_min_w, v_max_w;
  END IF;

  SELECT * INTO v_bank FROM public.bank_accounts WHERE id = p_bank_account_id AND user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected bank account not found.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND OR v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Account is inactive or suspended.';
  END IF;

  v_before := v_profile.available_balance;
  IF v_before < ROUND(p_amount, 2) THEN
    RAISE EXCEPTION 'Insufficient withdrawable balance.';
  END IF;

  v_after := ROUND(v_before - ROUND(p_amount, 2), 2);
  v_fee_amt := ROUND((ROUND(p_amount, 2) * v_fee_pct) / 100.0, 2);
  v_net_amt := ROUND(ROUND(p_amount, 2) - v_fee_amt, 2);
  v_w_ref := 'WD-' || TO_CHAR(NOW(), 'YYMMDDHH24MISS') || '-' || FLOOR(100 + RANDOM() * 900)::INT::TEXT;

  PERFORM set_config('app.bypass_profile_guard', 'on', TRUE);

  UPDATE public.profiles
  SET available_balance = v_after, updated_at = NOW()
  WHERE id = v_uid;

  INSERT INTO public.withdrawals (
    id, withdrawal_ref, user_id, bank_account_id, bank_snapshot_json,
    gross_amount, fee_percent, fee_amount, net_amount, idempotency_key, status
  ) VALUES (
    v_w_id, v_w_ref, v_uid, v_bank.id,
    jsonb_build_object(
      'account_holder', v_bank.account_holder,
      'bank_name', v_bank.bank_name,
      'account_number_masked', '****' || RIGHT(v_bank.account_number, 4),
      'ifsc_code', v_bank.ifsc_code
    ),
    ROUND(p_amount, 2), v_fee_pct, v_fee_amt, v_net_amt, p_idempotency_key, 'pending'
  );

  INSERT INTO public.transactions (
    id, tx_ref, user_id, type, category, amount,
    balance_before, balance_after, description, reference_id,
    idempotency_key, status
  ) VALUES (
    v_tx_id,
    'TX-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
    v_uid, 'debit', 'withdrawal', ROUND(p_amount, 2),
    v_before, v_after,
    'Withdrawal request ' || v_w_ref || ' (Net ₹' || v_net_amt::TEXT || ')',
    v_w_id::TEXT,
    'wdr:' || p_idempotency_key,
    'pending'
  );

  INSERT INTO public.wallet_ledger (
    entry_ref, user_id, transaction_id, direction, category,
    amount, balance_before, balance_after, reference_type, reference_id,
    idempotency_key
  ) VALUES (
    'LED-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
    v_uid, v_tx_id, 'debit', 'withdrawal',
    ROUND(p_amount, 2), v_before, v_after, 'withdrawal', v_w_id::TEXT,
    'led:wdr:' || p_idempotency_key
  );

  INSERT INTO public.audit_logs (actor_type, actor_id, action, target_type, target_id, details_json)
  VALUES (
    'user', v_uid::TEXT, 'WITHDRAWAL_REQUESTED', 'withdrawal', v_w_id::TEXT,
    jsonb_build_object('grossAmount', ROUND(p_amount, 2), 'feeAmount', v_fee_amt, 'netAmount', v_net_amt)
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'withdrawalId', v_w_id,
    'withdrawalRef', v_w_ref,
    'netAmount', v_net_amt,
    'balanceAfter', v_after
  );
END;
$$;
