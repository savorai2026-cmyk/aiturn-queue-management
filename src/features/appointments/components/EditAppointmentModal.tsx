import React, { useState } from 'react';
import {
  APPOINTMENT_STATUS_LABELS,
  isAppointmentStatus,
  toAppointmentEditValues,
} from '../appointments.mappers';
import type {
  AppointmentDetails,
  AppointmentEditValues,
} from '../appointments.types';
import { APPOINTMENT_STATUSES } from '../appointments.types';
import { errorIncludes } from '../../../shared/errors';
import styles from './EditAppointmentModal.module.css';

interface EditAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentDetails | null;
  onSave: (data: AppointmentEditValues) => Promise<void>;
}

export const EditAppointmentModal = ({ isOpen, onClose, appointment, onSave }: EditAppointmentModalProps) => {
  if (!isOpen || !appointment) return null;

  return (
    <EditAppointmentForm
      key={appointment.id}
      appointment={appointment}
      onClose={onClose}
      onSave={onSave}
    />
  );
};

interface EditAppointmentFormProps {
  appointment: AppointmentDetails;
  onClose: () => void;
  onSave: (data: AppointmentEditValues) => Promise<void>;
}

function EditAppointmentForm({
  appointment,
  onClose,
  onSave,
}: EditAppointmentFormProps) {
  const [formData, setFormData] = useState(() =>
    toAppointmentEditValues(appointment),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'status') {
      if (!isAppointmentStatus(value)) return;
      setFormData((previous) => ({ ...previous, status: value }));
      return;
    }

    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async () => {
    setErrorMessage('');

    if (formData.end_time <= formData.start_time) {
      setErrorMessage('שעת הסיום חייבת להיות מאוחרת משעת ההתחלה.');
      return;
    }

    setIsSaving(true);

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      setErrorMessage(
        errorIncludes(error, 'prevent_overlapping_appointments')
          ? 'כבר קיים תור בטווח השעות שנבחר.'
          : 'לא ניתן לשמור את השינויים.',
      );
    } finally {
      setIsSaving(false);
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
              value={appointment.patientName}
              className={styles.input}
              disabled
            />
          </div>

          <div className={styles.formGroup}>
            <label>תאריך</label>
            <input
              type="date"
              name="appointment_date"
              value={formData.appointment_date}
              onChange={handleChange}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>שעת התחלה</label>
            <input
              type="time"
              name="start_time"
              value={formData.start_time}
              onChange={handleChange}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>שעת סיום</label>
            <input
              type="time"
              name="end_time"
              value={formData.end_time}
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
              {APPOINTMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {APPOINTMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
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

          <div className={styles.formGroup}>
            <label>הערות עסק</label>
            <input
              type="text"
              name="business_notes"
              value={formData.business_notes}
              onChange={handleChange}
              className={styles.input}
            />
          </div>
        </div>

        {errorMessage && (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        )}

        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onClose}>ביטול</button>
          <button
            className={styles.btnSave}
            onClick={() => void handleSubmit()}
            disabled={isSaving}
          >
            {isSaving ? 'שומר...' : 'שמור שינויים'}
          </button>
        </div>
      </div>
    </div>
  );
}