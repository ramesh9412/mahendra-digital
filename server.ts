import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { createServer as createViteServer } from 'vite';
import {
  type AuthenticatedRequest,
  generateReferralCode,
  generateUniqueId,
  hashSecret,
  maskPhone,
  requireAdminAuth,
  requireUserAuth,
  signSessionToken,
  verifySecret,
} from './server/auth.ts';
import { db, getSettingsMap, initDatabase, roundMoney, writeAuditLog } from './server/db.ts';

initDatabase();

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

function asCleanString(val: unknown, maxLen = 200): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function asPositiveNumber(val: unknown): number | null {
  const num = typeof val === 'number' ? val : typeof val === 'string' ? Number(val) : NaN;
  if (!Number.isFinite(num) || num <= 0) return null;
  return roundMoney(num);
}

function isWithinWithdrawWindow(windowStr: string): boolean {
  const match = /^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/.exec(windowStr.trim());
  if (!match) return true;
  const startMin = Number(match[1]) * 60 + Number(match[2]);
  const endMin = Number(match[3]) * 60 + Number(match[4]);
  const now = new Date();
  const istMinutes = ((now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % 1440);
  if (startMin <= endMin) {
    return istMinutes >= startMin && istMinutes <= endMin;
  }
  return istMinutes >= startMin || istMinutes <= endMin;
}

// ============================================================================
// PUBLIC CONFIG & PRODUCTS
// ============================================================================

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/api/config', (_req: Request, res: Response) => {
  const settings = getSettingsMap();
  const banners = db
    .prepare('SELECT id, title, subtitle, badge_text, image_key, target_action, sort_order FROM banners WHERE is_active = 1 ORDER BY sort_order ASC')
    .all();
  const products = db
    .prepare(
      "SELECT id, name, code, subtitle, description, image_key, price, duration_days, daily_return, total_return, purchase_limit, is_popular, status, sort_order FROM products WHERE status != 'inactive' ORDER BY sort_order ASC, price ASC"
    )
    .all();

  const paymentGatewayEnabled = process.env.PAYMENT_GATEWAY_ENABLED === 'true';
  const gatewayConfigured = Boolean(
    paymentGatewayEnabled &&
      process.env.PAYMENT_GATEWAY_KEY_ID?.trim() &&
      process.env.PAYMENT_GATEWAY_KEY_SECRET?.trim()
  );

  res.json({
    settings: {
      siteName: settings.siteName ?? 'MAHENDRA',
      siteSubtitle: settings.siteSubtitle ?? 'Finance & Investment Management Platform',
      primaryColor: settings.primaryColor ?? '#008C45',
      darkColor: settings.darkColor ?? '#005B32',
      defaultLanguage: settings.defaultLanguage ?? 'ENG',
      minRecharge: Number(settings.minRecharge ?? 800),
      minWithdraw: Number(settings.minWithdraw ?? 120),
      maxWithdraw: Number(settings.maxWithdraw ?? 50000),
      withdrawFeePercent: Number(settings.withdrawFeePercent ?? 10),
      withdrawTimeWindow: settings.withdrawTimeWindow ?? '00:30 - 17:00',
      commissionLv1: Number(settings.commissionLv1 ?? 22),
      commissionLv2: Number(settings.commissionLv2 ?? 2),
      commissionLv3: Number(settings.commissionLv3 ?? 1),
      telegramLink: settings.telegramLink ?? '',
      supportContact: settings.supportContact ?? '',
      maintenanceMode: settings.maintenanceMode === 'true',
      popupEnabled: settings.popupEnabled !== 'false',
      popupTitle: settings.popupTitle ?? 'Welcome to MAHENDRA',
      popupSubtitle: settings.popupSubtitle ?? 'Transparent architectural surface portfolio projections',
      termsText: settings.termsText ?? '',
      paymentGatewayPublic: {
        mode: settings.paymentMode ?? 'manual_upi',
        upiMerchantId: settings.upiMerchantId ?? '',
        bankTransferName: settings.bankTransferName ?? '',
        bankTransferAccount: settings.bankTransferAccount ?? '',
        bankTransferIfsc: settings.bankTransferIfsc ?? '',
        gatewayConfigured,
      },
    },
    banners,
    products,
  });
});

// ============================================================================
// USER AUTHENTICATION
// ============================================================================

app.post('/api/auth/register', (req: Request, res: Response) => {
  const countryCode = asCleanString(req.body?.countryCode || '+91', 10);
  const phoneRaw = asCleanString(req.body?.phone, 20).replace(/\D/g, '');
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const confirmPassword = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';
  const withdrawalPassword =
    typeof req.body?.withdrawalPassword === 'string' ? req.body.withdrawalPassword : '';
  const invitationCode = asCleanString(req.body?.invitationCode, 20).toUpperCase();
  const acceptedTerms = Boolean(req.body?.acceptedTerms);

  if (!acceptedTerms) {
    res.status(400).json({ error: 'Please accept the Terms & Conditions to register.' });
    return;
  }
  if (phoneRaw.length < 7 || phoneRaw.length > 15) {
    res.status(400).json({ error: 'Enter a valid mobile number (7 to 15 digits).' });
    return;
  }
  if (password.length < 6 || password.length > 100) {
    res.status(400).json({ error: 'Login password must be at least 6 characters.' });
    return;
  }
  if (password !== confirmPassword) {
    res.status(400).json({ error: 'Passwords do not match.' });
    return;
  }
  if (withdrawalPassword.length < 4 || withdrawalPassword.length > 100) {
    res.status(400).json({ error: 'Withdrawal password must be at least 4 characters.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phoneRaw);
  if (existing) {
    res.status(409).json({ error: 'This mobile number is already registered.' });
    return;
  }

  let inviter: { id: string; referred_by_user_id: string | null } | undefined;
  if (invitationCode) {
    inviter = db
      .prepare('SELECT id, referred_by_user_id FROM users WHERE referral_code = ?')
      .get(invitationCode) as { id: string; referred_by_user_id: string | null } | undefined;
    if (!inviter) {
      res.status(400).json({ error: 'Invitation code is invalid or not found.' });
      return;
    }
  }

  const userId = generateUniqueId('USR');
  let referralCode = generateReferralCode();
  while (db.prepare('SELECT id FROM users WHERE referral_code = ?').get(referralCode)) {
    referralCode = generateReferralCode();
  }

  const passwordHash = hashSecret(password);
  const withdrawalHash = hashSecret(withdrawalPassword);
  const now = new Date().toISOString();
  const username = `Member${phoneRaw.slice(-4)}`;

  const runRegister = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, country_code, phone, password_hash, withdrawal_password_hash, role, status, referral_code, referred_by_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'user', 'active', ?, ?, ?, ?)
    `).run(userId, countryCode, phoneRaw, passwordHash, withdrawalHash, referralCode, inviter?.id ?? null, now, now);

    db.prepare(`
      INSERT INTO profiles (user_id, username, vip_level, available_balance, total_recharge, total_income, total_withdrawn, total_won, language, avatar_style, updated_at)
      VALUES (?, ?, 1, 0, 0, 0, 0, 0, 'ENG', 'emerald', ?)
    `).run(userId, username, now);

    if (inviter) {
      db.prepare(`
        INSERT INTO referrals (id, ancestor_user_id, descendant_user_id, level, created_at)
        VALUES (?, ?, ?, 1, ?)
      `).run(generateUniqueId('REF'), inviter.id, userId, now);

      if (inviter.referred_by_user_id) {
        const lv2Id = inviter.referred_by_user_id;
        db.prepare(`
          INSERT INTO referrals (id, ancestor_user_id, descendant_user_id, level, created_at)
          VALUES (?, ?, ?, 2, ?)
        `).run(generateUniqueId('REF'), lv2Id, userId, now);

        const lv2User = db
          .prepare('SELECT referred_by_user_id FROM users WHERE id = ?')
          .get(lv2Id) as { referred_by_user_id: string | null } | undefined;
        if (lv2User?.referred_by_user_id) {
          db.prepare(`
            INSERT INTO referrals (id, ancestor_user_id, descendant_user_id, level, created_at)
            VALUES (?, ?, ?, 3, ?)
          `).run(generateUniqueId('REF'), lv2User.referred_by_user_id, userId, now);
        }
      }
    }

    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, category, is_read, created_at)
      VALUES (?, ?, ?, ?, 'account', 0, ?)
    `).run(
      generateUniqueId('NTF'),
      userId,
      'Account Created',
      `Welcome to MAHENDRA! Your unique invitation code is ${referralCode}.`,
      now
    );

    writeAuditLog({
      actorType: 'user',
      actorId: userId,
      action: 'USER_REGISTERED',
      targetType: 'user',
      targetId: userId,
      details: { maskedPhone: maskPhone(phoneRaw), invitedBy: inviter?.id ?? null },
      ipAddress: req.ip,
    });
  });

  runRegister();

  const token = signSessionToken(userId, 'user');
  res.status(201).json({
    token,
    user: {
      id: userId,
      countryCode,
      maskedPhone: maskPhone(phoneRaw),
      referralCode,
      username,
      vipLevel: 1,
    },
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const phoneRaw = asCleanString(req.body?.phone, 20).replace(/\D/g, '');
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const acceptedTerms = req.body?.acceptedTerms !== false;

  if (!acceptedTerms) {
    res.status(400).json({ error: 'Please accept the Terms & Conditions.' });
    return;
  }
  if (!phoneRaw || !password) {
    res.status(400).json({ error: 'Mobile number and password are required.' });
    return;
  }

  const user = db
    .prepare(
      'SELECT id, country_code, phone, password_hash, status, referral_code FROM users WHERE phone = ?'
    )
    .get(phoneRaw) as
    | {
        id: string;
        country_code: string;
        phone: string;
        password_hash: string;
        status: string;
        referral_code: string;
      }
    | undefined;

  if (!user || !verifySecret(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid mobile number or password.' });
    return;
  }

  if (user.status !== 'active') {
    res.status(403).json({ error: 'This account has been suspended. Contact support.' });
    return;
  }

  const profile = db
    .prepare('SELECT username, vip_level FROM profiles WHERE user_id = ?')
    .get(user.id) as { username: string; vip_level: number } | undefined;

  writeAuditLog({
    actorType: 'user',
    actorId: user.id,
    action: 'USER_LOGIN',
    targetType: 'user',
    targetId: user.id,
    ipAddress: req.ip,
  });

  const token = signSessionToken(user.id, 'user');
  res.json({
    token,
    user: {
      id: user.id,
      countryCode: user.country_code,
      maskedPhone: maskPhone(user.phone),
      referralCode: user.referral_code,
      username: profile?.username ?? 'Member',
      vipLevel: profile?.vip_level ?? 1,
    },
  });
});

app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  const phoneRaw = asCleanString(req.body?.phone, 20).replace(/\D/g, '');
  const withdrawalPassword =
    typeof req.body?.withdrawalPassword === 'string' ? req.body.withdrawalPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (!phoneRaw || !withdrawalPassword || newPassword.length < 6) {
    res.status(400).json({
      error: 'Provide your mobile number, current withdrawal password, and a new password (6+ chars).',
    });
    return;
  }

  const user = db
    .prepare('SELECT id, withdrawal_password_hash FROM users WHERE phone = ?')
    .get(phoneRaw) as { id: string; withdrawal_password_hash: string } | undefined;

  if (!user || !verifySecret(withdrawalPassword, user.withdrawal_password_hash)) {
    res.status(401).json({ error: 'Verification failed. Check your mobile number or withdrawal password.' });
    return;
  }

  const newHash = hashSecret(newPassword);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    newHash,
    new Date().toISOString(),
    user.id
  );

  writeAuditLog({
    actorType: 'user',
    actorId: user.id,
    action: 'PASSWORD_RESET_BY_WITHDRAWAL_PIN',
    targetType: 'user',
    targetId: user.id,
    ipAddress: req.ip,
  });

  res.json({ ok: true, message: 'Login password updated. You can now sign in.' });
});

// ============================================================================
// USER PROFILE & ACCOUNT
// ============================================================================

app.get('/api/me', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const user = db
    .prepare('SELECT id, country_code, phone, status, referral_code, created_at FROM users WHERE id = ?')
    .get(userId) as
    | {
        id: string;
        country_code: string;
        phone: string;
        status: string;
        referral_code: string;
        created_at: string;
      }
    | undefined;

  if (!user) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  const profile = db
    .prepare(
      'SELECT username, vip_level, available_balance, total_recharge, total_income, total_withdrawn, total_won, language, avatar_style FROM profiles WHERE user_id = ?'
    )
    .get(userId) as Record<string, unknown>;

  const orderCounts = db
    .prepare(
      `SELECT product_id, COUNT(*) as count FROM orders WHERE user_id = ? AND status != 'cancelled' GROUP BY product_id`
    )
    .all(userId) as { product_id: string; count: number }[];

  const productPurchaseCounts: Record<string, number> = {};
  for (const row of orderCounts) {
    productPurchaseCounts[row.product_id] = row.count;
  }

  const activeOrdersCount = (
    db
      .prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND status = 'active'")
      .get(userId) as { c: number }
  ).c;

  const totalOrdersCount = (
    db
      .prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND status != 'cancelled'")
      .get(userId) as { c: number }
  ).c;

  const unreadNotificationsCount = (
    db
      .prepare('SELECT COUNT(*) as c FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0')
      .get(userId) as { c: number }
  ).c;

  const bankAccounts = db
    .prepare(
      'SELECT id, account_holder, bank_name, account_number, ifsc_code, upi_id, is_default, created_at FROM bank_accounts WHERE user_id = ? ORDER BY is_default DESC, created_at DESC'
    )
    .all(userId);

  res.json({
    user: {
      id: user.id,
      countryCode: user.country_code,
      maskedPhone: maskPhone(user.phone),
      phoneLast4: user.phone.slice(-4),
      status: user.status,
      referralCode: user.referral_code,
      createdAt: user.created_at,
    },
    profile: {
      username: profile.username,
      vipLevel: profile.vip_level,
      availableBalance: Number(profile.available_balance ?? 0),
      totalRecharge: Number(profile.total_recharge ?? 0),
      totalIncome: Number(profile.total_income ?? 0),
      totalWithdrawn: Number(profile.total_withdrawn ?? 0),
      totalWon: Number(profile.total_won ?? 0),
      language: profile.language,
      avatarStyle: profile.avatar_style,
    },
    activeOrdersCount,
    hasActivePlan: totalOrdersCount > 0,
    unreadNotificationsCount,
    productPurchaseCounts,
    bankAccounts,
  });
});

app.patch('/api/me/profile', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const username = asCleanString(req.body?.username, 32);
  const language = asCleanString(req.body?.language, 10);

  if (username && username.length < 2) {
    res.status(400).json({ error: 'Username must be at least 2 characters.' });
    return;
  }

  const now = new Date().toISOString();
  if (username) {
    db.prepare('UPDATE profiles SET username = ?, updated_at = ? WHERE user_id = ?').run(
      username,
      now,
      userId
    );
  }
  if (language) {
    db.prepare('UPDATE profiles SET language = ?, updated_at = ? WHERE user_id = ?').run(
      language,
      now,
      userId
    );
  }
  res.json({ ok: true });
});

app.post('/api/me/change-password', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const kind = req.body?.kind === 'withdrawal' ? 'withdrawal' : 'login';
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (newPassword.length < (kind === 'withdrawal' ? 4 : 6)) {
    res.status(400).json({ error: 'New password does not meet minimum length requirements.' });
    return;
  }

  const user = db
    .prepare('SELECT password_hash, withdrawal_password_hash FROM users WHERE id = ?')
    .get(userId) as { password_hash: string; withdrawal_password_hash: string } | undefined;

  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const targetHash = kind === 'withdrawal' ? user.withdrawal_password_hash : user.password_hash;
  if (!verifySecret(currentPassword, targetHash)) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }

  const nextHash = hashSecret(newPassword);
  const now = new Date().toISOString();
  if (kind === 'withdrawal') {
    db.prepare('UPDATE users SET withdrawal_password_hash = ?, updated_at = ? WHERE id = ?').run(
      nextHash,
      now,
      userId
    );
  } else {
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      nextHash,
      now,
      userId
    );
  }

  writeAuditLog({
    actorType: 'user',
    actorId: userId,
    action: kind === 'withdrawal' ? 'WITHDRAWAL_PASSWORD_CHANGED' : 'LOGIN_PASSWORD_CHANGED',
    targetType: 'user',
    targetId: userId,
    ipAddress: req.ip,
  });

  res.json({ ok: true, message: 'Password updated successfully.' });
});

// ============================================================================
// ORDERS & INVESTMENTS (ATOMIC SERVER-SIDE)
// ============================================================================

app.post('/api/orders', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const productId = asCleanString(req.body?.productId, 64);
  const acceptedDisclosure = Boolean(req.body?.acceptedDisclosure);

  if (!productId) {
    res.status(400).json({ error: 'Product selection is required.' });
    return;
  }
  if (!acceptedDisclosure) {
    res.status(400).json({ error: 'Please acknowledge the plan terms and risk disclosure.' });
    return;
  }

  const settings = getSettingsMap();
  if (settings.maintenanceMode === 'true') {
    res.status(503).json({ error: 'Platform is temporarily in maintenance mode.' });
    return;
  }

  try {
    const result = db.transaction(() => {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as
        | {
            id: string;
            name: string;
            price: number;
            duration_days: number;
            daily_return: number;
            total_return: number;
            purchase_limit: number;
            status: string;
          }
        | undefined;

      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }
      if (product.status !== 'active') {
        throw new Error('PRODUCT_NOT_ACTIVE');
      }

      const existingCount = (
        db
          .prepare(
            "SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND product_id = ? AND status != 'cancelled'"
          )
          .get(userId, productId) as { c: number }
      ).c;

      if (existingCount >= product.purchase_limit) {
        throw new Error('LIMIT_REACHED');
      }

      const profile = db
        .prepare('SELECT available_balance, total_income FROM profiles WHERE user_id = ?')
        .get(userId) as { available_balance: number; total_income: number } | undefined;

      if (!profile) {
        throw new Error('PROFILE_NOT_FOUND');
      }

      const balanceBefore = roundMoney(Number(profile.available_balance));
      const price = roundMoney(Number(product.price));
      if (balanceBefore < price) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      const balanceAfter = roundMoney(balanceBefore - price);
      const now = new Date();
      const nowIso = now.toISOString();
      const maturesIso = new Date(
        now.getTime() + product.duration_days * 24 * 60 * 60 * 1000
      ).toISOString();

      const orderId = generateUniqueId('ORD');
      const orderNumber = `MH-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

      db.prepare('UPDATE profiles SET available_balance = ?, updated_at = ? WHERE user_id = ?').run(
        balanceAfter,
        nowIso,
        userId
      );

      db.prepare(`
        INSERT INTO orders (
          id, order_number, user_id, product_id, product_name, amount,
          daily_return, total_projected_return, duration_days, days_completed,
          earned_so_far, status, created_at, matures_at, last_yield_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'active', ?, ?, ?)
      `).run(
        orderId,
        orderNumber,
        userId,
        product.id,
        product.name,
        price,
        product.daily_return,
        product.total_return,
        product.duration_days,
        nowIso,
        maturesIso,
        nowIso
      );

      db.prepare(`
        INSERT INTO transactions (
          id, tx_ref, user_id, type, category, amount, balance_before, balance_after,
          description, reference_id, status, created_at
        ) VALUES (?, ?, ?, 'debit', 'investment', ?, ?, ?, ?, ?, 'completed', ?)
      `).run(
        generateUniqueId('TXN'),
        generateUniqueId('TX'),
        userId,
        price,
        balanceBefore,
        balanceAfter,
        `Activated ${product.name} (${product.duration_days} Days)`,
        orderId,
        nowIso
      );

      // Multi-level referral commission calculation (server-side atomic)
      const rates: Record<number, number> = {
        1: Number(settings.commissionLv1 ?? 22),
        2: Number(settings.commissionLv2 ?? 2),
        3: Number(settings.commissionLv3 ?? 1),
      };

      const ancestors = db
        .prepare('SELECT ancestor_user_id, level FROM referrals WHERE descendant_user_id = ? ORDER BY level ASC')
        .all(userId) as { ancestor_user_id: string; level: number }[];

      for (const anc of ancestors) {
        const rate = rates[anc.level] ?? 0;
        if (rate <= 0) continue;
        const commissionAmt = roundMoney((price * rate) / 100);
        if (commissionAmt <= 0) continue;

        const ancProfile = db
          .prepare('SELECT available_balance, total_income FROM profiles WHERE user_id = ?')
          .get(anc.ancestor_user_id) as { available_balance: number; total_income: number } | undefined;
        if (!ancProfile) continue;

        const ancBefore = roundMoney(Number(ancProfile.available_balance));
        const ancAfter = roundMoney(ancBefore + commissionAmt);
        const ancIncome = roundMoney(Number(ancProfile.total_income) + commissionAmt);

        db.prepare(
          'UPDATE profiles SET available_balance = ?, total_income = ?, updated_at = ? WHERE user_id = ?'
        ).run(ancAfter, ancIncome, nowIso, anc.ancestor_user_id);

        const commId = generateUniqueId('COM');
        db.prepare(`
          INSERT INTO commissions (id, beneficiary_user_id, source_user_id, order_id, level, rate_percent, base_amount, commission_amount, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'credited', ?)
        `).run(commId, anc.ancestor_user_id, userId, orderId, anc.level, rate, price, commissionAmt, nowIso);

        db.prepare(`
          INSERT INTO transactions (
            id, tx_ref, user_id, type, category, amount, balance_before, balance_after,
            description, reference_id, status, created_at
          ) VALUES (?, ?, ?, 'credit', 'commission', ?, ?, ?, ?, ?, 'completed', ?)
        `).run(
          generateUniqueId('TXN'),
          generateUniqueId('TX'),
          anc.ancestor_user_id,
          commissionAmt,
          ancBefore,
          ancAfter,
          `Level ${anc.level} referral commission (${rate}%) from plan activation`,
          commId,
          nowIso
        );

        db.prepare(`
          INSERT INTO notifications (id, user_id, title, message, category, is_read, created_at)
          VALUES (?, ?, ?, ?, 'commission', 0, ?)
        `).run(
          generateUniqueId('NTF'),
          anc.ancestor_user_id,
          'Team Commission Credited',
          `You earned ₹${commissionAmt} (Level ${anc.level}, ${rate}%) from a team plan activation.`,
          nowIso
        );
      }

      writeAuditLog({
        actorType: 'user',
        actorId: userId,
        action: 'ORDER_PURCHASED',
        targetType: 'order',
        targetId: orderId,
        details: { productId: product.id, amount: price },
        ipAddress: req.ip,
      });

      return { orderId, orderNumber, balanceAfter };
    })();

    res.status(201).json({ ok: true, ...result });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN';
    if (code === 'PRODUCT_NOT_FOUND') {
      res.status(404).json({ error: 'Selected plan was not found.' });
    } else if (code === 'PRODUCT_NOT_ACTIVE') {
      res.status(400).json({ error: 'This plan is currently in Presale / unavailable for purchase.' });
    } else if (code === 'LIMIT_REACHED') {
      res.status(400).json({ error: 'You have reached the maximum purchase limit for this plan.' });
    } else if (code === 'INSUFFICIENT_FUNDS') {
      res.status(400).json({ error: 'Insufficient wallet balance. Please recharge first.' });
    } else {
      res.status(500).json({ error: 'Unable to complete purchase.' });
    }
  }
});

app.get('/api/orders', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const statusFilter = asCleanString(req.query.status, 20);
  let rows;
  if (statusFilter && ['active', 'completed', 'cancelled'].includes(statusFilter)) {
    rows = db
      .prepare('SELECT * FROM orders WHERE user_id = ? AND status = ? ORDER BY created_at DESC')
      .all(userId, statusFilter);
  } else {
    rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  }
  res.json({ orders: rows });
});

app.post('/api/orders/:id/claim-yield', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const orderId = asCleanString(req.params.id, 64);

  try {
    const result = db.transaction(() => {
      const order = db
        .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
        .get(orderId, userId) as
        | {
            id: string;
            product_name: string;
            daily_return: number;
            duration_days: number;
            days_completed: number;
            earned_so_far: number;
            status: string;
            created_at: string;
          }
        | undefined;

      if (!order) throw new Error('NOT_FOUND');
      if (order.status !== 'active') throw new Error('NOT_ACTIVE');

      const elapsedDays = Math.min(
        order.duration_days,
        Math.floor((Date.now() - new Date(order.created_at).getTime()) / (24 * 60 * 60 * 1000))
      );

      const claimableDays = elapsedDays - order.days_completed;
      if (claimableDays <= 0) {
        throw new Error('NO_YIELD_DUE');
      }

      const creditAmount = roundMoney(claimableDays * order.daily_return);
      const nextDays = order.days_completed + claimableDays;
      const nextEarned = roundMoney(order.earned_so_far + creditAmount);
      const nextStatus = nextDays >= order.duration_days ? 'completed' : 'active';
      const nowIso = new Date().toISOString();

      const profile = db
        .prepare('SELECT available_balance, total_income FROM profiles WHERE user_id = ?')
        .get(userId) as { available_balance: number; total_income: number };
      const before = roundMoney(profile.available_balance);
      const after = roundMoney(before + creditAmount);
      const nextTotalIncome = roundMoney(profile.total_income + creditAmount);

      db.prepare(
        'UPDATE profiles SET available_balance = ?, total_income = ?, updated_at = ? WHERE user_id = ?'
      ).run(after, nextTotalIncome, nowIso, userId);

      db.prepare(
        'UPDATE orders SET days_completed = ?, earned_so_far = ?, status = ?, last_yield_at = ? WHERE id = ?'
      ).run(nextDays, nextEarned, nextStatus, nowIso, orderId);

      db.prepare(`
        INSERT INTO transactions (
          id, tx_ref, user_id, type, category, amount, balance_before, balance_after,
          description, reference_id, status, created_at
        ) VALUES (?, ?, ?, 'credit', 'yield', ?, ?, ?, ?, ?, 'completed', ?)
      `).run(
        generateUniqueId('TXN'),
        generateUniqueId('TX'),
        userId,
        creditAmount,
        before,
        after,
        `Cycle yield settlement (${claimableDays}d) for ${order.product_name}`,
        orderId,
        nowIso
      );

      return { credited: creditAmount, daysSettled: claimableDays, balanceAfter: after };
    })();

    res.json({ ok: true, ...result });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN';
    if (code === 'NOT_FOUND') res.status(404).json({ error: 'Order not found.' });
    else if (code === 'NOT_ACTIVE') res.status(400).json({ error: 'Order is already completed or closed.' });
    else if (code === 'NO_YIELD_DUE')
      res.status(400).json({ error: 'No new daily cycle has elapsed yet. Check back after 24 hours.' });
    else res.status(500).json({ error: 'Unable to settle yield.' });
  }
});

// ============================================================================
// RECHARGE / DEPOSITS & PAYMENT VERIFICATION
// ============================================================================

app.get('/api/transactions', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const type = asCleanString(req.query.type, 16);
  let rows;
  if (type === 'credit' || type === 'debit') {
    rows = db
      .prepare('SELECT * FROM transactions WHERE user_id = ? AND type = ? ORDER BY created_at DESC LIMIT 200')
      .all(userId, type);
  } else {
    rows = db
      .prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 200')
      .all(userId);
  }
  res.json({ transactions: rows });
});

app.get('/api/deposits', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const rows = db
    .prepare('SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(userId);
  res.json({ deposits: rows });
});

app.post('/api/deposits', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const amount = asPositiveNumber(req.body?.amount);
  const paymentMethod = asCleanString(req.body?.paymentMethod || 'upi', 32);
  const utrReference = asCleanString(req.body?.utrReference, 64);
  const idempotencyKey = asCleanString(req.body?.idempotencyKey, 80) || generateUniqueId('IDEMP');

  const settings = getSettingsMap();
  const minRecharge = Number(settings.minRecharge ?? 598);

  if (amount === null || amount < minRecharge) {
    res.status(400).json({ error: `Minimum recharge amount is ₹${minRecharge}.` });
    return;
  }
  if (!['upi', 'bank'].includes(paymentMethod)) {
    res.status(400).json({
      error:
        paymentMethod === 'gateway'
          ? 'Online payment gateway is temporarily disabled. Please use UPI / Telegram-assisted deposit verification.'
          : 'Invalid payment method.',
    });
    return;
  }
  if (utrReference.length < 6) {
    res.status(400).json({ error: 'Enter a valid 6+ character UTR / bank transaction reference.' });
    return;
  }

  const existingIdemp = db
    .prepare('SELECT id, deposit_ref, status FROM deposits WHERE idempotency_key = ?')
    .get(idempotencyKey) as { id: string; deposit_ref: string; status: string } | undefined;
  if (existingIdemp) {
    res.json({ ok: true, deposit: existingIdemp, deduplicated: true });
    return;
  }

  const depositId = generateUniqueId('DEP');
  const depositRef = `RCH-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO deposits (
      id, deposit_ref, user_id, amount, payment_method, utr_reference,
      idempotency_key, gateway_provider, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(
    depositId,
    depositRef,
    userId,
    amount,
    paymentMethod,
    utrReference || null,
    idempotencyKey,
    paymentMethod === 'gateway' ? 'configured_gateway' : 'manual_verification',
    now
  );

  writeAuditLog({
    actorType: 'user',
    actorId: userId,
    action: 'DEPOSIT_SUBMITTED',
    targetType: 'deposit',
    targetId: depositId,
    details: { amount, paymentMethod, depositRef },
    ipAddress: req.ip,
  });

  res.status(201).json({
    ok: true,
    deposit: {
      id: depositId,
      deposit_ref: depositRef,
      amount,
      payment_method: paymentMethod,
      utr_reference: utrReference || null,
      status: 'pending',
      created_at: now,
    },
    message:
      'Deposit request submitted for server-side verification. Your wallet will be credited once verified.',
  });
});

// Signed Payment Gateway Webhook (Optional — temporarily disabled unless configured & enabled)
app.post('/api/payments/webhook', async (req: Request, res: Response) => {
  const paymentGatewayEnabled = process.env.PAYMENT_GATEWAY_ENABLED === 'true';
  const webhookSecret = process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET?.trim();
  if (!paymentGatewayEnabled || !webhookSecret) {
    res.status(200).json({
      ok: false,
      disabled: true,
      message: 'Payment gateway integration is temporarily disabled. Manual deposit verification is active.',
    });
    return;
  }
  const signature = req.headers['x-gateway-signature'];
  if (typeof signature !== 'string') {
    res.status(401).json({ error: 'Missing gateway signature.' });
    return;
  }
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    res.status(401).json({ error: 'Invalid gateway signature.' });
    return;
  }

  const depositRef = asCleanString(req.body?.depositRef, 64);
  const status = req.body?.status === 'paid' ? 'paid' : 'rejected';
  if (!depositRef) {
    res.status(400).json({ error: 'Missing depositRef' });
    return;
  }

  const rawSbUrl = (process.env.VITE_SUPABASE_URL?.trim() || '').replace(/^["']|["']$/g, '');
  const sbUrl = /^[a-z0-9]{15,32}$/i.test(rawSbUrl)
    ? `https://${rawSbUrl.toLowerCase()}.supabase.co`
    : rawSbUrl;
  const sbServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (sbUrl && sbServiceRoleKey) {
    try {
      const supabaseAdmin = createClient(sbUrl, sbServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await supabaseAdmin.rpc('gateway_verify_deposit', {
        p_deposit_ref: depositRef,
        p_status: status,
      });
      if (error) {
        if (error.message?.includes('Deposit not found')) {
          res.status(404).json({ error: 'Deposit not found' });
          return;
        }
        res.status(500).json({ error: 'Supabase webhook verification failed' });
        return;
      }
      res.json({ ok: true, ...(typeof data === 'object' && data !== null ? data : {}) });
      return;
    } catch {
      res.status(500).json({ error: 'Webhook processing error' });
      return;
    }
  }

  try {
    const legacyStatus = status === 'paid' ? 'approved' : 'rejected';
    const out = db.transaction(() => {
      const dep = db.prepare('SELECT * FROM deposits WHERE deposit_ref = ?').get(depositRef) as
        | { id: string; user_id: string; amount: number; status: string }
        | undefined;
      if (!dep) throw new Error('NOT_FOUND');
      if (dep.status !== 'pending') return { alreadyProcessed: true, status: dep.status };

      const now = new Date().toISOString();
      if (legacyStatus === 'approved') {
        const profile = db
          .prepare('SELECT available_balance, total_recharge FROM profiles WHERE user_id = ?')
          .get(dep.user_id) as { available_balance: number; total_recharge: number };
        const before = roundMoney(profile.available_balance);
        const after = roundMoney(before + dep.amount);
        const nextTotalRecharge = roundMoney(profile.total_recharge + dep.amount);
        const nextVip = nextTotalRecharge >= 25000 ? 4 : nextTotalRecharge >= 10000 ? 3 : nextTotalRecharge >= 2000 ? 2 : 1;

        db.prepare(
          'UPDATE profiles SET available_balance = ?, total_recharge = ?, vip_level = ?, updated_at = ? WHERE user_id = ?'
        ).run(after, nextTotalRecharge, nextVip, now, dep.user_id);

        db.prepare(`
          INSERT INTO transactions (id, tx_ref, user_id, type, category, amount, balance_before, balance_after, description, reference_id, status, created_at)
          VALUES (?, ?, ?, 'credit', 'deposit', ?, ?, ?, ?, ?, 'completed', ?)
        `).run(
          generateUniqueId('TXN'),
          generateUniqueId('TX'),
          dep.user_id,
          dep.amount,
          before,
          after,
          `Verified gateway deposit (${depositRef})`,
          dep.id,
          now
        );
      }

      db.prepare('UPDATE deposits SET status = ?, verified_by = ?, verified_at = ? WHERE id = ?').run(
        legacyStatus,
        'gateway_webhook',
        now,
        dep.id
      );

      return { alreadyProcessed: false, status: legacyStatus };
    })();

    res.json({ ok: true, ...out });
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'Deposit not found' });
    } else {
      res.status(500).json({ error: 'Webhook processing error' });
    }
  }
});

// ============================================================================
// BANK ACCOUNTS & WITHDRAWALS
// ============================================================================

app.get('/api/bank-accounts', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const rows = db
    .prepare('SELECT * FROM bank_accounts WHERE user_id = ? ORDER BY is_default DESC, created_at DESC')
    .all(userId);
  res.json({ bankAccounts: rows });
});

app.post('/api/bank-accounts', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const accountHolder = asCleanString(req.body?.accountHolder, 80);
  const bankName = asCleanString(req.body?.bankName, 80);
  const accountNumber = asCleanString(req.body?.accountNumber, 34).replace(/\s+/g, '');
  const ifscCode = asCleanString(req.body?.ifscCode, 20).toUpperCase();
  const upiId = asCleanString(req.body?.upiId, 80);

  if (accountHolder.length < 2 || bankName.length < 2 || accountNumber.length < 6 || ifscCode.length < 4) {
    res.status(400).json({ error: 'Please complete all required bank account fields.' });
    return;
  }

  const id = generateUniqueId('BNK');
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare('UPDATE bank_accounts SET is_default = 0 WHERE user_id = ?').run(userId);
    db.prepare(`
      INSERT INTO bank_accounts (id, user_id, account_holder, bank_name, account_number, ifsc_code, upi_id, is_default, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, userId, accountHolder, bankName, accountNumber, ifscCode, upiId || null, now);
  })();

  res.status(201).json({ ok: true, id });
});

app.delete('/api/bank-accounts/:id', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const id = asCleanString(req.params.id, 64);
  db.prepare('DELETE FROM bank_accounts WHERE id = ? AND user_id = ?').run(id, userId);
  res.json({ ok: true });
});

app.get('/api/withdrawals', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const rows = db
    .prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(userId);
  res.json({ withdrawals: rows });
});

app.post('/api/withdrawals', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const amount = asPositiveNumber(req.body?.amount);
  const bankAccountId = asCleanString(req.body?.bankAccountId, 64);
  const withdrawalPassword =
    typeof req.body?.withdrawalPassword === 'string' ? req.body.withdrawalPassword : '';

  const settings = getSettingsMap();
  const minWithdraw = Number(settings.minWithdraw ?? 120);
  const maxWithdraw = Number(settings.maxWithdraw ?? 50000);
  const feePercent = Number(settings.withdrawFeePercent ?? 10);
  const enforceWindow = settings.enforceWithdrawWindow === 'true';
  const windowStr = settings.withdrawTimeWindow ?? '00:30 - 17:00';

  if (settings.maintenanceMode === 'true') {
    res.status(503).json({ error: 'Platform is temporarily in maintenance mode.' });
    return;
  }
  if (enforceWindow && !isWithinWithdrawWindow(windowStr)) {
    res.status(400).json({ error: `Withdrawals are only accepted between ${windowStr}.` });
    return;
  }
  if (amount === null || amount < minWithdraw || amount > maxWithdraw) {
    res.status(400).json({
      error: `Withdrawal amount must be between ₹${minWithdraw} and ₹${maxWithdraw}.`,
    });
    return;
  }
  if (!bankAccountId) {
    res.status(400).json({ error: 'Please bind and select a bank account.' });
    return;
  }
  if (!withdrawalPassword) {
    res.status(400).json({ error: 'Enter your withdrawal password.' });
    return;
  }

  const user = db
    .prepare('SELECT withdrawal_password_hash FROM users WHERE id = ?')
    .get(userId) as { withdrawal_password_hash: string } | undefined;

  if (!user || !verifySecret(withdrawalPassword, user.withdrawal_password_hash)) {
    res.status(401).json({ error: 'Incorrect withdrawal password.' });
    return;
  }

  try {
    const out = db.transaction(() => {
      const bank = db
        .prepare('SELECT * FROM bank_accounts WHERE id = ? AND user_id = ?')
        .get(bankAccountId, userId) as Record<string, unknown> | undefined;
      if (!bank) throw new Error('BANK_NOT_FOUND');

      const profile = db
        .prepare('SELECT available_balance FROM profiles WHERE user_id = ?')
        .get(userId) as { available_balance: number };

      const before = roundMoney(profile.available_balance);
      if (before < amount) throw new Error('INSUFFICIENT_FUNDS');

      const after = roundMoney(before - amount);
      const feeAmount = roundMoney((amount * feePercent) / 100);
      const netAmount = roundMoney(amount - feeAmount);
      const now = new Date().toISOString();

      const withdrawalId = generateUniqueId('WDR');
      const withdrawalRef = `WD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

      db.prepare('UPDATE profiles SET available_balance = ?, updated_at = ? WHERE user_id = ?').run(
        after,
        now,
        userId
      );

      db.prepare(`
        INSERT INTO withdrawals (
          id, withdrawal_ref, user_id, bank_account_id, bank_snapshot_json,
          gross_amount, fee_percent, fee_amount, net_amount, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `).run(
        withdrawalId,
        withdrawalRef,
        userId,
        bankAccountId,
        JSON.stringify({
          account_holder: bank.account_holder,
          bank_name: bank.bank_name,
          account_number_masked: `****${String(bank.account_number).slice(-4)}`,
          ifsc_code: bank.ifsc_code,
        }),
        amount,
        feePercent,
        feeAmount,
        netAmount,
        now
      );

      db.prepare(`
        INSERT INTO transactions (
          id, tx_ref, user_id, type, category, amount, balance_before, balance_after,
          description, reference_id, status, created_at
        ) VALUES (?, ?, ?, 'debit', 'withdrawal', ?, ?, ?, ?, ?, 'pending', ?)
      `).run(
        generateUniqueId('TXN'),
        generateUniqueId('TX'),
        userId,
        amount,
        before,
        after,
        `Withdrawal request ${withdrawalRef} (Net ₹${netAmount})`,
        withdrawalId,
        now
      );

      writeAuditLog({
        actorType: 'user',
        actorId: userId,
        action: 'WITHDRAWAL_REQUESTED',
        targetType: 'withdrawal',
        targetId: withdrawalId,
        details: { grossAmount: amount, feeAmount, netAmount },
        ipAddress: req.ip,
      });

      return { withdrawalId, withdrawalRef, netAmount, balanceAfter: after };
    })();

    res.status(201).json({ ok: true, ...out });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN';
    if (code === 'BANK_NOT_FOUND') res.status(400).json({ error: 'Selected bank account not found.' });
    else if (code === 'INSUFFICIENT_FUNDS')
      res.status(400).json({ error: 'Insufficient withdrawable balance.' });
    else res.status(500).json({ error: 'Unable to submit withdrawal request.' });
  }
});

// ============================================================================
// TEAM / REFERRALS & TREASURE BOX & NOTIFICATIONS
// ============================================================================

app.get('/api/team', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const settings = getSettingsMap();
  const rates: Record<number, number> = {
    1: Number(settings.commissionLv1 ?? 22),
    2: Number(settings.commissionLv2 ?? 2),
    3: Number(settings.commissionLv3 ?? 1),
  };

  const refs = db
    .prepare(`
      SELECT r.level, r.created_at, u.id as member_id, u.phone, p.username, p.total_recharge,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status != 'cancelled') as order_count
      FROM referrals r
      JOIN users u ON u.id = r.descendant_user_id
      JOIN profiles p ON p.user_id = u.id
      WHERE r.ancestor_user_id = ?
      ORDER BY r.created_at DESC
    `)
    .all(userId) as {
    level: number;
    created_at: string;
    member_id: string;
    phone: string;
    username: string;
    total_recharge: number;
    order_count: number;
  }[];

  const comms = db
    .prepare(
      'SELECT level, SUM(commission_amount) as total_commission FROM commissions WHERE beneficiary_user_id = ? GROUP BY level'
    )
    .all(userId) as { level: number; total_commission: number }[];

  const commByLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const c of comms) {
    commByLevel[c.level] = roundMoney(Number(c.total_commission ?? 0));
  }

  const levels = [1, 2, 3].map((lvl) => {
    const items = refs.filter((r) => r.level === lvl);
    const activeItems = items.filter((r) => r.order_count > 0 || r.total_recharge > 0);
    const rechargeSum = roundMoney(items.reduce((acc, cur) => acc + Number(cur.total_recharge ?? 0), 0));
    return {
      level: lvl,
      ratePercent: rates[lvl],
      membersCount: items.length,
      activeCount: activeItems.length,
      rechargeVolume: rechargeSum,
      commissionEarned: commByLevel[lvl] ?? 0,
      members: items.map((m) => ({
        id: m.member_id,
        username: m.username,
        maskedPhone: maskPhone(m.phone),
        isActive: m.order_count > 0 || m.total_recharge > 0,
        joinedAt: m.created_at,
      })),
    };
  });

  const totalMembers = refs.length;
  const activeMembers = levels.reduce((acc, l) => acc + l.activeCount, 0);
  const totalTeamRecharge = roundMoney(levels.reduce((acc, l) => acc + l.rechargeVolume, 0));
  const totalCommissionCredited = roundMoney(
    (commByLevel[1] ?? 0) + (commByLevel[2] ?? 0) + (commByLevel[3] ?? 0)
  );

  res.json({
    totalMembers,
    activeMembers,
    totalTeamRecharge,
    totalCommissionCredited,
    levels,
  });
});

app.get('/api/treasure', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const profile = db
    .prepare('SELECT available_balance, total_won FROM profiles WHERE user_id = ?')
    .get(userId) as { available_balance: number; total_won: number };
  const rewards = db
    .prepare('SELECT id, code, amount, created_at FROM rewards WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);
  const activeOrders = (
    db
      .prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND status != 'cancelled'")
      .get(userId) as { c: number }
  ).c;

  res.json({
    isUnlocked: activeOrders > 0,
    totalWon: Number(profile?.total_won ?? 0),
    balance: Number(profile?.available_balance ?? 0),
    codesUsed: rewards.length,
    rewards,
  });
});

app.post('/api/treasure/redeem', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const code = asCleanString(req.body?.code, 32).toUpperCase();

  if (!code) {
    res.status(400).json({ error: 'Please enter a gift code.' });
    return;
  }

  try {
    const out = db.transaction(() => {
      const gift = db.prepare('SELECT * FROM gift_codes WHERE code = ?').get(code) as
        | {
            id: string;
            code: string;
            reward_amount: number;
            max_uses: number;
            used_count: number;
            requires_active_plan: number;
            expires_at: string | null;
            status: string;
          }
        | undefined;

      if (!gift || gift.status !== 'active') throw new Error('INVALID_CODE');
      if (gift.expires_at && new Date(gift.expires_at).getTime() < Date.now()) {
        throw new Error('EXPIRED_CODE');
      }
      if (gift.used_count >= gift.max_uses) throw new Error('EXHAUSTED_CODE');

      if (gift.requires_active_plan === 1) {
        const planCount = (
          db
            .prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND status != 'cancelled'")
            .get(userId) as { c: number }
        ).c;
        if (planCount === 0) throw new Error('LOCKED');
      }

      const already = db
        .prepare('SELECT id FROM rewards WHERE user_id = ? AND gift_code_id = ?')
        .get(userId, gift.id);
      if (already) throw new Error('ALREADY_REDEEMED');

      const profile = db
        .prepare('SELECT available_balance, total_won, total_income FROM profiles WHERE user_id = ?')
        .get(userId) as { available_balance: number; total_won: number; total_income: number };

      const before = roundMoney(profile.available_balance);
      const after = roundMoney(before + gift.reward_amount);
      const nextWon = roundMoney(profile.total_won + gift.reward_amount);
      const nextIncome = roundMoney(profile.total_income + gift.reward_amount);
      const now = new Date().toISOString();

      db.prepare('UPDATE gift_codes SET used_count = used_count + 1 WHERE id = ?').run(gift.id);
      db.prepare(
        'UPDATE profiles SET available_balance = ?, total_won = ?, total_income = ?, updated_at = ? WHERE user_id = ?'
      ).run(after, nextWon, nextIncome, now, userId);

      const rewardId = generateUniqueId('RWD');
      db.prepare(
        'INSERT INTO rewards (id, user_id, gift_code_id, code, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(rewardId, userId, gift.id, gift.code, gift.reward_amount, now);

      db.prepare(`
        INSERT INTO transactions (
          id, tx_ref, user_id, type, category, amount, balance_before, balance_after,
          description, reference_id, status, created_at
        ) VALUES (?, ?, ?, 'credit', 'gift_reward', ?, ?, ?, ?, ?, 'completed', ?)
      `).run(
        generateUniqueId('TXN'),
        generateUniqueId('TX'),
        userId,
        gift.reward_amount,
        before,
        after,
        `Redeemed Treasure Box code ${gift.code}`,
        rewardId,
        now
      );

      writeAuditLog({
        actorType: 'user',
        actorId: userId,
        action: 'GIFT_CODE_REDEEMED',
        targetType: 'gift_code',
        targetId: gift.id,
        details: { code: gift.code, amount: gift.reward_amount },
        ipAddress: req.ip,
      });

      return { amount: gift.reward_amount, balanceAfter: after, code: gift.code };
    })();

    res.json({ ok: true, ...out });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'UNKNOWN';
    if (msg === 'INVALID_CODE') res.status(404).json({ error: 'Gift code is invalid or inactive.' });
    else if (msg === 'EXPIRED_CODE') res.status(400).json({ error: 'This gift code has expired.' });
    else if (msg === 'EXHAUSTED_CODE')
      res.status(400).json({ error: 'This gift code has reached its maximum redemptions.' });
    else if (msg === 'LOCKED')
      res.status(403).json({ error: 'Treasure Box is locked. Activate any investment plan to unlock this code.' });
    else if (msg === 'ALREADY_REDEEMED')
      res.status(409).json({ error: 'You have already redeemed this gift code.' });
    else res.status(500).json({ error: 'Unable to redeem gift code.' });
  }
});

app.get('/api/notifications', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const rows = db
    .prepare(
      'SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 50'
    )
    .all(userId);
  res.json({ notifications: rows });
});

app.post('/api/notifications/read-all', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
  res.json({ ok: true });
});

// ============================================================================
// ADMIN AUTHENTICATION & BOOTSTRAP
// ============================================================================

app.get('/api/admin/status', (_req: Request, res: Response) => {
  const envPass = process.env.ADMIN_PASSCODE?.trim();
  const count = (db.prepare('SELECT COUNT(*) as c FROM admin_users').get() as { c: number }).c;
  res.json({
    needsSetup: !envPass && count === 0,
    envConfigured: Boolean(envPass),
  });
});

app.post('/api/admin/bootstrap', (req: Request, res: Response) => {
  const envPass = process.env.ADMIN_PASSCODE?.trim();
  const count = (db.prepare('SELECT COUNT(*) as c FROM admin_users').get() as { c: number }).c;
  if (envPass || count > 0) {
    res.status(409).json({ error: 'Admin account is already initialized.' });
    return;
  }

  const username = asCleanString(req.body?.username, 40) || 'admin';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (password.length < 8) {
    res.status(400).json({ error: 'Admin password must be at least 8 characters.' });
    return;
  }

  const adminId = generateUniqueId('ADM');
  const now = new Date().toISOString();
  const hash = hashSecret(password);

  db.prepare(`
    INSERT INTO admin_users (id, user_id, username, password_hash, role, last_login_at, created_at)
    VALUES (?, NULL, ?, ?, 'super_admin', ?, ?)
  `).run(adminId, username, hash, now, now);

  writeAuditLog({
    actorType: 'admin',
    actorId: adminId,
    action: 'ADMIN_BOOTSTRAPPED',
    targetType: 'admin_user',
    targetId: adminId,
    ipAddress: req.ip,
  });

  const token = signSessionToken(adminId, 'admin', 60 * 60 * 12, username);
  res.status(201).json({ token, admin: { id: adminId, username, role: 'super_admin' } });
});

app.post('/api/admin/login', (req: Request, res: Response) => {
  const username = asCleanString(req.body?.username, 40);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  const envPass = process.env.ADMIN_PASSCODE?.trim();
  const envUser = process.env.ADMIN_USERNAME?.trim() || 'admin';

  if (envPass) {
    const passBuf = Buffer.from(password);
    const expBuf = Buffer.from(envPass);
    const passMatch = passBuf.length === expBuf.length && crypto.timingSafeEqual(passBuf, expBuf);
    const userMatch = !username || username === envUser;
    if (!passMatch || !userMatch) {
      res.status(401).json({ error: 'Invalid admin credentials.' });
      return;
    }
    const token = signSessionToken('ENV_ADMIN', 'admin', 60 * 60 * 12, envUser);
    writeAuditLog({
      actorType: 'admin',
      actorId: 'ENV_ADMIN',
      action: 'ADMIN_LOGIN',
      targetType: 'admin_user',
      targetId: 'ENV_ADMIN',
      ipAddress: req.ip,
    });
    res.json({ token, admin: { id: 'ENV_ADMIN', username: envUser, role: 'super_admin' } });
    return;
  }

  const admin = db
    .prepare('SELECT id, username, password_hash, role FROM admin_users WHERE username = ?')
    .get(username) as { id: string; username: string; password_hash: string; role: string } | undefined;

  if (!admin || !verifySecret(password, admin.password_hash)) {
    res.status(401).json({ error: 'Invalid admin username or password.' });
    return;
  }

  db.prepare('UPDATE admin_users SET last_login_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    admin.id
  );

  writeAuditLog({
    actorType: 'admin',
    actorId: admin.id,
    action: 'ADMIN_LOGIN',
    targetType: 'admin_user',
    targetId: admin.id,
    ipAddress: req.ip,
  });

  const token = signSessionToken(admin.id, 'admin', 60 * 60 * 12, admin.username);
  res.json({ token, admin: { id: admin.id, username: admin.username, role: admin.role } });
});

// ============================================================================
// ADMIN PROTECTED API
// ============================================================================

app.get('/api/admin/overview', requireAdminAuth, (_req: AuthenticatedRequest, res: Response) => {
  const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const activeUsers = (
    db.prepare("SELECT COUNT(*) as c FROM users WHERE status = 'active'").get() as { c: number }
  ).c;
  const depositsRow = db
    .prepare(
      "SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM deposits WHERE status = 'approved'"
    )
    .get() as { total: number; count: number };
  const pendingDeposits = (
    db.prepare("SELECT COUNT(*) as c FROM deposits WHERE status = 'pending'").get() as { c: number }
  ).c;
  const withdrawalsRow = db
    .prepare(
      "SELECT COALESCE(SUM(gross_amount), 0) as total, COUNT(*) as count FROM withdrawals WHERE status = 'approved'"
    )
    .get() as { total: number; count: number };
  const pendingWithdrawals = (
    db.prepare("SELECT COUNT(*) as c FROM withdrawals WHERE status = 'pending'").get() as { c: number }
  ).c;
  const ordersRow = db
    .prepare(
      "SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM orders WHERE status != 'cancelled'"
    )
    .get() as { total: number; count: number };
  const totalTransactions = (db.prepare('SELECT COUNT(*) as c FROM transactions').get() as { c: number }).c;

  res.json({
    totalUsers,
    activeUsers,
    totalDeposits: roundMoney(depositsRow.total),
    approvedDepositsCount: depositsRow.count,
    pendingDeposits,
    totalWithdrawals: roundMoney(withdrawalsRow.total),
    approvedWithdrawalsCount: withdrawalsRow.count,
    pendingWithdrawals,
    totalOrdersCount: ordersRow.count,
    totalOrderVolume: roundMoney(ordersRow.total),
    totalTransactions,
  });
});

app.get('/api/admin/users', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const q = asCleanString(req.query.q, 60);
  const rows = q
    ? db
        .prepare(`
          SELECT u.id, u.country_code, u.phone, u.status, u.referral_code, u.created_at,
                 p.username, p.vip_level, p.available_balance, p.total_recharge, p.total_income
          FROM users u JOIN profiles p ON p.user_id = u.id
          WHERE u.phone LIKE ? OR p.username LIKE ? OR u.referral_code LIKE ? OR u.id LIKE ?
          ORDER BY u.created_at DESC LIMIT 100
        `)
        .all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
    : db
        .prepare(`
          SELECT u.id, u.country_code, u.phone, u.status, u.referral_code, u.created_at,
                 p.username, p.vip_level, p.available_balance, p.total_recharge, p.total_income
          FROM users u JOIN profiles p ON p.user_id = u.id
          ORDER BY u.created_at DESC LIMIT 100
        `)
        .all();
  res.json({ users: rows });
});

app.patch('/api/admin/users/:id/status', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const targetId = asCleanString(req.params.id, 64);
  const status = req.body?.status === 'suspended' ? 'suspended' : 'active';
  db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(
    status,
    new Date().toISOString(),
    targetId
  );
  writeAuditLog({
    actorType: 'admin',
    actorId: req.auth!.sub,
    action: 'ADMIN_USER_STATUS_UPDATED',
    targetType: 'user',
    targetId,
    details: { status },
    ipAddress: req.ip,
  });
  res.json({ ok: true });
});

app.get('/api/admin/users/:id/activity', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const targetId = asCleanString(req.params.id, 64);
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(targetId);
  const transactions = db
    .prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(targetId);
  res.json({ orders, transactions });
});

app.get('/api/admin/products', requireAdminAuth, (_req: AuthenticatedRequest, res: Response) => {
  const products = db.prepare('SELECT * FROM products ORDER BY sort_order ASC, price ASC').all();
  res.json({ products });
});

app.post('/api/admin/products', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const name = asCleanString(req.body?.name, 80);
  const code = asCleanString(req.body?.code, 32).toUpperCase() || `MH-${Date.now().toString().slice(-4)}`;
  const subtitle = asCleanString(req.body?.subtitle, 120);
  const description = asCleanString(req.body?.description, 300);
  const imageKey = asCleanString(req.body?.imageKey || 'walnut', 40);
  const price = asPositiveNumber(req.body?.price);
  const durationDays = Math.max(1, Math.floor(Number(req.body?.durationDays || 120)));
  const dailyReturn = asPositiveNumber(req.body?.dailyReturn);
  const totalReturn = asPositiveNumber(req.body?.totalReturn) ?? roundMoney((dailyReturn ?? 0) * durationDays);
  const purchaseLimit = Math.max(1, Math.floor(Number(req.body?.purchaseLimit || 5)));
  const isPopular = req.body?.isPopular ? 1 : 0;
  const status = ['active', 'presale', 'inactive'].includes(req.body?.status) ? req.body.status : 'active';

  if (!name || price === null || dailyReturn === null) {
    res.status(400).json({ error: 'Name, price, and daily projected return are required.' });
    return;
  }

  const id = generateUniqueId('PRD');
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO products (
      id, name, code, subtitle, description, image_key, price, duration_days,
      daily_return, total_return, purchase_limit, is_popular, status, sort_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 99, ?)
  `).run(
    id,
    name,
    code,
    subtitle || 'Architectural Surface Plan',
    description || 'Configured investment portfolio plan.',
    imageKey,
    price,
    durationDays,
    dailyReturn,
    totalReturn,
    purchaseLimit,
    isPopular,
    status,
    now
  );

  writeAuditLog({
    actorType: 'admin',
    actorId: req.auth!.sub,
    action: 'ADMIN_PRODUCT_CREATED',
    targetType: 'product',
    targetId: id,
    details: { name, price, status },
    ipAddress: req.ip,
  });

  res.status(201).json({ ok: true, id });
});

app.put('/api/admin/products/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const id = asCleanString(req.params.id, 64);
  const name = asCleanString(req.body?.name, 80);
  const subtitle = asCleanString(req.body?.subtitle, 120);
  const description = asCleanString(req.body?.description, 300);
  const imageKey = asCleanString(req.body?.imageKey || 'walnut', 40);
  const price = asPositiveNumber(req.body?.price);
  const durationDays = Math.max(1, Math.floor(Number(req.body?.durationDays || 120)));
  const dailyReturn = asPositiveNumber(req.body?.dailyReturn);
  const totalReturn = asPositiveNumber(req.body?.totalReturn);
  const purchaseLimit = Math.max(1, Math.floor(Number(req.body?.purchaseLimit || 5)));
  const isPopular = req.body?.isPopular ? 1 : 0;
  const status = ['active', 'presale', 'inactive'].includes(req.body?.status) ? req.body.status : 'active';

  if (!name || price === null || dailyReturn === null || totalReturn === null) {
    res.status(400).json({ error: 'Valid name, price, daily return, and total return are required.' });
    return;
  }

  db.prepare(`
    UPDATE products SET
      name = ?, subtitle = ?, description = ?, image_key = ?, price = ?,
      duration_days = ?, daily_return = ?, total_return = ?, purchase_limit = ?,
      is_popular = ?, status = ?
    WHERE id = ?
  `).run(
    name,
    subtitle,
    description,
    imageKey,
    price,
    durationDays,
    dailyReturn,
    totalReturn,
    purchaseLimit,
    isPopular,
    status,
    id
  );

  writeAuditLog({
    actorType: 'admin',
    actorId: req.auth!.sub,
    action: 'ADMIN_PRODUCT_UPDATED',
    targetType: 'product',
    targetId: id,
    details: { name, price, status },
    ipAddress: req.ip,
  });

  res.json({ ok: true });
});

app.delete('/api/admin/products/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const id = asCleanString(req.params.id, 64);
  const hasOrders = (
    db.prepare('SELECT COUNT(*) as c FROM orders WHERE product_id = ?').get(id) as { c: number }
  ).c;
  if (hasOrders > 0) {
    db.prepare("UPDATE products SET status = 'inactive' WHERE id = ?").run(id);
  } else {
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }
  writeAuditLog({
    actorType: 'admin',
    actorId: req.auth!.sub,
    action: 'ADMIN_PRODUCT_DELETED',
    targetType: 'product',
    targetId: id,
    ipAddress: req.ip,
  });
  res.json({ ok: true });
});

app.get('/api/admin/deposits', requireAdminAuth, (_req: AuthenticatedRequest, res: Response) => {
  const rows = db
    .prepare(`
      SELECT d.*, u.phone, p.username
      FROM deposits d
      JOIN users u ON u.id = d.user_id
      JOIN profiles p ON p.user_id = d.user_id
      ORDER BY CASE WHEN d.status = 'pending' THEN 0 ELSE 1 END, d.created_at DESC
      LIMIT 150
    `)
    .all();
  res.json({ deposits: rows });
});

app.post('/api/admin/deposits/:id/verify', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const id = asCleanString(req.params.id, 64);
  const decision = req.body?.decision === 'approved' ? 'approved' : 'rejected';
  const adminNote = asCleanString(req.body?.note, 200);

  try {
    db.transaction(() => {
      const dep = db.prepare('SELECT * FROM deposits WHERE id = ?').get(id) as
        | { id: string; user_id: string; amount: number; deposit_ref: string; status: string }
        | undefined;
      if (!dep) throw new Error('NOT_FOUND');
      if (dep.status !== 'pending') throw new Error('ALREADY_PROCESSED');

      const now = new Date().toISOString();
      if (decision === 'approved') {
        const profile = db
          .prepare('SELECT available_balance, total_recharge FROM profiles WHERE user_id = ?')
          .get(dep.user_id) as { available_balance: number; total_recharge: number };
        const before = roundMoney(profile.available_balance);
        const after = roundMoney(before + dep.amount);
        const nextTotalRecharge = roundMoney(profile.total_recharge + dep.amount);
        const nextVip = nextTotalRecharge >= 25000 ? 4 : nextTotalRecharge >= 10000 ? 3 : nextTotalRecharge >= 2000 ? 2 : 1;

        db.prepare(
          'UPDATE profiles SET available_balance = ?, total_recharge = ?, vip_level = ?, updated_at = ? WHERE user_id = ?'
        ).run(after, nextTotalRecharge, nextVip, now, dep.user_id);

        db.prepare(`
          INSERT INTO transactions (
            id, tx_ref, user_id, type, category, amount, balance_before, balance_after,
            description, reference_id, status, created_at
          ) VALUES (?, ?, ?, 'credit', 'deposit', ?, ?, ?, ?, ?, 'completed', ?)
        `).run(
          generateUniqueId('TXN'),
          generateUniqueId('TX'),
          dep.user_id,
          dep.amount,
          before,
          after,
          `Recharge verified (${dep.deposit_ref})`,
          dep.id,
          now
        );

        db.prepare(`
          INSERT INTO notifications (id, user_id, title, message, category, is_read, created_at)
          VALUES (?, ?, ?, ?, 'wallet', 0, ?)
        `).run(
          generateUniqueId('NTF'),
          dep.user_id,
          'Recharge Verified',
          `Your deposit of ₹${dep.amount} (${dep.deposit_ref}) has been credited to your wallet.`,
          now
        );
      } else {
        db.prepare(`
          INSERT INTO notifications (id, user_id, title, message, category, is_read, created_at)
          VALUES (?, ?, ?, ?, 'wallet', 0, ?)
        `).run(
          generateUniqueId('NTF'),
          dep.user_id,
          'Recharge Declined',
          `Your deposit ${dep.deposit_ref} was declined.${adminNote ? ` Reason: ${adminNote}` : ''}`,
          now
        );
      }

      db.prepare(
        'UPDATE deposits SET status = ?, admin_note = ?, verified_by = ?, verified_at = ? WHERE id = ?'
      ).run(decision, adminNote || null, req.auth!.sub, now, dep.id);

      writeAuditLog({
        actorType: 'admin',
        actorId: req.auth!.sub,
        action: decision === 'approved' ? 'DEPOSIT_APPROVED' : 'DEPOSIT_REJECTED',
        targetType: 'deposit',
        targetId: dep.id,
        details: { amount: dep.amount, note: adminNote },
        ipAddress: req.ip,
      });
    })();

    res.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN';
    if (code === 'NOT_FOUND') res.status(404).json({ error: 'Deposit not found.' });
    else if (code === 'ALREADY_PROCESSED') res.status(409).json({ error: 'Deposit already processed.' });
    else res.status(500).json({ error: 'Unable to verify deposit.' });
  }
});

app.get('/api/admin/withdrawals', requireAdminAuth, (_req: AuthenticatedRequest, res: Response) => {
  const rows = db
    .prepare(`
      SELECT w.*, u.phone, p.username
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      JOIN profiles p ON p.user_id = w.user_id
      ORDER BY CASE WHEN w.status = 'pending' THEN 0 ELSE 1 END, w.created_at DESC
      LIMIT 150
    `)
    .all();
  res.json({ withdrawals: rows });
});

app.post('/api/admin/withdrawals/:id/process', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const id = asCleanString(req.params.id, 64);
  const decision = req.body?.decision === 'approved' ? 'approved' : 'rejected';
  const adminNote = asCleanString(req.body?.note, 200);

  try {
    db.transaction(() => {
      const w = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id) as
        | {
            id: string;
            user_id: string;
            gross_amount: number;
            net_amount: number;
            withdrawal_ref: string;
            status: string;
          }
        | undefined;

      if (!w) throw new Error('NOT_FOUND');
      if (w.status !== 'pending') throw new Error('ALREADY_PROCESSED');

      const now = new Date().toISOString();
      if (decision === 'approved') {
        db.prepare(
          'UPDATE profiles SET total_withdrawn = total_withdrawn + ?, updated_at = ? WHERE user_id = ?'
        ).run(w.gross_amount, now, w.user_id);

        db.prepare("UPDATE transactions SET status = 'completed' WHERE reference_id = ?").run(w.id);

        db.prepare(`
          INSERT INTO notifications (id, user_id, title, message, category, is_read, created_at)
          VALUES (?, ?, ?, ?, 'wallet', 0, ?)
        `).run(
          generateUniqueId('NTF'),
          w.user_id,
          'Withdrawal Approved',
          `Your withdrawal ${w.withdrawal_ref} (Net ₹${w.net_amount}) has been approved for payout.`,
          now
        );
      } else {
        const profile = db
          .prepare('SELECT available_balance FROM profiles WHERE user_id = ?')
          .get(w.user_id) as { available_balance: number };
        const before = roundMoney(profile.available_balance);
        const after = roundMoney(before + w.gross_amount);

        db.prepare('UPDATE profiles SET available_balance = ?, updated_at = ? WHERE user_id = ?').run(
          after,
          now,
          w.user_id
        );

        db.prepare("UPDATE transactions SET status = 'rejected' WHERE reference_id = ?").run(w.id);

        db.prepare(`
          INSERT INTO transactions (
            id, tx_ref, user_id, type, category, amount, balance_before, balance_after,
            description, reference_id, status, created_at
          ) VALUES (?, ?, ?, 'credit', 'withdrawal_refund', ?, ?, ?, ?, ?, 'completed', ?)
        `).run(
          generateUniqueId('TXN'),
          generateUniqueId('TX'),
          w.user_id,
          w.gross_amount,
          before,
          after,
          `Refund for declined withdrawal ${w.withdrawal_ref}`,
          w.id,
          now
        );

        db.prepare(`
          INSERT INTO notifications (id, user_id, title, message, category, is_read, created_at)
          VALUES (?, ?, ?, ?, 'wallet', 0, ?)
        `).run(
          generateUniqueId('NTF'),
          w.user_id,
          'Withdrawal Rejected & Refunded',
          `Your withdrawal ${w.withdrawal_ref} was declined and ₹${w.gross_amount} returned to your balance.`,
          now
        );
      }

      db.prepare(
        'UPDATE withdrawals SET status = ?, admin_note = ?, processed_by = ?, processed_at = ? WHERE id = ?'
      ).run(decision, adminNote || null, req.auth!.sub, now, w.id);

      writeAuditLog({
        actorType: 'admin',
        actorId: req.auth!.sub,
        action: decision === 'approved' ? 'WITHDRAWAL_APPROVED' : 'WITHDRAWAL_REJECTED',
        targetType: 'withdrawal',
        targetId: w.id,
        details: { grossAmount: w.gross_amount, note: adminNote },
        ipAddress: req.ip,
      });
    })();

    res.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN';
    if (code === 'NOT_FOUND') res.status(404).json({ error: 'Withdrawal not found.' });
    else if (code === 'ALREADY_PROCESSED') res.status(409).json({ error: 'Withdrawal already processed.' });
    else res.status(500).json({ error: 'Unable to process withdrawal.' });
  }
});

app.get('/api/admin/transactions', requireAdminAuth, (_req: AuthenticatedRequest, res: Response) => {
  const rows = db
    .prepare(`
      SELECT t.*, u.phone, p.username
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      JOIN profiles p ON p.user_id = t.user_id
      ORDER BY t.created_at DESC LIMIT 200
    `)
    .all();
  res.json({ transactions: rows });
});

app.get('/api/admin/referrals', requireAdminAuth, (_req: AuthenticatedRequest, res: Response) => {
  const settings = getSettingsMap();
  const commissions = db
    .prepare(`
      SELECT c.*, bu.phone as beneficiary_phone, su.phone as source_phone
      FROM commissions c
      JOIN users bu ON bu.id = c.beneficiary_user_id
      JOIN users su ON su.id = c.source_user_id
      ORDER BY c.created_at DESC LIMIT 100
    `)
    .all();
  const totalReferrals = (db.prepare('SELECT COUNT(*) as c FROM referrals').get() as { c: number }).c;
  const totalCommissionPaid = (
    db.prepare('SELECT COALESCE(SUM(commission_amount), 0) as s FROM commissions').get() as { s: number }
  ).s;

  res.json({
    rates: {
      lv1: Number(settings.commissionLv1 ?? 22),
      lv2: Number(settings.commissionLv2 ?? 2),
      lv3: Number(settings.commissionLv3 ?? 1),
    },
    totalReferrals,
    totalCommissionPaid: roundMoney(totalCommissionPaid),
    commissions,
  });
});

app.get('/api/admin/gift-codes', requireAdminAuth, (_req: AuthenticatedRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM gift_codes ORDER BY created_at DESC').all();
  res.json({ giftCodes: rows });
});

app.post('/api/admin/gift-codes', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const code = asCleanString(req.body?.code, 32).toUpperCase();
  const rewardAmount = asPositiveNumber(req.body?.rewardAmount);
  const maxUses = Math.max(1, Math.floor(Number(req.body?.maxUses || 100)));
  const requiresActivePlan = req.body?.requiresActivePlan === false ? 0 : 1;
  const daysValid = Math.max(1, Math.floor(Number(req.body?.daysValid || 30)));

  if (!code || rewardAmount === null) {
    res.status(400).json({ error: 'Gift code and positive reward amount are required.' });
    return;
  }

  const id = generateUniqueId('GFT');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString();

  try {
    db.prepare(`
      INSERT INTO gift_codes (id, code, reward_amount, max_uses, used_count, requires_active_plan, expires_at, status, created_at)
      VALUES (?, ?, ?, ?, 0, ?, ?, 'active', ?)
    `).run(id, code, rewardAmount, maxUses, requiresActivePlan, expiresAt, now);

    res.status(201).json({ ok: true, id });
  } catch {
    res.status(409).json({ error: 'Gift code already exists.' });
  }
});

app.delete('/api/admin/gift-codes/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const id = asCleanString(req.params.id, 64);
  db.prepare('DELETE FROM gift_codes WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.get('/api/admin/settings', requireAdminAuth, (_req: AuthenticatedRequest, res: Response) => {
  const settings = getSettingsMap();
  const banners = db.prepare('SELECT * FROM banners ORDER BY sort_order ASC').all();
  res.json({ settings, banners });
});

app.put('/api/admin/settings', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const updates = req.body?.settings as Record<string, unknown> | undefined;
  const allowedKeys = new Set([
    'siteName',
    'siteSubtitle',
    'primaryColor',
    'darkColor',
    'defaultLanguage',
    'minRecharge',
    'minWithdraw',
    'maxWithdraw',
    'withdrawFeePercent',
    'withdrawTimeWindow',
    'enforceWithdrawWindow',
    'commissionLv1',
    'commissionLv2',
    'commissionLv3',
    'telegramLink',
    'supportContact',
    'maintenanceMode',
    'popupEnabled',
    'popupTitle',
    'popupSubtitle',
    'termsText',
    'paymentMode',
    'upiMerchantId',
    'bankTransferName',
    'bankTransferAccount',
    'bankTransferIfsc',
  ]);

  if (updates && typeof updates === 'object') {
    const now = new Date().toISOString();
    const stmt = db.prepare(
      'INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    );
    for (const [k, v] of Object.entries(updates)) {
      if (allowedKeys.has(k) && v !== undefined && v !== null) {
        stmt.run(k, String(v).slice(0, 2000), now);
      }
    }
  }

  if (req.body?.banner && typeof req.body.banner === 'object') {
    const b = req.body.banner as Record<string, unknown>;
    if (b.id && b.title) {
      db.prepare('UPDATE banners SET title = ?, subtitle = ?, badge_text = ? WHERE id = ?').run(
        asCleanString(b.title, 120),
        asCleanString(b.subtitle, 160),
        asCleanString(b.badge_text, 60),
        asCleanString(b.id, 64)
      );
    }
  }

  writeAuditLog({
    actorType: 'admin',
    actorId: req.auth!.sub,
    action: 'ADMIN_SETTINGS_UPDATED',
    targetType: 'site_settings',
    ipAddress: req.ip,
  });

  res.json({ ok: true });
});

app.post('/api/admin/notifications', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
  const title = asCleanString(req.body?.title, 100);
  const message = asCleanString(req.body?.message, 400);
  if (!title || !message) {
    res.status(400).json({ error: 'Title and message are required.' });
    return;
  }
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, category, is_read, created_at)
    VALUES (?, NULL, ?, ?, 'announcement', 0, ?)
  `).run(generateUniqueId('NTF'), title, message, new Date().toISOString());

  res.status(201).json({ ok: true });
});

app.get('/api/admin/audit-logs', requireAdminAuth, (_req: AuthenticatedRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 150').all();
  res.json({ auditLogs: rows });
});

// ============================================================================
// SERVER BOOTSTRAP (DEV VITE MIDDLEWARE / PROD STATIC DIST)
// ============================================================================

async function startServer(): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT || 3000);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build artifacts not found. Run npm run build.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`MAHENDRA Investment Platform server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
