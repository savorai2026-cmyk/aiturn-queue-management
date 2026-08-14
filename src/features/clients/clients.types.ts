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
}

export type ClientColumnKey = keyof Client;
