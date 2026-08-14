import { useCallback } from 'react';
import { useAsyncResource } from '../../shared/hooks/useAsyncResource';
import { getBusinessSettings, getServices } from './settings.api';
import type { BusinessSettings, Service } from './settings.types';

interface SettingsData {
  business: BusinessSettings | null;
  services: Service[];
}

const EMPTY_SETTINGS: SettingsData = {
  business: null,
  services: [],
};

export function useSettings(businessCode: string) {
  const load = useCallback(async () => {
    const [business, services] = await Promise.all([
      getBusinessSettings(businessCode),
      getServices(businessCode),
    ]);

    return { business, services };
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
    error: resource.error,
    isLoading: resource.isLoading,
    refresh: resource.refresh,
  };
}
