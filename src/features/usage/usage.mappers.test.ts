import { describe, expect, it } from 'vitest';
import {
  filterAndSortUsageEvents,
  findUsagePrice,
  formatCreditAmount,
  formatCredits,
  formatBillingCurrency,
  formatUnitPrice,
  formatUsageAction,
  formatUsageEventCell,
  formatUsageMeta,
  formatUsageUnit,
  summarizeUsage,
} from './usage.mappers';
import type { UsageEvent } from './usage.types';

const EVENT: UsageEvent = {
  id: 'evt-1',
  businessCode: 'biz-1',
  action: 'whatsapp_outbound',
  quantity: 2,
  unit: 'message',
  amountCredits: 2,
  meta: { to: '0501234567' },
  createdAt: '2026-09-20T07:00:00.000Z',
};

describe('usage mappers', () => {
  it('uses Hebrew labels for known actions and units', () => {
    expect(formatUsageAction('vapi_call_seconds')).toBe('שיחה קולית');
    expect(formatUsageAction('custom_action')).toBe('custom_action');
    expect(formatUsageUnit('second')).toBe('שנייה');
    expect(formatUsageUnit('call')).toBe('call');
  });

  it('formats credits without trailing zeros when possible', () => {
    expect(formatCredits(20)).toBe('20');
    expect(formatCredits(22.1412)).toBe('22.1412');
    expect(formatCreditAmount(20)).toBe('20 קרדיטים');
    expect(formatBillingCurrency('ILS')).toBe('₪ שקלים');
    expect(formatBillingCurrency('credits')).toBe('לא צוין');
  });

  it('groups events by action and unit and totals credits', () => {
    const summary = summarizeUsage([
      EVENT,
      {
        ...EVENT,
        id: 'evt-2',
        action: 'vapi_call_seconds',
        unit: 'second',
        quantity: 40,
        amountCredits: 12.5,
      },
      {
        ...EVENT,
        id: 'evt-3',
        amountCredits: 1,
        quantity: 1,
      },
    ]);

    expect(summary.totalCredits).toBe(15.5);
    expect(summary.byAction).toEqual([
      {
        action: 'vapi_call_seconds',
        unit: 'second',
        count: 1,
        quantity: 40,
        credits: 12.5,
      },
      {
        action: 'whatsapp_outbound',
        unit: 'message',
        count: 2,
        quantity: 3,
        credits: 3,
      },
    ]);
  });

  it('formats a history cell including extra fields', () => {
    expect(formatUsageEventCell(EVENT, 'action')).toBe('WhatsApp יוצא');
    expect(formatUsageEventCell(EVENT, 'quantity')).toBe('2');
    expect(formatUsageEventCell(EVENT, 'amountCredits')).toBe('2');
    expect(formatUsageEventCell(EVENT, 'id')).toBe('evt-1');
    expect(formatUsageEventCell(EVENT, 'businessCode')).toBe('biz-1');
    expect(formatUsageMeta(EVENT.meta)).toContain('0501234567');
  });

  it('formats a catalog unit price', () => {
    const price = {
      action: 'whatsapp_outbound',
      unit: 'message',
      amountCredits: 0.5,
    };
    expect(findUsagePrice([price], 'whatsapp_outbound', 'message')).toEqual(
      price,
    );
    expect(formatUnitPrice(price)).toBe('0.5 קרדיטים / הודעה');
    expect(formatUnitPrice(null)).toBe('—');
  });

  it('filters and sorts history events', () => {
    const later = {
      ...EVENT,
      id: 'evt-2',
      action: 'vapi_call_seconds',
      unit: 'second',
      amountCredits: 12.5,
      createdAt: '2026-09-21T07:00:00.000Z',
    };

    expect(
      filterAndSortUsageEvents([EVENT, later], { action: 'קול' }, null).map(
        (event) => event.id,
      ),
    ).toEqual(['evt-2']);

    expect(
      filterAndSortUsageEvents(
        [EVENT, later],
        {},
        { key: 'amountCredits', direction: 'desc' },
      ).map((event) => event.id),
    ).toEqual(['evt-2', 'evt-1']);
  });
});
