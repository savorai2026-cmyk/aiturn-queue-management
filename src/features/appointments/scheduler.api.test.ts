import { describe, expect, it } from 'vitest';
import {
  collectSchedulerSlotValues,
  isSchedulerSuccess,
  schedulerFailureMessage,
} from './scheduler.mappers';

describe('collectSchedulerSlotValues', () => {
  it('reads ISO strings, clock times, and object aliases from the OpenAPI payload', () => {
    expect(
      collectSchedulerSlotValues([
        '2026-09-10T10:00:00',
        '11:30',
        { appointment_time: '2026-09-10T12:00:00' },
        { start: '13:00' },
        { time: '14:15' },
        null,
        12,
      ]),
    ).toEqual([
      '2026-09-10T10:00:00',
      '11:30',
      '2026-09-10T12:00:00',
      '13:00',
      '14:15',
    ]);
  });

  it('returns an empty list when the field is missing', () => {
    expect(collectSchedulerSlotValues(undefined)).toEqual([]);
    expect(collectSchedulerSlotValues({ available_slots: [] })).toEqual([]);
  });
});

describe('isSchedulerSuccess', () => {
  it('treats action_required as success even when success is false', () => {
    expect(
      isSchedulerSuccess({ success: false, action_required: true }),
    ).toBe(true);
  });

  it('rejects an explicit unsuccessful payload', () => {
    expect(isSchedulerSuccess({ success: false, error: 'Missing required fields' })).toBe(
      false,
    );
    expect(
      schedulerFailureMessage({ success: false, error: 'Missing required fields' }),
    ).toBe('Missing required fields');
  });
});
