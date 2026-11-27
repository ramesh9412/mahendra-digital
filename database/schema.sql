-- Portable SQL Reference Schema for MAHENDRA – Investment Platform
-- Implemented in runtime SQLite (server/db.ts) and compatible with PostgreSQL / Supabase.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL DEFAULT '+91',
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  withdrawal_password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  referral_code TEXT NOT NULL UNIQUE,
  referred_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  vip_level INTEGER NOT NULL DEFAULT 1,
  available_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_recharge NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_income NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_won NUMERIC(14,2) NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'ENG',
  avatar_style TEXT NOT NULL DEFAULT 'emerald',
  updated_at TEXT NOT NULL
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  subtitle TEXT NOT NULL,
  description TEXT NOT NULL,
  image_key TEXT NOT NULL,
  price NUMERIC(14,2) NOT NULL,
  duration_days INTEGER NOT NULL,
  daily_return NUMERIC(14,2) NOT NULL,
  total_return NUMERIC(14,2) NOT NULL,
  purchase_limit INTEGER NOT NULL DEFAULT 5,
  is_popular INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  daily_return NUMERIC(14,2) NOT NULL,
  total_projected_return NUMERIC(14,2) NOT NULL,
  duration_days INTEGER NOT NULL,
  days_completed INTEGER NOT NULL DEFAULT 0,
  earned_so_far NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  matures_at TEXT NOT NULL,
  last_yield_at TEXT NOT NULL
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  tx_ref TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  balance_before NUMERIC(14,2) NOT NULL,
  balance_after NUMERIC(14,2) NOT NULL,
  description TEXT NOT NULL,
  reference_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TEXT NOT NULL
);

CREATE TABLE deposits (
  id TEXT PRIMARY KEY,
  deposit_ref TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount NUMERIC(14,2) NOT NULL,
  payment_method TEXT NOT NULL,
  utr_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  gateway_provider TEXT NOT NULL DEFAULT 'manual_upi',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  verified_by TEXT,
  created_at TEXT NOT NULL,
  verified_at TEXT
);

CREATE TABLE withdrawals (
  id TEXT PRIMARY KEY,
  withdrawal_ref TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  bank_account_id TEXT NOT NULL,
  bank_snapshot_json TEXT NOT NULL,
  gross_amount NUMERIC(14,2) NOT NULL,
  fee_percent NUMERIC(5,2) NOT NULL,
  fee_amount NUMERIC(14,2) NOT NULL,
  net_amount NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  processed_by TEXT,
  created_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE TABLE referrals (
  id TEXT PRIMARY KEY,
  ancestor_user_id TEXT NOT NULL REFERENCES users(id),
  descendant_user_id TEXT NOT NULL REFERENCES users(id),
  level INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (ancestor_user_id, descendant_user_id)
);

CREATE TABLE commissions (
  id TEXT PRIMARY KEY,
  beneficiary_user_id TEXT NOT NULL REFERENCES users(id),
  source_user_id TEXT NOT NULL REFERENCES users(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  level INTEGER NOT NULL,
  rate_percent NUMERIC(5,2) NOT NULL,
  base_amount NUMERIC(14,2) NOT NULL,
  commission_amount NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'credited',
  created_at TEXT NOT NULL
);

CREATE TABLE gift_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  reward_amount NUMERIC(14,2) NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 100,
  used_count INTEGER NOT NULL DEFAULT 0,
  requires_active_plan INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE rewards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  gift_code_id TEXT NOT NULL REFERENCES gift_codes(id),
  code TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, gift_code_id)
);

CREATE TABLE bank_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  account_holder TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  upi_id TEXT,
  is_default INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'announcement',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE banners (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  badge_text TEXT NOT NULL,
  image_key TEXT NOT NULL,
  target_action TEXT NOT NULL DEFAULT 'home',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'super_admin',
  last_login_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL
);
