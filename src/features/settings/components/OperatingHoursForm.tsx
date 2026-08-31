import { useMemo, useState } from 'react';
import { updateOperatingHours } from '../settings.api';
import type { BusinessSettings } from '../settings.types';
import {
  createBlankSpecialDay,
  getBookingMaxDate,
  parseWorkingHourExceptions,
  suggestNextShift,
  toSpecialDayDrafts,
  toWorkingDayDrafts,
  toWorkingHoursPayload,
  validateWorkingDayDrafts,
  validateWorkingHourExceptions,
  type SpecialDayDraft,
  type WorkingDayDraft,
} from '../../appointments/workingHours';
import { toDateKey } from '../../appointments/time';
import IconButton, {
  PlusIcon,
  TrashIcon,
} from '../../../shared/components/IconButton';
import HelpTip from '../../../shared/components/HelpTip';
import { HourMinuteField } from '../../../shared/components/HourMinuteField';
import {
  CalendarIcon,
  CopyIcon,
  SaveIcon,
} from '../../../shared/components/icons';
import SpecialDaysEditor from './SpecialDaysEditor';
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
  const [specialDays, setSpecialDays] = useState<SpecialDayDraft[]>(() =>
    toSpecialDayDrafts(parseWorkingHourExceptions(business.working_hours)),
  );
  const [showSpecialDays, setShowSpecialDays] = useState(
    () => parseWorkingHourExceptions(business.working_hours).length > 0,
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
        day.isOpen
          ? {
              ...day,
              shifts: source.shifts.map((shift) => ({ ...shift })),
            }
          : day,
      ),
    );
  };

  const updateShift = (
    key: WorkingDayDraft['key'],
    index: number,
    patch: Partial<WorkingDayDraft['shifts'][number]>,
  ) => {
    setDays((current) =>
      current.map((day) =>
        day.key === key
          ? {
              ...day,
              shifts: day.shifts.map((shift, shiftIndex) =>
                shiftIndex === index ? { ...shift, ...patch } : shift,
              ),
            }
          : day,
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

    const specialError = validateWorkingHourExceptions(specialDays);
    if (specialError) {
      setMessage({ text: specialError, type: 'error' });
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
        working_hours: toWorkingHoursPayload(
          days,
          specialDays,
        ) as BusinessSettings['working_hours'],
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
            עד מתי אפשר לקבוע תור
            <HelpTip text="מגביל רק זימון של תור חדש. תורים שכבר קיימים ביומן נשארים גלויים גם מעבר לטווח הזה." />
          </h3>
        </div>

        <div className={styles.bookingRow}>
          <label className={styles.bookingSentence}>
            <span>אפשר לקבוע תור עד</span>
            <input
              type="number"
              min="1"
              max="365"
              className={styles.bookingInput}
              value={bookingDays}
              placeholder="—"
              dir="ltr"
              aria-label="מספר ימים מראש לזימון תור חדש"
              onChange={(event) => setBookingDays(event.target.value)}
            />
            <span>ימים מראש</span>
          </label>
          <button
            type="button"
            className={`${styles.unlimitedBtn} ${bookingDays === '' ? styles.unlimitedBtnActive : ''}`}
            aria-pressed={bookingDays === ''}
            onClick={() => setBookingDays('')}
          >
            ללא הגבלה
          </button>
        </div>

        <p className={styles.hint}>
          {bookingMaxDate
            ? `תור חדש אפשר לקבוע עד ${formatHebrewDate(bookingMaxDate)}.`
            : 'אין הגבלה על התאריך האחרון לזימון תור חדש.'}
        </p>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>
            ימי ושעות פעילות
            <HelpTip text="סמנו באילו ימים העסק פתוח. לכל יום אפשר להגדיר כמה מקטעי שעות, למשל בוקר וערב עם הפסקת צהריים קבועה. ימים סגורים יופיעו ביומן כלא זמינים לגרירה ולזימון." />
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
            <span>שעות</span>
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
                    updateDay(day.key, {
                      isOpen: event.target.checked,
                      shifts:
                        event.target.checked && day.shifts.length === 0
                          ? [
                              {
                                start: '09:00',
                                end: day.key === 'friday' ? '13:00' : '18:00',
                              },
                            ]
                          : day.shifts,
                    })
                  }
                />
                <span>{day.isOpen ? 'עובדים' : 'סגור'}</span>
              </label>
              {day.isOpen ? (
                <div className={styles.shifts}>
                  {day.shifts.map((shift, index) => (
                    <div key={`${day.key}-${index}`} className={styles.shiftRow}>
                      <HourMinuteField
                        aria-label={`תחילת מקטע ${index + 1} ביום ${day.label}`}
                        value={shift.start}
                        onChange={(start) => updateShift(day.key, index, { start })}
                      />
                      <span className={styles.shiftSep}>עד</span>
                      <HourMinuteField
                        aria-label={`סיום מקטע ${index + 1} ביום ${day.label}`}
                        value={shift.end}
                        onChange={(end) => updateShift(day.key, index, { end })}
                      />
                      {day.shifts.length > 1 ? (
                        <IconButton
                          label={`מחק מקטע ${index + 1} ביום ${day.label}`}
                          variant="danger"
                          onClick={() =>
                            updateDay(day.key, {
                              shifts: day.shifts.filter(
                                (_, shiftIndex) => shiftIndex !== index,
                              ),
                            })
                          }
                        >
                          <TrashIcon />
                        </IconButton>
                      ) : null}
                    </div>
                  ))}
                  <div className={styles.shiftActions}>
                    <button
                      type="button"
                      className={styles.addShift}
                      onClick={() =>
                        updateDay(day.key, {
                          shifts: [...day.shifts, suggestNextShift(day.shifts)],
                        })
                      }
                    >
                      <PlusIcon />
                      הוסף מקטע
                    </button>
                    <button
                      type="button"
                      className={styles.addShift}
                      onClick={() =>
                        updateDay(day.key, {
                          shifts: [
                            { start: '09:00', end: '13:00' },
                            { start: '16:00', end: '20:00' },
                          ],
                        })
                      }
                    >
                      בוקר וערב
                    </button>
                  </div>
                </div>
              ) : (
                <span className={styles.closedHint}>סגור ביום זה</span>
              )}
            </div>
          ))}
        </div>

        <div className={styles.copyRow}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={copyHoursToOpenDays}
          >
            <CopyIcon />
            העתק שעות לכל הימים הפתוחים
          </button>
          <HelpTip text="מעתיק את כל מקטעי השעות מהיום הפתוח הראשון לכל שאר הימים שמסומנים כפתוחים, כולל הפסקת צהריים אם הוגדרה. ימים סגורים לא משתנים." />
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => {
              setShowSpecialDays(true);
              setSpecialDays((current) =>
                current.length > 0 ? current : [createBlankSpecialDay(days)],
              );
            }}
          >
            <CalendarIcon />
            ימים מיוחדים
          </button>
          <HelpTip text="מגדיר סגירה או שעות חריגות לתאריך ספציפי, בלי לשנות את השבוע הרגיל. מתאים לחצי יום, ערב חג, או בוקר וערב עם הפסקה בצהריים." />
        </div>

        {showSpecialDays ? (
          <SpecialDaysEditor
            weeklyDays={days}
            days={specialDays}
            onChange={setSpecialDays}
          />
        ) : null}
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
        {isSaving ? 'שומר...' : (
          <>
            <SaveIcon />
            שמור שעות פעילות
          </>
        )}
      </button>

      <p className={styles.todayHint}>היום: {formatHebrewDate(toDateKey(new Date()))}</p>
    </div>
  );
}
