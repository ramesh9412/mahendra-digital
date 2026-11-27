-- ============================================================================
-- MAHENDRA Investment Platform - Migration 001: Core PostgreSQL Schema
-- Safe, idempotent migration (never drops or deletes existing production data).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. PROFILES (1-to-1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  country_code TEXT NOT NULL DEFAULT '+91',
  phone TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  referral_code TEXT NOT NULL UNIQUE,
  referred_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  vip_level INTEGER NOT NULL DEFAULT 1 CHECK (vip_level >= 1),
  available_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (available_balance >= 0),
  total_recharge NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (total_recharge >= 0),
  total_income NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (total_income >= 0),
  total_withdrawn NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (total_withdrawn >= 0),
  total_won NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (total_won >= 0),
  language TEXT NOT NULL DEFAULT 'ENG',
  avatar_style TEXT NOT NULL DEFAULT 'emerald',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- Private user secrets table (never exposed via PostgREST SELECT policies)
CREATE TABLE IF NOT EXISTS public.user_secrets (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  withdrawal_password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Server-verified admin roster (never derived from user_metadata)
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. INVESTMENT PLANS
CREATE TABLE IF NOT EXISTS public.investment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  subtitle TEXT NOT NULL,
  description TEXT NOT NULL,
  image_key TEXT NOT NULL DEFAULT 'silver_shield',
  price NUMERIC(14,2) NOT NULL CHECK (price > 0),
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  daily_return NUMERIC(14,2) NOT NULL CHECK (daily_return >= 0),
  total_return NUMERIC(14,2) NOT NULL CHECK (total_return >= 0),
  purchase_limit INTEGER NOT NULL DEFAULT 2 CHECK (purchase_limit > 0),
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'presale', 'inactive')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_plans_status_sort ON public.investment_plans(status, sort_order, price);

-- 3. INVESTMENTS (User plan orders)
CREATE TABLE IF NOT EXISTS public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.investment_plans(id) ON DELETE RESTRICT,
  plan_name TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  daily_return NUMERIC(14,2) NOT NULL CHECK (daily_return >= 0),
  total_projected_return NUMERIC(14,2) NOT NULL CHECK (total_projected_return >= 0),
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  days_completed INTEGER NOT NULL DEFAULT 0 CHECK (days_completed >= 0),
  earned_so_far NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (earned_so_far >= 0),
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  matures_at TIMESTAMPTZ NOT NULL,
  last_yield_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investments_user_created ON public.investments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investments_user_plan ON public.investments(user_id, plan_id, status);

-- 4. TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_ref TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  category TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  balance_before NUMERIC(14,2) NOT NULL CHECK (balance_before >= 0),
  balance_after NUMERIC(14,2) NOT NULL CHECK (balance_after >= 0),
  description TEXT NOT NULL,
  reference_id TEXT,
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON public.transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_reference_id ON public.transactions(reference_id);

-- 5. WALLET LEDGER (Immutable append-only financial ledger)
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_ref TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  category TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  balance_before NUMERIC(14,2) NOT NULL CHECK (balance_before >= 0),
  balance_after NUMERIC(14,2) NOT NULL CHECK (balance_after >= 0),
  reference_type TEXT NOT NULL,
  reference_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_created ON public.wallet_ledger(user_id, created_at DESC);

-- 6. DEPOSITS
CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_ref TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('upi', 'bank', 'gateway')),
  utr_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  gateway_provider TEXT NOT NULL DEFAULT 'manual_verification',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deposits_user_created ON public.deposits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_status_created ON public.deposits(status, created_at DESC);

-- Supporting table: BANK ACCOUNTS
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_holder TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  upi_id TEXT,
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_user ON public.bank_accounts(user_id, is_default DESC, created_at DESC);

-- 7. WITHDRAWALS
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_ref TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  bank_snapshot_json JSONB NOT NULL,
  gross_amount NUMERIC(14,2) NOT NULL CHECK (gross_amount > 0),
  fee_percent NUMERIC(5,2) NOT NULL CHECK (fee_percent >= 0),
  fee_amount NUMERIC(14,2) NOT NULL CHECK (fee_amount >= 0),
  net_amount NUMERIC(14,2) NOT NULL CHECK (net_amount >= 0),
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_created ON public.withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status_created ON public.withdrawals(status, created_at DESC);

-- 8. DAILY RETURNS
CREATE TABLE IF NOT EXISTS public.daily_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cycle_day INTEGER NOT NULL CHECK (cycle_day > 0),
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  credited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (investment_id, cycle_day)
);

CREATE INDEX IF NOT EXISTS idx_daily_returns_user_credited ON public.daily_returns(user_id, credited_at DESC);

-- 9. REFERRALS (+ COMMISSIONS)
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ancestor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  descendant_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ancestor_user_id, descendant_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_ancestor_level ON public.referrals(ancestor_user_id, level);
CREATE INDEX IF NOT EXISTS idx_referrals_descendant ON public.referrals(descendant_user_id);

CREATE TABLE IF NOT EXISTS public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  investment_id UUID NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
  rate_percent NUMERIC(5,2) NOT NULL CHECK (rate_percent >= 0),
  base_amount NUMERIC(14,2) NOT NULL CHECK (base_amount > 0),
  commission_amount NUMERIC(14,2) NOT NULL CHECK (commission_amount >= 0),
  status TEXT NOT NULL DEFAULT 'credited',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commissions_beneficiary ON public.commissions(beneficiary_user_id, created_at DESC);

-- Supporting tables: GIFT CODES & REWARDS
CREATE TABLE IF NOT EXISTS public.gift_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  reward_amount NUMERIC(14,2) NOT NULL CHECK (reward_amount > 0),
  max_uses INTEGER NOT NULL DEFAULT 100 CHECK (max_uses > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  requires_active_plan BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gift_code_id UUID NOT NULL REFERENCES public.gift_codes(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, gift_code_id)
);

CREATE INDEX IF NOT EXISTS idx_rewards_user ON public.rewards(user_id, created_at DESC);

-- 10. NOTIFICATIONS (+ BANNERS)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'announcement',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.banners (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  badge_text TEXT NOT NULL,
  image_key TEXT NOT NULL,
  target_action TEXT NOT NULL DEFAULT 'home',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. ADMIN SETTINGS
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
