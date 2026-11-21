import { useCallback } from 'react';
import { getStatuses } from '../settings/settings.api';
import { useAsyncResource } from '../../shared/hooks/useAsyncResource';
import type { StatusCatalogItem } from '../appointments/appointmentStatuses';
import { nowInTimeZone } from '../appointments/time';
import { getBusinessTimeZone, getStatsAppointments } from './stats.api';
import { statsRange } from './stats.range';
import type { StatsAppointment, StatsPeriod } from './stats.types';

const EMPTY_ROWS: StatsAppointment[] = [];
const EMPTY_STATUSES: StatusCatalogItem[] = [];
const EMPTY_RANGE = { from: '', to: '' };
const EMPTY_STATS = { rows: EMPTY_ROWS, statuses: EMPTY_STATUSES, range: EMPTY_RANGE };

export function useStats(businessCode: string, period: StatsPeriod) {
  const load = useCallback(async () => {
    const zone = await getBusinessTimeZone(businessCode);
    const range = statsRange(period, nowInTimeZone(zone));
    const [rows, statuses] = await Promise.all([
      getStatsAppointments(businessCode, range.from, range.to),
      getStatuses(businessCode),
    ]);
    return { rows, statuses, range };
  }, [businessCode, period]);

  const resource = useAsyncResource({
    resourceKey: `${businessCode}:${period}`,
    load,
    initialData: EMPTY_STATS,
    errorMessage: 'לא ניתן לטעון את הסטטיסטיקה.',
    logLabel: 'שגיאה בטעינת סטטיסטיקה',
  });

  return { ...resource, range: resource.data.range };
}
