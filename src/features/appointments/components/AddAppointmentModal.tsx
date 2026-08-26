import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  getAppointmentClients,
  getAppointmentServiceOptions,
} from '../appointments.api';
import {
  bookAppointment,
  getSchedulerSlots,
} from '../scheduler.api';
import {
  creatableStatuses,
  pickDefaultCreateStatus,
  type StatusCatalogItem,
} from '../appointmentStatuses';
import type {
  AppointmentClientOption,
  AppointmentServiceOption,
  SchedulerSlot,
} from '../appointments.types';
import { toDateKey, toSchedulerDateTime } from '../time';
import { getBookingMaxDate } from '../workingHours';
import {
  errorIncludes,
  getErrorMessage,
} from '../../../shared/errors';
import HelpTip from '../../../shared/components/HelpTip';
import styles from './AddAppointmentModal.module.css';

interface AddAppointmentModalProps {
  businessCode: string;
  statuses: StatusCatalogItem[];
  maxAdvBookingDays?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface AppointmentFormData {
  client_id: string;
  appointment_date: string;
  start_time: string;
  status: string;
  client_notes: string;
  business_notes: string;
}
const ILS_FORMATTER = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
});

function addMinutesToTime(time: string, minutes: number) {
  const [hours, minuteValue] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minuteValue + minutes;

  if (!Number.isFinite(totalMinutes) || totalMinutes >= 24 * 60) {
    return null;
  }

  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

function formatTime(time: string) {
  return time.slice(0, 5);
}

export default function AddAppointmentModal({
  businessCode,
  statuses,
  maxAdvBookingDays = null,
  onClose,
  onSuccess,
}: AddAppointmentModalProps) {
  const createStatusOptions = creatableStatuses(statuses);
  const minAppointmentDate = toDateKey(new Date());
  const maxAppointmentDate = getBookingMaxDate(maxAdvBookingDays);
  const [clients, setClients] = useState<AppointmentClientOption[]>([]);
  const [services, setServices] = useState<AppointmentServiceOption[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [availableSlots, setAvailableSlots] = useState<SchedulerSlot[]>([]);
  const [formData, setFormData] = useState<AppointmentFormData>({
    client_id: '',
    appointment_date: minAppointmentDate,
    start_time: '09:00',
    status: pickDefaultCreateStatus(statuses).status_code,
    client_notes: '',
    business_notes: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [slotMessage, setSlotMessage] = useState('');
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    void Promise.all([
      getAppointmentClients(businessCode),
      getAppointmentServiceOptions(businessCode),
    ])
      .then(([clientOptions, serviceOptions]) => {
        if (isCancelled) return;

        setClients(clientOptions);
        setServices(serviceOptions);
        setFormData((previous) => ({
          ...previous,
          client_id: previous.client_id || String(clientOptions[0]?.id ?? ''),
        }));
      })
      .catch((error: unknown) => {
        if (isCancelled) return;

        console.error(
          'שגיאה בטעינת אפשרויות התור:',
          getErrorMessage(error),
        );
        setErrorMessage('לא ניתן לטעון את הלקוחות והשירותים.');
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingOptions(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [businessCode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  const selectedServices = useMemo(
    () =>
      selectedServiceIds
        .map((serviceId) =>
          services.find((service) => service.id === serviceId),
        )
        .filter(
          (service): service is AppointmentServiceOption =>
            service !== undefined,
        ),
    [selectedServiceIds, services],
  );

  const totalDurationMinutes = selectedServices.reduce(
    (total, service) =>
      total +
      service.duration_minutes +
      (service.buffer_time_minutes ?? 0),
    0,
  );
  const totalPrice = selectedServices.reduce(
    (total, service) => total + service.price,
    0,
  );
  const calculatedEndTime = addMinutesToTime(
    formData.start_time,
    totalDurationMinutes,
  );

  const clearSlotSuggestions = () => {
    setAvailableSlots([]);
    setSlotMessage('');
  };

  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = event.target;

    if (name === 'status') {
      setFormData((previous) => ({ ...previous, status: value }));
      return;
    }

    setFormData((previous) => ({ ...previous, [name]: value }));

    if (name === 'appointment_date' || name === 'start_time') {
      clearSlotSuggestions();
    }
  };

  const toggleService = (serviceId: number) => {
    setSelectedServiceIds((previous) =>
      previous.includes(serviceId)
        ? previous.filter((id) => id !== serviceId)
        : [...previous, serviceId],
    );
    clearSlotSuggestions();
  };

  const loadAvailableSlots = async () => {
    if (selectedServiceIds.length === 0) {
      setSlotMessage('בחר לפחות שירות אחד כדי לחפש זמנים פנויים.');
      return;
    }

    setIsLoadingSlots(true);
    setSlotMessage('');

    try {
      const slots = await getSchedulerSlots({
        businessCode,
        date: formData.appointment_date,
        serviceId: selectedServiceIds[0],
        duration: totalDurationMinutes,
      });
      setAvailableSlots(slots);
      setSlotMessage(
        slots.length === 0
          ? 'לא נמצאו זמנים פנויים ביום שנבחר.'
          : 'בחר זמן פנוי מהרשימה:',
      );
    } catch (error) {
      console.error('שגיאה בחיפוש זמנים פנויים:', getErrorMessage(error));
      setSlotMessage('לא ניתן לחשב זמנים פנויים כרגע.');
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    if (!formData.client_id) {
      setErrorMessage('יש לבחור לקוח לפני יצירת התור.');
      return;
    }

    if (selectedServiceIds.length === 0) {
      setErrorMessage('יש לבחור לפחות שירות אחד.');
      return;
    }

    if (!calculatedEndTime) {
      setErrorMessage('השירותים שנבחרו חורגים מסוף היום.');
      return;
    }

    const selectedClient = clients.find(
      (client) => String(client.id) === formData.client_id,
    );

    if (!selectedClient) {
      setErrorMessage('יש לבחור לקוח לפני יצירת התור.');
      return;
    }

    setIsSaving(true);

    try {
      await bookAppointment({
        businessCode,
        clientName: selectedClient.full_name || '',
        clientPhone: selectedClient.mobile_phone,
        appointmentTime: toSchedulerDateTime(
          formData.appointment_date,
          formData.start_time,
        ),
        services: selectedServices.map((service) => ({
          serviceId: service.id,
          duration: service.duration_minutes,
          price: service.price,
        })),
        status: formData.status,
        clientNotes: formData.client_notes,
        businessNotes: formData.business_notes,
      });
      onSuccess();
    } catch (error) {
      console.error('שגיאה ביצירת תור:', getErrorMessage(error));

      if (errorIncludes(error, 'prevent_overlapping_appointments')) {
        setErrorMessage(
          'הזמן שנבחר מתנגש בתור קיים. מוצגים זמנים פנויים חלופיים.',
        );
        await loadAvailableSlots();
      } else {
        setErrorMessage(
          'לא ניתן ליצור את התור. בדוק את הפרטים ונסה שוב.',
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const canSubmit =
    !isLoadingOptions &&
    !isSaving &&
    clients.length > 0 &&
    selectedServiceIds.length > 0;

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
        aria-labelledby="add-appointment-title"
      >
        <h2 id="add-appointment-title" className={styles.title}>
          קביעת תור חדש
        </h2>

        {errorMessage && (
          <div role="alert" className={styles.error}>
            {errorMessage}
          </div>
        )}

        {clients.length === 0 && !isLoadingOptions && (
          <div className={styles.notice}>
            אין לקוחות בעסק. יש ליצור לקוח לפני קביעת תור.
          </div>
        )}

        {services.length === 0 && !isLoadingOptions && (
          <div className={styles.notice}>
            אין שירותים פעילים. יש להוסיף שירות במסך ההגדרות.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="appointment-client">בחר לקוח *</label>
            <select
              id="appointment-client"
              name="client_id"
              required
              value={formData.client_id}
              onChange={handleChange}
              className={styles.select}
              disabled={isLoadingOptions || clients.length === 0}
            >
              <option value="">בחר לקוח</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name || 'ללא שם'} ({client.mobile_phone})
                </option>
              ))}
            </select>
          </div>

          <fieldset className={styles.servicesFieldset}>
            <legend>טיפולים ושירותים *</legend>
            <div className={styles.serviceList}>
              {services.map((service) => {
                const isSelected = selectedServiceIds.includes(service.id);
                const occupiedMinutes =
                  service.duration_minutes +
                  (service.buffer_time_minutes ?? 0);

                return (
                  <label
                    key={service.id}
                    className={`${styles.serviceOption} ${isSelected ? styles.serviceOptionSelected : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleService(service.id)}
                    />
                    <span className={styles.serviceInfo}>
                      <strong>{service.title}</strong>
                      <span>
                        {occupiedMinutes} דקות ·{' '}
                        {ILS_FORMATTER.format(service.price)}
                      </span>
                      {service.description && (
                        <small>{service.description}</small>
                      )}
                    </span>
                    <span
                      className={styles.serviceColor}
                      style={{
                        backgroundColor: service.color_code || '#0d9488',
                      }}
                      aria-hidden="true"
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>

          {selectedServices.length > 0 && (
            <div className={styles.summary} aria-live="polite">
              <span>
                <strong>{selectedServices.length}</strong> שירותים
              </span>
              <span>
                משך כולל: <strong>{totalDurationMinutes} דקות</strong>
              </span>
              <span>
                מחיר כולל:{' '}
                <strong>{ILS_FORMATTER.format(totalPrice)}</strong>
              </span>
            </div>
          )}

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="appointment-date">תאריך התור *</label>
              <input
                id="appointment-date"
                type="date"
                name="appointment_date"
                required
                min={minAppointmentDate}
                max={maxAppointmentDate ?? undefined}
                value={formData.appointment_date}
                onChange={handleChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="appointment-start">שעת התחלה *</label>
              <input
                id="appointment-start"
                type="time"
                name="start_time"
                required
                value={formData.start_time}
                onChange={handleChange}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="appointment-end">שעת סיום</label>
              <input
                id="appointment-end"
                type="time"
                value={calculatedEndTime ?? ''}
                className={styles.input}
                readOnly
              />
            </div>
          </div>

          <button
            type="button"
            className={styles.availabilityButton}
            onClick={() => void loadAvailableSlots()}
            disabled={
              isLoadingSlots ||
              selectedServiceIds.length === 0 ||
              !formData.appointment_date
            }
          >
            {isLoadingSlots ? 'מחפש...' : 'מצא זמנים פנויים'}
          </button>

          {(slotMessage || availableSlots.length > 0) && (
            <div className={styles.availabilityResults} aria-live="polite">
              {slotMessage && <p>{slotMessage}</p>}
              <div className={styles.slotList}>
                {availableSlots.map((slot) => (
                  <button
                    key={`${slot.startTime}-${slot.endTime}`}
                    type="button"
                    className={styles.slotButton}
                    onClick={() => {
                      setFormData((previous) => ({
                        ...previous,
                        start_time: formatTime(slot.startTime),
                      }));
                      setAvailableSlots([]);
                      setSlotMessage(
                        `נבחרה השעה ${formatTime(slot.startTime)}–${formatTime(slot.endTime)}.`,
                      );
                    }}
                  >
                    {formatTime(slot.startTime)}–{formatTime(slot.endTime)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="appointment-status">סטטוס</label>
            <select
              id="appointment-status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className={styles.select}
            >
              {createStatusOptions.map((status) => (
                <option key={status.status_code} value={status.status_code}>
                  {status.status_text}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="appointment-client-notes">הערות הלקוח</label>
              <HelpTip text="מידע שהלקוח מסר, למשל בקשה מיוחדת. יכול להיות גלוי ללקוח בהודעות." />
            </div>
            <textarea
              id="appointment-client-notes"
              name="client_notes"
              value={formData.client_notes}
              onChange={handleChange}
              className={styles.textarea}
              rows={2}
            />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="appointment-business-notes">
                הערות פנימיות לעסק
              </label>
              <HelpTip text="הערות לצוות בלבד. לא מוצגות ללקוח." />
            </div>
            <textarea
              id="appointment-business-notes"
              name="business_notes"
              value={formData.business_notes}
              onChange={handleChange}
              className={styles.textarea}
              rows={2}
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnCancel}
              onClick={onClose}
              disabled={isSaving}
            >
              ביטול
            </button>
            <button
              type="submit"
              className={styles.btnSave}
              disabled={!canSubmit}
            >
              {isSaving ? 'יוצר תור...' : 'צור תור'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
