import { useCallback } from 'react';
import { useAsyncResource } from '../../shared/hooks/useAsyncResource';
import { getConversationLogs } from './conversations.api';
import type { ConversationLogsResult } from './conversations.types';

const EMPTY_LOGS: ConversationLogsResult = {
  logs: [],
  truncated: false,
};

export function useConversationLogs(businessCode: string) {
  const load = useCallback(
    () => getConversationLogs(businessCode),
    [businessCode],
  );
  const resource = useAsyncResource({
    resourceKey: businessCode,
    load,
    initialData: EMPTY_LOGS,
    errorMessage: 'לא ניתן לטעון את הלוגים של העסק.',
    logLabel: 'שגיאה בשליפת לוגים',
  });

  return {
    result: resource.data,
    error: resource.error,
    isLoading: resource.isLoading,
    refresh: resource.refresh,
  };
}
