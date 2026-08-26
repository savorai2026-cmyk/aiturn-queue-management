import { describe, expect, it } from 'vitest';
import {
  creatableStatuses,
  getStatusColor,
  getStatusLabel,
  isCanceledStatus,
  pickDefaultCreateStatus,
  resolveStatusCatalog,
  withCurrentStatus,
} from './appointmentStatuses';

const CATALOG = [
  { status_code: '02', status_text: 'מתוזמן', color: '#0d9488' },
  { status_code: '01', status_text: 'ממתין', color: '#607482' },
  { status_code: '10', status_text: 'מבוטל', color: '#b91c1c' },
];

describe('appointmentStatuses', () => {
  it('uses catalog colors and labels, with brand fallbacks', () => {
    expect(getStatusColor('01', CATALOG)).toBe('#607482');
    expect(getStatusColor('waiting', CATALOG)).toBe('#607482');
    expect(getStatusColor('02', CATALOG)).toBe('#0d9488');
    expect(getStatusColor('unknown', CATALOG)).toBe('#12648f');
    expect(getStatusLabel('10', CATALOG)).toBe('מבוטל');
    expect(getStatusLabel('09', CATALOG)).toBe('לא הגיע');
  });

  it('falls back to the brand catalog when the table is empty', () => {
    const resolved = resolveStatusCatalog([]);
    expect(resolved.map((item) => item.status_code)).toEqual([
      '01',
      '02',
      '03',
      '09',
      '10',
    ]);
  });

  it('keeps current unknown statuses in the select list', () => {
    const withCurrent = withCurrentStatus(CATALOG, 'custom');
    expect(withCurrent.some((item) => item.status_code === 'custom')).toBe(true);
  });

  it('picks an open status for new appointments', () => {
    expect(isCanceledStatus('10')).toBe(true);
    expect(isCanceledStatus('canceled')).toBe(true);
    expect(creatableStatuses(CATALOG).map((item) => item.status_code)).toEqual([
      '02',
      '01',
    ]);
    expect(pickDefaultCreateStatus(CATALOG).status_code).toBe('01');
  });
});
