import IconButton, {
  PlusIcon,
  TrashIcon,
} from '../../../shared/components/IconButton';
import { CopyIcon } from '../../../shared/components/icons';
import HelpTip from '../../../shared/components/HelpTip';
import { DateField } from '../../../shared/components/DateField';
import { HourMinuteField } from '../../../shared/components/HourMinuteField';
import type {
  SpecialDayDraft,
  WorkingDayDraft,
  WorkingHourException,
} from '../../appointments/workingHours';
import {
  createBlankSpecialDay,
  createSpecialDayFromWeekly,
  suggestNextShift,
} from '../../appointments/workingHours';
import { addDaysToDateKey, toDateKey } from '../../appointments/time';
import styles from './SpecialDaysEditor.module.css';

interface SpecialDaysEditorProps {
  weeklyDays: WorkingDayDraft[];
  days: SpecialDayDraft[];
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
  onChange,
}: SpecialDaysEditorProps) {
  const updateDay = (id: string, patch: Partial<WorkingHourException>) => {
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
          <HelpTip text="כל שורה דורסת את השבוע הרגיל רק בתאריך שנבחר. אפשר לסגור יום, לקצר אותו, או לפצל לבוקר וערב עם הפסקה בצהריים." />
        </h4>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => onChange([...days, createBlankSpecialDay(weeklyDays)])}
        >
          <PlusIcon />
          הוסף יום
        </button>
      </div>

      {days.length === 0 ? (
        <p className={styles.empty}>
          עדיין אין ימים מיוחדים. הוסיפו תאריך כדי לסגור אותו או להגדיר שעות
          חריגות.
        </p>
      ) : (
        <div className={styles.list}>
          {days.map((day) => (
            <article key={day.id} className={styles.card}>
              <div className={styles.cardTop}>
                <DateField
                  aria-label="תאריך מיוחד"
                  value={day.date}
                  onChange={(date) => updateDay(day.id, { date })}
                />
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={!day.is_closed}
                    onChange={(event) =>
                      updateDay(
                        day.id,
                        event.target.checked
                          ? createSpecialDayFromWeekly(weeklyDays, day.date)
                          : { is_closed: true, shifts: [] },
                      )
                    }
                  />
                  <span>{day.is_closed ? 'סגור' : 'שעות מיוחדות'}</span>
                </label>
                <button
                  type="button"
                  className={styles.addShift}
                  onClick={() =>
                    onChange([
                      ...days,
                      {
                        ...day,
                        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                        date: day.date
                          ? addDaysToDateKey(day.date, 1)
                          : toDateKey(new Date()),
                      },
                    ])
                  }
                >
                  <CopyIcon />
                  שכפל ליום הבא
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

              {day.date ? (
                <p className={styles.dateHint}>{formatHebrewDate(day.date)}</p>
              ) : null}

              <div className={styles.presets}>
                {SHIFT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={styles.preset}
                    onClick={() =>
                      updateDay(day.id, {
                        is_closed: preset.isClosed,
                        shifts: preset.shifts,
                      })
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {!day.is_closed && (
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
                    <PlusIcon />
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
          ))}
        </div>
      )}
    </div>
  );
}
