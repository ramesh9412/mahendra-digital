import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { MAHENDRA_PLANS } from '../shared/plans.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'sylvacraft.db');
export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      country_code TEXT NOT NULL DEFAULT '+91',
      phone TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      withdrawal_password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      referral_code TEXT NOT NULL UNIQUE,
      referred_by_user_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (referred_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      vip_level INTEGER NOT NULL DEFAULT 1,
      available_balance REAL NOT NULL DEFAULT 0,
      total_recharge REAL NOT NULL DEFAULT 0,
      total_income REAL NOT NULL DEFAULT 0,
      total_withdrawn REAL NOT NULL DEFAULT 0,
      total_won REAL NOT NULL DEFAULT 0,
      language TEXT NOT NULL DEFAULT 'ENG',
      avatar_style TEXT NOT NULL DEFAULT 'emerald',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      subtitle TEXT NOT NULL,
      description TEXT NOT NULL,
      image_key TEXT NOT NULL,
      price REAL NOT NULL,
      duration_days INTEGER NOT NULL,
      daily_return REAL NOT NULL,
      total_return REAL NOT NULL,
      purchase_limit INTEGER NOT NULL DEFAULT 5,
      is_popular INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      amount REAL NOT NULL,
      daily_return REAL NOT NULL,
      total_projected_return REAL NOT NULL,
      duration_days INTEGER NOT NULL,
      days_completed INTEGER NOT NULL DEFAULT 0,
      earned_so_far REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      matures_at TEXT NOT NULL,
      last_yield_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      tx_ref TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_before REAL NOT NULL,
      balance_after REAL NOT NULL,
      description TEXT NOT NULL,
      reference_id TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS deposits (
      id TEXT PRIMARY KEY,
      deposit_ref TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      utr_reference TEXT,
      idempotency_key TEXT NOT NULL UNIQUE,
      gateway_provider TEXT NOT NULL DEFAULT 'manual_upi',
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      verified_by TEXT,
      created_at TEXT NOT NULL,
      verified_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id TEXT PRIMARY KEY,
      withdrawal_ref TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      bank_account_id TEXT NOT NULL,
      bank_snapshot_json TEXT NOT NULL,
      gross_amount REAL NOT NULL,
      fee_percent REAL NOT NULL,
      fee_amount REAL NOT NULL,
      net_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      processed_by TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      ancestor_user_id TEXT NOT NULL,
      descendant_user_id TEXT NOT NULL,
      level INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (ancestor_user_id, descendant_user_id),
      FOREIGN KEY (ancestor_user_id) REFERENCES users(id),
      FOREIGN KEY (descendant_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS commissions (
      id TEXT PRIMARY KEY,
      beneficiary_user_id TEXT NOT NULL,
      source_user_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      level INTEGER NOT NULL,
      rate_percent REAL NOT NULL,
      base_amount REAL NOT NULL,
      commission_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'credited',
      created_at TEXT NOT NULL,
      FOREIGN KEY (beneficiary_user_id) REFERENCES users(id),
      FOREIGN KEY (source_user_id) REFERENCES users(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS gift_codes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      reward_amount REAL NOT NULL,
      max_uses INTEGER NOT NULL DEFAULT 100,
      used_count INTEGER NOT NULL DEFAULT 0,
      requires_active_plan INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      gift_code_id TEXT NOT NULL,
      code TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (user_id, gift_code_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (gift_code_id) REFERENCES gift_codes(id)
    );

    CREATE TABLE IF NOT EXISTS bank_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_holder TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      ifsc_code TEXT NOT NULL,
      upi_id TEXT,
      is_default INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'announcement',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS banners (
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

    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'super_admin',
      last_login_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
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

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();

  const defaultSettings: Record<string, string> = {
    siteName: 'MAHENDRA',
    siteSubtitle: 'Finance & Investment Management Platform',
    primaryColor: '#008C45',
    darkColor: '#005B32',
    defaultLanguage: 'ENG',
    minRecharge: '800',
    minWithdraw: '120',
    maxWithdraw: '50000',
    withdrawFeePercent: '10',
    withdrawTimeWindow: '00:30 - 17:00',
    enforceWithdrawWindow: 'false',
    commissionLv1: '22',
    commissionLv2: '2',
    commissionLv3: '1',
    telegramLink: 'https://t.me/mahendra_platform',
    supportContact: '@CustomersHelpCare',
    maintenanceMode: 'false',
    popupEnabled: 'true',
    popupTitle: 'Welcome to MAHENDRA',
    popupSubtitle: 'Transparent architectural surface portfolio projections',
    termsText:
      'MAHENDRA investment plans feature structured 90-day and 120-day portfolio tracking cycles. Deposits and withdrawals are processed strictly after server-side verification and compliance checks.',
    paymentMode: 'manual_upi',
    upiMerchantId: 'mahendra.treasury@upi',
    bankTransferName: 'MAHENDRA Capital Escrow Pvt Ltd',
    bankTransferAccount: '409001829310',
    bankTransferIfsc: 'HDFC0001420',
  };

  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)'
  );
  for (const [k, v] of Object.entries(defaultSettings)) {
    insertSetting.run(k, v, now);
  }

  // Upgrade previously seeded brand defaults to MAHENDRA if unchanged
  const legacyMigrations: Array<[string, string, string]> = [
    ['siteName', 'SylvaCraft', 'MAHENDRA'],
    ['siteSubtitle', 'Architectural Surfaces & Timber Capital', 'Finance & Investment Management Platform'],
    ['telegramLink', 'https://t.me/sylvacraft_official', 'https://t.me/mahendra_platform'],
    ['telegramLink', 'https://t.me/mahendra_official', 'https://t.me/mahendra_platform'],
    ['supportContact', 'support@sylvacraft-capital.example', '@CustomersHelpCare'],
    ['supportContact', 'support@mahendra-invest.example', '@CustomersHelpCare'],
    ['popupTitle', 'Welcome to SylvaCraft', 'Welcome to MAHENDRA'],
    ['upiMerchantId', 'sylvacraft.treasury@upi', 'mahendra.treasury@upi'],
    ['bankTransferName', 'SylvaCraft Surfaces Escrow Pvt Ltd', 'MAHENDRA Capital Escrow Pvt Ltd'],
    ['minRecharge', '598', '800'],
  ];
  const migrateStmt = db.prepare(
    'UPDATE site_settings SET value = ?, updated_at = ? WHERE key = ? AND value = ?'
  );
  for (const [key, oldVal, newVal] of legacyMigrations) {
    migrateStmt.run(newVal, now, key, oldVal);
  }

  // Retire legacy prod_a..prod_f products without breaking existing order foreign keys
  const legacyIds = ['prod_a', 'prod_b', 'prod_c', 'prod_d', 'prod_e', 'prod_f'];
  const checkOrderRef = db.prepare('SELECT COUNT(*) as c FROM orders WHERE product_id = ?');
  const deleteLegacyProd = db.prepare('DELETE FROM products WHERE id = ?');
  const deactivateLegacyProd = db.prepare("UPDATE products SET status = 'inactive' WHERE id = ?");
  for (const legacyId of legacyIds) {
    const refs = (checkOrderRef.get(legacyId) as { c: number }).c;
    if (refs === 0) {
      deleteLegacyProd.run(legacyId);
    } else {
      deactivateLegacyProd.run(legacyId);
    }
  }

  // Seed the 10 MAHENDRA investment plans if not yet initialized
  const existingNewCount = (
    db.prepare("SELECT COUNT(*) as c FROM products WHERE id LIKE 'plan_%'").get() as { c: number }
  ).c;
  if (existingNewCount === 0) {
    const upsertProd = db.prepare(`
      INSERT INTO products (
        id, name, code, subtitle, description, image_key, price, duration_days,
        daily_return, total_return, purchase_limit, is_popular, status, sort_order, created_at
      ) VALUES (
        @id, @name, @code, @subtitle, @description, @image_key, @price, @duration_days,
        @daily_return, @total_return, @purchase_limit, @is_popular, @status, @sort_order, @created_at
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        code = excluded.code,
        subtitle = excluded.subtitle,
        description = excluded.description,
        image_key = excluded.image_key,
        price = excluded.price,
        duration_days = excluded.duration_days,
        daily_return = excluded.daily_return,
        total_return = excluded.total_return,
        purchase_limit = excluded.purchase_limit,
        is_popular = excluded.is_popular,
        status = excluded.status,
        sort_order = excluded.sort_order
    `);
    for (const p of MAHENDRA_PLANS) {
      upsertProd.run({ ...p, created_at: now });
    }
  } else {
    const syncCleanDesc = db.prepare(
      "UPDATE products SET description = ? WHERE id = ? AND description LIKE '%unverified projections%'"
    );
    for (const p of MAHENDRA_PLANS) {
      syncCleanDesc.run(p.description, p.id);
    }
  }

  db.prepare(
    "UPDATE site_settings SET value = ?, updated_at = ? WHERE key = 'termsText' AND value LIKE '%not guaranteed returns%'"
  ).run(defaultSettings.termsText, now);

  const bannerCount = (db.prepare('SELECT COUNT(*) as c FROM banners').get() as { c: number }).c;
  if (bannerCount === 0) {
    db.prepare(`
      INSERT INTO banners (id, title, subtitle, badge_text, image_key, target_action, is_active, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)
    `).run(
      'ban_hero_1',
      'Architectural Surfaces for Modern Spaces',
      'Crafted · Durable · Transparent Portfolio Cycles',
      'ISO Certified Facility',
      'studio_banner',
      'home',
      now
    );
  }

  const giftCount = (db.prepare('SELECT COUNT(*) as c FROM gift_codes').get() as { c: number }).c;
  if (giftCount === 0) {
    const insertGift = db.prepare(`
      INSERT INTO gift_codes (id, code, reward_amount, max_uses, used_count, requires_active_plan, expires_at, status, created_at)
      VALUES (?, ?, ?, ?, 0, ?, ?, 'active', ?)
    `);
    const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    insertGift.run('gift_welcome', 'MAHENDRA50', 50, 500, 1, nextYear, now);
    insertGift.run('gift_open', 'INVEST25', 25, 500, 0, nextYear, now);
  }

  const notifCount = (db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id IS NULL').get() as { c: number }).c;
  if (notifCount === 0) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, category, is_read, created_at)
      VALUES (?, NULL, ?, ?, 'announcement', 0, ?)
    `).run(
      'notif_global_1',
      'Platform Verification & Payout Schedule',
      'Withdrawals are processed daily between 00:30 and 17:00 with a 10% service fee. Bind your bank card before submitting a request.',
      now
    );
  }
}

export function getSettingsMap(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM site_settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return map;
}

export function roundMoney(val: number): number {
  return Math.round(val * 100) / 100;
}

export function writeAuditLog(params: {
  actorType: 'user' | 'admin' | 'system';
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): void {
  const id = `AUD${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  db.prepare(`
    INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, details_json, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.actorType,
    params.actorId,
    params.action,
    params.targetType,
    params.targetId ?? null,
    params.details ? JSON.stringify(params.details) : null,
    params.ipAddress ?? null,
    new Date().toISOString()
  );
}
