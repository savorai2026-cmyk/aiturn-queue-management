export type CardStage =
  | 'ok'
  | 'd30'
  | 'd15'
  | 'd5'
  | 'expired'
  | 'blocked';

const JERUSALEM = 'Asia/Jerusalem';
const BLOCK_AFTER_DAYS = 7;

export interface CardStanding {
  stage: CardStage;
  daysLeft: number | null;
  daysUntilBlock: number | null;
}

export function jerusalemToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: JERUSALEM,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function cardStanding(input: {
  hasActiveCard: boolean;
  cardExp: string | null;
  businessCreatedAt: string | null;
  now: Date;
}): CardStanding {
  const today = jerusalemToday(input.now);

  if (!input.hasActiveCard) {
    const created = input.businessCreatedAt
      ? jerusalemToday(new Date(input.businessCreatedAt))
      : today;
    const age = daysBetween(created, today);
    const daysUntilBlock = BLOCK_AFTER_DAYS - age;
    if (daysUntilBlock <= 0) {
      return { stage: 'blocked', daysLeft: null, daysUntilBlock: 0 };
    }
    return { stage: 'expired', daysLeft: null, daysUntilBlock };
  }

  const invalidOn = firstInvalidDay(input.cardExp);
  if (!invalidOn) {
    return { stage: 'ok', daysLeft: null, daysUntilBlock: null };
  }

  const daysLeft = daysBetween(today, invalidOn);
  const daysUntilBlock = daysLeft + BLOCK_AFTER_DAYS;
  if (daysUntilBlock <= 0) {
    return { stage: 'blocked', daysLeft, daysUntilBlock: 0 };
  }
  if (daysLeft <= 0) return { stage: 'expired', daysLeft, daysUntilBlock };
  if (daysLeft <= 5) return { stage: 'd5', daysLeft, daysUntilBlock };
  if (daysLeft <= 15) return { stage: 'd15', daysLeft, daysUntilBlock };
  if (daysLeft <= 30) return { stage: 'd30', daysLeft, daysUntilBlock };
  return { stage: 'ok', daysLeft, daysUntilBlock };
}

export type BillingHold = 'exempt' | 'auto' | 'agents' | 'blocked';

export function parseBillingHold(value: unknown): BillingHold {
  if (value === 'auto' || value === 'agents' || value === 'blocked') return value;
  return 'exempt';
}

export function applyBillingHold(
  hold: BillingHold,
  standing: CardStanding,
): CardStanding {
  if (hold === 'exempt') {
    return { stage: 'ok', daysLeft: standing.daysLeft, daysUntilBlock: null };
  }
  if (hold === 'blocked') {
    return { stage: 'blocked', daysLeft: standing.daysLeft, daysUntilBlock: 0 };
  }
  return standing;
}

export interface BusinessAccessView {
  dashboardBlocked: boolean;
  message: string;
  showCardUpdate: boolean;
  accountClosed: boolean;
  level: CardStage | 'agents' | 'inactive' | 'closed';
}

export function resolveBusinessAccess(input: {
  hold: BillingHold;
  isActive: boolean;
  closed?: boolean;
  standing: CardStanding;
}): BusinessAccessView | null {
  if (input.closed) {
    return {
      dashboardBlocked: true,
      message:
        'בעל העסק סגר את החשבון. הסוכנים כבויים, והמערכת לא פעילה למשתמשים של העסק.',
      showCardUpdate: false,
      accountClosed: true,
      level: 'closed',
    };
  }

  if (input.hold === 'blocked') {
    return {
      dashboardBlocked: true,
      message: cardStandingMessage(input.standing, 'blocked'),
      showCardUpdate: false,
      accountClosed: false,
      level: 'blocked',
    };
  }

  if (input.hold === 'auto' && input.standing.stage === 'blocked') {
    return {
      dashboardBlocked: true,
      message: cardStandingMessage(input.standing, 'auto'),
      showCardUpdate: true,
      accountClosed: false,
      level: 'blocked',
    };
  }

  if (input.hold === 'agents') {
    return {
      dashboardBlocked: false,
      message:
        'סוכן הקול וסוכן הוואטסאפ מושבתים לבדיקה. המערכת עצמה נשארת פתוחה.',
      showCardUpdate: false,
      accountClosed: false,
      level: 'agents',
    };
  }

  if (!input.isActive) {
    return {
      dashboardBlocked: false,
      message:
        'העסק מסומן כלא פעיל. סוכן הקול וסוכן הוואטסאפ מושבתים עד שהעסק יופעל שוב. המערכת נשארת פתוחה.',
      showCardUpdate: false,
      accountClosed: false,
      level: 'inactive',
    };
  }

  if (input.hold === 'auto' && input.standing.stage !== 'ok') {
    return {
      dashboardBlocked: false,
      message: cardStandingMessage(input.standing, 'auto'),
      showCardUpdate: true,
      accountClosed: false,
      level: input.standing.stage,
    };
  }

  return null;
}

export function cardStandingMessage(
  standing: CardStanding,
  hold: BillingHold = 'auto',
): string {
  if (hold === 'blocked') {
    return 'העסק חסום ידנית. סוכן הקול וסוכן הוואטסאפ מושבתים, והגישה למערכת חסומה עד שהחסימה תוסר בסופאבייס.';
  }
  const { stage, daysLeft, daysUntilBlock } = standing;
  if (stage === 'd30' || stage === 'd15' || stage === 'd5') {
    return `תוקף הכרטיס יסתיים בעוד ${daysPhrase(daysLeft)}. בלי כרטיס חדש, סוכן הקול וסוכן הוואטסאפ ייעצרו ביום הפקיעה, ושבעה ימים אחר כך הגישה למערכת תיחסם.`;
  }
  if (stage === 'expired') {
    const when =
      daysLeft == null
        ? 'אין כרטיס אשראי בתוקף לעסק.'
        : 'הכרטיס פג תוקף.';
    return `${when} סוכן הקול וסוכן הוואטסאפ מושבתים עד לעדכון כרטיס. בעוד ${daysPhrase(daysUntilBlock)} הגישה לכל המערכת תיחסם.`;
  }
  if (stage === 'blocked') {
    return 'אין כרטיס אשראי בתוקף כבר שבעה ימים. סוכן הקול וסוכן הוואטסאפ מושבתים, והגישה למערכת חסומה עד לעדכון כרטיס.';
  }
  return '';
}

function daysPhrase(days: number | null): string {
  if (days == null) return 'כמה ימים';
  if (days === 1) return 'יום אחד';
  return `${days} ימים`;
}

function firstInvalidDay(raw: string | null): string | null {
  const digits = raw?.replace(/\D/g, '') ?? '';
  if (digits.length < 4) return null;
  const month = Number(digits.slice(0, 2));
  const year = 2000 + Number(digits.slice(2, 4));
  if (month < 1 || month > 12 || !Number.isFinite(year)) return null;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
}

function daysBetween(fromDay: string, toDay: string): number {
  const from = Date.parse(`${fromDay}T00:00:00Z`);
  const to = Date.parse(`${toDay}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}
