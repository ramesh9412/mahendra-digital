export type MainTab =
  | 'home'
  | 'invite'
  | 'treasure'
  | 'team'
  | 'profile'
  | 'recharge'
  | 'withdraw'
  | 'orders'
  | 'bank-cards'
  | 'personal-info'
  | 'balance-details'
  | 'withdrawal-details'
  | 'notifications'
  | 'about'
  | 'admin';

export interface SiteSettings {
  siteName: string;
  siteSubtitle: string;
  primaryColor: string;
  darkColor: string;
  defaultLanguage: string;
  minRecharge: number;
  minWithdraw: number;
  maxWithdraw: number;
  withdrawFeePercent: number;
  withdrawTimeWindow: string;
  commissionLv1: number;
  commissionLv2: number;
  commissionLv3: number;
  telegramLink: string;
  supportContact: string;
  maintenanceMode: boolean;
  popupEnabled: boolean;
  popupTitle: string;
  popupSubtitle: string;
  termsText: string;
  paymentGatewayPublic: {
    mode: string;
    upiMerchantId: string;
    bankTransferName: string;
    bankTransferAccount: string;
    bankTransferIfsc: string;
    gatewayConfigured: boolean;
  };
}

export interface BannerItem {
  id: string;
  title: string;
  subtitle: string;
  badge_text: string;
  image_key: string;
  target_action: string;
  sort_order: number;
}

export interface ProductItem {
  id: string;
  name: string;
  code: string;
  subtitle: string;
  description: string;
  image_key: string;
  price: number;
  duration_days: number;
  daily_return: number;
  total_return: number;
  purchase_limit: number;
  is_popular: number;
  status: 'active' | 'presale' | 'inactive';
  sort_order: number;
}

export interface PublicConfigResponse {
  settings: SiteSettings;
  banners: BannerItem[];
  products: ProductItem[];
}

export interface BankAccount {
  id: string;
  account_holder: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  upi_id: string | null;
  is_default: number;
  created_at: string;
}

export interface MeResponse {
  user: {
    id: string;
    countryCode: string;
    maskedPhone: string;
    phoneLast4: string;
    status: string;
    referralCode: string;
    createdAt: string;
  };
  profile: {
    username: string;
    vipLevel: number;
    availableBalance: number;
    totalRecharge: number;
    totalIncome: number;
    totalWithdrawn: number;
    totalWon: number;
    language: string;
    avatarStyle: string;
  };
  activeOrdersCount: number;
  hasActivePlan: boolean;
  unreadNotificationsCount: number;
  productPurchaseCounts: Record<string, number>;
  bankAccounts: BankAccount[];
}

export interface OrderRecord {
  id: string;
  order_number: string;
  product_id: string;
  product_name: string;
  amount: number;
  daily_return: number;
  total_projected_return: number;
  duration_days: number;
  days_completed: number;
  earned_so_far: number;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  matures_at: string;
  last_yield_at: string;
}

export interface TransactionRecord {
  id: string;
  tx_ref: string;
  type: 'credit' | 'debit';
  category: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  reference_id: string | null;
  status: string;
  created_at: string;
}

export interface DepositRecord {
  id: string;
  deposit_ref: string;
  amount: number;
  payment_method: string;
  utr_reference: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  verified_at: string | null;
}

export interface WithdrawalRecord {
  id: string;
  withdrawal_ref: string;
  bank_snapshot_json: string;
  gross_amount: number;
  fee_percent: number;
  fee_amount: number;
  net_amount: number;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface TeamLevelInfo {
  level: number;
  ratePercent: number;
  membersCount: number;
  activeCount: number;
  rechargeVolume: number;
  commissionEarned: number;
  members: {
    id: string;
    username: string;
    maskedPhone: string;
    isActive: boolean;
    joinedAt: string;
  }[];
}

export interface TeamResponse {
  totalMembers: number;
  activeMembers: number;
  totalTeamRecharge: number;
  totalCommissionCredited: number;
  levels: TeamLevelInfo[];
}

export interface TreasureResponse {
  isUnlocked: boolean;
  totalWon: number;
  balance: number;
  codesUsed: number;
  rewards: {
    id: string;
    code: string;
    amount: number;
    created_at: string;
  }[];
}

export interface NotificationRecord {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  category: string;
  is_read: number;
  created_at: string;
}
