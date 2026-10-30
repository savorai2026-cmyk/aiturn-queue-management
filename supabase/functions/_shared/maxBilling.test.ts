import { describe, expect, it } from 'vitest';
import {
  callbackFromStatus,
  callbackMatchesSession,
  commitTokenChargeRequest,
  createSessionRequest,
  decideCardSave,
  interpretSessionStatus,
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
    expect(body.NumberOfFailures).toBe(3);
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

  it('reads the hosted page url from the Data wrapper Max returns', () => {
    const created = readCreatedSession({
      Data: {
        HasError: false,
        ReturnCode: 0,
        SessionId: 'session-1',
        SessionUrl: 'https://pci.zcredit.co.il/webcheckout/session-1',
      },
    });

    expect(created).toEqual({
      sessionId: 'session-1',
      sessionUrl: 'https://pci.zcredit.co.il/webcheckout/session-1',
    });
  });

  it('reads a Max error nested in Data and a token returned beside CallBackJSON', () => {
    expect(
      readCreatedSession({
        Data: { HasError: true, ReturnMessage: 'bad key' },
      }).error,
    ).toBe('bad key');

    const callback = callbackFromStatus({
      HasError: false,
      TransactionSuccess: true,
      Token: 'b12163d2-d1a2-4cf9-b71c-1151825b450a',
      CardNum: '9001',
      UniqueID: '11111111-1111-4111-8111-111111111111',
    });

    expect(callback?.Token).toBe('b12163d2-d1a2-4cf9-b71c-1151825b450a');
    expect(
      callbackFromStatus({
        Data: {
          CallBackJSON: JSON.stringify({
            Token: 'b12163d2-d1a2-4cf9-b71c-1151825b450a',
          }),
        },
      })?.Token,
    ).toBe('b12163d2-d1a2-4cf9-b71c-1151825b450a');
  });

  it('saves the posted callback after GetSessionStatus confirms it', () => {
    const uniqueId = '11111111-1111-4111-8111-111111111111';
    const providerSessionId = '333a569cf6a95e294d55d36fc33172';
    const decision = interpretSessionStatus({
      uniqueId,
      providerSessionId,
      statusBody: {
        HasError: false,
        ReturnCode: 0,
        SessionId: providerSessionId,
        CallBackJSON: '',
        TransactionSuccess: true,
      },
      postedBody: {
        SessionId: providerSessionId,
        UniqueID: uniqueId,
        Token: 'b12163d2-d1a2-4cf9-b71c-1151825b450a',
        CardNum: '9001',
        ExpDate_MMYY: '07/26',
        ReferenceNumber: '12345679',
        HolderId: '123456780',
      },
    });

    expect(decision.action).toBe('save');
    if (decision.action === 'save') {
      expect(decision.token).toBe('b12163d2-d1a2-4cf9-b71c-1151825b450a');
      expect(decision.last4).toBe('9001');
    }
  });

  it('keeps a decline pending until the hosted page itself finishes', () => {
    const decision = interpretSessionStatus({
      uniqueId: '11111111-1111-4111-8111-111111111111',
      providerSessionId: '333a569cf6a95e294d55d36fc33172',
      statusBody: {
        HasError: false,
        ReturnCode: 0,
        SessionId: '333a569cf6a95e294d55d36fc33172',
        CallBackJSON: '',
        TransactionSuccess: false,
      },
      postedBody: {
        SessionId: '333a569cf6a95e294d55d36fc33172',
        UniqueID: '11111111-1111-4111-8111-111111111111',
        CardNum: '9001',
        ReturnCode: 4,
        ReturnMessage: 'העסקה לא אושרה',
      },
    });

    expect(decision).toEqual({
      action: 'decline',
      errorText: 'העסקה לא אושרה',
    });
  });

  it('waits when Max has not finished the transaction', () => {
    expect(
      interpretSessionStatus({
        uniqueId: '11111111-1111-4111-8111-111111111111',
        providerSessionId: '333a569cf6a95e294d55d36fc33172',
        statusBody: {
          HasError: false,
          ReturnCode: 0,
          SessionId: '333a569cf6a95e294d55d36fc33172',
          CallBackJSON: '',
          TransactionSuccess: false,
        },
        postedBody: null,
      }).action,
    ).toBe('retry');
  });

  it('reads a token from CallBackJSON while polling session status', () => {
    const decision = interpretSessionStatus({
      uniqueId: '11111111-1111-4111-8111-111111111111',
      providerSessionId: '333a569cf6a95e294d55d36fc33172',
      postedBody: null,
      statusBody: {
        HasError: false,
        ReturnCode: 0,
        SessionId: '333a569cf6a95e294d55d36fc33172',
        TransactionSuccess: true,
        CallBackJSON: JSON.stringify({
          Token: 'b12163d2-d1a2-4cf9-b71c-1151825b450a',
          CardNum: '9001',
          UniqueID: '11111111-1111-4111-8111-111111111111',
        }),
      },
    });

    expect(decision.action).toBe('save');
  });

  it('saves a validate token returned in CallBackJSON before TransactionSuccess', () => {
    const decision = interpretSessionStatus({
      uniqueId: '11111111-1111-4111-8111-111111111111',
      providerSessionId: '333a569cf6a95e294d55d36fc33172',
      postedBody: {
        SessionId: '333a569cf6a95e294d55d36fc33172',
        Token: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
      statusBody: {
        HasError: false,
        ReturnCode: 0,
        SessionId: '333a569cf6a95e294d55d36fc33172',
        TransactionSuccess: false,
        CallBackJSON: JSON.stringify({
          Token: 'b12163d2-d1a2-4cf9-b71c-1151825b450a',
          CardNum: '9001',
          J: 2,
          UniqueID: '11111111-1111-4111-8111-111111111111',
        }),
      },
    });

    expect(decision.action).toBe('save');
    if (decision.action === 'save') {
      expect(decision.token).toBe('b12163d2-d1a2-4cf9-b71c-1151825b450a');
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
