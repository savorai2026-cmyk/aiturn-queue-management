import { useCallback, useMemo } from 'react';
import { useAsyncResource } from '../../shared/hooks/useAsyncResource';
import { getAppointments } from './appointments.api';
import { toCalendarEvent } from './appointments.mappers';
import type { AppointmentWithClient } from './appointments.types';

const EMPTY_APPOINTMENTS: AppointmentWithClient[] = [];

export function useAppointments(businessCode: string) {
  const load = useCallback(
    () => getAppointments(businessCode),
    [businessCode],
  );
  const resource = useAsyncResource({
    resourceKey: businessCode,
    load,
    initialData: EMPTY_APPOINTMENTS,
    errorMessage: 'לא ניתן לטעון את התורים. נסה לרענן את היומן.',
    logLabel: 'שגיאה בשליפת תורים',
  });

  const events = useMemo(
    () => resource.data.map(toCalendarEvent),
    [resource.data],
  );

  return {
    appointments: resource.data,
    events,
    error: resource.error,
    isLoading: resource.isLoading,
    refresh: resource.refresh,
  };
}
