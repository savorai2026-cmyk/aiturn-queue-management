import { useEffect, useState } from 'react';
import type { AppTab } from './app/navigation';
import { readAppTab, writeAppTab } from './app/uiLocation';
import TopBar from './app/components/TopBar';
import ClientManagement from './features/clients/components/ClientManagement';
import Settings from './features/settings/components/Settings';
import AppointmentsPage from './features/appointments/AppointmentsPage';
import { useAuth } from './features/auth/AuthContextState';
import { AuthProvider } from './features/auth/AuthProvider';
import Login from './features/auth/Login';
import BusinessOnboarding from './features/business/BusinessOnboarding';
import { BusinessProvider } from './features/business/BusinessContext';
import { useBusiness } from './features/business/BusinessContextState';
import './shared/components/icons.css';
import './App.css';

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="centered-screen">
      <div className="loading-card" role="status">
        <span className="loading-indicator" aria-hidden="true" />
        <div>{message}</div>
      </div>
    </div>
  );
}

interface AuthenticatedAppProps {
  userEmail?: string;
  onLogout: () => void;
}

function AuthenticatedApp({ userEmail, onLogout }: AuthenticatedAppProps) {
  const {
    activeBusiness,
    memberships,
    isLoading,
    error,
    setActiveBusiness,
    refreshBusinesses,
  } = useBusiness();
  const [activeTab, setActiveTab] = useState<AppTab>(readAppTab);

  useEffect(() => {
    writeAppTab(activeTab);
  }, [activeTab]);

  if (isLoading) {
    return <LoadingScreen message="טוען את פרטי העסק..." />;
  }

  if (error && memberships.length === 0) {
    return (
      <div className="centered-screen">
        <div className="load-error-card">
          <div>{error}</div>
          <button type="button" onClick={() => void refreshBusinesses()}>
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  if (!activeBusiness) {
    return <BusinessOnboarding />;
  }

  return (
    <div className="layout-container">
      <TopBar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        onLogout={onLogout}
        businessName={activeBusiness.businessName}
        userEmail={userEmail}
        businesses={memberships}
        activeBusinessCode={activeBusiness.businessCode}
        onBusinessChange={setActiveBusiness}
      />
      
      <div className="main-content">
        {activeTab === 'calendar' && (
          <AppointmentsPage
            key={activeBusiness.businessCode}
            businessCode={activeBusiness.businessCode}
          />
        )}

        {activeTab === 'clients' && (
          <main className="feature-area">
            <ClientManagement
              key={activeBusiness.businessCode}
              businessCode={activeBusiness.businessCode}
            />
          </main>
        )}

        {activeTab === 'settings' && (
          <main className="feature-area">
            <Settings
              businessCode={activeBusiness.businessCode}
              onBusinessUpdated={refreshBusinesses}
            />
          </main>
        )}
      </div>
    </div>
  );
}

function AppContent() {
  const { session, isLoading, error, signOut } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="טוען מערכת..." />;
  }

  if (error && !session) {
    return <LoadingScreen message={error} />;
  }

  if (!session) {
    return <Login />;
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