import { describe, expect, it } from 'vitest';
import {
  formatBusinessField,
  formatStatusCell,
  filterAndSortServices,
  filterAndSortStatuses,
  normalizeDepositPercent,
  parseDepositPercent,
  normalizeRetentionDays,
} from './settings.mappers';
import type { AppointmentStatusRow, BusinessSettings, Service } from './settings.types';

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

describe('deposit percent', () => {
  it('parses numeric strings from Postgres and rejects out of range', () => {
    expect(parseDepositPercent('20.50')).toBe(20.5);
    expect(parseDepositPercent(null)).toBe(0);
    expect(normalizeDepositPercent('')).toBe(0);
    expect(normalizeDepositPercent('15')).toBe(15);
    expect(normalizeDepositPercent(12.345)).toBe(12.35);
    expect(normalizeDepositPercent(101)).toBeNull();
    expect(normalizeDepositPercent(-1)).toBeNull();
    expect(normalizeDepositPercent('x')).toBeNull();
  });

  it('accepts recording retention between 1 and 3650 days', () => {
    expect(normalizeRetentionDays('')).toBe(90);
    expect(normalizeRetentionDays(30)).toBe(30);
    expect(normalizeRetentionDays(0)).toBeNull();
    expect(normalizeRetentionDays(3651)).toBeNull();
  });

  it('formats the business percent for details', () => {
    const business = {
      deposit_percent: 20,
    } as BusinessSettings;

    expect(formatBusinessField(business, 'deposit_percent')).toBe('20%');
    expect(
      formatBusinessField({ ...business, deposit_percent: 12.5 }, 'deposit_percent'),
    ).toBe('12.5%');
    expect(
      formatBusinessField(
        { ...business, agent_prompt: 'מספרה בתל אביב' } as BusinessSettings,
        'agent_prompt',
      ),
    ).toBe('מספרה בתל אביב');
  });
});

const SERVICE: Service = {
  buffer_time_minutes: 0,
  business_code: 'biz-1',
  color_code: null,
  created_at: null,
  deposit_amount: 0,
  description: null,
  duration_minutes: 30,
  id: 1,
  is_active: true,
  price: 120,
  service_code: 'cut',
  title: 'תספורת גברים',
  updated_at: null,
};

describe('filterAndSortServices', () => {
  const cut = SERVICE;
  const color = {
    ...SERVICE,
    id: 2,
    title: 'צביעה',
    price: 280,
    is_active: false,
  };

  it('filters each column independently and combines them', () => {
    const rows = filterAndSortServices(
      [cut, color],
      { title: 'תספורת', price: '120', is_active: 'active' },
      null,
    );
    expect(rows.map((row) => row.id)).toEqual([1]);
  });

  it('uses exact price and status dropdown values', () => {
    expect(
      filterAndSortServices([cut, color], { price: '80' }, null),
    ).toEqual([]);
    expect(
      filterAndSortServices([cut, color], { price: '280' }, null).map(
        (row) => row.id,
      ),
    ).toEqual([2]);
    expect(
      filterAndSortServices([cut, color], { is_active: 'inactive' }, null).map(
        (row) => row.id,
      ),
    ).toEqual([2]);
  });

  it('sorts by the selected column', () => {
    const byPrice = filterAndSortServices([color, cut], {}, {
      key: 'price',
      direction: 'asc',
    });
    expect(byPrice.map((row) => row.id)).toEqual([1, 2]);

    const byTitle = filterAndSortServices([color, cut], {}, {
      key: 'title',
      direction: 'desc',
    });
    expect(byTitle.map((row) => row.title)).toEqual(['תספורת גברים', 'צביעה']);
  });
});

describe('filterAndSortStatuses', () => {
  it('filters and sorts status rows', () => {
    const waiting = { ...STATUS, status_code: '01', status_text: 'ממתין' };
    const done = { ...STATUS, status_code: '02', status_text: 'הושלם' };

    expect(
      filterAndSortStatuses([waiting, done], { status_text: 'ממ' }, null).map(
        (row) => row.status_code,
      ),
    ).toEqual(['01']);

    expect(
      filterAndSortStatuses([done, waiting], {}, {
        key: 'status_text',
        direction: 'asc',
      }).map((row) => row.status_text),
    ).toEqual(['הושלם', 'ממתין']);
  });
});
