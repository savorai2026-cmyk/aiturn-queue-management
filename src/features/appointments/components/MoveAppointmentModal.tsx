import { useEffect, useState } from 'react';
import type { AppointmentDetails } from '../appointments.types';
import {
  formatHebrewDateTime,
  formatTimeHm,
  minutesToTime,
  nowInTimeZone,
  parseTimeToMinutes,
  toLocalDateFromKey,
} from '../time';
import { getAppointmentSaveErrorMessage } from '../../../shared/errors';
import { DateField } from '../../../shared/components/DateField';
import { HourMinuteField } from '../../../shared/components/HourMinuteField';
import { MoveIcon } from '../../../shared/components/icons';
import modal from '../../../shared/components/modalShell.module.css';
import styles from './MoveAppointmentModal.module.css';

interface MoveAppointmentModalProps {
  appointment: AppointmentDetails;
  timezone?: string | null;
  isSaving: boolean;
  onMove: (values: {
    appointment_date: string;
    start_time: string;
    end_time: string;
  }) => Promise<void>;
  onClose: () => void;
}

function appointmentDurationMinutes(appointment: AppointmentDetails) {
  return Math.max(
    parseTimeToMinutes(appointment.end_time) -
      parseTimeToMinutes(appointment.start_time),
    5,
  );
}

function endTimeForStart(startTime: string, durationMinutes: number) {
  const total = parseTimeToMinutes(startTime) + durationMinutes;
  if (total >= 24 * 60) return null;
  return formatTimeHm(minutesToTime(total));
}

export default function MoveAppointmentModal({
  appointment,
  timezone = null,
  isSaving,
  onMove,
  onClose,
}: MoveAppointmentModalProps) {
  const durationMinutes = appointmentDurationMinutes(appointment);
  const [date, setDate] = useState(appointment.appointment_date);
  const [startTime, setStartTime] = useState(
    formatTimeHm(appointment.start_time),
  );
  const [errorMessage, setErrorMessage] = useState('');
  const endTime = endTimeForStart(startTime, durationMinutes);
  const nextStart = toLocalDateFromKey(date, startTime);
  const isPast = nextStart.getTime() < nowInTimeZone(timezone).getTime();
  const currentLabel = formatHebrewDateTime(
    toLocalDateFromKey(
      appointment.appointment_date,
      appointment.start_time,
    ),
  );
  const serviceTitle = appointment.services
    .map((service) => service.title)
    .filter(Boolean)
    .join(', ');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  const handleMove = async () => {
    setErrorMessage('');

    if (
      date === appointment.appointment_date &&
      startTime === formatTimeHm(appointment.start_time)
    ) {
      setErrorMessage('זו השעה הנוכחית. בחרו שעה אחרת.');
      return;
    }

    if (!endTime) {
      setErrorMessage('השעה שנבחרה חורגת מסוף היום.');
      return;
    }

    try {
      await onMove({
        appointment_date: date,
        start_time: startTime,
        end_time: endTime,
      });
    } catch (error) {
      setErrorMessage(getAppointmentSaveErrorMessage(error));
    }
  };

  return (
    <div
      className={`${modal.overlay} ${styles.overlay}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <section
        className={`${modal.content} ${styles.content}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-appointment-title"
      >
        <h2 id="move-appointment-title" className={styles.title}>
          הזזת תור
        </h2>

        <div className={modal.scroll}>
          <p className={styles.lead}>
            בחרו תאריך ושעה חדשים עבור{' '}
            <strong>{appointment.patientName}</strong>. התור יועבר לפי הבחירה.
          </p>

          <dl className={styles.details}>
            <div>
              <dt>לקוח</dt>
              <dd>{appointment.patientName}</dd>
            </div>
            {serviceTitle ? (
              <div>
                <dt>שירות</dt>
                <dd>{serviceTitle}</dd>
              </div>
            ) : null}
            <div>
              <dt>מועד נוכחי</dt>
              <dd>
                {currentLabel} – {formatTimeHm(appointment.end_time)}
              </dd>
            </div>
          </dl>

          <div className={styles.fields}>
            <label className={styles.field}>
              <span>תאריך חדש</span>
              <DateField
                aria-label="תאריך חדש"
                value={date}
                onChange={setDate}
              />
            </label>

            <div className={styles.timePair}>
              <label className={styles.field}>
                <span>שעת התחלה</span>
                <HourMinuteField
                  aria-label="שעת התחלה חדשה"
                  value={startTime}
                  onChange={setStartTime}
                />
              </label>
              <label className={styles.field}>
                <span>שעת סיום</span>
                <HourMinuteField
                  aria-label="שעת סיום"
                  value={endTime ?? startTime}
                  readOnly
                />
              </label>
            </div>
          </div>

          {appointment.services.length > 1 ? (
            <p className={styles.note}>
              כל השירותים בתור יועברו יחד למועד החדש.
            </p>
          ) : null}

          {isPast ? (
            <p className={styles.warning} role="status">
              המועד החדש כבר עבר. אפשר עדיין להעביר אם רוצים לתעד תור שכבר
              התקיים.
            </p>
          ) : null}

          {errorMessage ? (
            <p className={styles.error} role="alert">
              {errorMessage}
            </p>
          ) : null}
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
            type="button"
            className={styles.btnSave}
            onClick={() => {
              void handleMove();
            }}
            disabled={isSaving || !endTime}
          >
            {isSaving ? (
              'מעביר...'
            ) : (
              <>
                <MoveIcon />
                הזז תור
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
