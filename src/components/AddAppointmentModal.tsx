import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import styles from './AddAppointmentModal.module.css';

interface AddAppointmentModalProps {
  isOpen: boolean;
  user: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddAppointmentModal({ isOpen, user, onClose, onSuccess }: AddAppointmentModalProps) {
  const [clients, setClients] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    client_id: '',
    appointment_date: new Date().toISOString().split('T')[0],
    start_time: '09:00:00',
    end_time: '09:30:00',
    price: 100,
    currency: 'ILS',
    status: 'waiting',
    channel: 'manual',
    client_notes: '',
    business_notes: ''
  });

  useEffect(() => {
    if (isOpen && user?.id) {
      fetchClients();
    }
  }, [isOpen, user]);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('id, full_name, mobile_phone')
      .eq('business_code', user.id);

    if (error) {
      console.error('שגיאה בשליפת לקוחות למודל תור:', error.message);
    } else {
      setClients(data || []);
      if (data && data.length > 0 && !formData.client_id) {
        setFormData(prev => ({ ...prev, client_id: data[0].id }));
      }
    }
  };

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    const payload = {
      ...formData,
      business_code: user.id,
      client_id: Number(formData.client_id),
      price: Number(formData.price),
      metadata: {}
    };

    const { error } = await supabase
      .from('appointments')
      .insert([payload]);

    if (error) {
      console.error('שגיאה ביצירת תור:', error.message);
    } else {
      onSuccess();
      onClose();
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <h2 className={styles.title}>קביעת תור חדש</h2>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>בחר לקוח *</label>
            <select 
              name="client_id" 
              required
              value={formData.client_id} 
              onChange={handleChange}
              className={styles.select}
            >
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.full_name} ({client.mobile_phone})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>תאריך התור *</label>
            <input 
              type="date" 
              name="appointment_date" 
              required
              value={formData.appointment_date} 
              onChange={handleChange}
              className={styles.input}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label>שעת התחלה *</label>
              <input 
                type="time" 
                name="start_time" 
                required
                value={formData.start_time} 
                onChange={handleChange}
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label>שעת סיום *</label>
              <input 
                type="time" 
                name="end_time" 
                required
                value={formData.end_time} 
                onChange={handleChange}
                className={styles.input}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label>מחיר (ILS)</label>
              <input 
                type="number" 
                name="price" 
                value={formData.price} 
                onChange={handleChange}
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label>סטטוס</label>
              <select 
                name="status" 
                value={formData.status} 
                onChange={handleChange}
                className={styles.select}
              >
                <option value="waiting">ממתין</option>
                <option value="confirmed">מאושר סופית</option>
                <option value="canceled">מבוטל</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>הערות לקוח</label>
            <input 
              type="text" 
              name="client_notes" 
              value={formData.client_notes} 
              onChange={handleChange}
              className={styles.input}
            />
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>ביטול</button>
            <button type="submit" className={styles.btnSave}>צור תור</button>
          </div>
        </form>
      </div>
    </div>
  );
}