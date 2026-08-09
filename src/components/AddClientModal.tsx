import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import styles from './AddClientModal.module.css';

interface AddClientModalProps {
  user: any;
  clientToEdit: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddClientModal({ user, clientToEdit, onClose, onSuccess }: AddClientModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    mobile_phone: '',
    email: '',
    city: '',
    gender: 'M',
    national_id: '',
    allows_sms: true,
    street: '',
    building_number: '',
    apartment_number: ''
  });

  useEffect(() => {
    if (clientToEdit) {
      setFormData({
        full_name: clientToEdit.full_name || '',
        mobile_phone: clientToEdit.mobile_phone || '',
        email: clientToEdit.email || '',
        city: clientToEdit.city || '',
        gender: clientToEdit.gender || 'M',
        national_id: clientToEdit.national_id || '',
        allows_sms: clientToEdit.allows_sms ?? true,
        street: clientToEdit.street || '',
        building_number: clientToEdit.building_number || '',
        apartment_number: clientToEdit.apartment_number || ''
      });
    }
  }, [clientToEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    if (clientToEdit) {
      // עדכון לקוח קיים
      const { error } = await supabase
        .from('clients')
        .update(formData)
        .eq('id', clientToEdit.id);

      if (error) {
        console.error('שגיאה בעדכון לקוח:', error.message);
      } else {
        onSuccess();
      }
    } else {
      // הוספת לקוח חדש
      const newClientData = {
        ...formData,
        business_code: user.id
      };

      const { error } = await supabase
        .from('clients')
        .insert([newClientData]);

      if (error) {
        console.error('שגיאה בהוספת לקוח:', error.message);
      } else {
        onSuccess();
      }
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <h2 className={styles.title}>
          {clientToEdit ? 'עריכת פרטי לקוח' : 'הוספת לקוח חדש'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>שם מלא *</label>
              <input 
                type="text" 
                name="full_name" 
                required
                value={formData.full_name} 
                onChange={handleChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>טלפון נייד *</label>
              <input 
                type="text" 
                name="mobile_phone" 
                required
                dir="ltr"
                style={{ textAlign: 'right' }}
                value={formData.mobile_phone} 
                onChange={handleChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>אימייל</label>
              <input 
                type="email" 
                name="email" 
                dir="ltr"
                style={{ textAlign: 'right' }}
                value={formData.email} 
                onChange={handleChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>תעודת זהות</label>
              <input 
                type="text" 
                name="national_id" 
                value={formData.national_id} 
                onChange={handleChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>מין</label>
              <select 
                name="gender" 
                value={formData.gender} 
                onChange={handleChange}
                className={styles.select}
              >
                <option value="M">זכר</option>
                <option value="F">נקבה</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>עיר</label>
              <input 
                type="text" 
                name="city" 
                value={formData.city} 
                onChange={handleChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>רחוב</label>
              <input 
                type="text" 
                name="street" 
                value={formData.street} 
                onChange={handleChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label>בניין</label>
                  <input 
                    type="text" 
                    name="building_number" 
                    value={formData.building_number} 
                    onChange={handleChange}
                    className={styles.input}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label>דירה</label>
                  <input 
                    type="text" 
                    name="apartment_number" 
                    value={formData.apartment_number} 
                    onChange={handleChange}
                    className={styles.input}
                  />
                </div>
              </div>
            </div>

            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <div className={styles.checkboxGroup}>
                <input 
                  type="checkbox" 
                  id="allows_sms"
                  name="allows_sms" 
                  checked={formData.allows_sms} 
                  onChange={handleChange}
                />
                <label htmlFor="allows_sms">שליחת הודעות SMS מותרת</label>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>ביטול</button>
            <button type="submit" className={styles.btnSave}>שמור לקוח</button>
          </div>
        </form>
      </div>
    </div>
  );
}