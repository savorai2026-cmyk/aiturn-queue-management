import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import logo from '../assets/logo.png';
import styles from './TopBar.module.css'; // שימוש במודול

interface TopBarProps {
  activeTab: 'calendar' | 'clients' | 'settings' | 'modmed';
  onTabChange: (tab: 'calendar' | 'clients' | 'settings' | 'modmed') => void;
  onLogout: () => void;
  user: any;
}

export default function TopBar({ activeTab, onTabChange, onLogout, user }: TopBarProps) {
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    const fetchBusinessName = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('businesses')
        .select('business_name')
        .eq('business_code', user.id) 
        .single();
        
      if (error) {
        console.error('שגיאה בשליפת שם העסק:', error.message);
      }
        
      if (data && data.business_name) {
        setBusinessName(data.business_name);
      } else {
        setBusinessName(user?.email?.split('@')[0] || 'משתמש');
      }
    };
    
    fetchBusinessName();
  }, [user]);

  return (
    <header className={styles.topBar}>
      <div className={styles.rightSection}>
        <img src={logo} alt="Featurn Logo" className={styles.logo} />
      </div>

      <div className={styles.navGroup}>
        <button 
          className={`${styles.navBtn} ${activeTab === 'settings' ? styles.activeNavBtn : ''}`}
          onClick={() => onTabChange('settings')}
        >
          הגדרות
        </button>
        <button 
          className={`${styles.navBtn} ${activeTab === 'calendar' ? styles.activeNavBtn : ''}`}
          onClick={() => onTabChange('calendar')}
        >
          יומן חי
        </button>
        <button 
          className={`${styles.navBtn} ${activeTab === 'clients' ? styles.activeNavBtn : ''}`}
          onClick={() => onTabChange('clients')}
        >
          ניהול לקוחות
        </button>
        <button className={styles.navBtn}>מודמד</button>
      </div>

      <div className={styles.leftSection}>
        <span className={styles.greeting}>שלום, {businessName || 'טוען...'}</span>
        <button className={styles.logoutBtn} onClick={onLogout}>יציאה</button>
      </div>
    </header>
  );
}