import React from 'react';
import {
  ArrowDownToLine,
  Bell,
  Building2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Crown,
  Gift,
  Headphones,
  LogOut,
  Pencil,
  ReceiptText,
  Settings,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { MAHENDRA_LOGO_SRC } from '../components/BrandVisuals';
import {
  TELEGRAM_SUPPORT_URL,
  TELEGRAM_SUPPORT_USERNAME,
} from '../components/TelegramSupport';
import { formatINR } from '../lib/api';
import type { MainTab, MeResponse, SiteSettings } from '../types';

interface ProfilePageProps {
  me: MeResponse;
  settings: SiteSettings;
  onNavigate: (tab: MainTab) => void;
  onLogout: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  me,
  settings,
  onNavigate,
  onLogout,
}) => {
  return (
    <div className="pb-24 lg:pb-10">
      {/* Green Gradient Header */}
      <div className="brand-header-gradient text-white pt-4 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="font-display font-bold text-lg">Profile</h1>
            <button
              type="button"
              onClick={() => onNavigate('personal-info')}
              aria-label="Account Settings"
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => onNavigate('personal-info')}
              className="relative w-16 h-16 rounded-full bg-white p-0.5 shadow-md shrink-0 cursor-pointer"
            >
              <img
                src={MAHENDRA_LOGO_SRC}
                alt={settings.siteName}
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-full object-cover"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-white text-[#008C45] flex items-center justify-center shadow border border-[#D5EFE0]">
                <Pencil className="w-3 h-3" />
              </span>
            </button>

            <div className="min-w-0">
              <div className="font-display font-extrabold text-lg truncate">
                {me.profile.username}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#F5C358]/90 to-[#B8E6C9]/90 text-[#17231C] text-[11px] font-extrabold">
                  <Crown className="w-3 h-3" />
                  VIP{me.profile.vipLevel}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/15 text-white text-[11px] font-mono-num">
                  ID {me.user.maskedPhone}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlapping Content */}
      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 -mt-10 space-y-4 relative z-10">
        {/* Available Balance Card */}
        <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5">
          <div className="text-[11px] font-bold tracking-wider uppercase text-[#7B9184]">
            Available Balance
          </div>
          <div className="mt-1 font-display font-extrabold text-3xl text-[#17231C] tabular-nums">
            {formatINR(me.profile.availableBalance)}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#EBF7F0] border border-[#D8EEE1] p-3">
              <div className="text-xs text-[#546B5E] font-medium">Total recharge</div>
              <div className="mt-1 font-display font-extrabold text-base text-[#008C45] tabular-nums">
                {formatINR(me.profile.totalRecharge)}
              </div>
            </div>
            <div className="rounded-2xl bg-[#EBF7F0] border border-[#D8EEE1] p-3">
              <div className="text-xs text-[#546B5E] font-medium">Total income</div>
              <div className="mt-1 font-display font-extrabold text-base text-[#008C45] tabular-nums">
                {formatINR(me.profile.totalIncome)}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Menu (Orders, Gift, About, Bank Card) */}
        <div className="bg-white rounded-[24px] card-mint-border p-4 grid grid-cols-4 gap-2 text-center">
          {[
            { id: 'orders' as MainTab, label: 'Orders', icon: ClipboardList },
            { id: 'treasure' as MainTab, label: 'Gift', icon: Gift },
            { id: 'about' as MainTab, label: 'About', icon: Building2 },
            { id: 'bank-cards' as MainTab, label: 'Bank Card', icon: CreditCard },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="flex flex-col items-center justify-center gap-1.5 py-2 rounded-xl hover:bg-[#F4FAF7] transition cursor-pointer"
              >
                <div className="w-11 h-11 rounded-2xl brand-gradient text-white flex items-center justify-center shadow-sm">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-[#17231C]">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Account Menu */}
        <div className="bg-white rounded-[24px] card-mint-border p-4 sm:p-5">
          <div className="pb-2 mb-1">
            <h2 className="font-display font-extrabold text-base text-[#17231C] inline-block border-b-2 border-[#008C45] pb-1">
              Account
            </h2>
          </div>

          <div className="divide-y divide-[#EDF7F1]">
            {[
              {
                id: 'personal-info' as MainTab,
                title: 'Personal Information',
                desc: 'Name, password and security',
                icon: UserCheck,
              },
              {
                id: 'balance-details' as MainTab,
                title: 'Balance Details',
                desc: 'Every credit and debit',
                icon: ReceiptText,
              },
              {
                id: 'withdrawal-details' as MainTab,
                title: 'Withdrawal Details',
                desc: 'Payout requests and status',
                icon: ArrowDownToLine,
              },
              {
                id: 'notifications' as MainTab,
                title: 'Notification Center',
                desc:
                  me.unreadNotificationsCount > 0
                    ? `${me.unreadNotificationsCount} unread alerts`
                    : 'Announcements and alerts',
                icon: Bell,
              },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onNavigate(row.id)}
                  className="w-full py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F8FCFA] rounded-xl px-1 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#E7F7EE] text-[#008C45] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-bold text-sm text-[#17231C]">
                        {row.title}
                      </div>
                      <div className="text-xs text-[#7B9184] truncate">{row.desc}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#9BB0A3] shrink-0" />
                </button>
              );
            })}

            <a
              href={TELEGRAM_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F8FCFA] rounded-xl px-1 transition cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#03361C] border border-[#D4AF37]/70 text-[#FFE27A] flex items-center justify-center shrink-0">
                  <Headphones className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm text-[#17231C]">
                    Help &amp; Support
                  </div>
                  <div className="text-xs text-[#008C45] font-medium truncate">
                    Official Telegram Support ({TELEGRAM_SUPPORT_USERNAME})
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9BB0A3] shrink-0" />
            </a>
          </div>
        </div>

        {/* Admin Console Link */}
        <button
          type="button"
          onClick={() => onNavigate('admin')}
          className="w-full bg-white rounded-[22px] card-mint-border p-4 flex items-center justify-between gap-3 text-left hover:bg-[#F8FCFA] transition cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E7F7EE] text-[#005B32] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-bold text-sm text-[#17231C]">Admin Dashboard</div>
              <div className="text-xs text-[#7B9184]">
                Manage {settings.siteName} products, approvals &amp; settings
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#9BB0A3]" />
        </button>

        {/* Logout Card */}
        <button
          type="button"
          onClick={onLogout}
          className="w-full bg-white rounded-[22px] card-mint-border p-4 flex items-center justify-between gap-3 text-left hover:bg-red-50/40 transition cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E7F7EE] text-[#008C45] flex items-center justify-center shrink-0">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-bold text-sm text-[#008C45]">Logout</div>
              <div className="text-xs text-[#7B9184]">Sign out of this device</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#9BB0A3]" />
        </button>
      </div>
    </div>
  );
};
