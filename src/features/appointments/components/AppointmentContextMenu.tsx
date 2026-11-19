import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import styles from './AppointmentContextMenu.module.css';

export interface AppointmentMenuAction {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
}

export default function AppointmentContextMenu({
  x,
  y,
  actions,
  onClose,
}: {
  x: number;
  y: number;
  actions: AppointmentMenuAction[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState(() => ({
    left: Math.max(8, Math.min(x, window.innerWidth - 188)),
    top: Math.max(8, Math.min(y, window.innerHeight - 248)),
  }));

  useLayoutEffect(() => {
    const node = menuRef.current;
    if (!node) return;
    setPoint({
      left: Math.max(8, Math.min(x, window.innerWidth - node.offsetWidth - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - node.offsetHeight - 8)),
    });
  }, [actions.length, x, y]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-appointment-menu]')) {
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('scroll', onClose, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      data-appointment-menu
      className={styles.menu}
      style={{ left: point.left, top: point.top }}
      role="menu"
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          role="menuitem"
          className={styles.item}
          disabled={action.disabled}
          onClick={() => {
            action.onSelect();
            onClose();
          }}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
}
