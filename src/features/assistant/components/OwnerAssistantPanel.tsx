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
  }, [messages, pending]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || pending) return;
    const next: AssistantTurn[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setDraft('');
    setError('');
    setPending(true);
    try {
      const answer = await askOwnerAssistant({
        businessCode,
        tab: activeTab,
        messages: next,
      });
      if (!activeRef.current) return;
      setMessages([...next, { role: 'assistant', content: answer }]);
    } catch (sendError: unknown) {
      if (!activeRef.current) return;
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

      <div ref={threadRef} className={styles.thread}>
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
          messages.map((message, index) => (
            <p
              key={`${message.role}-${index}`}
              className={message.role === 'user' ? styles.user : styles.assistant}
            >
              {message.content}
            </p>
          ))
        )}
        {pending ? <p className={styles.pending}>בודק את הנתונים...</p> : null}
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
