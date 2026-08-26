import { useCallback } from 'react';
import { useAsyncResource } from '../../shared/hooks/useAsyncResource';
import {
  getBusinessSettings,
  getServices,
  getStatuses,
} from './settings.api';
import type {
  AppointmentStatusRow,
  BusinessSettings,
  Service,
} from './settings.types';

interface SettingsData {
  business: BusinessSettings | null;
  services: Service[];
  statuses: AppointmentStatusRow[];
}

const EMPTY_SETTINGS: SettingsData = {
  business: null,
  services: [],
  statuses: [],
};

export function useSettings(businessCode: string) {
  const load = useCallback(async () => {
    const [business, services, statuses] = await Promise.all([
      getBusinessSettings(businessCode),
      getServices(businessCode),
      getStatuses(businessCode),
    ]);

    return { business, services, statuses };
  }, [businessCode]);
  const resource = useAsyncResource({
    resourceKey: businessCode,
    load,
    initialData: EMPTY_SETTINGS,
    errorMessage: 'לא ניתן לטעון את הגדרות העסק.',
    logLabel: 'שגיאה בטעינת ההגדרות',
  });

  return {
    business: resource.data.business,
    services: resource.data.services,
    statuses: resource.data.statuses,
    error: resource.error,
    isLoading: resource.isLoading,
    refresh: resource.refresh,
  };
}
