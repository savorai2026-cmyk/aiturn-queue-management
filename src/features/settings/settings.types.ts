import type { Tables, TablesInsert, TablesUpdate } from '../../types/database';

export type Service = Tables<'services'>;
export type ServiceInsert = TablesInsert<'services'>;
export type ServiceUpdate = TablesUpdate<'services'>;

export type AppointmentStatusRow = Tables<'statuses'>;
export type AppointmentStatusInsert = TablesInsert<'statuses'>;
export type AppointmentStatusUpdate = TablesUpdate<'statuses'>;

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
  | 'deposit_percent'
  | 'agent_prompt'
  | 'save_recordings'
  | 'recordings_retention_days'
  | 'history_retention_months'
  | 'voice_log_retention_months'
  | 'whatsapp_retention_months'
  | 'subscription_plan'
  | 'storage_quota_gb'
  | 'is_active'
  | 'closed_at'
  | 'max_adv_booking_days'
  | 'working_hours'
  | 'vapi_assistant_id'
  | 'wa_instance_id'
>;

export type EditableBusinessProfile = Pick<
  BusinessSettings,
  'business_name' | 'contact_phone' | 'email' | 'agent_phone_number'
>;

export type EditableBusinessConfig = Pick<
  BusinessSettings,
  | 'timezone'
  | 'slot_duration_minutes'
  | 'deposit_percent'
  | 'agent_prompt'
  | 'save_recordings'
  | 'recordings_retention_days'
  | 'history_retention_months'
  | 'voice_log_retention_months'
  | 'whatsapp_retention_months'
  | 'subscription_plan'
  | 'storage_quota_gb'
  | 'is_active'
>;

export type EditableBusinessSettings = EditableBusinessProfile &
  EditableBusinessConfig;

export interface OperatingHoursUpdate {
  working_hours: BusinessSettings['working_hours'];
  max_adv_booking_days: number | null;
}
