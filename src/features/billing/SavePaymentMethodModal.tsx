import { useEffect, useRef, useState } from 'react';
import HelpTip from '../../shared/components/HelpTip';
import { CardIcon, CheckIcon } from '../../shared/components/icons';
import {
  getActivePaymentMethod,
  getLatestBillingSession,
  startBillingEnrollment,
} from './billing.api';
import {
  formatCardLast4,
  getBillingSessionLabel,
  isActivePaymentMethod,
  isTerminalBillingSession,
} from './billing.mappers';
import type { PaymentMethodSummary } from './billing.types';
import modal from '../../shared/components/modalShell.module.css';
import styles from './SavePaymentMethodModal.module.css';

const POLL_MS = 2000;

type FlowState = 'ready' | 'starting' | 'waiting' | 'saved' | 'failed';

interface SavePaymentMethodModalProps {
  businessCode: string;
  mode: 'gate' | 'update';
  paymentMethod: PaymentMethodSummary | null;
  onSaved: () => Promise<void> | void;
  onClose?: () => void;
  onPostpone?: () => void;
}

function openBillingWindow() {
  return window.open('about:blank', 'featurn-billing', 'width=480,height=740');
}

export default function SavePaymentMethodModal({
  businessCode,
  mode,
  paymentMethod,
  onSaved,
  onClose,
  onPostpone,
}: SavePaymentMethodModalProps) {
  const [flow, setFlow] = useState<FlowState>('ready');
  const [errorMessage, setErrorMessage] = useState('');
  const [startUrl, setStartUrl] = useState<string | null>(null);
  const [savedLast4, setSavedLast4] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    return () => {
      popupRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (flow !== 'waiting') return;

    let cancelled = false;
    let handled = false;

    const poll = async () => {
      if (handled) return;

      try {
        const [method, session] = await Promise.all([
          getActivePaymentMethod(businessCode),
          getLatestBillingSession(businessCode),
        ]);

        if (cancelled || handled) return;

        const savedAt = method
          ? new Date(method.tokenizedAt ?? method.updatedAt).getTime()
          : 0;

        if (
          method &&
          isActivePaymentMethod(method) &&
          savedAt >= startedAtRef.current - 15000
        ) {
          handled = true;
          popupRef.current?.close();
          setSavedLast4(formatCardLast4(method.last4));
          setFlow('saved');
          await onSaved();
          return;
        }

        if (
          session &&
          new Date(session.createdAt).getTime() >= startedAtRef.current - 5000 &&
          isTerminalBillingSession(session.status) &&
          session.status !== 'succeeded'
        ) {
          setFlow('failed');
          setErrorMessage(
            session.errorText ||
              `שמירת הכרטיס ${getBillingSessionLabel(session.status)}.`,
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error('שגיאה בבדיקת שמירת הכרטיס:', error);
        }
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [businessCode, flow, onSaved]);

  const handleStart = async () => {
    setErrorMessage('');
    setFlow('starting');

    const popup = openBillingWindow();
    popupRef.current = popup;

    try {
      const url = await startBillingEnrollment(businessCode);
      startedAtRef.current = Date.now();
      setStartUrl(url);

      if (popup && !popup.closed) {
        popup.location.replace(url);
      }

      setFlow('waiting');
    } catch (error) {
      popup?.close();
      setFlow('failed');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'לא ניתן לפתוח את דף שמירת הכרטיס.',
      );
    }
  };

  const title =
    mode === 'gate' ? 'שמירת אמצעי תשלום' : 'עדכון אמצעי תשלום';
  const last4 = formatCardLast4(paymentMethod?.last4 ?? null);

  return (
    <div className={`${modal.overlay} ${styles.overlay}`}>
      <section
        className={`${modal.content} ${styles.content}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-title"
        dir="rtl"
      >
        <h2 id="billing-title" className={styles.title}>
          {title}
        </h2>

        <div className={modal.scroll}>
        {flow === 'saved' ? (
          <div className={styles.success} role="status">
            <CheckIcon />
            הכרטיס נשמר בהצלחה
            {savedLast4 ? ` (${savedLast4})` : ''}.
          </div>
        ) : (
          <>
            <p className={styles.lead}>
              {mode === 'gate'
                ? 'לפני המשך העבודה במערכת יש לשמור כרטיס אשראי לעסק. פרטי הכרטיס מוזנים בדף מאובטח של חברת הסליקה, ולא נשמרים אצלנו.'
                : 'אפשר להחליף את הכרטיס השמור. הכרטיס הקודם יבוטל אחרי שהכרטיס החדש יישמר בהצלחה.'}
            </p>

            <ul className={styles.points}>
              <li>דף ההזנה שייך לקרדיטגארד ואינו עובר דרך המערכת.</li>
              <li>אנחנו שומרים רק אסימון וארבע ספרות אחרונות.</li>
              <li>אפשר לסגור את חלון הסליקה ולנסות שוב אם התהליך נקטע.</li>
            </ul>

            {last4 && mode === 'update' && flow === 'ready' ? (
              <p className={styles.current}>
                כרטיס שמור: {last4}
                <HelpTip text="מוצגות רק ארבע הספרות האחרונות. את מספר הכרטיס המלא מחזיקה חברת הסליקה." />
              </p>
            ) : null}

            {errorMessage ? (
              <p className={styles.error} role="alert">
                {errorMessage}
              </p>
            ) : null}

            {flow === 'waiting' ? (
              <p className={styles.waiting} role="status">
                ממתין לשמירת הכרטיס בדף המאובטח...
              </p>
            ) : null}
          </>
        )}
        </div>

        <div className={styles.actions}>
          {flow === 'saved' ? (
            <button type="button" className={styles.primary} onClick={onClose}>
              המשך
            </button>
          ) : (
            <>
              <button
                type="button"
                className={styles.primary}
                onClick={() => void handleStart()}
                disabled={flow === 'starting' || flow === 'waiting'}
              >
                <CardIcon />
                {flow === 'starting'
                  ? 'פותח דף מאובטח...'
                  : flow === 'waiting'
                    ? 'ממתין לשמירה'
                    : mode === 'update' && last4
                      ? 'החלפת כרטיס'
                      : 'שמירת כרטיס'}
              </button>

              {flow === 'waiting' && startUrl ? (
                <a
                  className={styles.secondaryLink}
                  href={startUrl}
                  target="featurn-billing"
                  rel="noreferrer"
                >
                  אם החלון לא נפתח, לחץ כאן
                </a>
              ) : null}

              {mode === 'gate' && onPostpone ? (
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={onPostpone}
                  disabled={flow === 'starting'}
                >
                  אשלים מאוחר יותר
                </button>
              ) : null}

              {mode === 'update' && onClose ? (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={onClose}
                  disabled={flow === 'starting'}
                >
                  ביטול
                </button>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
