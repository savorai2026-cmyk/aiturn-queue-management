import { useRef, useState } from 'react';
import FieldChooser from './FieldChooser';
import type { DisplayField } from './types';
import styles from './DisplayToolbar.module.css';

interface DisplayToolbarProps {
  fields: DisplayField[];
  visibleKeys: string[];
  onToggle: (key: string) => void;
  onViewDetails: () => void;
  canViewDetails: boolean;
  variant?: 'default' | 'onDark';
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1.1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

function GlassesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="14" r="3.5" />
      <circle cx="17.5" cy="14" r="3.5" />
      <path d="M10 14h4" />
      <path d="M3 14H2" />
      <path d="M22 14h-1" />
      <path d="M6.5 10.5c2.2-2 8.8-2 11 0" />
    </svg>
  );
}

export default function DisplayToolbar({
  fields,
  visibleKeys,
  onToggle,
  onViewDetails,
  canViewDetails,
  variant = 'default',
}: DisplayToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const gearRef = useRef<HTMLButtonElement>(null);
  const buttonClass = `${styles.iconButton} ${variant === 'onDark' ? styles.onDark : ''}`;

  return (
    <div className={styles.group}>
      <button
        ref={gearRef}
        type="button"
        className={buttonClass}
        onClick={() => setIsOpen((open) => !open)}
        aria-label="הגדרות תצוגת שדות"
        title="הגדרות תצוגה"
        aria-expanded={isOpen}
      >
        <GearIcon />
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={onViewDetails}
        disabled={!canViewDetails}
        aria-label="הצגת כל פרטי הרשומה"
        title={canViewDetails ? 'כל הפרטים' : 'בחר רשומה כדי לראות את כל הפרטים'}
      >
        <GlassesIcon />
      </button>
      {isOpen && (
        <FieldChooser
          fields={fields}
          visibleKeys={visibleKeys}
          onToggle={onToggle}
          onClose={() => setIsOpen(false)}
          anchorRef={gearRef}
        />
      )}
    </div>
  );
}
