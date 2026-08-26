import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { DisplayField } from './types';
import styles from './FieldChooser.module.css';

interface FieldChooserProps {
  fields: DisplayField[];
  visibleKeys: string[];
  onToggle: (key: string) => void;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}

function menuPosition(anchor: HTMLElement, menu: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const padding = 12;
  const width = menu.offsetWidth || 250;
  const height = menu.offsetHeight || 200;
  let left = rect.right - width;

  if (left < padding) {
    left = rect.left;
  }

  if (left + width > window.innerWidth - padding) {
    left = window.innerWidth - width - padding;
  }

  left = Math.max(padding, left);

  let top = rect.bottom + 8;
  if (top + height > window.innerHeight - padding) {
    top = Math.max(padding, rect.top - height - 8);
  }

  return { top, left };
}

export default function FieldChooser({
  fields,
  visibleKeys,
  onToggle,
  onClose,
  anchorRef,
}: FieldChooserProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const place = () => {
      const anchor = anchorRef.current;
      const menu = menuRef.current;
      if (!anchor || !menu) return;
      setCoords(menuPosition(anchor, menu));
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div
        ref={menuRef}
        className={styles.menu}
        style={
          coords
            ? { top: coords.top, left: coords.left }
            : { visibility: 'hidden' }
        }
        role="menu"
        aria-label="בחירת שדות לתצוגה"
      >
        <div className={styles.title}>בחר שדות להצגה</div>
        {fields.map((field) => (
          <label key={field.key} className={styles.label}>
            <input
              type="checkbox"
              checked={visibleKeys.includes(field.key)}
              onChange={() => onToggle(field.key)}
            />
            {field.label}
          </label>
        ))}
      </div>
    </>,
    document.body,
  );
}
