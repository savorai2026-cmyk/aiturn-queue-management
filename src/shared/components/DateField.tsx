import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getMonthGrid,
  isDateKeyInRange,
  parseDateKey,
  shiftMonth,
} from './calendarDate';
import { CalendarIcon } from './icons';
import styles from './DateField.module.css';

interface DateFieldProps {
  id?: string;
  value: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
  onChange: (value: string) => void;
}

const VIEW_MARGIN = 8;
const WEEKDAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const MONTH_TITLE = new Intl.DateTimeFormat('he-IL', {
  month: 'long',
  year: 'numeric',
});
const DATE_LABEL = new Intl.DateTimeFormat('he-IL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function toLocalDate(dateKey: string) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return null;
  return new Date(parsed.year, parsed.month - 1, parsed.day);
}

function formatDateLabel(dateKey: string) {
  const date = toLocalDate(dateKey);
  return date ? DATE_LABEL.format(date) : 'בחרו תאריך';
}

function placeMenu(trigger: HTMLElement, menu: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(300, window.innerWidth - VIEW_MARGIN * 2);
  menu.style.width = `${width}px`;

  let left = rect.left;
  left = Math.min(Math.max(left, VIEW_MARGIN), window.innerWidth - VIEW_MARGIN - width);
  menu.style.left = `${left}px`;

  const spaceBelow = window.innerHeight - rect.bottom - VIEW_MARGIN;
  const spaceAbove = rect.top - VIEW_MARGIN;
  const maxHeight = Math.min(360, Math.max(spaceBelow, spaceAbove, 180));
  menu.style.maxHeight = `${maxHeight}px`;

  const menuHeight = Math.min(menu.scrollHeight, maxHeight);
  let top = rect.bottom + 4;
  if (menuHeight > spaceBelow && spaceAbove > spaceBelow) {
    top = rect.top - 4 - menuHeight;
  }
  menu.style.top = `${Math.max(VIEW_MARGIN, top)}px`;
}

export function DateField({
  id,
  value,
  min,
  max,
  required = false,
  disabled = false,
  'aria-label': ariaLabel = 'תאריך',
  onChange,
}: DateFieldProps) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = parseDateKey(value);
  const todayKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState(() =>
    selected
      ? { year: selected.year, month: selected.month }
      : { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
  );

  const days = useMemo(
    () => getMonthGrid(view.year, view.month),
    [view.month, view.year],
  );
  const monthTitle = MONTH_TITLE.format(new Date(view.year, view.month - 1, 1));
  const previousMonth = shiftMonth(view.year, view.month, -1);
  const nextMonth = shiftMonth(view.year, view.month, 1);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!isOpen || !trigger || !menu) return;

    const update = () => placeMenu(trigger, menu);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen, view]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const choose = (dateKey: string) => {
    if (!isDateKeyInRange(dateKey, min, max)) return;
    onChange(dateKey);
    setIsOpen(false);
  };

  return (
    <div className={styles.root}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`${styles.field} ${isOpen ? styles.open : ''}`}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            return;
          }
          if (selected) {
            setView({ year: selected.year, month: selected.month });
          }
          setIsOpen(true);
        }}
      >
        <span className={styles.icon}>
          <CalendarIcon />
        </span>
        <span className={styles.chevron} aria-hidden="true" />
        <span className={styles.value}>{formatDateLabel(value)}</span>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            className={styles.menu}
            dir="rtl"
            role="dialog"
            aria-label={ariaLabel}
          >
            <div className={styles.monthNav}>
              <button
                type="button"
                className={styles.navButton}
                aria-label="חודש קודם"
                onClick={() => setView(previousMonth)}
              >
                ›
              </button>
              <span className={styles.monthTitle}>{monthTitle}</span>
              <button
                type="button"
                className={styles.navButton}
                aria-label="חודש הבא"
                onClick={() => setView(nextMonth)}
              >
                ‹
              </button>
            </div>
            <div className={styles.weekdays}>
              {WEEKDAY_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className={styles.grid}>
              {days.map((day) => {
                const enabled = isDateKeyInRange(day.dateKey, min, max);
                const isSelected = day.dateKey === value;
                const isToday = day.dateKey === todayKey;
                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    className={[
                      styles.day,
                      day.inMonth ? '' : styles.outside,
                      isSelected ? styles.daySelected : '',
                      isToday ? styles.today : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={!enabled}
                    aria-selected={isSelected}
                    onClick={() => choose(day.dateKey)}
                  >
                    {day.day}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
