import type { EventInput } from '@fullcalendar/core';
import { assignGroupRoles } from './calendarGrouping';
import {
  addMinutesToTime,
  formatTimeHm,
  parseTimeToMinutes,
  toDbTime,
  toSafePrice,
} from './time';
import type {
  AppointmentDetails,
  AppointmentEditValues,
  AppointmentServiceRow,
  AppointmentUpdate,
  AppointmentWithClient,
  CalendarEventProps,
  TimedAppointmentService,
} from './appointments.types';
import {
  FALLBACK_STATUS_CATALOG,
  getStatusColor,
  getStatusLabel,
  type StatusCatalogItem,
} from './appointmentStatuses';
import { APPOINTMENT_FIELDS } from '../../shared/displayFields/catalogs';
import type { DetailRow } from '../../shared/displayFields/types';

const CHANNEL_LABELS: Record<string, string> = {
  manual: 'ידני',
  whatsapp: 'וואטסאפ',
  phone: 'טלפון',
  voice: 'קולי',
  vapi: 'בוט קולי',
};

const ILS_FORMATTER = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
});

export function getAppointmentColor(
  status: string,
  catalog: StatusCatalogItem[] = FALLBACK_STATUS_CATALOG,
) {
  return getStatusColor(status, catalog);
}

function getAppointmentServices(
  appointment: AppointmentWithClient,
): AppointmentServiceRow[] {
  return [...(appointment.appointment_services ?? [])].sort(
    (left, right) => left.position - right.position,
  );
}

export function buildTimedServices(
  appointment: AppointmentWithClient,
): TimedAppointmentService[] {
  const services = getAppointmentServices(appointment);

  if (services.length === 0) {
    return [
      {
        serviceId: appointment.service_id ?? appointment.id,
        title: appointment.clients?.full_name || 'שירות',
        durationMinutes: Math.max(
          parseTimeToMinutes(appointment.end_time) -
            parseTimeToMinutes(appointment.start_time),
          1,
        ),
        bufferMinutes: 0,
        price: toSafePrice(appointment.price),
        startTime: appointment.start_time,
        endTime: appointment.end_time,
        position: 1,
        colorCode: null,
      },
    ];
  }

  let cursor = appointment.start_time;

  return services.map((service) => {
    const occupiedMinutes =
      service.duration_minutes + service.buffer_time_minutes;
    const startTime = cursor;
    const endTime = addMinutesToTime(startTime, occupiedMinutes);
    cursor = endTime;

    return {
      serviceId: service.service_id,
      title: service.title_snapshot,
      durationMinutes: service.duration_minutes,
      bufferMinutes: service.buffer_time_minutes,
      price: toSafePrice(service.price),
      startTime,
      endTime,
      position: service.position,
      colorCode: null,
    };
  });
}

export function toAppointmentDetails(
  appointment: AppointmentWithClient,
): AppointmentDetails {
  return {
    ...appointment,
    patientName: appointment.clients?.full_name || 'לקוח לא ידוע',
    clientPhone: appointment.clients?.mobile_phone ?? null,
    time: formatTimeHm(appointment.start_time),
    notes: appointment.client_notes,
    services: buildTimedServices(appointment),
  };
}

export function toCalendarEvents(
  appointments: AppointmentWithClient[],
  catalog: StatusCatalogItem[] = FALLBACK_STATUS_CATALOG,
): EventInput[] {
  const timedEvents = appointments.flatMap((appointment) => {
    const details = toAppointmentDetails(appointment);
    const color = getAppointmentColor(appointment.status, catalog);

    return details.services.map((service) => {
      const eventId = `${appointment.id}:${service.serviceId}`;

      return {
        eventId,
        appointment,
        details,
        service,
        color,
        startMinutes: parseTimeToMinutes(service.startTime),
        endMinutes: parseTimeToMinutes(service.endTime),
      };
    });
  });

  const roles = assignGroupRoles(
    timedEvents.map((event) => ({
      eventId: event.eventId,
      clientId: event.appointment.client_id,
      date: event.appointment.appointment_date,
      startMinutes: event.startMinutes,
      endMinutes: event.endMinutes,
    })),
  );

  return timedEvents.map((event) => {
    const groupRole = roles.get(event.eventId) ?? 'single';
    const title =
      groupRole === 'start' || groupRole === 'single'
        ? `${event.details.patientName} · ${event.service.title}`
        : event.service.title;

    const extendedProps: CalendarEventProps = {
      appointmentId: event.appointment.id,
      serviceId: event.service.serviceId,
      clientId: event.appointment.client_id,
      clientPhone: event.details.clientPhone,
      status: event.appointment.status,
      groupRole,
    };

    return {
      id: event.eventId,
      title,
      start: `${event.appointment.appointment_date}T${formatTimeHm(event.service.startTime)}`,
      end: `${event.appointment.appointment_date}T${formatTimeHm(event.service.endTime)}`,
      backgroundColor: event.color,
      borderColor: event.color,
      classNames: [`event-group-${groupRole}`],
      extendedProps,
    };
  });
}

export function toAppointmentEditValues(
  appointment: AppointmentDetails,
): AppointmentEditValues {
  return {
    appointment_date: appointment.appointment_date,
    start_time: formatTimeHm(appointment.start_time),
    end_time: formatTimeHm(appointment.end_time),
    status: appointment.status,
    price: toSafePrice(appointment.price),
    client_notes: appointment.client_notes ?? '',
    business_notes: appointment.business_notes ?? '',
    servicePrices: appointment.services.map((service) => ({
      serviceId: service.serviceId,
      price: toSafePrice(service.price),
    })),
  };
}

export function toAppointmentUpdate(
  values: AppointmentEditValues,
): AppointmentUpdate {
  const totalPrice = values.servicePrices.reduce(
    (total, service) => total + toSafePrice(service.price),
    0,
  );

  return {
    appointment_date: values.appointment_date,
    start_time: toDbTime(values.start_time),
    end_time: toDbTime(values.end_time),
    status: values.status,
    price: values.servicePrices.length > 0 ? totalPrice : toSafePrice(values.price),
    client_notes: values.client_notes.trim() || null,
    business_notes: values.business_notes.trim() || null,
  };
}

export function formatAppointmentField(
  appointment: AppointmentDetails,
  key: string,
  catalog: StatusCatalogItem[] = FALLBACK_STATUS_CATALOG,
): string {
  if (key === 'patientName') return appointment.patientName;
  if (key === 'clientPhone') return appointment.clientPhone ?? '';
  if (key === 'hours') {
    return `${formatTimeHm(appointment.start_time)} - ${formatTimeHm(appointment.end_time)}`;
  }
  if (key === 'status') {
    return getStatusLabel(appointment.status, catalog);
  }
  if (key === 'services') {
    return appointment.services
      .map(
        (service) =>
          `${service.title} · ${formatTimeHm(service.startTime)}-${formatTimeHm(service.endTime)} · ${ILS_FORMATTER.format(service.price)}`,
      )
      .join('\n');
  }
  if (key === 'price') {
    const total =
      appointment.services.reduce((sum, service) => sum + service.price, 0) ||
      toSafePrice(appointment.price);
    return ILS_FORMATTER.format(total);
  }
  if (key === 'channel') {
    return appointment.channel
      ? CHANNEL_LABELS[appointment.channel] ?? appointment.channel
      : '';
  }
  if (key === 'client_notes') return appointment.client_notes ?? '';
  if (key === 'business_notes') return appointment.business_notes ?? '';
  if (key === 'appointment_date') return appointment.appointment_date;

  return '';
}

export function toAppointmentDetailRows(
  appointment: AppointmentDetails,
  catalog: StatusCatalogItem[] = FALLBACK_STATUS_CATALOG,
): DetailRow[] {
  return APPOINTMENT_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    value: formatAppointmentField(appointment, field.key, catalog),
    dir: field.dir,
  }));
}
