import type {
  Client,
  ClientColumnKey,
  ClientFormValues,
  ClientUpdate,
} from './clients.types';
import { CLIENT_FIELDS } from '../../shared/displayFields/catalogs';
import type { DetailRow } from '../../shared/displayFields/types';

function emptyToNull(value: string) {
  const normalized = value.trim();
  return normalized || null;
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
