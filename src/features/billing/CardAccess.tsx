import { useEffect, useState, type ReactNode } from 'react';
import { getBusinessAccess } from './billing.api';
import { canManagePaymentMethods, isActivePaymentMethod } from './billing.mappers';
import {
  cardStanding,
  parseBillingHold,
  resolveBusinessAccess,
} from './cardStanding';
import SavePaymentMethodModal from './SavePaymentMethodModal';
import { usePaymentMethod } from './usePaymentMethod';
import type { BusinessRole } from '../business/BusinessContextState';
import styles from './CardAccess.module.css';

interface CardAccessProps {
  businessCode: string;
  role: BusinessRole;
  children: ReactNode;
}

export default function CardAccess({
  businessCode,
  role,
  children,
}: CardAccessProps) {
  const { paymentMethod, isLoading, refresh } = usePaymentMethod(businessCode);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [billingHold, setBillingHold] = useState(parseBillingHold(null));
  const [isActive, setIsActive] = useState(true);
  const [createdLoaded, setCreatedLoaded] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCreatedLoaded(false);
    getBusinessAccess(businessCode)
      .then((value) => {
        if (cancelled) return;
        setCreatedAt(value.createdAt);
        setBillingHold(parseBillingHold(value.billingHold));
        setIsActive(value.isActive);
      })
      .catch(() => {
        if (!cancelled) {
          setCreatedAt(null);
          setBillingHold('exempt');
          setIsActive(true);
        }
      })
      .finally(() => {
        if (!cancelled) setCreatedLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [businessCode]);

  const access = resolveBusinessAccess({
    hold: billingHold,
    isActive,
    standing: cardStanding({
      hasActiveCard: isActivePaymentMethod(paymentMethod),
      cardExp: paymentMethod?.cardExp ?? null,
      businessCreatedAt: createdAt,
      now: new Date(),
    }),
  });
  const canUpdate = canManagePaymentMethods(role);

  if (isLoading || !createdLoaded || !access) {
    return children;
  }

  const updateButton = canUpdate ? (
    <button type="button" className={styles.action} onClick={() => setUpdating(true)}>
      עדכון כרטיס
    </button>
  ) : (
    <p className={styles.hint}>בעל העסק צריך לעדכן את הכרטיס.</p>
  );

  return (
    <>
      {access.dashboardBlocked ? (
        <main className={`feature-area ${styles.block}`}>
          <h1>המערכת חסומה לעסק הזה</h1>
          <p>{access.message}</p>
          {access.showCardUpdate ? (
            updateButton
          ) : (
            <p className={styles.hint}>
              כדי לפתוח, שנו בסופאבייס את billing_hold של העסק ל-exempt או ל-auto.
            </p>
          )}
        </main>
      ) : (
        <>
          <div className={styles.notice} data-level={access.level} role="status">
            <p>{access.message}</p>
            {access.showCardUpdate ? updateButton : null}
          </div>
          {children}
        </>
      )}
      {updating && (
        <SavePaymentMethodModal
          businessCode={businessCode}
          mode={isActivePaymentMethod(paymentMethod) ? 'update' : 'gate'}
          paymentMethod={paymentMethod}
          onSaved={async () => {
            await refresh();
            setUpdating(false);
          }}
          onClose={() => setUpdating(false)}
        />
      )}
    </>
  );
}
