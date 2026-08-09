import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import TopBar from './components/TopBar';
import CalendarView from './components/CalendarView';
import { SidePanel } from './components/SidePanel';
import ClientManagement from './components/ClientManagement';
import Settings from './components/Settings';
import AddAppointmentModal from './components/AddAppointmentModal';
import './App.css'; // הייבוא של העיצוב הגלובלי (הקונטיינר הראשי)

type TabType = 'calendar' | 'clients' | 'settings' | 'modmed';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>('calendar');
  const [selectedAppt, setSelectedAppt] = useState<any>(null);
  const [isAddAppointmentOpen, setIsAddAppointmentOpen] = useState(false);
  
  const calendarRef = useRef<any>(null);

  // ניהול התחברות (Auth)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleUpdateAppointment = (updatedData: any) => {
    // לוגיקת עדכון התור במסד הנתונים וביומן
    // ...
    setSelectedAppt(updatedData);
  };

  // מסך התחברות במידה ואין סשן
  if (!session) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', direction: 'rtl' }}>
        <div>טוען מערכת או אנא התחבר...</div>
        {/* כאן תבוא קומפוננטת ההתחברות שלך (Login) */}
      </div>
    );
  }

  return (
    <div className="layout-container">
      {/* סרגל עליון מחזיק את הניווט המרכזי */}
      <TopBar 
        activeTab={activeTab} 
        onTabChange={(tab: any) => setActiveTab(tab)} 
        onLogout={handleLogout}
        user={session.user} 
      />
      
      {/* אזור התוכן הדינמי */}
      <div className="main-content">
        
        {activeTab === 'calendar' && (
          <>
            <aside className="side-panel-wrapper">
              <SidePanel 
                appointment={selectedAppt} 
                onUpdate={handleUpdateAppointment} 
              />
            </aside>
            <main className="calendar-area">
              <CalendarView 
                ref={calendarRef} 
                onAddAppointment={() => setIsAddAppointmentOpen(true)} 
                user={session.user} 
                onEventClick={(appt: any) => setSelectedAppt(appt)} 
              />
            </main>
          </>
        )}

        {activeTab === 'clients' && (
          <main className="calendar-area">
            <ClientManagement user={session.user} /> 
          </main>
        )}

        {activeTab === 'settings' && (
          <main className="calendar-area">
            <Settings user={session.user} />
          </main>
        )}

        {activeTab === 'modmed' && (
          <main className="calendar-area">
            <div style={{ padding: '20px', color: '#1e3a8a', fontWeight: 'bold' }}>
              מסך מודמד (בפיתוח...)
            </div>
          </main>
        )}

      </div>

      {/* מודלים גלובליים */}
      <AddAppointmentModal 
        isOpen={isAddAppointmentOpen}
        user={session.user}
        onClose={() => setIsAddAppointmentOpen(false)}
        onSuccess={() => {
          setIsAddAppointmentOpen(false);
          // במערכת אמיתית, נקרא כאן לפונקציה שמרעננת את היומן
        }}
      />
    </div>
  );
}