import { useCallback } from 'react';
import { useAsyncResource } from '../../shared/hooks/useAsyncResource';
import { getActivePaymentMethod } from './billing.api';
import type { PaymentMethodSummary } from './billing.types';

export function usePaymentMethod(businessCode: string) {
  const load = useCallback(
    () => getActivePaymentMethod(businessCode),
    [businessCode],
  );
  const resource = useAsyncResource<PaymentMethodSummary | null>({
    resourceKey: businessCode,
    load,
    initialData: null,
    errorMessage: 'לא ניתן לבדוק אם נשמר אמצעי תשלום.',
    logLabel: 'שגיאה בטעינת אמצעי תשלום',
  });

  return {
    paymentMethod: resource.data,
    error: resource.error,
    isLoading: resource.isLoading,
    refresh: resource.refresh,
  };
}
