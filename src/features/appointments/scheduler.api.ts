import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import { getErrorMessage } from '../../shared/errors';
import { addMinutesToTime, parseSchedulerDateTime } from './time';
import type {
  BookAppointmentPayload,
  SchedulerSlot,
} from './appointments.types';

type SchedulerAction = 'book' | 'slots' | 'cancel' | 'reschedule';

interface SchedulerSuccessBody {
  success?: boolean;
  message?: string;
  error?: string;
  slots?: unknown;
  data?: {
    slots?: unknown;
  };
}

async function invokeScheduler<T>(
  action: SchedulerAction,
  payload: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('scheduler', {
    body: { action, payload },
  });

  if (error) {
    let message = getErrorMessage(error);

    if (error instanceof FunctionsHttpError) {
      try {
        const body = (await error.context.json()) as SchedulerSuccessBody;
        message = body.error || body.message || message;
      } catch {
        // Keep the original Functions error message.
      }
    }

    throw new Error(message);
  }

  const body = (data ?? {}) as SchedulerSuccessBody;
  if (body.success === false) {
    throw new Error(body.message || body.error || 'הפעולה נכשלה');
  }

  return body as T;
}

export async function bookAppointment(payload: BookAppointmentPayload) {
  const primary = payload.services[0];
  if (!primary) {
    throw new Error('יש לבחור לפחות שירות אחד.');
  }

  return invokeScheduler('book', {
    business_code: payload.businessCode,
    client_name: payload.clientName,
    client_phone: payload.clientPhone,
    appointment_time: payload.appointmentTime,
    force_booking: false,
    service_id: primary.serviceId,
    duration: primary.duration,
    price: primary.price,
    services: payload.services.map((service) => ({
      service_id: service.serviceId,
      duration: service.duration,
      price: service.price,
    })),
    status: payload.status,
    client_notes: payload.clientNotes.trim() || undefined,
    business_notes: payload.businessNotes.trim() || undefined,
  });
}

export async function getSchedulerSlots(payload: {
  businessCode: string;
  date: string;
  serviceId?: number;
  duration: number;
}): Promise<SchedulerSlot[]> {
  const body = await invokeScheduler<SchedulerSuccessBody>('slots', {
    business_code: payload.businessCode,
    date: payload.date,
    service_id: payload.serviceId,
    duration: payload.duration,
  });

  const rawSlots = Array.isArray(body.slots)
    ? body.slots
    : Array.isArray(body.data?.slots)
      ? body.data.slots
      : [];

  return rawSlots.flatMap((slot) => {
    if (typeof slot !== 'string') {
      return [];
    }

    const { time } = parseSchedulerDateTime(slot);
    return [
      {
        startTime: time,
        endTime: addMinutesToTime(time, payload.duration),
      },
    ];
  });
}

export async function cancelAppointment(payload: {
  businessCode: string;
  clientPhone: string;
  appointmentTime: string;
}) {
  return invokeScheduler('cancel', {
    business_code: payload.businessCode,
    client_phone: payload.clientPhone,
    appointment_time: payload.appointmentTime,
  });
}

export async function rescheduleAppointment(payload: {
  businessCode: string;
  clientPhone: string;
  serviceId: number;
  currentAppointmentTime: string;
  newAppointmentTime: string;
}) {
  return invokeScheduler('reschedule', {
    business_code: payload.businessCode,
    client_phone: payload.clientPhone,
    service_id: payload.serviceId,
    current_appointment_time: payload.currentAppointmentTime,
    new_appointment_time: payload.newAppointmentTime,
    force_booking: false,
  });
}
