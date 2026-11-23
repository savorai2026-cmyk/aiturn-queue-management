import { useEffect } from 'react';
import { CheckIcon } from '../../../shared/components/icons';
import modal from '../../../shared/components/modalShell.module.css';
import styles from './RescheduleConfirmModal.module.css';

interface StretchContinuationPromptProps {
  isSaving: boolean;
  errorMessage: string;
  onMoveContinuation: () => void;
  onCancel: () => void;
}

export default function StretchContinuationPrompt({
  isSaving,
  errorMessage,
  onMoveContinuation,
  onCancel,
}: StretchContinuationPromptProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onCancel]);

  return (
    <div
      className={`${modal.overlay} ${styles.overlay}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onCancel();
      }}
    >
      <section
        className={`${modal.content} ${styles.content}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stretch-title"
      >
        <h2 id="stretch-title" className={styles.title}>
          להזיז גם את ההמשך?
        </h2>
        <p className={styles.lead}>המתיחה נתקלת בתור הבא באותו ביקור.</p>
        {errorMessage ? (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className={styles.actions}>
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
              onClick={onMoveContinuation}
              disabled={isSaving}
            >
              {isSaving ? 'שומר...' : (
                <>
                  <CheckIcon />
                  הזזת ההמשך
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
