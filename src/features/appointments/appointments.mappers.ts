import type { EventInput } from '@fullcalendar/core';
import type {
  AppointmentDetails,
  AppointmentEditValues,
  AppointmentStatus,
  AppointmentUpdate,
  AppointmentWithClient,
} from './appointments.types';
import { APPOINTMENT_STATUSES } from './appointments.types';

const STATUS_COLORS: Record<string, string> = {
  waiting: '#2b7bbb',
  scheduled: '#0d9488',
  canceled: '#b94a4a',
  completed: '#708795',
  no_show: '#d58a28',
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  waiting: 'ממתין',
  scheduled: 'מתוזמן',
  canceled: 'מבוטל',
  completed: 'הושלם',
  no_show: 'לא הגיע',
};

export function isAppointmentStatus(
  status: string,
): status is AppointmentStatus {
  return APPOINTMENT_STATUSES.some((candidate) => candidate === status);
}

export function getAppointmentColor(status: string) {
  return STATUS_COLORS[status] ?? '#2b7bbb';
}

export function toAppointmentDetails(
  appointment: AppointmentWithClient,
): AppointmentDetails {
  return {
    ...appointment,
    patientName: appointment.clients?.full_name || 'לקוח לא ידוע',
    clientPhone: appointment.clients?.mobile_phone ?? null,
    time: appointment.start_time,
    notes: appointment.client_notes,
  };
}

export function toCalendarEvent(
  appointment: AppointmentWithClient,
): EventInput {
  const details = toAppointmentDetails(appointment);
  const color = getAppointmentColor(appointment.status);

  return {
    id: String(appointment.id),
    title: details.patientName,
    start: `${appointment.appointment_date}T${appointment.start_time}`,
    end: `${appointment.appointment_date}T${appointment.end_time}`,
    backgroundColor: color,
    borderColor: color,
    extendedProps: {
      appointment: details,
    },
  };
}

export function toAppointmentEditValues(
  appointment: AppointmentDetails,
): AppointmentEditValues {
  return {
    appointment_date: appointment.appointment_date,
    start_time: appointment.start_time,
    end_time: appointment.end_time,
    status: isAppointmentStatus(appointment.status)
      ? appointment.status
      : 'waiting',
    client_notes: appointment.client_notes ?? '',
    business_notes: appointment.business_notes ?? '',
  };
}

export function toAppointmentUpdate(
  values: AppointmentEditValues,
): AppointmentUpdate {
  return {
    appointment_date: values.appointment_date,
    start_time: values.start_time,
    end_time: values.end_time,
    status: values.status,
    client_notes: values.client_notes || null,
    business_notes: values.business_notes || null,
  };
}
