import { useEffect, useMemo, useState } from 'react';
import {
  formatAppointmentField,
  toAppointmentDetailRows,
  toAppointmentEditValues,
  areAppointmentEditsEqual,
} from '../appointments.mappers';
import { formatTimeHm } from '../time';
import {
  getStatusLabel,
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
import { PencilIcon, SaveIcon } from '../../../shared/components/icons';
import { WaitingOverlay } from '../../../shared/components/QLoader';
import PaymentHoldNotice from './PaymentHoldNotice';
import styles from './SidePanel.module.css';

const ILS_FORMATTER = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
});

interface SidePanelProps {
  appointment: AppointmentDetails | null;
  statuses: StatusCatalogItem[];
  isBusy: boolean;
  readOnly?: boolean;
  visibleFields: string[];
  onToggleField: (key: string) => void;
  onSave: (values: AppointmentEditValues) => Promise<void>;
  onClose: () => void;
  editToken?: number;
  groupAppointments?: AppointmentDetails[];
}

export const SidePanel = ({
  appointment,
  statuses,
  isBusy,
  readOnly = false,
  visibleFields,
  onToggleField,
  onSave,
  onClose,
  editToken = 0,
  groupAppointments,
}: SidePanelProps) => {
  const [isEditing, setIsEditing] = useState(editToken > 0);

  useEffect(() => {
    if (editToken > 0) setIsEditing(true);
  }, [editToken]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [formData, setFormData] = useState<AppointmentEditValues | null>(
    () => (appointment ? toAppointmentEditValues(appointment) : null),
  );
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isEditing) return;
    setFormData(appointment ? toAppointmentEditValues(appointment) : null);
  }, [appointment, isEditing]);

  const panelMembers = useMemo(() => {
    if (!appointment) return [];
    const members =
      groupAppointments && groupAppointments.length > 0
        ? groupAppointments
        : [appointment];
    return members.some((member) => member.id === appointment.id)
      ? members
      : [appointment];
  }, [appointment, groupAppointments]);

  const totalPrice = useMemo(() => {
    if (!formData || !appointment) return 0;
    const ownTotal =
      formData.servicePrices.length === 0
        ? formData.price
        : formData.servicePrices.reduce((total, service) => total + service.price, 0);
    const companionTotal = panelMembers
      .filter((member) => member.id !== appointment.id)
      .reduce(
        (total, member) =>
          total + member.services.reduce((sum, service) => sum + service.price, 0),
        0,
      );
    return ownTotal + companionTotal;
  }, [appointment, formData, panelMembers]);

  const baseline = useMemo(
    () => (appointment ? toAppointmentEditValues(appointment) : null),
    [appointment],
  );
  const hasChanges = Boolean(
    formData && baseline && !areAppointmentEditsEqual(baseline, formData),
  );

  if (!appointment || !formData) {
    return (
      <div className={`${styles.container} ${styles.emptyState}`}>
        בחר תור ביומן כדי לראות פרטים
      </div>
    );
  }

  const handleSave = async () => {
    if (!hasChanges || isBusy) {
      return;
    }

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

  const groupStart = panelMembers[0]?.start_time ?? formData.start_time;
  const groupEnd = panelMembers[panelMembers.length - 1]?.end_time ?? formData.end_time;
  const timeRange = `${formatTimeHm(
    panelMembers.length > 1 && !isEditing ? groupStart : formData.start_time,
  )} - ${formatTimeHm(
    panelMembers.length > 1 && !isEditing ? groupEnd : formData.end_time,
  )}`;
  const detailAppointment =
    panelMembers.length > 1
      ? {
          ...appointment,
          start_time: groupStart,
          end_time: groupEnd,
          services: panelMembers.flatMap((member) => member.services),
          price: totalPrice,
        }
      : appointment;
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
            variant="solid"
            helpPosition="start"
            compact
          />
          {readOnly ? null : (
            <>
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
                title={hasChanges ? 'שמירה' : 'אין שינויים לשמירה'}
                disabled={isBusy || !hasChanges}
              >
                <SaveIcon />
              </button>
            </>
          )}
          <button
            type="button"
            className={styles.iconButton}
            onClick={onClose}
            aria-label="סגירת פרטי התור"
            title="סגירה"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <PaymentHoldNotice appointment={appointment} />
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
          {panelMembers.flatMap((member) =>
            member.services.map((service, index) => {
              const ownsService = member.id === appointment.id;
              const priceValue = ownsService
                ? formData.servicePrices[index]?.price ?? service.price
                : service.price;

              return (
                <div
                  key={`${member.id}-${service.serviceId}-${service.position}-${index}`}
                  className={styles.serviceRow}
                >
                  <div>
                    <span className={styles.serviceTitle}>{service.title}</span>
                    <div className={styles.serviceMeta}>
                      {formatTimeHm(service.startTime)} - {formatTimeHm(service.endTime)}
                    </div>
                  </div>
                  {isEditing && ownsService ? (
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
            }),
          )}
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
            readOnly={!isEditing}
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
      </div>

      {isBusy && <WaitingOverlay message="שומר..." />}

      {isDetailsOpen && (
        <RecordDetailsModal
          title={`פרטי תור · ${appointment.patientName}`}
          rows={toAppointmentDetailRows(detailAppointment, statuses)}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}
    </div>
  );
};
