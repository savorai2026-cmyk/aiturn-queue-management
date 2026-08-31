import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { deleteService, deleteStatus, updateBusinessSettings } from '../settings.api';
import { getErrorMessage } from '../../../shared/errors';
import {
  formatServiceCell,
  formatStatusCell,
  toBusinessDetailRows,
  toServiceDetailRows,
  toStatusDetailRows,
} from '../settings.mappers';
import type {
  AppointmentStatusRow,
  BusinessSettings,
  EditableBusinessSettings,
  Service,
} from '../settings.types';
import { useSettings } from '../useSettings';
import { useBusiness } from '../../business/BusinessContextState';
import { usePaymentMethod } from '../../billing/usePaymentMethod';
import PaymentMethodSettings from '../../billing/PaymentMethodSettings';
import {
  ErrorState,
  LoadingState,
} from '../../../shared/components/PageState';
import DisplayToolbar from '../../../shared/displayFields/DisplayToolbar';
import RecordDetailsModal from '../../../shared/displayFields/RecordDetailsModal';
import {
  BUSINESS_FIELDS,
  SERVICE_FIELDS,
  STATUS_FIELDS,
} from '../../../shared/displayFields/catalogs';
import { useUiPreferences } from '../../../shared/displayFields/useUiPreferences';
import IconButton, {
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '../../../shared/components/IconButton';
import { SaveIcon } from '../../../shared/components/icons';
import HelpTip from '../../../shared/components/HelpTip';
import { getTimezoneGroups } from '../timezones';
import AddServiceModal from './AddServiceModal';
import OperatingHoursForm from './OperatingHoursForm';
import StatusModal from './StatusModal';
import TimezoneSelect from './TimezoneSelect';
import styles from './Settings.module.css';

type SettingsTab = 'business' | 'hours' | 'services' | 'statuses' | 'payment';

const SETTINGS_TABS: SettingsTab[] = [
  'business',
  'hours',
  'services',
  'statuses',
  'payment',
];

function readStoredSettingsTab(businessCode: string): SettingsTab {
  try {
    const stored = sessionStorage.getItem(`settingsTab:${businessCode}`);
    if (stored && SETTINGS_TABS.includes(stored as SettingsTab)) {
      return stored as SettingsTab;
    }
  } catch {
    /* ignore */
  }
  return 'business';
}

interface SettingsProps {
  businessCode: string;
  onBusinessUpdated: () => Promise<void>;
}

export default function Settings({
  businessCode,
  onBusinessUpdated,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(() =>
    readStoredSettingsTab(businessCode),
  );
  const { business, services, statuses, error, isLoading, refresh } =
    useSettings(businessCode);
  const { activeBusiness } = useBusiness();
  const payment = usePaymentMethod(businessCode);
  const { visibleFieldsFor, toggleField } = useUiPreferences(businessCode);

  useEffect(() => {
    setActiveTab(readStoredSettingsTab(businessCode));
  }, [businessCode]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`settingsTab:${businessCode}`, activeTab);
    } catch {
      /* ignore */
    }
  }, [activeTab, businessCode]);

  if (isLoading && !business) {
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
        <span className={styles.tabDivider} aria-hidden="true" />
        <button
          className={`${styles.tabBtn} ${activeTab === 'hours' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('hours')}
        >
          שעות פעילות
        </button>
        <span className={styles.tabDivider} aria-hidden="true" />
        <button
          className={`${styles.tabBtn} ${activeTab === 'services' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('services')}
        >
          סוגי תורים / שירותים
        </button>
        <span className={styles.tabDivider} aria-hidden="true" />
        <button
          className={`${styles.tabBtn} ${activeTab === 'statuses' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('statuses')}
        >
          הגדרת סטטוסים
        </button>
        <span className={styles.tabDivider} aria-hidden="true" />
        <button
          className={`${styles.tabBtn} ${activeTab === 'payment' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('payment')}
        >
          אמצעי תשלום
        </button>
      </div>

      <div className={styles.contentCard}>
        {activeTab === 'business' ? (
          <BusinessSettingsForm
            key={business.business_code}
            business={business}
            visibleFields={visibleFieldsFor('business')}
            onToggleField={(key) => toggleField('business', key)}
            onSaved={onBusinessUpdated}
          />
        ) : activeTab === 'hours' ? (
          <OperatingHoursForm
            key={`${business.business_code}-hours`}
            business={business}
            onSaved={async () => {
              await onBusinessUpdated();
              refresh();
            }}
          />
        ) : activeTab === 'services' ? (
          <ServicesTable
            businessCode={businessCode}
            services={services}
            visibleFields={visibleFieldsFor('services')}
            onToggleField={(key) => toggleField('services', key)}
            onServicesChanged={refresh}
          />
        ) : activeTab === 'statuses' ? (
          <StatusesTable
            businessCode={businessCode}
            statuses={statuses}
            visibleFields={visibleFieldsFor('statuses')}
            onToggleField={(key) => toggleField('statuses', key)}
            onStatusesChanged={refresh}
          />
        ) : (
          <PaymentMethodSettings
            businessCode={businessCode}
            role={activeBusiness?.role ?? 'viewer'}
            paymentMethod={payment.paymentMethod}
            isLoading={payment.isLoading}
            error={payment.error}
            onRefresh={payment.refresh}
          />
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
    email: business.email,
    agent_phone_number: business.agent_phone_number,
    timezone: business.timezone,
    slot_duration_minutes: business.slot_duration_minutes,
    vapi_assistant_id: business.vapi_assistant_id,
    wa_instance_id: business.wa_instance_id,
  };
}

function BusinessSettingsForm({
  business,
  visibleFields,
  onToggleField,
  onSaved,
}: {
  business: BusinessSettings;
  visibleFields: string[];
  onToggleField: (key: string) => void;
  onSaved: () => Promise<void>;
}) {
  const [formData, setFormData] = useState(() =>
    toEditableSettings(business),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const isVisible = (key: string) => visibleFields.includes(key);
  const timezoneGroups = useMemo(
    () => getTimezoneGroups(formData.timezone),
    [formData.timezone],
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof EditableBusinessSettings;
    const { value, type } = event.target;

    setFormData((previous) => ({
      ...previous,
      [field]:
        type === 'number'
          ? value === ''
            ? null
            : Number(value)
          : value || null,
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
      <div className={styles.sectionToolbar}>
        <DisplayToolbar
          fields={BUSINESS_FIELDS}
          visibleKeys={visibleFields}
          onToggle={onToggleField}
          onViewDetails={() => setIsDetailsOpen(true)}
          canViewDetails
        />
      </div>
      <div className={styles.formGrid}>
        {isVisible('business_name') && (
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
        )}
        {isVisible('contact_phone') && (
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
        )}
        {isVisible('email') && (
          <div className={styles.formGroup}>
            <label>אימייל</label>
            <input
              type="email"
              name="email"
              value={formData.email || ''}
              onChange={handleChange}
              className={styles.input}
              dir="ltr"
            />
          </div>
        )}
        {isVisible('agent_phone_number') && (
          <div className={styles.formGroup}>
            <label>טלפון סוכן</label>
            <input
              type="text"
              name="agent_phone_number"
              value={formData.agent_phone_number || ''}
              onChange={handleChange}
              className={styles.input}
              dir="ltr"
            />
          </div>
        )}
        {isVisible('timezone') && (
          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="business-timezone">אזור זמן</label>
              <HelpTip text="אזור הזמן של העסק. לפי זה מחושבות שעות היומן." />
            </div>
            <TimezoneSelect
              id="business-timezone"
              value={formData.timezone || ''}
              groups={timezoneGroups}
              onChange={(timezone) =>
                setFormData((previous) => ({
                  ...previous,
                  timezone: timezone || null,
                }))
              }
            />
          </div>
        )}
        {isVisible('slot_duration_minutes') && (
          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="business-slot-duration">משך משבצת (דקות)</label>
              <HelpTip text="גודל משבצת הזמן ביומן. לדוגמה 15 או 30 דקות. זה לא משך הטיפול עצמו." />
            </div>
            <input
              id="business-slot-duration"
              type="number"
              name="slot_duration_minutes"
              value={formData.slot_duration_minutes ?? ''}
              onChange={handleChange}
              className={styles.input}
              min="1"
            />
          </div>
        )}
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
        {isSaving ? 'שומר...' : (
          <>
            <SaveIcon />
            שמור הגדרות עסק
          </>
        )}
      </button>

      {isDetailsOpen && (
        <RecordDetailsModal
          title={`פרטי העסק · ${business.business_name}`}
          rows={toBusinessDetailRows({ ...business, ...formData })}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}
    </div>
  );
}

function ServicesTable({
  businessCode,
  services,
  visibleFields,
  onToggleField,
  onServicesChanged,
}: {
  businessCode: string;
  services: Service[];
  visibleFields: string[];
  onToggleField: (key: string) => void;
  onServicesChanged: () => void;
}) {
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const activeColumns = SERVICE_FIELDS.filter((field) =>
    visibleFields.includes(field.key),
  );
  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? null;

  const handleDelete = async (service = selectedService) => {
    if (!service) return;
    if (!window.confirm(`למחוק את השירות "${service.title}"?`)) {
      return;
    }

    setActionError('');
    try {
      await deleteService(businessCode, service.id);
      setSelectedServiceId(null);
      onServicesChanged();
    } catch (error) {
      const message = getErrorMessage(error).toLowerCase();
      console.error('שגיאה במחיקת שירות:', getErrorMessage(error));
      setActionError(
        message.includes('foreign key') || message.includes('violat')
          ? 'לא ניתן למחוק שירות שכבר בשימוש בתורים. אפשר לסמן אותו כלא פעיל.'
          : 'לא ניתן למחוק את השירות.',
      );
    }
  };

  return (
    <div>
      <div className={styles.sectionToolbar}>
        <DisplayToolbar
          fields={SERVICE_FIELDS}
          visibleKeys={visibleFields}
          onToggle={onToggleField}
          onViewDetails={() => setIsDetailsOpen(true)}
          canViewDetails={selectedService !== null}
        />
        <button
          type="button"
          className={`${styles.btnPrimary} ${styles.addServiceButton}`}
          onClick={() => setModalMode('add')}
        >
          <PlusIcon />
          הוסף שירות
        </button>
      </div>

      {actionError && (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      )}

      <table className={`data-table ${styles.table}`}>
        <thead>
          <tr>
            <th>פעולות</th>
            {activeColumns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {services.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(activeColumns.length, 1) + 1}
                className={styles.emptyServices}
              >
                לא הוגדרו שירותים
              </td>
            </tr>
          ) : (
            services.map((service) => (
              <tr
                key={`${service.business_code}-${service.id}`}
                className={
                  selectedServiceId === service.id ? 'is-selected' : undefined
                }
                onClick={() => setSelectedServiceId(service.id)}
                onDoubleClick={() => {
                  setSelectedServiceId(service.id);
                  setModalMode('edit');
                }}
              >
                <td>
                  <div className={styles.rowActions}>
                    <IconButton
                      label="ערוך שירות"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedServiceId(service.id);
                        setModalMode('edit');
                      }}
                    >
                      <PencilIcon />
                    </IconButton>
                    <IconButton
                      label="מחק שירות"
                      variant="danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedServiceId(service.id);
                        void handleDelete(service);
                      }}
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                </td>
                {activeColumns.map((column) => (
                  <td key={column.key} dir={column.dir}>
                    {formatServiceCell(service, column.key)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {modalMode && (modalMode === 'add' || selectedService) && (
        <AddServiceModal
          businessCode={businessCode}
          service={modalMode === 'edit' ? selectedService : null}
          onClose={() => setModalMode(null)}
          onSuccess={() => {
            onServicesChanged();
            setModalMode(null);
          }}
        />
      )}

      {isDetailsOpen && selectedService && (
        <RecordDetailsModal
          title={`פרטי שירות · ${selectedService.title}`}
          rows={toServiceDetailRows(selectedService)}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}
    </div>
  );
}

function StatusesTable({
  businessCode,
  statuses,
  visibleFields,
  onToggleField,
  onStatusesChanged,
}: {
  businessCode: string;
  statuses: AppointmentStatusRow[];
  visibleFields: string[];
  onToggleField: (key: string) => void;
  onStatusesChanged: () => void;
}) {
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [selectedStatusCode, setSelectedStatusCode] = useState<string | null>(
    null,
  );
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const activeColumns = STATUS_FIELDS.filter((field) =>
    visibleFields.includes(field.key),
  );
  const selectedStatus =
    statuses.find((status) => status.status_code === selectedStatusCode) ??
    null;

  const handleDelete = async (status = selectedStatus) => {
    if (!status) return;
    if (!window.confirm(`למחוק את הסטטוס "${status.status_text}"?`)) {
      return;
    }

    setActionError('');
    try {
      await deleteStatus(businessCode, status.status_code);
      setSelectedStatusCode(null);
      onStatusesChanged();
    } catch (error) {
      console.error('שגיאה במחיקת סטטוס:', getErrorMessage(error));
      setActionError('לא ניתן למחוק את הסטטוס.');
    }
  };

  return (
    <div>
      <div className={styles.sectionToolbar}>
        <DisplayToolbar
          fields={STATUS_FIELDS}
          visibleKeys={visibleFields}
          onToggle={onToggleField}
          onViewDetails={() => setIsDetailsOpen(true)}
          canViewDetails={selectedStatus !== null}
        />
        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={`${styles.btnPrimary} ${styles.addServiceButton}`}
            onClick={() => setModalMode('add')}
          >
            <PlusIcon />
            הוסף סטטוס
          </button>
        </div>
      </div>

      {actionError && (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      )}

      <table className={`data-table ${styles.table}`}>
        <thead>
          <tr>
            <th>פעולות</th>
            {activeColumns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {statuses.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(activeColumns.length, 1) + 1}
                className={styles.emptyServices}
              >
                לא הוגדרו סטטוסים
              </td>
            </tr>
          ) : (
            statuses.map((status) => (
              <tr
                key={`${status.business_code}-${status.status_code}`}
                className={
                  selectedStatusCode === status.status_code
                    ? 'is-selected'
                    : undefined
                }
                onClick={() => setSelectedStatusCode(status.status_code)}
                onDoubleClick={() => {
                  setSelectedStatusCode(status.status_code);
                  setModalMode('edit');
                }}
              >
                <td>
                  <div className={styles.rowActions}>
                    <IconButton
                      label="ערוך סטטוס"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedStatusCode(status.status_code);
                        setModalMode('edit');
                      }}
                    >
                      <PencilIcon />
                    </IconButton>
                    <IconButton
                      label="מחק סטטוס"
                      variant="danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedStatusCode(status.status_code);
                        void handleDelete(status);
                      }}
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                </td>
                {activeColumns.map((column) => (
                  <td key={column.key} dir={column.dir}>
                    {column.key === 'color' ? (
                      <span className={styles.colorCell}>
                        <span
                          className={styles.colorBadge}
                          style={{
                            backgroundColor: status.color || '#dce7eb',
                          }}
                          aria-hidden="true"
                        />
                        {formatStatusCell(status, column.key)}
                      </span>
                    ) : (
                      formatStatusCell(status, column.key)
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {modalMode && (modalMode === 'add' || selectedStatus) && (
        <StatusModal
          businessCode={businessCode}
          status={modalMode === 'edit' ? selectedStatus : null}
          onClose={() => setModalMode(null)}
          onSuccess={() => {
            onStatusesChanged();
            setModalMode(null);
          }}
        />
      )}

      {isDetailsOpen && selectedStatus && (
        <RecordDetailsModal
          title={`פרטי סטטוס · ${selectedStatus.status_text}`}
          rows={toStatusDetailRows(selectedStatus)}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}
    </div>
  );
}
