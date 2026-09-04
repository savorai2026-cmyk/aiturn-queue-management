import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import { getErrorMessage } from '../../shared/errors';
import { addMinutesToTime, parseSchedulerDateTime } from './time';
import {
  collectSchedulerSlotValues,
  isSchedulerSuccess,
  schedulerFailureMessage,
  type SchedulerResponseBody,
} from './scheduler.mappers';
import type {
  BookAppointmentPayload,
  SchedulerSlot,
} from './appointments.types';

type SchedulerAction = 'book' | 'slots' | 'cancel' | 'reschedule';

interface SchedulerSuccessBody extends SchedulerResponseBody {
  slots?: unknown;
  available_slots?: unknown;
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
        message =
          body.error || body.user_message || body.message || message;
      } catch {
        // Keep the original Functions error message.
      }
    }

    throw new Error(message);
  }

  const body = (data ?? {}) as SchedulerSuccessBody;
  if (!isSchedulerSuccess(body)) {
    throw new Error(schedulerFailureMessage(body));
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
    service_id: primary.serviceId,
    duration: Math.round(
      payload.services.reduce((total, service) => total + service.duration, 0),
    ),
    price: Math.round(
      payload.services.reduce((total, service) => total + service.price, 0),
    ),
    force_booking: true,
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
    duration: payload.duration,
  });

  const rawSlots = collectSchedulerSlotValues(
    body.slots ?? body.available_slots ?? body.data?.slots,
  );

  return rawSlots.flatMap((slot) => {
    const parsed = parseSchedulerDateTime(slot);
    if (!parsed.time) return [];

    return [
      {
        startTime: parsed.time,
        endTime: addMinutesToTime(parsed.time, payload.duration),
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
    force_booking: true,
  });
}
