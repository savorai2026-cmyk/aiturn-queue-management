import type { Tables } from '../../types/database';

export type Service = Tables<'services'>;

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
