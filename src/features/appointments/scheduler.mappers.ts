export interface SchedulerResponseBody {
  success?: boolean;
  action_required?: boolean;
  message?: string;
  user_message?: string;
  error?: string;
}

export function schedulerFailureMessage(body: SchedulerResponseBody): string {
  return (
    body.user_message ||
    body.message ||
    body.error ||
    'הפעולה נכשלה'
  );
}

export function isSchedulerSuccess(body: SchedulerResponseBody): boolean {
  if (body.action_required === true) return true;
  if (body.success === false) return false;
  return true;
}

export function collectSchedulerSlotValues(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [item.trim()];
    if (!item || typeof item !== 'object') return [];

    const record = item as Record<string, unknown>;
    for (const key of [
      'appointment_time',
      'datetime',
      'dateTime',
      'start',
      'time',
    ]) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return [value.trim()];
    }

    return [];
  });
}
