import React, { useCallback, useEffect, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { BottomNav, DesktopTopBar } from './components/BottomNav';
import { BrandLogo } from './components/BrandVisuals';
import { FloatingTelegramSupport } from './components/TelegramSupport';
import { WelcomePopup } from './components/WelcomePopup';
import { apiRequest } from './lib/api';
import { AdminPage } from './pages/AdminPage';
import { HomePage } from './pages/HomePage';
import { InvitePage } from './pages/InvitePage';
import { ProfilePage } from './pages/ProfilePage';
import {
  AboutPage,
  BalanceDetailsPage,
  BankCardPage,
  NotificationsPage,
  OrdersPage,
  PersonalInfoPage,
  WithdrawalDetailsPage,
} from './pages/ProfileSubPages';
import { RechargePage } from './pages/RechargePage';
import { TeamPage } from './pages/TeamPage';
import { TreasureBoxPage } from './pages/TreasureBoxPage';
import { WithdrawPage } from './pages/WithdrawPage';
import type { MainTab, MeResponse, PublicConfigResponse } from './types';

export default function App() {
  const [config, setConfig] = useState<PublicConfigResponse | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // Session token kept strictly in React memory (never localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);

  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      return 'admin';
    }
    return 'home';
  });

  const [showWelcomePopup, setShowWelcomePopup] = useState(true);
  const [initialReferralCode] = useState(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return (params.get('ref') || '').toUpperCase();
  });

  const fetchConfig = useCallback(async () => {
    try {
      const res = await apiRequest<PublicConfigResponse>('/api/config');
      setConfig(res);
      setConfigError(null);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Unable to connect to server.');
    }
  }, []);

  const fetchMe = useCallback(async () => {
    if (!token) {
      setMe(null);
      return;
    }
    try {
      const res = await apiRequest<MeResponse>('/api/me', { token });
      setMe(res);
    } catch {
      setToken(null);
      setMe(null);
    }
  }, [token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  if (configError) {
    return (
      <div className="min-h-screen mahendra-page-bg flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl card-mint-border p-6 max-w-sm w-full text-center space-y-3">
          <div className="font-display font-bold text-base text-[#17231C]">
            Connection Interrupted
          </div>
          <p className="text-xs text-[#6B8275]">{configError}</p>
          <button
            type="button"
            onClick={fetchConfig}
            className="px-5 py-2.5 rounded-full brand-gradient text-white text-xs font-bold cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen mahendra-page-bg flex flex-col items-center justify-center gap-3 p-4">
        <BrandLogo siteName="MAHENDRA" />
        <div className="text-xs font-semibold text-[#F5C358] tracking-wide">
          Loading MAHENDRA Investment Platform...
        </div>
      </div>
    );
  }

  if (activeTab === 'admin') {
    return (
      <AdminPage
        onExit={() => setActiveTab('home')}
        onConfigUpdated={fetchConfig}
      />
    );
  }

  const shouldShowPopup = config.settings.popupEnabled && showWelcomePopup;

  // Auth Gate for Unauthenticated Visitors
  if (!token || !me) {
    return (
      <>
        <AuthScreen
          settings={config.settings}
          initialMode={initialReferralCode ? 'register' : 'login'}
          initialReferralCode={initialReferralCode}
          onAuthenticated={(newToken) => setToken(newToken)}
          onOpenAdmin={() => setActiveTab('admin')}
        />
        {shouldShowPopup && (
          <WelcomePopup
            settings={config.settings}
            onClose={() => setShowWelcomePopup(false)}
          />
        )}
      </>
    );
  }

  const handleLogout = () => {
    setToken(null);
    setMe(null);
    setActiveTab('home');
  };

  return (
    <div className="min-h-screen mahendra-page-bg text-[#17231C]">
      <DesktopTopBar
        activeTab={activeTab}
        onNavigate={setActiveTab}
        siteName={config.settings.siteName}
        balance={me.profile.availableBalance}
      />

      {config.settings.maintenanceMode && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs font-semibold text-amber-900">
          Maintenance Mode is active — new orders and withdrawals are temporarily paused.
        </div>
      )}

      <main>
        {activeTab === 'home' && (
          <HomePage
            settings={config.settings}
            banners={config.banners}
            products={config.products}
            me={me}
            token={token}
            onNavigate={setActiveTab}
            onRefreshMe={fetchMe}
          />
        )}

        {activeTab === 'invite' && (
          <InvitePage me={me} settings={config.settings} />
        )}

        {activeTab === 'treasure' && (
          <TreasureBoxPage
            token={token}
            onNavigate={setActiveTab}
            onRefreshMe={fetchMe}
          />
        )}

        {activeTab === 'team' && (
          <TeamPage me={me} token={token} onNavigate={setActiveTab} />
        )}

        {activeTab === 'profile' && (
          <ProfilePage
            me={me}
            settings={config.settings}
            onNavigate={setActiveTab}
            onLogout={handleLogout}
          />
        )}

        {activeTab === 'recharge' && (
          <RechargePage
            me={me}
            settings={config.settings}
            token={token}
            onNavigate={setActiveTab}
            onRefreshMe={fetchMe}
          />
        )}

        {activeTab === 'withdraw' && (
          <WithdrawPage
            me={me}
            settings={config.settings}
            token={token}
            onNavigate={setActiveTab}
            onRefreshMe={fetchMe}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersPage
            token={token}
            onBack={() => setActiveTab('profile')}
            onRefreshMe={fetchMe}
          />
        )}

        {activeTab === 'bank-cards' && (
          <BankCardPage
            me={me}
            token={token}
            onBack={() => setActiveTab('profile')}
            onRefreshMe={fetchMe}
          />
        )}

        {activeTab === 'personal-info' && (
          <PersonalInfoPage
            me={me}
            token={token}
            onBack={() => setActiveTab('profile')}
            onRefreshMe={fetchMe}
          />
        )}

        {activeTab === 'balance-details' && (
          <BalanceDetailsPage
            token={token}
            onBack={() => setActiveTab('profile')}
          />
        )}

        {activeTab === 'withdrawal-details' && (
          <WithdrawalDetailsPage
            token={token}
            onBack={() => setActiveTab('profile')}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsPage
            token={token}
            onBack={() => setActiveTab('profile')}
            onRefreshMe={fetchMe}
          />
        )}

        {activeTab === 'about' && (
          <AboutPage
            settings={config.settings}
            onBack={() => setActiveTab('profile')}
          />
        )}
      </main>

      <FloatingTelegramSupport />

      <BottomNav activeTab={activeTab} onNavigate={setActiveTab} />

      {shouldShowPopup && (
        <WelcomePopup
          settings={config.settings}
          onClose={() => setShowWelcomePopup(false)}
        />
      )}
    </div>
  );
}
