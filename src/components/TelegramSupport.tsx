import React from 'react';
import { Send } from 'lucide-react';

export const TELEGRAM_SUPPORT_USERNAME = '@CustomersHelpCare';
export const TELEGRAM_SUPPORT_URL = 'https://t.me/CustomersHelpCare';

interface TelegramSupportButtonProps {
  label?: string;
  className?: string;
}

export const TelegramSupportButton: React.FC<TelegramSupportButtonProps> = ({
  label = 'CONTACT SUPPORT ON TELEGRAM',
  className = '',
}) => (
  <a
    href={TELEGRAM_SUPPORT_URL}
    target="_blank"
    rel="noopener noreferrer"
    className={`w-full min-h-[48px] px-5 py-3 rounded-full bg-gradient-to-b from-[#044122] via-[#022C17] to-[#011B0E] border-[1.5px] border-[#D4AF37] text-[#FFE27A] font-display font-extrabold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2.5 shadow-lg shadow-[#011B0E]/40 hover:brightness-110 hover:scale-[1.01] active:scale-[0.98] transition ${className}`}
  >
    <span className="w-6 h-6 rounded-full bg-[#0A6B38] border border-[#D4AF37]/70 text-[#FFE27A] flex items-center justify-center shrink-0">
      <Send className="w-3.5 h-3.5 -ml-0.5" />
    </span>
    <span>{label}</span>
  </a>
);

export const FloatingTelegramSupport: React.FC = () => (
  <a
    href={TELEGRAM_SUPPORT_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={`Contact Support on Telegram (${TELEGRAM_SUPPORT_USERNAME})`}
    title={`Official Support: ${TELEGRAM_SUPPORT_USERNAME}`}
    className="fixed right-3.5 bottom-[76px] lg:bottom-6 lg:right-6 z-40 h-11 px-3.5 rounded-full bg-gradient-to-b from-[#044122] via-[#022C17] to-[#011B0E] border-[1.5px] border-[#D4AF37] text-[#FFE27A] font-display font-extrabold text-xs flex items-center gap-2 shadow-xl shadow-black/35 hover:brightness-110 hover:scale-105 active:scale-95 transition"
  >
    <Send className="w-4 h-4 shrink-0 text-[#FFD970]" />
    <span>Support</span>
  </a>
);
