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
