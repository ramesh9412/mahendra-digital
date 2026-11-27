import React from 'react';

export const MAHENDRA_LOGO_SRC = '/assets/aistudio/Mahendra_Gold_Growth_Emblem_94d73462.png';
export const MAHENDRA_BANNER_SRC = '/assets/aistudio/Mahendra_Investment_Growth_Banner_a3608024.png';

export const BrandLogo: React.FC<{
  siteName: string;
  compact?: boolean;
  light?: boolean;
}> = ({ siteName, compact = false, light = false }) => {
  return (
    <div className="inline-flex items-center gap-2.5 shrink-0">
      <div className="w-9 h-9 rounded-full overflow-hidden shadow-sm border border-[#D5EFE0] bg-[#004A24] shrink-0">
        <img
          src={MAHENDRA_LOGO_SRC}
          alt={`${siteName} logo`}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover scale-105"
        />
      </div>
      {!compact && (
        <div className="leading-none flex items-center">
          <span
            className={`font-display font-extrabold tracking-[0.06em] uppercase text-base sm:text-lg ${
              light ? 'text-white' : 'text-[#005B32]'
            }`}
          >
            {siteName}
          </span>
        </div>
      )}
    </div>
  );
};

export const TreasureGiftBoxSvg: React.FC<{ className?: string }> = ({ className = 'w-14 h-14' }) => (
  <svg viewBox="0 0 120 120" className={className} fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="giftBody" x1="20" y1="45" x2="100" y2="110" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#1DB954" />
        <stop offset="100%" stopColor="#005B32" />
      </linearGradient>
      <linearGradient id="giftLid" x1="15" y1="30" x2="105" y2="55" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#2CD667" />
        <stop offset="100%" stopColor="#007A3D" />
      </linearGradient>
      <linearGradient id="goldRibbon" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFE17D" />
        <stop offset="50%" stopColor="#F0AF2A" />
        <stop offset="100%" stopColor="#B8740C" />
      </linearGradient>
    </defs>
    {/* Soft drop shadow */}
    <ellipse cx="60" cy="108" rx="38" ry="7" fill="#00381D" fillOpacity="0.32" />
    {/* Box Base */}
    <rect x="22" y="48" width="76" height="56" rx="8" fill="url(#giftBody)" stroke="#0A7B3E" strokeWidth="1.5" />
    {/* Side facet highlight */}
    <rect x="22" y="48" width="38" height="56" rx="8" fill="#FFFFFF" fillOpacity="0.06" />
    {/* Vertical Gold Ribbon */}
    <rect x="52" y="48" width="16" height="56" fill="url(#goldRibbon)" />
    {/* Horizontal Gold Ribbon */}
    <rect x="22" y="70" width="76" height="12" fill="url(#goldRibbon)" />
    {/* Lid */}
    <rect x="16" y="34" width="88" height="18" rx="6" fill="url(#giftLid)" stroke="#38E276" strokeWidth="1" />
    <rect x="52" y="34" width="16" height="18" fill="url(#goldRibbon)" />
    {/* Gold Bow Loops */}
    <path
      d="M60 35C51 20 32 16 32 27C32 34 45 36 60 35Z"
      fill="url(#goldRibbon)"
      stroke="#FFE99D"
      strokeWidth="1.2"
    />
    <path
      d="M60 35C69 20 88 16 88 27C88 34 75 36 60 35Z"
      fill="url(#goldRibbon)"
      stroke="#FFE99D"
      strokeWidth="1.2"
    />
    {/* Bow tails */}
    <path d="M55 35L44 47L51 48L59 38Z" fill="#DF9B2D" />
    <path d="M65 35L76 47L69 48L61 38Z" fill="#DF9B2D" />
    {/* Center knot */}
    <circle cx="60" cy="34" r="6.5" fill="#FFE17D" stroke="#C78214" strokeWidth="1.5" />
  </svg>
);

export const ProductArtwork: React.FC<{
  imageKey: string;
  locked?: boolean;
  title: string;
}> = ({ imageKey, locked = false, title }) => {
  const palettes: Record<
    string,
    { bg: string; panels: string[]; grain: string; accent: string }
  > = {
    walnut: {
      bg: '#EEF7F1',
      panels: ['#5C3317', '#D6A874', '#4B5563', '#E8DCCB', '#8B4513'],
      grain: '#3B1E0B',
      accent: '#008C45',
    },
    oak: {
      bg: '#E8F3EC',
      panels: ['#8A6240', '#C49A6C', '#6E5A47', '#D9C8B2'],
      grain: '#573B23',
      accent: '#007A3D',
    },
    curved: {
      bg: '#E9F4EE',
      panels: ['#5E3A24', '#4F5D5E', '#D5C3AE', '#854D27'],
      grain: '#3E2616',
      accent: '#008C45',
    },
    slate: {
      bg: '#EAF2EE',
      panels: ['#472B19', '#B98D5B', '#374151', '#E2DDD5', '#73391D'],
      grain: '#1F2937',
      accent: '#005B32',
    },
    acoustic: {
      bg: '#E5EFE9',
      panels: ['#3E2723', '#5D4037', '#263238', '#8D6E63'],
      grain: '#211512',
      accent: '#008C45',
    },
    marble: {
      bg: '#EDF5F0',
      panels: ['#6B4423', '#9A6F46', '#334155', '#1E293B', '#F3EFE6'],
      grain: '#D4AF37',
      accent: '#006B35',
    },
  };

  const p = palettes[imageKey] ?? palettes.walnut;

  return (
    <div
      className="relative w-full h-full rounded-xl overflow-hidden select-none"
      style={{ backgroundColor: p.bg }}
      aria-label={title}
    >
      <svg viewBox="0 0 180 150" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`floor-${imageKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DDEFE5" />
            <stop offset="100%" stopColor="#C4E0D0" />
          </linearGradient>
        </defs>
        {/* Architectural studio background */}
        <rect width="180" height="150" fill={p.bg} />
        <rect x="0" y="114" width="180" height="36" fill={`url(#floor-${imageKey})`} />
        {/* Window daylight beam */}
        <polygon points="120,0 180,0 180,114 96,114" fill="#FFFFFF" fillOpacity="0.45" />
        {/* Vertical architectural surface panels */}
        {p.panels.map((color, idx) => {
          const w = Math.floor(124 / p.panels.length);
          const x = 28 + idx * (w + 3);
          const y = 18 + (idx % 2 === 0 ? 0 : 5);
          const h = 104 - (idx % 2 === 0 ? 0 : 4);
          return (
            <g key={idx}>
              <rect x={x} y={y} width={w} height={h} rx="2" fill={color} />
              <line
                x1={x + w * 0.35}
                y1={y + 4}
                x2={x + w * 0.35}
                y2={y + h - 4}
                stroke={p.grain}
                strokeOpacity="0.22"
                strokeWidth="1.2"
              />
              <line
                x1={x + w * 0.7}
                y1={y + 8}
                x2={x + w * 0.7}
                y2={y + h - 6}
                stroke="#FFFFFF"
                strokeOpacity="0.16"
                strokeWidth="1"
              />
            </g>
          );
        })}
        {/* Subtle foliage corner accent */}
        <circle cx="16" cy="126" r="14" fill="#008C45" fillOpacity="0.16" />
        <path d="M12 132c3-10 9-14 14-16-2 7-5 13-14 16Z" fill="#008C45" fillOpacity="0.5" />
      </svg>

      {locked && (
        <div className="absolute inset-0 bg-[#0F2419]/35 backdrop-blur-[1px] flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/85 shadow-md flex items-center justify-center text-[#005B32]">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export const HeroPromotionalBanner: React.FC<{
  siteName: string;
  headline: string;
  subtitle: string;
  badgeText?: string;
  rightSlot?: React.ReactNode;
  centerBadge?: boolean;
}> = ({ siteName, headline, rightSlot, centerBadge = false }) => {
  return (
    <div className="relative w-full overflow-hidden bg-[#003E1F]">
      <img
        src={MAHENDRA_BANNER_SRC}
        alt={`${siteName} — ${headline}`}
        referrerPolicy="no-referrer"
        className="w-full h-[200px] sm:h-[260px] md:h-[300px] object-cover object-center block"
      />

      {rightSlot && <div className="absolute top-3 right-3 z-20">{rightSlot}</div>}

      {/* Center overlapping emblem used on Login / Register screens */}
      {centerBadge && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20">
          <div className="w-18 h-18 rounded-full bg-[#004A24] p-0.5 shadow-xl border-2 border-white overflow-hidden">
            <img
              src={MAHENDRA_LOGO_SRC}
              alt={`${siteName} emblem`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};
