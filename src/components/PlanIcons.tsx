import React from 'react';

export const PlanIcon: React.FC<{ iconKey: string; className?: string }> = ({
  iconKey,
  className = 'w-9 h-9',
}) => {
  switch (iconKey) {
    // 1. SILVER PLAN – Silver Shield
    case 'silver_shield':
      return (
        <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="silvSh" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="50%" stopColor="#CBD5E1" />
              <stop offset="100%" stopColor="#64748B" />
            </linearGradient>
          </defs>
          <path
            d="M24 5L9 11v12c0 10.2 6.4 17.5 15 20 8.6-2.5 15-9.8 15-20V11L24 5Z"
            fill="url(#silvSh)"
            stroke="#E2E8F0"
            strokeWidth="1.5"
          />
          <path
            d="M24 9.5L13 14v9c0 7.7 4.6 13.4 11 15.6V9.5Z"
            fill="#FFFFFF"
            fillOpacity="0.28"
          />
          <path
            d="M19 23.5l3.5 3.5 7-7.5"
            stroke="#064E3B"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    // 2. GOLD PLAN – Golden Medal
    case 'golden_medal':
      return (
        <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="goldMed" x1="10" y1="12" x2="38" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFF0A8" />
              <stop offset="50%" stopColor="#F0B429" />
              <stop offset="100%" stopColor="#9C650C" />
            </linearGradient>
          </defs>
          <path d="M16 5h7l3 11h-7L16 5Z" fill="#10B981" />
          <path d="M32 5h-7l-3 11h7L32 5Z" fill="#059669" />
          <circle cx="24" cy="28" r="14" fill="url(#goldMed)" stroke="#FFE99D" strokeWidth="1.5" />
          <circle cx="24" cy="28" r="10.2" stroke="#78350F" strokeOpacity="0.35" strokeWidth="1.2" />
          <path
            d="M24 21l2.2 4.5 5 .7-3.6 3.5.9 4.9-4.5-2.3-4.5 2.3.9-4.9-3.6-3.5 5-.7L24 21Z"
            fill="#FFFBEB"
          />
        </svg>
      );

    // 3. PLATINUM PLAN – Platinum Crown
    case 'platinum_crown':
      return (
        <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="platCr" x1="6" y1="12" x2="42" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="48%" stopColor="#D8E3EC" />
              <stop offset="100%" stopColor="#7C8FA1" />
            </linearGradient>
          </defs>
          <path
            d="M7 33L10 15l9 8 5-11 5 11 9-8 3 18H7Z"
            fill="url(#platCr)"
            stroke="#F1F5F9"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <rect x="8" y="34.5" width="32" height="5" rx="2.5" fill="#94A3B8" stroke="#E2E8F0" strokeWidth="1" />
          <circle cx="24" cy="10" r="2.3" fill="#34D399" />
          <circle cx="10" cy="14" r="1.9" fill="#E2E8F0" />
          <circle cx="38" cy="14" r="1.9" fill="#E2E8F0" />
        </svg>
      );

    // 4. DIAMOND PLAN – Diamond Crystal
    case 'diamond_crystal':
      return (
        <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="diaCry" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="45%" stopColor="#BAE6FD" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
          </defs>
          <polygon points="14,10 34,10 42,20 24,41 6,20" fill="url(#diaCry)" stroke="#E0F2FE" strokeWidth="1.4" />
          <polygon points="14,10 24,20 34,10" fill="#FFFFFF" fillOpacity="0.65" />
          <polygon points="17,20 31,20 24,41" fill="#0284C7" fillOpacity="0.28" />
          <line x1="6" y1="20" x2="42" y2="20" stroke="#FFFFFF" strokeWidth="1.2" />
        </svg>
      );

    // 5. BLUE DIAMOND – Blue Diamond
    case 'blue_diamond':
      return (
        <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="blueDia" x1="10" y1="8" x2="38" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#93C5FD" />
              <stop offset="50%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1E3A8A" />
            </linearGradient>
          </defs>
          <polygon points="13,9 35,9 43,20 24,42 5,20" fill="url(#blueDia)" stroke="#BFDBFE" strokeWidth="1.5" />
          <polygon points="13,9 24,20 35,9" fill="#DBEAFE" fillOpacity="0.55" />
          <polygon points="16,20 32,20 24,42" fill="#1D4ED8" fillOpacity="0.55" />
          <polygon points="5,20 16,20 24,42" fill="#60A5FA" fillOpacity="0.3" />
          <line x1="5" y1="20" x2="43" y2="20" stroke="#DBEAFE" strokeWidth="1.1" />
        </svg>
      );

    // 6. BLACK DIAMOND – Black Diamond
    case 'black_diamond':
      return (
        <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="blkDia" x1="8" y1="8" x2="40" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4B5563" />
              <stop offset="45%" stopColor="#1F2937" />
              <stop offset="100%" stopColor="#030712" />
            </linearGradient>
          </defs>
          <polygon points="13,9 35,9 43,20 24,42 5,20" fill="url(#blkDia)" stroke="#F5C358" strokeWidth="1.5" />
          <polygon points="13,9 24,20 35,9" fill="#9CA3AF" fillOpacity="0.4" />
          <polygon points="16,20 32,20 24,42" fill="#111827" fillOpacity="0.8" />
          <line x1="5" y1="20" x2="43" y2="20" stroke="#F5C358" strokeOpacity="0.65" strokeWidth="1.1" />
        </svg>
      );

    // 7. ROYAL DIAMOND – Royal Crown
    case 'royal_crown':
      return (
        <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="royCr" x1="6" y1="10" x2="42" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFE88D" />
              <stop offset="55%" stopColor="#E6A825" />
              <stop offset="100%" stopColor="#9A6008" />
            </linearGradient>
          </defs>
          <path
            d="M6 34L9 14l9.5 8L24 9l5.5 13L39 14l3 20H6Z"
            fill="url(#royCr)"
            stroke="#FFF3B0"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <rect x="7" y="35.5" width="34" height="5" rx="2.5" fill="#B45309" stroke="#FDE68A" strokeWidth="1" />
          <circle cx="24" cy="26" r="3" fill="#10B981" stroke="#FEF08A" strokeWidth="1" />
          <circle cx="15" cy="28" r="2" fill="#FEF08A" />
          <circle cx="33" cy="28" r="2" fill="#FEF08A" />
        </svg>
      );

    // 8. SILVER VIP – Silver VIP Shield
    case 'silver_vip_shield':
      return (
        <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="silVip" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#CBD5E1" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
          </defs>
          <path
            d="M24 5L8 11v12c0 10.5 6.8 18 16 20.5C33.2 41 40 33.5 40 23V11L24 5Z"
            fill="url(#silVip)"
            stroke="#F5C358"
            strokeWidth="1.8"
          />
          <rect x="13" y="18.5" width="22" height="10" rx="5" fill="#064E3B" stroke="#F5C358" strokeWidth="1.2" />
          <text
            x="24"
            y="25.5"
            textAnchor="middle"
            fill="#FFE17D"
            fontSize="7.5"
            fontWeight="800"
            fontFamily="sans-serif"
          >
            VIP
          </text>
        </svg>
      );

    // 9. GOLD VIP – Golden VIP Star
    case 'golden_vip_star':
      return (
        <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="goldVip" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFF5B8" />
              <stop offset="50%" stopColor="#F5B82E" />
              <stop offset="100%" stopColor="#9A5B06" />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="19" fill="#04391E" stroke="#F5C358" strokeWidth="1.8" />
          <path
            d="M24 8l4.6 9.3 10.2 1.5-7.4 7.2 1.8 10.2L24 31.4l-9.2 4.8 1.8-10.2-7.4-7.2 10.2-1.5L24 8Z"
            fill="url(#goldVip)"
            stroke="#FFFBEB"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
          <text
            x="24"
            y="26.2"
            textAnchor="middle"
            fill="#03311A"
            fontSize="6.8"
            fontWeight="900"
            fontFamily="sans-serif"
          >
            VIP
          </text>
        </svg>
      );

    // 10. DIAMOND VIP – Premium Diamond Crown
    case 'premium_diamond_crown':
    default:
      return (
        <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="premCr" x1="6" y1="12" x2="42" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFF2A6" />
              <stop offset="50%" stopColor="#EBB02D" />
              <stop offset="100%" stopColor="#9C6108" />
            </linearGradient>
          </defs>
          {/* Top floating faceted diamond */}
          <polygon points="19,5 29,5 32,10 24,16 16,10" fill="#7DD3FC" stroke="#FFFFFF" strokeWidth="1.2" />
          <path
            d="M6 35L9 17l9.5 7L24 14l5.5 10L39 17l3 18H6Z"
            fill="url(#premCr)"
            stroke="#FFF7CC"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <rect x="7" y="36.5" width="34" height="5" rx="2.5" fill="#064E3B" stroke="#F5C358" strokeWidth="1.3" />
          <text
            x="24"
            y="32"
            textAnchor="middle"
            fill="#03311A"
            fontSize="6.5"
            fontWeight="900"
            fontFamily="sans-serif"
          >
            VIP
          </text>
        </svg>
      );
  }
};
