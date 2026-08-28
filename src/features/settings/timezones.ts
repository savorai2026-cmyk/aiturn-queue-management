export interface TimezoneOption {
  value: string;
  label: string;
}

export interface TimezoneGroup {
  id: string;
  label: string;
  options: TimezoneOption[];
}

const PINNED_TIMEZONES = ['Asia/Jerusalem', 'UTC'] as const;

const REGION_LABELS: Record<string, string> = {
  Africa: 'אפריקה',
  America: 'אמריקה',
  Antarctica: 'אנטארקטיקה',
  Arctic: 'הקוטב הצפוני',
  Asia: 'אסיה',
  Atlantic: 'האוקיינוס האטלנטי',
  Australia: 'אוסטרליה',
  Europe: 'אירופה',
  Indian: 'האוקיינוס ההודי',
  Pacific: 'האוקיינוס השקט',
  Etc: 'אחר',
};

const TIMEZONE_LABELS: Record<string, string> = {
  UTC: 'UTC',
  'Etc/UTC': 'UTC',
  'Etc/GMT': 'GMT',
  'Asia/Jerusalem': 'ישראל — ירושלים',
  'Asia/Hebron': 'חברון',
  'Asia/Gaza': 'עזה',
  'Asia/Amman': 'עמאן',
  'Asia/Beirut': 'ביירות',
  'Asia/Damascus': 'דמשק',
  'Asia/Riyadh': 'ריאד',
  'Asia/Dubai': 'דובאי',
  'Asia/Qatar': 'קטאר',
  'Asia/Kuwait': 'כווית',
  'Asia/Baghdad': 'בגדאד',
  'Asia/Tehran': 'טהרן',
  'Asia/Istanbul': 'איסטנבול',
  'Asia/Nicosia': 'ניקוסיה',
  'Europe/Athens': 'אתונה',
  'Europe/Bucharest': 'בוקרשט',
  'Europe/Helsinki': 'הלסינקי',
  'Europe/Istanbul': 'איסטנבול',
  'Europe/London': 'לונדון',
  'Europe/Paris': 'פריז',
  'Europe/Berlin': 'ברלין',
  'Europe/Amsterdam': 'אמסטרדם',
  'Europe/Rome': 'רומא',
  'Europe/Madrid': 'מדריד',
  'Europe/Lisbon': 'ליסבון',
  'Europe/Moscow': 'מוסקבה',
  'Europe/Warsaw': 'ורשה',
  'Europe/Prague': 'פראג',
  'Europe/Vienna': 'וינה',
  'Europe/Zurich': 'ציריך',
  'Africa/Cairo': 'קהיר',
  'Africa/Johannesburg': 'יוהנסבורג',
  'America/New_York': 'ניו יורק',
  'America/Chicago': 'שיקגו',
  'America/Denver': 'דנבר',
  'America/Los_Angeles': 'לוס אנג׳לס',
  'America/Toronto': 'טורונטו',
  'America/Sao_Paulo': 'סאו פאולו',
  'Australia/Sydney': 'סידני',
  'Australia/Melbourne': 'מלבורן',
  'Pacific/Auckland': 'אוקלנד',
};

const FALLBACK_TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/New_York',
  'America/Sao_Paulo',
  'America/Toronto',
  'Asia/Amman',
  'Asia/Baghdad',
  'Asia/Beirut',
  'Asia/Dubai',
  'Asia/Gaza',
  'Asia/Hebron',
  'Asia/Istanbul',
  'Asia/Jerusalem',
  'Asia/Kuwait',
  'Asia/Qatar',
  'Asia/Riyadh',
  'Asia/Tehran',
  'Australia/Melbourne',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Athens',
  'Europe/Berlin',
  'Europe/Bucharest',
  'Europe/Helsinki',
  'Europe/Istanbul',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Moscow',
  'Europe/Paris',
  'Europe/Prague',
  'Europe/Rome',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Europe/Zurich',
  'Pacific/Auckland',
];

export function listIanaTimezones(): string[] {
  try {
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    // Some runtimes expose the method but reject this key.
  }

  return FALLBACK_TIMEZONES;
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

function regionOf(timeZone: string): string {
  if (timeZone === 'UTC') return 'Etc';
  return timeZone.split('/')[0] || 'Etc';
}

function sortOptions(options: TimezoneOption[]): TimezoneOption[] {
  return [...options].sort((left, right) =>
    left.label.localeCompare(right.label, 'he'),
  );
}

export function getTimezoneGroups(
  currentValue?: string | null,
  date = new Date(),
): TimezoneGroup[] {
  const catalog = new Set(listIanaTimezones());
  const current = currentValue?.trim() || '';
  const zones = new Set(catalog);
  if (current) {
    zones.add(current);
  }

  const used = new Set<string>();
  const groups: TimezoneGroup[] = [];

  const pinned: TimezoneOption[] = PINNED_TIMEZONES.filter((zone) =>
    zones.has(zone),
  ).map((zone) => {
    used.add(zone);
    return { value: zone, label: formatTimezoneLabel(zone, date) };
  });

  if (current && !used.has(current) && !catalog.has(current)) {
    pinned.unshift({
      value: current,
      label: `${current} (ערך קיים)`,
    });
    used.add(current);
  }

  if (pinned.length > 0) {
    groups.push({
      id: 'recommended',
      label: 'מומלצים',
      options: pinned,
    });
  }

  const byRegion = new Map<string, TimezoneOption[]>();
  for (const zone of zones) {
    if (used.has(zone)) continue;
    const region = regionOf(zone);
    const options = byRegion.get(region) ?? [];
    options.push({
      value: zone,
      label: formatTimezoneLabel(zone, date),
    });
    byRegion.set(region, options);
  }

  const regionIds = [...byRegion.keys()].sort((left, right) =>
    (REGION_LABELS[left] ?? left).localeCompare(REGION_LABELS[right] ?? right, 'he'),
  );

  for (const region of regionIds) {
    const options = byRegion.get(region);
    if (!options?.length) continue;
    groups.push({
      id: region,
      label: REGION_LABELS[region] ?? region,
      options: sortOptions(options),
    });
  }

  return groups;
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
