import { useEffect, useState } from 'react';
import modal from '../../../shared/components/modalShell.module.css';
import styles from './RewriteAgentPromptModal.module.css';

interface RewriteAgentPromptModalProps {
  value: string;
  isGenerating: boolean;
  errorMessage: string;
  onChange: (value: string) => void;
  onReplace: () => void;
  onClose: () => void;
}

export default function RewriteAgentPromptModal({
  value,
  isGenerating,
  errorMessage,
  onChange,
  onReplace,
  onClose,
}: RewriteAgentPromptModalProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isGenerating) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGenerating, onClose]);

  const canReplace = !isGenerating && !errorMessage && draft.trim().length > 0;

  return (
    <div
      className={`${modal.overlay} ${styles.overlay}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isGenerating) {
          onClose();
        }
      }}
    >
      <section
        className={`${modal.content} ${styles.content}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rewrite-agent-prompt-title"
      >
        <h2 id="rewrite-agent-prompt-title" className={styles.title}>
          ניסוח בעזרת AI
        </h2>
        <p className={styles.lead}>
          זה נוסח מוצע לתיאור המקצועי. אפשר לערוך כאן ואז להחליף את הטיוטה
          בתיבה. השמירה למערכת נשארת כפתור שמירת ההגדרות.
        </p>

        {isGenerating ? (
          <p className={styles.waiting} role="status">
            מנסח מחדש את התיאור...
          </p>
        ) : null}

        {errorMessage ? (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}

        <textarea
          className={styles.textarea}
          value={draft}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            onChange(next);
          }}
          rows={8}
          disabled={isGenerating}
          aria-label="נוסח מוצע לתיאור המקצועי"
        />

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={onClose}
            disabled={isGenerating}
          >
            ביטול
          </button>
          <button
            type="button"
            className={styles.btnReplace}
            onClick={onReplace}
            disabled={!canReplace}
          >
            החלף
          </button>
        </div>
      </section>
    </div>
  );
}
