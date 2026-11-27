import React from 'react';
import { Home, ShieldCheck, User, UserPlus, Users } from 'lucide-react';
import type { MainTab } from '../types';
import { BrandLogo, TreasureGiftBoxSvg } from './BrandVisuals';

interface NavProps {
  activeTab: MainTab;
  onNavigate: (tab: MainTab) => void;
  siteName: string;
  balance: number;
}

export const DesktopTopBar: React.FC<NavProps> = ({ activeTab, onNavigate, siteName }) => {
  const links: { id: MainTab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'invite', label: 'Invite' },
    { id: 'treasure', label: 'Treasure Box' },
    { id: 'team', label: 'Team' },
    { id: 'profile', label: 'Profile' },
  ];

  return (
    <header className="hidden lg:flex items-center justify-between gap-8 px-6 h-16 bg-white/95 backdrop-blur-md border-b border-[#DCEEE3] sticky top-0 z-30">
      <button
        type="button"
        onClick={() => onNavigate('home')}
        className="cursor-pointer whitespace-nowrap shrink-0"
      >
        <BrandLogo siteName={siteName} />
      </button>

      <nav className="flex items-center gap-6">
        {links.map((item) => {
          const isActive =
            activeTab === item.id ||
            (item.id === 'profile' &&
              [
                'orders',
                'bank-cards',
                'personal-info',
                'balance-details',
                'withdrawal-details',
                'notifications',
                'about',
              ].includes(activeTab));
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 ${
                isActive
                  ? 'text-[#008C45] border-[#008C45]'
                  : 'text-[#526A5C] border-transparent hover:text-[#17231C]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => onNavigate('admin')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#005B32] bg-[#E7F7EE] hover:bg-[#D5EFE0] transition whitespace-nowrap cursor-pointer"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Admin
        </button>
        <button
          type="button"
          onClick={() => onNavigate('recharge')}
          className="px-4 py-2 rounded-xl brand-gradient text-white text-xs font-bold shadow-sm hover:brightness-105 transition whitespace-nowrap cursor-pointer"
        >
          Recharge Wallet
        </button>
      </div>
    </header>
  );
};

export const BottomNav: React.FC<{
  activeTab: MainTab;
  onNavigate: (tab: MainTab) => void;
}> = ({ activeTab, onNavigate }) => {
  const isProfileGroup = [
    'profile',
    'orders',
    'bank-cards',
    'personal-info',
    'balance-details',
    'withdrawal-details',
    'notifications',
    'about',
  ].includes(activeTab);

  return (
    <nav
      aria-label="Primary Bottom Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#DCEEE3] shadow-[0_-4px_24px_rgba(0,91,50,0.08)] pb-safe"
    >
      <div className="max-w-[540px] mx-auto grid grid-cols-5 items-end h-[62px] px-1">
        {/* Position 1: Home */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex flex-col items-center justify-center h-full min-h-[44px] cursor-pointer"
        >
          <Home
            className={`w-[22px] h-[22px] transition-colors ${
              activeTab === 'home' ? 'text-[#008C45]' : 'text-[#9AAEA2]'
            }`}
            strokeWidth={activeTab === 'home' ? 2.4 : 2}
          />
          <span
            className={`text-[10px] mt-1 font-semibold tracking-tight ${
              activeTab === 'home' ? 'text-[#008C45]' : 'text-[#8C9E93]'
            }`}
          >
            Home
          </span>
        </button>

        {/* Position 2: Invite */}
        <button
          type="button"
          onClick={() => onNavigate('invite')}
          className="flex flex-col items-center justify-center h-full min-h-[44px] cursor-pointer"
        >
          <UserPlus
            className={`w-[22px] h-[22px] transition-colors ${
              activeTab === 'invite' ? 'text-[#008C45]' : 'text-[#9AAEA2]'
            }`}
            strokeWidth={activeTab === 'invite' ? 2.4 : 2}
          />
          <span
            className={`text-[10px] mt-1 font-semibold tracking-tight ${
              activeTab === 'invite' ? 'text-[#008C45]' : 'text-[#8C9E93]'
            }`}
          >
            Invite
          </span>
        </button>

        {/* Position 3: Center Overlapping Treasure Gift Box */}
        <button
          type="button"
          onClick={() => onNavigate('treasure')}
          aria-label="Open Treasure Box"
          className="relative flex flex-col items-center justify-end h-full pb-1.5 cursor-pointer group"
        >
          <div
            className={`-mt-7 transition-transform duration-200 group-active:scale-95 ${
              activeTab === 'treasure' ? 'scale-105 drop-shadow-md' : ''
            }`}
          >
            <TreasureGiftBoxSvg className="w-[62px] h-[62px]" />
          </div>
        </button>

        {/* Position 4: Team */}
        <button
          type="button"
          onClick={() => onNavigate('team')}
          className="flex flex-col items-center justify-center h-full min-h-[44px] cursor-pointer"
        >
          <Users
            className={`w-[22px] h-[22px] transition-colors ${
              activeTab === 'team' ? 'text-[#008C45]' : 'text-[#9AAEA2]'
            }`}
            strokeWidth={activeTab === 'team' ? 2.4 : 2}
          />
          <span
            className={`text-[10px] mt-1 font-semibold tracking-tight ${
              activeTab === 'team' ? 'text-[#008C45]' : 'text-[#8C9E93]'
            }`}
          >
            Team
          </span>
        </button>

        {/* Position 5: Profile */}
        <button
          type="button"
          onClick={() => onNavigate('profile')}
          className="flex flex-col items-center justify-center h-full min-h-[44px] cursor-pointer"
        >
          <User
            className={`w-[22px] h-[22px] transition-colors ${
              isProfileGroup ? 'text-[#008C45]' : 'text-[#9AAEA2]'
            }`}
            strokeWidth={isProfileGroup ? 2.4 : 2}
          />
          <span
            className={`text-[10px] mt-1 font-semibold tracking-tight ${
              isProfileGroup ? 'text-[#008C45]' : 'text-[#8C9E93]'
            }`}
          >
            Profile
          </span>
        </button>
      </div>
    </nav>
  );
};
