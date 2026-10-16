import { describe, expect, it } from 'vitest';
import {
  callbackMatchesSession,
  commitTokenChargeRequest,
  createSessionRequest,
  decideCardSave,
  parseTestChargeAmount,
  readChargeResult,
  readCreatedSession,
  readToken,
} from './maxBilling';

describe('max billing', () => {
  it('opens a card-only Max page and keeps the key out of the cart', () => {
    const body = createSessionRequest({
      key: 'secret-key',
      uniqueId: '11111111-1111-4111-8111-111111111111',
      paymentType: 'validate',
      callbackUrl: 'https://example.com/callback',
      failureCallbackUrl: 'https://example.com/failure',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      failureRedirectUrl: 'https://example.com/failed',
    });

    expect(body.PaymentType).toBe('validate');
    expect(body.FocusType).toBe('CreditCardOnly');
    expect(body.ShowCart).toBe(false);
    expect(body.CreateInvoice).toBe(false);
    expect(body.NumberOfFailures).toBe(1);
    expect(body.CartItems[0]?.Amount).toBe(1);
    expect(JSON.stringify(body.CartItems)).not.toContain('secret-key');
    expect(body).not.toHaveProperty('CardNumber');
    expect(body).not.toHaveProperty('CVV');
  });

  it('saves a card only when Max returns a token', () => {
    const saved = decideCardSave({
      transactionSuccess: true,
      callback: {
        Token: 'b12163d2-d1a2-4cf9-b71c-1151825b450a',
        CardNum: '9001',
        ExpDate_MMYY: '07/26',
        ReferenceNumber: '12345679',
        HolderId: '123456780',
      },
    });

    expect(saved.outcome).toBe('saved');
    expect(saved.token).toBe('b12163d2-d1a2-4cf9-b71c-1151825b450a');
    expect(saved.last4).toBe('9001');
    expect(saved.expiry).toBe('0726');
    expect(saved.referenceNumber).toBe('12345679');
    expect(JSON.stringify(saved)).not.toContain('123456780');
  });

  it('reports a successful check that did not return a token', () => {
    const decision = decideCardSave({
      transactionSuccess: true,
      callback: { CardNum: '9001', ExpDate_MMYY: '0726' },
    });

    expect(decision.outcome).toBe('no_token');
    expect(decision.token).toBeNull();
    expect(decision.errorText).toContain('לא החזירה טוקן');
  });

  it('rejects a callback that belongs to another session', () => {
    expect(
      callbackMatchesSession({
        uniqueId: '11111111-1111-4111-8111-111111111111',
        providerSessionId: 'session-a',
        callback: { UniqueID: '22222222-2222-4222-8222-222222222222' },
      }),
    ).toBe(false);
  });

  it('charges a saved token without card details', () => {
    const body = commitTokenChargeRequest({
      terminalNumber: '0882016016',
      password: 'terminal-secret',
      token: 'b12163d2-d1a2-4cf9-b71c-1151825b450a',
      amountIls: 1,
      uniqueId: 'qgent-1',
    });

    expect(body.CardNumber).toBe('b12163d2-d1a2-4cf9-b71c-1151825b450a');
    expect(body.TransactionSum).toBe(1);
    expect(body.IsCustomerPresent).toBe(false);
    expect(body.J).toBe(0);
    expect(body).not.toHaveProperty('CVV');
    expect(body).not.toHaveProperty('ExpDate_MMYY');
  });

  it('reads a charge approval and hides a full card number', () => {
    const result = readChargeResult({
      HasError: false,
      ReturnCode: 0,
      ApprovalNumber: '0543140',
      ReferenceNumber: '99',
      CardNumber: '4580000000009001',
      Card4Digits: '9001',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.last4).toBe('9001');
      expect(result.approvalNumber).toBe('0543140');
      expect(JSON.stringify(result)).not.toContain('4580000000009001');
    }
  });

  it('rejects a declined session and an out-of-range test amount', () => {
    expect(
      readCreatedSession({ HasError: true, ReturnMessage: 'bad key' }).error,
    ).toBe('bad key');
    expect(parseTestChargeAmount(1)).toBe(1);
    expect(parseTestChargeAmount(10)).toBe(10);
    expect(parseTestChargeAmount(0.5)).toBeNull();
    expect(parseTestChargeAmount(11)).toBeNull();
    expect(readToken('not-a-token')).toBeNull();
  });
});
