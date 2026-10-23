import IconButton, {
  TrashIcon,
} from '../../../shared/components/IconButton';
import { CopyIcon } from '../../../shared/components/icons';
import HelpTip from '../../../shared/components/HelpTip';
import { DateField } from '../../../shared/components/DateField';
import { HourMinuteField } from '../../../shared/components/HourMinuteField';
import type {
  SpecialDayDraft,
  WorkingDayDraft,
} from '../../appointments/workingHours';
import {
  createBlankSpecialDay,
  suggestNextShift,
} from '../../appointments/workingHours';
import { addDaysToDateKey, toDateKey } from '../../appointments/time';
import styles from './SpecialDaysEditor.module.css';

interface SpecialDaysEditorProps {
  weeklyDays: WorkingDayDraft[];
  days: SpecialDayDraft[];
  hiddenPastCount?: number;
  onChange: (days: SpecialDayDraft[]) => void;
}

function formatHebrewDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function inclusiveDayCount(start: string, end: string) {
  if (!start || !end || end < start) return 0;
  let count = 1;
  let current = start;
  while (current < end && count < 400) {
    current = addDaysToDateKey(current, 1);
    count += 1;
  }
  return current === end ? count : 0;
}

function sameShifts(
  left: Array<{ start: string; end: string }>,
  right: Array<{ start: string; end: string }>,
) {
  return (
    left.length === right.length &&
    left.every(
      (shift, index) =>
        shift.start.slice(0, 5) === right[index].start.slice(0, 5) &&
        shift.end.slice(0, 5) === right[index].end.slice(0, 5),
    )
  );
}

function nextRangeAfter(day: SpecialDayDraft): { date: string; endDate: string } {
  const start = day.date || toDateKey(new Date());
  const end = day.endDate && day.endDate >= start ? day.endDate : start;
  const span = Math.max(inclusiveDayCount(start, end) - 1, 0);
  const date = addDaysToDateKey(end, 1);
  return { date, endDate: addDaysToDateKey(date, span) };
}

const SHIFT_PRESETS: Array<{
  label: string;
  isClosed: boolean;
  shifts: Array<{ start: string; end: string }>;
}> = [
  { label: 'סגור', isClosed: true, shifts: [] },
  {
    label: 'חצי יום',
    isClosed: false,
    shifts: [{ start: '09:00', end: '13:00' }],
  },
  {
    label: 'בוקר וערב',
    isClosed: false,
    shifts: [
      { start: '09:00', end: '13:00' },
      { start: '16:00', end: '20:00' },
    ],
  },
];

export default function SpecialDaysEditor({
  weeklyDays,
  days,
  hiddenPastCount = 0,
  onChange,
}: SpecialDaysEditorProps) {
  const updateDay = (id: string, patch: Partial<SpecialDayDraft>) => {
    onChange(
      days.map((day) => (day.id === id ? { ...day, ...patch } : day)),
    );
  };

  const updateShift = (
    id: string,
    index: number,
    patch: { start?: string; end?: string },
  ) => {
    onChange(
      days.map((day) => {
        if (day.id !== id) return day;
        return {
          ...day,
          shifts: day.shifts.map((shift, shiftIndex) =>
            shiftIndex === index ? { ...shift, ...patch } : shift,
          ),
        };
      }),
    );
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h4>
          ימים מיוחדים
          <HelpTip text="כל כרטיס דורס את השבוע הרגיל מהתאריך הראשון עד התאריך האחרון, כולל שניהם. ליום בודד בוחרים את אותו תאריך בשני השדות. סגור אומר שאין זימון בכל הטווח. ימים שכבר עברו לא מוצגים כאן, והם נשארים ביומן." />
        </h4>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => onChange([...days, createBlankSpecialDay(weeklyDays)])}
        >
          הוסף טווח
        </button>
      </div>

      {hiddenPastCount > 0 ? (
        <p className={styles.keptNote}>
          ימים שכבר עברו לא מוצגים כאן. הם נשארים שמורים ביומן.
        </p>
      ) : null}

      {days.length === 0 ? (
        <p className={styles.empty}>
          {hiddenPastCount > 0
            ? 'אין ימים מיוחדים קרובים. אפשר להוסיף טווח חדש.'
            : 'עדיין אין ימים מיוחדים. הוסיפו תאריך או טווח כדי לסגור אותם או להגדיר שעות חריגות.'}
        </p>
      ) : (
        <div className={styles.list}>
          {days.map((day) => {
            const endDate = day.endDate || day.date;
            const dayCount = inclusiveDayCount(day.date, endDate);
            const isRange = Boolean(day.date && endDate && endDate !== day.date);

            return (
            <article key={day.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.datePair}>
                  <div className={styles.dateField}>
                    <span>מתאריך</span>
                    <DateField
                      aria-label="מתאריך"
                      value={day.date}
                      onChange={(date) =>
                        updateDay(day.id, {
                          date,
                          endDate:
                            endDate && date && endDate < date ? date : endDate,
                        })
                      }
                    />
                  </div>
                  <div className={styles.dateField}>
                    <span>עד תאריך</span>
                    <DateField
                      aria-label="עד תאריך"
                      min={day.date || undefined}
                      value={endDate}
                      onChange={(nextEnd) =>
                        updateDay(day.id, {
                          endDate: nextEnd,
                          date:
                            day.date && nextEnd && nextEnd < day.date
                              ? nextEnd
                              : day.date,
                        })
                      }
                    />
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.addShift}
                    onClick={() =>
                      onChange([
                        ...days,
                        {
                          ...day,
                          ...nextRangeAfter(day),
                          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                          shifts: day.shifts.map((shift) => ({ ...shift })),
                        },
                      ])
                    }
                  >
                    <CopyIcon />
                    {isRange ? 'שכפל את הטווח' : 'שכפל ליום הבא'}
                  </button>
                  <IconButton
                    label="מחק יום מיוחד"
                    variant="danger"
                    onClick={() =>
                      onChange(days.filter((candidate) => candidate.id !== day.id))
                    }
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              </div>

              {day.date ? (
                <p className={styles.dateHint}>
                  {isRange
                    ? `${formatHebrewDate(day.date)} עד ${formatHebrewDate(endDate)} · ${dayCount} ימים`
                    : formatHebrewDate(day.date)}
                </p>
              ) : null}

              <div className={styles.presets}>
                {SHIFT_PRESETS.map((preset) => {
                  const active = preset.isClosed
                    ? day.is_closed
                    : !day.is_closed && sameShifts(day.shifts, preset.shifts);
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      aria-pressed={active}
                      className={active ? `${styles.preset} ${styles.presetActive}` : styles.preset}
                      onClick={() =>
                        updateDay(day.id, {
                          is_closed: preset.isClosed,
                          shifts: preset.shifts.map((shift) => ({ ...shift })),
                        })
                      }
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {day.is_closed ? (
                <p className={styles.closedNote}>
                  {isRange
                    ? 'הימים בטווח הזה סגורים. לא ניתן לקבוע בהם תור.'
                    : 'היום הזה סגור. לא ניתן לקבוע בו תור.'}
                </p>
              ) : (
                <div className={styles.shifts}>
                  {day.shifts.map((shift, index) => (
                    <div key={`${day.id}-${index}`} className={styles.shiftRow}>
                      <HourMinuteField
                        aria-label={`תחילת משמרת ${index + 1}`}
                        value={shift.start}
                        onChange={(start) => updateShift(day.id, index, { start })}
                      />
                      <span className={styles.shiftSep}>עד</span>
                      <HourMinuteField
                        aria-label={`סיום משמרת ${index + 1}`}
                        value={shift.end}
                        onChange={(end) => updateShift(day.id, index, { end })}
                      />
                      {day.shifts.length > 1 ? (
                        <IconButton
                          label="מחק משמרת"
                          variant="danger"
                          onClick={() =>
                            updateDay(day.id, {
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
                  <button
                    type="button"
                    className={styles.addShift}
                    onClick={() =>
                      updateDay(day.id, {
                        shifts: [
                          ...day.shifts,
                          suggestNextShift(day.shifts),
                        ],
                      })
                    }
                  >
                    הוסף משמרת
                  </button>
                </div>
              )}

              <label className={styles.note}>
                <span>הערה (אופציונלי)</span>
                <input
                  className={styles.noteInput}
                  maxLength={80}
                  value={day.note ?? ''}
                  placeholder="למשל ערב חג או יום גיבוש"
                  onChange={(event) =>
                    updateDay(day.id, { note: event.target.value })
                  }
                />
              </label>
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
