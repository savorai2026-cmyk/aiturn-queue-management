import { describe, expect, it } from 'vitest';
import { pickDefaultAppointment } from './pickDefaultAppointment';

function appointment(
  id: number,
  date: string,
  start: string,
  end: string,
  status = 'scheduled',
) {
  return {
    id,
    appointment_date: date,
    start_time: `${start}:00`,
    end_time: `${end}:00`,
    status,
  };
}

const NOW = new Date(2026, 7, 26, 12, 0, 0, 0);

describe('pickDefaultAppointment', () => {
  it('selects the nearest appointment that has not ended yet', () => {
    const picked = pickDefaultAppointment(
      [
        appointment(1, '2026-08-26', '09:00', '10:00'),
        appointment(2, '2026-08-26', '13:00', '14:00'),
        appointment(3, '2026-08-26', '16:00', '17:00'),
      ],
      NOW,
    );

    expect(picked?.id).toBe(2);
  });

  it('prefers an in-progress appointment over a later one', () => {
    const picked = pickDefaultAppointment(
      [
        appointment(1, '2026-08-26', '11:30', '12:30'),
        appointment(2, '2026-08-26', '13:00', '14:00'),
      ],
      NOW,
    );

    expect(picked?.id).toBe(1);
  });

  it('skips canceled upcoming appointments', () => {
    const picked = pickDefaultAppointment(
      [
        appointment(1, '2026-08-26', '13:00', '14:00', 'canceled'),
        appointment(2, '2026-08-26', '15:00', '16:00'),
      ],
      NOW,
    );

    expect(picked?.id).toBe(2);
  });

  it('selects the last appointment when nothing upcoming remains', () => {
    const picked = pickDefaultAppointment(
      [
        appointment(1, '2026-08-24', '09:00', '10:00'),
        appointment(2, '2026-08-25', '18:00', '19:00'),
        appointment(3, '2026-08-25', '11:00', '12:00', 'canceled'),
      ],
      NOW,
    );

    expect(picked?.id).toBe(2);
  });

  it('returns null when every appointment is canceled', () => {
    expect(
      pickDefaultAppointment(
        [appointment(1, '2026-08-26', '13:00', '14:00', 'canceled')],
        NOW,
      ),
    ).toBeNull();
  });
});
