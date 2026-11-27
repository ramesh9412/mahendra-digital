import React, { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthScreen } from './components/AuthScreen';
import { BottomNav, DesktopTopBar } from './components/BottomNav';
import { BrandLogo } from './components/BrandVisuals';
import { FloatingTelegramSupport } from './components/TelegramSupport';
import { WelcomePopup } from './components/WelcomePopup';
import {
  formatSupabaseError,
  isSchemaMissingError,
  isSupabaseConfigured,
  missingSupabaseEnvVars,
  supabase,
  supabaseInitError,
} from './lib/supabase';
import {
  fetchMyAccountSnapshot,
  fetchPublicConfig,
  signOutFromSupabase,
} from './lib/supabaseApi';
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
  const [schemaPending, setSchemaPending] = useState(false);

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const [me, setMe] = useState<MeResponse | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [realtimeTick, setRealtimeTick] = useState(0);

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
    if (supabaseInitError) {
      setConfigError(supabaseInitError);
      return;
    }
    if (!isSupabaseConfigured) {
      const missingText =
        missingSupabaseEnvVars.length > 0
          ? missingSupabaseEnvVars.join(', ')
          : 'VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY';
      setConfigError(
        `Supabase environment variable(s) missing: ${missingText}.`
      );
      return;
    }
    try {
      const res = await fetchPublicConfig();
      setConfig(res);
      setConfigError(null);
      setSchemaPending(false);
    } catch (err) {
      if (isSchemaMissingError(err)) {
        setSchemaPending(true);
        setConfigError(
          'Database schema setup is required. Run the SQL migration files in supabase/migrations/ inside your Supabase SQL Editor.'
        );
      } else {
        setSchemaPending(false);
        setConfigError(formatSupabaseError(err, 'Unable to connect to Supabase backend.'));
      }
    }
  }, []);

  const fetchMe = useCallback(async () => {
    if (!session?.user) {
      setMe(null);
      setMeError(null);
      return;
    }
    try {
      const res = await fetchMyAccountSnapshot();
      setMe(res);
      setMeError(null);
    } catch (err) {
      if (isSchemaMissingError(err)) {
        setSchemaPending(true);
      }
      setMeError(formatSupabaseError(err, 'Unable to load account profile.'));
    }
  }, [session?.user]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Supabase Auth Session & Recovery Listener
  useEffect(() => {
    const sb = supabase;
    if (!sb) {
      setAuthReady(true);
      return;
    }

    sb.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session ?? null);
      })
      .catch(() => {
        setSession(null);
      })
      .finally(() => {
        setAuthReady(true);
      });

    const { data: listener } = sb.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      } else if (event === 'SIGNED_OUT') {
        setRecoveryMode(false);
        setMe(null);
        setMeError(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user && config) {
      fetchMe();
    } else if (!session?.user) {
      setMe(null);
    }
  }, [session?.user, config, fetchMe]);

  // Supabase Realtime Subscriptions for Live Wallet, Deposits, Withdrawals, Transactions & Notifications
  useEffect(() => {
    const sb = supabase;
    const userId = session?.user?.id;
    if (!sb || !userId || !config) return;

    const channel = sb
      .channel(`mahendra-live-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        () => {
          fetchMe();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deposits', filter: `user_id=eq.${userId}` },
        () => {
          fetchMe();
          setRealtimeTick((t) => t + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'withdrawals', filter: `user_id=eq.${userId}` },
        () => {
          fetchMe();
          setRealtimeTick((t) => t + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
        () => {
          setRealtimeTick((t) => t + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          fetchMe();
          setRealtimeTick((t) => t + 1);
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [session?.user?.id, config, fetchMe]);

  if (configError) {
    return (
      <div className="min-h-screen mahendra-page-bg flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl card-mint-border p-6 max-w-md w-full text-center space-y-3">
          <div className="font-display font-bold text-base text-[#17231C]">
            {schemaPending ? 'Supabase Database Setup Pending' : 'Connection Interrupted'}
          </div>
          <p className="text-xs text-[#6B8275] leading-relaxed">{configError}</p>
          {schemaPending && (
            <div className="p-3 rounded-xl bg-[#F4FAF7] border border-[#D4EDE0] text-[11px] text-left text-[#344A3E] space-y-1">
              <div className="font-bold text-[#005B32]">Run in Supabase SQL Editor (in order):</div>
              <div>1. supabase/migrations/202611270001_mahendra_schema.sql</div>
              <div>2. supabase/migrations/202611270002_mahendra_functions_and_rls.sql</div>
              <div>3. supabase/migrations/202611270003_seed_mahendra_data.sql</div>
            </div>
          )}
          <button
            type="button"
            onClick={fetchConfig}
            className="px-5 py-2.5 rounded-full brand-gradient text-white text-xs font-bold cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!config || !authReady) {
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

  // Auth Gate for Unauthenticated Visitors or Password Recovery Flow
  if (!session || recoveryMode) {
    return (
      <>
        <AuthScreen
          settings={config.settings}
          initialMode={recoveryMode ? 'recovery' : initialReferralCode ? 'register' : 'login'}
          initialReferralCode={initialReferralCode}
          onAuthenticated={() => {
            setRecoveryMode(false);
            fetchMe();
          }}
          onRecoveryCompleted={() => setRecoveryMode(false)}
          onOpenAdmin={() => setActiveTab('admin')}
        />
        {shouldShowPopup && !recoveryMode && (
          <WelcomePopup
            settings={config.settings}
            onClose={() => setShowWelcomePopup(false)}
          />
        )}
      </>
    );
  }

  if (!me) {
    return (
      <div className="min-h-screen mahendra-page-bg flex flex-col items-center justify-center gap-3 p-4">
        <BrandLogo siteName={config.settings.siteName} />
        {meError ? (
          <div className="bg-white rounded-2xl card-mint-border p-5 max-w-sm w-full text-center space-y-3">
            <div className="text-xs font-semibold text-red-700">{meError}</div>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={fetchMe}
                className="px-4 py-2 rounded-full brand-gradient text-white text-xs font-bold cursor-pointer"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={async () => {
                  await signOutFromSupabase().catch(() => {});
                  setSession(null);
                  setMe(null);
                }}
                className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs font-semibold text-[#F5C358] tracking-wide">
            Syncing Account Snapshot...
          </div>
        )}
      </div>
    );
  }

  const handleLogout = async () => {
    await signOutFromSupabase().catch(() => {});
    setSession(null);
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

      {me.hasWithdrawalPin === false && activeTab !== 'personal-info' && (
        <div className="bg-[#FFF9E6] border-b border-[#F3D88C] px-4 py-2 text-center text-xs font-semibold text-[#6E4B00] flex flex-wrap items-center justify-center gap-2">
          <span>Please set your Withdrawal Password in Personal Information before requesting payouts.</span>
          <button
            type="button"
            onClick={() => setActiveTab('personal-info')}
            className="px-3 py-1 rounded-full bg-[#008C45] text-white text-[11px] font-bold cursor-pointer"
          >
            Set PIN Now
          </button>
        </div>
      )}

      <main>
        {activeTab === 'home' && (
          <HomePage
            settings={config.settings}
            banners={config.banners}
            products={config.products}
            me={me}
            onNavigate={setActiveTab}
            onRefreshMe={fetchMe}
          />
        )}

        {activeTab === 'invite' && (
          <InvitePage me={me} settings={config.settings} />
        )}

        {activeTab === 'treasure' && (
          <TreasureBoxPage
            refreshSignal={realtimeTick}
            onNavigate={setActiveTab}
            onRefreshMe={fetchMe}
          />
        )}

        {activeTab === 'team' && (
          <TeamPage me={me} refreshSignal={realtimeTick} onNavigate={setActiveTab} />
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
            refreshSignal={realtimeTick}
            onNavigate={setActiveTab}
            onRefreshMe={fetchMe}
          />
        )}

        {activeTab === 'withdraw' && (
          <WithdrawPage
            me={me}
            settings={config.settings}
            refreshSignal={realtimeTick}
            onNavigate={setActiveTab}
            onRefreshMe={fetchMe}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersPage
            refreshSignal={realtimeTick}
            onBack={() => setActiveTab('profile')}
            onRefreshMe={fetchMe}
          />
        )}

        {activeTab === 'bank-cards' && (
          <BankCardPage
            me={me}
            onBack={() => setActiveTab('profile')}
            onRefreshMe={fetchMe}
          />
        )}

        {activeTab === 'personal-info' && (
          <PersonalInfoPage
            me={me}
            onBack={() => setActiveTab('profile')}
            onRefreshMe={fetchMe}
          />
        )}

        {activeTab === 'balance-details' && (
          <BalanceDetailsPage
            refreshSignal={realtimeTick}
            onBack={() => setActiveTab('profile')}
          />
        )}

        {activeTab === 'withdrawal-details' && (
          <WithdrawalDetailsPage
            refreshSignal={realtimeTick}
            onBack={() => setActiveTab('profile')}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsPage
            refreshSignal={realtimeTick}
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
