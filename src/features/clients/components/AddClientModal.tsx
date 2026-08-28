import React, { useState } from 'react';
import {
  createClient,
  updateClient,
} from '../clients.api';
import type {
  Client,
  ClientFormValues,
} from '../clients.types';
import {
  errorIncludes,
  getErrorMessage,
} from '../../../shared/errors';
import { PlusIcon, SaveIcon, WhatsAppIcon } from '../../../shared/components/icons';
import styles from './AddClientModal.module.css';

interface AddClientModalProps {
  businessCode: string;
  clientToEdit: Client | null;
  onClose: () => void;
  onSuccess: () => void;
}

function getInitialFormData(client: Client | null): ClientFormValues {
  return {
    full_name: client?.full_name || '',
    mobile_phone: client?.mobile_phone || '',
    email: client?.email || '',
    city: client?.city || '',
    gender: client?.gender || 'M',
    national_id: client?.national_id || '',
    allows_sms: client?.allows_sms ?? true,
    street: client?.street || '',
    building_number: client?.building_number || '',
    apartment_number: client?.apartment_number || '',
    entrance: client?.entrance || '',
    floor: client?.floor || '',
    zip_code: client?.zip_code || '',
    po_box: client?.po_box || '',
    language: client?.language || '',
    birth_date_gregorian: client?.birth_date_gregorian || '',
    birth_date_hebrew: client?.birth_date_hebrew || '',
    landline_phone: client?.landline_phone || '',
    whatsapp_number: client?.whatsapp_number || '',
    acquisition_source: client?.acquisition_source || '',
    preferred_channel: client?.preferred_channel || '',
  };
}

export default function AddClientModal({ businessCode, clientToEdit, onClose, onSuccess }: AddClientModalProps) {
  const [formData, setFormData] = useState(() =>
    getInitialFormData(clientToEdit),
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSaving(true);

    try {
      if (clientToEdit) {
        await updateClient(businessCode, clientToEdit.id, formData);
      } else {
        await createClient(businessCode, formData);
      }

      onSuccess();
    } catch (error) {
      console.error('שגיאה בשמירת לקוח:', getErrorMessage(error));
      setErrorMessage(
        errorIncludes(error, 'unique_mobile_per_business')
          ? 'מספר הטלפון כבר קיים בעסק.'
          : errorIncludes(error, 'unique_id_per_business')
            ? 'תעודת הזהות כבר קיימת אצל לקוח אחר בעסק.'
            : 'לא ניתן לשמור את הלקוח. בדוק את הפרטים ונסה שוב.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <h2 className={styles.title}>
          {clientToEdit ? 'עריכת פרטי לקוח' : 'הוספת לקוח חדש'}
        </h2>

        {errorMessage && (
          <div role="alert" className={styles.error}>
            {errorMessage}
          </div>
        )}

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
                value={formData.mobile_phone} 
                onChange={handleChange}
                className={`${styles.input} ${styles.ltrInput}`}
              />
            </div>

            <div className={styles.formGroup}>
              <label>אימייל</label>
              <input 
                type="email" 
                name="email" 
                dir="ltr"
                value={formData.email} 
                onChange={handleChange}
                className={`${styles.input} ${styles.ltrInput}`}
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
              <label>ת.לידה לועזי</label>
              <input
                type="date"
                name="birth_date_gregorian"
                value={formData.birth_date_gregorian}
                onChange={handleChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>ת.לידה עברי</label>
              <input
                type="text"
                name="birth_date_hebrew"
                value={formData.birth_date_hebrew}
                onChange={handleChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>שפה</label>
              <input
                type="text"
                name="language"
                value={formData.language}
                onChange={handleChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>טלפון נייח</label>
              <input
                type="text"
                name="landline_phone"
                dir="ltr"
                value={formData.landline_phone}
                onChange={handleChange}
                className={`${styles.input} ${styles.ltrInput}`}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.brandLabel}>
                <WhatsAppIcon />
                וואטסאפ
              </label>
              <input
                type="text"
                name="whatsapp_number"
                dir="ltr"
                value={formData.whatsapp_number}
                onChange={handleChange}
                className={`${styles.input} ${styles.ltrInput}`}
              />
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
              <div className={styles.inlineFields}>
                <div>
                  <label>בניין</label>
                  <input 
                    type="text" 
                    name="building_number" 
                    value={formData.building_number} 
                    onChange={handleChange}
                    className={styles.input}
                  />
                </div>
                <div>
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

            <div className={styles.formGroup}>
              <label>כניסה</label>
              <input
                type="text"
                name="entrance"
                value={formData.entrance}
                onChange={handleChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>קומה</label>
              <input
                type="text"
                name="floor"
                value={formData.floor}
                onChange={handleChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>מיקוד</label>
              <input
                type="text"
                name="zip_code"
                value={formData.zip_code}
                onChange={handleChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>ת.ד</label>
              <input
                type="text"
                name="po_box"
                value={formData.po_box}
                onChange={handleChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>מקור הגעה</label>
              <input
                type="text"
                name="acquisition_source"
                value={formData.acquisition_source}
                onChange={handleChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>ערוץ מועדף</label>
              <input
                type="text"
                name="preferred_channel"
                value={formData.preferred_channel}
                onChange={handleChange}
                className={styles.input}
              />
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
            <button type="submit" className={styles.btnSave} disabled={isSaving}>
              {isSaving ? 'שומר...' : (
                <>
                  {clientToEdit ? <SaveIcon /> : <PlusIcon />}
                  שמור לקוח
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}