import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  ChevronLeft,
  CreditCard,
  Info,
  Plus,
  Trash2,
} from 'lucide-react';
import { TelegramSupportButton } from '../components/TelegramSupport';
import { formatDateShort, formatDateTime, formatINR } from '../lib/api';
import {
  addBankAccount,
  changeUserPassword,
  claimDailyReturn,
  deleteBankAccount,
  fetchMyNotifications,
  fetchMyOrders,
  fetchMyTransactions,
  fetchMyWithdrawals,
  markNotificationsRead,
  updateMyProfileName,
} from '../lib/supabaseApi';
import type {
  MainTab,
  MeResponse,
  NotificationRecord,
  OrderRecord,
  SiteSettings,
  TransactionRecord,
  WithdrawalRecord,
} from '../types';

const SubPageHeader: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => (
  <div className="brand-header-gradient text-white py-4 px-4 sticky top-0 z-20">
    <div className="max-w-3xl mx-auto flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <h1 className="font-display font-bold text-lg">{title}</h1>
      <span className="w-9" />
    </div>
  </div>
);

export const OrdersPage: React.FC<{
  refreshSignal?: number;
  onBack: () => void;
  onRefreshMe: () => Promise<void>;
}> = ({ refreshSignal = 0, onBack, onRefreshMe }) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchMyOrders(filter);
      setOrders(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [filter, refreshSignal]);

  const handleSettleYield = async (orderId: string) => {
    setMessage(null);
    setError(null);
    try {
      const res = await claimDailyReturn(orderId);
      setMessage(`Settled ${res.daysSettled} day(s): +${formatINR(res.credited)} credited.`);
      await Promise.all([loadOrders(), onRefreshMe()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No yield due yet.');
    }
  };

  return (
    <div className="pb-24 lg:pb-10">
      <SubPageHeader title="My Orders" onBack={onBack} />
      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 mt-4 space-y-4">
        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-[#E7F7EE] border border-[#CBEBD7]">
          {(['all', 'active', 'completed', 'cancelled'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`py-2 rounded-xl text-xs font-bold capitalize transition cursor-pointer ${
                filter === tab
                  ? 'brand-gradient text-white shadow-sm'
                  : 'text-[#4C6356] hover:text-[#005B32]'
              }`}
            >
              {tab === 'all' ? 'All Orders' : tab}
            </button>
          ))}
        </div>

        {message && (
          <div className="p-3 rounded-2xl bg-[#E7F7EE] border border-[#A6DEC0] text-xs font-semibold text-[#005B32]">
            {message}
          </div>
        )}
        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl card-mint-border p-8 text-center text-xs text-[#6B8275]">
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl card-mint-border p-10 text-center text-xs text-[#6B8275]">
            No orders found for this filter.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((ord) => (
              <div key={ord.id} className="bg-white rounded-[22px] card-mint-border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#EDF7F1]">
                  <div>
                    <div className="font-display font-bold text-base text-[#17231C]">
                      {ord.product_name}
                    </div>
                    <div className="font-mono-num text-[11px] text-[#6B8275]">
                      {ord.order_number} · {formatDateShort(ord.created_at)}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                      ord.status === 'active'
                        ? 'bg-[#E7F7EE] text-[#008C45]'
                        : ord.status === 'completed'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {ord.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#F4FAF7]">
                    <div className="text-[#6B8275]">Amount</div>
                    <div className="font-bold text-[#17231C] tabular-nums mt-0.5">
                      {formatINR(ord.amount)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F4FAF7]">
                    <div className="text-[#6B8275]">Duration</div>
                    <div className="font-bold text-[#17231C] tabular-nums mt-0.5">
                      {ord.days_completed}/{ord.duration_days}d
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F4FAF7]">
                    <div className="text-[#6B8275]">Settled</div>
                    <div className="font-bold text-[#008C45] tabular-nums mt-0.5">
                      {formatINR(ord.earned_so_far)}
                    </div>
                  </div>
                </div>

                {ord.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => handleSettleYield(ord.id)}
                    className="w-full h-10 rounded-xl bg-[#E7F7EE] hover:bg-[#D5EFE0] text-[#005B32] text-xs font-bold transition cursor-pointer"
                  >
                    Check &amp; Settle Elapsed Daily Yield
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const BankCardPage: React.FC<{
  me: MeResponse;
  onBack: () => void;
  onRefreshMe: () => Promise<void>;
}> = ({ me, onBack, onRefreshMe }) => {
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await addBankAccount({
        userId: me.user.id,
        accountHolder,
        bankName,
        accountNumber,
        ifscCode,
        upiId,
      });
      setAccountHolder('');
      setBankName('');
      setAccountNumber('');
      setIfscCode('');
      setUpiId('');
      await onRefreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save bank card.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteBankAccount(id);
      await onRefreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove bank card.');
    }
  };

  return (
    <div className="pb-24 lg:pb-10">
      <SubPageHeader title="Bank Card" onBack={onBack} />
      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 mt-4 space-y-4">
        {me.bankAccounts.map((acc) => (
          <div
            key={acc.id}
            className="brand-gradient text-white rounded-[22px] p-4 shadow-md flex items-center justify-between gap-3"
          >
            <div>
              <div className="flex items-center gap-2 text-xs text-white/80">
                <CreditCard className="w-4 h-4" />
                <span>{acc.bank_name}</span>
              </div>
              <div className="mt-1 font-mono-num font-bold text-lg">
                •••• •••• {acc.account_number.slice(-4)}
              </div>
              <div className="text-xs text-white/85 mt-0.5">
                {acc.account_holder} · IFSC {acc.ifsc_code}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(acc.id)}
              aria-label="Remove bank card"
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <form onSubmit={handleAdd} className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5 space-y-3">
          <h2 className="font-display font-bold text-base text-[#17231C] flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#008C45]" />
            Bind New Bank Account
          </h2>
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}
          <input
            type="text"
            required
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            placeholder="Account Holder Name"
            className="w-full h-11 px-3.5 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-sm"
          />
          <input
            type="text"
            required
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Bank Name (e.g. HDFC Bank)"
            className="w-full h-11 px-3.5 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-sm"
          />
          <input
            type="text"
            required
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="Account Number"
            className="w-full h-11 px-3.5 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-sm font-mono-num"
          />
          <div className="grid grid-cols-2 gap-2.5">
            <input
              type="text"
              required
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
              placeholder="IFSC Code"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-sm font-mono-num uppercase"
            />
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="UPI ID (Optional)"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full h-11 rounded-full brand-gradient text-white font-display font-bold text-sm cursor-pointer disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Bank Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export const PersonalInfoPage: React.FC<{
  me: MeResponse;
  onBack: () => void;
  onRefreshMe: () => Promise<void>;
}> = ({ me, onBack, onRefreshMe }) => {
  const [username, setUsername] = useState(me.profile.username);
  const [kind, setKind] = useState<'login' | 'withdrawal'>(
    me.hasWithdrawalPin === false ? 'withdrawal' : 'login'
  );
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const needsInitialPin = kind === 'withdrawal' && me.hasWithdrawalPin === false;

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      await updateMyProfileName(me.user.id, username);
      await onRefreshMe();
      setMsg('Profile updated.');
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Update failed.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      const responseMsg = await changeUserPassword({
        email: me.user.email || '',
        kind,
        currentPassword: needsInitialPin ? '' : currentPassword,
        newPassword,
      });
      setMsg(responseMsg);
      setCurrentPassword('');
      setNewPassword('');
      if (kind === 'withdrawal') {
        await onRefreshMe();
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Password change failed.');
    }
  };

  return (
    <div className="pb-24 lg:pb-10">
      <SubPageHeader title="Personal Information" onBack={onBack} />
      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 mt-4 space-y-4">
        {msg && (
          <div className="p-3 rounded-xl bg-[#E7F7EE] border border-[#9CD9B8] text-xs font-semibold text-[#005B32]">
            {msg}
          </div>
        )}
        {err && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
            {err}
          </div>
        )}

        <form onSubmit={handleSaveName} className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5 space-y-3">
          <h2 className="font-display font-bold text-base text-[#17231C]">Account Details</h2>
          <div className="text-xs text-[#6B8275]">
            {me.user.email ? `Email: ${me.user.email} · ` : ''}
            Mobile: {me.user.countryCode} {me.user.maskedPhone} · Invite Code: {me.user.referralCode}
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-sm"
          />
          <button
            type="submit"
            className="h-10 px-5 rounded-full brand-gradient text-white text-xs font-bold cursor-pointer"
          >
            Save Username
          </button>
        </form>

        <form onSubmit={handleChangePassword} className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5 space-y-3">
          <h2 className="font-display font-bold text-base text-[#17231C]">Password Security</h2>
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#E7F7EE]">
            {(['login', 'withdrawal'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setErr(null);
                  setMsg(null);
                }}
                className={`py-2 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                  kind === k ? 'brand-gradient text-white' : 'text-[#4C6356]'
                }`}
              >
                {k} Password
              </button>
            ))}
          </div>

          {needsInitialPin ? (
            <div className="p-2.5 rounded-xl bg-[#FFF9E6] border border-[#F3D88C] text-[11px] font-semibold text-[#6E4B00]">
              Set your 4+ character Withdrawal Password for authorizing future payouts.
            </div>
          ) : (
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={`Current ${kind} password`}
              className="w-full h-11 px-3.5 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-sm"
            />
          )}

          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={
              needsInitialPin ? 'Create withdrawal password (4+ chars)' : `New ${kind} password`
            }
            className="w-full h-11 px-3.5 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-sm"
          />
          <button
            type="submit"
            className="w-full h-11 rounded-full brand-gradient text-white font-display font-bold text-sm cursor-pointer"
          >
            {needsInitialPin
              ? 'Set Withdrawal Password'
              : `Update ${kind === 'login' ? 'Login' : 'Withdrawal'} Password`}
          </button>
        </form>
      </div>
    </div>
  );
};

export const BalanceDetailsPage: React.FC<{
  refreshSignal?: number;
  onBack: () => void;
}> = ({ refreshSignal = 0, onBack }) => {
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [txs, setTxs] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchMyTransactions(filter)
      .then(setTxs)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load transactions.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [filter, refreshSignal]);

  return (
    <div className="pb-24 lg:pb-10">
      <SubPageHeader title="Balance Details" onBack={onBack} />
      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 mt-4 space-y-4">
        <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-[#E7F7EE]">
          {(['all', 'credit', 'debit'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={`py-2 rounded-xl text-xs font-bold capitalize cursor-pointer ${
                filter === t ? 'brand-gradient text-white' : 'text-[#4C6356]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-[24px] card-mint-border divide-y divide-[#EDF7F1]">
          {loading ? (
            <div className="p-8 text-center text-xs text-[#6B8275]">Loading transactions...</div>
          ) : txs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B8275]">No ledger entries yet.</div>
          ) : (
            txs.map((tx) => (
              <div key={tx.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.type === 'credit'
                        ? 'bg-[#E7F7EE] text-[#008C45]'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tx.type === 'credit' ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#17231C] truncate">
                      {tx.description}
                    </div>
                    <div className="font-mono-num text-[11px] text-[#6B8275]">
                      {tx.tx_ref} · {formatDateTime(tx.created_at)}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`font-display font-extrabold text-sm tabular-nums ${
                      tx.type === 'credit' ? 'text-[#008C45]' : 'text-[#17231C]'
                    }`}
                  >
                    {tx.type === 'credit' ? '+' : '-'}
                    {formatINR(tx.amount)}
                  </div>
                  <div className="text-[10px] text-[#6B8275] tabular-nums">
                    Bal {formatINR(tx.balance_after)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const WithdrawalDetailsPage: React.FC<{
  refreshSignal?: number;
  onBack: () => void;
  onNavigate: (tab: MainTab) => void;
}> = ({ refreshSignal = 0, onBack, onNavigate }) => {
  const [items, setItems] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchMyWithdrawals()
      .then(setItems)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load withdrawal history.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [refreshSignal]);

  return (
    <div className="pb-24 lg:pb-10">
      <SubPageHeader title="Withdrawal Details" onBack={onBack} />
      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 mt-4 space-y-4">
        <button
          type="button"
          onClick={() => onNavigate('withdraw')}
          className="w-full h-11 rounded-full brand-gradient text-white font-display font-bold text-sm cursor-pointer"
        >
          New Withdrawal Request
        </button>

        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-[24px] card-mint-border divide-y divide-[#EDF7F1]">
          {loading ? (
            <div className="p-8 text-center text-xs text-[#6B8275]">Loading withdrawal records...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B8275]">No withdrawal records yet.</div>
          ) : (
            items.map((w) => {
              const bank: { bank_name?: string; account_number_masked?: string } = (() => {
                if (typeof w.bank_snapshot_json === 'object' && w.bank_snapshot_json !== null) {
                  return w.bank_snapshot_json;
                }
                if (typeof w.bank_snapshot_json === 'string') {
                  try {
                    return JSON.parse(w.bank_snapshot_json) as {
                      bank_name?: string;
                      account_number_masked?: string;
                    };
                  } catch {
                    return {};
                  }
                }
                return {};
              })();
              return (
                <div key={w.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-mono-num font-bold text-xs text-[#17231C]">
                      {w.withdrawal_ref} · {bank.bank_name ?? 'Bank'} (
                      {bank.account_number_masked ?? '****'})
                    </div>
                    <div className="text-[11px] text-[#6B8275] mt-0.5">
                      {formatDateTime(w.created_at)} · Fee {formatINR(w.fee_amount)} · Net{' '}
                      {formatINR(w.net_amount)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-extrabold text-sm text-[#17231C] tabular-nums">
                      {formatINR(w.gross_amount)}
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase ${
                        w.status === 'approved'
                          ? 'text-[#008C45]'
                          : w.status === 'rejected'
                            ? 'text-red-600'
                            : 'text-amber-600'
                      }`}
                    >
                      {w.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export const NotificationsPage: React.FC<{
  refreshSignal?: number;
  onBack: () => void;
  onRefreshMe: () => Promise<void>;
}> = ({ refreshSignal = 0, onBack, onRefreshMe }) => {
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchMyNotifications()
      .then(async (list) => {
        setItems(list);
        await markNotificationsRead().catch(() => {});
        await onRefreshMe().catch(() => {});
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load notifications.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [refreshSignal]);

  return (
    <div className="pb-24 lg:pb-10">
      <SubPageHeader title="Notification Center" onBack={onBack} />
      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 mt-4 space-y-3">
        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}
        {loading ? (
          <div className="bg-white rounded-2xl card-mint-border p-8 text-center text-xs text-[#6B8275]">
            Loading notifications...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl card-mint-border p-8 text-center text-xs text-[#6B8275]">
            No notifications yet.
          </div>
        ) : (
          items.map((n) => (
            <div key={n.id} className="bg-white rounded-[22px] card-mint-border p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E7F7EE] text-[#008C45] flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-display font-bold text-sm text-[#17231C]">{n.title}</div>
                <p className="text-xs text-[#4C6356] mt-1 leading-relaxed">{n.message}</p>
                <div className="text-[10px] text-[#7B9184] mt-1.5">
                  {formatDateTime(n.created_at)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const AboutPage: React.FC<{ settings: SiteSettings; onBack: () => void }> = ({
  settings,
  onBack,
}) => (
  <div className="pb-24 lg:pb-10">
    <SubPageHeader title={`About ${settings.siteName}`} onBack={onBack} />
    <div className="max-w-3xl mx-auto px-3.5 sm:px-6 mt-4 space-y-4">
      <div className="bg-white rounded-[24px] card-mint-border p-5 space-y-3">
        <div className="flex items-center gap-2 text-[#008C45] font-display font-bold text-base">
          <Info className="w-5 h-5" />
          <span>{settings.siteName} — {settings.siteSubtitle}</span>
        </div>
        <p className="text-xs sm:text-sm text-[#4C6356] leading-relaxed">
          {settings.siteName} is an original architectural surface portfolio management platform
          featuring transparent cycle tracking, server-verified deposit and withdrawal ledgers, and
          configurable referral compensation rules.
        </p>
        <div className="pt-3 border-t border-[#EDF7F1] text-xs text-[#546B5E] whitespace-pre-line">
          {settings.termsText}
        </div>
        <div className="pt-2">
          <TelegramSupportButton label="CONTACT SUPPORT ON TELEGRAM" />
        </div>
      </div>
    </div>
  </div>
);
