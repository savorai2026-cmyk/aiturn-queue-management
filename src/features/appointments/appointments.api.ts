import { supabase } from '../../supabaseClient';
import type {
  AppointmentClientOption,
  AppointmentAvailabilitySlot,
  AppointmentInsert,
  AppointmentServiceOption,
  AppointmentUpdate,
  AppointmentWithClient,
  CreateAppointmentRequest,
  CreatedAppointment,
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

export async function getAppointmentServiceOptions(
  businessCode: string,
): Promise<AppointmentServiceOption[]> {
  const { data, error } = await supabase
    .from('services')
    .select(`
      id,
      title,
      description,
      duration_minutes,
      buffer_time_minutes,
      price,
      color_code
    `)
    .eq('business_code', businessCode)
    .eq('is_active', true)
    .order('title', { ascending: true });

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

export async function createAppointmentWithServices(
  request: CreateAppointmentRequest,
): Promise<CreatedAppointment> {
  const { data, error } = await supabase.rpc(
    'create_appointment_with_services',
    {
      p_business_code: request.businessCode,
      p_client_id: request.clientId,
      p_appointment_date: request.appointmentDate,
      p_start_time: request.startTime,
      p_service_ids: request.serviceIds,
      p_status: request.status,
      p_channel: 'manual',
      p_currency: 'ILS',
      p_client_notes: request.clientNotes.trim() || undefined,
      p_business_notes: request.businessNotes.trim() || undefined,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const result = data?.[0];
  if (!result) {
    throw new Error('Appointment creation returned no result');
  }

  return {
    appointmentId: result.appointment_id,
    endTime: result.end_time,
    totalDurationMinutes: result.total_duration_minutes,
    totalPrice: result.total_price,
  };
}

export async function getAvailableAppointmentSlots({
  businessCode,
  appointmentDate,
  serviceIds,
  limit = 8,
}: {
  businessCode: string;
  appointmentDate: string;
  serviceIds: number[];
  limit?: number;
}): Promise<AppointmentAvailabilitySlot[]> {
  const { data, error } = await supabase.rpc(
    'get_available_appointment_slots',
    {
      p_business_code: businessCode,
      p_appointment_date: appointmentDate,
      p_service_ids: serviceIds,
      p_limit: limit,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return data.map((slot) => ({
    startTime: slot.start_time,
    endTime: slot.end_time,
  }));
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
