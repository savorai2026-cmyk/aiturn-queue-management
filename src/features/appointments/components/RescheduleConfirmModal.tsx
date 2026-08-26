import { useEffect } from 'react';
import styles from './RescheduleConfirmModal.module.css';

export interface ReschedulePreview {
  clientName: string;
  serviceTitle: string;
  fromLabel: string;
  toLabel: string;
  movesAllServices: boolean;
}

interface RescheduleConfirmModalProps {
  preview: ReschedulePreview;
  isSaving: boolean;
  errorMessage: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function RescheduleConfirmModal({
  preview,
  isSaving,
  errorMessage,
  onConfirm,
  onCancel,
}: RescheduleConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onCancel]);

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onCancel();
        }
      }}
    >
      <section
        className={styles.content}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-title"
      >
        <h2 id="reschedule-title" className={styles.title}>
          אישור שינוי מועד
        </h2>

        <dl className={styles.details}>
          <div>
            <dt>לקוח</dt>
            <dd>{preview.clientName}</dd>
          </div>
          <div>
            <dt>שירות</dt>
            <dd>{preview.serviceTitle}</dd>
          </div>
          <div>
            <dt>מועד נוכחי</dt>
            <dd>{preview.fromLabel}</dd>
          </div>
          <div>
            <dt>מועד חדש</dt>
            <dd>{preview.toLabel}</dd>
          </div>
        </dl>

        {preview.movesAllServices && (
          <p className={styles.note}>כל השירותים בתור יועברו יחד למועד החדש.</p>
        )}

        {errorMessage && (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={onCancel}
            disabled={isSaving}
          >
            ביטול
          </button>
          <button
            type="button"
            className={styles.btnConfirm}
            onClick={onConfirm}
            disabled={isSaving}
          >
            {isSaving ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </section>
    </div>
  );
}
