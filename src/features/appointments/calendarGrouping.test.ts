import { describe, expect, it } from 'vitest';
import { combinedAppointmentChain } from './calendarGrouping';

function appointment(
  id: number,
  start: string,
  end: string,
  extras: Partial<{
    client_id: number;
    appointment_date: string;
    status: string;
  }> = {},
) {
  return {
    id,
    client_id: extras.client_id ?? 7,
    appointment_date: extras.appointment_date ?? '2026-08-20',
    start_time: start,
    end_time: end,
    status: extras.status ?? '02',
  };
}

describe('combinedAppointmentChain', () => {
  it('returns every back-to-back appointment in the same block', () => {
    const appointments = [
      appointment(1, '09:00:00', '09:25:00'),
      appointment(2, '09:25:00', '09:50:00'),
      appointment(3, '11:00:00', '11:30:00'),
    ];

    expect(combinedAppointmentChain(appointments, 2).map((item) => item.id)).toEqual([
      1, 2,
    ]);
    expect(combinedAppointmentChain(appointments, 3).map((item) => item.id)).toEqual([
      3,
    ]);
  });

  it('does not cross a gap, another client, or a canceled appointment', () => {
    const appointments = [
      appointment(1, '09:00:00', '09:25:00'),
      appointment(2, '09:25:00', '09:40:00', { status: '10' }),
      appointment(3, '09:40:00', '10:00:00'),
      appointment(4, '09:00:00', '09:25:00', { client_id: 8 }),
    ];

    expect(combinedAppointmentChain(appointments, 1).map((item) => item.id)).toEqual([
      1,
    ]);
    expect(combinedAppointmentChain(appointments, 3).map((item) => item.id)).toEqual([
      3,
    ]);
  });
});
