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

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
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

function clientMatchesToken(client: Client, token: string) {
  const name = normalizeSearchText(client.full_name ?? '');
  if (name.includes(token)) return true;

  const tokenDigits = digitsOnly(token);
  if (!tokenDigits) return false;

  const phone = normalizePhoneDigits(client.mobile_phone);
  if (phone.includes(normalizePhoneDigits(token))) return true;

  const nationalId = digitsOnly(client.national_id ?? '');
  return nationalId.includes(tokenDigits);
}

export function matchesClientSearch(client: Client, query: string) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return true;

  return normalized.split(' ').every((token) => clientMatchesToken(client, token));
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
