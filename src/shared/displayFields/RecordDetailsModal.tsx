import { useEffect } from 'react';
import RecordingPlayer from '../../features/conversations/components/RecordingPlayer';
import type { DetailRow, DetailSection } from './types';
import modal from '../components/modalShell.module.css';
import styles from './RecordDetailsModal.module.css';

interface RecordDetailsModalProps {
  title: string;
  rows?: DetailRow[];
  sections?: DetailSection[];
  onClose: () => void;
}

function DetailRows({ rows }: { rows: DetailRow[] }) {
  return (
    <div className={styles.list}>
      {rows.map((row) => (
        <div key={row.key} className={styles.row}>
          <span className={styles.label}>{row.label}</span>
          <span className={styles.value}>
            {row.audioUrl ? (
              <RecordingPlayer
                src={row.audioUrl}
                storagePath={row.downloadPath}
                fileName={row.downloadName || 'recording.ogg'}
                knownDuration={row.durationSeconds}
              />
            ) : row.downloadPath ? (
              row.value || '—'
            ) : row.dir === 'ltr' ? (
              <span className={styles.ltrValue} dir="ltr">
                {row.value || '—'}
              </span>
            ) : (
              row.value || '—'
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RecordDetailsModal({
  title,
  rows = [],
  sections,
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
        <div className={modal.scroll}>
          {sections ? (
            <div className={styles.groups}>
              {sections.map((section) => (
                <section key={section.title} className={styles.group}>
                  <h3 className={styles.groupTitle}>{section.title}</h3>
                  <DetailRows rows={section.rows} />
                </section>
              ))}
            </div>
          ) : (
            <DetailRows rows={rows} />
          )}
        </div>
        <button type="button" className={styles.close} onClick={onClose}>
          סגור
        </button>
      </section>
    </div>
  );
}
