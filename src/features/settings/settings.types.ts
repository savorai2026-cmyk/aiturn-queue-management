import type { Tables, TablesInsert, TablesUpdate } from '../../types/database';

export type Service = Tables<'services'>;
export type ServiceInsert = TablesInsert<'services'>;
export type ServiceUpdate = TablesUpdate<'services'>;

export type AppointmentStatusRow = Tables<'statuses'>;
export type AppointmentStatusInsert = TablesInsert<'statuses'>;
export type AppointmentStatusUpdate = TablesUpdate<'statuses'>;

export interface StatusFormValues {
  status_code: string;
  status_text: string;
  color: string;
}

export interface ServiceFormValues {
  title: string;
  service_code: string;
  description: string;
  duration_minutes: string;
  buffer_time_minutes: string;
  price: string;
  deposit_amount: string;
  is_active: boolean;
}

export type BusinessSettings = Pick<
  Tables<'businesses'>,
  | 'business_code'
  | 'business_name'
  | 'contact_phone'
  | 'email'
  | 'agent_phone_number'
  | 'timezone'
  | 'slot_duration_minutes'
  | 'max_adv_booking_days'
  | 'working_hours'
  | 'vapi_assistant_id'
  | 'wa_instance_id'
>;

export type EditableBusinessSettings = Omit<
  BusinessSettings,
  'business_code' | 'working_hours' | 'max_adv_booking_days'
>;

export interface OperatingHoursUpdate {
  working_hours: BusinessSettings['working_hours'];
  max_adv_booking_days: number | null;
}
