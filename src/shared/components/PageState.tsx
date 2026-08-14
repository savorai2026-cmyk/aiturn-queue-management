import styles from './PageState.module.css';

export function LoadingState({ message }: { message: string }) {
  return (
    <div className={styles.state} role="status">
      {message}
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
        <button type="button" onClick={onRetry}>
          נסה שוב
        </button>
      )}
    </div>
  );
}
