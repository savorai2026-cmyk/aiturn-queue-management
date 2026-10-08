import { describe, expect, it } from 'vitest';
import { applyBillingHold, cardStanding, resolveBusinessAccess } from './cardStanding';

const NOW = new Date('2026-10-07T12:00:00+03:00');

describe('billing hold overrides the card rule', () => {
  const open = cardStanding({
    hasActiveCard: false,
    cardExp: null,
    businessCreatedAt: '2026-01-01T00:00:00+03:00',
    now: NOW,
  });

  it('keeps a test business open when the hold is exempt', () => {
    expect(applyBillingHold('exempt', open).stage).toBe('ok');
  });

  it('forces a block without using the active flag', () => {
    expect(applyBillingHold('blocked', open).stage).toBe('blocked');
  });

  it('can stop both agents while the business stays open', () => {
    const view = resolveBusinessAccess({
      hold: 'agents',
      isActive: true,
      standing: open,
    });
    expect(view?.dashboardBlocked).toBe(false);
    expect(view?.message).toContain('וואטסאפ');
  });

  it('stops both agents when the business is marked inactive', () => {
    const view = resolveBusinessAccess({
      hold: 'exempt',
      isActive: false,
      standing: { stage: 'ok', daysLeft: null, daysUntilBlock: null },
    });
    expect(view?.dashboardBlocked).toBe(false);
    expect(view?.message).toContain('לא פעיל');
  });
});

describe('card standing for one business', () => {
  it('warns 30, 15 and 5 days before the card stops being valid', () => {
    expect(stage('1026')).toBe('d30');
    expect(stage('1226')).toBe('ok');
    expect(stageOn('2026-10-20T12:00:00+03:00', '1026')).toBe('d15');
    expect(stageOn('2026-10-28T12:00:00+03:00', '1026')).toBe('d5');
  });

  it('stops the grace period seven days after expiry', () => {
    expect(stageOn('2026-11-01T12:00:00+03:00', '1026')).toBe('expired');
    expect(stageOn('2026-11-08T12:00:00+03:00', '1026')).toBe('blocked');
  });

  it('treats a missing card like an expired one, and blocks after seven days', () => {
    expect(
      cardStanding({
        hasActiveCard: false,
        cardExp: null,
        businessCreatedAt: '2026-10-05T08:00:00+03:00',
        now: NOW,
      }).stage,
    ).toBe('expired');
    expect(
      cardStanding({
        hasActiveCard: false,
        cardExp: null,
        businessCreatedAt: '2026-09-01T08:00:00+03:00',
        now: NOW,
      }).stage,
    ).toBe('blocked');
  });
});

function stage(cardExp: string) {
  return stageOn(NOW.toISOString(), cardExp);
}

function stageOn(now: string, cardExp: string) {
  return cardStanding({
    hasActiveCard: true,
    cardExp,
    businessCreatedAt: '2026-01-01T00:00:00+03:00',
    now: new Date(now),
  }).stage;
}
