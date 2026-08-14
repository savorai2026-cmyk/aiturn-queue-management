import { useCallback } from 'react';
import { useAsyncResource } from '../../shared/hooks/useAsyncResource';
import { getClients } from './clients.api';
import type { Client } from './clients.types';

const EMPTY_CLIENTS: Client[] = [];

export function useClients(businessCode: string) {
  const load = useCallback(() => getClients(businessCode), [businessCode]);
  const resource = useAsyncResource({
    resourceKey: businessCode,
    load,
    initialData: EMPTY_CLIENTS,
    errorMessage: 'לא ניתן לטעון את רשימת הלקוחות.',
    logLabel: 'שגיאה בשליפת לקוחות',
  });

  return {
    clients: resource.data,
    error: resource.error,
    isLoading: resource.isLoading,
    refresh: resource.refresh,
  };
}
