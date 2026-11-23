import { useEffect } from 'react';
import { CheckIcon, PencilIcon } from '../../../shared/components/icons';
import HelpTip from '../../../shared/components/HelpTip';
import modal from '../../../shared/components/modalShell.module.css';
import styles from './RescheduleConfirmModal.module.css';

export interface MoveMoment {
  dateLabel: string;
  timeLabel: string;
}

export interface ReschedulePreview {
  clientName: string;
  serviceTitle: string;
  from: MoveMoment;
  to: MoveMoment;
  movesAllServices: boolean;
  movesVisit?: boolean;
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
      className={`${modal.overlay} ${styles.overlay}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onCancel();
        }
      }}
    >
      <section
        className={`${modal.content} ${styles.content}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-title"
        aria-describedby="reschedule-question"
      >
        <h2 id="reschedule-title" className={styles.title}>
          להעביר את התור?
        </h2>

        <div className={modal.scroll}>
        <p id="reschedule-question" className={styles.lead}>
          <span>{preview.clientName}</span>
          {preview.serviceTitle ? (
            <span className={styles.leadService}>{preview.serviceTitle}</span>
          ) : null}
        </p>

        <dl className={styles.details}>
          <div>
            <dt>מ</dt>
            <dd>
              <span>{preview.from.dateLabel}</span>
              <span className={styles.clock} dir="ltr">{preview.from.timeLabel}</span>
            </dd>
          </div>
          <div>
            <dt>ל</dt>
            <dd>
              <span>{preview.to.dateLabel}</span>
              <span className={styles.clock} dir="ltr">{preview.to.timeLabel}</span>
            </dd>
          </div>
        </dl>

        {preview.isPastTarget && (
          <p className={styles.warning} role="status">
            המועד החדש כבר עבר. אפשר עדיין לאשר אם רוצים לתעד תור שכבר התקיים.
          </p>
        )}

        {preview.movesVisit ? (
          <p className={styles.note}>שאר השירותים בביקור יוזזו באותו הפרש.</p>
        ) : preview.movesAllServices ? (
          <p className={styles.note}>כל השירותים בתור יועברו יחד למועד החדש.</p>
        ) : null}

        {errorMessage && (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        )}
        </div>

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
              {isSaving ? 'שומר...' : (
                <>
                  <CheckIcon />
                  אישור
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
