import { useEffect, type ReactNode } from 'react';
import modal from '../../../shared/components/modalShell.module.css';
import styles from './ConfirmDeleteModal.module.css';

interface ConfirmDeleteModalProps {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  isBusy?: boolean;
  errorMessage?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDeleteModal({
  title,
  message,
  confirmLabel = 'מחק',
  isBusy = false,
  errorMessage = '',
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBusy, onCancel]);

  return (
    <div
      className={`${modal.overlay} ${styles.overlay}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) {
          onCancel();
        }
      }}
    >
      <section
        className={`${modal.content} ${styles.content}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
      >
        <h2 id="confirm-delete-title" className={styles.title}>
          {title}
        </h2>

        <p className={styles.message}>{message}</p>

        {errorMessage ? (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={onCancel}
            disabled={isBusy}
          >
            ביטול
          </button>
          <button
            type="button"
            className={styles.btnDanger}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? 'מוחק...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
