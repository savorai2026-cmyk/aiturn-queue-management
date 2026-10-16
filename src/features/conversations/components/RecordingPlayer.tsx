import { useEffect, useId, useRef, useState } from 'react';
import { getRecordingDownloadUrl } from '../conversations.api';
import styles from './RecordingPlayer.module.css';

interface RecordingPlayerProps {
  src: string;
  storagePath?: string | null;
  fileName: string;
  knownDuration?: number | null;
}

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

function finiteDuration(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export default function RecordingPlayer({
  src,
  storagePath,
  fileName,
  knownDuration,
}: RecordingPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const seekRef = useRef<HTMLInputElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const durationRef = useRef(0);
  const volumeRef = useRef(1);
  const scrubbingRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const endScrubRef = useRef<(() => void) | null>(null);
  const seenSrcRef = useRef(src);
  if (seenSrcRef.current !== src) {
    seenSrcRef.current = src;
    durationRef.current = finiteDuration(knownDuration);
  } else if (durationRef.current <= 0) {
    durationRef.current = finiteDuration(knownDuration);
  }
  const menuId = useId();
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const applyMax = (input: HTMLInputElement, max: number) => {
    if (max > 0) {
      input.max = String(max);
      input.setAttribute('aria-valuemax', String(max));
    }
  };

  const writeClock = (seconds: number) => {
    if (!clockRef.current) return;
    clockRef.current.textContent = `${formatClock(seconds)} / ${formatClock(durationRef.current)}`;
  };

  const paintProgress = (input: HTMLInputElement) => {
    const max = Number(input.max);
    const value = Number(input.value);
    const progress = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    input.style.setProperty('--progress', `${progress}%`);
  };

  const adoptDuration = (raw: number) => {
    const next = finiteDuration(raw) || finiteDuration(knownDuration);
    if (!next) return;
    durationRef.current = next;
    const input = seekRef.current;
    if (!input) return;
    applyMax(input, next);
    paintProgress(input);
    writeClock(scrubbingRef.current ? Number(input.value) : audioRef.current?.currentTime || 0);
  };

  const commitSeek = (next: number) => {
    const max = durationRef.current;
    const clamped = max > 0 ? Math.min(Math.max(0, next), max) : Math.max(0, next);
    pendingSeekRef.current = clamped;
    const input = seekRef.current;
    if (input) {
      input.value = String(clamped);
      paintProgress(input);
    }
    writeClock(clamped);

    const audio = audioRef.current;
    if (!audio || audio.readyState < HTMLMediaElement.HAVE_METADATA) return;
    try {
      audio.currentTime = clamped;
    } catch {
      pendingSeekRef.current = null;
    }
  };

  const beginScrub = () => {
    if (scrubbingRef.current) return;
    scrubbingRef.current = true;

    const finish = () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('mouseup', finish);
      endScrubRef.current = null;
      if (!scrubbingRef.current) return;
      scrubbingRef.current = false;
      commitSeek(Number(seekRef.current?.value ?? 0));
    };

    endScrubRef.current = () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('mouseup', finish);
      scrubbingRef.current = false;
    };
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('mouseup', finish);
  };

  useEffect(() => {
    const audio = audioRef.current;
    scrubbingRef.current = false;
    pendingSeekRef.current = null;
    const max = finiteDuration(knownDuration);
    durationRef.current = max;
    if (seekRef.current) {
      seekRef.current.max = String(max || 0);
      if (max > 0) seekRef.current.setAttribute('aria-valuemax', String(max));
      seekRef.current.value = '0';
      seekRef.current.style.setProperty('--progress', '0%');
    }
    writeClock(0);
    setPlaying(false);
    setMenuOpen(false);
    setError('');
    if (!audio) return;
    audio.pause();
    audio.volume = volumeRef.current;
  }, [src]);

  useEffect(() => () => endScrubRef.current?.(), []);

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
          if (scrubbingRef.current || pendingSeekRef.current != null) return;
          const current = event.currentTarget.currentTime;
          const input = seekRef.current;
          if (!input) return;
          input.value = String(current);
          paintProgress(input);
          writeClock(current);
        }}
        onLoadedMetadata={(event) => {
          adoptDuration(event.currentTarget.duration);
          const pending = pendingSeekRef.current;
          if (pending != null) event.currentTarget.currentTime = pending;
        }}
        onDurationChange={(event) => adoptDuration(event.currentTarget.duration)}
        onSeeked={(event) => {
          pendingSeekRef.current = null;
          if (scrubbingRef.current) return;
          const input = seekRef.current;
          if (!input) return;
          input.value = String(event.currentTarget.currentTime);
          paintProgress(input);
          writeClock(event.currentTarget.currentTime);
        }}
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
        ref={seekRef}
        className={styles.seek}
        type="range"
        min={0}
        step="any"
        defaultValue={0}
        aria-label="דילוג בהקלטה"
        aria-valuemin={0}
        onPointerDown={beginScrub}
        onMouseDown={beginScrub}
        onInput={(event) => {
          paintProgress(event.currentTarget);
          writeClock(Number(event.currentTarget.value));
          if (!scrubbingRef.current) commitSeek(Number(event.currentTarget.value));
        }}
      />
      <span ref={clockRef} className={styles.time}>
        0:00 / {formatClock(finiteDuration(knownDuration))}
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
                volumeRef.current = next;
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
