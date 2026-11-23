import { isCanceledStatus } from './appointmentStatuses';
import { parseTimeToMinutes } from './time';

export type GroupRole = 'single' | 'start' | 'middle' | 'end';

export interface GroupableEvent {
  eventId: string;
  clientId: number;
  date: string;
  startMinutes: number;
  endMinutes: number;
}

export function assignGroupRoles(
  events: GroupableEvent[],
): Map<string, GroupRole> {
  const sorted = [...events].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    if (left.startMinutes !== right.startMinutes) {
      return left.startMinutes - right.startMinutes;
    }

    return left.eventId.localeCompare(right.eventId);
  });

  const roles = new Map<string, GroupRole>();
  let index = 0;

  while (index < sorted.length) {
    let endIndex = index;

    while (
      endIndex + 1 < sorted.length &&
      sorted[endIndex + 1].clientId === sorted[index].clientId &&
      sorted[endIndex + 1].date === sorted[index].date &&
      sorted[endIndex + 1].startMinutes === sorted[endIndex].endMinutes
    ) {
      endIndex += 1;
    }

    if (index === endIndex) {
      roles.set(sorted[index].eventId, 'single');
    } else {
      for (let cursor = index; cursor <= endIndex; cursor += 1) {
        if (cursor === index) {
          roles.set(sorted[cursor].eventId, 'start');
        } else if (cursor === endIndex) {
          roles.set(sorted[cursor].eventId, 'end');
        } else {
          roles.set(sorted[cursor].eventId, 'middle');
        }
      }
    }

    index = endIndex + 1;
  }

  return roles;
}

interface ChainAppointment {
  id: number;
  client_id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

export function combinedAppointmentChain<T extends ChainAppointment>(
  appointments: T[],
  selectedId: number,
): T[] {
  const selected = appointments.find((item) => item.id === selectedId);
  if (!selected || isCanceledStatus(selected.status)) {
    return selected ? [selected] : [];
  }

  const day = appointments
    .filter(
      (item) =>
        !isCanceledStatus(item.status) &&
        item.client_id === selected.client_id &&
        item.appointment_date === selected.appointment_date,
    )
    .sort((left, right) => {
      const byStart =
        parseTimeToMinutes(left.start_time) - parseTimeToMinutes(right.start_time);
      return byStart || left.id - right.id;
    });

  const index = day.findIndex((item) => item.id === selectedId);
  if (index < 0) return [selected];

  let start = index;
  while (
    start > 0 &&
    parseTimeToMinutes(day[start].start_time) ===
      parseTimeToMinutes(day[start - 1].end_time)
  ) {
    start -= 1;
  }

  let end = index;
  while (
    end + 1 < day.length &&
    parseTimeToMinutes(day[end + 1].start_time) ===
      parseTimeToMinutes(day[end].end_time)
  ) {
    end += 1;
  }

  return day.slice(start, end + 1);
}

export function allowCalendarEventOverlap(input: {
  stillDisplay?: string;
  stillAppointmentId?: number;
  movingAppointmentId?: number;
  movingStartUnchanged?: boolean;
  continuationIds?: number[];
}) {
  if (input.stillDisplay === 'background') return true;
  if (
    input.movingStartUnchanged &&
    input.stillAppointmentId != null &&
    input.continuationIds?.includes(input.stillAppointmentId)
  ) {
    return true;
  }
  return (
    input.stillAppointmentId != null &&
    input.stillAppointmentId === input.movingAppointmentId
  );
}
