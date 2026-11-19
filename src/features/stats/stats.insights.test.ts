import { describe, expect, it } from 'vitest';
import { buildClientInsights } from './stats.insights';
import type { StatsAppointment } from './stats.types';

function row(overrides: Partial<StatsAppointment> = {}): StatsAppointment {
  return {
    clientId: 1,
    clientName: 'דנה',
    date: '2026-11-18',
    startTime: '09:00:00',
    status: '03',
    channel: 'manual',
    price: 100,
    serviceTitles: ['טיפול'],
    ...overrides,
  };
}

describe('buildClientInsights', () => {
  it('lists repeat cancellers and a cautious suggestion', () => {
    const insights = buildClientInsights([
      row({ status: '10' }),
      row({ status: '10', date: '2026-11-17' }),
      row({ clientId: 2, clientName: 'יוסי', status: '03' }),
    ]);

    const cancellers = insights.groups.find((group) => group.key === 'cancellers');
    expect(cancellers?.people.map((person) => person.name)).toEqual(['דנה']);
    expect(insights.advice.some((item) => item.key === 'deposit')).toBe(true);
  });

  it('does not treat a single cancellation as a pattern', () => {
    const insights = buildClientInsights([
      row({ status: '10' }),
      row({ clientId: 2, clientName: 'יוסי', status: '03' }),
    ]);

    expect(insights.groups.find((group) => group.key === 'cancellers')).toBeUndefined();
  });

  it('lists loyal clients who finish appointments without cancelling', () => {
    const insights = buildClientInsights([
      row({ status: '03' }),
      row({ status: '03', date: '2026-11-17' }),
      row({ clientId: 2, clientName: 'יוסי', status: '03' }),
      row({ clientId: 2, clientName: 'יוסי', status: '10', date: '2026-11-17' }),
    ]);

    const loyal = insights.groups.find((group) => group.key === 'loyal');
    expect(loyal?.people.map((person) => person.name)).toEqual(['דנה']);
    expect(insights.advice.some((item) => item.key === 'keep')).toBe(true);
  });

  it('stays empty when there is no pattern yet', () => {
    expect(buildClientInsights([])).toEqual({ groups: [], advice: [] });
    expect(buildClientInsights([row()]).advice).toEqual([]);
  });
});