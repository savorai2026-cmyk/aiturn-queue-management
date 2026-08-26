import { supabase } from '../../supabaseClient';
import type {
  AppointmentClientOption,
  AppointmentServiceOption,
  AppointmentUpdate,
  AppointmentWithClient,
  BusinessCalendarSettings,
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
      ),
      appointment_services (
        appointment_id,
        service_id,
        business_code,
        position,
        title_snapshot,
        duration_minutes,
        buffer_time_minutes,
        price,
        created_at
      )
    `)
    .eq('business_code', businessCode)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data.map((appointment) => ({
    ...appointment,
    appointment_services: appointment.appointment_services ?? [],
  }));
}

export async function getBusinessCalendarSettings(
  businessCode: string,
): Promise<BusinessCalendarSettings> {
  const { data, error } = await supabase
    .from('businesses')
    .select('working_hours, slot_duration_minutes, max_adv_booking_days, timezone')
    .eq('business_code', businessCode)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    workingHours: data.working_hours,
    slotDurationMinutes: data.slot_duration_minutes,
    maxAdvBookingDays: data.max_adv_booking_days,
    timezone: data.timezone,
  };
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

export async function updateAppointmentServicePrices(
  businessCode: string,
  appointmentId: number,
  servicePrices: Array<{ serviceId: number; price: number }>,
): Promise<void> {
  for (const service of servicePrices) {
    const { error } = await supabase
      .from('appointment_services')
      .update({ price: Number.isFinite(service.price) ? service.price : 0 })
      .eq('business_code', businessCode)
      .eq('appointment_id', appointmentId)
      .eq('service_id', service.serviceId);

    if (error) {
      throw new Error(error.message);
    }
  }
}
