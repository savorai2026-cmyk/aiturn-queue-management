import { useMemo, useState } from 'react';
import { updateOperatingHours } from '../settings.api';
import type { BusinessSettings } from '../settings.types';
import {
  BOOKING_WINDOW_PRESETS,
  getBookingMaxDate,
  toWorkingDayDrafts,
  toWorkingHoursPayload,
  validateWorkingDayDrafts,
  type WorkingDayDraft,
} from '../../appointments/workingHours';
import { toDateKey } from '../../appointments/time';
import HelpTip from '../../../shared/components/HelpTip';
import styles from './OperatingHoursForm.module.css';

interface OperatingHoursFormProps {
  business: BusinessSettings;
  onSaved: () => Promise<void>;
}

function formatHebrewDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

export default function OperatingHoursForm({
  business,
  onSaved,
}: OperatingHoursFormProps) {
  const [days, setDays] = useState<WorkingDayDraft[]>(() =>
    toWorkingDayDrafts(business.working_hours),
  );
  const [bookingDays, setBookingDays] = useState<string>(
    business.max_adv_booking_days == null
      ? ''
      : String(business.max_adv_booking_days),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const bookingMaxDate = useMemo(() => {
    const parsed = Number(bookingDays);
    if (!bookingDays || !Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return getBookingMaxDate(parsed);
  }, [bookingDays]);

  const updateDay = (key: WorkingDayDraft['key'], patch: Partial<WorkingDayDraft>) => {
    setDays((current) =>
      current.map((day) => (day.key === key ? { ...day, ...patch } : day)),
    );
  };

  const copyHoursToOpenDays = () => {
    const source = days.find((day) => day.isOpen);
    if (!source) return;

    setDays((current) =>
      current.map((day) =>
        day.isOpen ? { ...day, start: source.start, end: source.end } : day,
      ),
    );
  };

  const handleSave = async () => {
    setMessage(null);

    const hoursError = validateWorkingDayDrafts(days);
    if (hoursError) {
      setMessage({ text: hoursError, type: 'error' });
      return;
    }

    const parsedBookingDays = bookingDays === '' ? null : Number(bookingDays);
    if (
      parsedBookingDays !== null &&
      (!Number.isInteger(parsedBookingDays) ||
        parsedBookingDays < 1 ||
        parsedBookingDays > 365)
    ) {
      setMessage({
        text: 'מספר הימים לזימון חייב להיות בין 1 ל-365, או ריק ללא הגבלה.',
        type: 'error',
      });
      return;
    }

    setIsSaving(true);

    try {
      await updateOperatingHours(business.business_code, {
        working_hours: toWorkingHoursPayload(days) as BusinessSettings['working_hours'],
        max_adv_booking_days: parsedBookingDays,
      });
      await onSaved();
      setMessage({
        text: 'שעות הפעילות נשמרו. היומן וזימון התורים יתעדכנו בהתאם.',
        type: 'success',
      });
    } catch {
      setMessage({
        text: 'לא ניתן לשמור את שעות הפעילות.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>
            חלון זימון תורים
            <HelpTip text="כמה ימים קדימה אפשר לקבוע תור חדש. תורים שכבר קיימים ביומן יישארו גלויים גם מעבר לחלון הזה." />
          </h3>
        </div>

        <div className={styles.bookingRow}>
          <label className={styles.field}>
            <span>ימים קדימה</span>
            <input
              type="number"
              min="1"
              max="365"
              className={styles.input}
              value={bookingDays}
              placeholder="ללא הגבלה"
              onChange={(event) => setBookingDays(event.target.value)}
            />
          </label>
          <div className={styles.presets}>
            {BOOKING_WINDOW_PRESETS.map((daysAhead) => (
              <button
                key={daysAhead}
                type="button"
                className={`${styles.preset} ${bookingDays === String(daysAhead) ? styles.presetActive : ''}`}
                onClick={() => setBookingDays(String(daysAhead))}
              >
                {daysAhead} ימים
              </button>
            ))}
            <button
              type="button"
              className={`${styles.preset} ${bookingDays === '' ? styles.presetActive : ''}`}
              onClick={() => setBookingDays('')}
            >
              ללא הגבלה
            </button>
          </div>
        </div>

        <p className={styles.hint}>
          {bookingMaxDate
            ? `אפשר לקבוע תור חדש עד ${formatHebrewDate(bookingMaxDate)}.`
            : 'אין הגבלה על התאריך האחרון לזימון תור חדש.'}
        </p>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>
            ימי ושעות פעילות
            <HelpTip text="סמנו באילו ימים העסק פתוח, והגדירו שעת התחלה וסיום לכל יום. ימים סגורים יופיעו ביומן כלא זמינים לגרירה ולזימון." />
          </h3>
        </div>

        {!business.working_hours && (
          <p className={styles.notice}>
            עדיין לא הוגדרו שעות פעילות. מוצגת תבנית התחלתית (ראשון–חמישי
            09:00–18:00, שישי 09:00–13:00, שבת סגור). אפשר לשנות לפני השמירה.
          </p>
        )}

        <div className={styles.days}>
          <div className={styles.daysHead}>
            <span>יום</span>
            <span>פתוח</span>
            <span>משעה</span>
            <span>עד שעה</span>
          </div>
          {days.map((day) => (
            <div
              key={day.key}
              className={`${styles.dayRow} ${day.isOpen ? '' : styles.dayClosed}`}
            >
              <span className={styles.dayLabel}>{day.label}</span>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={day.isOpen}
                  onChange={(event) =>
                    updateDay(day.key, { isOpen: event.target.checked })
                  }
                />
                <span>{day.isOpen ? 'עובדים' : 'סגור'}</span>
              </label>
              <input
                type="time"
                className={styles.input}
                value={day.start}
                disabled={!day.isOpen}
                onChange={(event) =>
                  updateDay(day.key, { start: event.target.value })
                }
              />
              <input
                type="time"
                className={styles.input}
                value={day.end}
                disabled={!day.isOpen}
                onChange={(event) =>
                  updateDay(day.key, { end: event.target.value })
                }
              />
            </div>
          ))}
        </div>

        <div className={styles.copyRow}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={copyHoursToOpenDays}
          >
            העתק שעות לכל הימים הפתוחים
          </button>
          <HelpTip text="מעתיק את שעות הפתיחה והסגירה מהיום הפתוח הראשון לכל שאר הימים שמסומנים כפתוחים. ימים סגורים לא משתנים." />
        </div>
      </section>

      {message && (
        <p className={styles[message.type]} role="status">
          {message.text}
        </p>
      )}

      <button
        type="button"
        className={styles.saveBtn}
        onClick={() => void handleSave()}
        disabled={isSaving}
      >
        {isSaving ? 'שומר...' : 'שמור שעות פעילות'}
      </button>

      <p className={styles.todayHint}>היום: {formatHebrewDate(toDateKey(new Date()))}</p>
    </div>
  );
}
