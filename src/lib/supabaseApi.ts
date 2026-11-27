import type {
  BannerItem,
  DepositRecord,
  MeResponse,
  NotificationRecord,
  OrderRecord,
  ProductItem,
  PublicConfigResponse,
  SiteSettings,
  TeamResponse,
  TransactionRecord,
  TreasureResponse,
  WithdrawalRecord,
} from '../types';
import { formatSupabaseError, requireSupabase } from './supabase';

const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'MAHENDRA',
  siteSubtitle: 'Finance & Investment Management Platform',
  primaryColor: '#008C45',
  darkColor: '#005B32',
  defaultLanguage: 'ENG',
  minRecharge: 800,
  minWithdraw: 120,
  maxWithdraw: 50000,
  withdrawFeePercent: 10,
  withdrawTimeWindow: '00:30 - 17:00',
  commissionLv1: 22,
  commissionLv2: 2,
  commissionLv3: 1,
  telegramLink: 'https://t.me/mahendra_platform',
  supportContact: '@CustomersHelpCare',
  maintenanceMode: false,
  popupEnabled: true,
  popupTitle: 'Welcome to MAHENDRA',
  popupSubtitle: 'Structured 90-day & 120-day portfolio tracking cycles',
  termsText:
    'MAHENDRA investment plans feature structured 90-day and 120-day portfolio tracking cycles. Deposits and withdrawals are processed strictly after server-side verification and compliance checks.',
  paymentGatewayPublic: {
    mode: 'telegram_verified',
    upiMerchantId: '',
    bankTransferName: '',
    bankTransferAccount: '',
    bankTransferIfsc: '',
    gatewayConfigured: false,
  },
};

function mapSettingsRows(rows: { key: string; value: string }[]): SiteSettings {
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return {
    siteName: map.siteName ?? DEFAULT_SETTINGS.siteName,
    siteSubtitle: map.siteSubtitle ?? DEFAULT_SETTINGS.siteSubtitle,
    primaryColor: map.primaryColor ?? DEFAULT_SETTINGS.primaryColor,
    darkColor: map.darkColor ?? DEFAULT_SETTINGS.darkColor,
    defaultLanguage: map.defaultLanguage ?? DEFAULT_SETTINGS.defaultLanguage,
    minRecharge: Number(map.minRecharge ?? DEFAULT_SETTINGS.minRecharge),
    minWithdraw: Number(map.minWithdraw ?? DEFAULT_SETTINGS.minWithdraw),
    maxWithdraw: Number(map.maxWithdraw ?? DEFAULT_SETTINGS.maxWithdraw),
    withdrawFeePercent: Number(map.withdrawFeePercent ?? DEFAULT_SETTINGS.withdrawFeePercent),
    withdrawTimeWindow: map.withdrawTimeWindow ?? DEFAULT_SETTINGS.withdrawTimeWindow,
    commissionLv1: Number(map.commissionLv1 ?? DEFAULT_SETTINGS.commissionLv1),
    commissionLv2: Number(map.commissionLv2 ?? DEFAULT_SETTINGS.commissionLv2),
    commissionLv3: Number(map.commissionLv3 ?? DEFAULT_SETTINGS.commissionLv3),
    telegramLink: map.telegramLink ?? DEFAULT_SETTINGS.telegramLink,
    supportContact: map.supportContact ?? DEFAULT_SETTINGS.supportContact,
    maintenanceMode: map.maintenanceMode === 'true',
    popupEnabled: map.popupEnabled !== 'false',
    popupTitle: map.popupTitle ?? DEFAULT_SETTINGS.popupTitle,
    popupSubtitle: map.popupSubtitle ?? DEFAULT_SETTINGS.popupSubtitle,
    termsText: map.termsText ?? DEFAULT_SETTINGS.termsText,
    paymentGatewayPublic: DEFAULT_SETTINGS.paymentGatewayPublic,
  };
}

export async function fetchPublicConfig(): Promise<PublicConfigResponse> {
  const sb = requireSupabase();

  const [settingsRes, bannersRes, plansRes] = await Promise.all([
    sb.from('admin_settings').select('key, value'),
    sb
      .from('banners')
      .select('id, title, subtitle, badge_text, image_key, target_action, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    sb
      .from('investment_plans')
      .select(
        'id, name, code, subtitle, description, image_key, price, duration_days, daily_return, total_return, purchase_limit, is_popular, status, sort_order'
      )
      .neq('status', 'inactive')
      .order('sort_order', { ascending: true })
      .order('price', { ascending: true }),
  ]);

  if (settingsRes.error) throw settingsRes.error;
  if (bannersRes.error) throw bannersRes.error;
  if (plansRes.error) throw plansRes.error;

  const products: ProductItem[] = (plansRes.data ?? []).map((p) => ({
    id: String(p.id),
    name: String(p.name),
    code: String(p.code),
    subtitle: String(p.subtitle),
    description: String(p.description),
    image_key: String(p.image_key),
    price: Number(p.price),
    duration_days: Number(p.duration_days),
    daily_return: Number(p.daily_return),
    total_return: Number(p.total_return),
    purchase_limit: Number(p.purchase_limit),
    is_popular: p.is_popular ? 1 : 0,
    status: p.status as 'active' | 'presale' | 'inactive',
    sort_order: Number(p.sort_order),
  }));

  const banners: BannerItem[] = (bannersRes.data ?? []).map((b) => ({
    id: String(b.id),
    title: String(b.title),
    subtitle: String(b.subtitle),
    badge_text: String(b.badge_text),
    image_key: String(b.image_key),
    target_action: String(b.target_action),
    sort_order: Number(b.sort_order),
  }));

  return {
    settings: mapSettingsRows((settingsRes.data ?? []) as { key: string; value: string }[]),
    banners,
    products,
  };
}

export async function fetchMyAccountSnapshot(): Promise<MeResponse> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('get_my_account_snapshot');
  if (error) throw new Error(formatSupabaseError(error, 'Unable to load account profile.'));
  return data as MeResponse;
}

export async function signUpWithSupabase(params: {
  email: string;
  countryCode: string;
  phone: string;
  password: string;
  withdrawalPassword: string;
  invitationCode?: string;
}): Promise<{ needsEmailConfirmation: boolean; hasSession: boolean }> {
  const sb = requireSupabase();
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanPhone = params.phone.replace(/\D/g, '');
  const cleanInvite = (params.invitationCode || '').trim().toUpperCase();

  const { data, error } = await sb.auth.signUp({
    email: cleanEmail,
    password: params.password,
    options: {
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      data: {
        country_code: params.countryCode,
        phone: cleanPhone,
        invitation_code: cleanInvite,
        username: cleanPhone.length >= 4 ? `Member${cleanPhone.slice(-4)}` : cleanEmail.split('@')[0],
      },
    },
  });

  if (error) throw new Error(formatSupabaseError(error, 'Registration failed.'));

  if (data.session) {
    const { error: onboardErr } = await sb.rpc('complete_user_onboarding', {
      p_country_code: params.countryCode,
      p_phone: cleanPhone,
      p_withdrawal_password: params.withdrawalPassword,
      p_invitation_code: cleanInvite || null,
      p_username: null,
    });
    if (onboardErr) {
      throw new Error(formatSupabaseError(onboardErr, 'Profile setup failed.'));
    }
    return { needsEmailConfirmation: false, hasSession: true };
  }

  return { needsEmailConfirmation: true, hasSession: false };
}

export async function signInWithSupabase(email: string, password: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw new Error(formatSupabaseError(error, 'Sign in failed.'));
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
  });
  if (error) throw new Error(formatSupabaseError(error, 'Unable to send reset email.'));
}

export async function updateSupabasePassword(newPassword: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw new Error(formatSupabaseError(error, 'Unable to update password.'));
}

export async function signOutFromSupabase(): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.auth.signOut();
  if (error) throw new Error(formatSupabaseError(error, 'Sign out failed.'));
}

export async function completeUserOnboarding(params: {
  countryCode?: string;
  phone?: string;
  withdrawalPassword?: string;
  invitationCode?: string;
  username?: string;
}): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('complete_user_onboarding', {
    p_country_code: params.countryCode ?? '+91',
    p_phone: params.phone ?? null,
    p_withdrawal_password: params.withdrawalPassword ?? null,
    p_invitation_code: params.invitationCode ?? null,
    p_username: params.username ?? null,
  });
  if (error) throw new Error(formatSupabaseError(error, 'Unable to update account setup.'));
}

// ============================================================================
// INVESTMENTS & DAILY RETURNS
// ============================================================================

export async function createInvestmentOrder(params: {
  planId: string;
  idempotencyKey: string;
  acceptedDisclosure: boolean;
}): Promise<{ orderId: string; orderNumber: string; balanceAfter?: number }> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('create_investment', {
    p_plan_id: params.planId,
    p_idempotency_key: params.idempotencyKey,
    p_accepted_disclosure: params.acceptedDisclosure,
  });
  if (error) throw new Error(formatSupabaseError(error, 'Unable to activate investment plan.'));
  return data as { orderId: string; orderNumber: string; balanceAfter?: number };
}

export async function fetchMyOrders(
  statusFilter: 'all' | 'active' | 'completed' | 'cancelled'
): Promise<OrderRecord[]> {
  const sb = requireSupabase();
  let query = sb.from('investments').select('*').order('created_at', { ascending: false });
  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }
  const { data, error } = await query;
  if (error) throw new Error(formatSupabaseError(error, 'Unable to load investments.'));
  return (data ?? []).map((row) => ({
    id: String(row.id),
    order_number: String(row.order_number),
    product_id: String(row.plan_id),
    product_name: String(row.plan_name),
    amount: Number(row.amount),
    daily_return: Number(row.daily_return),
    total_projected_return: Number(row.total_projected_return),
    duration_days: Number(row.duration_days),
    days_completed: Number(row.days_completed),
    earned_so_far: Number(row.earned_so_far),
    status: row.status as 'active' | 'completed' | 'cancelled',
    created_at: String(row.created_at),
    matures_at: String(row.matures_at),
    last_yield_at: String(row.last_yield_at),
  }));
}

export async function claimDailyReturn(
  investmentId: string
): Promise<{ credited: number; daysSettled: number; balanceAfter: number }> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('claim_daily_return', { p_investment_id: investmentId });
  if (error) throw new Error(formatSupabaseError(error, 'No yield due yet.'));
  return data as { credited: number; daysSettled: number; balanceAfter: number };
}

// ============================================================================
// DEPOSITS, WITHDRAWALS, BANK ACCOUNTS & TRANSACTIONS
// ============================================================================

export async function fetchMyDeposits(): Promise<DepositRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('deposits')
    .select('id, deposit_ref, amount, payment_method, utr_reference, status, admin_note, created_at, verified_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(formatSupabaseError(error, 'Unable to load deposit history.'));
  return (data ?? []) as DepositRecord[];
}

export async function submitDepositRequest(params: {
  amount: number;
  paymentMethod: 'upi' | 'bank' | 'gateway';
  utrReference: string;
  idempotencyKey: string;
}): Promise<{ deposit: DepositRecord; message: string; deduplicated?: boolean }> {
  if (params.paymentMethod === 'gateway') {
    throw new Error(
      'Automated payment gateway is temporarily disabled. Please contact official Telegram support and submit your UTR reference.'
    );
  }
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('submit_deposit_request', {
    p_amount: params.amount,
    p_payment_method: params.paymentMethod,
    p_utr_reference: params.utrReference,
    p_idempotency_key: params.idempotencyKey,
  });
  if (error) throw new Error(formatSupabaseError(error, 'Unable to submit deposit request.'));
  return data as { deposit: DepositRecord; message: string; deduplicated?: boolean };
}

export async function fetchMyWithdrawals(): Promise<WithdrawalRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('withdrawals')
    .select(
      'id, withdrawal_ref, bank_snapshot_json, gross_amount, fee_percent, fee_amount, net_amount, status, admin_note, created_at, processed_at'
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(formatSupabaseError(error, 'Unable to load withdrawal history.'));
  return (data ?? []) as WithdrawalRecord[];
}

export async function submitWithdrawalRequest(params: {
  amount: number;
  bankAccountId: string;
  withdrawalPassword: string;
  idempotencyKey: string;
}): Promise<{ withdrawalId: string; withdrawalRef: string; netAmount: number }> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('submit_withdrawal_request', {
    p_amount: params.amount,
    p_bank_account_id: params.bankAccountId,
    p_withdrawal_password: params.withdrawalPassword,
    p_idempotency_key: params.idempotencyKey,
  });
  if (error) throw new Error(formatSupabaseError(error, 'Unable to submit withdrawal request.'));
  return data as { withdrawalId: string; withdrawalRef: string; netAmount: number };
}

export async function addBankAccount(params: {
  userId: string;
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId?: string;
}): Promise<void> {
  const sb = requireSupabase();
  const { error: resetErr } = await sb
    .from('bank_accounts')
    .update({ is_default: false })
    .eq('user_id', params.userId);
  if (resetErr) throw new Error(formatSupabaseError(resetErr, 'Unable to update default bank card.'));
  const { error } = await sb.from('bank_accounts').insert({
    user_id: params.userId,
    account_holder: params.accountHolder.trim(),
    bank_name: params.bankName.trim(),
    account_number: params.accountNumber.replace(/\s+/g, ''),
    ifsc_code: params.ifscCode.trim().toUpperCase(),
    upi_id: params.upiId?.trim() || null,
    is_default: true,
  });
  if (error) throw new Error(formatSupabaseError(error, 'Unable to save bank card.'));
}

export async function deleteBankAccount(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('bank_accounts').delete().eq('id', id);
  if (error) throw new Error(formatSupabaseError(error, 'Unable to remove bank card.'));
}

export async function fetchMyTransactions(type: 'all' | 'credit' | 'debit'): Promise<TransactionRecord[]> {
  const sb = requireSupabase();
  let query = sb
    .from('transactions')
    .select('id, tx_ref, type, category, amount, balance_before, balance_after, description, reference_id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (type === 'credit' || type === 'debit') {
    query = query.eq('type', type);
  }
  const { data, error } = await query;
  if (error) throw new Error(formatSupabaseError(error, 'Unable to load transactions.'));
  return (data ?? []) as TransactionRecord[];
}

// ============================================================================
// PROFILE, TEAM, TREASURE BOX & NOTIFICATIONS
// ============================================================================

export async function updateMyProfileName(userId: string, username: string): Promise<void> {
  const sb = requireSupabase();
  const clean = username.trim();
  if (clean.length < 2) throw new Error('Username must be at least 2 characters.');
  const { error } = await sb.from('profiles').update({ username: clean }).eq('id', userId);
  if (error) throw new Error(formatSupabaseError(error, 'Unable to update profile.'));
}

export async function changeUserPassword(params: {
  email: string;
  kind: 'login' | 'withdrawal';
  currentPassword: string;
  newPassword: string;
}): Promise<string> {
  const sb = requireSupabase();
  if (params.kind === 'withdrawal') {
    const { data, error } = await sb.rpc('update_withdrawal_password', {
      p_current_password: params.currentPassword,
      p_new_password: params.newPassword,
    });
    if (error) throw new Error(formatSupabaseError(error, 'Unable to update withdrawal password.'));
    return (data as { message?: string })?.message ?? 'Withdrawal password updated.';
  }

  if (params.newPassword.length < 6) {
    throw new Error('New login password must be at least 6 characters.');
  }
  // Verify current password first via Supabase Auth
  const { error: verifyErr } = await sb.auth.signInWithPassword({
    email: params.email,
    password: params.currentPassword,
  });
  if (verifyErr) throw new Error('Current login password is incorrect.');

  const { error: updateErr } = await sb.auth.updateUser({ password: params.newPassword });
  if (updateErr) throw new Error(formatSupabaseError(updateErr, 'Unable to update login password.'));
  return 'Login password updated successfully.';
}

export async function fetchMyTeam(): Promise<TeamResponse> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('get_my_team');
  if (error) throw new Error(formatSupabaseError(error, 'Unable to load team details.'));
  return data as TeamResponse;
}

export async function fetchMyTreasureState(): Promise<TreasureResponse> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('get_my_treasure_state');
  if (error) throw new Error(formatSupabaseError(error, 'Unable to load Treasure Box.'));
  return data as TreasureResponse;
}

export async function redeemGiftCode(
  code: string
): Promise<{ amount: number; balanceAfter: number; code: string }> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('redeem_gift_code', { p_code: code });
  if (error) throw new Error(formatSupabaseError(error, 'Unable to redeem code.'));
  return data as { amount: number; balanceAfter: number; code: string };
}

export async function fetchMyNotifications(): Promise<NotificationRecord[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('notifications')
    .select('id, user_id, title, message, category, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(formatSupabaseError(error, 'Unable to load notifications.'));
  return (data ?? []).map((n) => ({
    id: String(n.id),
    user_id: n.user_id ? String(n.user_id) : null,
    title: String(n.title),
    message: String(n.message),
    category: String(n.category),
    is_read: n.is_read ? 1 : 0,
    created_at: String(n.created_at),
  }));
}

export async function markNotificationsRead(): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('mark_notifications_read');
  if (error) throw new Error(formatSupabaseError(error));
}

// ============================================================================
// ADMIN API (Server-verified via public.admin_users & is_admin())
// ============================================================================

export async function checkCurrentUserAdmin(): Promise<{
  isAdmin: boolean;
  hasAnyAdmin: boolean;
  userId: string | null;
}> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('is_current_user_admin');
  if (error) throw new Error(formatSupabaseError(error, 'Unable to verify admin status.'));
  return data as { isAdmin: boolean; hasAnyAdmin: boolean; userId: string | null };
}

export async function adminGetOverview(): Promise<Record<string, number>> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_get_overview');
  if (error) throw new Error(formatSupabaseError(error));
  return data as Record<string, number>;
}

export async function adminListUsers(query = ''): Promise<Record<string, unknown>[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_list_users', { p_query: query });
  if (error) throw new Error(formatSupabaseError(error));
  return ((data as { users?: Record<string, unknown>[] })?.users) ?? [];
}

export async function adminUpdateUserStatus(userId: string, status: 'active' | 'suspended'): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('admin_update_user_status', {
    p_user_id: userId,
    p_status: status,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function adminGetUserActivity(userId: string): Promise<{
  orders: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
}> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_get_user_activity', { p_user_id: userId });
  if (error) throw new Error(formatSupabaseError(error));
  return data as { orders: Record<string, unknown>[]; transactions: Record<string, unknown>[] };
}

export async function adminListProducts(): Promise<ProductItem[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('investment_plans')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('price', { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map((p) => ({
    id: String(p.id),
    name: String(p.name),
    code: String(p.code),
    subtitle: String(p.subtitle),
    description: String(p.description),
    image_key: String(p.image_key),
    price: Number(p.price),
    duration_days: Number(p.duration_days),
    daily_return: Number(p.daily_return),
    total_return: Number(p.total_return),
    purchase_limit: Number(p.purchase_limit),
    is_popular: p.is_popular ? 1 : 0,
    status: p.status as 'active' | 'presale' | 'inactive',
    sort_order: Number(p.sort_order),
  }));
}

export async function adminUpsertProduct(payload: {
  id?: string;
  name: string;
  code?: string;
  subtitle?: string;
  description?: string;
  imageKey?: string;
  price: number;
  durationDays: number;
  dailyReturn: number;
  totalReturn: number;
  purchaseLimit: number;
  isPopular: boolean;
  status: string;
}): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('admin_upsert_plan', {
    p_id: payload.id ?? null,
    p_name: payload.name,
    p_code: payload.code ?? null,
    p_subtitle: payload.subtitle ?? null,
    p_description: payload.description ?? null,
    p_image_key: payload.imageKey ?? 'silver_shield',
    p_price: payload.price,
    p_duration_days: payload.durationDays,
    p_daily_return: payload.dailyReturn,
    p_total_return: payload.totalReturn,
    p_purchase_limit: payload.purchaseLimit,
    p_is_popular: payload.isPopular,
    p_status: payload.status,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function adminDeleteProduct(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('admin_delete_plan', { p_plan_id: id });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function adminListDeposits(): Promise<Record<string, unknown>[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_list_deposits');
  if (error) throw new Error(formatSupabaseError(error));
  return ((data as { deposits?: Record<string, unknown>[] })?.deposits) ?? [];
}

export async function adminVerifyDeposit(
  depositId: string,
  decision: 'approved' | 'rejected',
  note = ''
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('admin_verify_deposit', {
    p_deposit_id: depositId,
    p_decision: decision,
    p_note: note,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function adminListWithdrawals(): Promise<Record<string, unknown>[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_list_withdrawals');
  if (error) throw new Error(formatSupabaseError(error));
  return ((data as { withdrawals?: Record<string, unknown>[] })?.withdrawals) ?? [];
}

export async function adminProcessWithdrawal(
  withdrawalId: string,
  decision: 'approved' | 'rejected',
  note = ''
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('admin_process_withdrawal', {
    p_withdrawal_id: withdrawalId,
    p_decision: decision,
    p_note: note,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function adminListTransactions(): Promise<Record<string, unknown>[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_list_transactions');
  if (error) throw new Error(formatSupabaseError(error));
  return ((data as { transactions?: Record<string, unknown>[] })?.transactions) ?? [];
}

export async function adminGetReferrals(): Promise<{
  rates: { lv1: number; lv2: number; lv3: number };
  totalReferrals: number;
  totalCommissionPaid: number;
  commissions: Record<string, unknown>[];
}> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('admin_get_referrals');
  if (error) throw new Error(formatSupabaseError(error));
  return data as {
    rates: { lv1: number; lv2: number; lv3: number };
    totalReferrals: number;
    totalCommissionPaid: number;
    commissions: Record<string, unknown>[];
  };
}

export async function adminListGiftCodes(): Promise<Record<string, unknown>[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('gift_codes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []) as Record<string, unknown>[];
}

export async function adminCreateGiftCode(payload: {
  code: string;
  rewardAmount: number;
  maxUses: number;
  requiresActivePlan: boolean;
}): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('admin_create_gift_code', {
    p_code: payload.code,
    p_reward_amount: payload.rewardAmount,
    p_max_uses: payload.maxUses,
    p_requires_active_plan: payload.requiresActivePlan,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function adminDeleteGiftCode(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('admin_delete_gift_code', { p_gift_id: id });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function adminGetSettings(): Promise<{
  settings: Record<string, string>;
  banners: BannerItem[];
}> {
  const sb = requireSupabase();
  const [sRes, bRes] = await Promise.all([
    sb.from('admin_settings').select('key, value'),
    sb.from('banners').select('*').order('sort_order', { ascending: true }),
  ]);
  if (sRes.error) throw new Error(formatSupabaseError(sRes.error));
  if (bRes.error) throw new Error(formatSupabaseError(bRes.error));

  const map: Record<string, string> = {};
  for (const r of sRes.data ?? []) {
    map[String(r.key)] = String(r.value);
  }
  return {
    settings: map,
    banners: (bRes.data ?? []) as BannerItem[],
  };
}

export async function adminUpdateSettings(
  settings: Record<string, string>,
  banner: BannerItem | null
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('admin_update_settings', {
    p_settings: settings,
    p_banner: banner,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function adminBroadcastNotification(title: string, message: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc('admin_broadcast_notification', {
    p_title: title,
    p_message: message,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function adminListAuditLogs(): Promise<Record<string, unknown>[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(150);
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []) as Record<string, unknown>[];
}
