import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronRight,
  Copy,
  Info,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { formatDateShort, formatINR } from '../lib/api';
import { fetchMyTeam } from '../lib/supabaseApi';
import type { MainTab, MeResponse, TeamResponse } from '../types';

interface TeamPageProps {
  me: MeResponse;
  refreshSignal?: number;
  onNavigate: (tab: MainTab) => void;
}

export const TeamPage: React.FC<TeamPageProps> = ({ me, refreshSignal = 0, onNavigate }) => {
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLevel, setActiveLevel] = useState<1 | 2 | 3>(1);
  const [copied, setCopied] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchMyTeam()
      .then(setTeam)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load team details.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [me.user.id, refreshSignal]);

  const currentLevel = team?.levels.find((l) => l.level === activeLevel);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(me.user.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="pb-24 lg:pb-10">
      {/* Green Gradient Header */}
      <div className="brand-header-gradient text-white pt-4 pb-6 px-4 rounded-b-[28px]">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <span className="w-20" />
            <h1 className="font-display font-bold text-lg tracking-tight">Team</h1>
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs font-mono-num font-bold transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{me.user.referralCode}</span>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/12 border border-white/15 p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-white/85 font-medium">
                <Users className="w-3.5 h-3.5" />
                <span>Team members</span>
              </div>
              <div className="mt-1 font-display font-extrabold text-2xl tabular-nums">
                {team?.totalMembers ?? 0}
              </div>
              <div className="text-[11px] text-white/80 mt-0.5 tabular-nums">
                {team?.activeMembers ?? 0} active
              </div>
            </div>

            <div className="rounded-2xl bg-white/12 border border-white/15 p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-white/85 font-medium">
                <Wallet className="w-3.5 h-3.5" />
                <span>Team recharge</span>
              </div>
              <div className="mt-1 font-display font-extrabold text-2xl tabular-nums">
                {formatINR(team?.totalTeamRecharge ?? 0)}
              </div>
              <div className="text-[11px] text-white/80 mt-0.5">across 3 levels</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 mt-4 space-y-3.5">
        {error && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}
        {loading && !team && (
          <div className="p-3.5 rounded-2xl bg-white card-mint-border text-xs font-semibold text-[#6B8275] text-center">
            Loading team data...
          </div>
        )}
        {/* Level Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-[#E7F7EE] border border-[#D0ECDC]">
          {([1, 2, 3] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setActiveLevel(lvl)}
              className={`py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeLevel === lvl
                  ? 'brand-gradient text-white shadow-sm'
                  : 'text-[#425E4E] hover:text-[#005B32]'
              }`}
            >
              Level {lvl}
            </button>
          ))}
        </div>

        {/* Active Level Card */}
        <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5">
          <div className="flex items-center justify-between pb-3.5 border-b border-[#EDF7F1]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl brand-gradient text-white flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display font-bold text-base text-[#17231C]">
                  Level {activeLevel}
                </h2>
                <p className="text-xs text-[#6B8275]">
                  {activeLevel === 1
                    ? 'People you invite directly'
                    : activeLevel === 2
                      ? 'Invited by your Level 1 team'
                      : 'Invited by your Level 2 team'}
                </p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full bg-[#E7F7EE] text-[#008C45] font-display font-extrabold text-sm tabular-nums">
              {currentLevel?.ratePercent ?? (activeLevel === 1 ? 22 : activeLevel === 2 ? 2 : 1)}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 py-4 border-b border-[#EDF7F1]">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-[#6B8275]">
                <Users className="w-3.5 h-3.5 text-[#008C45]" />
                <span>Members</span>
              </div>
              <div className="mt-1 font-display font-extrabold text-lg text-[#17231C] tabular-nums">
                {currentLevel?.membersCount ?? 0}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs text-[#6B8275]">
                <UserCheck className="w-3.5 h-3.5 text-[#008C45]" />
                <span>Active</span>
              </div>
              <div className="mt-1 font-display font-extrabold text-lg text-[#17231C] tabular-nums">
                {currentLevel?.activeCount ?? 0}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs text-[#6B8275]">
                <Wallet className="w-3.5 h-3.5 text-[#008C45]" />
                <span>Recharge</span>
              </div>
              <div className="mt-1 font-display font-extrabold text-lg text-[#17231C] tabular-nums">
                {formatINR(currentLevel?.rechargeVolume ?? 0)}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs text-[#6B8275]">
                <TrendingUp className="w-3.5 h-3.5 text-[#008C45]" />
                <span>Commission</span>
              </div>
              <div className="mt-1 font-display font-extrabold text-lg text-[#008C45] tabular-nums">
                {formatINR(currentLevel?.commissionEarned ?? 0)}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowMembersModal(true)}
            className="mt-3.5 w-full h-11 rounded-2xl bg-[#DDF2E5] hover:bg-[#CDECD9] text-[#005B32] font-display font-bold text-sm transition cursor-pointer"
          >
            View members ({currentLevel?.membersCount ?? 0})
          </button>
        </div>

        {/* Total Income Credited */}
        <div className="bg-white rounded-[22px] card-mint-border p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-[#E7F7EE] text-[#008C45] flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-[#6B8275] font-medium">Total income credited</div>
            <div className="font-display font-extrabold text-xl text-[#17231C] tabular-nums">
              {formatINR(team?.totalCommissionCredited ?? 0)}
            </div>
          </div>
        </div>

        {/* Grow Your Team CTA */}
        <button
          type="button"
          onClick={() => onNavigate('invite')}
          className="w-full brand-gradient-horizontal text-white rounded-[22px] p-4 flex items-center justify-between shadow-lg shadow-[#008C45]/20 hover:brightness-105 transition cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-bold text-base">Grow your team</div>
              <div className="text-xs text-white/85">Share your link — earn across 3 levels</div>
            </div>
          </div>
          <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <ChevronRight className="w-4 h-4" />
          </span>
        </button>

        {/* How Team Income Works */}
        <div className="bg-[#EAF6EF] rounded-[22px] border border-[#D1ECDC] p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-[#008C45] shrink-0 mt-0.5" />
          <div>
            <h3 className="font-display font-bold text-xs text-[#17231C]">How team income works</h3>
            <p className="mt-1 text-xs text-[#4C6356] leading-relaxed">
              Applicable referral commissions are calculated server-side when a team member
              activates an eligible plan and never reduce their own plan balance. Member identities
              remain masked for privacy.
            </p>
          </div>
        </div>
      </div>

      {/* Privacy-Masked Members Drawer */}
      {showMembersModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-[28px] sm:rounded-[24px] p-5 max-h-[80vh] flex flex-col border border-[#D5EFE0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#EDF7F1]">
              <h3 className="font-display font-bold text-base text-[#17231C]">
                Level {activeLevel} Members
              </h3>
              <button
                type="button"
                onClick={() => setShowMembersModal(false)}
                className="p-1.5 rounded-full hover:bg-[#F4FAF7] text-[#5B7265] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 overflow-y-auto flex-1 space-y-2">
              {!currentLevel || currentLevel.members.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#6B8275]">
                  No members in Level {activeLevel} yet. Share your referral link to invite members.
                </div>
              ) : (
                currentLevel.members.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-[#F4FAF7] border border-[#E1F3E8] flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-display font-bold text-sm text-[#17231C]">
                        {m.username} · {m.maskedPhone}
                      </div>
                      <div className="text-[11px] text-[#6B8275]">
                        Joined {formatDateShort(m.joinedAt)}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        m.isActive
                          ? 'bg-[#DDF4E6] text-[#005B32]'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {m.isActive ? 'Active' : 'Registered'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
