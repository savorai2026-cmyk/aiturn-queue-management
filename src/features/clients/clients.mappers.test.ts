import { describe, expect, it } from 'vitest';
import {
  formatClientCell,
  normalizeClientValues,
} from './clients.mappers';
import type { Client } from './clients.types';

const CLIENT: Client = {
  business_code: 'business-1',
  id: 5,
  national_id: null,
  full_name: 'ישראל ישראלי',
  gender: 'M',
  birth_date_gregorian: null,
  birth_date_hebrew: null,
  language: 'he',
  mobile_phone: '0500000000',
  landline_phone: null,
  whatsapp_number: null,
  allows_sms: true,
  email: null,
  city: 'תל אביב',
  street: null,
  building_number: null,
  apartment_number: null,
  entrance: null,
  floor: null,
  zip_code: null,
  po_box: null,
  acquisition_source: null,
  preferred_channel: null,
  last_contact: null,
  created_at: '2026-08-14T10:00:00Z',
  updated_at: '2026-08-14T10:00:00Z',
};

describe('formatClientCell', () => {
  it('formats domain-specific values for display', () => {
    expect(formatClientCell(CLIENT, 'gender')).toBe('זכר');
    expect(formatClientCell({ ...CLIENT, gender: 'F' }, 'gender')).toBe('נקבה');
    expect(formatClientCell(CLIENT, 'allows_sms')).toBe('כן');
    expect(formatClientCell({ ...CLIENT, allows_sms: false }, 'allows_sms')).toBe('לא');
  });

  it('normalizes scalar and empty values', () => {
    expect(formatClientCell(CLIENT, 'id')).toBe('5');
    expect(formatClientCell(CLIENT, 'full_name')).toBe('ישראל ישראלי');
    expect(formatClientCell(CLIENT, 'email')).toBe('');
    expect(formatClientCell(CLIENT, 'last_contact')).toBe('');
  });
});

describe('normalizeClientValues', () => {
  it('stores optional empty fields as null', () => {
    expect(normalizeClientValues({
      full_name: '  ישראל ישראלי  ',
      mobile_phone: ' 0500000000 ',
      email: '',
      city: ' ',
      gender: 'M',
      national_id: '',
      allows_sms: true,
      street: '',
      building_number: '',
      apartment_number: '',
    })).toEqual({
      full_name: 'ישראל ישראלי',
      mobile_phone: '0500000000',
      email: null,
      city: null,
      gender: 'M',
      national_id: null,
      allows_sms: true,
      street: null,
      building_number: null,
      apartment_number: null,
    });
  });
});
