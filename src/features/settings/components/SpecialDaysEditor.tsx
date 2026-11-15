import { useLayoutEffect, useRef } from 'react';
import IconButton, {
  TrashIcon,
} from '../../../shared/components/IconButton';
import { CopyIcon } from '../../../shared/components/icons';
import HelpTip from '../../../shared/components/HelpTip';
import { DateField } from '../../../shared/components/DateField';
import { HourMinuteField } from '../../../shared/components/HourMinuteField';
import type {
  SpecialDayDraft,
  TentativeRange,
  WorkingDayDraft,
} from '../../appointments/workingHours';
import {
  createBlankSpecialDay,
  moveTentativeWithShift,
  rangeInsideShift,
  rangeMatchesShift,
  suggestNextShift,
  suggestTentativeRange,
  tentativeInsideShifts,
  toggleShiftTentative,
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

const TENTATIVE_HELP =
  'הסימון חל רק על פרק השעות הזה, לא על שאר היום. אם מספיק מתעניינים לא קיבלו את המועד וויתרו על תור בכלל, הסגירה של הפרק הזה מתבטלת והמערכת חוזרת אליהם.';

function applySpecialDayPatch(
  day: SpecialDayDraft,
  patch: Partial<SpecialDayDraft>,
): SpecialDayDraft {
  const next = { ...day, ...patch };
  if (patch.tentative !== undefined) {
    return next;
  }
  if (patch.is_closed && next.is_closed) {
    return { ...next, tentative: day.tentative ?? [] };
  }
  if (patch.shifts || patch.is_closed) {
    return {
      ...next,
      tentative: next.is_closed
        ? (day.tentative ?? [])
        : tentativeInsideShifts(day.tentative ?? [], next.shifts),
    };
  }
  return { ...next, tentative: day.tentative ?? [] };
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

function ShiftPresetToggle({
  day,
  onSelect,
}: {
  day: SpecialDayDraft;
  onSelect: (preset: (typeof SHIFT_PRESETS)[number]) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const glideRef = useRef<HTMLSpanElement>(null);
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = SHIFT_PRESETS.findIndex((preset) =>
    preset.isClosed
      ? day.is_closed
      : !day.is_closed && sameShifts(day.shifts, preset.shifts),
  );

  useLayoutEffect(() => {
    const track = trackRef.current;
    const glide = glideRef.current;
    if (!track || !glide) return;

    const place = () => {
      const button =
        activeIndex >= 0 ? buttonsRef.current[activeIndex] : null;
      if (!button) {
        glide.style.opacity = '0';
        glide.classList.remove(styles.presetGlideReady);
        return;
      }
      const hostStyle = window.getComputedStyle(track);
      const borderLeft = Number.parseFloat(hostStyle.borderLeftWidth) || 0;
      const borderTop = Number.parseFloat(hostStyle.borderTopWidth) || 0;
      const hostBox = track.getBoundingClientRect();
      const box = button.getBoundingClientRect();
      const canSlide =
        glide.classList.contains(styles.presetGlideReady) &&
        glide.style.opacity !== '0';
      if (!canSlide) glide.classList.remove(styles.presetGlideReady);
      glide.style.width = `${box.width}px`;
      glide.style.height = `${box.height}px`;
      glide.style.transform = `translate(${box.left - hostBox.left - borderLeft}px, ${box.top - hostBox.top - borderTop}px)`;
      glide.style.opacity = '1';
      if (!canSlide) {
        window.requestAnimationFrame(() => {
          if (glide.isConnected) glide.classList.add(styles.presetGlideReady);
        });
      }
    };

    place();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => place());
    observer.observe(track);
    return () => observer.disconnect();
  }, [activeIndex]);

  return (
    <div
      ref={trackRef}
      className={styles.presetTrack}
      role="group"
      aria-label="שעות היום המיוחד"
    >
      <span ref={glideRef} className={styles.presetGlide} aria-hidden="true" />
      {SHIFT_PRESETS.map((preset, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={preset.label}
            ref={(node) => {
              buttonsRef.current[index] = node;
            }}
            type="button"
            aria-pressed={active}
            className={active ? `${styles.preset} ${styles.presetActive}` : styles.preset}
            onClick={() => onSelect(preset)}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}

export default function SpecialDaysEditor({
  weeklyDays,
  days,
  hiddenPastCount = 0,
  onChange,
}: SpecialDaysEditorProps) {
  const updateDay = (id: string, patch: Partial<SpecialDayDraft>) => {
    onChange(
      days.map((day) => (day.id === id ? applySpecialDayPatch(day, patch) : day)),
    );
  };

  const updateShift = (
    id: string,
    index: number,
    patch: { start?: string; end?: string },
  ) => {
    const day = days.find((item) => item.id === id);
    if (!day) return;
    const previous = day.shifts[index];
    if (!previous) return;
    const nextShift = { ...previous, ...patch };
    updateDay(id, {
      shifts: day.shifts.map((shift, shiftIndex) =>
        shiftIndex === index ? nextShift : shift,
      ),
      tentative: moveTentativeWithShift(day.tentative ?? [], previous, nextShift),
    });
  };

  const setMinInsists = (
    day: SpecialDayDraft,
    matches: (range: TentativeRange, index: number) => boolean,
    minInsists: number,
  ) => {
    const insists = Number.isInteger(minInsists) && minInsists >= 1 ? minInsists : 1;
    updateDay(day.id, {
      tentative: (day.tentative ?? []).map((range, index) =>
        matches(range, index) ? { ...range, min_insists: insists } : range,
      ),
    });
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
                          tentative: day.tentative?.map((range) => ({ ...range })),
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
                <ShiftPresetToggle
                  day={day}
                  onSelect={(preset) =>
                    updateDay(day.id, {
                      is_closed: preset.isClosed,
                      shifts: preset.shifts.map((shift) => ({ ...shift })),
                    })
                  }
                />
                {day.is_closed ? (
                  <label className={styles.tentativeMark}>
                    <input
                      type="checkbox"
                      checked={(day.tentative?.length ?? 0) > 0}
                      onChange={(event) => {
                        updateDay(day.id, {
                          tentative: event.target.checked
                            ? day.tentative && day.tentative.length > 0
                              ? day.tentative.map((range) => ({ ...range }))
                              : [suggestTentativeRange([])]
                            : [],
                        });
                      }}
                    />
                    <span>שוקל סגירה</span>
                    <HelpTip text={TENTATIVE_HELP} />
                  </label>
                ) : (
                  <HelpTip text={TENTATIVE_HELP} />
                )}
              </div>

              {day.is_closed ? (
                <>
                  <p className={styles.closedNote}>
                    {isRange
                      ? 'הימים בטווח הזה סגורים. לא ניתן לקבוע בהם תור.'
                      : 'היום הזה סגור. לא ניתן לקבוע בו תור.'}
                  </p>
                  {(day.tentative ?? []).map((range, index) => (
                    <div key={`${day.id}-tentative-${index}`} className={styles.shiftRow}>
                      <HourMinuteField
                        aria-label={`תחילת סגירה טנטטיבית ${index + 1}`}
                        value={range.start}
                        onChange={(start) =>
                          updateDay(day.id, {
                            tentative: (day.tentative ?? []).map((item, itemIndex) =>
                              itemIndex === index ? { ...item, start } : item,
                            ),
                          })
                        }
                      />
                      <span className={styles.shiftSep}>עד</span>
                      <HourMinuteField
                        aria-label={`סיום סגירה טנטטיבית ${index + 1}`}
                        value={range.end}
                        onChange={(end) =>
                          updateDay(day.id, {
                            tentative: (day.tentative ?? []).map((item, itemIndex) =>
                              itemIndex === index ? { ...item, end } : item,
                            ),
                          })
                        }
                      />
                      <label className={styles.insist}>
                        <span>מתעניינים</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          dir="ltr"
                          aria-label={`מתעניינים שמבטלים את הסגירה ${index + 1}`}
                          value={range.min_insists}
                          onChange={(event) =>
                            setMinInsists(
                              day,
                              (_, itemIndex) => itemIndex === index,
                              Number(event.target.value),
                            )
                          }
                        />
                      </label>
                    </div>
                  ))}
                </>
              ) : (
                <div className={styles.shifts}>
                  {day.shifts.map((shift, index) => {
                    const markedRange = (day.tentative ?? []).find((range) =>
                      rangeMatchesShift(range, shift),
                    );
                    const marked = Boolean(markedRange);
                    return (
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
                              tentative: (day.tentative ?? []).filter(
                                (range) => !rangeInsideShift(range, shift),
                              ),
                            })
                          }
                        >
                          <TrashIcon />
                        </IconButton>
                      ) : null}
                      <label className={styles.tentativeMark}>
                        <input
                          type="checkbox"
                          checked={marked}
                          onChange={(event) => {
                            const withoutThisShift = (day.tentative ?? []).filter(
                              (range) => !rangeInsideShift(range, shift),
                            );
                            updateDay(day.id, {
                              tentative: toggleShiftTentative(
                                event.target.checked ? withoutThisShift : (day.tentative ?? []),
                                shift,
                                event.target.checked,
                                markedRange?.min_insists ?? 1,
                              ),
                            });
                          }}
                        />
                        <span>שוקל סגירה</span>
                      </label>
                      {markedRange ? (
                        <label className={styles.insist}>
                          <span>מתעניינים</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            dir="ltr"
                            aria-label={`מתעניינים שמבטלים את הסגירה של משמרת ${index + 1}`}
                            value={markedRange.min_insists}
                            onChange={(event) =>
                              setMinInsists(
                                day,
                                (range) => rangeMatchesShift(range, shift),
                                Number(event.target.value),
                              )
                            }
                          />
                        </label>
                      ) : null}
                    </div>
                    );
                  })}
                  {(day.tentative ?? []).map((range, index) =>
                    day.shifts.some((shift) => rangeMatchesShift(range, shift)) ? null : (
                      <div key={`${day.id}-partial-${index}`} className={styles.shiftRow}>
                        <HourMinuteField
                          aria-label={`תחילת סגירה טנטטיבית ${index + 1}`}
                          value={range.start}
                          onChange={(start) =>
                            updateDay(day.id, {
                              tentative: (day.tentative ?? []).map((item, itemIndex) =>
                                itemIndex === index ? { ...item, start } : item,
                              ),
                            })
                          }
                        />
                        <span className={styles.shiftSep}>עד</span>
                        <HourMinuteField
                          aria-label={`סיום סגירה טנטטיבית ${index + 1}`}
                          value={range.end}
                          onChange={(end) =>
                            updateDay(day.id, {
                              tentative: (day.tentative ?? []).map((item, itemIndex) =>
                                itemIndex === index ? { ...item, end } : item,
                              ),
                            })
                          }
                        />
                        <label className={styles.insist}>
                          <span>מתעניינים</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            dir="ltr"
                            aria-label={`מתעניינים שמבטלים את הסגירה ${index + 1}`}
                            value={range.min_insists}
                            onChange={(event) =>
                              setMinInsists(
                                day,
                                (_range, itemIndex) => itemIndex === index,
                                Number(event.target.value),
                              )
                            }
                          />
                        </label>
                        <IconButton
                          label={`מחק סגירה טנטטיבית ${index + 1}`}
                          variant="danger"
                          onClick={() =>
                            updateDay(day.id, {
                              tentative: (day.tentative ?? []).filter(
                                (_item, itemIndex) => itemIndex !== index,
                              ),
                            })
                          }
                        >
                          <TrashIcon />
                        </IconButton>
                      </div>
                    ),
                  )}
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
