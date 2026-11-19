import { supabase } from '../../supabaseClient';
import { resolveStatsServiceTitles } from './stats.serviceTitles';
import type { StatsAppointment } from './stats.types';

interface StatsServiceRow {
  service_id: number | null;
  title_snapshot: string | null;
}

interface StatsCatalogRow {
  id: number;
  title: string | null;
}

interface StatsClientRow {
  full_name: string | null;
}

interface StatsAppointmentRow {
  client_id: number;
  service_id: number | null;
  appointment_date: string;
  start_time: string;
  status: string;
  channel: string | null;
  price: number | string | null;
  clients: StatsClientRow | StatsClientRow[] | null;
  appointment_services: StatsServiceRow[] | null;
}

function clientName(clients: StatsAppointmentRow['clients']) {
  const row = Array.isArray(clients) ? clients[0] : clients;
  const name = row?.full_name?.trim();
  return name || 'לקוח ללא שם';
}

export async function getStatsAppointments(
  businessCode: string,
  from: string,
  to: string,
): Promise<StatsAppointment[]> {
  const [appointmentsResult, servicesResult] = await Promise.all([
    supabase
      .from('appointments')
      .select(`
        client_id,
        service_id,
        appointment_date,
        start_time,
        status,
        channel,
        price,
        clients (
          full_name
        ),
        appointment_services (
          service_id,
          title_snapshot
        )
      `)
      .eq('business_code', businessCode)
      .gte('appointment_date', from)
      .lte('appointment_date', to),
    supabase.from('services').select('id, title').eq('business_code', businessCode),
  ]);

  if (appointmentsResult.error) {
    throw new Error(appointmentsResult.error.message);
  }
  if (servicesResult.error) {
    throw new Error(servicesResult.error.message);
  }

  const catalog = new Map(
    ((servicesResult.data ?? []) as StatsCatalogRow[]).map((service) => [
      service.id,
      service.title?.trim() ?? '',
    ]),
  );

  return ((appointmentsResult.data ?? []) as StatsAppointmentRow[]).map((row) => ({
    clientId: row.client_id,
    clientName: clientName(row.clients),
    date: row.appointment_date,
    startTime: row.start_time,
    status: row.status,
    channel: row.channel,
    price: Number(row.price) || 0,
    serviceTitles: resolveStatsServiceTitles(row.service_id, row.appointment_services, catalog),
  }));
}
