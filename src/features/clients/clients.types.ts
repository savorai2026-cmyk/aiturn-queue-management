import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from '../../types/database';

export type Client = Tables<'clients'>;
export type ClientInsert = TablesInsert<'clients'>;
export type ClientUpdate = TablesUpdate<'clients'>;

export type BookingPolicy = Client['booking_policy'];
export type PaymentRequirement = Client['payment_requirement'];

export const BOOKING_POLICY_OPTIONS: { value: BookingPolicy; label: string }[] = [
  { value: 'instant', label: 'קביעה מיידית' },
  { value: 'approval', label: 'דורש אישור' },
  { value: 'blocked', label: 'חסום' },
];

export const PAYMENT_REQUIREMENT_OPTIONS: {
  value: PaymentRequirement;
  label: string;
}[] = [
  { value: 'none', label: 'ללא תשלום' },
  { value: 'deposit', label: 'מקדמה' },
  { value: 'full', label: 'תשלום מלא' },
];

export interface ClientFormValues {
  full_name: string;
  mobile_phone: string;
  email: string;
  city: string;
  gender: string;
  national_id: string;
  booking_policy: BookingPolicy;
  payment_requirement: PaymentRequirement;
  allows_sms: boolean;
  street: string;
  building_number: string;
  apartment_number: string;
  entrance: string;
  floor: string;
  zip_code: string;
  po_box: string;
  language: string;
  birth_date_gregorian: string;
  birth_date_hebrew: string;
  landline_phone: string;
  whatsapp_number: string;
  acquisition_source: string;
  preferred_channel: string;
}

export type ClientColumnKey = keyof Client;
