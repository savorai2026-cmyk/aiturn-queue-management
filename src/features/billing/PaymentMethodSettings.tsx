import { useState } from 'react';
import HelpTip from '../../shared/components/HelpTip';
import { CardIcon } from '../../shared/components/icons';
import type { BusinessRole } from '../business/BusinessContextState';
import {
  canManagePaymentMethods,
  formatCardExpiry,
  formatCardLast4,
  getPaymentStatusLabel,
  isActivePaymentMethod,
} from './billing.mappers';
import SavePaymentMethodModal from './SavePaymentMethodModal';
import type { PaymentMethodSummary } from './billing.types';
import styles from './PaymentMethodSettings.module.css';

interface PaymentMethodSettingsProps {
  businessCode: string;
  role: BusinessRole;
  paymentMethod: PaymentMethodSummary | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => Promise<void> | void;
}

function formatSavedAt(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function PaymentMethodSettings({
  businessCode,
  role,
  paymentMethod,
  isLoading,
  error,
  onRefresh,
}: PaymentMethodSettingsProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const canManage = canManagePaymentMethods(role);
  const last4 = formatCardLast4(paymentMethod?.last4);
  const expiry = formatCardExpiry(paymentMethod?.cardExp);
  const savedAt = formatSavedAt(paymentMethod?.tokenizedAt ?? paymentMethod?.updatedAt ?? null);
  const hasCard = isActivePaymentMethod(paymentMethod);

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.header}>
        <h3>
          <CardIcon />
          כרטיס אשראי
        </h3>
        <HelpTip text="פרטי הכרטיס המלאים נשמרים אצל קרדיטגארד. במערכת מופיעות רק ארבע הספרות האחרונות וסטטוס השמירה." />
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className={styles.muted}>בודק אמצעי תשלום שמור...</p>
      ) : hasCard && paymentMethod ? (
        <dl className={styles.details}>
          <div>
            <dt>כרטיס שמור</dt>
            <dd>{last4 ?? 'כרטיס פעיל'}</dd>
          </div>
          {expiry ? (
            <div>
              <dt>תוקף</dt>
              <dd>{expiry}</dd>
            </div>
          ) : null}
          <div>
            <dt>סטטוס</dt>
            <dd>{getPaymentStatusLabel(paymentMethod.status)}</dd>
          </div>
          {savedAt ? (
            <div>
              <dt>נשמר ב</dt>
              <dd>{savedAt}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className={styles.muted}>
          עדיין לא נשמר כרטיס אשראי לעסק זה.
        </p>
      )}

      {canManage ? (
        <button
          type="button"
          className={styles.primary}
          onClick={() => setIsEditorOpen(true)}
        >
          <CardIcon />
          {hasCard ? 'עדכון כרטיס' : 'שמירת כרטיס'}
        </button>
      ) : (
        <p className={styles.muted}>
          רק בעלים או מנהל יכולים לעדכן אמצעי תשלום.
        </p>
      )}

      {isEditorOpen ? (
        <SavePaymentMethodModal
          businessCode={businessCode}
          mode="update"
          paymentMethod={paymentMethod}
          onSaved={async () => {
            await onRefresh();
            setIsEditorOpen(false);
          }}
          onClose={() => setIsEditorOpen(false)}
        />
      ) : null}
    </div>
  );
}
