import { useState } from 'react';
import { EditAppointmentModal, type Appointment } from './EditAppointmentModal';
import styles from './SidePanel.module.css';

interface SidePanelProps {
  appointment: Appointment | null;
  onUpdate: (updatedData: Appointment) => void;
}

const fieldConfig = [
  { key: 'patientName', label: 'שם מטופל' },
  { key: 'time', label: 'שעת תור' },
  { key: 'status', label: 'סטטוס' },
  { key: 'notes', label: 'הערות' }
];

export const SidePanel = ({ appointment, onUpdate }: SidePanelProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!appointment) {
    return (
      <div className={styles.container} style={{ justifyContent: 'center', alignItems: 'center', color: '#94a3b8', padding: '20px' }}>
        בחר תור כדי לראות פרטים
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>פרטי תור נבחר</span>
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>
      
      <div className={styles.content}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontWeight: '600', marginBottom: '12px', color: '#1e3a8a', fontSize: '14px' }}>
            פרטי תור מזהה: {appointment.id}
          </div>
          
          {fieldConfig.map((field) => {
            if (appointment[field.key] !== undefined) {
              return (
                <div key={field.key} className={styles.field}>
                  <span className={styles.fieldLabel}>{field.label}:</span>
                  <span className={styles.fieldValue}>{appointment[field.key]}</span>
                </div>
              );
            }
            return null;
          })}
        </div>

        <div className={styles.actionsTitle}>פעולות על התור:</div>
        
        <div>
          <button className={styles.btn}>
            פתח אפשרויות הזזה
          </button>
          
          <button className={styles.btn}>
            שלח וואטסאפ חופשי
          </button>

          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setIsModalOpen(true)}>
            ערוך פרטים מלאים
          </button>
        </div>

        <EditAppointmentModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          appointment={appointment}
          onSave={onUpdate}
        />
      </div>
    </div>
  );
};