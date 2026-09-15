import {
  BOOKING_POLICY_OPTIONS,
  PAYMENT_REQUIREMENT_OPTIONS,
  type BookingPolicy,
  type Client,
  type ClientColumnKey,
  type ClientFormValues,
  type ClientUpdate,
  type PaymentRequirement,
} from './clients.types';
import { CLIENT_FIELDS } from '../../shared/displayFields/catalogs';
import type { DetailRow } from '../../shared/displayFields/types';
import {
  columnExactNumber,
  columnTextIncludes,
  compareByNumber,
  compareByText,
  type ColumnFilters,
  type ColumnSort,
} from '../../shared/displayFields/columnTable';

function emptyToNull(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function labelFor<T extends string>(
  options: { value: T; label: string }[],
  value: T,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function parseBookingPolicy(
  value: string | null | undefined,
): BookingPolicy {
  return value === 'approval' || value === 'blocked' ? value : 'instant';
}

export function parsePaymentRequirement(
  value: string | null | undefined,
): PaymentRequirement {
  return value === 'deposit' || value === 'full' ? value : 'none';
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function normalizePhoneDigits(value: string) {
  let digits = digitsOnly(value);
  if (digits.startsWith('972')) {
    digits = `0${digits.slice(3)}`;
  }
  return digits;
}

const CLIENT_PHONE_KEYS = new Set([
  'mobile_phone',
  'landline_phone',
  'whatsapp_number',
]);

function matchesClientColumnFilters(client: Client, filters: ColumnFilters) {
  return Object.entries(filters).every(([key, raw]) => {
    const query = raw.trim();
    if (!query) return true;

    if (key === 'booking_policy' || key === 'payment_requirement' || key === 'gender') {
      return client[key] === query;
    }

    if (key === 'allows_sms') {
      if (query === 'yes') return Boolean(client.allows_sms);
      if (query === 'no') return !client.allows_sms;
      return true;
    }

    if (key === 'id') {
      return columnExactNumber(client.id, query);
    }

    if (CLIENT_PHONE_KEYS.has(key) || key === 'national_id') {
      const source = String(client[key as ClientColumnKey] ?? '');
      const normalizedQuery = CLIENT_PHONE_KEYS.has(key)
        ? normalizePhoneDigits(query)
        : digitsOnly(query);
      const normalizedSource = CLIENT_PHONE_KEYS.has(key)
        ? normalizePhoneDigits(source)
        : digitsOnly(source);
      if (normalizedQuery) {
        return normalizedSource.includes(normalizedQuery);
      }
      return columnTextIncludes(source, query);
    }

    return columnTextIncludes(
      formatClientCell(client, key as ClientColumnKey),
      query,
    );
  });
}

function compareClients(left: Client, right: Client, sort: ColumnSort) {
  if (sort.key === 'id') {
    return compareByNumber(left.id, right.id, sort.direction);
  }

  if (sort.key === 'allows_sms') {
    return compareByNumber(
      Number(Boolean(left.allows_sms)),
      Number(Boolean(right.allows_sms)),
      sort.direction,
    );
  }

  if (sort.key === 'last_contact' || sort.key === 'birth_date_gregorian') {
    return compareByNumber(
      Date.parse(String(left[sort.key] ?? '')) || 0,
      Date.parse(String(right[sort.key] ?? '')) || 0,
      sort.direction,
    );
  }

  if (CLIENT_PHONE_KEYS.has(sort.key) || sort.key === 'national_id') {
    return compareByText(
      normalizePhoneDigits(String(left[sort.key as ClientColumnKey] ?? '')),
      normalizePhoneDigits(String(right[sort.key as ClientColumnKey] ?? '')),
      sort.direction,
    );
  }

  return compareByText(
    formatClientCell(left, sort.key as ClientColumnKey),
    formatClientCell(right, sort.key as ClientColumnKey),
    sort.direction,
  );
}

export function filterAndSortClients(
  clients: Client[],
  filters: ColumnFilters,
  sort: ColumnSort | null,
) {
  const filtered = clients.filter((client) =>
    matchesClientColumnFilters(client, filters),
  );

  if (!sort) return filtered;

  return [...filtered].sort((left, right) => {
    const compared = compareClients(left, right, sort);
    return compared !== 0 ? compared : left.id - right.id;
  });
}

export function normalizeClientValues(
  values: ClientFormValues,
): ClientUpdate {
  return {
    full_name: values.full_name.trim(),
    mobile_phone: values.mobile_phone.trim(),
    email: emptyToNull(values.email),
    city: emptyToNull(values.city),
    gender: values.gender,
    national_id: emptyToNull(values.national_id),
    booking_policy: values.booking_policy,
    payment_requirement: values.payment_requirement,
    allows_sms: values.allows_sms,
    street: emptyToNull(values.street),
    building_number: emptyToNull(values.building_number),
    apartment_number: emptyToNull(values.apartment_number),
    entrance: emptyToNull(values.entrance),
    floor: emptyToNull(values.floor),
    zip_code: emptyToNull(values.zip_code),
    po_box: emptyToNull(values.po_box),
    language: emptyToNull(values.language),
    birth_date_gregorian: emptyToNull(values.birth_date_gregorian),
    birth_date_hebrew: emptyToNull(values.birth_date_hebrew),
    landline_phone: emptyToNull(values.landline_phone),
    whatsapp_number: emptyToNull(values.whatsapp_number),
    acquisition_source: emptyToNull(values.acquisition_source),
    preferred_channel: emptyToNull(values.preferred_channel),
  };
}

export function formatClientCell(
  client: Client,
  column: ClientColumnKey,
): string {
  if (column === 'gender') {
    if (client.gender === 'M') return 'זכר';
    if (client.gender === 'F') return 'נקבה';
    return '';
  }

  if (column === 'booking_policy') {
    return labelFor(BOOKING_POLICY_OPTIONS, client.booking_policy);
  }

  if (column === 'payment_requirement') {
    return labelFor(PAYMENT_REQUIREMENT_OPTIONS, client.payment_requirement);
  }

  if (column === 'allows_sms') {
    return client.allows_sms ? 'כן' : 'לא';
  }

  if (column === 'last_contact') {
    return client.last_contact
      ? new Date(client.last_contact).toLocaleDateString('he-IL')
      : '';
  }

  const value = client[column];
  return value == null ? '' : String(value);
}

export function toClientDetailRows(client: Client): DetailRow[] {
  return CLIENT_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    value: formatClientCell(client, field.key as ClientColumnKey),
    dir: field.dir,
  }));
}
