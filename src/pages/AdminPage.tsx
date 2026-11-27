import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  Gift,
  LayoutDashboard,
  LogOut,
  Package,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { apiRequest, formatDateTime, formatINR } from '../lib/api';
import type { ProductItem } from '../types';

interface AdminPageProps {
  onExit: () => void;
  onConfigUpdated: () => Promise<void>;
}

type AdminSection =
  | 'overview'
  | 'users'
  | 'products'
  | 'financials'
  | 'referrals'
  | 'settings'
  | 'audit';

export const AdminPage: React.FC<AdminPageProps> = ({ onExit, onConfigUpdated }) => {
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);
  const [statusLoading, setStatusLoading] = useState(true);

  const [username, setUsername] = useState('mahendra94');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [section, setSection] = useState<AdminSection>('overview');
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserActivity, setSelectedUserActivity] = useState<{
    username: string;
    orders: Record<string, unknown>[];
    transactions: Record<string, unknown>[];
  } | null>(null);

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [editingProduct, setEditingProduct] = useState<Partial<ProductItem> | null>(null);

  const [deposits, setDeposits] = useState<Record<string, unknown>[]>([]);
  const [withdrawals, setWithdrawals] = useState<Record<string, unknown>[]>([]);
  const [transactions, setTransactions] = useState<Record<string, unknown>[]>([]);

  const [referralData, setReferralData] = useState<{
    rates: { lv1: number; lv2: number; lv3: number };
    totalReferrals: number;
    totalCommissionPaid: number;
    commissions: Record<string, unknown>[];
  } | null>(null);
  const [giftCodes, setGiftCodes] = useState<Record<string, unknown>[]>([]);
  const [newGiftCode, setNewGiftCode] = useState({
    code: '',
    rewardAmount: '50',
    maxUses: '100',
    requiresActivePlan: true,
  });

  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});
  const [bannerForm, setBannerForm] = useState<{
    id: string;
    title: string;
    subtitle: string;
    badge_text: string;
  } | null>(null);
  const [announcement, setAnnouncement] = useState({ title: '', message: '' });
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ needsSetup: boolean }>('/api/admin/status')
      .then((res) => setNeedsSetup(res.needsSetup))
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  }, []);

  const loadSectionData = async (tok: string, sec: AdminSection) => {
    try {
      if (sec === 'overview') {
        const res = await apiRequest<Record<string, number>>('/api/admin/overview', { token: tok });
        setOverview(res);
      } else if (sec === 'users') {
        const res = await apiRequest<{ users: Record<string, unknown>[] }>(
          `/api/admin/users?q=${encodeURIComponent(userSearch)}`,
          { token: tok }
        );
        setUsers(res.users);
      } else if (sec === 'products') {
        const res = await apiRequest<{ products: ProductItem[] }>('/api/admin/products', {
          token: tok,
        });
        setProducts(res.products);
      } else if (sec === 'financials') {
        const [d, w, t] = await Promise.all([
          apiRequest<{ deposits: Record<string, unknown>[] }>('/api/admin/deposits', { token: tok }),
          apiRequest<{ withdrawals: Record<string, unknown>[] }>('/api/admin/withdrawals', {
            token: tok,
          }),
          apiRequest<{ transactions: Record<string, unknown>[] }>('/api/admin/transactions', {
            token: tok,
          }),
        ]);
        setDeposits(d.deposits);
        setWithdrawals(w.withdrawals);
        setTransactions(t.transactions);
      } else if (sec === 'referrals') {
        const [r, g] = await Promise.all([
          apiRequest<NonNullable<typeof referralData>>('/api/admin/referrals', { token: tok }),
          apiRequest<{ giftCodes: Record<string, unknown>[] }>('/api/admin/gift-codes', {
            token: tok,
          }),
        ]);
        setReferralData(r);
        setGiftCodes(g.giftCodes);
      } else if (sec === 'settings') {
        const res = await apiRequest<{
          settings: Record<string, string>;
          banners: { id: string; title: string; subtitle: string; badge_text: string }[];
        }>('/api/admin/settings', { token: tok });
        setSettingsForm(res.settings);
        if (res.banners[0]) setBannerForm(res.banners[0]);
      } else if (sec === 'audit') {
        const res = await apiRequest<{ auditLogs: Record<string, unknown>[] }>(
          '/api/admin/audit-logs',
          { token: tok }
        );
        setAuditLogs(res.auditLogs);
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to load section data.');
    }
  };

  useEffect(() => {
    if (adminToken) {
      loadSectionData(adminToken, section);
    }
  }, [adminToken, section]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const endpoint = needsSetup ? '/api/admin/bootstrap' : '/api/admin/login';
      const res = await apiRequest<{ token: string }>(endpoint, {
        method: 'POST',
        body: { username, password },
      });
      setAdminToken(res.token);
      setNeedsSetup(false);
      setPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Admin authentication failed.');
    }
  };

  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center mahendra-page-bg text-sm text-[#FFE89C]">
        Loading Admin Console...
      </div>
    );
  }

  if (!adminToken) {
    return (
      <div className="min-h-screen mahendra-page-bg flex items-center justify-center p-4">
        <div className="bg-white rounded-[26px] card-mint-border max-w-md w-full p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl brand-gradient text-white flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display font-extrabold text-lg text-[#17231C]">
                  {needsSetup ? 'Initialize Admin Account' : 'Admin Console Sign In'}
                </h1>
                <p className="text-xs text-[#6B8275]">
                  {needsSetup
                    ? 'First-run setup: claim the administrator credentials'
                    : 'Server-verified role-based access control'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onExit}
              className="p-2 rounded-full hover:bg-[#F4FAF7] text-[#5B7265] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#17231C] mb-1">Admin Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#17231C] mb-1">
                {needsSetup ? 'Create Admin Password (8+ chars)' : 'Admin Password'}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full h-11 rounded-full brand-gradient text-white font-display font-bold text-sm cursor-pointer"
            >
              {needsSetup ? 'Create Admin Account & Enter' : 'Sign In to Admin'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const navItems: { id: AdminSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'financials', label: 'Financials', icon: Wallet },
    { id: 'referrals', label: 'Referrals & Gifts', icon: Gift },
    { id: 'settings', label: 'Content & Settings', icon: Settings },
    { id: 'audit', label: 'Audit Logs', icon: Activity },
  ];

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    const isNew = !editingProduct.id;
    const url = isNew ? '/api/admin/products' : `/api/admin/products/${editingProduct.id}`;
    await apiRequest(url, {
      method: isNew ? 'POST' : 'PUT',
      token: adminToken,
      body: {
        name: editingProduct.name,
        code: editingProduct.code,
        subtitle: editingProduct.subtitle,
        description: editingProduct.description,
        imageKey: editingProduct.image_key,
        price: Number(editingProduct.price),
        durationDays: Number(editingProduct.duration_days),
        dailyReturn: Number(editingProduct.daily_return),
        totalReturn: Number(editingProduct.total_return),
        purchaseLimit: Number(editingProduct.purchase_limit),
        isPopular: Boolean(editingProduct.is_popular),
        status: editingProduct.status,
      },
    });
    setEditingProduct(null);
    setFeedback('Product saved.');
    await Promise.all([loadSectionData(adminToken, 'products'), onConfigUpdated()]);
  };

  return (
    <div className="min-h-screen mahendra-page-bg">
      {/* Top Bar */}
      <header className="brand-header-gradient text-white px-4 sm:px-6 h-15 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-display font-bold text-base sm:text-lg">
            MAHENDRA · Admin Console
          </span>
        </div>

        <button
          type="button"
          onClick={() => setAdminToken(null)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs font-bold cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </header>

      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Navigation Tabs */}
        <aside className="lg:col-span-3">
          <div className="bg-white rounded-[22px] card-mint-border p-2 flex lg:flex-col gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSection(item.id);
                    setFeedback(null);
                  }}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                    active
                      ? 'brand-gradient text-white shadow-sm'
                      : 'text-[#4C6356] hover:bg-[#F4FAF7]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Panel */}
        <main className="lg:col-span-9 space-y-4">
          {feedback && (
            <div className="p-3 rounded-2xl bg-[#E7F7EE] border border-[#9CD9B8] text-xs font-semibold text-[#005B32] flex justify-between items-center">
              <span>{feedback}</span>
              <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {section === 'overview' && overview && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Users', val: overview.totalUsers },
                { label: 'Active Users', val: overview.activeUsers },
                { label: 'Approved Deposits', val: formatINR(overview.totalDeposits) },
                { label: 'Pending Deposits', val: overview.pendingDeposits },
                { label: 'Approved Withdrawals', val: formatINR(overview.totalWithdrawals) },
                { label: 'Pending Withdrawals', val: overview.pendingWithdrawals },
                { label: 'Order Volume', val: formatINR(overview.totalOrderVolume) },
                { label: 'Ledger Transactions', val: overview.totalTransactions },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-2xl card-mint-border p-4">
                  <div className="text-xs text-[#6B8275] font-medium">{kpi.label}</div>
                  <div className="mt-1 font-display font-extrabold text-xl text-[#17231C] tabular-nums">
                    {kpi.val}
                  </div>
                </div>
              ))}
            </div>
          )}

          {section === 'users' && (
            <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 h-10 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0]">
                  <Search className="w-4 h-4 text-[#008C45]" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search phone, username, invite code..."
                    className="w-full bg-transparent text-xs focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => loadSectionData(adminToken, 'users')}
                  className="px-4 h-10 rounded-xl brand-gradient text-white text-xs font-bold cursor-pointer"
                >
                  Search
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[#6B8275] border-b border-[#EDF7F1]">
                    <tr>
                      <th className="py-2 pr-3">User</th>
                      <th className="py-2 pr-3">Phone</th>
                      <th className="py-2 pr-3">Balance</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDF7F1]">
                    {users.map((u) => (
                      <tr key={String(u.id)}>
                        <td className="py-2.5 pr-3 font-bold text-[#17231C]">
                          {String(u.username)} ({String(u.referral_code)})
                        </td>
                        <td className="py-2.5 pr-3 font-mono-num">
                          {String(u.country_code)} {String(u.phone)}
                        </td>
                        <td className="py-2.5 pr-3 font-bold tabular-nums text-[#008C45]">
                          {formatINR(Number(u.available_balance))}
                        </td>
                        <td className="py-2.5 pr-3 uppercase font-bold">
                          {String(u.status)}
                        </td>
                        <td className="py-2.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await apiRequest<{
                                orders: Record<string, unknown>[];
                                transactions: Record<string, unknown>[];
                              }>(`/api/admin/users/${u.id}/activity`, { token: adminToken });
                              setSelectedUserActivity({
                                username: String(u.username),
                                ...res,
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#E7F7EE] text-[#005B32] font-bold cursor-pointer"
                          >
                            Activity
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const nextStatus = u.status === 'active' ? 'suspended' : 'active';
                              await apiRequest(`/api/admin/users/${u.id}/status`, {
                                method: 'PATCH',
                                token: adminToken,
                                body: { status: nextStatus },
                              });
                              loadSectionData(adminToken, 'users');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold cursor-pointer"
                          >
                            {u.status === 'active' ? 'Suspend' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {section === 'products' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-display font-bold text-base text-[#17231C]">
                  Investment Plans
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setEditingProduct({
                      name: '',
                      code: '',
                      subtitle: '90-Day Tier · MAHENDRA Portfolio',
                      description: '',
                      image_key: 'silver_shield',
                      price: 800,
                      duration_days: 90,
                      daily_return: 200,
                      total_return: 18000,
                      purchase_limit: 2,
                      is_popular: 0,
                      status: 'active',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl brand-gradient text-white text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {products.map((p) => (
                  <div key={p.id} className="bg-white rounded-2xl card-mint-border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-display font-bold text-sm text-[#17231C]">{p.name}</div>
                        <div className="text-[11px] text-[#6B8275]">{p.subtitle}</div>
                      </div>
                      <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#E7F7EE] text-[#005B32]">
                        {p.status}
                      </span>
                    </div>
                    <div className="text-xs text-[#4C6356] tabular-nums">
                      Price: <strong>{formatINR(p.price)}</strong> · Daily:{' '}
                      <strong>{formatINR(p.daily_return)}</strong> · {p.duration_days}d
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingProduct(p)}
                        className="px-3 py-1.5 rounded-lg bg-[#E7F7EE] text-[#005B32] text-xs font-bold cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/admin/products/${p.id}`, {
                            method: 'DELETE',
                            token: adminToken,
                          });
                          await Promise.all([
                            loadSectionData(adminToken, 'products'),
                            onConfigUpdated(),
                          ]);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'financials' && (
            <div className="space-y-4">
              {/* Pending & Recent Deposits */}
              <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5 space-y-3">
                <h2 className="font-display font-bold text-base text-[#17231C]">
                  Deposit Verification Queue
                </h2>
                {deposits.length === 0 ? (
                  <p className="text-xs text-[#6B8275]">No deposit records.</p>
                ) : (
                  <div className="divide-y divide-[#EDF7F1]">
                    {deposits.map((d) => (
                      <div key={String(d.id)} className="py-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs">
                          <div className="font-bold text-[#17231C]">
                            {String(d.deposit_ref)} · {String(d.username)} ({String(d.phone)})
                          </div>
                          <div className="text-[#6B8275]">
                            {formatINR(Number(d.amount))} · {String(d.payment_method).toUpperCase()} ·
                            UTR: {String(d.utr_reference || 'N/A')} ·{' '}
                            <strong className="uppercase">{String(d.status)}</strong>
                          </div>
                        </div>
                        {d.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await apiRequest(`/api/admin/deposits/${d.id}/verify`, {
                                  method: 'POST',
                                  token: adminToken,
                                  body: { decision: 'approved' },
                                });
                                setFeedback(`Deposit ${d.deposit_ref} approved and credited.`);
                                loadSectionData(adminToken, 'financials');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#008C45] text-white text-xs font-bold cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await apiRequest(`/api/admin/deposits/${d.id}/verify`, {
                                  method: 'POST',
                                  token: adminToken,
                                  body: { decision: 'rejected', note: 'UTR not matched' },
                                });
                                setFeedback(`Deposit ${d.deposit_ref} rejected.`);
                                loadSectionData(adminToken, 'financials');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Withdrawal Requests */}
              <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5 space-y-3">
                <h2 className="font-display font-bold text-base text-[#17231C]">
                  Withdrawal Requests
                </h2>
                {withdrawals.length === 0 ? (
                  <p className="text-xs text-[#6B8275]">No withdrawal requests.</p>
                ) : (
                  <div className="divide-y divide-[#EDF7F1]">
                    {withdrawals.map((w) => (
                      <div key={String(w.id)} className="py-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs">
                          <div className="font-bold text-[#17231C]">
                            {String(w.withdrawal_ref)} · {String(w.username)} ({String(w.phone)})
                          </div>
                          <div className="text-[#6B8275]">
                            Gross {formatINR(Number(w.gross_amount))} · Net{' '}
                            {formatINR(Number(w.net_amount))} ·{' '}
                            <strong className="uppercase">{String(w.status)}</strong>
                          </div>
                        </div>
                        {w.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await apiRequest(`/api/admin/withdrawals/${w.id}/process`, {
                                  method: 'POST',
                                  token: adminToken,
                                  body: { decision: 'approved' },
                                });
                                setFeedback(`Withdrawal ${w.withdrawal_ref} approved.`);
                                loadSectionData(adminToken, 'financials');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#008C45] text-white text-xs font-bold cursor-pointer"
                            >
                              Approve Payout
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await apiRequest(`/api/admin/withdrawals/${w.id}/process`, {
                                  method: 'POST',
                                  token: adminToken,
                                  body: { decision: 'rejected', note: 'Bank details mismatch' },
                                });
                                setFeedback(`Withdrawal ${w.withdrawal_ref} rejected and refunded.`);
                                loadSectionData(adminToken, 'financials');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold cursor-pointer"
                            >
                              Reject &amp; Refund
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ledger Table */}
              <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5 space-y-3">
                <h2 className="font-display font-bold text-base text-[#17231C]">
                  Recent Immutable Ledger Records
                </h2>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {transactions.map((t) => (
                    <div
                      key={String(t.id)}
                      className="p-2.5 rounded-xl bg-[#F4FAF7] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#17231C]">{String(t.username)}</span> ·{' '}
                        <span>{String(t.description)}</span>
                        <div className="text-[10px] text-[#6B8275]">
                          {String(t.tx_ref)} · {formatDateTime(String(t.created_at))}
                        </div>
                      </div>
                      <span
                        className={`font-bold tabular-nums ${
                          t.type === 'credit' ? 'text-[#008C45]' : 'text-[#17231C]'
                        }`}
                      >
                        {t.type === 'credit' ? '+' : '-'}
                        {formatINR(Number(t.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {section === 'referrals' && (
            <div className="space-y-4">
              {referralData && (
                <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5 space-y-3">
                  <h2 className="font-display font-bold text-base text-[#17231C]">
                    Referral Metrics &amp; Commission History
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[#F4FAF7]">
                      <div className="text-[#6B8275]">Referral Links</div>
                      <div className="font-extrabold text-lg text-[#17231C]">
                        {referralData.totalReferrals}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F4FAF7]">
                      <div className="text-[#6B8275]">Commissions Paid</div>
                      <div className="font-extrabold text-lg text-[#008C45]">
                        {formatINR(referralData.totalCommissionPaid)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F4FAF7]">
                      <div className="text-[#6B8275]">Rates (L1/L2/L3)</div>
                      <div className="font-extrabold text-sm text-[#17231C]">
                        {referralData.rates.lv1}% / {referralData.rates.lv2}% /{' '}
                        {referralData.rates.lv3}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Gift Codes Manager */}
              <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5 space-y-3">
                <h2 className="font-display font-bold text-base text-[#17231C]">
                  Treasure Box Gift Codes
                </h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await apiRequest('/api/admin/gift-codes', {
                      method: 'POST',
                      token: adminToken,
                      body: {
                        code: newGiftCode.code,
                        rewardAmount: Number(newGiftCode.rewardAmount),
                        maxUses: Number(newGiftCode.maxUses),
                        requiresActivePlan: newGiftCode.requiresActivePlan,
                      },
                    });
                    setNewGiftCode({
                      code: '',
                      rewardAmount: '50',
                      maxUses: '100',
                      requiresActivePlan: true,
                    });
                    loadSectionData(adminToken, 'referrals');
                  }}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                >
                  <input
                    type="text"
                    required
                    placeholder="CODE (e.g. BONUS50)"
                    value={newGiftCode.code}
                    onChange={(e) =>
                      setNewGiftCode({ ...newGiftCode, code: e.target.value.toUpperCase() })
                    }
                    className="h-10 px-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-xs uppercase"
                  />
                  <input
                    type="number"
                    required
                    placeholder="Reward ₹"
                    value={newGiftCode.rewardAmount}
                    onChange={(e) =>
                      setNewGiftCode({ ...newGiftCode, rewardAmount: e.target.value })
                    }
                    className="h-10 px-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-xs"
                  />
                  <input
                    type="number"
                    required
                    placeholder="Max Uses"
                    value={newGiftCode.maxUses}
                    onChange={(e) => setNewGiftCode({ ...newGiftCode, maxUses: e.target.value })}
                    className="h-10 px-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-xs"
                  />
                  <button
                    type="submit"
                    className="h-10 rounded-xl brand-gradient text-white text-xs font-bold cursor-pointer"
                  >
                    Create Gift Code
                  </button>
                </form>

                <div className="divide-y divide-[#EDF7F1]">
                  {giftCodes.map((g) => (
                    <div key={String(g.id)} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono-num font-bold text-[#17231C]">
                          {String(g.code)}
                        </span>{' '}
                        · {formatINR(Number(g.reward_amount))} · Used {String(g.used_count)}/
                        {String(g.max_uses)}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/admin/gift-codes/${g.id}`, {
                            method: 'DELETE',
                            token: adminToken,
                          });
                          loadSectionData(adminToken, 'referrals');
                        }}
                        className="p-1.5 text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {section === 'settings' && (
            <div className="space-y-4">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiRequest('/api/admin/settings', {
                    method: 'PUT',
                    token: adminToken,
                    body: { settings: settingsForm, banner: bannerForm },
                  });
                  await onConfigUpdated();
                  setFeedback('Platform settings and content saved.');
                }}
                className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5 space-y-4"
              >
                <h2 className="font-display font-bold text-base text-[#17231C]">
                  Brand, Financial Limits &amp; Content Settings
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {[
                    { key: 'siteName', label: 'Website Name' },
                    { key: 'siteSubtitle', label: 'Website Tagline' },
                    { key: 'minRecharge', label: 'Min Recharge (₹)' },
                    { key: 'minWithdraw', label: 'Min Withdraw (₹)' },
                    { key: 'withdrawFeePercent', label: 'Withdraw Fee (%)' },
                    { key: 'withdrawTimeWindow', label: 'Withdraw Window' },
                    { key: 'commissionLv1', label: 'Level 1 Commission (%)' },
                    { key: 'commissionLv2', label: 'Level 2 Commission (%)' },
                    { key: 'commissionLv3', label: 'Level 3 Commission (%)' },
                    { key: 'telegramLink', label: 'Telegram Channel URL' },
                    { key: 'supportContact', label: 'Support Contact' },
                    { key: 'upiMerchantId', label: 'Merchant UPI ID' },
                    { key: 'popupTitle', label: 'Welcome Popup Title' },
                    { key: 'popupSubtitle', label: 'Welcome Popup Subtitle' },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block font-bold text-[#17231C] mb-1">{field.label}</label>
                      <input
                        type="text"
                        value={settingsForm[field.key] ?? ''}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, [field.key]: e.target.value })
                        }
                        className="w-full h-10 px-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0]"
                      />
                    </div>
                  ))}
                </div>

                {bannerForm && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-[#EDF7F1]">
                    <div>
                      <label className="block font-bold text-[#17231C] mb-1">Banner Title</label>
                      <input
                        type="text"
                        value={bannerForm.title}
                        onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#17231C] mb-1">Banner Subtitle</label>
                      <input
                        type="text"
                        value={bannerForm.subtitle}
                        onChange={(e) =>
                          setBannerForm({ ...bannerForm, subtitle: e.target.value })
                        }
                        className="w-full h-10 px-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#17231C] mb-1">Banner Badge</label>
                      <input
                        type="text"
                        value={bannerForm.badge_text}
                        onChange={(e) =>
                          setBannerForm({ ...bannerForm, badge_text: e.target.value })
                        }
                        className="w-full h-10 px-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0]"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.popupEnabled !== 'false'}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          popupEnabled: e.target.checked ? 'true' : 'false',
                        })
                      }
                    />
                    Show Welcome Popup on Visit
                  </label>
                  <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.maintenanceMode === 'true'}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          maintenanceMode: e.target.checked ? 'true' : 'false',
                        })
                      }
                    />
                    Maintenance Mode
                  </label>
                </div>

                <button
                  type="submit"
                  className="px-6 h-11 rounded-full brand-gradient text-white font-display font-bold text-sm cursor-pointer"
                >
                  Save All Settings
                </button>
              </form>

              {/* Broadcast Announcement */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiRequest('/api/admin/notifications', {
                    method: 'POST',
                    token: adminToken,
                    body: announcement,
                  });
                  setAnnouncement({ title: '', message: '' });
                  setFeedback('Announcement broadcast to all users.');
                }}
                className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5 space-y-3"
              >
                <h2 className="font-display font-bold text-base text-[#17231C]">
                  Publish Website Announcement
                </h2>
                <input
                  type="text"
                  required
                  placeholder="Announcement Title"
                  value={announcement.title}
                  onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-xs"
                />
                <textarea
                  required
                  rows={2}
                  placeholder="Announcement message..."
                  value={announcement.message}
                  onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })}
                  className="w-full p-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-xs"
                />
                <button
                  type="submit"
                  className="px-5 h-10 rounded-full brand-gradient text-white text-xs font-bold cursor-pointer"
                >
                  Broadcast Announcement
                </button>
              </form>
            </div>
          )}

          {section === 'audit' && (
            <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5 space-y-3">
              <h2 className="font-display font-bold text-base text-[#17231C]">
                Security &amp; Financial Audit Trail
              </h2>
              <div className="space-y-2 max-h-[520px] overflow-y-auto">
                {auditLogs.map((log) => (
                  <div
                    key={String(log.id)}
                    className="p-3 rounded-xl bg-[#F4FAF7] border border-[#E1F3E8] text-xs flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="font-bold text-[#005B32]">{String(log.action)}</span> ·{' '}
                      <span className="text-[#17231C]">
                        {String(log.actor_type)}:{String(log.actor_id)}
                      </span>
                      {log.details_json ? (
                        <div className="font-mono-num text-[10px] text-[#5B7265] mt-0.5">
                          {String(log.details_json)}
                        </div>
                      ) : null}
                    </div>
                    <span className="text-[10px] text-[#6B8275] shrink-0">
                      {formatDateTime(String(log.created_at))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Product Edit/Create Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProduct}
            className="bg-white rounded-[24px] max-w-md w-full p-5 space-y-3 shadow-2xl border border-[#D5EFE0] max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[#17231C]">
                {editingProduct.id ? `Edit ${editingProduct.name}` : 'Create Product'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-1 text-[#6B8275] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="font-bold block mb-1">Name</label>
                <input
                  required
                  value={editingProduct.name ?? ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0]"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Status</label>
                <select
                  value={editingProduct.status ?? 'active'}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      status: e.target.value as 'active' | 'presale' | 'inactive',
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0]"
                >
                  <option value="active">Active</option>
                  <option value="presale">Presale</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="font-bold block mb-1">Price (₹)</label>
                <input
                  type="number"
                  required
                  value={editingProduct.price ?? 0}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, price: Number(e.target.value) })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0]"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Duration (Days)</label>
                <input
                  type="number"
                  required
                  value={editingProduct.duration_days ?? 120}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, duration_days: Number(e.target.value) })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0]"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Daily Projected (₹)</label>
                <input
                  type="number"
                  required
                  value={editingProduct.daily_return ?? 0}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, daily_return: Number(e.target.value) })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0]"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Total Projected (₹)</label>
                <input
                  type="number"
                  required
                  value={editingProduct.total_return ?? 0}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, total_return: Number(e.target.value) })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0]"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Purchase Limit</label>
                <input
                  type="number"
                  required
                  value={editingProduct.purchase_limit ?? 5}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      purchase_limit: Number(e.target.value),
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0]"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Plan Icon</label>
                <select
                  value={editingProduct.image_key ?? 'silver_shield'}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, image_key: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0]"
                >
                  <option value="silver_shield">Silver Shield</option>
                  <option value="golden_medal">Golden Medal</option>
                  <option value="platinum_crown">Platinum Crown</option>
                  <option value="diamond_crystal">Diamond Crystal</option>
                  <option value="blue_diamond">Blue Diamond</option>
                  <option value="black_diamond">Black Diamond</option>
                  <option value="royal_crown">Royal Crown</option>
                  <option value="silver_vip_shield">Silver VIP Shield</option>
                  <option value="golden_vip_star">Golden VIP Star</option>
                  <option value="premium_diamond_crown">Premium Diamond Crown</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(editingProduct.is_popular)}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, is_popular: e.target.checked ? 1 : 0 })
                }
              />
              Mark as Popular
            </label>

            <button
              type="submit"
              className="w-full h-11 rounded-full brand-gradient text-white font-display font-bold text-sm cursor-pointer"
            >
              Save Product
            </button>
          </form>
        </div>
      )}

      {/* User Activity Modal */}
      {selectedUserActivity && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] max-w-lg w-full p-5 max-h-[80vh] overflow-y-auto space-y-3 border border-[#D5EFE0]">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[#17231C]">
                Activity: {selectedUserActivity.username}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedUserActivity(null)}
                className="p-1 text-[#6B8275] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs font-bold text-[#005B32]">
              Orders ({selectedUserActivity.orders.length})
            </div>
            {selectedUserActivity.orders.map((o) => (
              <div key={String(o.id)} className="p-2.5 rounded-xl bg-[#F4FAF7] text-xs">
                {String(o.order_number)} · {String(o.product_name)} · {formatINR(Number(o.amount))} ·{' '}
                {String(o.status)}
              </div>
            ))}
            <div className="text-xs font-bold text-[#005B32] pt-2">
              Transactions ({selectedUserActivity.transactions.length})
            </div>
            {selectedUserActivity.transactions.map((t) => (
              <div key={String(t.id)} className="p-2.5 rounded-xl bg-[#F4FAF7] text-xs flex justify-between">
                <span>{String(t.description)}</span>
                <span className="font-bold">{formatINR(Number(t.amount))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
