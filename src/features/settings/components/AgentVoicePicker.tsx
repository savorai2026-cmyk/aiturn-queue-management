import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../../../shared/errors';
import {
  agentVoiceLabel,
  agentVoiceLanguageLabel,
  type AgentVoiceOption,
} from '../agentVoices';
import { fetchAgentVoicePreview, listAgentVoices } from '../settings.api';
import styles from './AgentVoicePicker.module.css';

function listErrorMessage(error: unknown): string {
  const text = getErrorMessage(error).toLowerCase();
  if (text.includes('not configured')) {
    return 'רשימת הקולות עדיין לא הוגדרה בשרת.';
  }
  if (text.includes('not allowed') || text.includes('not authenticated')) {
    return 'אין הרשאה לבחור קול בעסק הזה.';
  }
  if (text.includes('too many')) {
    return 'נשלחו יותר מדי בקשות. נסו שוב בעוד כמה דקות.';
  }
  return 'לא ניתן לטעון את רשימת הקולות.';
}

function previewErrorMessage(error: unknown): string {
  const text = getErrorMessage(error).toLowerCase();
  if (text.includes('no preview') || text.includes('not found')) {
    return 'לקול הזה אין דגימה.';
  }
  if (text.includes('not configured')) {
    return 'הדגימה עדיין לא הוגדרה בשרת.';
  }
  return 'לא ניתן להשמיע את הדגימה.';
}

export default function AgentVoicePicker({
  businessCode,
  voiceId,
  onChange,
}: {
  businessCode: string;
  voiceId: string | null;
  onChange: (voiceId: string | null) => void;
}) {
  const [voices, setVoices] = useState<AgentVoiceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const requestRef = useRef(0);
  const [trackedVoiceId, setTrackedVoiceId] = useState(voiceId);
  if (voiceId !== trackedVoiceId) {
    setTrackedVoiceId(voiceId);
    setPlayingId(null);
    setPreviewingId(null);
    setPreviewError(null);
  }
  const isPreviewing = previewingId === voiceId;
  const isPlaying = playingId === voiceId && voiceId !== null;
  const visiblePreviewError = previewError?.id === voiceId ? previewError.text : '';

  const releaseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    listAgentVoices(businessCode)
      .then((next) => {
        if (!cancelled) setVoices(next);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(listErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [businessCode]);

  useEffect(() => {
    return () => {
      requestRef.current += 1;
      releaseAudio();
    };
  }, [releaseAudio, voiceId]);

  const selected = voices.find((voice) => voice.id === voiceId) ?? null;
  const savedVoiceIsMissing = Boolean(voiceId && !isLoading && !selected);

  const play = async () => {
    if (!voiceId) return;

    if (isPlaying || isPreviewing) {
      requestRef.current += 1;
      releaseAudio();
      setPlayingId(null);
      setPreviewingId(null);
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setPreviewError(null);
    setPreviewingId(voiceId);

    try {
      const blob = await fetchAgentVoicePreview(businessCode, voiceId);
      if (requestRef.current !== requestId) return;

      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (requestRef.current !== requestId) return;
        releaseAudio();
        setPlayingId(null);
      };
      await audio.play();
      if (requestRef.current !== requestId) return;
      setPlayingId(voiceId);
    } catch (error) {
      if (requestRef.current !== requestId) return;
      releaseAudio();
      setPreviewError({ id: voiceId, text: previewErrorMessage(error) });
    } finally {
      if (requestRef.current === requestId) setPreviewingId(null);
    }
  };

  const buttonLabel = isPreviewing
    ? 'טוען דגימה...'
    : isPlaying
      ? 'עצור'
      : 'השמע דגימה';

  return (
    <div className={styles.picker}>
      <div className={styles.controls}>
        <select
          id="business-agent-voice"
          className={styles.select}
          value={voiceId ?? ''}
          disabled={isLoading}
          dir="auto"
          aria-label="קול הסוכן"
          onChange={(event) => onChange(event.target.value || null)}
        >
          {isLoading ? (
            <option value={voiceId ?? ''}>טוען קולות...</option>
          ) : (
            <>
              <option value="">ברירת המחדל</option>
              {savedVoiceIsMissing ? (
                <option value={voiceId ?? ''}>הקול שנשמר</option>
              ) : null}
              {voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {agentVoiceLabel(voice)}
                </option>
              ))}
            </>
          )}
        </select>
        {selected ? (
          <span className={styles.language}>
            {agentVoiceLanguageLabel(selected.language)}
          </span>
        ) : null}
        <button
          type="button"
          className={styles.preview}
          onClick={() => void play()}
          disabled={!voiceId}
          aria-pressed={isPlaying}
        >
          {buttonLabel}
        </button>
      </div>
      {loadError ? <p className={styles.error}>{loadError}</p> : null}
      {!isLoading && !loadError && voices.length === 0 ? (
        <p className={styles.note}>אין כרגע קולות בעברית.</p>
      ) : null}
      {visiblePreviewError ? <p className={styles.error}>{visiblePreviewError}</p> : null}
    </div>
  );
}
