import { describe, expect, it } from 'vitest';
import {
  getAppointmentColor,
  toAppointmentDetails,
  toCalendarEvent,
  toAppointmentEditValues,
  toAppointmentUpdate,
} from './appointments.mappers';
import type { AppointmentWithClient } from './appointments.types';

function createAppointment(
  overrides: Partial<AppointmentWithClient> = {},
): AppointmentWithClient {
  return {
    id: 42,
    business_code: 'business-1',
    client_id: 7,
    service_id: null,
    appointment_date: '2026-08-20',
    start_time: '09:00:00',
    end_time: '09:30:00',
    price: 100,
    currency: 'ILS',
    status: 'scheduled',
    channel: 'manual',
    client_notes: 'להגיע בזמן',
    business_notes: null,
    metadata: {},
    created_at: null,
    updated_at: null,
    clients: {
      full_name: 'ישראל ישראלי',
      mobile_phone: '0500000000',
    },
    ...overrides,
  };
}

describe('toCalendarEvent', () => {
  it('maps a database appointment to a FullCalendar event', () => {
    const event = toCalendarEvent(createAppointment());

    expect(event).toMatchObject({
      id: '42',
      title: 'ישראל ישראלי',
      start: '2026-08-20T09:00:00',
      end: '2026-08-20T09:30:00',
      backgroundColor: '#0d9488',
      borderColor: '#0d9488',
    });

    expect(event.extendedProps?.appointment).toMatchObject({
      id: 42,
      patientName: 'ישראל ישראלי',
      clientPhone: '0500000000',
      time: '09:00:00',
      notes: 'להגיע בזמן',
    });
  });

  it('uses a safe fallback when the client relation is missing', () => {
    const event = toCalendarEvent(createAppointment({ clients: null }));

    expect(event.title).toBe('לקוח לא ידוע');
    expect(event.extendedProps?.appointment.clientPhone).toBeNull();
  });
});

describe('getAppointmentColor', () => {
  it('maps supported statuses and falls back for unknown values', () => {
    expect(getAppointmentColor('waiting')).toBe('#2b7bbb');
    expect(getAppointmentColor('scheduled')).toBe('#0d9488');
    expect(getAppointmentColor('canceled')).toBe('#b94a4a');
    expect(getAppointmentColor('completed')).toBe('#708795');
    expect(getAppointmentColor('no_show')).toBe('#d58a28');
    expect(getAppointmentColor('unexpected')).toBe('#2b7bbb');
  });
});

describe('appointment edit mapping', () => {
  it('maps editable values to an allow-listed database update', () => {
    const details = toAppointmentDetails(createAppointment());
    const editValues = toAppointmentEditValues(details);

    expect(editValues).toEqual({
      appointment_date: '2026-08-20',
      start_time: '09:00:00',
      end_time: '09:30:00',
      status: 'scheduled',
      client_notes: 'להגיע בזמן',
      business_notes: '',
    });

    expect(toAppointmentUpdate({
      ...editValues,
      client_notes: '',
      business_notes: 'הערה פנימית',
    })).toEqual({
      appointment_date: '2026-08-20',
      start_time: '09:00:00',
      end_time: '09:30:00',
      status: 'scheduled',
      client_notes: null,
      business_notes: 'הערה פנימית',
    });
  });
});
