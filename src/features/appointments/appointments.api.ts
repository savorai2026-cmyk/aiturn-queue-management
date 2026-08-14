import { supabase } from '../../supabaseClient';
import type {
  AppointmentClientOption,
  AppointmentInsert,
  AppointmentUpdate,
  AppointmentWithClient,
} from './appointments.types';

export async function getAppointmentClients(
  businessCode: string,
): Promise<AppointmentClientOption[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, full_name, mobile_phone')
    .eq('business_code', businessCode)
    .order('full_name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getAppointments(
  businessCode: string,
): Promise<AppointmentWithClient[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      clients (
        full_name,
        mobile_phone
      )
    `)
    .eq('business_code', businessCode)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createAppointment(
  appointment: AppointmentInsert,
): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .insert(appointment);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateAppointment(
  businessCode: string,
  appointmentId: number,
  changes: AppointmentUpdate,
): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update(changes)
    .eq('business_code', businessCode)
    .eq('id', appointmentId);

  if (error) {
    throw new Error(error.message);
  }
}
