import { useState } from 'react';
import { getRecordingSignedUrl } from '../../conversations/conversations.api';
import { readPaymentHold } from '../paymentHold';
import type { AppointmentDetails } from '../appointments.types';
import styles from './PaymentHoldNotice.module.css';

function formatMoment(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function PaymentHoldNotice({
  appointment,
}: {
  appointment: AppointmentDetails;
}) {
  const hold = readPaymentHold(appointment.status, appointment.metadata);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState('');

  if (!hold) return null;

  const openProof = async () => {
    if (!hold.proof) return;
    setError('');
    setIsOpening(true);
    try {
      const url = await getRecordingSignedUrl(hold.proof.storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('לא ניתן לפתוח את האסמכתא.');
    } finally {
      setIsOpening(false);
    }
  };

  const paidAt = formatMoment(hold.proof?.paidAt ?? null);
  const requestedAt = formatMoment(hold.requestedAt);

  return (
    <section
      className={hold.awaiting ? styles.awaiting : styles.received}
      aria-label={hold.label}
    >
      <strong>{hold.label}</strong>
      <p>
        {hold.awaiting
          ? 'הלקוח סומן כחשוד לביטול. התור ממתין לאסמכתא בוואטסאפ ולא נחשב תור קבוע.'
          : 'התקבלה אסמכתא בוואטסאפ והתור אושר.'}
      </p>
      <p className={styles.meta}>
        {hold.amount ? <span>סכום {hold.amount} ₪</span> : null}
        {hold.payeeName ? <span>מוטב {hold.payeeName}</span> : null}
        {requestedAt ? <span>נשלחה בקשה {requestedAt}</span> : null}
        {paidAt ? <span>שולם {paidAt}</span> : null}
      </p>
      {hold.proof ? (
        <button type="button" onClick={() => void openProof()} disabled={isOpening}>
          {isOpening ? 'פותח...' : 'צפייה באסמכתא'}
        </button>
      ) : (
        <p className={styles.meta}>עדיין לא התקבלה אסמכתא.</p>
      )}
      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  );
}
