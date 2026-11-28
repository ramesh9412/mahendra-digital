-- ============================================================================
-- MAHENDRA Investment Platform - Migration 002: Triggers, Atomic RPCs, RLS & Realtime
-- Safe, repeatable migration. Never deletes production data.
-- ============================================================================

-- Helper: Check if current authenticated user is an active server-verified admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND au.is_active = TRUE
  );
$$;

-- Callable by frontend to check admin state without trusting user_metadata
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
  v_has_any_admin BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE is_active = TRUE) INTO v_has_any_admin;
  IF v_uid IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.admin_users WHERE user_id = v_uid AND is_active = TRUE
    ) INTO v_is_admin;
  END IF;
  RETURN jsonb_build_object(
    'isAdmin', v_is_admin,
    'hasAnyAdmin', v_has_any_admin,
    'userId', v_uid
  );
END;
$$;

-- Helper: Generate unique 7-char referral code
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := 'MH' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 6));
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

-- Helper: Mask phone for privacy
CREATE OR REPLACE FUNCTION public.mask_phone_value(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_phone IS NULL OR LENGTH(p_phone) < 4 THEN '****'
    ELSE REPEAT('*', GREATEST(2, LENGTH(p_phone) - 4)) || RIGHT(p_phone, 4)
  END;
$$;

-- Trigger: Immutable wallet_ledger (forbid UPDATE and DELETE)
CREATE OR REPLACE FUNCTION public.prevent_wallet_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'wallet_ledger is immutable and cannot be updated or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_wallet_ledger_immutable ON public.wallet_ledger;
CREATE TRIGGER trg_wallet_ledger_immutable
  BEFORE UPDATE OR DELETE ON public.wallet_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_wallet_ledger_mutation();

-- Trigger: Protect sensitive/financial profile columns from direct client updates
CREATE OR REPLACE FUNCTION public.protect_profile_financial_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(current_setting('app.bypass_profile_guard', TRUE), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.available_balance IS DISTINCT FROM OLD.available_balance
    OR NEW.total_recharge IS DISTINCT FROM OLD.total_recharge
    OR NEW.total_income IS DISTINCT FROM OLD.total_income
    OR NEW.total_withdrawn IS DISTINCT FROM OLD.total_withdrawn
    OR NEW.total_won IS DISTINCT FROM OLD.total_won
    OR NEW.vip_level IS DISTINCT FROM OLD.vip_level
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
    OR NEW.referred_by_user_id IS DISTINCT FROM OLD.referred_by_user_id
  THEN
    RAISE EXCEPTION 'Unauthorized modification of protected profile fields';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_financial_columns();

-- Trigger: Auto-create profile & referral links when a Supabase Auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country_code TEXT := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'country_code'), ''), '+91');
  v_phone TEXT := NULLIF(REGEXP_REPLACE(COALESCE(NEW.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g'), '');
  v_invite_code TEXT := UPPER(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'invitation_code'), ''));
  v_username TEXT := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'username'), ''), 'Member');
  v_ref_code TEXT := public.generate_unique_referral_code();
  v_lv1 UUID;
  v_lv2 UUID;
  v_lv3 UUID;
BEGIN
  IF v_username = 'Member' AND v_phone IS NOT NULL AND LENGTH(v_phone) >= 4 THEN
    v_username := 'Member' || RIGHT(v_phone, 4);
  ELSIF v_username = 'Member' AND NEW.email IS NOT NULL THEN
    v_username := SPLIT_PART(NEW.email, '@', 1);
  END IF;

  IF v_invite_code IS NOT NULL THEN
    SELECT id INTO v_lv1 FROM public.profiles WHERE referral_code = v_invite_code LIMIT 1;
  END IF;

  INSERT INTO public.profiles (
    id, email, country_code, phone, role, status,
    referral_code, referred_by_user_id, username
  ) VALUES (
    NEW.id,
    NEW.email,
    v_country_code,
    v_phone,
    'user',
    'active',
    v_ref_code,
    v_lv1,
    LEFT(v_username, 32)
  )
  ON CONFLICT (id) DO NOTHING;

  -- Link 3-level referral hierarchy if invited
  IF v_lv1 IS NOT NULL AND v_lv1 <> NEW.id THEN
    INSERT INTO public.referrals (ancestor_user_id, descendant_user_id, level)
    VALUES (v_lv1, NEW.id, 1)
    ON CONFLICT (ancestor_user_id, descendant_user_id) DO NOTHING;

    SELECT referred_by_user_id INTO v_lv2 FROM public.profiles WHERE id = v_lv1;
    IF v_lv2 IS NOT NULL AND v_lv2 <> NEW.id THEN
      INSERT INTO public.referrals (ancestor_user_id, descendant_user_id, level)
      VALUES (v_lv2, NEW.id, 2)
      ON CONFLICT (ancestor_user_id, descendant_user_id) DO NOTHING;

      SELECT referred_by_user_id INTO v_lv3 FROM public.profiles WHERE id = v_lv2;
      IF v_lv3 IS NOT NULL AND v_lv3 <> NEW.id THEN
        INSERT INTO public.referrals (ancestor_user_id, descendant_user_id, level)
        VALUES (v_lv3, NEW.id, 3)
        ON CONFLICT (ancestor_user_id, descendant_user_id) DO NOTHING;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, category)
  VALUES (
    NEW.id,
    'Account Created',
    'Welcome to MAHENDRA! Your unique invitation code is ' || v_ref_code || '.',
    'account'
  );

  INSERT INTO public.audit_logs (actor_type, actor_id, action, target_type, target_id, details_json)
  VALUES (
    'user',
    NEW.id::TEXT,
    'USER_REGISTERED',
    'profile',
    NEW.id::TEXT,
    jsonb_build_object('referralCode', v_ref_code, 'invitedBy', v_lv1)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================================
-- USER RPCs (Authenticated)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_user_onboarding(
  p_country_code TEXT DEFAULT '+91',
  p_phone TEXT DEFAULT NULL,
  p_withdrawal_password TEXT DEFAULT NULL,
  p_invitation_code TEXT DEFAULT NULL,
  p_username TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clean_phone TEXT := NULLIF(REGEXP_REPLACE(COALESCE(p_phone, ''), '\D', '', 'g'), '');
  v_existing_pin BOOLEAN;
  v_lv1 UUID;
  v_lv2 UUID;
  v_lv3 UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_withdrawal_password IS NOT NULL AND LENGTH(p_withdrawal_password) > 0 THEN
    IF LENGTH(p_withdrawal_password) < 4 THEN
      RAISE EXCEPTION 'Withdrawal password must be at least 4 characters.';
    END IF;
    SELECT EXISTS (SELECT 1 FROM public.user_secrets WHERE user_id = v_uid) INTO v_existing_pin;
    IF NOT v_existing_pin THEN
      INSERT INTO public.user_secrets (user_id, withdrawal_password_hash)
      VALUES (v_uid, crypt(p_withdrawal_password, gen_salt('bf')))
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', TRUE);

  IF v_clean_phone IS NOT NULL AND LENGTH(v_clean_phone) >= 7 THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE phone = v_clean_phone AND id <> v_uid) THEN
      RAISE EXCEPTION 'This mobile number is already registered to another account.';
    END IF;
    UPDATE public.profiles
    SET country_code = COALESCE(NULLIF(TRIM(p_country_code), ''), country_code),
        phone = COALESCE(phone, v_clean_phone),
        updated_at = NOW()
    WHERE id = v_uid;
  END IF;

  IF p_username IS NOT NULL AND LENGTH(TRIM(p_username)) >= 2 THEN
    UPDATE public.profiles
    SET username = LEFT(TRIM(p_username), 32), updated_at = NOW()
    WHERE id = v_uid;
  END IF;

  -- Attach referral if user does not already have one
  IF p_invitation_code IS NOT NULL AND LENGTH(TRIM(p_invitation_code)) > 0 THEN
    IF (SELECT referred_by_user_id FROM public.profiles WHERE id = v_uid) IS NULL THEN
      SELECT id INTO v_lv1 FROM public.profiles
      WHERE referral_code = UPPER(TRIM(p_invitation_code)) AND id <> v_uid LIMIT 1;
      IF v_lv1 IS NOT NULL THEN
        UPDATE public.profiles SET referred_by_user_id = v_lv1, updated_at = NOW() WHERE id = v_uid;
        INSERT INTO public.referrals (ancestor_user_id, descendant_user_id, level)
        VALUES (v_lv1, v_uid, 1) ON CONFLICT DO NOTHING;

        SELECT referred_by_user_id INTO v_lv2 FROM public.profiles WHERE id = v_lv1;
        IF v_lv2 IS NOT NULL AND v_lv2 <> v_uid THEN
          INSERT INTO public.referrals (ancestor_user_id, descendant_user_id, level)
          VALUES (v_lv2, v_uid, 2) ON CONFLICT DO NOTHING;

          SELECT referred_by_user_id INTO v_lv3 FROM public.profiles WHERE id = v_lv2;
          IF v_lv3 IS NOT NULL AND v_lv3 <> v_uid THEN
            INSERT INTO public.referrals (ancestor_user_id, descendant_user_id, level)
            VALUES (v_lv3, v_uid, 3) ON CONFLICT DO NOTHING;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_withdrawal_password(
  p_current_password TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_hash TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_new_password IS NULL OR LENGTH(p_new_password) < 4 THEN
    RAISE EXCEPTION 'New withdrawal password must be at least 4 characters.';
  END IF;

  SELECT withdrawal_password_hash INTO v_hash FROM public.user_secrets WHERE user_id = v_uid;

  IF v_hash IS NOT NULL THEN
    IF p_current_password IS NULL OR crypt(p_current_password, v_hash) <> v_hash THEN
      RAISE EXCEPTION 'Current withdrawal password is incorrect.';
    END IF;
    UPDATE public.user_secrets
    SET withdrawal_password_hash = crypt(p_new_password, gen_salt('bf')),
        updated_at = NOW()
    WHERE user_id = v_uid;
  ELSE
    INSERT INTO public.user_secrets (user_id, withdrawal_password_hash)
    VALUES (v_uid, crypt(p_new_password, gen_salt('bf')));
  END IF;

  INSERT INTO public.audit_logs (actor_type, actor_id, action, target_type, target_id)
  VALUES ('user', v_uid::TEXT, 'WITHDRAWAL_PASSWORD_CHANGED', 'profile', v_uid::TEXT);

  RETURN jsonb_build_object('ok', TRUE, 'message', 'Withdrawal password updated successfully.');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_account_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_active_orders INTEGER;
  v_total_orders INTEGER;
  v_unread INTEGER;
  v_has_pin BOOLEAN;
  v_counts JSONB;
  v_banks JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  SELECT COUNT(*) INTO v_active_orders FROM public.investments WHERE user_id = v_uid AND status = 'active';
  SELECT COUNT(*) INTO v_total_orders FROM public.investments WHERE user_id = v_uid AND status <> 'cancelled';
  SELECT COUNT(*) INTO v_unread FROM public.notifications WHERE (user_id = v_uid OR user_id IS NULL) AND is_read = FALSE;
  SELECT EXISTS (SELECT 1 FROM public.user_secrets WHERE user_id = v_uid) INTO v_has_pin;

  SELECT COALESCE(jsonb_object_agg(plan_id::TEXT, cnt), '{}'::jsonb)
  INTO v_counts
  FROM (
    SELECT plan_id, COUNT(*)::INTEGER AS cnt
    FROM public.investments
    WHERE user_id = v_uid AND status <> 'cancelled'
    GROUP BY plan_id
  ) t;

  SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.is_default DESC, b.created_at DESC), '[]'::jsonb)
  INTO v_banks
  FROM public.bank_accounts b
  WHERE b.user_id = v_uid;

  RETURN jsonb_build_object(
    'user', jsonb_build_object(
      'id', v_profile.id,
      'email', v_profile.email,
      'countryCode', v_profile.country_code,
      'maskedPhone', public.mask_phone_value(v_profile.phone),
      'phoneLast4', COALESCE(RIGHT(v_profile.phone, 4), '0000'),
      'status', v_profile.status,
      'referralCode', v_profile.referral_code,
      'createdAt', v_profile.created_at
    ),
    'profile', jsonb_build_object(
      'username', v_profile.username,
      'vipLevel', v_profile.vip_level,
      'availableBalance', v_profile.available_balance,
      'totalRecharge', v_profile.total_recharge,
      'totalIncome', v_profile.total_income,
      'totalWithdrawn', v_profile.total_withdrawn,
      'totalWon', v_profile.total_won,
      'language', v_profile.language,
      'avatarStyle', v_profile.avatar_style
    ),
    'activeOrdersCount', v_active_orders,
    'hasActivePlan', v_total_orders > 0,
    'hasWithdrawalPin', v_has_pin,
    'unreadNotificationsCount', v_unread,
    'productPurchaseCounts', v_counts,
    'bankAccounts', v_banks
  );
END;
$$;

-- Atomic investment purchase + immutable wallet ledger + 3-level commission payout
CREATE OR REPLACE FUNCTION public.create_investment(
  p_plan_id UUID,
  p_idempotency_key TEXT,
  p_accepted_disclosure BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_maint TEXT;
  v_plan public.investment_plans%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_existing public.investments%ROWTYPE;
  v_count INTEGER;
  v_before NUMERIC(14,2);
  v_after NUMERIC(14,2);
  v_inv_id UUID := gen_random_uuid();
  v_order_num TEXT;
  v_tx_id UUID := gen_random_uuid();
  v_tx_ref TEXT;
  v_matures_at TIMESTAMPTZ;
  v_anc RECORD;
  v_rate NUMERIC(5,2);
  v_comm_amt NUMERIC(14,2);
  v_anc_prof public.profiles%ROWTYPE;
  v_anc_after NUMERIC(14,2);
  v_comm_id UUID;
  v_comm_tx_id UUID;
  v_lv1_rate NUMERIC(5,2);
  v_lv2_rate NUMERIC(5,2);
  v_lv3_rate NUMERIC(5,2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT COALESCE(p_accepted_disclosure, FALSE) THEN
    RAISE EXCEPTION 'Please acknowledge the plan terms and confirmation.';
  END IF;
  IF p_idempotency_key IS NULL OR LENGTH(TRIM(p_idempotency_key)) < 6 THEN
    RAISE EXCEPTION 'Invalid idempotency key.';
  END IF;

  SELECT * INTO v_existing FROM public.investments WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', TRUE,
      'deduplicated', TRUE,
      'orderId', v_existing.id,
      'orderNumber', v_existing.order_number
    );
  END IF;

  SELECT value INTO v_maint FROM public.admin_settings WHERE key = 'maintenanceMode';
  IF v_maint = 'true' THEN
    RAISE EXCEPTION 'Platform is temporarily in maintenance mode.';
  END IF;

  SELECT * INTO v_plan FROM public.investment_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected investment plan was not found.';
  END IF;
  IF v_plan.status <> 'active' THEN
    RAISE EXCEPTION 'This plan is currently in Presale / unavailable for purchase.';
  END IF;

  -- Lock user profile row atomically
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND OR v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Account is inactive or suspended.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.investments
  WHERE user_id = v_uid AND plan_id = p_plan_id AND status <> 'cancelled';

  IF v_count >= v_plan.purchase_limit THEN
    RAISE EXCEPTION 'You have reached the maximum purchase limit for this plan.';
  END IF;

  v_before := v_profile.available_balance;
  IF v_before < v_plan.price THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Please recharge first.';
  END IF;

  v_after := ROUND(v_before - v_plan.price, 2);
  v_matures_at := NOW() + make_interval(days => v_plan.duration_days);
  v_order_num := 'MH-' || TO_CHAR(NOW(), 'YYMMDDHH24MISS') || '-' || FLOOR(100 + RANDOM() * 900)::INT::TEXT;
  v_tx_ref := 'TX-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10));

  PERFORM set_config('app.bypass_profile_guard', 'on', TRUE);

  UPDATE public.profiles
  SET available_balance = v_after, updated_at = NOW()
  WHERE id = v_uid;

  INSERT INTO public.investments (
    id, order_number, user_id, plan_id, plan_name, amount,
    daily_return, total_projected_return, duration_days,
    days_completed, earned_so_far, idempotency_key, status,
    created_at, matures_at, last_yield_at
  ) VALUES (
    v_inv_id, v_order_num, v_uid, v_plan.id, v_plan.name, v_plan.price,
    v_plan.daily_return, v_plan.total_return, v_plan.duration_days,
    0, 0.00, p_idempotency_key, 'active',
    NOW(), v_matures_at, NOW()
  );

  INSERT INTO public.transactions (
    id, tx_ref, user_id, type, category, amount,
    balance_before, balance_after, description, reference_id,
    idempotency_key, status
  ) VALUES (
    v_tx_id, v_tx_ref, v_uid, 'debit', 'investment', v_plan.price,
    v_before, v_after,
    'Activated ' || v_plan.name || ' (' || v_plan.duration_days || ' Days)',
    v_inv_id::TEXT,
    'inv:' || p_idempotency_key,
    'completed'
  );

  INSERT INTO public.wallet_ledger (
    entry_ref, user_id, transaction_id, direction, category,
    amount, balance_before, balance_after, reference_type, reference_id,
    idempotency_key, metadata
  ) VALUES (
    'LED-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
    v_uid, v_tx_id, 'debit', 'investment',
    v_plan.price, v_before, v_after, 'investment', v_inv_id::TEXT,
    'led:inv:' || p_idempotency_key,
    jsonb_build_object('planId', v_plan.id, 'orderNumber', v_order_num)
  );

  -- Referral commission payouts (Levels 1-3)
  SELECT COALESCE((SELECT value::NUMERIC FROM public.admin_settings WHERE key = 'commissionLv1'), 22) INTO v_lv1_rate;
  SELECT COALESCE((SELECT value::NUMERIC FROM public.admin_settings WHERE key = 'commissionLv2'), 2) INTO v_lv2_rate;
  SELECT COALESCE((SELECT value::NUMERIC FROM public.admin_settings WHERE key = 'commissionLv3'), 1) INTO v_lv3_rate;

  FOR v_anc IN
    SELECT ancestor_user_id, level
    FROM public.referrals
    WHERE descendant_user_id = v_uid
    ORDER BY level ASC
  LOOP
    v_rate := CASE v_anc.level
      WHEN 1 THEN v_lv1_rate
      WHEN 2 THEN v_lv2_rate
      WHEN 3 THEN v_lv3_rate
      ELSE 0
    END;

    IF v_rate > 0 THEN
      v_comm_amt := ROUND((v_plan.price * v_rate) / 100.0, 2);
      IF v_comm_amt > 0 THEN
        SELECT * INTO v_anc_prof FROM public.profiles WHERE id = v_anc.ancestor_user_id FOR UPDATE;
        IF FOUND THEN
          v_anc_after := ROUND(v_anc_prof.available_balance + v_comm_amt, 2);
          UPDATE public.profiles
          SET available_balance = v_anc_after,
              total_income = ROUND(v_anc_prof.total_income + v_comm_amt, 2),
              updated_at = NOW()
          WHERE id = v_anc.ancestor_user_id;

          v_comm_id := gen_random_uuid();
          v_comm_tx_id := gen_random_uuid();

          INSERT INTO public.commissions (
            id, beneficiary_user_id, source_user_id, investment_id,
            level, rate_percent, base_amount, commission_amount, status
          ) VALUES (
            v_comm_id, v_anc.ancestor_user_id, v_uid, v_inv_id,
            v_anc.level, v_rate, v_plan.price, v_comm_amt, 'credited'
          );

          INSERT INTO public.transactions (
            id, tx_ref, user_id, type, category, amount,
            balance_before, balance_after, description, reference_id, status
          ) VALUES (
            v_comm_tx_id,
            'TX-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
            v_anc.ancestor_user_id, 'credit', 'commission', v_comm_amt,
            v_anc_prof.available_balance, v_anc_after,
            'Level ' || v_anc.level || ' referral commission (' || v_rate || '%) from plan activation',
            v_comm_id::TEXT, 'completed'
          );

          INSERT INTO public.wallet_ledger (
            entry_ref, user_id, transaction_id, direction, category,
            amount, balance_before, balance_after, reference_type, reference_id,
            idempotency_key
          ) VALUES (
            'LED-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
            v_anc.ancestor_user_id, v_comm_tx_id, 'credit', 'commission',
            v_comm_amt, v_anc_prof.available_balance, v_anc_after,
            'commission', v_comm_id::TEXT,
            'led:comm:' || v_inv_id::TEXT || ':lv' || v_anc.level::TEXT
          );

          INSERT INTO public.notifications (user_id, title, message, category)
          VALUES (
            v_anc.ancestor_user_id,
            'Team Commission Credited',
            'You earned ₹' || v_comm_amt::TEXT || ' (Level ' || v_anc.level || ', ' || v_rate || '%) from a team plan activation.',
            'commission'
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.audit_logs (actor_type, actor_id, action, target_type, target_id, details_json)
  VALUES (
    'user', v_uid::TEXT, 'ORDER_PURCHASED', 'investment', v_inv_id::TEXT,
    jsonb_build_object('planId', v_plan.id, 'amount', v_plan.price, 'orderNumber', v_order_num)
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'orderId', v_inv_id,
    'orderNumber', v_order_num,
    'balanceAfter', v_after
  );
END;
$$;

-- Atomic daily cycle settlement
CREATE OR REPLACE FUNCTION public.claim_daily_return(p_investment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_inv public.investments%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_elapsed INTEGER;
  v_claimable INTEGER;
  v_day INTEGER;
  v_credit NUMERIC(14,2);
  v_before NUMERIC(14,2);
  v_after NUMERIC(14,2);
  v_next_status TEXT;
  v_tx_id UUID := gen_random_uuid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_inv FROM public.investments WHERE id = p_investment_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investment order not found.';
  END IF;
  IF v_inv.status <> 'active' THEN
    RAISE EXCEPTION 'Order is already completed or closed.';
  END IF;

  v_elapsed := LEAST(
    v_inv.duration_days,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - v_inv.created_at)) / 86400.0)::INTEGER)
  );

  v_claimable := v_elapsed - v_inv.days_completed;
  IF v_claimable <= 0 THEN
    RAISE EXCEPTION 'No new daily cycle has elapsed yet. Check back after 24 hours.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid FOR UPDATE;
  v_before := v_profile.available_balance;
  v_credit := ROUND(v_claimable * v_inv.daily_return, 2);
  v_after := ROUND(v_before + v_credit, 2);
  v_next_status := CASE WHEN (v_inv.days_completed + v_claimable) >= v_inv.duration_days THEN 'completed' ELSE 'active' END;

  PERFORM set_config('app.bypass_profile_guard', 'on', TRUE);

  UPDATE public.profiles
  SET available_balance = v_after,
      total_income = ROUND(v_profile.total_income + v_credit, 2),
      updated_at = NOW()
  WHERE id = v_uid;

  UPDATE public.investments
  SET days_completed = v_inv.days_completed + v_claimable,
      earned_so_far = ROUND(v_inv.earned_so_far + v_credit, 2),
      status = v_next_status,
      last_yield_at = NOW()
  WHERE id = v_inv.id;

  INSERT INTO public.transactions (
    id, tx_ref, user_id, type, category, amount,
    balance_before, balance_after, description, reference_id, status
  ) VALUES (
    v_tx_id,
    'TX-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
    v_uid, 'credit', 'yield', v_credit,
    v_before, v_after,
    'Cycle yield settlement (' || v_claimable || 'd) for ' || v_inv.plan_name,
    v_inv.id::TEXT, 'completed'
  );

  INSERT INTO public.wallet_ledger (
    entry_ref, user_id, transaction_id, direction, category,
    amount, balance_before, balance_after, reference_type, reference_id,
    idempotency_key
  ) VALUES (
    'LED-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
    v_uid, v_tx_id, 'credit', 'yield',
    v_credit, v_before, v_after, 'investment_yield', v_inv.id::TEXT,
    'led:yield:' || v_inv.id::TEXT || ':d' || (v_inv.days_completed + v_claimable)::TEXT
  );

  FOR v_day IN (v_inv.days_completed + 1) .. (v_inv.days_completed + v_claimable) LOOP
    INSERT INTO public.daily_returns (investment_id, user_id, cycle_day, amount, transaction_id)
    VALUES (v_inv.id, v_uid, v_day, v_inv.daily_return, v_tx_id);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'credited', v_credit,
    'daysSettled', v_claimable,
    'balanceAfter', v_after
  );
END;
$$;

-- Submit deposit request (always created as pending; never auto-approved)
CREATE OR REPLACE FUNCTION public.submit_deposit_request(
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_utr_reference TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_min_recharge NUMERIC(14,2);
  v_existing public.deposits%ROWTYPE;
  v_dep_id UUID := gen_random_uuid();
  v_dep_ref TEXT;
  v_utr TEXT := NULLIF(TRIM(COALESCE(p_utr_reference, '')), '');
  v_method TEXT := LOWER(TRIM(COALESCE(p_payment_method, 'upi')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_existing FROM public.deposits WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', TRUE,
      'deduplicated', TRUE,
      'deposit', to_jsonb(v_existing)
    );
  END IF;

  SELECT COALESCE((SELECT value::NUMERIC FROM public.admin_settings WHERE key = 'minRecharge'), 800)
  INTO v_min_recharge;

  IF p_amount IS NULL OR p_amount < v_min_recharge THEN
    RAISE EXCEPTION 'Minimum recharge amount is ₹%.', v_min_recharge;
  END IF;
  IF v_method NOT IN ('upi', 'bank', 'gateway') THEN
    RAISE EXCEPTION 'Invalid payment method.';
  END IF;
  IF v_method IN ('upi', 'bank') AND (v_utr IS NULL OR LENGTH(v_utr) < 6) THEN
    RAISE EXCEPTION 'Enter a valid 6+ character UTR / transaction reference.';
  END IF;

  v_dep_ref := 'RCH-' || TO_CHAR(NOW(), 'YYMMDDHH24MISS') || '-' || FLOOR(100 + RANDOM() * 900)::INT::TEXT;

  INSERT INTO public.deposits (
    id, deposit_ref, user_id, amount, payment_method,
    utr_reference, idempotency_key, gateway_provider, status
  ) VALUES (
    v_dep_id, v_dep_ref, v_uid, ROUND(p_amount, 2), v_method,
    v_utr, p_idempotency_key,
    CASE WHEN v_method = 'gateway' THEN 'configured_gateway' ELSE 'manual_verification' END,
    'pending'
  );

  INSERT INTO public.audit_logs (actor_type, actor_id, action, target_type, target_id, details_json)
  VALUES (
    'user', v_uid::TEXT, 'DEPOSIT_SUBMITTED', 'deposit', v_dep_id::TEXT,
    jsonb_build_object('amount', ROUND(p_amount, 2), 'method', v_method, 'depositRef', v_dep_ref)
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'deposit', jsonb_build_object(
      'id', v_dep_id,
      'deposit_ref', v_dep_ref,
      'amount', ROUND(p_amount, 2),
      'payment_method', v_method,
      'utr_reference', v_utr,
      'status', 'pending',
      'created_at', NOW()
    ),
    'message', 'Deposit request submitted for server-side verification. Your wallet will be credited once verified.'
  );
END;
$$;

-- Submit withdrawal request (atomic balance deduction + immutable ledger)
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

-- Redeem Treasure Box gift code atomically
CREATE OR REPLACE FUNCTION public.redeem_gift_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clean_code TEXT := UPPER(TRIM(COALESCE(p_code, '')));
  v_gift public.gift_codes%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_plan_count INTEGER;
  v_before NUMERIC(14,2);
  v_after NUMERIC(14,2);
  v_rwd_id UUID := gen_random_uuid();
  v_tx_id UUID := gen_random_uuid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF v_clean_code = '' THEN
    RAISE EXCEPTION 'Please enter a gift code.';
  END IF;

  SELECT * INTO v_gift FROM public.gift_codes WHERE code = v_clean_code FOR UPDATE;
  IF NOT FOUND OR v_gift.status <> 'active' THEN
    RAISE EXCEPTION 'Gift code is invalid or inactive.';
  END IF;
  IF v_gift.expires_at IS NOT NULL AND v_gift.expires_at < NOW() THEN
    RAISE EXCEPTION 'This gift code has expired.';
  END IF;
  IF v_gift.used_count >= v_gift.max_uses THEN
    RAISE EXCEPTION 'This gift code has reached its maximum redemptions.';
  END IF;

  IF v_gift.requires_active_plan THEN
    SELECT COUNT(*) INTO v_plan_count FROM public.investments WHERE user_id = v_uid AND status <> 'cancelled';
    IF v_plan_count = 0 THEN
      RAISE EXCEPTION 'Treasure Box is locked. Activate any investment plan to unlock this code.';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.rewards WHERE user_id = v_uid AND gift_code_id = v_gift.id) THEN
    RAISE EXCEPTION 'You have already redeemed this gift code.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid FOR UPDATE;
  v_before := v_profile.available_balance;
  v_after := ROUND(v_before + v_gift.reward_amount, 2);

  PERFORM set_config('app.bypass_profile_guard', 'on', TRUE);

  UPDATE public.gift_codes SET used_count = used_count + 1 WHERE id = v_gift.id;
  UPDATE public.profiles
  SET available_balance = v_after,
      total_won = ROUND(v_profile.total_won + v_gift.reward_amount, 2),
      total_income = ROUND(v_profile.total_income + v_gift.reward_amount, 2),
      updated_at = NOW()
  WHERE id = v_uid;

  INSERT INTO public.rewards (id, user_id, gift_code_id, code, amount)
  VALUES (v_rwd_id, v_uid, v_gift.id, v_gift.code, v_gift.reward_amount);

  INSERT INTO public.transactions (
    id, tx_ref, user_id, type, category, amount,
    balance_before, balance_after, description, reference_id, status
  ) VALUES (
    v_tx_id,
    'TX-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
    v_uid, 'credit', 'gift_reward', v_gift.reward_amount,
    v_before, v_after,
    'Redeemed Treasure Box code ' || v_gift.code,
    v_rwd_id::TEXT, 'completed'
  );

  INSERT INTO public.wallet_ledger (
    entry_ref, user_id, transaction_id, direction, category,
    amount, balance_before, balance_after, reference_type, reference_id,
    idempotency_key
  ) VALUES (
    'LED-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
    v_uid, v_tx_id, 'credit', 'gift_reward',
    v_gift.reward_amount, v_before, v_after, 'reward', v_rwd_id::TEXT,
    'led:gift:' || v_uid::TEXT || ':' || v_gift.id::TEXT
  );

  INSERT INTO public.audit_logs (actor_type, actor_id, action, target_type, target_id, details_json)
  VALUES (
    'user', v_uid::TEXT, 'GIFT_CODE_REDEEMED', 'gift_code', v_gift.id::TEXT,
    jsonb_build_object('code', v_gift.code, 'amount', v_gift.reward_amount)
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'amount', v_gift.reward_amount,
    'balanceAfter', v_after,
    'code', v_gift.code
  );
END;
$$;

-- Team metrics & privacy-masked member list
CREATE OR REPLACE FUNCTION public.get_my_team()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_lv1 NUMERIC(5,2);
  v_lv2 NUMERIC(5,2);
  v_lv3 NUMERIC(5,2);
  v_levels JSONB := '[]'::jsonb;
  v_lvl INTEGER;
  v_rate NUMERIC(5,2);
  v_members JSONB;
  v_m_count INTEGER;
  v_a_count INTEGER;
  v_rch_sum NUMERIC(14,2);
  v_comm_sum NUMERIC(14,2);
  v_total_members INTEGER := 0;
  v_total_active INTEGER := 0;
  v_total_recharge NUMERIC(14,2) := 0;
  v_total_comm NUMERIC(14,2) := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE((SELECT value::NUMERIC FROM public.admin_settings WHERE key = 'commissionLv1'), 22) INTO v_lv1;
  SELECT COALESCE((SELECT value::NUMERIC FROM public.admin_settings WHERE key = 'commissionLv2'), 2) INTO v_lv2;
  SELECT COALESCE((SELECT value::NUMERIC FROM public.admin_settings WHERE key = 'commissionLv3'), 1) INTO v_lv3;

  FOR v_lvl IN 1..3 LOOP
    v_rate := CASE v_lvl WHEN 1 THEN v_lv1 WHEN 2 THEN v_lv2 ELSE v_lv3 END;

    SELECT
      COUNT(*)::INTEGER,
      COUNT(*) FILTER (
        WHERE p.total_recharge > 0
           OR EXISTS (SELECT 1 FROM public.investments i WHERE i.user_id = p.id AND i.status <> 'cancelled')
      )::INTEGER,
      COALESCE(SUM(p.total_recharge), 0),
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'username', p.username,
          'maskedPhone', public.mask_phone_value(p.phone),
          'isActive', (p.total_recharge > 0 OR EXISTS (SELECT 1 FROM public.investments i WHERE i.user_id = p.id AND i.status <> 'cancelled')),
          'joinedAt', r.created_at
        )
        ORDER BY r.created_at DESC
      ), '[]'::jsonb)
    INTO v_m_count, v_a_count, v_rch_sum, v_members
    FROM public.referrals r
    JOIN public.profiles p ON p.id = r.descendant_user_id
    WHERE r.ancestor_user_id = v_uid AND r.level = v_lvl;

    SELECT COALESCE(SUM(commission_amount), 0)
    INTO v_comm_sum
    FROM public.commissions
    WHERE beneficiary_user_id = v_uid AND level = v_lvl;

    v_total_members := v_total_members + v_m_count;
    v_total_active := v_total_active + v_a_count;
    v_total_recharge := v_total_recharge + v_rch_sum;
    v_total_comm := v_total_comm + v_comm_sum;

    v_levels := v_levels || jsonb_build_array(
      jsonb_build_object(
        'level', v_lvl,
        'ratePercent', v_rate,
        'membersCount', v_m_count,
        'activeCount', v_a_count,
        'rechargeVolume', v_rch_sum,
        'commissionEarned', v_comm_sum,
        'members', v_members
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'totalMembers', v_total_members,
    'activeMembers', v_total_active,
    'totalTeamRecharge', v_total_recharge,
    'totalCommissionCredited', v_total_comm,
    'levels', v_levels
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_treasure_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_unlocked BOOLEAN;
  v_rewards JSONB;
  v_count INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  SELECT EXISTS (SELECT 1 FROM public.investments WHERE user_id = v_uid AND status <> 'cancelled') INTO v_unlocked;
  SELECT COUNT(*)::INTEGER, COALESCE(jsonb_agg(
    jsonb_build_object('id', id, 'code', code, 'amount', amount, 'created_at', created_at)
    ORDER BY created_at DESC
  ), '[]'::jsonb)
  INTO v_count, v_rewards
  FROM public.rewards
  WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'isUnlocked', v_unlocked,
    'totalWon', v_profile.total_won,
    'balance', v_profile.available_balance,
    'codesUsed', v_count,
    'rewards', v_rewards
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.notifications SET is_read = TRUE WHERE user_id = v_uid AND is_read = FALSE;
  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

-- ============================================================================
-- ADMIN RPCs (Strictly guarded by public.is_admin())
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_users INTEGER;
  v_active_users INTEGER;
  v_dep_total NUMERIC(14,2);
  v_dep_cnt INTEGER;
  v_dep_pend INTEGER;
  v_w_total NUMERIC(14,2);
  v_w_cnt INTEGER;
  v_w_pend INTEGER;
  v_ord_total NUMERIC(14,2);
  v_ord_cnt INTEGER;
  v_tx_cnt INTEGER;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Admin privileges required.'; END IF;

  SELECT COUNT(*)::INTEGER, COUNT(*) FILTER (WHERE status = 'active')::INTEGER
  INTO v_total_users, v_active_users FROM public.profiles;

  SELECT COALESCE(SUM(amount), 0), COUNT(*)::INTEGER
  INTO v_dep_total, v_dep_cnt FROM public.deposits WHERE status = 'approved';

  SELECT COUNT(*)::INTEGER INTO v_dep_pend FROM public.deposits WHERE status = 'pending';

  SELECT COALESCE(SUM(gross_amount), 0), COUNT(*)::INTEGER
  INTO v_w_total, v_w_cnt FROM public.withdrawals WHERE status = 'approved';

  SELECT COUNT(*)::INTEGER INTO v_w_pend FROM public.withdrawals WHERE status = 'pending';

  SELECT COALESCE(SUM(amount), 0), COUNT(*)::INTEGER
  INTO v_ord_total, v_ord_cnt FROM public.investments WHERE status <> 'cancelled';

  SELECT COUNT(*)::INTEGER INTO v_tx_cnt FROM public.transactions;

  RETURN jsonb_build_object(
    'totalUsers', v_total_users,
    'activeUsers', v_active_users,
    'totalDeposits', v_dep_total,
    'approvedDepositsCount', v_dep_cnt,
    'pendingDeposits', v_dep_pend,
    'totalWithdrawals', v_w_total,
    'approvedWithdrawalsCount', v_w_cnt,
    'pendingWithdrawals', v_w_pend,
    'totalOrdersCount', v_ord_cnt,
    'totalOrderVolume', v_ord_total,
    'totalTransactions', v_tx_cnt
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users(p_query TEXT DEFAULT '')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q TEXT := TRIM(COALESCE(p_query, ''));
  v_rows JSONB;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Admin privileges required.'; END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT id, email, country_code, phone, status, referral_code, created_at,
           username, vip_level, available_balance, total_recharge, total_income
    FROM public.profiles
    WHERE v_q = ''
       OR COALESCE(phone, '') ILIKE '%' || v_q || '%'
       OR username ILIKE '%' || v_q || '%'
       OR COALESCE(email, '') ILIKE '%' || v_q || '%'
       OR referral_code ILIKE '%' || v_q || '%'
       OR id::TEXT ILIKE '%' || v_q || '%'
    ORDER BY created_at DESC
    LIMIT 100
  ) t;

  RETURN jsonb_build_object('users', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_status(p_user_id UUID, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT := CASE WHEN p_status = 'suspended' THEN 'suspended' ELSE 'active' END;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Admin privileges required.'; END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', TRUE);
  UPDATE public.profiles SET status = v_status, updated_at = NOW() WHERE id = p_user_id;

  INSERT INTO public.audit_logs (actor_type, actor_id, action, target_type, target_id, details_json)
  VALUES ('admin', auth.uid()::TEXT, 'ADMIN_USER_STATUS_UPDATED', 'profile', p_user_id::TEXT, jsonb_build_object('status', v_status));

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_user_activity(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orders JSONB;
  v_txs JSONB;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Admin privileges required.'; END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.created_at DESC), '[]'::jsonb)
  INTO v_orders FROM public.investments o WHERE o.user_id = p_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_txs FROM (SELECT * FROM public.transactions WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 50) t;

  RETURN jsonb_build_object('orders', v_orders, 'transactions', v_txs);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_plan(
  p_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_code TEXT DEFAULT NULL,
  p_subtitle TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_image_key TEXT DEFAULT 'silver_shield',
  p_price NUMERIC DEFAULT NULL,
  p_duration_days INTEGER DEFAULT 90,
  p_daily_return NUMERIC DEFAULT NULL,
  p_total_return NUMERIC DEFAULT NULL,
  p_purchase_limit INTEGER DEFAULT 2,
  p_is_popular BOOLEAN DEFAULT FALSE,
  p_status TEXT DEFAULT 'active'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := COALESCE(p_id, gen_random_uuid());
  v_code TEXT := UPPER(COALESCE(NULLIF(TRIM(p_code), ''), 'MH-' || FLOOR(1000 + RANDOM() * 9000)::INT::TEXT));
  v_status TEXT := CASE WHEN p_status IN ('active', 'presale', 'inactive') THEN p_status ELSE 'active' END;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Admin privileges required.'; END IF;
  IF p_name IS NULL OR TRIM(p_name) = '' OR p_price IS NULL OR p_price <= 0 OR p_daily_return IS NULL THEN
    RAISE EXCEPTION 'Valid plan name, positive price, and daily return are required.';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.investment_plans (
      id, name, code, subtitle, description, image_key,
      price, duration_days, daily_return, total_return,
      purchase_limit, is_popular, status, sort_order
    ) VALUES (
      v_id, TRIM(p_name), v_code,
      COALESCE(NULLIF(TRIM(p_subtitle), ''), 'MAHENDRA Portfolio Plan'),
      COALESCE(NULLIF(TRIM(p_description), ''), 'Configured investment portfolio plan.'),
      COALESCE(NULLIF(TRIM(p_image_key), ''), 'silver_shield'),
      ROUND(p_price, 2), GREATEST(1, p_duration_days), ROUND(p_daily_return, 2),
      ROUND(COALESCE(p_total_return, p_daily_return * GREATEST(1, p_duration_days)), 2),
      GREATEST(1, p_purchase_limit), COALESCE(p_is_popular, FALSE), v_status, 99
    );

    INSERT INTO public.audit_logs (actor_type, actor_id, action, target_type, target_id, details_json)
    VALUES ('admin', auth.uid()::TEXT, 'ADMIN_PRODUCT_CREATED', 'investment_plan', v_id::TEXT, jsonb_build_object('name', p_name, 'price', p_price));
  ELSE
    UPDATE public.investment_plans
    SET name = TRIM(p_name),
        subtitle = COALESCE(NULLIF(TRIM(p_subtitle), ''), subtitle),
        description = COALESCE(NULLIF(TRIM(p_description), ''), description),
        image_key = COALESCE(NULLIF(TRIM(p_image_key), ''), image_key),
        price = ROUND(p_price, 2),
        duration_days = GREATEST(1, p_duration_days),
        daily_return = ROUND(p_daily_return, 2),
        total_return = ROUND(COALESCE(p_total_return, total_return), 2),
        purchase_limit = GREATEST(1, p_purchase_limit),
        is_popular = COALESCE(p_is_popular, FALSE),
        status = v_status,
        updated_at = NOW()
    WHERE id = p_id;

    INSERT INTO public.audit_logs (actor_type, actor_id, action, target_type, target_id, details_json)
    VALUES ('admin', auth.uid()::TEXT, 'ADMIN_PRODUCT_UPDATED', 'investment_plan', p_id::TEXT, jsonb_build_object('name', p_name, 'price', p_price));
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_plan(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Admin privileges required.'; END IF;

  IF EXISTS (SELECT 1 FROM public.investments WHERE plan_id = p_plan_id) THEN
    UPDATE public.investment_plans SET status = 'inactive', updated_at = NOW() WHERE id = p_plan_id;
  ELSE
    DELETE FROM public.investment_plans WHERE id = p_plan_id;
  END IF;

  INSERT INTO public.audit_logs (actor_type, actor_id, action, target_type, target_id)
  VALUES ('admin', auth.uid()::TEXT, 'ADMIN_PRODUCT_DELETED', 'investment_plan', p_plan_id::TEXT);

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_deposits()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Admin privileges required.'; END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT d.*, COALESCE(p.phone, p.email) AS phone, p.username
    FROM public.deposits d
    JOIN public.profiles p ON p.id = d.user_id
    ORDER BY CASE WHEN d.status = 'pending' THEN 0 ELSE 1 END, d.created_at DESC
    LIMIT 150
  ) t;

  RETURN jsonb_build_object('deposits', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_verify_deposit(
  p_deposit_id UUID,
  p_decision TEXT,
  p_note TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_uid UUID := auth.uid();
  v_decision TEXT := CASE WHEN p_decision = 'approved' THEN 'approved' ELSE 'rejected' END;
  v_dep public.deposits%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_before NUMERIC(14,2);
  v_after NUMERIC(14,2);
  v_next_rch NUMERIC(14,2);
  v_next_vip INTEGER;
  v_tx_id UUID := gen_random_uuid();
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Admin privileges required.'; END IF;

  SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deposit not found.'; END IF;
  IF v_dep.status <> 'pending' THEN RAISE EXCEPTION 'Deposit already processed.'; END IF;

  IF v_decision = 'approved' THEN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_dep.user_id FOR UPDATE;
    v_before := v_profile.available_balance;
    v_after := ROUND(v_before + v_dep.amount, 2);
    v_next_rch := ROUND(v_profile.total_recharge + v_dep.amount, 2);
    v_next_vip := CASE
      WHEN v_next_rch >= 25000 THEN 4
      WHEN v_next_rch >= 10000 THEN 3
      WHEN v_next_rch >= 2000 THEN 2
      ELSE 1
    END;

    PERFORM set_config('app.bypass_profile_guard', 'on', TRUE);
    UPDATE public.profiles
    SET available_balance = v_after,
        total_recharge = v_next_rch,
        vip_level = v_next_vip,
        updated_at = NOW()
    WHERE id = v_dep.user_id;

    INSERT INTO public.transactions (
      id, tx_ref, user_id, type, category, amount,
      balance_before, balance_after, description, reference_id, status
    ) VALUES (
      v_tx_id,
      'TX-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
      v_dep.user_id, 'credit', 'deposit', v_dep.amount,
      v_before, v_after,
      'Recharge verified (' || v_dep.deposit_ref || ')',
      v_dep.id::TEXT, 'completed'
    );

    INSERT INTO public.wallet_ledger (
      entry_ref, user_id, transaction_id, direction, category,
      amount, balance_before, balance_after, reference_type, reference_id,
      idempotency_key
    ) VALUES (
      'LED-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
      v_dep.user_id, v_tx_id, 'credit', 'deposit',
      v_dep.amount, v_before, v_after, 'deposit', v_dep.id::TEXT,
      'led:dep:' || v_dep.id::TEXT
    );

    INSERT INTO public.notifications (user_id, title, message, category)
    VALUES (
      v_dep.user_id,
      'Recharge Verified',
      'Your deposit of ₹' || v_dep.amount::TEXT || ' (' || v_dep.deposit_ref || ') has been credited to your wallet.',
      'wallet'
    );
  ELSE
    INSERT INTO public.notifications (user_id, title, message, category)
    VALUES (
      v_dep.user_id,
      'Recharge Declined',
      'Your deposit ' || v_dep.deposit_ref || ' was declined.' ||
      CASE WHEN NULLIF(TRIM(p_note), '') IS NOT NULL THEN ' Reason: ' || TRIM(p_note) ELSE '' END,
      'wallet'
    );
  END IF;

  UPDATE public.deposits
  SET status = v_decision,
      admin_note = NULLIF(TRIM(p_note), ''),
      verified_by = v_admin_uid,
      verified_at = NOW()
  WHERE id = v_dep.id;

  INSERT INTO public.audit_logs (actor_type, actor_id, action, target_type, target_id, details_json)
  VALUES (
    'admin', v_admin_uid::TEXT,
    CASE WHEN v_decision = 'approved' THEN 'DEPOSIT_APPROVED' ELSE 'DEPOSIT_REJECTED' END,
    'deposit', v_dep.id::TEXT,
    jsonb_build_object('amount', v_dep.amount, 'note', NULLIF(TRIM(p_note), ''))
  );

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_withdrawals()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Admin privileges required.'; END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT w.*, COALESCE(p.phone, p.email) AS phone, p.username
    FROM public.withdrawals w
    JOIN public.profiles p ON p.id = w.user_id
    ORDER BY CASE WHEN w.status = 'pending' THEN 0 ELSE 1 END, w.created_at DESC
    LIMIT 150
  ) t;

  RETURN jsonb_build_object('withdrawals', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_process_withdrawal(
  p_withdrawal_id UUID,
  p_decision TEXT,
  p_note TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_uid UUID := auth.uid();
  v_decision TEXT := CASE WHEN p_decision = 'approved' THEN 'approved' ELSE 'rejected' END;
  v_w public.withdrawals%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_before NUMERIC(14,2);
  v_after NUMERIC(14,2);
  v_tx_id UUID := gen_random_uuid();
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Admin privileges required.'; END IF;

  SELECT * INTO v_w FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found.'; END IF;
  IF v_w.status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal already processed.'; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_w.user_id FOR UPDATE;
  PERFORM set_config('app.bypass_profile_guard', 'on', TRUE);

  IF v_decision = 'approved' THEN
    UPDATE public.profiles
    SET total_withdrawn = ROUND(v_profile.total_withdrawn + v_w.gross_amount, 2),
        updated_at = NOW()
    WHERE id = v_w.user_id;

    UPDATE public.transactions SET status = 'completed' WHERE reference_id = v_w.id::TEXT AND category = 'withdrawal';

    INSERT INTO public.notifications (user_id, title, message, category)
    VALUES (
      v_w.user_id,
      'Withdrawal Approved',
      'Your withdrawal ' || v_w.withdrawal_ref || ' (Net ₹' || v_w.net_amount::TEXT || ') has been approved for payout.',
      'wallet'
    );
  ELSE
    v_before := v_profile.available_balance;
    v_after := ROUND(v_before + v_w.gross_amount, 2);

    UPDATE public.profiles
    SET available_balance = v_after, updated_at = NOW()
    WHERE id = v_w.user_id;

    UPDATE public.transactions SET status = 'rejected' WHERE reference_id = v_w.id::TEXT AND category = 'withdrawal';

    INSERT INTO public.transactions (
      id, tx_ref, user_id, type, category, amount,
      balance_before, balance_after, description, reference_id, status
    ) VALUES (
      v_tx_id,
      'TX-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
      v_w.user_id, 'credit', 'withdrawal_refund', v_w.gross_amount,
      v_before, v_after,
      'Refund for declined withdrawal ' || v_w.withdrawal_ref,
      v_w.id::TEXT, 'completed'
    );

    INSERT INTO public.wallet_ledger (
      entry_ref, user_id, transaction_id, direction, category,
      amount, balance_before, balance_after, reference_type, reference_id,
      idempotency_key
    ) VALUES (
      'LED-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
      v_w.user_id, v_tx_id, 'credit', 'withdrawal_refund',
      v_w.gross_amount, v_before, v_after, 'withdrawal_refund', v_w.id::TEXT,
      'led:wdr_ref:' || v_w.id::TEXT
    );

    INSERT INTO public.notifications (user_id, title, message, category)
    VALUES (
      v_w.user_id,
      'Withdrawal Rejected & Refunded',
      'Your withdrawal ' || v_w.withdrawal_ref || ' was declined and ₹' || v_w.gross_amount::TEXT || ' returned to your balance.',
      'wallet'
    );
  END IF;

  UPDATE public.withdrawals
  SET status = v_decision,
      admin_note = NULLIF(TRIM(p_note), ''),
      processed_by = v_admin_uid,
      processed_at = NOW()
  WHERE id = v_w.id;

  INSERT INTO public.audit_logs (actor_type, actor_id, action, target_type, target_id, details_json)
  VALUES (
    'admin', v_admin_uid::TEXT,
    CASE WHEN v_decision = 'approved' THEN 'WITHDRAWAL_APPROVED' ELSE 'WITHDRAWAL_REJECTED' END,
    'withdrawal', v_w.id::TEXT,
    jsonb_build_object('grossAmount', v_w.gross_amount, 'note', NULLIF(TRIM(p_note), ''))
  );

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_transactions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Admin privileges required.'; END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT tx.*, COALESCE(p.phone, p.email) AS phone, p.username
    FROM public.transactions tx
    JOIN public.profiles p ON p.id = tx.user_id
    ORDER BY tx.created_at DESC
    LIMIT 200
  ) t;

  RETURN jsonb_build_object('transactions', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_referrals()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lv1 NUMERIC;
  v_lv2 NUMERIC;
  v_lv3 NUMERIC;
  v_total_refs INTEGER;
  v_total_comm NUMERIC(14,2);
  v_comms JSONB;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Admin privileges required.'; END IF;

  SELECT COALESCE((SELECT value::NUMERIC FROM public.admin_settings WHERE key = 'commissionLv1'), 22) INTO v_lv1;
  SELECT COALESCE((SELECT value::NUMERIC FROM public.admin_settings WHERE key = 'commissionLv2'), 2) INTO v_lv2;
  SELECT COALESCE((SELECT value::NUMERIC FROM public.admin_settings WHERE key = 'commissionLv3'), 1) INTO v_lv3;
  SELECT COUNT(*)::INTEGER INTO v_total_refs FROM public.referrals;
  SELECT COALESCE(SUM(commission_amount), 0) INTO v_total_comm FROM public.commissions;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  INTO v_comms
  FROM (
    SELECT c.*, COALESCE(bp.phone, bp.email) AS beneficiary_phone, COALESCE(sp.phone, sp.email) AS source_phone
    FROM public.commissions c
    JOIN public.profiles bp ON bp.id = c.beneficiary_user_id
    JOIN public.profiles sp ON sp.id = c.source_user_id
    ORDER BY c.created_at DESC
    LIMIT 100
  ) t;

  RETURN jsonb_build_object(
    'rates', jsonb_build_object('lv1', v_lv1, 'lv2', v_lv2, 'lv3', v_lv3),
    'totalReferrals', v_total_refs,
    'totalCommissionPaid', v_total_comm,
    'commissions', v_comms
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_gift_code(
  p_code TEXT,
  p_reward_amount NUMERIC,
  p_max_uses INTEGER DEFAULT 100,
  p_requires_active_plan BOOLEAN DEFAULT TRUE,
  p_days_valid INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_code TEXT := UPPER(TRIM(COALESCE(p_code, '')));
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Admin privileges required.'; END IF;
  IF v_code = '' OR p_reward_amount IS NULL OR p_reward_amount <= 0 THEN
    RAISE EXCEPTION 'Gift code and positive reward amount are required.';
  END IF;

  INSERT INTO public.gift_codes (
    id, code, reward_amount, max_uses, used_count,
    requires_active_plan, expires_at, status
  ) VALUES (
    v_id, v_code, ROUND(p_reward_amount, 2), GREATEST(1, p_max_uses), 0,
    COALESCE(p_requires_active_plan, TRUE),
    NOW() + make_interval(days => GREATEST(1, p_days_valid)),
    'active'
  );

  RETURN jsonb_build_object('ok', TRUE, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_gift_code(p_gift_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Admin privileges required.'; END IF;
  DELETE FROM public.gift_codes WHERE id = p_gift_id;
  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_settings(
  p_settings JSONB DEFAULT NULL,
  p_banner JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed TEXT[] := ARRAY[
    'siteName', 'siteSubtitle', 'primaryColor', 'darkColor', 'defaultLanguage',
    'minRecharge', 'minWithdraw', 'maxWithdraw', 'withdrawFeePercent',
    'withdrawTimeWindow', 'enforceWithdrawWindow', 'commissionLv1',
    'commissionLv2', 'commissionLv3', 'telegramLink', 'supportContact',
    'maintenanceMode', 'popupEnabled', 'popupTitle', 'popupSubtitle', 'termsText'
  ];
  v_k TEXT;
  v_v TEXT;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Admin privileges required.'; END IF;

  IF p_settings IS NOT NULL AND jsonb_typeof(p_settings) = 'object' THEN
    FOR v_k, v_v IN SELECT key, value FROM jsonb_each_text(p_settings) LOOP
      IF v_k = ANY(v_allowed) THEN
        INSERT INTO public.admin_settings (key, value, updated_at)
        VALUES (v_k, LEFT(v_v, 2000), NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
      END IF;
    END LOOP;
  END IF;

  IF p_banner IS NOT NULL AND jsonb_typeof(p_banner) = 'object' AND (p_banner ->> 'id') IS NOT NULL THEN
    UPDATE public.banners
    SET title = LEFT(COALESCE(p_banner ->> 'title', title), 120),
        subtitle = LEFT(COALESCE(p_banner ->> 'subtitle', subtitle), 160),
        badge_text = LEFT(COALESCE(p_banner ->> 'badge_text', badge_text), 60)
    WHERE id = (p_banner ->> 'id');
  END IF;

  INSERT INTO public.audit_logs (actor_type, actor_id, action, target_type)
  VALUES ('admin', auth.uid()::TEXT, 'ADMIN_SETTINGS_UPDATED', 'admin_settings');

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_broadcast_notification(
  p_title TEXT,
  p_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Admin privileges required.'; END IF;
  IF TRIM(COALESCE(p_title, '')) = '' OR TRIM(COALESCE(p_message, '')) = '' THEN
    RAISE EXCEPTION 'Title and message are required.';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, category)
  VALUES (NULL, LEFT(TRIM(p_title), 100), LEFT(TRIM(p_message), 400), 'announcement');

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

-- Server-only gateway webhook verification RPC (never granted to anon/authenticated)
CREATE OR REPLACE FUNCTION public.gateway_verify_deposit(
  p_deposit_ref TEXT,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep public.deposits%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_decision TEXT := CASE WHEN p_status = 'paid' THEN 'approved' ELSE 'rejected' END;
  v_before NUMERIC(14,2);
  v_after NUMERIC(14,2);
  v_next_rch NUMERIC(14,2);
  v_next_vip INTEGER;
  v_tx_id UUID := gen_random_uuid();
BEGIN
  SELECT * INTO v_dep FROM public.deposits WHERE deposit_ref = p_deposit_ref FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deposit not found'; END IF;
  IF v_dep.status <> 'pending' THEN
    RETURN jsonb_build_object('alreadyProcessed', TRUE, 'status', v_dep.status);
  END IF;

  IF v_decision = 'approved' THEN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_dep.user_id FOR UPDATE;
    v_before := v_profile.available_balance;
    v_after := ROUND(v_before + v_dep.amount, 2);
    v_next_rch := ROUND(v_profile.total_recharge + v_dep.amount, 2);
    v_next_vip := CASE
      WHEN v_next_rch >= 25000 THEN 4
      WHEN v_next_rch >= 10000 THEN 3
      WHEN v_next_rch >= 2000 THEN 2
      ELSE 1
    END;

    PERFORM set_config('app.bypass_profile_guard', 'on', TRUE);
    UPDATE public.profiles
    SET available_balance = v_after,
        total_recharge = v_next_rch,
        vip_level = v_next_vip,
        updated_at = NOW()
    WHERE id = v_dep.user_id;

    INSERT INTO public.transactions (
      id, tx_ref, user_id, type, category, amount,
      balance_before, balance_after, description, reference_id, status
    ) VALUES (
      v_tx_id,
      'TX-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
      v_dep.user_id, 'credit', 'deposit', v_dep.amount,
      v_before, v_after,
      'Verified gateway deposit (' || v_dep.deposit_ref || ')',
      v_dep.id::TEXT, 'completed'
    );

    INSERT INTO public.wallet_ledger (
      entry_ref, user_id, transaction_id, direction, category,
      amount, balance_before, balance_after, reference_type, reference_id,
      idempotency_key
    ) VALUES (
      'LED-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10)),
      v_dep.user_id, v_tx_id, 'credit', 'deposit',
      v_dep.amount, v_before, v_after, 'deposit', v_dep.id::TEXT,
      'led:dep:' || v_dep.id::TEXT
    );
  END IF;

  UPDATE public.deposits
  SET status = v_decision, verified_at = NOW(), admin_note = 'gateway_webhook'
  WHERE id = v_dep.id;

  RETURN jsonb_build_object('alreadyProcessed', FALSE, 'status', v_decision);
END;
$$;

REVOKE ALL ON FUNCTION public.gateway_verify_deposit(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gateway_verify_deposit(TEXT, TEXT) TO service_role;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;
CREATE POLICY profiles_select_own_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ADMIN_USERS (read own status only; no client mutations)
DROP POLICY IF EXISTS admin_users_select_own ON public.admin_users;
CREATE POLICY admin_users_select_own ON public.admin_users
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- INVESTMENT PLANS (public catalog read; admin write)
DROP POLICY IF EXISTS investment_plans_public_read ON public.investment_plans;
CREATE POLICY investment_plans_public_read ON public.investment_plans
  FOR SELECT TO anon, authenticated
  USING (status <> 'inactive' OR public.is_admin());

DROP POLICY IF EXISTS investment_plans_admin_write ON public.investment_plans;
CREATE POLICY investment_plans_admin_write ON public.investment_plans
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- BANNERS & ADMIN SETTINGS (public non-secret config read; admin write)
DROP POLICY IF EXISTS banners_public_read ON public.banners;
CREATE POLICY banners_public_read ON public.banners
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS admin_settings_public_read ON public.admin_settings;
CREATE POLICY admin_settings_public_read ON public.admin_settings
  FOR SELECT TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS admin_settings_admin_write ON public.admin_settings;
CREATE POLICY admin_settings_admin_write ON public.admin_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- INVESTMENTS (user select own only; mutations via RPC)
DROP POLICY IF EXISTS investments_select_own ON public.investments;
CREATE POLICY investments_select_own ON public.investments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- TRANSACTIONS (user select own only; mutations via RPC)
DROP POLICY IF EXISTS transactions_select_own ON public.transactions;
CREATE POLICY transactions_select_own ON public.transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- WALLET LEDGER (user select own only; immutable, mutations via RPC)
DROP POLICY IF EXISTS wallet_ledger_select_own ON public.wallet_ledger;
CREATE POLICY wallet_ledger_select_own ON public.wallet_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- DEPOSITS (user select own only; mutations via RPC)
DROP POLICY IF EXISTS deposits_select_own ON public.deposits;
CREATE POLICY deposits_select_own ON public.deposits
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- WITHDRAWALS (user select own only; mutations via RPC)
DROP POLICY IF EXISTS withdrawals_select_own ON public.withdrawals;
CREATE POLICY withdrawals_select_own ON public.withdrawals
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- DAILY RETURNS (user select own only)
DROP POLICY IF EXISTS daily_returns_select_own ON public.daily_returns;
CREATE POLICY daily_returns_select_own ON public.daily_returns
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- BANK ACCOUNTS (user owns CRUD on own rows)
DROP POLICY IF EXISTS bank_accounts_select_own ON public.bank_accounts;
CREATE POLICY bank_accounts_select_own ON public.bank_accounts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS bank_accounts_insert_own ON public.bank_accounts;
CREATE POLICY bank_accounts_insert_own ON public.bank_accounts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS bank_accounts_update_own ON public.bank_accounts;
CREATE POLICY bank_accounts_update_own ON public.bank_accounts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS bank_accounts_delete_own ON public.bank_accounts;
CREATE POLICY bank_accounts_delete_own ON public.bank_accounts
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- REFERRALS & COMMISSIONS
DROP POLICY IF EXISTS referrals_select_own ON public.referrals;
CREATE POLICY referrals_select_own ON public.referrals
  FOR SELECT TO authenticated
  USING (auth.uid() = ancestor_user_id OR auth.uid() = descendant_user_id OR public.is_admin());

DROP POLICY IF EXISTS commissions_select_own ON public.commissions;
CREATE POLICY commissions_select_own ON public.commissions
  FOR SELECT TO authenticated
  USING (auth.uid() = beneficiary_user_id OR public.is_admin());

-- GIFT CODES & REWARDS
DROP POLICY IF EXISTS gift_codes_admin_select ON public.gift_codes;
CREATE POLICY gift_codes_admin_select ON public.gift_codes
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS rewards_select_own ON public.rewards;
CREATE POLICY rewards_select_own ON public.rewards
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- NOTIFICATIONS
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL OR public.is_admin());

-- AUDIT LOGS (admin read only)
DROP POLICY IF EXISTS audit_logs_admin_select ON public.audit_logs;
CREATE POLICY audit_logs_admin_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- SUPABASE REALTIME PUBLICATION (Idempotent)
-- ============================================================================
DO $$
DECLARE
  v_tbl TEXT;
  v_tables TEXT[] := ARRAY['profiles', 'deposits', 'withdrawals', 'notifications', 'transactions', 'wallet_ledger'];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_tbl IN ARRAY v_tables LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tbl);
      END IF;
    END LOOP;
  END IF;
END $$;
