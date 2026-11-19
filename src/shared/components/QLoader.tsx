import { useId } from 'react';
import { createPortal } from 'react-dom';
import qLoaderSource from '../../assets/qgent-loader.svg?raw';
import styles from './QLoader.module.css';

const MARK_WIDTH = 457;
const MARK_HEIGHT = 469;

function scopeLoader(source: string, scope: string) {
  return source.replaceAll('qgl-v3-', `${scope}-`);
}

export function QLoader({ size = 36 }: { size?: number }) {
  const scope = `qgl${useId().replaceAll(':', '')}`;
  const height = Math.round((size * MARK_HEIGHT) / MARK_WIDTH);

  return (
    <span
      className={styles.loader}
      style={{ width: size, height }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: scopeLoader(qLoaderSource, scope) }}
    />
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
