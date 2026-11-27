-- ============================================================================
-- MAHENDRA Investment Platform - Migration 003: Idempotent Seed Data
-- Uses ON CONFLICT DO NOTHING so production data is never overwritten or deleted.
-- ============================================================================

INSERT INTO public.admin_settings (key, value) VALUES
  ('siteName', 'MAHENDRA'),
  ('siteSubtitle', 'Finance & Investment Management Platform'),
  ('primaryColor', '#008C45'),
  ('darkColor', '#005B32'),
  ('defaultLanguage', 'ENG'),
  ('minRecharge', '800'),
  ('minWithdraw', '120'),
  ('maxWithdraw', '50000'),
  ('withdrawFeePercent', '10'),
  ('withdrawTimeWindow', '00:30 - 17:00'),
  ('enforceWithdrawWindow', 'false'),
  ('commissionLv1', '22'),
  ('commissionLv2', '2'),
  ('commissionLv3', '1'),
  ('telegramLink', 'https://t.me/mahendra_platform'),
  ('supportContact', '@CustomersHelpCare'),
  ('maintenanceMode', 'false'),
  ('popupEnabled', 'true'),
  ('popupTitle', 'Welcome to MAHENDRA'),
  ('popupSubtitle', 'Structured 90-day & 120-day portfolio tracking with server-verified ledger'),
  ('termsText', 'MAHENDRA investment plans feature structured 90-day and 120-day portfolio tracking cycles. Deposits and withdrawals are processed strictly after server-side verification and compliance checks.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.banners (id, title, subtitle, badge_text, image_key, target_action, is_active, sort_order) VALUES
  (
    'banner_main',
    'Invest • Grow • Prosper',
    'Safe & Secure · Structured Portfolio Plans',
    'MAHENDRA Official Platform',
    'studio_banner',
    'home',
    TRUE,
    1
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.investment_plans (
  name, code, subtitle, description, image_key,
  price, duration_days, daily_return, total_return,
  purchase_limit, is_popular, status, sort_order
) VALUES
  ('SILVER PLAN', 'MH-SILVER-01', 'Entry Tier · 90-Day Cycle', 'Entry portfolio tier designed for structured 90-day cycle tracking.', 'silver_shield', 800, 90, 200, 18000, 2, FALSE, 'active', 1),
  ('GOLD PLAN', 'MH-GOLD-02', 'Core Tier · 90-Day Cycle', 'Core gold-tier portfolio plan with 90-day duration tracking.', 'golden_medal', 1500, 90, 300, 27000, 2, TRUE, 'active', 2),
  ('PLATINUM PLAN', 'MH-PLATINUM-03', 'Growth Tier · 90-Day Cycle', 'Platinum portfolio plan with up to 3 active slots.', 'platinum_crown', 2200, 90, 500, 45000, 3, FALSE, 'active', 3),
  ('DIAMOND PLAN', 'MH-DIAMOND-04', 'Prime Tier · 90-Day Cycle', 'Diamond portfolio tier with 90-day cycle tracking.', 'diamond_crystal', 4000, 90, 1000, 90000, 3, FALSE, 'active', 4),
  ('BLUE DIAMOND', 'MH-BLUE-05', 'Sapphire Tier · 90-Day Cycle', 'Blue Diamond portfolio series allowing up to 4 active holdings.', 'blue_diamond', 6200, 90, 1500, 135000, 4, FALSE, 'active', 5),
  ('BLACK DIAMOND', 'MH-BLACK-06', 'Obsidian Tier · 90-Day Cycle', 'Black Diamond portfolio tier with 90-day tracking horizon.', 'black_diamond', 8500, 90, 3000, 270000, 4, FALSE, 'active', 6),
  ('ROYAL DIAMOND', 'MH-ROYAL-07', 'Royal Tier · 90-Day Cycle', 'Royal Diamond portfolio tier allowing up to 5 active slots.', 'royal_crown', 13000, 90, 4500, 405000, 5, FALSE, 'active', 7),
  ('SILVER VIP', 'MH-SVIP-08', 'Executive VIP · 120-Day Cycle', 'Silver VIP single-allocation 120-day executive portfolio.', 'silver_vip_shield', 18000, 120, 5000, 600000, 1, FALSE, 'active', 8),
  ('GOLD VIP', 'MH-GVIP-09', 'Prestige VIP · 120-Day Cycle', 'Gold VIP single-allocation 120-day prestige portfolio.', 'golden_vip_star', 25000, 120, 8000, 960000, 1, FALSE, 'active', 9),
  ('DIAMOND VIP', 'MH-DVIP-10', 'Flagship VIP · 120-Day Cycle', 'Flagship Diamond VIP single-allocation 120-day portfolio.', 'premium_diamond_crown', 40000, 120, 10000, 1200000, 1, TRUE, 'active', 10)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.gift_codes (code, reward_amount, max_uses, used_count, requires_active_plan, expires_at, status) VALUES
  ('MAHENDRA50', 50.00, 500, 0, TRUE, NOW() + INTERVAL '365 days', 'active')
ON CONFLICT (code) DO NOTHING;
