import {
  columnExactNumber,
  columnTextIncludes,
  compareByNumber,
  compareByText,
  type ColumnFilters,
  type ColumnSort,
} from '../../shared/displayFields/columnTable';
import type {
  UsageActionSummary,
  UsageEvent,
  UsageEventColumnKey,
  UsagePrice,
} from './usage.types';

export const USAGE_EVENT_LIMIT = 500;

const ACTION_LABELS: Record<string, string> = {
  openai_tokens: 'טוקני OpenAI',
  outreach_dispatch: 'פנייה יזומה',
  vapi_call_seconds: 'שיחה קולית',
  whatsapp_inbound: 'WhatsApp נכנס',
  whatsapp_outbound: 'WhatsApp יוצא',
  whisper_seconds: 'תמלול קולי',
};

const UNIT_LABELS: Record<string, string> = {
  token: 'טוקן',
  event: 'אירוע',
  second: 'שנייה',
  message: 'הודעה',
};

export function formatUsageAction(action: string) {
  return ACTION_LABELS[action] ?? action;
}

export function formatUsageUnit(unit: string) {
  return UNIT_LABELS[unit] ?? unit;
}

export function formatCredits(value: number) {
  return value.toLocaleString('he-IL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export function formatCreditAmount(value: number) {
  return `${formatCredits(value)} קרדיטים`;
}

export function formatBillingCurrency(code: string | null | undefined) {
  const normalized = code?.trim().toUpperCase() ?? '';
  if (!normalized || /^CREDITS?$/.test(normalized)) {
    return 'לא צוין';
  }
  if (normalized === 'ILS' || normalized === 'NIS' || normalized === '₪') {
    return '₪ שקלים';
  }
  return normalized;
}

export function formatQuantity(value: number) {
  return value.toLocaleString('he-IL', {
    maximumFractionDigits: 4,
  });
}

export function formatUsageDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function formatUsageMeta(value: UsageEvent['meta']) {
  if (value == null) return '—';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || '—';
  }

  try {
    const text = JSON.stringify(value);
    return text && text !== '{}' && text !== '[]' ? text : '—';
  } catch {
    return '—';
  }
}

export function findUsagePrice(
  prices: UsagePrice[],
  action: string,
  unit: string,
) {
  return (
    prices.find((price) => price.action === action && price.unit === unit) ??
    null
  );
}

export function formatUnitPrice(price: UsagePrice | null) {
  if (!price) return '—';
  return `${formatCredits(price.amountCredits)} קרדיטים / ${formatUsageUnit(price.unit)}`;
}

export function summarizeUsage(events: UsageEvent[]): {
  totalCredits: number;
  byAction: UsageActionSummary[];
} {
  const groups = new Map<string, UsageActionSummary>();
  let totalCredits = 0;

  for (const event of events) {
    totalCredits += event.amountCredits;
    const key = `${event.action}\0${event.unit}`;
    const current = groups.get(key);
    if (current) {
      current.count += 1;
      current.quantity += event.quantity;
      current.credits += event.amountCredits;
      continue;
    }

    groups.set(key, {
      action: event.action,
      unit: event.unit,
      count: 1,
      quantity: event.quantity,
      credits: event.amountCredits,
    });
  }

  return {
    totalCredits,
    byAction: Array.from(groups.values()).sort(
      (left, right) => right.credits - left.credits,
    ),
  };
}

export function formatUsageEventCell(
  event: UsageEvent,
  key: UsageEventColumnKey,
) {
  switch (key) {
    case 'createdAt':
      return formatUsageDateTime(event.createdAt);
    case 'action':
      return formatUsageAction(event.action);
    case 'quantity':
      return formatQuantity(event.quantity);
    case 'unit':
      return formatUsageUnit(event.unit);
    case 'amountCredits':
      return formatCredits(event.amountCredits);
    case 'id':
      return event.id || '—';
    case 'businessCode':
      return event.businessCode || '—';
    case 'meta':
      return formatUsageMeta(event.meta);
  }
}

export function filterAndSortUsageEvents(
  events: UsageEvent[],
  filters: ColumnFilters,
  sort: ColumnSort | null,
) {
  const filtered = events.filter((event) =>
    matchesUsageColumnFilters(event, filters),
  );
  if (!sort) return filtered;

  return [...filtered].sort((left, right) => {
    const compared = compareUsageEvents(left, right, sort);
    return compared !== 0 ? compared : left.id.localeCompare(right.id);
  });
}

function matchesUsageColumnFilters(event: UsageEvent, filters: ColumnFilters) {
  return Object.entries(filters).every(([key, raw]) => {
    const query = raw.trim();
    if (!query) return true;

    if (key === 'action') {
      return (
        event.action === query ||
        columnTextIncludes(formatUsageAction(event.action), query)
      );
    }

    if (key === 'unit') {
      return (
        event.unit === query ||
        columnTextIncludes(formatUsageUnit(event.unit), query)
      );
    }

    if (key === 'quantity') {
      return (
        columnExactNumber(event.quantity, query) ||
        columnTextIncludes(formatQuantity(event.quantity), query)
      );
    }

    if (key === 'amountCredits') {
      return (
        columnExactNumber(event.amountCredits, query) ||
        columnTextIncludes(formatCredits(event.amountCredits), query)
      );
    }

    return columnTextIncludes(
      formatUsageEventCell(event, key as UsageEventColumnKey),
      query,
    );
  });
}

function compareUsageEvents(
  left: UsageEvent,
  right: UsageEvent,
  sort: ColumnSort,
) {
  if (sort.key === 'createdAt') {
    return compareByNumber(
      Date.parse(left.createdAt) || 0,
      Date.parse(right.createdAt) || 0,
      sort.direction,
    );
  }

  if (sort.key === 'quantity') {
    return compareByNumber(left.quantity, right.quantity, sort.direction);
  }

  if (sort.key === 'amountCredits') {
    return compareByNumber(
      left.amountCredits,
      right.amountCredits,
      sort.direction,
    );
  }

  return compareByText(
    formatUsageEventCell(left, sort.key as UsageEventColumnKey),
    formatUsageEventCell(right, sort.key as UsageEventColumnKey),
    sort.direction,
  );
}

export function usageSelectOptions(events: UsageEvent[]) {
  return {
    action: uniqueOptions(
      events.map((event) => event.action),
      formatUsageAction,
    ),
    unit: uniqueOptions(
      events.map((event) => event.unit),
      formatUsageUnit,
    ),
  };
}

function uniqueOptions(values: string[], format: (value: string) => string) {
  return [...new Set(values.filter(Boolean))]
    .sort((left, right) => format(left).localeCompare(format(right), 'he'))
    .map((value) => ({ value, label: format(value) }));
}
