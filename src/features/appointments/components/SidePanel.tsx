import { useMemo, useState } from 'react';
import {
  formatAppointmentField,
  toAppointmentDetailRows,
  toAppointmentEditValues,
} from '../appointments.mappers';
import { formatTimeHm } from '../time';
import {
  getStatusLabel,
  isCanceledStatus,
  withCurrentStatus,
  type StatusCatalogItem,
} from '../appointmentStatuses';
import type {
  AppointmentDetails,
  AppointmentEditValues,
} from '../appointments.types';
import { getAppointmentSaveErrorMessage } from '../../../shared/errors';
import DisplayToolbar from '../../../shared/displayFields/DisplayToolbar';
import RecordDetailsModal from '../../../shared/displayFields/RecordDetailsModal';
import { APPOINTMENT_FIELDS } from '../../../shared/displayFields/catalogs';
import HelpTip from '../../../shared/components/HelpTip';
import { DateField } from '../../../shared/components/DateField';
import { HourMinuteField } from '../../../shared/components/HourMinuteField';
import { BanIcon, MoveIcon, PencilIcon, SaveIcon, WhatsAppIcon } from '../../../shared/components/icons';
import styles from './SidePanel.module.css';

const ILS_FORMATTER = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
});

interface SidePanelProps {
  appointment: AppointmentDetails | null;
  statuses: StatusCatalogItem[];
  isBusy: boolean;
  visibleFields: string[];
  onToggleField: (key: string) => void;
  onMoveOptions: () => void;
  onSave: (values: AppointmentEditValues) => Promise<void>;
  onCancelAppointment: () => Promise<void>;
}

export const SidePanel = ({
  appointment,
  statuses,
  isBusy,
  visibleFields,
  onToggleField,
  onMoveOptions,
  onSave,
  onCancelAppointment,
}: SidePanelProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [formData, setFormData] = useState<AppointmentEditValues | null>(
    () => (appointment ? toAppointmentEditValues(appointment) : null),
  );
  const [errorMessage, setErrorMessage] = useState('');

  const totalPrice = useMemo(() => {
    if (!formData) return 0;
    if (formData.servicePrices.length === 0) {
      return formData.price;
    }
    return formData.servicePrices.reduce(
      (total, service) => total + service.price,
      0,
    );
  }, [formData]);

  if (!appointment || !formData) {
    return (
      <div className={`${styles.container} ${styles.emptyState}`}>
        בחר תור ביומן כדי לראות פרטים
      </div>
    );
  }

  const handleSave = async () => {
    setErrorMessage('');

    if (formData.end_time <= formData.start_time) {
      setErrorMessage('שעת הסיום חייבת להיות מאוחרת משעת ההתחלה.');
      return;
    }

    try {
      await onSave(formData);
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(getAppointmentSaveErrorMessage(error));
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('לבטל את התור הנבחר?')) {
      return;
    }

    setErrorMessage('');

    try {
      await onCancelAppointment();
    } catch {
      setErrorMessage('לא ניתן לבטל את התור כרגע.');
    }
  };

  const timeRange = `${formatTimeHm(formData.start_time)} - ${formatTimeHm(formData.end_time)}`;
  const isVisible = (key: string) => visibleFields.includes(key);
  const statusOptions = withCurrentStatus(statuses, formData.status);

  return (
    <div className={`${styles.container} ${styles.selected}`}>
      <div className={styles.header}>
        <span>פרטי תור</span>
        <div className={styles.headerActions}>
          <DisplayToolbar
            fields={APPOINTMENT_FIELDS}
            visibleKeys={visibleFields}
            onToggle={onToggleField}
            onViewDetails={() => setIsDetailsOpen(true)}
            canViewDetails
            variant="onDark"
            helpPosition="start"
          />
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setIsEditing((current) => !current)}
            aria-label={isEditing ? 'סגור עריכה' : 'עריכת פרטי התור'}
            title={isEditing ? 'סגור עריכה' : 'עריכה'}
            disabled={isBusy}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => void handleSave()}
            aria-label="שמירת שינויים"
            title="שמירה"
            disabled={isBusy}
          >
            <SaveIcon />
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {isVisible('patientName') && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>שם מטופל</span>
          <span className={styles.fieldValue}>{appointment.patientName}</span>
        </div>
        )}

        {isVisible('clientPhone') && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>טלפון</span>
          <span className={styles.fieldValue} dir="ltr">
            {appointment.clientPhone || '—'}
          </span>
        </div>
        )}

        {isVisible('hours') && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>שעות</span>
          {isEditing ? (
            <div className={styles.inlineFields}>
              <HourMinuteField
                value={formData.start_time}
                aria-label="שעת התחלה"
                onChange={(startTime) =>
                  setFormData((current) =>
                    current ? { ...current, start_time: startTime } : current,
                  )
                }
              />
              <HourMinuteField
                value={formData.end_time}
                aria-label="שעת סיום"
                onChange={(endTime) =>
                  setFormData((current) =>
                    current ? { ...current, end_time: endTime } : current,
                  )
                }
              />
            </div>
          ) : (
            <span className={styles.fieldValue}>{timeRange}</span>
          )}
        </div>
        )}

        {isVisible('appointment_date') && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>תאריך</span>
          {isEditing ? (
            <DateField
              aria-label="תאריך"
              value={formData.appointment_date}
              onChange={(date) =>
                setFormData((current) =>
                  current
                    ? { ...current, appointment_date: date }
                    : current,
                )
              }
            />
          ) : (
            <span className={styles.fieldValue}>
              {formData.appointment_date}
            </span>
          )}
        </div>
        )}

        {isVisible('status') && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>סטטוס</span>
          {isEditing ? (
            <select
              className={styles.input}
              value={formData.status}
              onChange={(event) => {
                const status = event.target.value;
                setFormData((current) =>
                  current ? { ...current, status } : current,
                );
              }}
            >
              {statusOptions.map((status) => (
                <option key={status.status_code} value={status.status_code}>
                  {status.status_text}
                </option>
              ))}
            </select>
          ) : (
            <span className={styles.fieldValue}>
              {getStatusLabel(formData.status, statuses)}
            </span>
          )}
        </div>
        )}

        {isVisible('channel') && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>ערוץ הזמנה</span>
          <span className={styles.fieldValue}>
            {formatAppointmentField(appointment, 'channel') || '—'}
          </span>
        </div>
        )}

        {isVisible('services') && (
        <div className={styles.services}>
          <span className={styles.fieldLabel}>שירותים ומחירים</span>
          {appointment.services.map((service, index) => {
            const priceValue = formData.servicePrices[index]?.price ?? service.price;

            return (
              <div key={`${service.serviceId}-${service.position}`} className={styles.serviceRow}>
                <div>
                  <strong>{service.title}</strong>
                  <div className={styles.serviceMeta}>
                    {formatTimeHm(service.startTime)} - {formatTimeHm(service.endTime)}
                  </div>
                </div>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className={styles.priceInput}
                    value={priceValue}
                    onChange={(event) => {
                      const nextPrice = Number(event.target.value);
                      setFormData((current) => {
                        if (!current) return current;
                        const servicePrices = current.servicePrices.map((item) =>
                          item.serviceId === service.serviceId
                            ? { ...item, price: Number.isFinite(nextPrice) ? nextPrice : 0 }
                            : item,
                        );
                        return { ...current, servicePrices };
                      });
                    }}
                  />
                ) : (
                  <span className={styles.priceValue}>
                    {ILS_FORMATTER.format(priceValue)}
                  </span>
                )}
              </div>
            );
          })}
          <div className={styles.totalRow}>
            <span>סה״כ</span>
            <strong>{ILS_FORMATTER.format(totalPrice)}</strong>
          </div>
        </div>
        )}

        {isVisible('price') && !isVisible('services') && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>מחיר כולל</span>
          <span className={styles.fieldValue}>
            {ILS_FORMATTER.format(totalPrice)}
          </span>
        </div>
        )}

        {isVisible('client_notes') && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            הערות לקוח
            <HelpTip text="מידע שהלקוח מסר. יכול להיות גלוי ללקוח בהודעות." />
          </span>
          <textarea
            className={styles.textarea}
            value={formData.client_notes}
            readOnly={!isEditing}
            onChange={(event) =>
              setFormData((current) =>
                current
                  ? { ...current, client_notes: event.target.value }
                  : current,
              )
            }
          />
        </div>
        )}

        {isVisible('business_notes') && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            הערות עסק
            <HelpTip text="הערות לצוות בלבד. לא מוצגות ללקוח." />
          </span>
          <textarea
            className={styles.textarea}
            value={formData.business_notes}
            onChange={(event) =>
              setFormData((current) =>
                current
                  ? { ...current, business_notes: event.target.value }
                  : current,
              )
            }
          />
        </div>
        )}

        {errorMessage && (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        )}

        <div className={styles.actionsTitle}>פעולות על התור</div>

        <button
          className={styles.btn}
          type="button"
          onClick={onMoveOptions}
          disabled={isBusy || isCanceledStatus(appointment.status)}
        >
          <MoveIcon />
          אפשרויות הזזה
        </button>

        <button
          className={styles.btn}
          type="button"
          onClick={() => void handleCancel()}
          disabled={isBusy || isCanceledStatus(appointment.status)}
        >
          <BanIcon />
          ביטול תור
        </button>

        <button className={styles.btn} type="button" disabled title="בפיתוח">
          <WhatsAppIcon />
          שלח וואטסאפ חופשי
        </button>
      </div>

      {isBusy && (
        <div className={styles.blockingOverlay} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          שומר...
        </div>
      )}

      {isDetailsOpen && (
        <RecordDetailsModal
          title={`פרטי תור · ${appointment.patientName}`}
          rows={toAppointmentDetailRows(appointment, statuses)}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}
    </div>
  );
};
