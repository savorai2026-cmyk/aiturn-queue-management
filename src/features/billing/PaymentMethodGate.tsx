import { useEffect, useState } from 'react';
import type { BusinessRole } from '../business/BusinessContextState';
import {
  canManagePaymentMethods,
  isActivePaymentMethod,
} from './billing.mappers';
import {
  readBillingPromptSkipped,
  writeBillingPromptSkipped,
} from './billingPrompt';
import SavePaymentMethodModal from './SavePaymentMethodModal';
import { usePaymentMethod } from './usePaymentMethod';

interface PaymentMethodGateProps {
  businessCode: string;
  role: BusinessRole;
}

export default function PaymentMethodGate({
  businessCode,
  role,
}: PaymentMethodGateProps) {
  const { paymentMethod, isLoading, refresh } = usePaymentMethod(businessCode);
  const [skipped, setSkipped] = useState(() =>
    readBillingPromptSkipped(businessCode),
  );

  useEffect(() => {
    setSkipped(readBillingPromptSkipped(businessCode));
  }, [businessCode]);

  if (!canManagePaymentMethods(role) || isLoading) {
    return null;
  }

  if (isActivePaymentMethod(paymentMethod) || skipped) {
    return null;
  }

  return (
    <SavePaymentMethodModal
      businessCode={businessCode}
      mode="gate"
      paymentMethod={paymentMethod}
      onSaved={refresh}
      onClose={() => {
        void refresh();
      }}
      onPostpone={() => {
        writeBillingPromptSkipped(businessCode);
        setSkipped(true);
      }}
    />
  );
}
