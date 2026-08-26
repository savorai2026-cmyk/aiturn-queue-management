import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from '../../types/database';

export type Client = Tables<'clients'>;
export type ClientInsert = TablesInsert<'clients'>;
export type ClientUpdate = TablesUpdate<'clients'>;

export interface ClientFormValues {
  full_name: string;
  mobile_phone: string;
  email: string;
  city: string;
  gender: string;
  national_id: string;
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
