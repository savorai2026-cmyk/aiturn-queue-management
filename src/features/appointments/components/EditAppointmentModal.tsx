import { useEffect, useMemo, useState } from 'react';
import {
  withCurrentStatus,
  type StatusCatalogItem,
} from '../appointmentStatuses';
import type {
  AppointmentDetails,
  AppointmentEditValues,
} from '../appointments.types';
import { formatTimeHm } from '../time';
import { getAppointmentSaveErrorMessage } from '../../../shared/errors';
import { DateField } from '../../../shared/components/DateField';
import { HourMinuteField } from '../../../shared/components/HourMinuteField';
import { SaveIcon } from '../../../shared/components/icons';
import styles from './EditAppointmentModal.module.css';

const ILS_FORMATTER = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
});

interface EditAppointmentModalProps {
  appointment: AppointmentDetails;
  initialValues: AppointmentEditValues;
  statuses: StatusCatalogItem[];
  isSaving: boolean;
  errorMessage: string;
  onSave: (values: AppointmentEditValues) => Promise<void>;
  onClose: () => void;
}

export default function EditAppointmentModal({
  appointment,
  initialValues,
  statuses,
  isSaving,
  errorMessage,
  onSave,
  onClose,
}: EditAppointmentModalProps) {
  const [formData, setFormData] = useState<AppointmentEditValues>(initialValues);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  const totalPrice = useMemo(() => {
    if (formData.servicePrices.length === 0) {
      return formData.price;
    }
    return formData.servicePrices.reduce(
      (total, service) => total + service.price,
      0,
    );
  }, [formData]);

  const statusOptions = withCurrentStatus(statuses, formData.status);
  const displayedError = localError || errorMessage;

  const handleSave = async () => {
    setLocalError('');

    if (formData.end_time <= formData.start_time) {
      setLocalError('שעת הסיום חייבת להיות מאוחרת משעת ההתחלה.');
      return;
    }

    try {
      await onSave(formData);
    } catch (error) {
      setLocalError(getAppointmentSaveErrorMessage(error));
    }
  };

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <section
        className={styles.content}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-appointment-title"
      >
        <h2 id="edit-appointment-title" className={styles.title}>
          עריכת תור · {appointment.patientName}
        </h2>

        <p className={styles.banner}>
          אפשר לערוך את פרטי התור לפני השמירה. המועד החדש כבר מעודכן בטופס.
        </p>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>שם מטופל</span>
          <span className={styles.fieldValue}>{appointment.patientName}</span>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>טלפון</span>
          <span className={styles.fieldValue} dir="ltr">
            {appointment.clientPhone || '—'}
          </span>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>תאריך</span>
          <DateField
            aria-label="תאריך"
            value={formData.appointment_date}
            onChange={(date) =>
              setFormData((current) => ({
                ...current,
                appointment_date: date,
              }))
            }
          />
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>שעות</span>
          <div className={styles.inlineFields}>
            <HourMinuteField
              value={formData.start_time}
              aria-label="שעת התחלה"
              onChange={(startTime) =>
                setFormData((current) => ({
                  ...current,
                  start_time: startTime,
                }))
              }
            />
            <HourMinuteField
              value={formData.end_time}
              aria-label="שעת סיום"
              onChange={(endTime) =>
                setFormData((current) => ({
                  ...current,
                  end_time: endTime,
                }))
              }
            />
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>סטטוס</span>
          <select
            className={styles.input}
            value={formData.status}
            onChange={(event) => {
              const status = event.target.value;
              setFormData((current) => ({ ...current, status }));
            }}
          >
            {statusOptions.map((status) => (
              <option key={status.status_code} value={status.status_code}>
                {status.status_text}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.services}>
          <span className={styles.fieldLabel}>שירותים ומחירים</span>
          {appointment.services.map((service, index) => {
            const priceValue =
              formData.servicePrices[index]?.price ?? service.price;

            return (
              <div
                key={`${service.serviceId}-${service.position}`}
                className={styles.serviceRow}
              >
                <div>
                  <strong>{service.title}</strong>
                  <div className={styles.serviceMeta}>
                    {formatTimeHm(service.startTime)} -{' '}
                    {formatTimeHm(service.endTime)}
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={styles.priceInput}
                  value={priceValue}
                  onChange={(event) => {
                    const nextPrice = Number(event.target.value);
                    setFormData((current) => ({
                      ...current,
                      servicePrices: current.servicePrices.map((item) =>
                        item.serviceId === service.serviceId
                          ? {
                              ...item,
                              price: Number.isFinite(nextPrice) ? nextPrice : 0,
                            }
                          : item,
                      ),
                    }));
                  }}
                />
              </div>
            );
          })}
          <div className={styles.totalRow}>
            <span>סה״כ</span>
            <strong>{ILS_FORMATTER.format(totalPrice)}</strong>
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>הערות לקוח</span>
          <textarea
            className={styles.textarea}
            value={formData.client_notes}
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                client_notes: event.target.value,
              }))
            }
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>הערות עסק</span>
          <textarea
            className={styles.textarea}
            value={formData.business_notes}
            onChange={(event) =>
              setFormData((current) => ({
                ...current,
                business_notes: event.target.value,
              }))
            }
            placeholder="הערות פנימיות לעסק"
          />
        </label>

        {displayedError && (
          <p className={styles.error} role="alert">
            {displayedError}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={onClose}
            disabled={isSaving}
          >
            חזרה
          </button>
          <button
            type="button"
            className={styles.btnSave}
            onClick={() => {
              void handleSave();
            }}
            disabled={isSaving}
          >
            {isSaving ? 'שומר...' : (
              <>
                <SaveIcon />
                שמירה
              </>
            )}
          </button>
        </div>

        {isSaving && (
          <div className={styles.blockingOverlay} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            שומר...
          </div>
        )}
      </section>
    </div>
  );
}
