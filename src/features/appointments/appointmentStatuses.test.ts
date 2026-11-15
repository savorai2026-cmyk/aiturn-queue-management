import { describe, expect, it } from 'vitest';
import {
  creatableStatuses,
  getStatusColor,
  getStatusLabel,
  isCanceledStatus,
  statusAfterBusinessMove,
  pickDefaultCreateStatus,
  readableTextColor,
  resolveStatusCatalog,
  withCurrentStatus,
} from './appointmentStatuses';

const CATALOG = [
  { status_code: '02', status_text: 'מתוזמן', color: '#0d9488' },
  { status_code: '01', status_text: 'ממתין', color: '#7c8b84' },
  { status_code: '10', status_text: 'מבוטל', color: '#b91c1c' },
];

describe('appointmentStatuses', () => {
  it('uses catalog colors and labels, with brand fallbacks', () => {
    expect(getStatusColor('01', CATALOG)).toBe('#7c8b84');
    expect(getStatusColor('waiting', CATALOG)).toBe('#7c8b84');
    expect(getStatusColor('02', CATALOG)).toBe('#0d9488');
    expect(getStatusColor('unknown', CATALOG)).toBe('#7c8b84');
    expect(getStatusLabel('10', CATALOG)).toBe('מבוטל');
    expect(getStatusLabel('09', CATALOG)).toBe('לא הגיע');
  });

  it('turns a business move into customer approval, and keeps a payment hold', () => {
    expect(statusAfterBusinessMove('02')).toBe('04');
    expect(statusAfterBusinessMove('scheduled')).toBe('04');
    expect(statusAfterBusinessMove('01')).toBe('04');
    expect(statusAfterBusinessMove('04')).toBe('04');
    expect(statusAfterBusinessMove('05')).toBe('05');
  });

  it('falls back to the brand catalog when the table is empty', () => {
    const resolved = resolveStatusCatalog([]);
    expect(resolved.map((item) => item.status_code)).toEqual([
      '01',
      '04',
      '05',
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

  it('keeps event text readable on its status color', () => {
    expect(readableTextColor('#0d9488')).toBe('#ffffff');
    expect(readableTextColor('#115e59')).toBe('#ffffff');
    expect(readableTextColor('not-a-color')).toBe('#ffffff');

    const onGold = readableTextColor('#ca8a04');
    expect(onGold).not.toBe('#ffffff');
    expect(onGold).toMatch(/^#[0-9a-f]{6}$/);
    expect(readableTextColor('#fb8e8e')).not.toBe('#ffffff');
  });
});
