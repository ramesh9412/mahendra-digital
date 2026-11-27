import React, { useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, Gift, Lock, Trophy, Unlock } from 'lucide-react';
import { apiRequest, formatDateTime, formatINR } from '../lib/api';
import type { MainTab, TreasureResponse } from '../types';
import { TreasureGiftBoxSvg } from '../components/BrandVisuals';

interface TreasureBoxPageProps {
  token: string;
  onNavigate: (tab: MainTab) => void;
  onRefreshMe: () => Promise<void>;
}

export const TreasureBoxPage: React.FC<TreasureBoxPageProps> = ({
  token,
  onNavigate,
  onRefreshMe,
}) => {
  const [data, setData] = useState<TreasureResponse | null>(null);
  const [giftCode, setGiftCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadTreasure = async () => {
    try {
      const res = await apiRequest<TreasureResponse>('/api/treasure', { token });
      setData(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTreasure();
  }, [token]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setGiftCode(text.trim().toUpperCase());
    } catch {
      setError('Clipboard paste unavailable. Enter the gift code manually.');
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const res = await apiRequest<{ amount: number; code: string }>('/api/treasure/redeem', {
        method: 'POST',
        token,
        body: { code: giftCode },
      });
      setSuccess(`Claimed ${formatINR(res.amount)} with code ${res.code}!`);
      setGiftCode('');
      await Promise.all([loadTreasure(), onRefreshMe()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to redeem code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-24 lg:pb-10">
      {/* Dark Green Radial Header */}
      <div className="treasure-radial-bg text-white pt-4 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              aria-label="Back to Home"
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="font-display font-bold text-lg tracking-tight">Treasure Box</h1>
            <span className="w-9" />
          </div>

          {/* Large Green & Gold Treasure Box */}
          <div className="mt-4 flex justify-center">
            <TreasureGiftBoxSvg className="w-40 h-40 drop-shadow-[0_14px_24px_rgba(0,0,0,0.45)]" />
          </div>

          {/* Gift Code Form */}
          <form onSubmit={handleClaim} className="mt-4 max-w-md mx-auto space-y-3">
            <div className="flex items-center gap-2 p-1.5 pl-3.5 rounded-2xl bg-black/25 border border-white/15 backdrop-blur-sm">
              <Lock className="w-4 h-4 text-white/60 shrink-0" />
              <input
                type="text"
                value={giftCode}
                onChange={(e) => setGiftCode(e.target.value.toUpperCase())}
                placeholder="Enter your gift code"
                className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-white/55 focus:outline-none uppercase"
              />
              <button
                type="button"
                onClick={handlePaste}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#F5C358] text-xs font-bold transition cursor-pointer"
              >
                Paste
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-2xl gold-cta-gradient text-[#2C1B02] font-display font-extrabold text-base flex items-center justify-center gap-2 shadow-lg hover:brightness-105 active:scale-[0.99] transition disabled:opacity-60 cursor-pointer"
            >
              <Trophy className="w-4 h-4" />
              <span>{submitting ? 'Validating...' : 'Claim Now'}</span>
            </button>

            <p className="text-center text-xs text-white/80">
              {data?.isUnlocked ? (
                <span>
                  Treasure box <strong className="text-[#F5C358]">unlocked</strong> — enter an active
                  gift code above
                </span>
              ) : (
                <span>
                  Buy any plan to <strong className="text-[#F5C358]">unlock</strong> the treasure box
                </span>
              )}
            </p>
          </form>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-3.5 sm:px-6 -mt-6 space-y-4 relative z-10">
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

        {/* 3 Stat Cards */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="bg-white rounded-2xl card-mint-border p-3 text-center">
            <div className="font-display font-extrabold text-lg sm:text-xl text-[#DF9B2D] tabular-nums">
              {formatINR(data?.totalWon ?? 0)}
            </div>
            <div className="text-[11px] text-[#6B8275] font-medium mt-0.5">Total won</div>
          </div>

          <div className="bg-white rounded-2xl card-mint-border p-3 text-center">
            <div className="font-display font-extrabold text-lg sm:text-xl text-[#17231C] tabular-nums">
              {formatINR(data?.balance ?? 0)}
            </div>
            <div className="text-[11px] text-[#6B8275] font-medium mt-0.5">Your balance</div>
          </div>

          <div className="bg-white rounded-2xl card-mint-border p-3 text-center">
            <div className="font-display font-extrabold text-lg sm:text-xl text-[#17231C] tabular-nums">
              {data?.codesUsed ?? 0}
            </div>
            <div className="text-[11px] text-[#6B8275] font-medium mt-0.5">Codes used</div>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-[#EBF7F0] rounded-[22px] border border-[#CCEAD9] p-4 flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#004D27] text-white flex items-center justify-center shrink-0">
            {data?.isUnlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-sm text-[#17231C]">
              {data?.isUnlocked ? 'Treasure box is unlocked' : 'Treasure box is locked'}
            </h2>
            <p className="mt-1 text-xs text-[#4C6356] leading-relaxed">
              {data?.isUnlocked
                ? 'Your account has an active plan. Gift codes redeemed here are validated server-side and credited directly to your wallet.'
                : 'Activate any plan to unlock plan-exclusive gift codes. Community open codes may also be redeemed when available.'}
            </p>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#004D27] text-white text-xs font-bold hover:brightness-110 transition cursor-pointer"
            >
              <span>Browse plans</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Recent Rewards */}
        <div>
          <h3 className="font-display font-bold text-sm text-[#FFD970] mb-2 px-1">
            Recent rewards
          </h3>
          {loading ? (
            <div className="bg-white rounded-[22px] card-mint-border p-6 text-center text-xs text-[#6B8275]">
              Loading reward history...
            </div>
          ) : !data || data.rewards.length === 0 ? (
            <div className="bg-white rounded-[22px] card-mint-border p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#E7F7EE] text-[#008C45] flex items-center justify-center mx-auto">
                <Gift className="w-6 h-6" />
              </div>
              <div className="mt-3 font-display font-bold text-sm text-[#17231C]">
                No rewards yet
              </div>
              <p className="mt-1 text-xs text-[#6B8275]">
                Redeem a gift code and it will show up here.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-[22px] card-mint-border divide-y divide-[#EDF7F1]">
              {data.rewards.map((rw) => (
                <div key={rw.id} className="px-4 py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-mono-num font-bold text-sm text-[#17231C]">{rw.code}</div>
                    <div className="text-xs text-[#6B8275]">{formatDateTime(rw.created_at)}</div>
                  </div>
                  <div className="font-display font-extrabold text-base text-[#008C45] tabular-nums">
                    +{formatINR(rw.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
