import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { deleteService, rewriteAgentPrompt, updateBusinessSettings } from '../settings.api';
import StorageUsageMeter from './StorageUsageMeter';
import { getAgentPromptRewriteErrorMessage, getErrorMessage } from '../../../shared/errors';
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
  monthsLimitText,
  normalizeHistoryMonths,
  parseSubscriptionPlan,
} from '../../usage/planPricing';
import { usePlanTariffs } from '../../usage/tariffs.api';
import {
  INCLUDED_STORAGE_GB,
  MAX_STORAGE_QUOTA_GB,
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
  BUSINESS_CONFIG_FIELDS,
  BUSINESS_FIELDS,
  SERVICE_FIELDS,
  STATUS_FIELDS,
} from '../../../shared/displayFields/catalogs';
import { useUiPreferences } from '../../../shared/displayFields/useUiPreferences';
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
import AddServiceModal from './AddServiceModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import BusinessAccountPanel from './BusinessAccountPanel';
import OperatingHoursForm from './OperatingHoursForm';
import RewriteAgentPromptModal from './RewriteAgentPromptModal';
import StatusModal from './StatusModal';
import TimezoneSelect from './TimezoneSelect';
import styles from './Settings.module.css';

type SettingsTab =
  | 'business'
  | 'config'
  | 'hours'
  | 'services'
  | 'statuses'
  | 'payment';

const SETTINGS_TABS: SettingsTab[] = [
  'business',
  'config',
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

  useEffect(() => {
    if (!business || activeTab !== 'config') return;
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
      document.getElementById(target)?.scrollIntoView({
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
          className={`${styles.tabBtn} ${activeTab === 'config' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('config')}
        >
          הגדרות העסק
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
          <BusinessProfileForm
            key={business.business_code}
            business={business}
            visibleFields={visibleFieldsFor('business')}
            onToggleField={(key) => toggleField('business', key)}
            onSaved={onBusinessUpdated}
          />
        ) : activeTab === 'config' ? (
          <>
            <BusinessConfigForm
              key={`${business.business_code}-config`}
              business={business}
              visibleFields={visibleFieldsFor('businessConfig')}
              onToggleField={(key) => toggleField('businessConfig', key)}
              onSaved={onBusinessUpdated}
            />
            {activeBusiness?.role === 'owner' ? (
              <BusinessAccountPanel
                businessCode={business.business_code}
                plan={parseSubscriptionPlan(business.subscription_plan)}
                agentsActive={business.is_active !== false}
                accountClosed={Boolean(business.closed_at)}
              />
            ) : null}
          </>
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

function toEditableProfile(
  business: BusinessSettings,
): EditableBusinessProfile {
  return {
    business_name: business.business_name,
    contact_phone: business.contact_phone,
    email: business.email,
    agent_phone_number: business.agent_phone_number,
  };
}

function toEditableConfig(
  business: BusinessSettings,
): EditableBusinessConfig {
  return {
    timezone: business.timezone,
    slot_duration_minutes: business.slot_duration_minutes,
    deposit_percent: parseDepositPercent(business.deposit_percent),
    agent_prompt: business.agent_prompt,
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
    storage_quota_gb:
      normalizeStorageQuotaGb(business.storage_quota_gb) ?? INCLUDED_STORAGE_GB,
    is_active: business.is_active !== false,
  };
}

function BusinessProfileForm({
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
  const [formData, setFormData] = useState(() => toEditableProfile(business));
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

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      await updateBusinessSettings(business.business_code, {
        ...formData,
        business_name: formData.business_name.trim(),
      });
      await onSaved();
      setMessage({
        text: 'הנתונים נשמרו בהצלחה.',
        type: 'success',
      });
    } catch (error) {
      console.error('שגיאה בשמירת פרטי עסק:', error);
      setMessage({
        text: 'לא ניתן לשמור את פרטי העסק.',
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
            שמור פרטי עסק
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

function SettingsStack({ children }: { children: ReactNode }) {
  return <div className={styles.settingsStack}>{children}</div>;
}

function SettingsGroup({
  id,
  title,
  description,
  action,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.settingsGroup}>
      <header className={styles.settingsGroupHeader}>
        <div className={styles.settingsGroupHeading}>
          <h3>{title}</h3>
          {action}
        </div>
        {description ? <p>{description}</p> : null}
      </header>
      <div className={styles.settingsRows}>{children}</div>
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
      if (depositPercent == null) {
        setMessage({
          text: 'אחוז המקדמה חייב להיות מספר בין 0 ל-100.',
          type: 'error',
        });
        return;
      }

      const subscriptionPlan = parseSubscriptionPlan(formData.subscription_plan);
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

      const quotaGb = normalizeStorageQuotaGb(formData.storage_quota_gb);
      if (quotaGb == null) {
        setMessage({
          text: `מכסת האחסון חייבת להיות מספר שלם בין 5 ל-${MAX_STORAGE_QUOTA_GB} ג׳יגה.`,
          type: 'error',
        });
        return;
      }

      await updateBusinessSettings(business.business_code, {
        timezone: formData.timezone,
        slot_duration_minutes: formData.slot_duration_minutes,
        deposit_percent: depositPercent,
        agent_prompt: formData.agent_prompt?.trim() || null,
        save_recordings: formData.save_recordings,
        subscription_plan: subscriptionPlan,
        recordings_retention_days: retentionDays,
        history_retention_months: historyMonths,
        voice_log_retention_months: whatsappMonths,
        whatsapp_retention_months: whatsappMonths,
        storage_quota_gb: quotaGb,
        is_active: formData.is_active,
      });
      setFormData((previous) => ({
        ...previous,
        deposit_percent: depositPercent,
        agent_prompt: formData.agent_prompt?.trim() || null,
        subscription_plan: subscriptionPlan,
        recordings_retention_days: retentionDays,
        history_retention_months: historyMonths,
        voice_log_retention_months: whatsappMonths,
        whatsapp_retention_months: whatsappMonths,
        storage_quota_gb: quotaGb,
      }));
      await onSaved();
      setMessage({
        text: 'ההגדרות נשמרו בהצלחה.',
        type: 'success',
      });
    } catch (error) {
      console.error('שגיאה בשמירת הגדרות עסק:', error);
      setMessage({
        text: 'לא ניתן לשמור את ההגדרות.',
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

  const selectedPlan = parseSubscriptionPlan(formData.subscription_plan);
  const terms = tariffs.resolve(selectedPlan);

  return (
    <div>
      <div className={styles.sectionToolbar}>
        <DisplayToolbar
          fields={BUSINESS_CONFIG_FIELDS}
          visibleKeys={visibleFields}
          onToggle={onToggleField}
          onViewDetails={() => setIsDetailsOpen(true)}
          canViewDetails
        />
      </div>

      <SettingsStack>
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

        {isVisible('agent_prompt') && (
          <SettingsGroup
            title="סוכן"
            description="כאן מגדירים מה העסק עושה ומה הוא לא עושה. זה לא פרומפט לשיחת הזמנת תור."
            action={
              <button
                type="button"
                className={styles.aiButton}
                onClick={() => void handleRewrite()}
                disabled={isRewriting || !(formData.agent_prompt || '').trim()}
              >
                {isRewriting ? 'מנסח...' : 'ניסוח בעזרת AI'}
              </button>
            }
          >
            <SettingsRow
              label="תיאור מקצועי"
              htmlFor="business-agent-prompt"
              help="מה העסק עושה ובמה הוא לא מתעסק, מבחינה מקצועית. למשל רופא שיניים כללי ולא אורתודונט."
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
          </SettingsGroup>
        )}

        {isVisible('deposit_percent') && (
          <SettingsGroup
            title="תשלום"
            description="חל רק על לקוחות שדרישת התשלום שלהם היא מקדמה. תשלום מלא בכרטיס הלקוח תמיד גובה 100%."
          >
            <SettingsRow
              label="אחוז מקדמה"
              htmlFor="business-deposit-percent"
              help="הסכום הוא אחוז ממחיר התור. 0 משמעו בלי גבייה."
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
          </SettingsGroup>
        )}

        <SettingsGroup
          id="cloud-storage"
          title="אחסון בענן"
          description={`מכסת הקבצים של העסק. ${terms.includedStorageGb} ג׳יגה כלולים במנוי, כל ג׳יגה נוספת עולה ${terms.extraStorageGbIls} ₪ לחודש, והמקסימום ${MAX_STORAGE_QUOTA_GB} ג׳יגה.`}
        >
          <StorageUsageMeter
            businessCode={business.business_code}
            plan={selectedPlan}
            rates={{
              includedGb: terms.includedStorageGb,
              extraGbIls: terms.extraStorageGbIls,
            }}
            quotaGb={
              normalizeStorageQuotaGb(formData.storage_quota_gb) ??
              INCLUDED_STORAGE_GB
            }
          />
          {isVisible('storage_quota_gb') && (
            <SettingsRow
              label="מכסה לעסק"
              htmlFor="business-storage-quota"
              help={`אפשר להגדיל מעבר ל־${terms.includedStorageGb} ג׳יגה הכלולות. כל ג׳יגה נוספת ${terms.extraStorageGbIls} ₪ לחודש.`}
            >
              <input
                id="business-storage-quota"
                type="number"
                name="storage_quota_gb"
                min="5"
                max={MAX_STORAGE_QUOTA_GB}
                step="1"
                dir="ltr"
                value={formData.storage_quota_gb}
                onChange={(event) => {
                  const { value } = event.target;
                  setFormData((previous) => ({
                    ...previous,
                    storage_quota_gb: value === '' ? INCLUDED_STORAGE_GB : Number(value),
                  }));
                }}
                className={styles.compactInput}
                aria-label="מכסת אחסון בג׳יגה"
              />
              <span className={styles.controlSuffix}>ג׳יגה</span>
            </SettingsRow>
          )}
        </SettingsGroup>

        <SettingsGroup
          id="subscription-plan"
          title="מנוי"
          description={
            selectedPlan === 'expanded'
              ? `הקלטה, היסטוריית תורים, תמלול, סיכום והתכתבות וואטסאפ ${monthsLimitText(terms.correspondenceMaxMonths)}. משתמש נוסף ${terms.extraUserIls} ₪ לחודש.`
              : `הקלטת קול ${daysLimitText(terms.recordingMaxDays)}. היסטוריית תורים ${monthsLimitText(terms.historyMaxMonths)}. תמלול, סיכום והתכתבות וואטסאפ ${monthsLimitText(terms.correspondenceMaxMonths)}. משתמש נוסף ${terms.extraUserIls} ₪ לחודש.`
          }
        >
          <SettingsRow
            label="סוג מנוי"
            htmlFor="business-subscription-plan"
            help="התעריף והמגבלות מתעדכנים לפי המנוי שנבחר."
          >
            <select
              id="business-subscription-plan"
              value={formData.subscription_plan}
              onChange={(event) => {
                const subscriptionPlan = parseSubscriptionPlan(event.target.value);
                const nextTerms = tariffs.resolve(subscriptionPlan);
                setFormData((previous) => {
                  const correspondenceMonths = Math.min(
                    previous.whatsapp_retention_months,
                    nextTerms.correspondenceMaxMonths,
                  );
                  return {
                    ...previous,
                    subscription_plan: subscriptionPlan,
                    recordings_retention_days: Math.min(
                      previous.recordings_retention_days,
                      nextTerms.recordingMaxDays,
                    ),
                    history_retention_months: Math.min(
                      previous.history_retention_months,
                      nextTerms.historyMaxMonths,
                    ),
                    voice_log_retention_months: correspondenceMonths,
                    whatsapp_retention_months: correspondenceMonths,
                  };
                });
              }}
              className={styles.compactInput}
              aria-label="סוג מנוי"
            >
              <option value="regular">רגיל</option>
              <option value="expanded">מורחב</option>
            </select>
          </SettingsRow>
        </SettingsGroup>

        {(isVisible('save_recordings') || isVisible('recordings_retention_days')) && (
          <SettingsGroup
            title="הקלטות"
            description="הקובץ הקולי נשמר לפי ימים. היסטוריית התורים נשמרת לפי חודשים. תמלול השיחה, הסיכום והתכתבות הוואטסאפ נשמרים לפי אותו מספר חודשים."
          >
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
                help={`אפשר ${daysLimitText(terms.recordingMaxDays)}.`}
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
            <SettingsRow
              label="היסטוריית תורים"
              htmlFor="business-history-retention"
              help={`אפשר ${monthsLimitText(terms.historyMaxMonths)}.`}
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
            <SettingsRow
              label="התכתבות וואטסאפ ותמלול"
              htmlFor="business-whatsapp-retention"
              help={`השדה קובע את תמלול השיחה, הסיכום והתכתבות הוואטסאפ. אפשר ${monthsLimitText(terms.correspondenceMaxMonths)}.`}
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
          </SettingsGroup>
        )}

        {isVisible('is_active') && (
          <SettingsGroup
            title="סוכנים"
            description="כיבוי משבית את סוכן הקול ואת סוכן הוואטסאפ. היומן נשאר פתוח, ואפשר להפעיל שוב."
          >
            <SettingsRow
              label="הסוכנים פעילים"
              htmlFor="business-is-active"
              help="כשכבוי, הסוכנים מושבתים והיומן נשאר פתוח. סגירת החשבון נמצאת למטה, ורק בעל העסק יכול לבצע אותה."
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
  const [deletingServiceId, setDeletingServiceId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Service | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const activeColumns = SERVICE_FIELDS.filter((field) =>
    visibleFields.includes(field.key),
  );
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
          <button
            type="button"
            className={`${styles.btnPrimary} ${styles.addServiceButton}`}
            onClick={() => setModalMode('add')}
          >
            הוסף שירות
          </button>
        </div>
      </div>

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
                colSpan={Math.max(activeColumns.length, 1) + 1}
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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedStatusCode, setSelectedStatusCode] = useState<string | null>(
    null,
  );
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const activeColumns = STATUS_FIELDS.filter((field) =>
    visibleFields.includes(field.key),
  );
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
    setIsEditOpen(true);
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
        />
        <tbody>
          {visibleStatuses.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(activeColumns.length, 1) + 1}
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

      {isEditOpen && selectedStatus && (
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
