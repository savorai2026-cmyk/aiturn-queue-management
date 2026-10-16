export const MAX_PROVIDER = 'max';

export const CREATE_SESSION_URL =
  'https://pci.zcredit.co.il/webcheckout/api/WebCheckout/CreateSession';

export const SESSION_STATUS_URL =
  'https://pci.zcredit.co.il/webcheckout/api/WebCheckout/GetSessionStatus';

export const COMMIT_TRANSACTION_URL =
  'https://pci.zcredit.co.il/ZCreditWS/api/Transaction/CommitFullTransaction';

export const SAVE_AMOUNT_ILS = 1;
export const TEST_CHARGE_MIN_ILS = 1;
export const TEST_CHARGE_MAX_ILS = 10;

const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SavePaymentType = 'validate' | 'regular';

export type CardSaveOutcome = 'saved' | 'no_token' | 'declined';

export interface CardSaveDecision {
  outcome: CardSaveOutcome;
  token: string | null;
  last4: string | null;
  expiry: string | null;
  referenceNumber: string | null;
  errorText: string | null;
}

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function parseSavePaymentType(value: unknown): SavePaymentType {
  return value === 'regular' ? 'regular' : 'validate';
}

export function parseTestChargeAmount(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.round(amount * 100) / 100;
  if (rounded < TEST_CHARGE_MIN_ILS || rounded > TEST_CHARGE_MAX_ILS) {
    return null;
  }
  return rounded;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function safeGatewayMessage(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  return text.replace(/\d{12,19}/g, '****').slice(0, 240);
}

export function isGatewayOk(record: Record<string, unknown>) {
  if (record.HasError === true) return false;
  const code = record.ReturnCode;
  if (code == null || code === '') return true;
  return Number(code) === 0;
}

export function last4FromCardNum(value: unknown) {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

export function expiryDigits(value: unknown) {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  if (digits.length < 4) return null;
  const month = digits.slice(0, 2);
  const year = digits.slice(-2);
  const monthNumber = Number(month);
  if (monthNumber < 1 || monthNumber > 12) return null;
  return `${month}${year}`;
}

export function readToken(value: unknown) {
  if (typeof value !== 'string') return null;
  const token = value.trim();
  return TOKEN_PATTERN.test(token) ? token : null;
}

export function readUniqueId(body: Record<string, unknown>) {
  const value = body.UniqueID ?? body.UniqueId ?? body.uniqueid ?? body.uniqueId;
  return typeof value === 'string' ? value.trim() : '';
}

export function parseCallbackJson(raw: unknown) {
  const direct = asRecord(raw);
  if (direct) return direct;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    return asRecord(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function functionUrl(
  supabaseUrl: string,
  name: string,
  params: Record<string, string>,
) {
  const url = new URL(`/functions/v1/${name}`, supabaseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function createSessionRequest(input: {
  key: string;
  uniqueId: string;
  paymentType: SavePaymentType;
  callbackUrl: string;
  failureCallbackUrl: string;
  successUrl: string;
  cancelUrl: string;
  failureRedirectUrl: string;
}) {
  return {
    Key: input.key,
    Local: 'He',
    UniqueId: input.uniqueId,
    SuccessUrl: input.successUrl,
    CancelUrl: input.cancelUrl,
    CallbackUrl: input.callbackUrl,
    FailureCallBackUrl: input.failureCallbackUrl,
    FailureRedirectUrl: input.failureRedirectUrl,
    NumberOfFailures: 1,
    PaymentType: input.paymentType,
    CreateInvoice: false,
    ShowCart: false,
    FocusType: 'CreditCardOnly',
    Installments: { Type: 'none', MinQuantity: 1, MaxQuantity: 1 },
    BitButtonEnabled: false,
    ApplePayButtonEnabled: false,
    GooglePayButtonEnabled: false,
    Customer: {
      Attributes: {
        HolderId: 'optional',
        Name: 'none',
        PhoneNumber: 'none',
        Email: 'none',
      },
    },
    CartItems: [
      {
        Amount: SAVE_AMOUNT_ILS,
        Currency: 'ILS',
        Name: 'QGent',
        Quantity: 1,
      },
    ],
  };
}

export function readCreatedSession(body: unknown):
  | { sessionId: string; sessionUrl: string }
  | { error: string } {
  const record = asRecord(body);
  if (!record) return { error: 'מקס לא החזירה תשובה תקינה.' };
  if (!isGatewayOk(record)) {
    return {
      error: safeGatewayMessage(record.ReturnMessage) || 'מקס לא פתחה דף תשלום.',
    };
  }

  const sessionId = typeof record.SessionId === 'string' ? record.SessionId.trim() : '';
  const sessionUrl = typeof record.SessionUrl === 'string' ? record.SessionUrl.trim() : '';
  if (!sessionId || !sessionUrl.startsWith('https://')) {
    return { error: 'מקס לא החזירה כתובת לדף התשלום.' };
  }

  return { sessionId, sessionUrl };
}

export function decideCardSave(input: {
  transactionSuccess: boolean;
  callback: Record<string, unknown> | null;
}): CardSaveDecision {
  const callback = input.callback ?? {};
  const token = readToken(callback.Token);
  const last4 = last4FromCardNum(callback.CardNum);
  const expiry = expiryDigits(callback.ExpDate_MMYY);
  const reference =
    typeof callback.ReferenceNumber === 'string'
      ? callback.ReferenceNumber.trim()
      : '';

  if (input.transactionSuccess && token) {
    return {
      outcome: 'saved',
      token,
      last4,
      expiry,
      referenceNumber: reference || null,
      errorText: null,
    };
  }

  if (input.transactionSuccess) {
    return {
      outcome: 'no_token',
      token: null,
      last4,
      expiry,
      referenceNumber: reference || null,
      errorText: 'מקס אישרה את הפעולה, אבל לא החזירה טוקן לחיוב חוזר.',
    };
  }

  return {
    outcome: 'declined',
    token: null,
    last4,
    expiry,
    referenceNumber: reference || null,
    errorText: 'מקס דחתה את שמירת הכרטיס.',
  };
}

export function callbackMatchesSession(input: {
  callback: Record<string, unknown> | null;
  uniqueId: string;
  providerSessionId: string;
}) {
  const callback = input.callback;
  if (!callback) return true;

  const echoedId = readUniqueId(callback);
  if (echoedId && echoedId !== input.uniqueId) return false;

  const echoedSession =
    typeof callback.SessionId === 'string' ? callback.SessionId.trim() : '';
  if (echoedSession && echoedSession !== input.providerSessionId) return false;

  return true;
}

export function commitTokenChargeRequest(input: {
  terminalNumber: string;
  password: string;
  token: string;
  amountIls: number;
  uniqueId: string;
}) {
  return {
    TerminalNumber: input.terminalNumber,
    Password: input.password,
    CardNumber: input.token,
    TransactionSum: input.amountIls,
    CurrencyType: 1,
    CreditType: 1,
    TransactionType: '01',
    J: 0,
    IsCustomerPresent: false,
    NumberOfPayments: 1,
    ItemDescription: 'QGent',
    TransactionUniqueID: input.uniqueId,
  };
}

export function readChargeResult(body: unknown):
  | {
      ok: true;
      approvalNumber: string;
      referenceNumber: string;
      last4: string | null;
    }
  | { ok: false; error: string } {
  const record = asRecord(body);
  if (!record) return { ok: false, error: 'מקס לא החזירה תשובה לחיוב.' };
  if (!isGatewayOk(record)) {
    return {
      ok: false,
      error: safeGatewayMessage(record.ReturnMessage) || 'מקס דחתה את החיוב.',
    };
  }

  const approval =
    typeof record.ApprovalNumber === 'string' ? record.ApprovalNumber.trim() : '';
  const reference =
    typeof record.ReferenceNumber === 'string' ? record.ReferenceNumber.trim() : '';

  return {
    ok: true,
    approvalNumber: approval,
    referenceNumber: reference,
    last4: last4FromCardNum(record.Card4Digits) ?? last4FromCardNum(record.CardNumber),
  };
}

export function billingReturnHtml(kind: 'success' | 'cancel' | 'failure' | 'missing') {
  const copy = {
    success: {
      title: 'אפשר לסגור את החלון',
      body: 'אם מקס אישרה את הכרטיס, השמירה תופיע במערכת תוך כמה שניות.',
    },
    cancel: {
      title: 'השמירה בוטלה',
      body: 'אפשר לסגור את החלון ולנסות שוב מהמערכת.',
    },
    failure: {
      title: 'השמירה לא הושלמה',
      body: 'אפשר לסגור את החלון ולנסות שוב מהמערכת.',
    },
    missing: {
      title: 'הקישור לא תקין',
      body: 'אפשר לסגור את החלון ולפתוח שמירת כרטיס מחדש.',
    },
  }[kind];

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${copy.title}</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 40px 24px; color: #073047;">
  <h1 style="font-size: 22px;">${copy.title}</h1>
  <p style="font-size: 16px; line-height: 1.5;">${copy.body}</p>
</body>
</html>`;
}
