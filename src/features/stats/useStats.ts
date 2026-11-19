import { useCallback, useMemo } from 'react';
import { getStatuses } from '../settings/settings.api';
import { useAsyncResource } from '../../shared/hooks/useAsyncResource';
import type { StatusCatalogItem } from '../appointments/appointmentStatuses';
import { getStatsAppointments } from './stats.api';
import { statsRange } from './stats.range';
import type { StatsAppointment, StatsPeriod } from './stats.types';

const EMPTY_ROWS: StatsAppointment[] = [];
const EMPTY_STATUSES: StatusCatalogItem[] = [];
const EMPTY_STATS = { rows: EMPTY_ROWS, statuses: EMPTY_STATUSES };

export function useStats(businessCode: string, period: StatsPeriod) {
  const range = useMemo(() => statsRange(period), [period]);
  const load = useCallback(async () => {
    const [rows, statuses] = await Promise.all([
      getStatsAppointments(businessCode, range.from, range.to),
      getStatuses(businessCode),
    ]);
    return { rows, statuses };
  }, [businessCode, range.from, range.to]);

  const resource = useAsyncResource({
    resourceKey: `${businessCode}:${range.from}:${range.to}`,
    load,
    initialData: EMPTY_STATS,
    errorMessage: 'לא ניתן לטעון את הסטטיסטיקה.',
    logLabel: 'שגיאה בטעינת סטטיסטיקה',
  });

  return { ...resource, range };
}
