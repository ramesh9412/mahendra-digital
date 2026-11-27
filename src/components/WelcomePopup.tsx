import React from 'react';
import { Send, X } from 'lucide-react';
import { formatINR } from '../lib/api';
import type { SiteSettings } from '../types';
import { MAHENDRA_BANNER_SRC, MAHENDRA_LOGO_SRC } from './BrandVisuals';

interface WelcomePopupProps {
  settings: SiteSettings;
  onClose: () => void;
}

export const WelcomePopup: React.FC<WelcomePopupProps> = ({ settings, onClose }) => {
  const safeTelegramUrl =
    settings.telegramLink && /^https?:\/\//i.test(settings.telegramLink)
      ? settings.telegramLink
      : 'https://t.me/mahendra_platform';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-popup-heading"
    >
      <div className="relative w-full max-w-[400px] rounded-[28px] p-[3px] bg-gradient-to-b from-[#16B85D] via-[#008C45] to-[#005B32] shadow-2xl">
        <div className="relative bg-white rounded-[25px] overflow-hidden">
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close welcome notice"
            className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full brand-gradient text-white flex items-center justify-center shadow-md border-2 border-white hover:scale-105 transition-transform cursor-pointer"
          >
            <X className="w-5 h-5" strokeWidth={2.6} />
          </button>

          {/* Top promotional banner image + overlapping logo */}
          <div className="relative">
            <img
              src={MAHENDRA_BANNER_SRC}
              alt={`${settings.siteName} banner`}
              referrerPolicy="no-referrer"
              className="w-full h-36 object-cover object-center block"
            />
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-[#004A24] border-2 border-white shadow-lg overflow-hidden">
              <img
                src={MAHENDRA_LOGO_SRC}
                alt={`${settings.siteName} emblem`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Body content */}
          <div className="px-4 pt-8 pb-5 text-center">
            <h2
              id="welcome-popup-heading"
              className="font-display font-extrabold text-2xl text-[#17231C] tracking-tight text-balance"
            >
              Welcome to <span className="text-[#008C45]">{settings.siteName}</span>
            </h2>
            <p className="mt-1 text-xs sm:text-sm font-medium text-[#3D5246]">
              {settings.popupSubtitle || 'Explore structured surface plans and portfolio projections'}
            </p>

            {/* Min Recharge & Min Withdraw */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl overflow-hidden border border-[#CBEBD7] shadow-sm">
                <div className="brand-gradient py-1.5 px-2 text-[11px] font-bold text-white tracking-wide">
                  MIN RECHARGE
                </div>
                <div className="bg-[#ECFBF2] py-2 font-display font-extrabold text-xl text-[#17231C] tabular-nums">
                  {formatINR(settings.minRecharge)}
                </div>
              </div>
              <div className="rounded-xl overflow-hidden border border-[#CBEBD7] shadow-sm">
                <div className="brand-gradient py-1.5 px-2 text-[11px] font-bold text-white tracking-wide">
                  MIN WITHDRAW
                </div>
                <div className="bg-[#ECFBF2] py-2 font-display font-extrabold text-xl text-[#17231C] tabular-nums">
                  {formatINR(settings.minWithdraw)}
                </div>
              </div>
            </div>

            {/* Withdraw Time */}
            <div className="mt-2.5 rounded-full bg-[#E9FAEF] border border-[#BDE7CD] px-4 py-2 flex items-center justify-between text-xs sm:text-sm font-bold text-[#17231C]">
              <span className="tracking-wide text-[#005B32]">WITHDRAW TIME</span>
              <span className="font-mono-num text-[#17231C]">{settings.withdrawTimeWindow}</span>
            </div>

            {/* Team Commission */}
            <div className="mt-3.5 flex items-center justify-center gap-2">
              <span className="h-[2px] flex-1 bg-gradient-to-r from-transparent to-[#008C45]/50 rounded-full" />
              <span className="text-xs font-extrabold tracking-wider text-[#17231C]">
                TEAM COMMISSION
              </span>
              <span className="h-[2px] flex-1 bg-gradient-to-l from-transparent to-[#008C45]/50 rounded-full" />
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {[
                { label: 'LEVEL 1', rate: settings.commissionLv1 },
                { label: 'LEVEL 2', rate: settings.commissionLv2 },
                { label: 'LEVEL 3', rate: settings.commissionLv3 },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-[#BFE6CE] bg-gradient-to-b from-white to-[#DFF6E8] py-2 px-1.5 shadow-xs"
                >
                  <div className="text-[10px] font-bold text-[#005B32]">{item.label}</div>
                  <div className="mt-0.5 font-display font-extrabold text-xl text-[#17231C] tabular-nums">
                    {item.rate}%
                  </div>
                </div>
              ))}
            </div>

            {/* Join Telegram Channel CTA */}
            <a
              href={safeTelegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full min-h-[46px] rounded-full brand-gradient text-white font-display font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-[#008C45]/25 hover:brightness-105 active:scale-[0.99] transition"
            >
              <span className="w-6 h-6 rounded-full bg-white text-[#008C45] flex items-center justify-center">
                <Send className="w-3.5 h-3.5 -ml-0.5" />
              </span>
              Join Telegram Channel
            </a>

            <button
              type="button"
              onClick={onClose}
              className="mt-2.5 text-xs font-medium text-[#5A7264] hover:text-[#17231C] cursor-pointer py-1 px-3"
            >
              Continue to Platform
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
