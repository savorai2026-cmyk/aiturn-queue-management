import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  filterTimezoneGroups,
  findTimezoneLabel,
  type TimezoneGroup,
} from '../timezones';
import styles from './TimezoneSelect.module.css';

interface TimezoneSelectProps {
  id: string;
  value: string;
  groups: TimezoneGroup[];
  onChange: (value: string) => void;
}

const VIEW_MARGIN = 8;
const GAP = 4;
const MENU_MAX_HEIGHT = 280;

function placeMenu(trigger: HTMLElement, menu: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const width = Math.max(rect.width, 0);
  menu.style.width = `${width}px`;
  menu.style.maxWidth = `${width}px`;
  menu.style.left = `${rect.left}px`;

  const spaceBelow = window.innerHeight - rect.bottom - VIEW_MARGIN;
  const spaceAbove = rect.top - VIEW_MARGIN;
  const maxHeight = Math.min(
    MENU_MAX_HEIGHT,
    Math.max(spaceBelow, spaceAbove, 120),
  );
  menu.style.maxHeight = `${maxHeight}px`;

  const menuHeight = Math.min(menu.scrollHeight, maxHeight);
  let top = rect.bottom + GAP;
  if (menuHeight > spaceBelow && spaceAbove > spaceBelow) {
    top = rect.top - GAP - menuHeight;
  }
  top = Math.min(
    Math.max(top, VIEW_MARGIN),
    window.innerHeight - VIEW_MARGIN - menuHeight,
  );
  menu.style.top = `${top}px`;
}

export default function TimezoneSelect({
  id,
  value,
  groups,
  onChange,
}: TimezoneSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedLabel = findTimezoneLabel(groups, value) ?? (value || 'בחרו אזור זמן');
  const visibleGroups = useMemo(
    () => filterTimezoneGroups(groups, query),
    [groups, query],
  );

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
  }, [isOpen, visibleGroups]);

  useEffect(() => {
    if (isOpen) {
      searchRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
        setQuery('');
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
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

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() =>
          setIsOpen((open) => {
            if (open) setQuery('');
            return !open;
          })
        }
      >
        <span className={styles.value}>{selectedLabel}</span>
        <svg
          className={styles.chevron}
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen &&
        createPortal(
          <div ref={menuRef} className={styles.menu}>
            <div className={styles.searchRow}>
              <input
                ref={searchRef}
                className={styles.search}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="חיפוש אזור זמן"
                aria-label="חיפוש אזור זמן"
              />
            </div>
            <div id={listId} role="listbox" aria-labelledby={id} className={styles.list}>
              <button
                type="button"
                role="option"
                aria-selected={!value}
                className={`${styles.option} ${!value ? styles.selected : ''}`}
                onClick={() => choose('')}
              >
                בחרו אזור זמן
              </button>
              {visibleGroups.map((group) => (
                <div key={group.id} className={styles.group}>
                  <div className={styles.groupLabel}>{group.label}</div>
                  {group.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={option.value === value}
                      className={`${styles.option} ${
                        option.value === value ? styles.selected : ''
                      }`}
                      onClick={() => choose(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ))}
              {visibleGroups.length === 0 && (
                <p className={styles.empty}>לא נמצאו אזורי זמן תואמים</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
