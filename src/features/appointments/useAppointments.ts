import { useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { useAsyncResource } from '../../shared/hooks/useAsyncResource';
import {
  getAppointments,
  getBusinessCalendarSettings,
} from './appointments.api';
import { getStatuses } from '../settings/settings.api';
import { toCalendarEvents } from './appointments.mappers';
import {
  resolveStatusCatalog,
  type StatusCatalogItem,
} from './appointmentStatuses';
import type {
  AppointmentWithClient,
  BusinessCalendarSettings,
} from './appointments.types';

const EMPTY_APPOINTMENTS: AppointmentWithClient[] = [];
const EMPTY_STATUSES: StatusCatalogItem[] = [];
const EMPTY_CALENDAR_SETTINGS: BusinessCalendarSettings = {
  workingHours: null,
  slotDurationMinutes: null,
  maxAdvBookingDays: null,
  timezone: null,
};

interface AppointmentsData {
  appointments: AppointmentWithClient[];
  statuses: StatusCatalogItem[];
}

const EMPTY_APPOINTMENTS_DATA: AppointmentsData = {
  appointments: EMPTY_APPOINTMENTS,
  statuses: EMPTY_STATUSES,
};

export function useAppointments(businessCode: string) {
  const load = useCallback(async () => {
    const [appointments, statusRows] = await Promise.all([
      getAppointments(businessCode),
      getStatuses(businessCode),
    ]);

    return {
      appointments,
      statuses: resolveStatusCatalog(statusRows),
    };
  }, [businessCode]);
  const resource = useAsyncResource({
    resourceKey: businessCode,
    load,
    initialData: EMPTY_APPOINTMENTS_DATA,
    errorMessage: 'לא ניתן לטעון את התורים. נסה לרענן את היומן.',
    logLabel: 'שגיאה בשליפת תורים',
  });
  const refreshRef = useRef(resource.refresh);

  useEffect(() => {
    refreshRef.current = resource.refresh;
  }, [resource.refresh]);

  useEffect(() => {
    let timeoutId: number | undefined;
    const scheduleRefresh = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        refreshRef.current();
      }, 250);
    };

    const channel = supabase
      .channel(`appointments-${businessCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `business_code=eq.${businessCode}`,
        },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointment_services',
          filter: `business_code=eq.${businessCode}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      window.clearTimeout(timeoutId);
      void supabase.removeChannel(channel);
    };
  }, [businessCode]);

  const events = useMemo(
    () => toCalendarEvents(resource.data.appointments, resource.data.statuses),
    [resource.data.appointments, resource.data.statuses],
  );

  return {
    appointments: resource.data.appointments,
    statuses: resource.data.statuses,
    events,
    error: resource.error,
    isLoading: resource.isLoading,
    refresh: resource.refresh,
  };
}

export function useCalendarSettings(businessCode: string) {
  const load = useCallback(
    () => getBusinessCalendarSettings(businessCode),
    [businessCode],
  );

  return useAsyncResource({
    resourceKey: businessCode,
    load,
    initialData: EMPTY_CALENDAR_SETTINGS,
    errorMessage: 'לא ניתן לטעון את שעות הפעילות.',
    logLabel: 'שגיאה בשליפת שעות פעילות',
  });
}
