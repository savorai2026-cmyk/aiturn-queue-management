import { supabase } from '../../supabaseClient';
import type {
  AppointmentStatusInsert,
  AppointmentStatusRow,
  AppointmentStatusUpdate,
  BusinessSettings,
  EditableBusinessSettings,
  Service,
  ServiceInsert,
} from './settings.types';

export async function getBusinessSettings(
  businessCode: string,
): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from('businesses')
    .select(`
      business_code,
      business_name,
      contact_phone,
      email,
      agent_phone_number,
      timezone,
      slot_duration_minutes,
      max_adv_booking_days,
      vapi_assistant_id,
      wa_instance_id
    `)
    .eq('business_code', businessCode)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getServices(businessCode: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('business_code', businessCode)
    .order('title', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createService(service: ServiceInsert): Promise<Service> {
  const { data, error } = await supabase
    .from('services')
    .insert(service)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getStatuses(
  businessCode: string,
): Promise<AppointmentStatusRow[]> {
  const { data, error } = await supabase
    .from('statuses')
    .select('*')
    .eq('business_code', businessCode)
    .order('status_text', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createStatus(
  status: AppointmentStatusInsert,
): Promise<AppointmentStatusRow> {
  const { data, error } = await supabase
    .from('statuses')
    .insert(status)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateStatus(
  businessCode: string,
  statusCode: string,
  values: AppointmentStatusUpdate,
): Promise<AppointmentStatusRow> {
  const { data, error } = await supabase
    .from('statuses')
    .update(values)
    .eq('business_code', businessCode)
    .eq('status_code', statusCode)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteStatus(
  businessCode: string,
  statusCode: string,
): Promise<void> {
  const { error } = await supabase
    .from('statuses')
    .delete()
    .eq('business_code', businessCode)
    .eq('status_code', statusCode);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateBusinessSettings(
  businessCode: string,
  settings: EditableBusinessSettings,
): Promise<void> {
  const { error } = await supabase
    .from('businesses')
    .update(settings)
    .eq('business_code', businessCode);

  if (error) {
    throw new Error(error.message);
  }
}
