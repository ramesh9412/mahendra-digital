import React, { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ChevronLeft,
  CreditCard,
  Info,
  KeyRound,
  Wallet,
} from 'lucide-react';
import { apiRequest, formatDateTime, formatINR } from '../lib/api';
import type { MainTab, MeResponse, SiteSettings, WithdrawalRecord } from '../types';

// Local rounding helper
function calcMoney(val: number): number {
  return Math.round(val * 100) / 100;
}

interface WithdrawPageProps {
  me: MeResponse;
  settings: SiteSettings;
  token: string;
  onNavigate: (tab: MainTab) => void;
  onRefreshMe: () => Promise<void>;
}

export const WithdrawPage: React.FC<WithdrawPageProps> = ({
  me,
  settings,
  token,
  onNavigate,
  onRefreshMe,
}) => {
  const [amountStr, setAmountStr] = useState('0');
  const [selectedBankId, setSelectedBankId] = useState(me.bankAccounts[0]?.id ?? '');
  const [withdrawalPassword, setWithdrawalPassword] = useState('');
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBankId && me.bankAccounts[0]?.id) {
      setSelectedBankId(me.bankAccounts[0].id);
    }
  }, [me.bankAccounts, selectedBankId]);

  const loadWithdrawals = async () => {
    try {
      const res = await apiRequest<{ withdrawals: WithdrawalRecord[] }>('/api/withdrawals', {
        token,
      });
      setWithdrawals(res.withdrawals);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, [token]);

  const available = me.profile.availableBalance;
  const grossAmount = Math.max(0, Number(amountStr) || 0);
  const feePercent = settings.withdrawFeePercent ?? 10;
  const feeAmount = calcMoney((grossAmount * feePercent) / 100);
  const netReceive = calcMoney(Math.max(0, grossAmount - feeAmount));

  const setPercentage = (pct: number) => {
    const val = Math.floor((available * pct) / 100);
    setAmountStr(String(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const res = await apiRequest<{ withdrawalRef: string; netAmount: number }>('/api/withdrawals', {
        method: 'POST',
        token,
        body: {
          amount: grossAmount,
          bankAccountId: selectedBankId,
          withdrawalPassword,
        },
      });
      setSuccess(
        `Withdrawal ${res.withdrawalRef} submitted (Net payout ${formatINR(res.netAmount)}). Status: Pending.`
      );
      setAmountStr('0');
      setWithdrawalPassword('');
      await Promise.all([loadWithdrawals(), onRefreshMe()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit withdrawal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-24 lg:pb-10">
      {/* Green Header */}
      <div className="brand-header-gradient text-white pt-4 pb-12 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              aria-label="Back"
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="font-display font-bold text-lg">Withdraw</h1>
            <span className="w-9" />
          </div>

          <div className="mt-4 inline-block px-3 py-1 rounded-full bg-white/15 text-[11px] font-bold tracking-wider uppercase">
            Withdrawable Balance
          </div>
          <div className="mt-1.5 font-display font-extrabold text-3xl sm:text-4xl tabular-nums">
            {formatINR(available)}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3.5 sm:px-6 -mt-6 space-y-4 relative z-10">
        {/* Segmented Switch */}
        <div className="bg-white rounded-full p-1.5 card-mint-border grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onNavigate('recharge')}
            className="h-11 rounded-full bg-[#EFF9F3] text-[#4C6356] hover:text-[#005B32] font-display font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Wallet className="w-4 h-4" />
            <span>Recharge</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('withdraw')}
            className="h-11 rounded-full brand-gradient text-white font-display font-bold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>Withdraw</span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3.5 rounded-2xl bg-[#E7F7EE] border border-[#9CD9B8] text-xs font-semibold text-[#005B32]">
            {success}
          </div>
        )}

        {/* Bank Account Card */}
        <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-[#E7F7EE] text-[#008C45] flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </span>
              <h2 className="font-display font-bold text-sm text-[#17231C]">Bank account</h2>
            </div>
            {me.bankAccounts.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('bank-cards')}
                className="text-xs font-bold text-[#008C45] hover:underline cursor-pointer"
              >
                Manage
              </button>
            )}
          </div>

          {me.bankAccounts.length === 0 ? (
            <>
              <p className="text-xs text-[#6B8275] leading-relaxed mb-3.5">
                No bank account linked yet. Bind your bank card to start withdrawing.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('bank-cards')}
                className="w-full h-11 rounded-full brand-gradient text-white font-display font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Bind bank card</span>
              </button>
            </>
          ) : (
            <div className="space-y-2">
              {me.bankAccounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setSelectedBankId(acc.id)}
                  className={`w-full text-left p-3 rounded-2xl border transition cursor-pointer ${
                    selectedBankId === acc.id
                      ? 'bg-[#E7F7EE] border-[#008C45]'
                      : 'bg-[#F8FCFA] border-[#DCEEE3]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-sm text-[#17231C]">
                      {acc.bank_name}
                    </span>
                    <span className="font-mono-num text-xs font-bold text-[#005B32]">
                      ****{acc.account_number.slice(-4)}
                    </span>
                  </div>
                  <div className="text-xs text-[#5B7265] mt-0.5">
                    {acc.account_holder} · IFSC {acc.ifsc_code}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Amount & Breakdown Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-sm text-[#17231C]">Enter amount</h2>
              <span className="text-xs text-[#6B8275] tabular-nums">
                Available {formatINR(available)}
              </span>
            </div>

            <div className="flex items-center gap-2 px-4 h-14 rounded-2xl bg-[#EBF7F0] border border-[#CBEBD7]">
              <span className="font-display font-extrabold text-xl text-[#008C45]">₹</span>
              <input
                type="number"
                min={0}
                max={settings.maxWithdraw}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full bg-transparent font-display font-extrabold text-2xl text-[#17231C] focus:outline-none tabular-nums"
              />
            </div>

            <div className="mt-2.5 flex items-center justify-between text-xs text-[#6B8275]">
              <span className="flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-[#008C45]" />
                Min {formatINR(settings.minWithdraw)}
              </span>
              <span>Max {formatINR(settings.maxWithdraw)}</span>
            </div>

            {/* 25% 50% 75% Max */}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setPercentage(pct)}
                  className="h-10 rounded-xl bg-[#F8FCFA] hover:bg-[#E7F7EE] border border-[#DCEEE3] text-xs font-bold text-[#17231C] transition cursor-pointer"
                >
                  {pct === 100 ? 'Max' : `${pct}%`}
                </button>
              ))}
            </div>

            {/* Fee Breakdown Box */}
            <div className="mt-4 p-3.5 rounded-2xl bg-[#EBF7F0] border border-[#D4EDE0] space-y-2 text-xs">
              <div className="flex justify-between text-[#4C6356]">
                <span>Withdraw amount</span>
                <span className="font-bold text-[#17231C] tabular-nums">
                  {formatINR(grossAmount)}
                </span>
              </div>
              <div className="flex justify-between text-[#4C6356]">
                <span>Service fee (-{feePercent}%)</span>
                <span className="font-bold text-[#17231C] tabular-nums">
                  - {formatINR(feeAmount)}
                </span>
              </div>
              <div className="pt-2 border-t border-dashed border-[#B7DEC8] flex justify-between items-center">
                <span className="font-bold text-[#17231C]">You receive</span>
                <span className="font-display font-extrabold text-base text-[#008C45] tabular-nums">
                  {formatINR(netReceive)}
                </span>
              </div>
            </div>

            {/* Withdrawal Password */}
            <div className="mt-4">
              <label className="block text-xs font-bold text-[#17231C] mb-1.5">
                Withdrawal Password
              </label>
              <div className="flex items-center gap-2 px-3.5 h-11 rounded-2xl bg-[#F4FAF7] border border-[#D4EDE0]">
                <KeyRound className="w-4 h-4 text-[#008C45] shrink-0" />
                <input
                  type="password"
                  required
                  value={withdrawalPassword}
                  onChange={(e) => setWithdrawalPassword(e.target.value)}
                  placeholder="Enter your withdrawal password"
                  className="w-full bg-transparent text-sm text-[#17231C] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Withdrawal Instructions */}
          <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-[#008C45]" />
              <h2 className="font-display font-bold text-sm text-[#17231C]">
                Withdrawal instructions
              </h2>
            </div>
            <div className="space-y-3 text-xs text-[#4C6356]">
              {[
                `Minimum withdrawal amount is ${formatINR(settings.minWithdraw)} (max ${formatINR(settings.maxWithdraw)}).`,
                `A ${feePercent}% service fee applies to each withdrawal request.`,
                `Withdrawal window: ${settings.withdrawTimeWindow}.`,
                'Requests are reviewed and settled by the backend team.',
              ].map((txt, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#E7F7EE] text-[#008C45] font-bold text-[11px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span>{txt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Withdrawal History */}
          <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5">
            <h2 className="font-display font-bold text-sm text-[#17231C] mb-3">
              Withdrawal History
            </h2>
            {withdrawals.length === 0 ? (
              <p className="text-xs text-[#6B8275] py-4 text-center">No withdrawal requests yet.</p>
            ) : (
              <div className="divide-y divide-[#EDF7F1]">
                {withdrawals.map((w) => (
                  <div key={w.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono-num font-bold text-xs text-[#17231C]">
                        {w.withdrawal_ref}
                      </div>
                      <div className="text-[11px] text-[#6B8275]">
                        {formatDateTime(w.created_at)} · Net {formatINR(w.net_amount)}
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
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || me.bankAccounts.length === 0}
            className="w-full h-12 rounded-full brand-gradient text-white font-display font-extrabold text-base shadow-lg shadow-[#008C45]/25 hover:brightness-105 active:scale-[0.99] transition disabled:opacity-60 cursor-pointer tabular-nums"
          >
            {submitting ? 'Submitting...' : `Continue ${formatINR(grossAmount)}`}
          </button>
        </form>
      </div>
    </div>
  );
};
