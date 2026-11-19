import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppTab } from './app/navigation';
import { readAppTab, writeAppTab } from './app/uiLocation';
import TopBar from './app/components/TopBar';
import ClientManagement from './features/clients/components/ClientManagement';
import LogsPage from './features/conversations/components/LogsPage';
import StatsPage from './features/stats/components/StatsPage';
import Settings from './features/settings/components/Settings';
import UsagePage from './features/usage/components/UsagePage';
import AppointmentsPage from './features/appointments/AppointmentsPage';
import { leaveCachedAccount } from './features/auth/auth.api';
import { useAuth } from './features/auth/AuthContextState';
import { AuthProvider } from './features/auth/AuthProvider';
import Login from './features/auth/Login';
import {
  MfaSignupOffer,
  MustChangePassword,
  mfaOfferPending,
  mustChangePassword,
} from './features/auth/AccountFollowups';
import MfaChallenge from './features/auth/MfaChallenge';
import TermsAcceptance from './features/auth/TermsAcceptance';
import { needsTermsAcceptance } from './features/auth/termsOfUse';
import { isAuthCallbackPending } from './features/auth/authRedirect';
import BusinessOnboarding from './features/business/BusinessOnboarding';
import { BusinessProvider } from './features/business/BusinessContext';
import { useBusiness } from './features/business/BusinessContextState';
import PaymentMethodGate from './features/billing/PaymentMethodGate';
import CardAccess from './features/billing/CardAccess';
import { WaitingOverlay } from './shared/components/QLoader';
import './shared/components/icons.css';
import './App.css';

function LoadingScreen({ message }: { message: string }) {
  return <WaitingOverlay message={message} />;
}

const PAGE_LOADING_MESSAGE: Record<AppTab, string> = {
  calendar: 'טוען תורים...',
  clients: 'טוען לקוחות...',
  settings: 'טוען הגדרות...',
  stats: 'טוען סטטיסטיקה...',
  logs: 'טוען לוגים...',
  usage: 'טוען...',
};

function splitPageKey(key: string) {
  const index = key.indexOf(':');
  return {
    tab: key.slice(0, index) as AppTab,
    code: key.slice(index + 1),
  };
}

interface AuthenticatedAppProps {
  userEmail?: string;
  onLogout: () => void;
  onSwitchUser: () => void;
}

function AuthenticatedApp({ userEmail, onLogout, onSwitchUser }: AuthenticatedAppProps) {
  const {
    activeBusiness,
    memberships,
    isLoading,
    error,
    setActiveBusiness,
    refreshBusinesses,
  } = useBusiness();
  const [requestedTab, setRequestedTab] = useState<AppTab>(readAppTab);
  const [visibleKey, setVisibleKey] = useState<string | null>(null);
  const [showBubble, setShowBubble] = useState(false);
  const businessCode = activeBusiness?.businessCode ?? '';
  const requestedKey = businessCode ? `${requestedTab}:${businessCode}` : '';
  const requestedKeyRef = useRef(requestedKey);
  requestedKeyRef.current = requestedKey;
  const switching = Boolean(requestedKey) && visibleKey !== requestedKey;

  useEffect(() => {
    writeAppTab(requestedTab);
  }, [requestedTab]);

  useEffect(() => {
    if (!switching) {
      setShowBubble(false);
      return;
    }
    const timer = window.setTimeout(() => setShowBubble(true), 150);
    return () => window.clearTimeout(timer);
  }, [requestedKey, switching]);

  useEffect(() => {
    if (!visibleKey) return;
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [visibleKey]);

  const markReady = useCallback((key: string) => {
    if (key !== requestedKeyRef.current) return;
    setVisibleKey(key);
  }, []);

  const openBusinessSettings = (target: 'cloud-storage' | 'subscription-plan') => {
    if (!activeBusiness) return;
    try {
      sessionStorage.setItem(`settingsTab:${activeBusiness.businessCode}`, 'subscription');
      sessionStorage.setItem(`settingsScroll:${activeBusiness.businessCode}`, target);
    } catch {
      /* ignore */
    }
    setRequestedTab('settings');
  };

  if (isLoading) {
    return <LoadingScreen message="טוען את פרטי העסק..." />;
  }

  if (error && memberships.length === 0) {
    return (
      <div className="centered-screen">
        <div className="load-error-card">
          <div>{error}</div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void refreshBusinesses()}
          >
            נסה שוב
          </button>
          <button type="button" className="btn btn-neutral" onClick={onSwitchUser}>
            יציאה והתחברות מחדש
          </button>
        </div>
      </div>
    );
  }

  if (!activeBusiness) {
    return <BusinessOnboarding />;
  }

  const visible = visibleKey ? splitPageKey(visibleKey) : null;
  const shownTab = visible?.tab;
  const code = activeBusiness.businessCode;

  const renderPage = (tab: AppTab, pageCode: string, hidden: boolean) => (
    <div
      key={`${tab}:${pageCode}`}
      className={hidden ? 'page-slot is-pending' : 'page-slot'}
      aria-hidden={hidden || undefined}
    >
      {tab === 'calendar' ? (
        <AppointmentsPage
          businessCode={pageCode}
          onReady={() => markReady(`${tab}:${pageCode}`)}
        />
      ) : null}
      {tab === 'clients' ? (
        <main className="feature-area">
          <ClientManagement
            businessCode={pageCode}
            onReady={() => markReady(`${tab}:${pageCode}`)}
          />
        </main>
      ) : null}
      {tab === 'settings' ? (
        <main className="feature-area">
          <Settings
            businessCode={pageCode}
            onBusinessUpdated={refreshBusinesses}
            onReady={() => markReady(`${tab}:${pageCode}`)}
          />
        </main>
      ) : null}
      {tab === 'stats' ? (
        <main className="feature-area">
          <StatsPage
            businessCode={pageCode}
            onReady={() => markReady(`${tab}:${pageCode}`)}
          />
        </main>
      ) : null}
      {tab === 'logs' ? (
        <main className="feature-area">
          <LogsPage
            businessCode={pageCode}
            onReady={() => markReady(`${tab}:${pageCode}`)}
          />
        </main>
      ) : null}
      {tab === 'usage' ? (
        <main className="feature-area">
          <UsagePage
            businessCode={pageCode}
            onOpenStorageSettings={
              activeBusiness.role === 'owner'
                ? () => openBusinessSettings('cloud-storage')
                : undefined
            }
            onOpenPlanSettings={
              activeBusiness.role === 'owner'
                ? () => openBusinessSettings('subscription-plan')
                : undefined
            }
            onReady={() => markReady(`${tab}:${pageCode}`)}
          />
        </main>
      ) : null}
    </div>
  );

  return (
    <div className={`layout-container${shownTab === 'calendar' ? ' is-page-flow' : ''}`}>
      <TopBar
        activeTab={requestedTab}
        onTabChange={setRequestedTab}
        onLogout={onLogout}
        businessName={activeBusiness.businessName}
        userEmail={userEmail}
        businesses={memberships}
        activeBusinessCode={activeBusiness.businessCode}
        onBusinessChange={setActiveBusiness}
      />

      <PaymentMethodGate
        businessCode={code}
        role={activeBusiness.role}
      />

      <CardAccess
        businessCode={code}
        role={activeBusiness.role}
      >
      <div className="main-content">
        {visible && visibleKey !== requestedKey
          ? renderPage(visible.tab, visible.code, false)
          : null}
        {renderPage(requestedTab, code, visibleKey !== requestedKey)}
        {showBubble ? (
          <WaitingOverlay message={PAGE_LOADING_MESSAGE[requestedTab]} />
        ) : null}
      </div>
      </CardAccess>
    </div>
  );
}

function AppContent() {
  const { session, isLoading, isPasswordRecovery, needsMfa, signOut } = useAuth();

  if (isLoading) {
    return (
      <LoadingScreen
        message={
          isAuthCallbackPending()
            ? 'מאמתים את החשבון...'
            : 'טוען מערכת...'
        }
      />
    );
  }

  if (session && needsMfa) {
    return <MfaChallenge />;
  }

  if (!session || isPasswordRecovery) {
    return <Login />;
  }

  if (needsTermsAcceptance(session.user)) {
    return <TermsAcceptance />;
  }

  if (mustChangePassword(session.user)) {
    return <MustChangePassword />;
  }

  if (mfaOfferPending()) {
    return <MfaSignupOffer />;
  }

  return (
    <BusinessProvider userId={session.user.id}>
      <AuthenticatedApp
        userEmail={session.user.email}
        onLogout={() => {
          void signOut().catch((signOutError: unknown) => {
            console.error('שגיאה בהתנתקות:', signOutError);
          });
        }}
        onSwitchUser={() => {
          void leaveCachedAccount();
        }}
      />
    </BusinessProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}