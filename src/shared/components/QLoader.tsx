import { createPortal } from 'react-dom';
import qLoader from '../../assets/q-loader.png';
import styles from './QLoader.module.css';

const MARK_WIDTH = 457;
const MARK_HEIGHT = 469;

export function QLoader({ size = 36 }: { size?: number }) {
  const height = Math.round((size * MARK_HEIGHT) / MARK_WIDTH);

  return (
    <span
      className={styles.loader}
      style={{ width: size, height }}
      aria-hidden="true"
    >
      <img
        className={styles.mark}
        src={qLoader}
        alt=""
        width={MARK_WIDTH}
        height={MARK_HEIGHT}
        draggable={false}
      />
    </span>
  );
}

export function WaitingOverlay({ message }: { message?: string }) {
  return createPortal(
    <div className={styles.overlay} role="status">
      <div className={styles.bubble}>
        <QLoader size={112} />
        {message ? <p className={styles.overlayMessage}>{message}</p> : null}
      </div>
    </div>,
    document.body,
  );
}
