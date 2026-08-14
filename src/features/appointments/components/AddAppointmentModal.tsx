import React, { useState, useEffect } from 'react';
import {
  createAppointment,
  getAppointmentClients,
} from '../appointments.api';
import {
  APPOINTMENT_STATUS_LABELS,
  isAppointmentStatus,
} from '../appointments.mappers';
import type {
  AppointmentClientOption,
  AppointmentInsert,
  AppointmentStatus,
} from '../appointments.types';
import {
  errorIncludes,
  getErrorMessage,
} from '../../../shared/errors';
import styles from './AddAppointmentModal.module.css';

interface AddAppointmentModalProps {
  isOpen: boolean;
  businessCode: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CREATABLE_STATUSES: AppointmentStatus[] = ['waiting', 'scheduled'];

export default function AddAppointmentModal({ isOpen, businessCode, onClose, onSuccess }: AddAppointmentModalProps) {
  const [clients, setClients] = useState<AppointmentClientOption[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
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
    if (!isOpen) return;

    let isCancelled = false;

    void getAppointmentClients(businessCode)
      .then((data) => {
        if (isCancelled) return;

        setClients(data);
        if (data.length > 0) {
          setFormData((previous) => ({
            ...previous,
            client_id: previous.client_id || String(data[0].id),
          }));
        }
      })
      .catch((error: unknown) => {
        if (isCancelled) return;

        console.error(
          'שגיאה בשליפת לקוחות למודל תור:',
          getErrorMessage(error),
        );
        setErrorMessage('לא ניתן לטעון את רשימת הלקוחות.');
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, businessCode]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'status') {
      if (!isAppointmentStatus(value)) return;
      setFormData((previous) => ({ ...previous, status: value }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (formData.end_time <= formData.start_time) {
      setErrorMessage('שעת הסיום חייבת להיות מאוחרת משעת ההתחלה.');
      return;
    }

    const payload: AppointmentInsert = {
      ...formData,
      business_code: businessCode,
      client_id: Number(formData.client_id),
      price: Number(formData.price),
      metadata: {}
    };

    try {
      await createAppointment(payload);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('שגיאה ביצירת תור:', getErrorMessage(error));
      setErrorMessage(
        errorIncludes(error, 'prevent_overlapping_appointments')
          ? 'כבר קיים תור בטווח השעות שנבחר.'
          : 'לא ניתן ליצור את התור. בדוק את הפרטים ונסה שוב.',
      );
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <h2 className={styles.title}>קביעת תור חדש</h2>

        {errorMessage && (
          <div role="alert" className={styles.error}>
            {errorMessage}
          </div>
        )}

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

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
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
            <div className={styles.formGroup}>
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

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>מחיר (ILS)</label>
              <input 
                type="number" 
                name="price" 
                value={formData.price} 
                onChange={handleChange}
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label>סטטוס</label>
              <select 
                name="status" 
                value={formData.status} 
                onChange={handleChange}
                className={styles.select}
              >
                {CREATABLE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {APPOINTMENT_STATUS_LABELS[status]}
                  </option>
                ))}
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