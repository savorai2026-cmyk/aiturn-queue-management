import { useId } from 'react';
import { createPortal } from 'react-dom';
import qMark from '../../assets/q-mark.png';
import styles from './QLoader.module.css';

const MARK_WIDTH = 310;
const MARK_HEIGHT = 339;

export function QLoader({ size = 36 }: { size?: number }) {
  const height = Math.round((size * MARK_HEIGHT) / MARK_WIDTH);
  const gradId = `q-sweep-${useId().replace(/:/g, '')}`;

  return (
    <span
      className={styles.loader}
      style={{ width: size, height }}
      aria-hidden="true"
    >
      <span className={styles.shadow} />
      <img
        className={styles.mark}
        src={qMark}
        alt=""
        width={MARK_WIDTH}
        height={MARK_HEIGHT}
        draggable={false}
      />
      <svg
        className={styles.fx}
        viewBox="0 0 310 339"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="310" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#F15A29" />
            <stop offset="0.45" stopColor="#F9A23B" />
            <stop offset="1" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        <circle
          className={styles.ring}
          cx="155"
          cy="150"
          r="126"
          style={{ stroke: `url(#${gradId})` }}
        />
        <g className={styles.arrowGroup}>
          <path
            className={styles.arrow}
            pathLength={100}
            d="M78 196 C124 236, 186 224, 228 164"
          />
          <path
            className={styles.arrowHead}
            d="M236 152 L228 182 L208 164 Z"
          />
        </g>
      </svg>
    </span>
  );
}

export function WaitingOverlay({ message }: { message?: string }) {
  return createPortal(
    <div className={styles.overlay} role="status">
      <QLoader size={148} />
      {message ? <p className={styles.overlayMessage}>{message}</p> : null}
    </div>,
    document.body,
  );
}

