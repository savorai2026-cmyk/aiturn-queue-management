import { useEffect } from 'react';
import { PencilIcon } from '../../../shared/components/IconButton';
import HelpTip from '../../../shared/components/HelpTip';
import styles from './RescheduleConfirmModal.module.css';

export interface ReschedulePreview {
  clientName: string;
  serviceTitle: string;
  fromLabel: string;
  toLabel: string;
  movesAllServices: boolean;
  isPastTarget: boolean;
}

interface RescheduleConfirmModalProps {
  preview: ReschedulePreview;
  isSaving: boolean;
  errorMessage: string;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit: () => void;
}

export default function RescheduleConfirmModal({
  preview,
  isSaving,
  errorMessage,
  onConfirm,
  onCancel,
  onEdit,
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
        aria-describedby="reschedule-question"
      >
        <h2 id="reschedule-title" className={styles.title}>
          להעביר את התור?
        </h2>

        <p id="reschedule-question" className={styles.question}>
          להעביר ללקוח <strong>{preview.clientName}</strong> את התור מ-
          <strong>{preview.fromLabel}</strong> ל-
          <strong>{preview.toLabel}</strong>?
        </p>

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
            <dt>מ</dt>
            <dd>{preview.fromLabel}</dd>
          </div>
          <div>
            <dt>ל</dt>
            <dd>{preview.toLabel}</dd>
          </div>
        </dl>

        {preview.isPastTarget && (
          <p className={styles.warning} role="status">
            המועד החדש כבר עבר. אפשר עדיין לאשר אם רוצים לתעד תור שכבר התקיים.
          </p>
        )}

        {preview.movesAllServices && (
          <p className={styles.note}>כל השירותים בתור יועברו יחד למועד החדש.</p>
        )}

        {errorMessage && (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        )}

        <div className={styles.actions}>
          <div className={styles.editRow}>
            <button
              type="button"
              className={styles.btnEdit}
              onClick={onEdit}
              disabled={isSaving}
            >
              <PencilIcon />
              עריכת תור
            </button>
            <HelpTip text="אם המועד החדש לא מתאים במלואו, אפשר לפתוח את פרטי התור, לתקן ולשמור משם." />
          </div>
          <div className={styles.mainActions}>
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
              {isSaving ? 'שומר...' : 'אישור'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
