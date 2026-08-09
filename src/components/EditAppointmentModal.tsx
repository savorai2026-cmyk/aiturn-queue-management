import React, { useState, useEffect } from 'react';
import styles from './EditAppointmentModal.module.css';

export interface Appointment {
  id?: number;
  patientName?: string;
  status?: string;
  time?: string;
  notes?: string;
  [key: string]: any; 
}

interface EditAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onSave: (data: Appointment) => void;
}

export const EditAppointmentModal = ({ isOpen, onClose, appointment, onSave }: EditAppointmentModalProps) => {
  const [formData, setFormData] = useState<Appointment | null>(appointment);

  useEffect(() => {
    setFormData(appointment);
  }, [appointment]);

  if (!isOpen || !formData) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: Appointment | null) => prev ? { ...prev, [name]: value } : prev);
  };

  const handleSubmit = () => {
    if (formData) {
      onSave(formData);
      onClose();
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <h2 className={styles.title}>עריכת פרטי תור מלאים</h2>
        
        <div>
          <div className={styles.formGroup}>
            <label>שם מטופל</label>
            <input 
              type="text" 
              name="patientName"
              value={formData.patientName || ''} 
              onChange={handleChange}
              className={styles.input}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>סטטוס</label>
            <select 
              name="status"
              value={formData.status || ''} 
              onChange={handleChange}
              className={styles.select}
            >
              <option value="waiting">ממתין</option>
              <option value="confirmed">מאושר סופית</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>הערות נוספות</label>
            <input 
              type="text" 
              name="notes"
              value={formData.notes || ''} 
              onChange={handleChange}
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onClose}>ביטול</button>
          <button className={styles.btnSave} onClick={handleSubmit}>שמור שינויים</button>
        </div>
      </div>
    </div>
  );
};