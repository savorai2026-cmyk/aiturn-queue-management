import { supabase } from '../../supabaseClient';
import { withCatalogServiceTitles } from './appointments.mappers';
import { formatTimeHm, toDbTime } from './time';
import type {
  AppointmentClientOption,
  AppointmentServiceOption,
  AppointmentUpdate,
  AppointmentWithClient,
  BusinessCalendarSettings,
  SchedulerSlot,
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
      price
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
  const [appointmentsResult, servicesResult] = await Promise.all([
    supabase
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
      .order('start_time', { ascending: true }),
    supabase
      .from('services')
      .select('id, title, duration_minutes, buffer_time_minutes, price')
      .eq('business_code', businessCode),
  ]);

  if (appointmentsResult.error) {
    throw new Error(appointmentsResult.error.message);
  }

  if (servicesResult.error) {
    throw new Error(servicesResult.error.message);
  }

  const catalog = new Map(
    (servicesResult.data ?? []).map((service) => [service.id, service]),
  );

  return appointmentsResult.data.map((appointment) =>
    withCatalogServiceTitles(
      {
        ...appointment,
        appointment_services: appointment.appointment_services ?? [],
      },
      catalog,
    ),
  );
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

export async function createAppointmentWithServices(payload: {
  businessCode: string;
  clientId: number;
  appointmentDate: string;
  startTime: string;
  serviceIds: number[];
  status?: string;
  clientNotes?: string;
  businessNotes?: string;
}) {
  const { data, error } = await supabase.rpc('create_appointment_with_services', {
    p_business_code: payload.businessCode,
    p_client_id: payload.clientId,
    p_appointment_date: payload.appointmentDate,
    p_start_time: toDbTime(payload.startTime),
    p_service_ids: payload.serviceIds,
    p_status: payload.status,
    p_channel: 'manual',
    p_client_notes: payload.clientNotes?.trim() || undefined,
    p_business_notes: payload.businessNotes?.trim() || undefined,
  });

  if (error) {
    throw new Error(error.message);
  }

  const created = Array.isArray(data) ? data[0] : data;
  if (!created) {
    throw new Error('לא ניתן ליצור את התור.');
  }

  return created;
}

export async function getAvailableAppointmentSlots(payload: {
  businessCode: string;
  appointmentDate: string;
  serviceIds: number[];
  limit?: number;
}): Promise<SchedulerSlot[]> {
  const { data, error } = await supabase.rpc('get_available_appointment_slots', {
    p_business_code: payload.businessCode,
    p_appointment_date: payload.appointmentDate,
    p_service_ids: payload.serviceIds,
    p_limit: payload.limit ?? 64,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((slot) => ({
    startTime: formatTimeHm(slot.start_time),
    endTime: formatTimeHm(slot.end_time),
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
