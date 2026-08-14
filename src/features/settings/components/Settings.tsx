import { useState, type ChangeEvent } from 'react';
import { updateBusinessSettings } from '../settings.api';
import type {
  BusinessSettings,
  EditableBusinessSettings,
  Service,
} from '../settings.types';
import { useSettings } from '../useSettings';
import {
  ErrorState,
  LoadingState,
} from '../../../shared/components/PageState';
import styles from './Settings.module.css';

interface SettingsProps {
  businessCode: string;
  onBusinessUpdated: () => Promise<void>;
}

export default function Settings({
  businessCode,
  onBusinessUpdated,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'business' | 'services'>('business');
  const { business, services, error, isLoading, refresh } =
    useSettings(businessCode);

  if (isLoading) {
    return <LoadingState message="טוען הגדרות..." />;
  }

  if (error || !business) {
    return (
      <ErrorState
        message={error || 'פרטי העסק אינם זמינים.'}
        onRetry={refresh}
      />
    );
  }

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
        {activeTab === 'business' ? (
          <BusinessSettingsForm
            key={business.business_code}
            business={business}
            onSaved={onBusinessUpdated}
          />
        ) : activeTab === 'services' ? (
          <ServicesTable services={services} />
        ) : (
          <div>טוען נתונים...</div>
        )}
      </div>
    </div>
  );
}

function toEditableSettings(
  business: BusinessSettings,
): EditableBusinessSettings {
  return {
    business_name: business.business_name,
    contact_phone: business.contact_phone,
    vapi_assistant_id: business.vapi_assistant_id,
    wa_instance_id: business.wa_instance_id,
  };
}

function BusinessSettingsForm({
  business,
  onSaved,
}: {
  business: BusinessSettings;
  onSaved: () => Promise<void>;
}) {
  const [formData, setFormData] = useState(() =>
    toEditableSettings(business),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof EditableBusinessSettings;
    setFormData((previous) => ({
      ...previous,
      [field]: event.target.value || null,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      await updateBusinessSettings(business.business_code, formData);
      await onSaved();
      setMessage({
        text: 'הנתונים נשמרו בהצלחה.',
        type: 'success',
      });
    } catch (error) {
      console.error('שגיאה בשמירת הגדרות:', error);
      setMessage({
        text: 'לא ניתן לשמור את ההגדרות.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label>שם העסק</label>
          <input
            type="text"
            name="business_name"
            value={formData.business_name}
            onChange={handleChange}
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <label>טלפון ליצירת קשר</label>
          <input
            type="text"
            name="contact_phone"
            value={formData.contact_phone || ''}
            onChange={handleChange}
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Vapi Assistant ID (מזהה בוט קולי)</label>
          <input
            type="text"
            name="vapi_assistant_id"
            value={formData.vapi_assistant_id || ''}
            onChange={handleChange}
            className={styles.input}
            dir="ltr"
          />
        </div>
        <div className={styles.formGroup}>
          <label>WhatsApp Instance ID</label>
          <input
            type="text"
            name="wa_instance_id"
            value={formData.wa_instance_id || ''}
            onChange={handleChange}
            className={styles.input}
            dir="ltr"
          />
        </div>
      </div>

      {message && (
        <p className={styles[message.type]} role="status">
          {message.text}
        </p>
      )}

      <button
        type="button"
        className={styles.btnPrimary}
        onClick={() => void handleSave()}
        disabled={isSaving}
      >
        {isSaving ? 'שומר...' : 'שמור הגדרות עסק'}
      </button>
    </div>
  );
}

function ServicesTable({ services }: { services: Service[] }) {
  return (
    <div>
      <button
        className={`${styles.btnPrimary} ${styles.addServiceButton}`}
        disabled
        title="בפיתוח"
      >
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
              <td colSpan={6} className={styles.emptyServices}>
                לא הוגדרו שירותים
              </td>
            </tr>
          ) : (
            services.map((service) => (
              <tr key={`${service.business_code}-${service.id}`}>
                <td>{service.service_code}</td>
                <td>{service.title}</td>
                <td>{service.duration_minutes}</td>
                <td>{service.price}</td>
                <td>
                  <span className={styles.colorCell}>
                    <span
                      className={styles.colorBadge}
                      style={{
                        backgroundColor: service.color_code || '#dce7eb',
                      }}
                      aria-hidden="true"
                    />
                    {service.color_code || 'לא הוגדר'}
                  </span>
                </td>
                <td>{service.is_active ? 'פעיל' : 'לא פעיל'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}