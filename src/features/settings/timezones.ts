export interface TimezoneOption {
  value: string;
  label: string;
}

export interface TimezoneGroup {
  id: string;
  label: string;
  options: TimezoneOption[];
}

/** One major city per whole-hour offset, UTC−11 through UTC+12. */
const MAIN_TIMEZONES = [
  'Pacific/Pago_Pago',
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Puerto_Rico',
  'America/Sao_Paulo',
  'America/Noronha',
  'Atlantic/Azores',
  'Europe/London',
  'Europe/Paris',
  'Asia/Jerusalem',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Noumea',
  'Pacific/Auckland',
] as const;

const TIMEZONE_LABELS: Record<string, string> = {
  'Pacific/Pago_Pago': 'פאגו פאגו',
  'Pacific/Honolulu': 'הונולולו',
  'America/Anchorage': 'אנקורג׳',
  'America/Los_Angeles': 'לוס אנג׳לס',
  'America/Denver': 'דנבר',
  'America/Chicago': 'שיקגו',
  'America/New_York': 'ניו יורק',
  'America/Puerto_Rico': 'סן חואן',
  'America/Sao_Paulo': 'סאו פאולו',
  'America/Noronha': 'פרננדו די נורוניה',
  'Atlantic/Azores': 'האיים האזוריים',
  'Europe/London': 'לונדון',
  'Europe/Paris': 'פריז',
  'Asia/Jerusalem': 'ירושלים',
  'Europe/Moscow': 'מוסקבה',
  'Asia/Dubai': 'דובאי',
  'Asia/Karachi': 'קראצ׳י',
  'Asia/Dhaka': 'דאקה',
  'Asia/Bangkok': 'בנגקוק',
  'Asia/Singapore': 'סינגפור',
  'Asia/Tokyo': 'טוקיו',
  'Australia/Sydney': 'סידני',
  'Pacific/Noumea': 'נומאה',
  'Pacific/Auckland': 'אוקלנד',
};

export function listIanaTimezones(): string[] {
  try {
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    // Some runtimes expose the method but reject this key.
  }

  return [...MAIN_TIMEZONES];
}

export function formatGmtOffset(timeZone: string, date = new Date()): string {
  try {
    const value = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value;

    if (!value) return '';
    if (value === 'GMT' || value === 'UTC') return 'GMT+0';
    return value.replace(/^UTC/, 'GMT');
  } catch {
    return '';
  }
}

export function formatTimezoneLabel(timeZone: string, date = new Date()): string {
  const offset = formatGmtOffset(timeZone, date);
  const name =
    TIMEZONE_LABELS[timeZone] ??
    timeZone.split('/').pop()?.replace(/_/g, ' ') ??
    timeZone;
  return offset ? `${name} (${offset})` : name;
}

export function getTimezoneGroups(
  currentValue?: string | null,
  date = new Date(),
): TimezoneGroup[] {
  const current = currentValue?.trim() || '';
  const options: TimezoneOption[] = [];
  const used = new Set<string>();

  if (current && !(MAIN_TIMEZONES as readonly string[]).includes(current)) {
    options.push({
      value: current,
      label: `${formatTimezoneLabel(current, date)} (ערך קיים)`,
    });
    used.add(current);
  }

  const jerusalem: TimezoneOption = {
    value: 'Asia/Jerusalem',
    label: formatTimezoneLabel('Asia/Jerusalem', date),
  };
  options.push(jerusalem);
  used.add('Asia/Jerusalem');

  for (const zone of MAIN_TIMEZONES) {
    if (used.has(zone)) continue;
    options.push({
      value: zone,
      label: formatTimezoneLabel(zone, date),
    });
  }

  return [
    {
      id: 'hours',
      label: '',
      options,
    },
  ];
}

export function findTimezoneLabel(
  groups: TimezoneGroup[],
  value: string,
): string | undefined {
  for (const group of groups) {
    const match = group.options.find((option) => option.value === value);
    if (match) return match.label;
  }
  return undefined;
}

export function filterTimezoneGroups(
  groups: TimezoneGroup[],
  query: string,
): TimezoneGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return groups;

  return groups
    .map((group) => ({
      ...group,
      options: group.options.filter(
        (option) =>
          option.label.toLowerCase().includes(needle) ||
          option.value.toLowerCase().includes(needle) ||
          group.label.toLowerCase().includes(needle),
      ),
    }))
    .filter((group) => group.options.length > 0);
}
