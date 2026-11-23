import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { AppTab } from '../../../app/navigation.ts';
import { SCREEN_GUIDES } from '../../../app/productGuide.ts';
import { getOwnerAssistantErrorMessage } from '../../../shared/errors.ts';
import { askOwnerAssistant, type AssistantTurn } from '../assistant.api.ts';
import styles from './OwnerAssistantPanel.module.css';

interface OwnerAssistantPanelProps {
  businessCode: string;
  businessName: string;
  activeTab: AppTab;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function AssistantMark() {
  const ringId = `assistant-q-${useId().replace(/:/g, '')}`;
  return (
    <svg className={styles.mark} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={ringId} x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f6993b" />
          <stop offset="0.5" stopColor="#0ca4a8" />
          <stop offset="1" stopColor="#0b6f92" />
        </linearGradient>
      </defs>
      <path
        d="M38 41.9A16 16 0 1 1 42.3 38.3"
        fill="none"
        stroke={`url(#${ringId})`}
        strokeWidth="5.2"
        strokeLinecap="round"
      />
      <path
        d="M41.6 39.2 L50.2 48.4"
        fill="none"
        stroke={`url(#${ringId})`}
        strokeWidth="5.2"
        strokeLinecap="round"
      />
      <path
        fill="#f47a28"
        stroke="#fff"
        strokeWidth="1.3"
        strokeLinejoin="round"
        d="M30 16.4 L33.2 25.2 L42 28 L33.2 30.8 L30 39.6 L26.8 30.8 L18 28 L26.8 25.2 Z"
      />
    </svg>
  );
}

const SUGGESTIONS = [
  'מה יש ביומן מחר?',
  'איך מוסיפים שירות?',
  'כמה תורים בוטלו בחודש האחרון?',
];

function characters(text: string) {
  return Array.from(text);
}

function writingPace(length: number) {
  const ticks = Math.min(Math.max(length, 1), 72);
  return {
    step: Math.max(1, Math.ceil(length / ticks)),
    delay: length < 36 ? 34 : 18,
  };
}

function TypingBubble() {
  return (
    <div className={`${styles.bubble} ${styles.assistant} ${styles.tail} ${styles.typing}`} aria-hidden="true">
      <span className={styles.dots}>
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}

export default function OwnerAssistantPanel({
  businessCode,
  businessName,
  activeTab,
  open,
  onToggle,
  onClose,
}: OwnerAssistantPanelProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(true);
  const [messages, setMessages] = useState<AssistantTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [writingIndex, setWritingIndex] = useState<number | null>(null);
  const [written, setWritten] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const messagesRef = useRef<AssistantTurn[]>([]);
  const writtenRef = useRef(0);
  messagesRef.current = messages;

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [messages, pending, written, open]);

  useEffect(() => {
    if (writingIndex == null) return;
    const full = messagesRef.current[writingIndex]?.content ?? '';
    const glyphs = characters(full);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches || glyphs.length === 0) {
      setWritten(glyphs.length);
      setWritingIndex(null);
      return;
    }

    const { step, delay } = writingPace(glyphs.length);
    let count = writtenRef.current;
    if (count >= glyphs.length) {
      setWritingIndex(null);
      return;
    }
    if (count === 0) {
      count = Math.min(glyphs.length, step);
      writtenRef.current = count;
      setWritten(count);
    }
    if (count >= glyphs.length) {
      setWritingIndex(null);
      return;
    }

    const timer = window.setInterval(() => {
      count = Math.min(glyphs.length, count + step);
      writtenRef.current = count;
      setWritten(count);
      if (count >= glyphs.length) {
        window.clearInterval(timer);
        setWritingIndex(null);
      }
    }, delay);
    return () => window.clearInterval(timer);
  }, [writingIndex]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || pending) return;
    const next: AssistantTurn[] = [...messages, { role: 'user', content }];
    writtenRef.current = 0;
    setWritingIndex(null);
    setMessages(next);
    setDraft('');
    setError('');
    setAnnouncement('מכין תשובה');
    setPending(true);
    try {
      const answer = await askOwnerAssistant({
        businessCode,
        tab: activeTab,
        messages: next,
      });
      if (!activeRef.current) return;
      const withAnswer: AssistantTurn[] = [...next, { role: 'assistant', content: answer }];
      setMessages(withAnswer);
      writtenRef.current = 0;
      setWritten(0);
      setWritingIndex(withAnswer.length - 1);
      setAnnouncement(answer);
    } catch (sendError: unknown) {
      if (!activeRef.current) return;
      setAnnouncement('');
      setError(getOwnerAssistantErrorMessage(sendError));
    } finally {
      if (activeRef.current) setPending(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send(draft);
  };

  return createPortal(
    <>
    {open ? (
    <section
      className={styles.panel}
      role="dialog"
      aria-labelledby={titleId}
      aria-modal="false"
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>עוזר אישי</h2>
          <p className={styles.context}>
            {businessName || 'העסק'} · {SCREEN_GUIDES[activeTab].label}
          </p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="סגירה">
          ×
        </button>
      </header>

      <div ref={threadRef} className={styles.thread} aria-busy={pending}>
        <p className={styles.live} role="status">{announcement}</p>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <p>אפשר לשאול על המסך הפתוח, או על התורים, הלקוחות וההגדרות של העסק.</p>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className={styles.suggestion}
                  onClick={() => void send(suggestion)}
                  disabled={pending}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const grouped = messages[index - 1]?.role === message.role;
            const followedByTyping = pending && index === messages.length - 1 && message.role === 'assistant';
            const tail = messages[index + 1]?.role !== message.role && !followedByTyping;
            const isWriting = writingIndex === index;
            const text = isWriting ? characters(message.content).slice(0, written).join('') : message.content;
            return (
              <p
                key={`${message.role}-${index}`}
                className={[
                  styles.bubble,
                  message.role === 'user' ? styles.user : styles.assistant,
                  grouped ? styles.grouped : '',
                  tail ? styles.tail : '',
                ].filter(Boolean).join(' ')}
              >
                {text}
                {isWriting ? <span className={styles.caret} aria-hidden="true" /> : null}
              </p>
            );
          })
        )}
        {pending ? <TypingBubble /> : null}
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <form className={styles.composer} onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={draft}
          rows={2}
          placeholder="שאלה על העסק או על המסך"
          aria-label="שאלה לעוזר"
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send(draft);
            }
          }}
        />
        <button type="submit" className={styles.send} disabled={pending || !draft.trim()}>
          שליחה
        </button>
      </form>
    </section>
    ) : null}
    <button
      type="button"
      className={`${styles.launcher} ${open ? styles.launcherOpen : ''}`}
      aria-expanded={open}
      aria-label="עוזר אישי"
      onClick={onToggle}
    >
      <AssistantMark />
    </button>
    </>,
    document.body,
  );
}
