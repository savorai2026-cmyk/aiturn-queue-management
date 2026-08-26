import { isCanceledStatus } from './appointmentStatuses';
import { toLocalDateTimeMs } from './time';

interface PickableAppointment {
  id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

export function pickDefaultAppointment<T extends PickableAppointment>(
  appointments: T[],
  now: Date = new Date(),
): T | null {
  const candidates = appointments.filter(
    (appointment) => !isCanceledStatus(appointment.status),
  );

  if (candidates.length === 0) {
    return null;
  }

  const nowMs = now.getTime();
  const timed = candidates.map((appointment) => ({
    appointment,
    startMs: toLocalDateTimeMs(
      appointment.appointment_date,
      appointment.start_time,
    ),
    endMs: toLocalDateTimeMs(appointment.appointment_date, appointment.end_time),
  }));

  const upcoming = timed
    .filter((entry) => entry.endMs >= nowMs)
    .sort(
      (left, right) =>
        left.startMs - right.startMs ||
        left.appointment.id - right.appointment.id,
    );

  if (upcoming[0]) {
    return upcoming[0].appointment;
  }

  timed.sort(
    (left, right) =>
      right.startMs - left.startMs ||
      right.appointment.id - left.appointment.id,
  );

  return timed[0]?.appointment ?? null;
}
