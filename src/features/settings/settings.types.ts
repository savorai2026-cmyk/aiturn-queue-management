import type { Tables, TablesInsert } from '../../types/database';

export type Service = Tables<'services'>;
export type ServiceInsert = TablesInsert<'services'>;

export interface ServiceFormValues {
  title: string;
  service_code: string;
  description: string;
  duration_minutes: string;
  buffer_time_minutes: string;
  price: string;
  deposit_amount: string;
  color_code: string;
  is_active: boolean;
}

export type BusinessSettings = Pick<
  Tables<'businesses'>,
  | 'business_code'
  | 'business_name'
  | 'contact_phone'
  | 'vapi_assistant_id'
  | 'wa_instance_id'
>;

export type EditableBusinessSettings = Omit<
  BusinessSettings,
  'business_code'
>;
