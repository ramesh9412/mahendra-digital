import React, { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ChevronLeft,
  Headphones,
  Info,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import {
  TELEGRAM_SUPPORT_USERNAME,
  TelegramSupportButton,
} from '../components/TelegramSupport';
import { formatDateTime, formatINR } from '../lib/api';
import { fetchMyDeposits, submitDepositRequest } from '../lib/supabaseApi';
import type { DepositRecord, MainTab, MeResponse, SiteSettings } from '../types';

interface RechargePageProps {
  me: MeResponse;
  settings: SiteSettings;
  refreshSignal?: number;
  onNavigate: (tab: MainTab) => void;
  onRefreshMe: () => Promise<void>;
}

const QUICK_AMOUNTS = [
  { amount: 800, popular: false },
  { amount: 1500, popular: true },
  { amount: 2200, popular: false },
  { amount: 4000, popular: false },
  { amount: 8500, popular: false },
  { amount: 18000, popular: false },
];

export const RechargePage: React.FC<RechargePageProps> = ({
  me,
  settings,
  refreshSignal = 0,
  onNavigate,
  onRefreshMe,
}) => {
  const [amountStr, setAmountStr] = useState(String(settings.minRecharge || 800));
  const paymentMethod: 'upi' | 'bank' = 'upi';
  const [utrReference, setUtrReference] = useState('');
  const [showCheckoutStep, setShowCheckoutStep] = useState(false);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => `IDEMP-${Date.now()}`);

  const loadDeposits = async () => {
    setDepositsLoading(true);
    try {
      const rows = await fetchMyDeposits();
      setDeposits(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load deposit history.');
    } finally {
      setDepositsLoading(false);
    }
  };

  useEffect(() => {
    loadDeposits();
  }, [me.user.id, refreshSignal]);

  const numericAmount = Number(amountStr) || 0;

  const handleOpenStep = () => {
    setError(null);
    setSuccess(null);
    if (numericAmount < settings.minRecharge) {
      setError(`Minimum recharge amount is ${formatINR(settings.minRecharge)}.`);
      return;
    }
    const uniqueKey =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `DEP-${crypto.randomUUID()}`
        : `IDEMP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setIdempotencyKey(uniqueKey);
    setShowCheckoutStep(true);
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await submitDepositRequest({
        amount: numericAmount,
        paymentMethod,
        utrReference,
        idempotencyKey,
      });
      setSuccess(
        `Request ${res.deposit.deposit_ref} submitted (${res.deposit.status}). ${res.message || 'Pending server-side verification.'}`
      );
      setUtrReference('');
      setShowCheckoutStep(false);
      await Promise.all([loadDeposits(), onRefreshMe()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit deposit request.');
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
            <h1 className="font-display font-bold text-lg">Recharge</h1>
            <span className="w-9" />
          </div>

          <div className="mt-4 inline-block px-3 py-1 rounded-full bg-white/15 text-[11px] font-bold tracking-wider uppercase">
            Wallet Balance
          </div>
          <div className="mt-1.5 font-display font-extrabold text-3xl sm:text-4xl tabular-nums">
            {formatINR(me.profile.availableBalance)}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-3.5 sm:px-6 -mt-6 space-y-4 relative z-10">
        {/* Segmented Recharge | Withdraw Switch */}
        <div className="bg-white rounded-full p-1.5 card-mint-border grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onNavigate('recharge')}
            className="h-11 rounded-full brand-gradient text-white font-display font-bold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Wallet className="w-4 h-4" />
            <span>Recharge</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('withdraw')}
            className="h-11 rounded-full bg-[#EFF9F3] text-[#4C6356] hover:text-[#005B32] font-display font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
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

        {/* Enter Amount Card */}
        <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-sm text-[#17231C]">Enter amount</h2>
            <span className="text-[11px] text-[#7A9184]">Tap a quick amount below</span>
          </div>

          <div className="flex items-center gap-2 px-4 h-14 rounded-2xl bg-[#EBF7F0] border border-[#CBEBD7]">
            <span className="font-display font-extrabold text-xl text-[#008C45]">₹</span>
            <input
              type="number"
              min={settings.minRecharge}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full bg-transparent font-display font-extrabold text-2xl text-[#17231C] focus:outline-none tabular-nums"
            />
            {amountStr && (
              <button
                type="button"
                onClick={() => setAmountStr('')}
                aria-label="Clear amount"
                className="w-6 h-6 rounded-full bg-[#8FA799] text-white flex items-center justify-center hover:bg-[#5E7668] cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-[#6B8275]">
            <Info className="w-3.5 h-3.5 text-[#008C45]" />
            <span>Minimum recharge {formatINR(settings.minRecharge)}</span>
          </div>

          {/* 3x2 Quick Amount Grid */}
          <div className="mt-3.5 grid grid-cols-3 gap-2.5">
            {QUICK_AMOUNTS.map((item) => {
              const selected = numericAmount === item.amount;
              return (
                <button
                  key={item.amount}
                  type="button"
                  onClick={() => setAmountStr(String(item.amount))}
                  className={`relative h-12 rounded-2xl font-display font-bold text-sm tabular-nums transition cursor-pointer border ${
                    selected
                      ? 'brand-gradient text-white border-transparent shadow-md'
                      : 'bg-[#F8FCFA] text-[#17231C] border-[#DCEEE3] hover:border-[#008C45]/50'
                  }`}
                >
                  {item.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#F59E0B] text-white text-[9px] font-extrabold tracking-wide shadow-xs">
                      POPULAR
                    </span>
                  )}
                  {formatINR(item.amount)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment Assistance Section */}
        <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#03361C] border border-[#D4AF37]/70 text-[#FFE27A] flex items-center justify-center shrink-0">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-sm sm:text-base text-[#17231C]">
                Payment Assistance
              </h2>
              <p className="text-[11px] font-semibold text-[#008C45]">
                Official Support: {TELEGRAM_SUPPORT_USERNAME}
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#3B5246] leading-relaxed">
            Need payment details or help with your recharge? Contact our official Telegram Support
            Team.
          </p>

          <TelegramSupportButton label="CONTACT SUPPORT ON TELEGRAM" />

          <div className="p-2.5 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] flex items-start gap-2 text-[11px] text-[#4C6356]">
            <ShieldCheck className="w-4 h-4 text-[#008C45] shrink-0 mt-0.5" />
            <span>
              Follow only officially verified payment instructions from {TELEGRAM_SUPPORT_USERNAME}.
              Never share passwords, OTPs, or login credentials.
            </span>
          </div>
        </div>

        {/* Checkout / UTR Verification Box when Continue clicked */}
        {showCheckoutStep && (
          <form
            onSubmit={handleSubmitDeposit}
            className="bg-white rounded-[24px] border-2 border-[#008C45] p-4 sm:p-5 shadow-lg space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-extrabold text-base text-[#005B32]">
                Complete Payment Verification
              </h3>
              <button
                type="button"
                onClick={() => setShowCheckoutStep(false)}
                className="p-1 text-[#6B8275] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F4FAF7] border border-[#D4EDE0] text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#5B7265]">Deposit Amount</span>
                <span className="font-bold text-[#008C45] tabular-nums">
                  {formatINR(numericAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B7265]">Verified Payment Instructions</span>
                <span className="font-mono-num font-bold text-[#17231C]">
                  {TELEGRAM_SUPPORT_USERNAME}
                </span>
              </div>
              <p className="pt-1.5 border-t border-[#DCEEE3] text-[11px] text-[#4C6356] leading-relaxed">
                Contact our official Telegram support team to receive verified payment details, then
                submit your transaction reference / UTR below for server verification.
              </p>
            </div>

            <TelegramSupportButton label="CONTACT SUPPORT ON TELEGRAM" />

            <div>
              <label className="block text-xs font-bold text-[#17231C] mb-1">
                Enter Payment Reference / UTR Number
              </label>
              <input
                type="text"
                required
                value={utrReference}
                onChange={(e) => setUtrReference(e.target.value)}
                placeholder="e.g., 432198765432"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-sm font-mono-num text-[#17231C] focus:outline-none focus:border-[#008C45]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-full brand-gradient text-white font-display font-bold text-sm shadow-md cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Submit Deposit for Verification'}
            </button>
          </form>
        )}

        {/* How It Works */}
        <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 text-[#008C45]" />
            <h2 className="font-display font-bold text-sm text-[#17231C]">How it works</h2>
          </div>
          <div className="space-y-3 text-xs text-[#4C6356]">
            {[
              `Minimum recharge amount is ${formatINR(settings.minRecharge)}. Click Contact Support on Telegram to open ${TELEGRAM_SUPPORT_USERNAME}.`,
              'Contact the official support team for verified payment instructions.',
              'Follow only officially verified payment instructions. Never share passwords, OTPs, or login credentials.',
              'Submit your payment reference / UTR above — wallet credit is applied only after verified settlement.',
            ].map((txt, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#E7F7EE] text-[#008C45] font-bold text-[11px] flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="leading-relaxed">{txt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recharge History */}
        <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5">
          <h2 className="font-display font-bold text-sm text-[#17231C] mb-3">Recharge History</h2>
          {depositsLoading && deposits.length === 0 ? (
            <p className="text-xs text-[#6B8275] py-4 text-center">Loading deposit requests...</p>
          ) : deposits.length === 0 ? (
            <p className="text-xs text-[#6B8275] py-4 text-center">No deposit requests yet.</p>
          ) : (
            <div className="divide-y divide-[#EDF7F1]">
              {deposits.map((dep) => (
                <div key={dep.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono-num font-bold text-xs text-[#17231C]">
                      {dep.deposit_ref} · {dep.payment_method.toUpperCase()}
                    </div>
                    <div className="text-[11px] text-[#6B8275]">
                      {formatDateTime(dep.created_at)}
                      {dep.utr_reference ? ` · UTR: ${dep.utr_reference}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display font-extrabold text-sm text-[#17231C] tabular-nums">
                      {formatINR(dep.amount)}
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase ${
                        dep.status === 'approved'
                          ? 'text-[#008C45]'
                          : dep.status === 'rejected'
                            ? 'text-red-600'
                            : 'text-amber-600'
                      }`}
                    >
                      {dep.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Primary Continue Button */}
        {!showCheckoutStep && (
          <button
            type="button"
            onClick={handleOpenStep}
            className="w-full h-12 rounded-full brand-gradient text-white font-display font-extrabold text-base shadow-lg shadow-[#008C45]/25 hover:brightness-105 active:scale-[0.99] transition cursor-pointer tabular-nums"
          >
            Continue {formatINR(numericAmount)}
          </button>
        )}
      </div>
    </div>
  );
};
