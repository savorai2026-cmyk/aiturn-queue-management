import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import styles from './Settings.module.css';

interface SettingsProps {
  user: any;
}

export default function Settings({ user }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'business' | 'services'>('business');
  const [businessData, setBusinessData] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchBusinessData();
      fetchServices();
    }
  }, [user]);

  const fetchBusinessData = async () => {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('business_code', user.id)
      .single();

    if (!error && data) {
      setBusinessData(data);
    }
  };

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('business_code', user.id);

    if (!error && data) {
      setServices(data);
    }
  };

  const handleBusinessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBusinessData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSaveBusiness = async () => {
    if (!businessData || !user?.id) return;
    
    const { error } = await supabase
      .from('businesses')
      .update(businessData)
      .eq('business_code', user.id);

    if (error) {
      alert('שגיאה בשמירת נתונים: ' + error.message);
    } else {
      alert('הנתונים נשמרו בהצלחה!');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>הגדרות מערכת</h2>
      </div>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'business' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('business')}
        >
          פרטי העסק
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'services' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('services')}
        >
          סוגי תורים / שירותים
        </button>
      </div>

      <div className={styles.contentCard}>
        {activeTab === 'business' && businessData ? (
          <div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>שם העסק</label>
                <input 
                  type="text" 
                  name="business_name" 
                  value={businessData.business_name || ''} 
                  onChange={handleBusinessChange} 
                  className={styles.input} 
                />
              </div>
              <div className={styles.formGroup}>
                <label>טלפון ליצירת קשר</label>
                <input 
                  type="text" 
                  name="contact_phone" 
                  value={businessData.contact_phone || ''} 
                  onChange={handleBusinessChange} 
                  className={styles.input} 
                />
              </div>
              <div className={styles.formGroup}>
                <label>Vapi Assistant ID (מזהה בוט קולי)</label>
                <input 
                  type="text" 
                  name="vapi_assistant_id" 
                  value={businessData.vapi_assistant_id || ''} 
                  onChange={handleBusinessChange} 
                  className={styles.input} 
                  dir="ltr"
                />
              </div>
              <div className={styles.formGroup}>
                <label>WhatsApp Instance ID</label>
                <input 
                  type="text" 
                  name="wa_instance_id" 
                  value={businessData.wa_instance_id || ''} 
                  onChange={handleBusinessChange} 
                  className={styles.input} 
                  dir="ltr"
                />
              </div>
            </div>
            <button className={styles.btnPrimary} onClick={handleSaveBusiness}>
              שמור הגדרות עסק
            </button>
          </div>
        ) : activeTab === 'services' ? (
          <div>
            <button className={styles.btnPrimary} style={{ marginBottom: '20px', marginTop: 0 }}>
              + הוסף שירות חדש
            </button>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>קוד שירות</th>
                  <th>שם השירות</th>
                  <th>משך (דקות)</th>
                  <th>מחיר (₪)</th>
                  <th>צבע</th>
                  <th>סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {services.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>לא הוגדרו שירותים</td>
                  </tr>
                ) : (
                  services.map(srv => (
                    <tr key={srv.id}>
                      <td>{srv.service_code}</td>
                      <td>{srv.title}</td>
                      <td>{srv.duration_minutes}</td>
                      <td>{srv.price}</td>
                      <td>
                        <span style={{ backgroundColor: srv.color_code, padding: '2px 10px', borderRadius: '4px' }}>
                          {srv.color_code}
                        </span>
                      </td>
                      <td>{srv.is_active ? 'פעיל' : 'לא פעיל'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div>טוען נתונים...</div>
        )}
      </div>
    </div>
  );
}