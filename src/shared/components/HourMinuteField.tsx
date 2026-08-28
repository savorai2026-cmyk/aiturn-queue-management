import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClockIcon } from './icons';
import styles from './HourMinuteField.module.css';
import {
  formatTimeParts,
  minuteOptions,
  parseTimeParts,
} from './timeInput';

interface HourMinuteFieldProps {
  id?: string;
  value: string;
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  stepMinutes?: number;
  'aria-label'?: string;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const VIEW_MARGIN = 8;
const MENU_MAX_HEIGHT = 240;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function placeMenu(trigger: HTMLElement, menu: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const width = Math.max(rect.width + 18, 72);
  menu.style.width = `${width}px`;
  menu.style.left = `${rect.left}px`;

  const spaceBelow = window.innerHeight - rect.bottom - VIEW_MARGIN;
  const spaceAbove = rect.top - VIEW_MARGIN;
  const maxHeight = Math.min(MENU_MAX_HEIGHT, Math.max(spaceBelow, spaceAbove, 120));
  menu.style.maxHeight = `${maxHeight}px`;

  const menuHeight = Math.min(menu.scrollHeight, maxHeight);
  let top = rect.bottom + 4;
  if (menuHeight > spaceBelow && spaceAbove > spaceBelow) {
    top = rect.top - 4 - menuHeight;
  }
  menu.style.top = `${Math.max(VIEW_MARGIN, top)}px`;
}

function TimePartPicker({
  id,
  value,
  options,
  disabled,
  label,
  open,
  onOpen,
  onClose,
  onChange,
}: {
  id?: string;
  value: number | '';
  options: number[];
  disabled: boolean;
  label: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (value: number) => void;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const display = value === '' ? '--' : pad(value);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!open || !trigger || !menu) return;

    const update = () => placeMenu(trigger, menu);
    update();
    selectedRef.current?.scrollIntoView({ block: 'nearest' });

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, options]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <div className={styles.unit}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => {
          if (open) {
            onClose();
          } else {
            onOpen();
          }
        }}
      >
        <span className={styles.chevron} aria-hidden="true" />
        <span className={styles.value}>{display}</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            className={styles.menu}
            role="listbox"
            aria-label={label}
          >
            {options.map((option) => {
              const isSelected = option === value;
              return (
                <button
                  key={option}
                  ref={isSelected ? selectedRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
                  onClick={() => {
                    onChange(option);
                    onClose();
                  }}
                >
                  {pad(option)}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function HourMinuteField({
  id,
  value,
  onChange,
  required = false,
  disabled = false,
  readOnly = false,
  stepMinutes = 5,
  'aria-label': ariaLabel,
}: HourMinuteFieldProps) {
  const parsed = parseTimeParts(value);
  const hours = parsed?.hours ?? 0;
  const minutes = parsed?.minutes ?? 0;
  const isEmpty = parsed == null;
  const isLocked = disabled || readOnly || !onChange;
  const minuteValues = minuteOptions(stepMinutes, parsed?.minutes);
  const [openPart, setOpenPart] = useState<'hours' | 'minutes' | null>(null);

  const emit = (nextHours: number, nextMinutes: number) => {
    onChange?.(formatTimeParts(nextHours, nextMinutes));
  };

  return (
    <div
      className={`${styles.field} ${isLocked ? styles.locked : ''}`}
      dir="ltr"
      role="group"
      aria-label={ariaLabel}
      aria-disabled={isLocked}
      aria-required={required || undefined}
    >
      <span className={styles.icon}>
        <ClockIcon />
      </span>
      <TimePartPicker
        id={id}
        value={isEmpty ? '' : hours}
        options={HOURS}
        disabled={isLocked}
        label={ariaLabel ? `${ariaLabel} — שעה` : 'שעה'}
        open={openPart === 'hours'}
        onOpen={() => setOpenPart('hours')}
        onClose={() => setOpenPart(null)}
        onChange={(nextHours) => emit(nextHours, isEmpty ? 0 : minutes)}
      />
      <span className={styles.separator} aria-hidden="true">
        :
      </span>
      <TimePartPicker
        value={isEmpty ? '' : minutes}
        options={minuteValues}
        disabled={isLocked}
        label={ariaLabel ? `${ariaLabel} — דקות` : 'דקות'}
        open={openPart === 'minutes'}
        onOpen={() => setOpenPart('minutes')}
        onClose={() => setOpenPart(null)}
        onChange={(nextMinutes) => emit(isEmpty ? 0 : hours, nextMinutes)}
      />
    </div>
  );
}
