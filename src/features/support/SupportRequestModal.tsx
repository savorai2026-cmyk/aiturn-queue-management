import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContextState';
import { getBusinessSettings } from '../settings/settings.api';
import modal from '../../shared/components/modalShell.module.css';
import { sendSupportRequest } from './support.api';
import {
  SUPPORT_INBOX,
  readProfileName,
  supportFieldError,
  type SupportDraft,
} from './supportMail';
import styles from './SupportRequestModal.module.css';

interface SupportRequestModalProps {
  businessCode: string;
  businessName: string;
  onClose: () => void;
}

const EMPTY: SupportDraft = {
  subject: '',
  name: '',
  email: '',
  phone: '',
  message: '',
  businessName: '',
};

export default function SupportRequestModal({
  businessCode,
  businessName,
  onClose,
}: SupportRequestModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<SupportDraft>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');
    setSent(false);

    const load = async () => {
      let contactEmail = user?.email?.trim() ?? '';
      let contactPhone = user?.phone?.trim() ?? '';
      let label = businessName.trim();
      try {
        if (businessCode) {
          const business = await getBusinessSettings(businessCode);
          if (cancelled) return;
          contactEmail = contactEmail || business.email?.trim() || '';
          contactPhone = contactPhone || business.contact_phone?.trim() || '';
          label = business.business_name?.trim() || label;
        }
      } catch {
        // The account details still fill the form when the business row is unavailable.
      }
      if (cancelled) return;
      setForm({
        subject: label ? `פנייה מ־${label}` : 'פנייה למערכת',
        name: readProfileName(user?.user_metadata),
        email: contactEmail,
        phone: contactPhone,
        message: '',
        businessName: label,
      });
      setIsLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [businessCode, businessName, user]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const update = (field: keyof SupportDraft, value: string) => {
    setSent(false);
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const problem = supportFieldError(form);
    if (problem) {
      setError(problem);
      setSent(false);
      return;
    }
    setIsSending(true);
    setError('');
    setSent(false);
    void sendSupportRequest({ ...form, businessCode })
      .then(() => {
        setSent(true);
      })
      .catch((sendError: unknown) => {
        setError(sendError instanceof Error ? sendError.message : 'המייל לא נשלח.');
      })
      .finally(() => {
        setIsSending(false);
      });
  };

  return (
    <div
      className={`${modal.overlay} ${styles.overlay}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`${modal.content} ${styles.content}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-request-title"
      >
        <h2 id="support-request-title" className={styles.title}>
          פנייה למערכת
        </h2>
        <p className={styles.lead}>
          תקלה או שאלה נשלחת מהמערכת אל {SUPPORT_INBOX}. הפרטים מולאו מהחשבון, ואפשר לעדכן אותם לפני השליחה.
        </p>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>נושא</span>
            <input
              value={form.subject}
              onChange={(event) => update('subject', event.target.value)}
              disabled={isLoading}
              maxLength={120}
              required
            />
          </label>
          <label className={styles.field}>
            <span>שם מלא</span>
            <input
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              disabled={isLoading}
              maxLength={80}
              autoComplete="name"
              required
            />
          </label>
          <div className={styles.row}>
            <label className={styles.field}>
              <span>דוא״ל</span>
              <input
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(event) => update('email', event.target.value)}
                disabled={isLoading}
                maxLength={120}
                autoComplete="email"
                required
              />
            </label>
            <label className={styles.field}>
              <span>טלפון לחזרה</span>
              <input
                type="tel"
                dir="ltr"
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                disabled={isLoading}
                maxLength={30}
                autoComplete="tel"
                required
              />
            </label>
          </div>
          <label className={styles.field}>
            <span>תוכן הפנייה</span>
            <textarea
              value={form.message}
              onChange={(event) => update('message', event.target.value)}
              disabled={isLoading}
              maxLength={2000}
              required
            />
          </label>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          {sent ? (
            <p className={styles.sent} role="status">
              הפנייה נשלחה אל {SUPPORT_INBOX}.
            </p>
          ) : null}
          <div className={styles.actions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>
              ביטול
            </button>
            <button type="submit" className={styles.btnSend} disabled={isLoading || isSending}>
              {isSending ? 'שולח...' : 'שליחה'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
