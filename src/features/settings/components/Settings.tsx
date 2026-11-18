import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { useSlidingIndicator } from '../../../shared/useSlidingIndicator';
import { MissingAgentVoiceColumnError } from '../agentVoiceColumn';
import {
  cancellationPolicyDraft,
  cancellationPolicyPayload,
} from '../cancellationPolicy';
import {
  arrivalPhotoPaths,
  arrivalPhotoUrls,
  deleteService,
  MAX_ARRIVAL_PHOTOS,
  removeArrivalPhotos,
  rewriteAgentPrompt,
  updateBusinessSettings,
  uploadArrivalPhoto,
} from '../settings.api';
import ArrivalAddressField from './ArrivalAddressField';
import StorageUsageMeter from './StorageUsageMeter';
import {
  BUSINESS_PHONE_TAKEN_MESSAGE,
  getAgentPromptRewriteErrorMessage,
  getErrorMessage,
  isBusinessPhoneTakenError,
} from '../../../shared/errors';
import {
  formatServiceCell,
  formatStatusCell,
  filterAndSortServices,
  filterAndSortStatuses,
  normalizeDepositPercent,
  normalizeRetentionDays,
  parseDepositPercent,
  toBusinessDetailRows,
  toBusinessConfigDetailRows,
  toServiceDetailRows,
  toStatusDetailRows,
} from '../settings.mappers';
import {
  DEFAULT_HISTORY_MONTHS,
  DEFAULT_RECORDING_RETENTION_DAYS,
  daysLimitText,
  includedStorageGb,
  monthsLimitText,
  normalizeHistoryMonths,
  parseSubscriptionPlan,
  type SubscriptionPlan,
} from '../../usage/planPricing';
import PlanCard from '../../usage/components/PlanCard';
import { usePlanTariffs } from '../../usage/tariffs.api';
import {
  INCLUDED_STORAGE_GB,
  alignStorageQuotaGb,
  displayStorageQuotaGb,
  normalizeStorageQuotaGb,
} from '../storageQuota';
import type {
  AppointmentStatusRow,
  BusinessSettings,
  EditableBusinessConfig,
  EditableBusinessProfile,
  Service,
} from '../settings.types';
import { useSettings } from '../useSettings';
import { canManageBusiness, useBusiness } from '../../business/BusinessContextState';
import { usePaymentMethod } from '../../billing/usePaymentMethod';
import { notifyBusinessAccessChanged } from '../../billing/accessEvents';
import PaymentMethodSettings from '../../billing/PaymentMethodSettings';
import {
  ErrorState,
  LoadingState,
  useReportPageReady,
} from '../../../shared/components/PageState';
import DisplayToolbar from '../../../shared/displayFields/DisplayToolbar';
import RecordDetailsModal from '../../../shared/displayFields/RecordDetailsModal';
import {
  BUSINESS_CONFIG_FIELDS,
  BUSINESS_FIELDS,
  SERVICE_FIELDS,
  STATUS_FIELDS,
} from '../../../shared/displayFields/catalogs';
import { useUiPreferences } from '../../../shared/displayFields/useUiPreferences';
import { orderCatalogFields } from '../../../shared/displayFields/preferences';
import ColumnTableHead, {
  columnTableStyles,
} from '../../../shared/displayFields/ColumnTableHead';
import {
  nextColumnSort,
  visibleColumnFilters,
  type ColumnFilters,
  type ColumnSort,
} from '../../../shared/displayFields/columnTable';
import IconButton, {
  PencilIcon,
  TrashIcon,
} from '../../../shared/components/IconButton';
import { SaveIcon } from '../../../shared/components/icons';
import HelpTip from '../../../shared/components/HelpTip';
import { getTimezoneGroups } from '../timezones';
import {
  BUSINESS_PAYMENT_OPTIONS,
  DEFAULT_PAYMENT_HOLD_HOURS,
  MAX_PAYMENT_HOLD_HOURS,
  parseBusinessPaymentRequirement,
  validatePrepayment,
} from '../prepayment';
import AddServiceModal from './AddServiceModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import BusinessAccountPanel from './BusinessAccountPanel';
import TwoFactorPanel from './TwoFactorPanel';
import OperatingHoursForm from './OperatingHoursForm';
import AgentVoicePicker from './AgentVoicePicker';
import RewriteAgentPromptModal from './RewriteAgentPromptModal';
import StatusModal from './StatusModal';
import TimezoneSelect from './TimezoneSelect';
import styles from './Settings.module.css';

type SettingsTab =
  | 'subscription'
  | 'business'
  | 'config'
  | 'hours'
  | 'services'
  | 'statuses'
  | 'payment'
  | 'account';

const SETTINGS_TABS: SettingsTab[] = [
  'subscription',
  'business',
  'config',
  'hours',
  'services',
  'statuses',
  'payment',
  'account',
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
  onReady?: () => void;
}

function SettingsTabs({
  activeTab,
  isOwner,
  onChange,
}: {
  activeTab: SettingsTab;
  isOwner: boolean;
  onChange: (tab: SettingsTab) => void;
}) {
  const { containerRef, box, ready } = useSlidingIndicator(
    `${activeTab}:${isOwner ? 'owner' : 'member'}`,
  );
  const tab = (id: SettingsTab, label: string) => (
    <button
      type="button"
      className={`${styles.tabBtn} ${activeTab === id ? styles.activeTab : ''}`}
      aria-current={activeTab === id ? 'page' : undefined}
      onClick={() => onChange(id)}
    >
      {label}
    </button>
  );

  return (
    <div className={styles.tabs} ref={containerRef}>
      {box ? (
        <span
          className={`${styles.tabIndicator} ${ready ? styles.tabIndicatorReady : ''}`}
          style={{
            width: box.width,
            transform: `translate(${box.x}px, ${box.y}px)`,
          }}
          aria-hidden="true"
        />
      ) : null}
      {isOwner ? (
        <>
          {tab('subscription', 'מנוי')}
          <span className={styles.tabDivider} aria-hidden="true" />
        </>
      ) : null}
      {tab('business', 'פרטי העסק')}
      {isOwner ? (
        <>
          <span className={styles.tabDivider} aria-hidden="true" />
          {tab('config', 'הגדרות העסק')}
        </>
      ) : null}
      <span className={styles.tabDivider} aria-hidden="true" />
      {tab('hours', 'שעות פעילות')}
      <span className={styles.tabDivider} aria-hidden="true" />
      {tab('services', 'סוגי תורים / שירותים')}
      <span className={styles.tabDivider} aria-hidden="true" />
      {tab('statuses', 'הגדרת סטטוסים')}
      <span className={styles.tabDivider} aria-hidden="true" />
      {tab('payment', 'אמצעי תשלום')}
      <span className={styles.tabDivider} aria-hidden="true" />
      {tab('account', 'חשבון')}
    </div>
  );
}

export default function Settings({
  businessCode,
  onBusinessUpdated,
  onReady,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(() =>
    readStoredSettingsTab(businessCode),
  );
  const { business, services, statuses, error, isLoading, refresh } =
    useSettings(businessCode);
  useReportPageReady(!(isLoading && !business) || Boolean(error), onReady);
  const { activeBusiness } = useBusiness();
  const isOwner = activeBusiness?.role === 'owner';
  const canManage = canManageBusiness(activeBusiness?.role);
  const payment = usePaymentMethod(businessCode);
  const { visibleFieldsFor, toggleField, reorderFields } = useUiPreferences(businessCode);
  const handleBusinessSaved = async () => {
    await onBusinessUpdated();
    refresh();
    notifyBusinessAccessChanged(businessCode);
  };

  useEffect(() => {
    setActiveTab(readStoredSettingsTab(businessCode));
  }, [businessCode]);

  useEffect(() => {
    if (!isOwner && (activeTab === 'config' || activeTab === 'subscription')) {
      setActiveTab('business');
    }
  }, [activeTab, isOwner]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`settingsTab:${businessCode}`, activeTab);
    } catch {
      /* ignore */
    }
  }, [activeTab, businessCode]);

  useEffect(() => {
    if (!business || activeTab !== 'subscription') return;
    const key = `settingsScroll:${businessCode}`;
    let target: string | null = null;
    try {
      target = sessionStorage.getItem(key);
      if (target) sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    if (target !== 'cloud-storage' && target !== 'subscription-plan') return;
    const frame = window.requestAnimationFrame(() => {
      const section = document.getElementById(target);
      section
        ?.querySelector<HTMLButtonElement>(':scope > header > button[aria-expanded="false"]')
        ?.click();
      section?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, business, businessCode]);

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
      <SettingsTabs
        activeTab={activeTab}
        isOwner={Boolean(isOwner)}
        onChange={setActiveTab}
      />

      <div className={styles.contentCard}>
        {activeTab === 'subscription' && isOwner ? (
          <SubscriptionForm
            key={`${business.business_code}-subscription`}
            business={business}
            onSaved={handleBusinessSaved}
          />
        ) : activeTab === 'business' ? (
          <BusinessProfileForm
            key={business.business_code}
            business={business}
            readOnly={!canManage}
            visibleFields={visibleFieldsFor('business')}
            onToggleField={(key) => toggleField('business', key)}
            onSaved={handleBusinessSaved}
          />
        ) : activeTab === 'config' && isOwner ? (
          <BusinessConfigForm
            key={`${business.business_code}-config`}
            business={business}
            visibleFields={visibleFieldsFor('businessConfig')}
            onToggleField={(key) => toggleField('businessConfig', key)}
            onSaved={handleBusinessSaved}
          />
        ) : activeTab === 'hours' ? (
          <OperatingHoursForm
            key={`${business.business_code}-hours`}
            business={business}
            readOnly={!canManage}
            onSaved={handleBusinessSaved}
          />
        ) : activeTab === 'services' ? (
          <ServicesTable
            businessCode={businessCode}
            services={services}
            readOnly={!canManage}
            visibleFields={visibleFieldsFor('services')}
            onToggleField={(key) => toggleField('services', key)}
            onReorderFields={(keys) => reorderFields('services', keys)}
            onServicesChanged={refresh}
          />
        ) : activeTab === 'statuses' ? (
          <StatusesTable
            businessCode={businessCode}
            statuses={statuses}
            readOnly={!canManage}
            visibleFields={visibleFieldsFor('statuses')}
            onToggleField={(key) => toggleField('statuses', key)}
            onReorderFields={(keys) => reorderFields('statuses', keys)}
            onStatusesChanged={refresh}
          />
        ) : activeTab === 'payment' ? (
          <PaymentMethodSettings
            businessCode={businessCode}
            role={activeBusiness?.role ?? 'viewer'}
            paymentMethod={payment.paymentMethod}
            isLoading={payment.isLoading}
            error={payment.error}
            onRefresh={() => {
              payment.refresh();
              void handleBusinessSaved();
            }}
          />
        ) : activeTab === 'account' ? (
          <div>
            {isOwner ? (
              <BusinessAccountPanel
                businessCode={business.business_code}
                plan={parseSubscriptionPlan(business.subscription_plan)}
                agentsActive={business.is_active !== false}
                accountClosed={Boolean(business.closed_at)}
              />
            ) : null}
            <TwoFactorPanel />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function toEditableProfile(
  business: BusinessSettings,
): EditableBusinessProfile {
  return {
    business_name: business.business_name,
    contact_phone: business.contact_phone,
    email: business.email,
    agent_phone_number: business.agent_phone_number,
    arrival_address: business.arrival_address ?? null,
    arrival_parking: business.arrival_parking ?? null,
    arrival_waze_url: business.arrival_waze_url ?? null,
    arrival_photo_paths: arrivalPhotoPaths(business.arrival_photo_paths),
  };
}

function toEditableConfig(
  business: BusinessSettings,
): EditableBusinessConfig {
  return {
    timezone: business.timezone,
    slot_duration_minutes: business.slot_duration_minutes,
    deposit_percent: parseDepositPercent(business.deposit_percent),
    default_payment_requirement: parseBusinessPaymentRequirement(
      business.default_payment_requirement,
    ),
    payment_payee_name: business.payment_payee_name,
    payment_instructions: business.payment_instructions,
    payment_hold_hours: business.payment_hold_hours ?? DEFAULT_PAYMENT_HOLD_HOURS,
    agent_prompt: business.agent_prompt,
    agent_voice_id: business.agent_voice_id,
    cancellation_policy: business.cancellation_policy,
    save_recordings: business.save_recordings !== false,
    subscription_plan: parseSubscriptionPlan(business.subscription_plan),
    recordings_retention_days:
      normalizeRetentionDays(
        business.recordings_retention_days,
        parseSubscriptionPlan(business.subscription_plan),
      ) ?? DEFAULT_RECORDING_RETENTION_DAYS,
    history_retention_months:
      normalizeHistoryMonths(
        business.history_retention_months,
        parseSubscriptionPlan(business.subscription_plan),
      ) ?? DEFAULT_HISTORY_MONTHS,
    voice_log_retention_months:
      normalizeHistoryMonths(
        business.voice_log_retention_months,
        parseSubscriptionPlan(business.subscription_plan),
      ) ?? DEFAULT_HISTORY_MONTHS,
    whatsapp_retention_months:
      normalizeHistoryMonths(
        business.whatsapp_retention_months,
        parseSubscriptionPlan(business.subscription_plan),
      ) ?? DEFAULT_HISTORY_MONTHS,
    storage_quota_gb: displayStorageQuotaGb(
      normalizeStorageQuotaGb(business.storage_quota_gb) ?? INCLUDED_STORAGE_GB,
      includedStorageGb(parseSubscriptionPlan(business.subscription_plan)),
    ),
    is_active: business.is_active !== false,
    owner_alert_channel: business.owner_alert_channel,
    owner_alert_phone: business.owner_alert_phone,
    owner_alert_lead_hours: business.owner_alert_lead_hours ?? 24,
  };
}

const READ_ONLY_NOTE = 'צפייה בלבד. רק בעלים או מנהל יכולים לשנות כאן.';

function BusinessProfileForm({
  business,
  readOnly,
  visibleFields,
  onToggleField,
  onSaved,
}: {
  business: BusinessSettings;
  readOnly: boolean;
  visibleFields: string[];
  onToggleField: (key: string) => void;
  onSaved: () => Promise<void>;
}) {
  const [formData, setFormData] = useState(() => toEditableProfile(business));
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const savedProfile = useMemo(() => toEditableProfile(business), [business]);
  const hasChanges =
    JSON.stringify(formData) !== JSON.stringify(savedProfile) || newPhotos.length > 0;
  const [isSaving, setIsSaving] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const isVisible = (key: string) => visibleFields.includes(key);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof EditableBusinessProfile;
    setFormData((previous) => ({
      ...previous,
      [field]:
        field === 'business_name'
          ? event.target.value
          : event.target.value || null,
    }));
  };

  useEffect(() => {
    setNewPhotos([]);
  }, [business.business_code, business.arrival_photo_paths]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const previousPaths = arrivalPhotoPaths(business.arrival_photo_paths);
      const kept = arrivalPhotoPaths(formData.arrival_photo_paths);
      const uploaded: string[] = [];
      for (const file of newPhotos) {
        uploaded.push(await uploadArrivalPhoto(business.business_code, file));
      }
      const photoPaths = [...kept, ...uploaded].slice(0, MAX_ARRIVAL_PHOTOS);
      const removed = previousPaths.filter((path) => !kept.includes(path));
      if (removed.length > 0) {
        await removeArrivalPhotos(removed);
      }
      const arrivalAddress = formData.arrival_address?.trim() || null;
      await updateBusinessSettings(business.business_code, {
        ...formData,
        business_name: formData.business_name.trim(),
        arrival_address: arrivalAddress,
        arrival_parking: formData.arrival_parking?.trim() || null,
        arrival_waze_url: arrivalAddress ? formData.arrival_waze_url?.trim() || null : null,
        arrival_photo_paths: photoPaths,
      });
      setFormData((previous) => ({
        ...previous,
        business_name: previous.business_name.trim(),
        arrival_address: arrivalAddress,
        arrival_parking: previous.arrival_parking?.trim() || null,
        arrival_waze_url: arrivalAddress ? previous.arrival_waze_url?.trim() || null : null,
        arrival_photo_paths: photoPaths,
      }));
      setNewPhotos([]);
      await onSaved();
      setMessage({
        text: 'הנתונים נשמרו בהצלחה.',
        type: 'success',
      });
    } catch (error) {
      console.error('שגיאה בשמירת פרטי עסק:', error);
      const text = isBusinessPhoneTakenError(error)
        ? BUSINESS_PHONE_TAKEN_MESSAGE
        : error instanceof Error && error.message
          ? error.message
          : 'לא ניתן לשמור את פרטי העסק.';
      setMessage({ text, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.settingsColumn}>
      <div className={styles.stickyBar}>
        <div className={styles.sectionToolbar}>
          <DisplayToolbar
            fields={BUSINESS_FIELDS}
            visibleKeys={visibleFields}
            onToggle={onToggleField}
            onViewDetails={() => setIsDetailsOpen(true)}
            canViewDetails
          />
          {readOnly ? null : (
            <button
              type="button"
              className={`${styles.btnPrimary} ${styles.toolbarSave}`}
              onClick={() => void handleSave()}
              disabled={isSaving || !hasChanges}
              title={hasChanges ? 'שמירת פרטי עסק' : 'אין שינויים לשמירה'}
            >
              {isSaving ? 'שומר...' : (
                <>
                  <SaveIcon />
                  שמור פרטי עסק
                </>
              )}
            </button>
          )}
        </div>
        {message && (
          <p className={styles[message.type]} role="status">
            {message.text}
          </p>
        )}
      </div>
      {readOnly ? <p className={styles.readOnlyNote}>{READ_ONLY_NOTE}</p> : null}
      <fieldset className={styles.lockedFields} disabled={readOnly}>
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
      </div>
      <div className={styles.arrivalBlock}>
      <SettingsGroup
        title="הגעה וחניה"
        description="לקוח חדש מקבל את זה עם ההזמנה הראשונה: כתובת, איך חונים, קישור לניווט, ותמונות של הכניסה."
      >
        <SettingsRow label="כתובת" htmlFor="business-arrival-address" stacked>
          <ArrivalAddressField
            id="business-arrival-address"
            address={formData.arrival_address || ''}
            wazeUrl={formData.arrival_waze_url || ''}
            inputClassName={styles.input}
            onChange={({ address, wazeUrl }) =>
              setFormData((previous) => ({
                ...previous,
                arrival_address: address,
                arrival_waze_url: wazeUrl || null,
              }))
            }
          />
        </SettingsRow>
        <SettingsRow
          label="חניה"
          htmlFor="business-arrival-parking"
          help="איפה חונים, ואם צריך לשלם או להביא פתק."
          stacked
        >
          <input
            id="business-arrival-parking"
            type="text"
            className={styles.input}
            value={formData.arrival_parking || ''}
            onChange={(event) =>
              setFormData((previous) => ({
                ...previous,
                arrival_parking: event.target.value,
              }))
            }
          />
        </SettingsRow>
        <SettingsRow
          label="תמונות הכניסה"
          htmlFor="business-arrival-photos"
          help="עד שלוש תמונות. הן נשלחות ללקוח חדש יחד עם הכתובת."
          stacked
        >
          <ArrivalPhotos
            paths={arrivalPhotoPaths(formData.arrival_photo_paths)}
            files={newPhotos}
            onRemovePath={(path) =>
              setFormData((previous) => ({
                ...previous,
                arrival_photo_paths: arrivalPhotoPaths(previous.arrival_photo_paths).filter(
                  (item) => item !== path,
                ),
              }))
            }
            onRemoveFile={(index) =>
              setNewPhotos((previous) => previous.filter((_, item) => item !== index))
            }
            onAdd={(files) => {
              const room = MAX_ARRIVAL_PHOTOS
                - arrivalPhotoPaths(formData.arrival_photo_paths).length
                - newPhotos.length;
              const images = files.filter((file) => file.type.startsWith('image/')).slice(0, Math.max(room, 0));
              if (images.length > 0) {
                setNewPhotos((previous) => [...previous, ...images]);
              }
            }}
          />
        </SettingsRow>
      </SettingsGroup>
      </div>
      </fieldset>

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

function SettingsStack({ children }: { children: ReactNode }) {
  return <div className={styles.settingsStack}>{children}</div>;
}

function SettingsGroup({
  id,
  title,
  description,
  action,
  defaultCollapsed = false,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  defaultCollapsed?: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section
      id={id}
      className={`${styles.settingsGroup} ${collapsed ? styles.settingsGroupCollapsed : ''}`}
    >
      <header
        className={`${styles.settingsGroupHeader} ${!collapsed && action ? styles.settingsGroupHeaderWithAction : ''}`}
      >
        <button
          type="button"
          className={styles.headerHit}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((current) => !current)}
        >
          <span className={styles.groupToggle}>
            <span
              className={`${styles.groupChevron} ${collapsed ? styles.groupChevronCollapsed : ''}`}
              aria-hidden="true"
            />
            <h3>{title}</h3>
          </span>
          {!collapsed && description ? <p>{description}</p> : null}
        </button>
        {!collapsed && action ? (
          <div className={styles.headerAction}>{action}</div>
        ) : null}
      </header>
      {collapsed ? null : <div className={styles.settingsRows}>{children}</div>}
    </section>
  );
}

function SettingsRow({
  label,
  htmlFor,
  help,
  hint,
  stacked = false,
  fill = false,
  children,
}: {
  label: string;
  htmlFor?: string;
  help?: string;
  hint?: string;
  stacked?: boolean;
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`${styles.settingsRow} ${stacked ? styles.settingsRowStacked : ''}`}
    >
      <div className={styles.settingsCopy}>
        <div className={styles.labelRow}>
          <label htmlFor={htmlFor}>{label}</label>
          {help ? <HelpTip text={help} /> : null}
        </div>
        {hint ? <p className={styles.settingsHint}>{hint}</p> : null}
      </div>
      <div
        className={`${styles.settingsControl} ${fill ? styles.settingsControlFill : ''}`}
      >
        {children}
      </div>
    </div>
  );
}

function ArrivalPhotos({
  paths,
  files,
  onRemovePath,
  onRemoveFile,
  onAdd,
}: {
  paths: string[];
  files: File[];
  onRemovePath: (path: string) => void;
  onRemoveFile: (index: number) => void;
  onAdd: (files: File[]) => void;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const room = MAX_ARRIVAL_PHOTOS - paths.length - files.length;
  const pathKey = paths.join('|');

  useEffect(() => {
    let cancelled = false;
    const current = pathKey ? pathKey.split('|') : [];
    void arrivalPhotoUrls(current)
      .then((signed) => {
        if (!cancelled) setUrls(signed);
      })
      .catch(() => {
        if (!cancelled) setUrls({});
      });
    return () => {
      cancelled = true;
    };
  }, [pathKey]);

  useEffect(() => {
    const created = files.map((file) => URL.createObjectURL(file));
    setFileUrls(created);
    return () => {
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  const empty = paths.length === 0 && files.length === 0;

  return (
    <div className={`${styles.arrivalPhotos} ${empty ? styles.arrivalPhotosEmpty : ''}`}>
      {paths.map((path) => (
        <div key={path} className={styles.arrivalPhoto}>
          {urls[path] ? <img src={urls[path]} alt="הכניסה לעסק" /> : <span className={styles.arrivalPending}>תמונה שמורה</span>}
          <button type="button" className={styles.arrivalRemove} onClick={() => onRemovePath(path)}>
            הסרה
          </button>
        </div>
      ))}
      {files.map((file, index) => (
        <div key={`${file.name}-${index}`} className={styles.arrivalPhoto}>
          {fileUrls[index] ? <img src={fileUrls[index]} alt={file.name} /> : null}
          <button type="button" className={styles.arrivalRemove} onClick={() => onRemoveFile(index)}>
            הסרה
          </button>
        </div>
      ))}
      {room > 0 || empty ? (
        <div className={styles.fileRow}>
          {room > 0 ? (
            <label className={styles.filePick} htmlFor="business-arrival-photos">
              בחירת תמונות
              <input
                id="business-arrival-photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => {
                  onAdd(Array.from(event.target.files ?? []));
                  event.target.value = '';
                }}
              />
            </label>
          ) : null}
          {empty ? <span className={styles.fileHint}>לא נבחרו תמונות</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function BusinessConfigForm({
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
  const [formData, setFormData] = useState(() => toEditableConfig(business));
  const [policyDraft, setPolicyDraft] = useState(() =>
    cancellationPolicyDraft(business.cancellation_policy),
  );
  const savedConfig = useMemo(() => toEditableConfig(business), [business]);
  const savedPolicy = useMemo(
    () => cancellationPolicyDraft(business.cancellation_policy),
    [business],
  );
  const withoutPolicy = (config: typeof formData) => ({ ...config, cancellation_policy: null });
  const hasChanges =
    JSON.stringify(withoutPolicy(formData)) !== JSON.stringify(withoutPolicy(savedConfig)) ||
    JSON.stringify(policyDraft) !== JSON.stringify(savedPolicy);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteText, setRewriteText] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState('');
  const [message, setMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);
  const tariffs = usePlanTariffs(business.business_code);

  const isVisible = (key: string) => visibleFields.includes(key);
  const timezoneGroups = useMemo(
    () => getTimezoneGroups(formData.timezone),
    [formData.timezone],
  );

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const depositPercent = normalizeDepositPercent(formData.deposit_percent);
      const payeeName = formData.payment_payee_name?.trim() || null;
      const paymentInstructions = formData.payment_instructions?.trim() || null;
      const prepaymentError = validatePrepayment({
        requirement: formData.default_payment_requirement,
        depositPercent: depositPercent ?? Number.NaN,
        payeeName: payeeName ?? '',
        instructions: paymentInstructions ?? '',
        holdHours: formData.payment_hold_hours,
      });
      if (depositPercent == null || prepaymentError) {
        setMessage({
          text: prepaymentError ?? 'אחוז המקדמה חייב להיות מספר בין 0 ל-100.',
          type: 'error',
        });
        return;
      }

      const subscriptionPlan = parseSubscriptionPlan(business.subscription_plan);
      const terms = tariffs.resolve(subscriptionPlan);
      const retentionDays = normalizeRetentionDays(
        formData.recordings_retention_days,
        subscriptionPlan,
        terms.recordingMaxDays,
      );
      const historyMonths = normalizeHistoryMonths(
        formData.history_retention_months,
        subscriptionPlan,
        terms.historyMaxMonths,
      );
      const whatsappMonths = normalizeHistoryMonths(
        formData.whatsapp_retention_months,
        subscriptionPlan,
        terms.correspondenceMaxMonths,
      );
      if (retentionDays == null) {
        setMessage({
          text: `ימי שמירת ההקלטות חייבים להיות מספר שלם בין 1 ל-${terms.recordingMaxDays}.`,
          type: 'error',
        });
        return;
      }
      if (historyMonths == null) {
        setMessage({
          text: `חודשי היסטוריית התורים חייבים להיות מספר שלם בין 1 ל-${terms.historyMaxMonths}.`,
          type: 'error',
        });
        return;
      }
      if (whatsappMonths == null) {
        setMessage({
          text: `חודשי ההתכתבות והתמלול חייבים להיות מספר שלם בין 1 ל-${terms.correspondenceMaxMonths}.`,
          type: 'error',
        });
        return;
      }

      const policy = cancellationPolicyPayload(policyDraft);
      if ('error' in policy) {
        setMessage({ text: policy.error, type: 'error' });
        return;
      }

      const alertChannel = formData.owner_alert_channel || null;
      const alertPhone = formData.owner_alert_phone?.trim() || null;
      if (alertChannel && !alertPhone) {
        setMessage({
          text: 'כדי לשלוח התראה צריך גם מספר.',
          type: 'error',
        });
        return;
      }

      await updateBusinessSettings(business.business_code, {
        timezone: formData.timezone,
        slot_duration_minutes: formData.slot_duration_minutes,
        deposit_percent: depositPercent,
        default_payment_requirement: formData.default_payment_requirement,
        payment_payee_name: payeeName,
        payment_instructions: paymentInstructions,
        payment_hold_hours: formData.payment_hold_hours,
        agent_prompt: formData.agent_prompt?.trim() || null,
        agent_voice_id: formData.agent_voice_id?.trim() || null,
        save_recordings: formData.save_recordings,
        recordings_retention_days: retentionDays,
        history_retention_months: historyMonths,
        voice_log_retention_months: whatsappMonths,
        whatsapp_retention_months: whatsappMonths,
        is_active: formData.is_active,
        cancellation_policy: policy.value,
        owner_alert_channel: alertChannel,
        owner_alert_phone: alertPhone,
        owner_alert_lead_hours: formData.owner_alert_lead_hours,
      });
      setFormData((previous) => ({
        ...previous,
        deposit_percent: depositPercent,
        payment_payee_name: payeeName,
        payment_instructions: paymentInstructions,
        agent_prompt: formData.agent_prompt?.trim() || null,
        agent_voice_id: formData.agent_voice_id?.trim() || null,
        recordings_retention_days: retentionDays,
        history_retention_months: historyMonths,
        voice_log_retention_months: whatsappMonths,
        whatsapp_retention_months: whatsappMonths,
        cancellation_policy: policy.value,
        owner_alert_channel: alertChannel,
        owner_alert_phone: alertPhone,
      }));
      await onSaved();
      setMessage({
        text: 'ההגדרות נשמרו בהצלחה.',
        type: 'success',
      });
    } catch (error) {
      console.error('שגיאה בשמירת הגדרות עסק:', error);
      if (isBusinessPhoneTakenError(error)) {
        setMessage({ text: BUSINESS_PHONE_TAKEN_MESSAGE, type: 'error' });
        return;
      }
      if (error instanceof MissingAgentVoiceColumnError) {
        await onSaved();
        setMessage({
          text: 'שאר ההגדרות נשמרו. בחירת הקול לא נשמרה כי העמודה עדיין לא קיימת במסד.',
          type: 'error',
        });
        return;
      }
      const text = error instanceof Error && error.message.startsWith('שאר ההגדרות')
        ? error.message
        : 'לא ניתן לשמור את ההגדרות.';
      setMessage({
        text,
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRewrite = async () => {
    const draft = formData.agent_prompt?.trim() || '';
    if (!draft || isRewriting) {
      return;
    }

    setRewriteOpen(true);
    setRewriteText('');
    setRewriteError('');
    setIsRewriting(true);

    try {
      const text = await rewriteAgentPrompt(business.business_code, draft);
      setRewriteText(text);
    } catch (error) {
      setRewriteError(getAgentPromptRewriteErrorMessage(error));
    } finally {
      setIsRewriting(false);
    }
  };

  const selectedPlan = parseSubscriptionPlan(business.subscription_plan);
  const terms = tariffs.resolve(selectedPlan);

  return (
    <div className={styles.settingsColumn}>
      <div className={styles.stickyBar}>
        <div className={styles.sectionToolbar}>
          <DisplayToolbar
            fields={BUSINESS_CONFIG_FIELDS}
            visibleKeys={visibleFields}
            onToggle={onToggleField}
            onViewDetails={() => setIsDetailsOpen(true)}
            canViewDetails
          />
          <button
            type="button"
            className={`${styles.btnPrimary} ${styles.toolbarSave}`}
            onClick={() => void handleSave()}
            disabled={isSaving || !hasChanges}
            title={hasChanges ? 'שמירת הגדרות' : 'אין שינויים לשמירה'}
          >
            {isSaving ? 'שומר...' : (
              <>
                <SaveIcon />
                שמור הגדרות עסק
              </>
            )}
          </button>
        </div>

        {message && (
          <p className={styles[message.type]} role="status">
            {message.text}
          </p>
        )}
      </div>

      <SettingsStack>
        <SettingsGroup
          title="סוכן"
          description={
            isVisible('agent_prompt')
              ? 'הטקסט הזה הוא חלק מהפרומפט של הסוכן, כדי שידע את מי הוא מייצג, מה העסק עושה ומה הוא לא עושה.'
              : 'הקול שבו הסוכן מדבר בשיחה.'
          }
          action={
            isVisible('agent_prompt') ? (
              <button
                type="button"
                className={styles.aiButton}
                onClick={() => void handleRewrite()}
                disabled={isRewriting || !(formData.agent_prompt || '').trim()}
              >
                {isRewriting ? 'מנסח...' : 'ניסוח בעזרת AI'}
              </button>
            ) : undefined
          }
        >
          {isVisible('agent_prompt') && (
            <SettingsRow
              label="תיאור מקצועי"
              htmlFor="business-agent-prompt"
              help="חלק מהפרומפט של הסוכן: מי העסק, במה הוא עוסק, ובמה הוא לא עוסק."
              stacked
            >
              <textarea
                id="business-agent-prompt"
                name="agent_prompt"
                value={formData.agent_prompt || ''}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    agent_prompt: event.target.value,
                  }))
                }
                className={styles.textarea}
                rows={6}
                placeholder="לדוגמה: מרפאת שיניים כללית. מטפלים בסתימות, עקירות וטיפולי שורש. לא עוסקים ביישור שיניים (אורתודונטיה) ולא בכירורגיית פה ולסת."
              />
            </SettingsRow>
          )}
          <SettingsRow
            label="קול הסוכן"
            htmlFor="business-agent-voice"
            help="הקול שבו הסוכן מדבר בשיחה. הדגימה להאזנה, והבחירה נשמרת עם שאר ההגדרות."
            stacked
          >
            <AgentVoicePicker
              businessCode={business.business_code}
              voiceId={formData.agent_voice_id}
              onChange={(agentVoiceId) =>
                setFormData((previous) => ({
                  ...previous,
                  agent_voice_id: agentVoiceId,
                }))
              }
            />
          </SettingsRow>
        </SettingsGroup>

        {(isVisible('timezone') || isVisible('slot_duration_minutes')) && (
          <SettingsGroup
            title="יומן"
            description="איך היומן מחשב שעות ומשבצות זמן."
          >
            {isVisible('timezone') && (
              <SettingsRow
                label="אזור זמן"
                htmlFor="business-timezone"
                help="אזור הזמן של העסק. לפי זה מחושבות שעות היומן."
                stacked
              >
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
              </SettingsRow>
            )}
            {isVisible('slot_duration_minutes') && (
              <SettingsRow
                label="משך משבצת"
                htmlFor="business-slot-duration"
                help="גודל משבצת הזמן ביומן. לדוגמה 15 או 30 דקות. זה לא משך הטיפול עצמו."
              >
                <input
                  id="business-slot-duration"
                  type="number"
                  name="slot_duration_minutes"
                  value={formData.slot_duration_minutes ?? ''}
                  onChange={(event) => {
                    const { value } = event.target;
                    setFormData((previous) => ({
                      ...previous,
                      slot_duration_minutes: value === '' ? null : Number(value),
                    }));
                  }}
                  className={styles.compactInput}
                  min="1"
                  aria-label="משך משבצת בדקות"
                />
                <span className={styles.controlSuffix}>דקות</span>
              </SettingsRow>
            )}
          </SettingsGroup>
        )}

        <SettingsGroup
          title="התראה על ביטול קרוב"
          description="כשלקוח מבטל תור בתוך חלון השעות, העסק מקבל על כך התראה."
        >
          <SettingsRow
            label="ערוץ ההתראה"
            htmlFor="business-owner-alert-channel"
            help="שיחה קולית או וואטסאפ. בלי התראה, הביטול נשמר ביומן בלי הודעה לבעלים."
          >
            <select
              id="business-owner-alert-channel"
              className={styles.input}
              value={formData.owner_alert_channel || ''}
              onChange={(event) => {
                const value = event.target.value;
                setFormData((previous) => ({
                  ...previous,
                  owner_alert_channel: value || null,
                }));
              }}
            >
              <option value="">בלי התראה</option>
              <option value="call">שיחה קולית</option>
              <option value="whatsapp">וואטסאפ</option>
            </select>
          </SettingsRow>
          <SettingsRow
            label="מספר להתראה"
            htmlFor="business-owner-alert-phone"
            help="המספר שאליו נשלחת ההתראה. חובה כשיש ערוץ התראה."
          >
            <input
              id="business-owner-alert-phone"
              type="text"
              className={styles.input}
              dir="ltr"
              value={formData.owner_alert_phone || ''}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  owner_alert_phone: event.target.value || null,
                }))
              }
            />
          </SettingsRow>
          <SettingsRow
            label="חלון ההתראה"
            htmlFor="business-owner-alert-hours"
            help="כמה שעות לפני התור נחשבות ביטול קרוב."
          >
            <input
              id="business-owner-alert-hours"
              type="number"
              min={1}
              step="1"
              dir="ltr"
              className={styles.compactInput}
              value={formData.owner_alert_lead_hours}
              onChange={(event) => {
                const hours = Number(event.target.value);
                setFormData((previous) => ({
                  ...previous,
                  owner_alert_lead_hours: Number.isFinite(hours) && hours > 0 ? hours : 24,
                }));
              }}
            />
            <span className={styles.controlSuffix}>שעות</span>
          </SettingsRow>
        </SettingsGroup>

        {isVisible('deposit_percent') && (
          <SettingsGroup
            defaultCollapsed
            title="תשלום מראש"
            description="מה כל הלקוחות משלמים לפני שהתור נקבע. אצל לקוח מסוים אפשר לבחור אחרת, לשני הכיוונים, והבחירה שלו גוברת. התור נשמר כממתין לאסמכתא עד שהלקוח שולח בוואטסאפ קבלה על הסכום ועל שם המוטב."
          >
            <SettingsRow
              label="כל הלקוחות"
              htmlFor="business-payment-requirement"
              help="חל על כל לקוח שמוגדר אצלו 'לפי העסק'. ללקוח שהוגדר אחרת, ההגדרה שלו גוברת."
            >
              <select
                id="business-payment-requirement"
                className={styles.input}
                value={formData.default_payment_requirement}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    default_payment_requirement: parseBusinessPaymentRequirement(
                      event.target.value,
                    ),
                  }))
                }
              >
                {BUSINESS_PAYMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </SettingsRow>
            <SettingsRow
              label="אחוז מקדמה"
              htmlFor="business-deposit-percent"
              help="חל על כל מי שמשלם מקדמה, גם על לקוח שהוגדר אצלו מקדמה כשלשאר הלקוחות אין. הסכום מעוגל לשקל שלם."
            >
              <input
                id="business-deposit-percent"
                type="number"
                name="deposit_percent"
                min="0"
                max="100"
                step="0.01"
                dir="ltr"
                value={Number.isFinite(formData.deposit_percent) ? formData.deposit_percent : ''}
                onChange={(event) => {
                  const { value } = event.target;
                  setFormData((previous) => ({
                    ...previous,
                    deposit_percent: value === '' ? 0 : Number(value),
                  }));
                }}
                className={styles.compactInput}
                aria-label="אחוז מקדמה ממחיר התור"
              />
              <span className={styles.controlSuffix}>%</span>
            </SettingsRow>
            <SettingsRow
              label="שם המוטב"
              htmlFor="business-payment-payee"
              help="השם שצריך להופיע על הקבלה."
              stacked
            >
              <input
                id="business-payment-payee"
                type="text"
                className={styles.input}
                value={formData.payment_payee_name || ''}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    payment_payee_name: event.target.value,
                  }))
                }
              />
            </SettingsRow>
            <SettingsRow
              label="איך לשלם"
              htmlFor="business-payment-instructions"
              help="ההסבר שהסוכן שולח ללקוח: לאן להעביר ומה לצרף."
              stacked
            >
              <textarea
                id="business-payment-instructions"
                className={styles.textarea}
                rows={3}
                value={formData.payment_instructions || ''}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    payment_instructions: event.target.value,
                  }))
                }
              />
            </SettingsRow>
            <SettingsRow
              label="המתנה לאסמכתא"
              htmlFor="business-payment-hold"
              help="אחרי השעות האלה, תור בלי אסמכתא מתבטל והשעה מתפנה."
            >
              <input
                id="business-payment-hold"
                type="number"
                min="1"
                max={MAX_PAYMENT_HOLD_HOURS}
                step="1"
                dir="ltr"
                className={styles.compactInput}
                value={formData.payment_hold_hours}
                onChange={(event) => {
                  const hours = Number(event.target.value);
                  setFormData((previous) => ({
                    ...previous,
                    payment_hold_hours:
                      event.target.value === '' || !Number.isFinite(hours)
                        ? DEFAULT_PAYMENT_HOLD_HOURS
                        : hours,
                  }));
                }}
              />
              <span className={styles.controlSuffix}>שעות</span>
            </SettingsRow>
          </SettingsGroup>
        )}

        <SettingsGroup
          title="לקוחות שנוטים לבטל"
          description="לקוח שביטל מספיק פעמים לא נקבע כתור רגיל. התור נשמר כממתין לאסמכתא עד שהוא שולח בוואטסאפ קבלה על אותו סכום ואותו שם מוטב."
        >
          <SettingsRow
            label="הכלל פעיל"
            htmlFor="business-cancellation-enabled"
            help="כשכבוי, כל לקוח נקבע כרגיל בלי בדיקת ביטולים קודמים."
          >
            <label className={styles.toggle}>
              <input
                id="business-cancellation-enabled"
                type="checkbox"
                checked={policyDraft.enabled}
                onChange={(event) =>
                  setPolicyDraft((previous) => ({
                    ...previous,
                    enabled: event.target.checked,
                  }))
                }
              />
              <span>{policyDraft.enabled ? 'פעיל' : 'כבוי'}</span>
            </label>
          </SettingsRow>
          {policyDraft.enabled && (
            <>
              <SettingsRow
                label="מספר ביטולים"
                htmlFor="business-cancellation-count"
                help="כמה ביטולים בחלון הזמן מסמנים את הלקוח כחשוד."
              >
                <input
                  id="business-cancellation-count"
                  type="number"
                  min="1"
                  step="1"
                  dir="ltr"
                  className={styles.compactInput}
                  value={policyDraft.cancellations}
                  onChange={(event) =>
                    setPolicyDraft((previous) => ({
                      ...previous,
                      cancellations: event.target.value,
                    }))
                  }
                />
              </SettingsRow>
              <SettingsRow
                label="בתוך כמה ימים"
                htmlFor="business-cancellation-days"
                help="נספרים רק ביטולים מהימים האחרונים."
              >
                <input
                  id="business-cancellation-days"
                  type="number"
                  min="1"
                  step="1"
                  dir="ltr"
                  className={styles.compactInput}
                  value={policyDraft.withinDays}
                  onChange={(event) =>
                    setPolicyDraft((previous) => ({
                      ...previous,
                      withinDays: event.target.value,
                    }))
                  }
                />
                <span className={styles.controlSuffix}>ימים</span>
              </SettingsRow>
              <SettingsRow
                label="רק ביטול קרוב לתור"
                htmlFor="business-cancellation-near"
                help="אם ממלאים שעות, נספר רק ביטול שנעשה בטווח הזה לפני תחילת התור. ריק סופר כל ביטול בחלון הימים."
              >
                <input
                  id="business-cancellation-near"
                  type="number"
                  min="1"
                  step="1"
                  dir="ltr"
                  className={styles.compactInput}
                  value={policyDraft.nearHours}
                  placeholder="הכל"
                  onChange={(event) =>
                    setPolicyDraft((previous) => ({
                      ...previous,
                      nearHours: event.target.value,
                    }))
                  }
                />
                <span className={styles.controlSuffix}>שעות</span>
              </SettingsRow>
              <SettingsRow
                label="המתנה לאסמכתא"
                htmlFor="business-cancellation-hold"
                help="אחרי השעות האלה, תור בלי אסמכתא מתבטל והשעה מתפנה."
              >
                <input
                  id="business-cancellation-hold"
                  type="number"
                  min="1"
                  step="1"
                  dir="ltr"
                  className={styles.compactInput}
                  value={policyDraft.holdHours}
                  onChange={(event) =>
                    setPolicyDraft((previous) => ({
                      ...previous,
                      holdHours: event.target.value,
                    }))
                  }
                />
                <span className={styles.controlSuffix}>שעות</span>
              </SettingsRow>
              <SettingsRow
                label="שם המוטב"
                htmlFor="business-cancellation-payee"
                help="השם שצריך להופיע על הקבלה."
                stacked
              >
                <input
                  id="business-cancellation-payee"
                  type="text"
                  className={styles.input}
                  value={policyDraft.payeeName}
                  onChange={(event) =>
                    setPolicyDraft((previous) => ({
                      ...previous,
                      payeeName: event.target.value,
                    }))
                  }
                />
              </SettingsRow>
              <SettingsRow
                label="איך לשלם"
                htmlFor="business-cancellation-text"
                help="ההסבר שהסוכן שולח ללקוח: לאן להעביר ומה לצרף."
                stacked
              >
                <textarea
                  id="business-cancellation-text"
                  className={styles.textarea}
                  rows={3}
                  value={policyDraft.paymentText}
                  onChange={(event) =>
                    setPolicyDraft((previous) => ({
                      ...previous,
                      paymentText: event.target.value,
                    }))
                  }
                />
              </SettingsRow>
            </>
          )}
        </SettingsGroup>

        {(isVisible('save_recordings') ||
          isVisible('recordings_retention_days') ||
          isVisible('history_retention_months') ||
          isVisible('whatsapp_retention_months')) && (
          <SettingsGroup defaultCollapsed title="הקלטות">
            {isVisible('save_recordings') && (
              <SettingsRow
                label="שמירת הקלטות"
                htmlFor="business-save-recordings"
                help="כשפעיל, הקלטות נשמרות באחסון."
              >
                <label className={styles.toggle}>
                  <input
                    id="business-save-recordings"
                    type="checkbox"
                    checked={formData.save_recordings}
                    onChange={(event) =>
                      setFormData((previous) => ({
                        ...previous,
                        save_recordings: event.target.checked,
                      }))
                    }
                  />
                  <span>{formData.save_recordings ? 'פעיל' : 'כבוי'}</span>
                </label>
              </SettingsRow>
            )}
            {isVisible('recordings_retention_days') && (
              <SettingsRow
                label="ימי הקלטה קולית"
                htmlFor="business-recordings-retention"
                help={`הקובץ הקולי נשמר לפי הימים האלה. אפשר ${daysLimitText(terms.recordingMaxDays)}.`}
              >
                <input
                  id="business-recordings-retention"
                  type="number"
                  name="recordings_retention_days"
                  min="1"
                  max={terms.recordingMaxDays}
                  step="1"
                  dir="ltr"
                  disabled={!formData.save_recordings}
                  value={formData.recordings_retention_days}
                  onChange={(event) => {
                    const { value } = event.target;
                    setFormData((previous) => ({
                      ...previous,
                      recordings_retention_days:
                        value === '' ? DEFAULT_RECORDING_RETENTION_DAYS : Number(value),
                    }));
                  }}
                  className={styles.compactInput}
                  aria-label="ימי שמירת הקלטות"
                />
                <span className={styles.controlSuffix}>ימים</span>
              </SettingsRow>
            )}
            {isVisible('history_retention_months') && (
            <SettingsRow
              label="היסטוריית תורים"
              htmlFor="business-history-retention"
              help={`היסטוריית התורים נשמרת לפי החודשים האלה. אפשר ${monthsLimitText(terms.historyMaxMonths)}.`}
            >
              <input
                id="business-history-retention"
                type="number"
                name="history_retention_months"
                min="1"
                max={terms.historyMaxMonths}
                step="1"
                dir="ltr"
                value={formData.history_retention_months}
                onChange={(event) => {
                  const { value } = event.target;
                  setFormData((previous) => ({
                    ...previous,
                    history_retention_months:
                      value === '' ? DEFAULT_HISTORY_MONTHS : Number(value),
                  }));
                }}
                className={styles.compactInput}
                aria-label="חודשי היסטוריית תורים"
              />
              <span className={styles.controlSuffix}>חודשים</span>
            </SettingsRow>
            )}
            {isVisible('whatsapp_retention_months') && (
            <SettingsRow
              label="התכתבות וואטסאפ ותמלול"
              htmlFor="business-whatsapp-retention"
              help={`תמלול השיחה, הסיכום והתכתבות הוואטסאפ נשמרים לפי אותו מספר חודשים. אפשר ${monthsLimitText(terms.correspondenceMaxMonths)}.`}
            >
              <input
                id="business-whatsapp-retention"
                type="number"
                name="whatsapp_retention_months"
                min="1"
                max={terms.correspondenceMaxMonths}
                step="1"
                dir="ltr"
                value={formData.whatsapp_retention_months}
                onChange={(event) => {
                  const { value } = event.target;
                  const months = value === '' ? DEFAULT_HISTORY_MONTHS : Number(value);
                  setFormData((previous) => ({
                    ...previous,
                    whatsapp_retention_months: months,
                    voice_log_retention_months: months,
                  }));
                }}
                className={styles.compactInput}
                aria-label="חודשי התכתבות וואטסאפ ותמלול"
              />
              <span className={styles.controlSuffix}>חודשים</span>
            </SettingsRow>
            )}
          </SettingsGroup>
        )}

        {isVisible('is_active') && (
          <SettingsGroup
            title="סוכנים"
            description="כיבוי משבית את סוכן הקול ואת סוכן הוואטסאפ. היומן נשאר פתוח."
          >
            <SettingsRow
              label="הסוכנים פעילים"
              htmlFor="business-is-active"
              help="כשכבוי, הסוכנים מושבתים והיומן נשאר פתוח. סגירת החשבון נמצאת בלשונית חשבון."
            >
              <label className={styles.toggle}>
                <input
                  id="business-is-active"
                  type="checkbox"
                  checked={formData.is_active !== false}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      is_active: event.target.checked,
                    }))
                  }
                />
                <span>{formData.is_active === false ? 'כבויים' : 'פעילים'}</span>
              </label>
            </SettingsRow>
          </SettingsGroup>
        )}

      </SettingsStack>

      {isDetailsOpen && (
        <RecordDetailsModal
          title={`הגדרות העסק · ${business.business_name}`}
          rows={toBusinessConfigDetailRows({ ...business, ...formData })}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}

      {rewriteOpen && (
        <RewriteAgentPromptModal
          value={rewriteText}
          isGenerating={isRewriting}
          errorMessage={rewriteError}
          onChange={setRewriteText}
          onReplace={() => {
            setFormData((previous) => ({
              ...previous,
              agent_prompt: rewriteText.trim(),
            }));
            setRewriteOpen(false);
          }}
          onClose={() => {
            if (!isRewriting) {
              setRewriteOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}

function SubscriptionForm({
  business,
  onSaved,
}: {
  business: BusinessSettings;
  onSaved: () => Promise<void>;
}) {
  const tariffs = usePlanTariffs(business.business_code);
  const [plan, setPlan] = useState<SubscriptionPlan>(() =>
    parseSubscriptionPlan(business.subscription_plan),
  );
  const [quotaGb, setQuotaGb] = useState(() =>
    displayStorageQuotaGb(
      normalizeStorageQuotaGb(business.storage_quota_gb) ?? INCLUDED_STORAGE_GB,
      includedStorageGb(parseSubscriptionPlan(business.subscription_plan)),
    ),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const savedPlan = parseSubscriptionPlan(business.subscription_plan);
  const savedIncludedGb = tariffs.resolve(savedPlan).includedStorageGb;
  const savedQuota = displayStorageQuotaGb(
    displayStorageQuotaGb(
      normalizeStorageQuotaGb(business.storage_quota_gb) ?? INCLUDED_STORAGE_GB,
      includedStorageGb(savedPlan),
    ),
    savedIncludedGb,
  );
  const terms = tariffs.resolve(plan);
  const regularTerms = tariffs.resolve('regular');
  const expandedTerms = tariffs.resolve('expanded');
  const shownQuota = displayStorageQuotaGb(
    normalizeStorageQuotaGb(quotaGb) ?? terms.includedStorageGb,
    terms.includedStorageGb,
  );
  const hasPlanChanges = plan !== savedPlan || String(shownQuota) !== String(savedQuota);

  const applyPlan = (nextPlan: SubscriptionPlan) => {
    const nextTerms = tariffs.resolve(nextPlan);
    const previousIncludedGb = tariffs.resolve(plan).includedStorageGb;
    setPlan(nextPlan);
    setQuotaGb((current) =>
      alignStorageQuotaGb(current, previousIncludedGb, nextTerms.includedStorageGb),
    );
  };

  const handleSave = async () => {
    setMessage(null);
    const nextTerms = tariffs.resolve(plan);
    const storedQuota = displayStorageQuotaGb(
      normalizeStorageQuotaGb(quotaGb) ?? nextTerms.includedStorageGb,
      nextTerms.includedStorageGb,
    );
    if (normalizeStorageQuotaGb(storedQuota) == null) {
      setMessage({
        text: 'מכסת האחסון חייבת להיות מספר שלם של לפחות 5 ג׳יגה.',
        type: 'error',
      });
      return;
    }

    const retentionDays = normalizeRetentionDays(
      business.recordings_retention_days,
      plan,
      nextTerms.recordingMaxDays,
    );
    const historyMonths = normalizeHistoryMonths(
      business.history_retention_months,
      plan,
      nextTerms.historyMaxMonths,
    );
    const correspondenceMonths = normalizeHistoryMonths(
      business.whatsapp_retention_months,
      plan,
      nextTerms.correspondenceMaxMonths,
    );
    if (retentionDays == null || historyMonths == null || correspondenceMonths == null) {
      setMessage({
        text: 'לא ניתן להתאים את תקופות השמירה למנוי שנבחר.',
        type: 'error',
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateBusinessSettings(business.business_code, {
        subscription_plan: plan,
        storage_quota_gb: storedQuota,
        recordings_retention_days: retentionDays,
        history_retention_months: historyMonths,
        voice_log_retention_months: correspondenceMonths,
        whatsapp_retention_months: correspondenceMonths,
      });
      await onSaved();
      setMessage({ text: 'המנוי נשמר.', type: 'success' });
    } catch (error) {
      console.error('שגיאה בשמירת מנוי:', error);
      setMessage({ text: 'לא ניתן לשמור את המנוי.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.settingsColumn}>
      <div className={styles.stickyBar}>
        <div className={styles.sectionToolbar}>
          <span />
          <button
            type="button"
            className={`${styles.btnPrimary} ${styles.toolbarSave}`}
            onClick={() => void handleSave()}
            disabled={isSaving || !hasPlanChanges}
            title={hasPlanChanges ? 'שמירת מנוי' : 'אין שינויים לשמירה'}
          >
            {isSaving ? 'שומר...' : (
              <>
                <SaveIcon />
                שמור מנוי
              </>
            )}
          </button>
        </div>
        {message ? (
          <p className={styles[message.type]} role="status">
            {message.text}
          </p>
        ) : null}
      </div>

      <SettingsStack>
        <SettingsGroup
          id="subscription-plan"
          title="מנוי"
          description="הסכום הקבוע לחודש, ומה משתנה במחיר לפי המנוי שנבחר."
        >
          <div className={styles.planBoard}>
            <PlanCard
              plan="regular"
              terms={regularTerms}
              selected={plan === 'regular'}
              onSelect={() => applyPlan('regular')}
            />
            <PlanCard
              plan="expanded"
              terms={expandedTerms}
              selected={plan === 'expanded'}
              onSelect={() => applyPlan('expanded')}
            />
          </div>
        </SettingsGroup>

        <SettingsGroup
          id="cloud-storage"
          title="אחסון בענן"
          description={`${terms.includedStorageGb} ג׳יגה כלולים במנוי. כל ג׳יגה נוספת עולה ${terms.extraStorageGbIls} ₪ לחודש, בלי תקרת מכסה.`}
        >
          <StorageUsageMeter
            businessCode={business.business_code}
            plan={plan}
            rates={{
              includedGb: terms.includedStorageGb,
              extraGbIls: terms.extraStorageGbIls,
            }}
            quotaGb={shownQuota}
          />
          <SettingsRow
            label="מכסה לעסק"
            htmlFor="business-storage-quota"
            help={`אפשר להגדיל מעבר ל־${terms.includedStorageGb} ג׳יגה הכלולות. כל ג׳יגה נוספת ${terms.extraStorageGbIls} ₪ לחודש, בלי הגבלה.`}
          >
            <input
              id="business-storage-quota"
              type="number"
              min={terms.includedStorageGb}
              step="1"
              dir="ltr"
              value={quotaGb}
              onChange={(event) => {
                const { value } = event.target;
                setQuotaGb(value === '' ? terms.includedStorageGb : Number(value));
              }}
              onBlur={() => {
                setQuotaGb((current) =>
                  displayStorageQuotaGb(
                    normalizeStorageQuotaGb(current) ?? terms.includedStorageGb,
                    terms.includedStorageGb,
                  ),
                );
              }}
              className={styles.compactInput}
              aria-label="מכסת אחסון בג׳יגה"
            />
            <span className={styles.controlSuffix}>ג׳יגה</span>
          </SettingsRow>
        </SettingsGroup>
      </SettingsStack>
    </div>
  );
}

function ServicesTable({
  businessCode,
  services,
  readOnly,
  visibleFields,
  onToggleField,
  onReorderFields,
  onServicesChanged,
}: {
  businessCode: string;
  services: Service[];
  readOnly: boolean;
  visibleFields: string[];
  onToggleField: (key: string) => void;
  onReorderFields: (keys: string[]) => void;
  onServicesChanged: () => void;
}) {
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [deletingServiceId, setDeletingServiceId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Service | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const activeColumns = orderCatalogFields(SERVICE_FIELDS, visibleFields);
  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? null;
  const visibleFilters = useMemo(
    () =>
      visibleColumnFilters(
        columnFilters,
        activeColumns.map((column) => column.key),
      ),
    [activeColumns, columnFilters],
  );
  const visibleSort =
    sort && activeColumns.some((column) => column.key === sort.key) ? sort : null;
  const visibleServices = useMemo(
    () => filterAndSortServices(services, visibleFilters, visibleSort),
    [services, visibleFilters, visibleSort],
  );
  const hasActiveFilters = Object.keys(visibleFilters).length > 0;
  const hasTableControls = hasActiveFilters || visibleSort !== null;

  const handleDelete = async (service: Service) => {
    if (deletingServiceId !== null) return;

    setActionError('');
    setDeletingServiceId(service.id);
    try {
      await deleteService(businessCode, service.id);
      setPendingDelete(null);
      setSelectedServiceId(null);
      onServicesChanged();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error('שגיאה במחיקת שירות:', message);
      setActionError(message || 'לא ניתן למחוק את השירות.');
    } finally {
      setDeletingServiceId(null);
    }
  };

  return (
    <div>
      <div className={styles.sectionToolbar}>
        <DisplayToolbar
          fields={SERVICE_FIELDS}
          visibleKeys={visibleFields}
          onToggle={onToggleField}
          onReorder={onReorderFields}
          onViewDetails={() => setIsDetailsOpen(true)}
          canViewDetails={selectedService !== null}
          filtersVisible={filtersVisible}
          filtersActive={hasActiveFilters}
          onToggleFilters={() => setFiltersVisible((open) => !open)}
        />
        <div className={styles.toolbarActions}>
          {hasTableControls ? (
            <button
              type="button"
              className={columnTableStyles.clearButton}
              onClick={() => {
                setColumnFilters({});
                setSort(null);
              }}
            >
              נקה סינון ומיון
            </button>
          ) : null}
          {readOnly ? null : (
            <button
              type="button"
              className={`${styles.btnPrimary} ${styles.addServiceButton}`}
              onClick={() => setModalMode('add')}
            >
              הוסף שירות
            </button>
          )}
        </div>
      </div>
      {readOnly ? <p className={styles.readOnlyNote}>{READ_ONLY_NOTE}</p> : null}

      {pendingDelete && (
        <ConfirmDeleteModal
          title="מחיקת שירות"
          message={
            <>
              למחוק את השירות <strong>{pendingDelete.title}</strong>?
            </>
          }
          isBusy={deletingServiceId !== null}
          errorMessage={actionError}
          onConfirm={() => void handleDelete(pendingDelete)}
          onCancel={() => {
            if (deletingServiceId !== null) return;
            setPendingDelete(null);
            setActionError('');
          }}
        />
      )}

      <div className={styles.tableScroll}>
      <table className={`data-table ${styles.table}`}>
        <ColumnTableHead
          columns={activeColumns}
          filters={columnFilters}
          sort={visibleSort}
          showFilters={filtersVisible}
          onSort={(key) => setSort((current) => nextColumnSort(current, key))}
          onFilter={(key, value) =>
            setColumnFilters((current) => ({ ...current, [key]: value }))
          }
          onReorder={onReorderFields}
          showActions={!readOnly}
          selectOptions={{
            is_active: [
              { value: 'active', label: 'פעיל' },
              { value: 'inactive', label: 'לא פעיל' },
            ],
          }}
        />
        <tbody>
          {visibleServices.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(activeColumns.length, 1) + (readOnly ? 0 : 1)}
                className={styles.emptyServices}
              >
                {services.length === 0
                  ? 'לא הוגדרו שירותים'
                  : 'לא נמצאו שירותים מתאימים לסינון'}
              </td>
            </tr>
          ) : (
            visibleServices.map((service) => {
              const isInactive = service.is_active === false;
              const rowClass = [
                selectedServiceId === service.id ? 'is-selected' : '',
                isInactive ? styles.inactiveRow : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
              <tr
                key={`${service.business_code}-${service.id}`}
                className={rowClass || undefined}
                title={isInactive ? 'שירות לא פעיל' : undefined}
                onClick={() => setSelectedServiceId(service.id)}
                onDoubleClick={() => {
                  setSelectedServiceId(service.id);
                  if (!readOnly) setModalMode('edit');
                }}
              >
                {readOnly ? null : (
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
                        disabled={deletingServiceId !== null}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedServiceId(service.id);
                          setActionError('');
                          setPendingDelete(service);
                        }}
                      >
                        <TrashIcon />
                      </IconButton>
                    </div>
                  </td>
                )}
                {activeColumns.map((column) => (
                  <td key={column.key} dir={column.dir}>
                    {column.key === 'is_active' ? (
                      <span
                        className={
                          isInactive ? styles.statusInactive : styles.statusActive
                        }
                      >
                        {formatServiceCell(service, column.key)}
                      </span>
                    ) : (
                      formatServiceCell(service, column.key)
                    )}
                  </td>
                ))}
              </tr>
              );
            })
          )}
        </tbody>
      </table>
      </div>

      {!readOnly && modalMode && (modalMode === 'add' || selectedService) && (
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
  readOnly,
  visibleFields,
  onToggleField,
  onReorderFields,
  onStatusesChanged,
}: {
  businessCode: string;
  statuses: AppointmentStatusRow[];
  readOnly: boolean;
  visibleFields: string[];
  onToggleField: (key: string) => void;
  onReorderFields: (keys: string[]) => void;
  onStatusesChanged: () => void;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedStatusCode, setSelectedStatusCode] = useState<string | null>(
    null,
  );
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const activeColumns = orderCatalogFields(STATUS_FIELDS, visibleFields);
  const selectedStatus =
    statuses.find((status) => status.status_code === selectedStatusCode) ??
    null;
  const visibleFilters = useMemo(
    () =>
      visibleColumnFilters(
        columnFilters,
        activeColumns.map((column) => column.key),
      ),
    [activeColumns, columnFilters],
  );
  const visibleSort =
    sort && activeColumns.some((column) => column.key === sort.key) ? sort : null;
  const visibleStatuses = useMemo(
    () => filterAndSortStatuses(statuses, visibleFilters, visibleSort),
    [statuses, visibleFilters, visibleSort],
  );
  const hasActiveFilters = Object.keys(visibleFilters).length > 0;
  const hasTableControls = hasActiveFilters || visibleSort !== null;

  const openColorEditor = (statusCode: string) => {
    setSelectedStatusCode(statusCode);
    if (!readOnly) setIsEditOpen(true);
  };

  return (
    <div>
      <div className={styles.sectionToolbar}>
        <DisplayToolbar
          fields={STATUS_FIELDS}
          visibleKeys={visibleFields}
          onToggle={onToggleField}
          onReorder={onReorderFields}
          onViewDetails={() => setIsDetailsOpen(true)}
          canViewDetails={selectedStatus !== null}
          filtersVisible={filtersVisible}
          filtersActive={hasActiveFilters}
          onToggleFilters={() => setFiltersVisible((open) => !open)}
        />
        {hasTableControls ? (
          <div className={styles.toolbarActions}>
            <button
              type="button"
              className={columnTableStyles.clearButton}
              onClick={() => {
                setColumnFilters({});
                setSort(null);
              }}
            >
              נקה סינון ומיון
            </button>
          </div>
        ) : null}
      </div>
      {readOnly ? <p className={styles.readOnlyNote}>{READ_ONLY_NOTE}</p> : null}

      <div className={styles.tableScroll}>
      <table className={`data-table ${styles.table}`}>
        <ColumnTableHead
          columns={activeColumns}
          filters={columnFilters}
          sort={visibleSort}
          showFilters={filtersVisible}
          showActions={!readOnly}
          onSort={(key) => setSort((current) => nextColumnSort(current, key))}
          onFilter={(key, value) =>
            setColumnFilters((current) => ({ ...current, [key]: value }))
          }
          onReorder={onReorderFields}
        />
        <tbody>
          {visibleStatuses.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(activeColumns.length, 1) + (readOnly ? 0 : 1)}
                className={styles.emptyServices}
              >
                {statuses.length === 0
                  ? 'לא הוגדרו סטטוסים'
                  : 'לא נמצאו סטטוסים מתאימים לסינון'}
              </td>
            </tr>
          ) : (
            visibleStatuses.map((status) => (
              <tr
                key={`${status.business_code}-${status.status_code}`}
                className={
                  selectedStatusCode === status.status_code
                    ? 'is-selected'
                    : undefined
                }
                onClick={() => setSelectedStatusCode(status.status_code)}
                onDoubleClick={() => openColorEditor(status.status_code)}
              >
                {readOnly ? null : (
                  <td>
                    <div className={styles.rowActions}>
                      <IconButton
                        label="ערוך צבע סטטוס"
                        onClick={(event) => {
                          event.stopPropagation();
                          openColorEditor(status.status_code);
                        }}
                      >
                        <PencilIcon />
                      </IconButton>
                    </div>
                  </td>
                )}
                {activeColumns.map((column) => (
                  <td key={column.key} dir={column.dir}>
                    {column.key === 'color' ? (
                      <span className={styles.colorCell}>
                        <span
                          className={styles.colorBadge}
                          style={{
                            backgroundColor: status.color || 'var(--color-line)',
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
      </div>

      {!readOnly && isEditOpen && selectedStatus && (
        <StatusModal
          businessCode={businessCode}
          status={selectedStatus}
          onClose={() => setIsEditOpen(false)}
          onSuccess={() => {
            onStatusesChanged();
            setIsEditOpen(false);
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

