import { useEffect } from 'react';
import type { DetailRow } from './types';
import modal from '../components/modalShell.module.css';
import styles from './RecordDetailsModal.module.css';

interface RecordDetailsModalProps {
  title: string;
  rows: DetailRow[];
  onClose: () => void;
}

export default function RecordDetailsModal({
  title,
  rows,
  onClose,
}: RecordDetailsModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={`${modal.overlay} ${styles.overlay}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={`${modal.content} ${styles.content}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-details-title"
      >
        <h2 id="record-details-title" className={styles.title}>
          {title}
        </h2>
        <div className={`${modal.scroll} ${styles.list}`}>
          {rows.map((row) => (
            <div key={row.key} className={styles.row}>
              <span className={styles.label}>{row.label}</span>
              <span className={styles.value} dir={row.dir}>
                {row.value || '—'}
              </span>
            </div>
          ))}
        </div>
        <button type="button" className={styles.close} onClick={onClose}>
          סגור
        </button>
      </section>
    </div>
  );
}
