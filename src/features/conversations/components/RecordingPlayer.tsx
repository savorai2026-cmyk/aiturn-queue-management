import { useEffect, useId, useRef, useState } from 'react';
import { getRecordingDownloadUrl } from '../conversations.api';
import styles from './RecordingPlayer.module.css';

interface RecordingPlayerProps {
  src: string;
  storagePath?: string | null;
  fileName: string;
}

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

export default function RecordingPlayer({
  src,
  storagePath,
  fileName,
}: RecordingPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const seekingRef = useRef(false);
  const menuId = useId();
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.volume = volume;
    setPlaying(false);
    setTime(0);
    setDuration(0);
    setMenuOpen(false);
    setError('');
  }, [src]);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [menuOpen]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => setError('לא ניתן להשמיע'));
      return;
    }
    audio.pause();
  };

  const download = async () => {
    if (downloading) return;
    setError('');
    setDownloading(true);
    try {
      const href = storagePath
        ? await getRecordingDownloadUrl(storagePath, fileName)
        : src;
      const link = document.createElement('a');
      link.href = href;
      link.download = fileName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMenuOpen(false);
    } catch {
      setError('לא ניתן להוריד');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className={styles.player}
      data-open={menuOpen}
      dir="ltr"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          if (!seekingRef.current) setTime(event.currentTarget.currentTime);
        }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        className={styles.play}
        aria-label={playing ? 'השהיה' : 'ניגון'}
        onClick={togglePlay}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <input
        className={styles.seek}
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(time, duration || 0)}
        aria-label="דילוג בהקלטה"
        onPointerDown={() => {
          seekingRef.current = true;
        }}
        onPointerUp={() => {
          seekingRef.current = false;
        }}
        onChange={(event) => {
          const next = Number(event.target.value);
          setTime(next);
          if (audioRef.current) audioRef.current.currentTime = next;
        }}
      />
      <span className={styles.time}>
        {formatClock(time)} / {formatClock(duration)}
      </span>
      <button
        type="button"
        className={styles.more}
        aria-label="אפשרויות נוספות"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => setMenuOpen((open) => !open)}
      >
        ⋮
      </button>
      {menuOpen ? (
        <div id={menuId} className={styles.menu} role="menu">
          <label className={styles.volume}>
            <span>עוצמת קול</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              aria-label="עוצמת קול"
              onChange={(event) => {
                const next = Number(event.target.value);
                setVolume(next);
                if (audioRef.current) audioRef.current.volume = next;
              }}
            />
          </label>
          <button
            type="button"
            className={styles.download}
            role="menuitem"
            disabled={downloading}
            onClick={() => void download()}
          >
            {downloading ? 'מוריד...' : 'הורדה'}
          </button>
        </div>
      ) : null}
      {error ? <span className={styles.error}>{error}</span> : null}
    </div>
  );
}
