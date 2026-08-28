export function parseTimeParts(
  value: string,
): { hours: number; minutes: number } | null {
  if (!value.trim()) return null;

  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return {
    hours: Math.min(23, Math.max(0, Math.trunc(hours))),
    minutes: Math.min(59, Math.max(0, Math.trunc(minutes))),
  };
}

export function formatTimeParts(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function minuteOptions(stepMinutes: number, currentMinutes?: number) {
  const step = stepMinutes > 0 ? stepMinutes : 5;
  const values = new Set<number>();

  for (let minute = 0; minute < 60; minute += step) {
    values.add(minute);
  }

  if (currentMinutes != null) {
    values.add(currentMinutes);
  }

  return [...values].sort((left, right) => left - right);
}
