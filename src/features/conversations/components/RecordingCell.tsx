import { useEffect, useState } from 'react';
import { getRecordingSignedUrl } from '../conversations.api';
import { hasPlayableRecording, logPlaybackUrl } from '../conversations.mappers';
import type { ConversationLog } from '../conversations.types';
import styles from './LogsPage.module.css';

interface RecordingCellProps {
  log: ConversationLog;
}

export default function RecordingCell({ log }: RecordingCellProps) {
  const readyUrl = logPlaybackUrl(log);
  const [audioUrl, setAudioUrl] = useState<string | null>(readyUrl);
  const [error, setError] = useState('');

  useEffect(() => {
    setAudioUrl(readyUrl);
    setError('');
  }, [log.id, readyUrl]);

  useEffect(() => {
    if (audioUrl || !log.storagePath || log.purgedRecordingAt) {
      return;
    }

    let cancelled = false;
    void getRecordingSignedUrl(log.storagePath)
      .then((url) => {
        if (!cancelled) {
          setAudioUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('לא ניתן לטעון');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [audioUrl, log.purgedRecordingAt, log.storagePath]);

  if (log.purgedRecordingAt) {
    return <span>נמחקה</span>;
  }

  if (!hasPlayableRecording(log)) {
    return <span>—</span>;
  }

  return (
    <div
      className={styles.recordingCell}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <audio
        className={styles.tableAudio}
        controls
        preload="none"
        src={audioUrl ?? undefined}
      >
        הדפדפן אינו תומך בהשמעת הקלטה.
      </audio>
      {error ? <span className={styles.recordingError}>{error}</span> : null}
    </div>
  );
}
