import { useEffect, useState } from 'react';
import RecordingPlayer from '../../features/conversations/components/RecordingPlayer';
import { useSlidingIndicator } from '../useSlidingIndicator';
import type { DetailRow, DetailSection } from './types';
import modal from '../components/modalShell.module.css';
import styles from './RecordDetailsModal.module.css';

interface RecordDetailsModalProps {
  title: string;
  rows?: DetailRow[];
  sections?: DetailSection[];
  onClose: () => void;
}

const SPEAKER_PREFIX = /^(ה?לקוח|ה?נציג)(\s*:)/;

function TranscriptText({ text }: { text: string }) {
  const lines = text.split('\n');
  return lines.map((line, index) => {
    const match = line.match(SPEAKER_PREFIX);
    return (
      <span key={index}>
        {index > 0 ? '\n' : null}
        {match ? (
          <>
            <strong className={styles.speaker}>
              {match[1]}
              {match[2]}
            </strong>
            {line.slice(match[0].length)}
          </>
        ) : (
          line
        )}
      </span>
    );
  });
}

function SectionTabs({
  sections,
  active,
  onChange,
}: {
  sections: DetailSection[];
  active: string;
  onChange: (title: string) => void;
}) {
  const { containerRef, box, ready } = useSlidingIndicator(active);

  return (
    <div className={styles.tabs} ref={containerRef} role="tablist">
      {box ? (
        <span
          className={`${styles.tabIndicator} ${ready ? styles.tabIndicatorReady : ''}`}
          style={{
            width: box.width,
            transform: `translate(${box.x}px, ${box.y}px)`,
          }}
          aria-hidden="true"
        />
      ) : null}
      {sections.map((section, index) => (
        <span key={section.title} className={styles.tabSlot}>
          {index > 0 ? <span className={styles.tabDivider} aria-hidden="true" /> : null}
          <button
            type="button"
            role="tab"
            className={`${styles.tabBtn} ${active === section.title ? styles.activeTab : ''}`}
            aria-selected={active === section.title}
            aria-current={active === section.title ? 'page' : undefined}
            onClick={() => onChange(section.title)}
          >
            {section.title}
          </button>
        </span>
      ))}
    </div>
  );
}

function DetailRows({ rows }: { rows: DetailRow[] }) {
  return (
    <div className={styles.list}>
      {rows.map((row) => (
        <div key={row.key} className={styles.row}>
          <span className={styles.label}>{row.label}</span>
          <span className={styles.value}>
            {row.audioUrl ? (
              <RecordingPlayer
                src={row.audioUrl}
                storagePath={row.downloadPath}
                fileName={row.downloadName || 'recording.ogg'}
                knownDuration={row.durationSeconds}
              />
            ) : row.downloadPath ? (
              row.value || '—'
            ) : row.key === 'transcript' && row.value ? (
              <TranscriptText text={row.value} />
            ) : row.dir === 'ltr' ? (
              <span className={styles.ltrValue} dir="ltr">
                {row.value || '—'}
              </span>
            ) : (
              row.value || '—'
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RecordDetailsModal({
  title,
  rows = [],
  sections,
  onClose,
}: RecordDetailsModalProps) {
  const [activeTitle, setActiveTitle] = useState(sections?.[0]?.title ?? '');
  const activeSection =
    sections?.find((section) => section.title === activeTitle) ?? sections?.[0];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={`${modal.overlay} ${styles.overlay}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={`${modal.content} ${styles.content}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-details-title"
      >
        <header className={styles.header}>
          <h2 id="record-details-title" className={styles.title}>
            {title}
          </h2>
        </header>
        {sections && activeSection ? (
          <SectionTabs
            sections={sections}
            active={activeSection.title}
            onChange={setActiveTitle}
          />
        ) : null}
        <div className={modal.scroll}>
          <DetailRows rows={activeSection ? activeSection.rows : rows} />
        </div>
        <footer className={styles.footer}>
          <button type="button" className={styles.close} onClick={onClose}>
            סגור
          </button>
        </footer>
      </section>
    </div>
  );
}
