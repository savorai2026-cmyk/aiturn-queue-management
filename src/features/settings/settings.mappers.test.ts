import { describe, expect, it } from 'vitest';
import { formatStatusCell } from './settings.mappers';
import type { AppointmentStatusRow } from './settings.types';

const STATUS: AppointmentStatusRow = {
  business_code: 'biz-1',
  status_code: 'scheduled',
  status_text: 'מתוזמן',
  color: '#0d9488',
  created_at: '2026-08-20T08:00:00.000Z',
};

describe('formatStatusCell', () => {
  it('formats visible status fields', () => {
    expect(formatStatusCell(STATUS, 'status_code')).toBe('scheduled');
    expect(formatStatusCell(STATUS, 'status_text')).toBe('מתוזמן');
    expect(formatStatusCell(STATUS, 'color')).toBe('#0d9488');
  });

  it('falls back when color is missing', () => {
    expect(formatStatusCell({ ...STATUS, color: null }, 'color')).toBe(
      'לא הוגדר',
    );
  });
});
