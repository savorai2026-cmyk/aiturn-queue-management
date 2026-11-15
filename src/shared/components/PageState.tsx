import { QLoader } from './QLoader';
import styles from './PageState.module.css';

export function LoadingState({ message }: { message: string }) {
  return (
    <div className={`${styles.state} ${styles.loading}`} role="status">
      <QLoader size={96} />
      <p>{message}</p>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className={`${styles.state} ${styles.error}`} role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          נסה שוב
        </button>
      )}
    </div>
  );
}
