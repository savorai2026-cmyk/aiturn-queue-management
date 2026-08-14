import type {
  Client,
  ClientColumnKey,
  ClientFormValues,
  ClientUpdate,
} from './clients.types';

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
