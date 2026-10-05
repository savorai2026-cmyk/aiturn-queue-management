import { useCallback } from 'react';
import { useAsyncResource } from '../../shared/hooks/useAsyncResource';
import { getUsageOverview } from './usage.api';
import type { UsageOverview } from './usage.types';

const EMPTY_OVERVIEW: UsageOverview = {
  account: null,
  events: [],
  prices: [],
  truncated: false,
};

export function useUsage(businessCode: string) {
  const load = useCallback(
    () => getUsageOverview(businessCode),
    [businessCode],
  );
  const resource = useAsyncResource({
    resourceKey: businessCode,
    load,
    initialData: EMPTY_OVERVIEW,
    errorMessage: 'לא ניתן לטעון את נתוני העלות של העסק.',
    logLabel: 'שגיאה בשליפת עלות שימוש',
  });

  return {
    overview: resource.data,
    error: resource.error,
    isLoading: resource.isLoading,
    refresh: resource.refresh,
  };
}
