import { useCallback } from 'react';
import { useAsyncResource } from '../../shared/hooks/useAsyncResource';
import { getConversationLogs } from './conversations.api';
import { DEFAULT_LOG_PAGE_SIZE } from './conversations.mappers';
import type { ConversationLogsResult, LogLookup } from './conversations.types';

const EMPTY_LOGS: ConversationLogsResult = {
  logs: [],
  total: 0,
  page: 0,
  pageSize: DEFAULT_LOG_PAGE_SIZE,
};

export function useConversationLogs(
  businessCode: string,
  page: number,
  pageSize: number,
  lookup: LogLookup,
) {
  const load = useCallback(
    () => getConversationLogs(businessCode, page, lookup, pageSize),
    [businessCode, lookup.clientName, lookup.from, lookup.nationalId, lookup.period, lookup.phone, lookup.to, page, pageSize],
  );
  const resource = useAsyncResource({
    resourceKey: [
      businessCode,
      page,
      pageSize,
      lookup.period,
      lookup.phone,
      lookup.nationalId,
      lookup.clientName,
      lookup.from,
      lookup.to,
    ].join('|'),
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
