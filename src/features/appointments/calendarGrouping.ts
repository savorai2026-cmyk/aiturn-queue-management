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
