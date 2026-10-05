import { useRef, useState } from 'react';
import FieldChooser from './FieldChooser';
import HelpTip from '../components/HelpTip';
import { GearIcon, FunnelIcon, GlassesIcon } from '../components/icons';
import type { DisplayField } from './types';
import styles from './DisplayToolbar.module.css';

interface DisplayToolbarProps {
  fields: DisplayField[];
  visibleKeys: string[];
  onToggle: (key: string) => void;
  onViewDetails?: () => void;
  canViewDetails?: boolean;
  variant?: 'default' | 'onDark';
  helpPosition?: 'start' | 'end';
  filtersVisible?: boolean;
  filtersActive?: boolean;
  onToggleFilters?: () => void;
}

export default function DisplayToolbar({
  fields,
  visibleKeys,
  onToggle,
  onViewDetails,
  canViewDetails,
  variant = 'default',
  helpPosition = 'end',
  filtersVisible = false,
  filtersActive = false,
  onToggleFilters,
}: DisplayToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const gearRef = useRef<HTMLButtonElement>(null);
  const buttonClass = `${styles.iconButton} ${variant === 'onDark' ? styles.onDark : ''}`;
  const help = (
    <HelpTip
      variant={variant}
      text={
        onToggleFilters
          ? onViewDetails
            ? 'גלגל השיניים בוחר אילו שדות יופיעו בטבלה. המשפך מציג או מסתיר את שורת הסינון. המשקפיים מציגים את כל פרטי הרשומה שנבחרה.'
            : 'גלגל השיניים בוחר אילו שדות יופיעו בטבלה. המשפך מציג או מסתיר את שורת הסינון.'
          : 'גלגל השיניים בוחר אילו שדות יופיעו בטבלה או בפרטי התור. המשקפיים מציגים את כל פרטי הרשומה שנבחרה.'
      }
    />
  );

  return (
    <div className={styles.group}>
      {helpPosition === 'start' && help}
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
      {onToggleFilters ? (
        <button
          type="button"
          className={`${buttonClass} ${filtersVisible || filtersActive ? styles.filterOn : ''}`}
          onClick={onToggleFilters}
          aria-label={filtersVisible ? 'הסתר סינון עמודות' : 'הצג סינון עמודות'}
          title={filtersVisible ? 'הסתר סינון' : 'הצג סינון'}
          aria-pressed={filtersVisible}
        >
          <FunnelIcon />
        </button>
      ) : null}
      {onViewDetails ? (
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
      ) : null}
      {helpPosition === 'end' && help}
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
