import { describe, expect, it } from 'vitest';
import { assignGroupRoles } from './calendarGrouping';
import {
  toAppointmentDetails,
  toAppointmentEditValues,
  toAppointmentUpdate,
  toCalendarEvents,
  getAppointmentColor,
} from './appointments.mappers';
import type { AppointmentWithClient } from './appointments.types';
import { addMinutesToTime, formatTimeHm, toSchedulerDateTime, addMinutesToDateTime, shiftedAppointmentTimes } from './time';

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
    end_time: '09:50:00',
    price: 130,
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
    appointment_services: [
      {
        appointment_id: 42,
        service_id: 25,
        business_code: 'business-1',
        position: 1,
        title_snapshot: 'עיצוב גבות',
        duration_minutes: 20,
        buffer_time_minutes: 5,
        price: 50,
        created_at: '2026-08-20T08:00:00',
      },
      {
        appointment_id: 42,
        service_id: 34,
        business_code: 'business-1',
        position: 2,
        title_snapshot: "לק ג'ל",
        duration_minutes: 25,
        buffer_time_minutes: 0,
        price: 80,
        created_at: '2026-08-20T08:00:00',
      },
    ],
    ...overrides,
  };
}

describe('toCalendarEvents', () => {
  it('renders each service as a separate event with computed times', () => {
    const events = toCalendarEvents([createAppointment()]);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      id: '42:25',
      title: 'ישראל ישראלי · עיצוב גבות',
      start: '2026-08-20T09:00',
      end: '2026-08-20T09:25',
    });
    expect(events[1]).toMatchObject({
      id: '42:34',
      title: "לק ג'ל",
      start: '2026-08-20T09:25',
      end: '2026-08-20T09:50',
    });
    expect(events[0].extendedProps).toMatchObject({
      appointmentId: 42,
      serviceId: 25,
      groupRole: 'start',
    });
    expect(events[1].extendedProps).toMatchObject({
      groupRole: 'end',
    });
  });

  it('splits visually when a time gap exists between the same client services', () => {
    const first = createAppointment({
      id: 1,
      start_time: '09:00:00',
      end_time: '09:25:00',
      appointment_services: [
        {
          appointment_id: 1,
          service_id: 25,
          business_code: 'business-1',
          position: 1,
          title_snapshot: 'עיצוב גבות',
          duration_minutes: 20,
          buffer_time_minutes: 5,
          price: 50,
          created_at: '2026-08-20T08:00:00',
        },
      ],
    });
    const second = createAppointment({
      id: 2,
      start_time: '10:00:00',
      end_time: '10:25:00',
      appointment_services: [
        {
          appointment_id: 2,
          service_id: 34,
          business_code: 'business-1',
          position: 1,
          title_snapshot: "לק ג'ל",
          duration_minutes: 25,
          buffer_time_minutes: 0,
          price: 80,
          created_at: '2026-08-20T08:00:00',
        },
      ],
    });

    const events = toCalendarEvents([first, second]);
    expect(events[0].extendedProps).toMatchObject({ groupRole: 'single' });
    expect(events[1].extendedProps).toMatchObject({ groupRole: 'single' });
  });
});

describe('getAppointmentColor', () => {
  it('maps catalog statuses and falls back to brand colors', () => {
    expect(getAppointmentColor('01')).toBe('#607482');
    expect(getAppointmentColor('waiting')).toBe('#607482');
    expect(getAppointmentColor('02')).toBe('#0d9488');
    expect(getAppointmentColor('10')).toBe('#b91c1c');
    expect(getAppointmentColor('03')).toBe('#073f67');
    expect(getAppointmentColor('09')).toBe('#b45309');
    expect(getAppointmentColor('unexpected')).toBe('#12648f');
  });
});

describe('appointment edit mapping', () => {
  it('maps editable values including prices and notes', () => {
    const details = toAppointmentDetails(createAppointment());
    const editValues = toAppointmentEditValues(details);

    expect(editValues.servicePrices).toEqual([
      { serviceId: 25, price: 50 },
      { serviceId: 34, price: 80 },
    ]);
    expect(formatTimeHm(details.start_time)).toBe('09:00');
    expect(toSchedulerDateTime('2026-08-20', '09:00:00')).toBe(
      '2026-08-20T09:00:00',
    );
    expect(addMinutesToTime('09:00:00', 25)).toBe('09:25:00');
    expect(addMinutesToDateTime('2026-08-20', '23:30:00', 60)).toEqual({
      date: '2026-08-21',
      time: '00:30:00',
    });
    expect(
      shiftedAppointmentTimes('2026-08-20', '23:30:00', '23:50:00', 60),
    ).toEqual({
      appointment_date: '2026-08-21',
      start_time: '00:30:00',
      end_time: '00:50:00',
    });

    expect(
      toAppointmentUpdate({
        ...editValues,
        client_notes: '',
        business_notes: 'הערה פנימית',
        servicePrices: [
          { serviceId: 25, price: 60 },
          { serviceId: 34, price: 80 },
        ],
      }),
    ).toMatchObject({
      price: 140,
      start_time: '09:00:00',
      end_time: '09:50:00',
      client_notes: null,
      business_notes: 'הערה פנימית',
    });
  });
});

describe('assignGroupRoles', () => {
  it('merges only consecutive events of the same client', () => {
    const roles = assignGroupRoles([
      {
        eventId: 'a',
        clientId: 1,
        date: '2026-08-20',
        startMinutes: 540,
        endMinutes: 560,
      },
      {
        eventId: 'b',
        clientId: 1,
        date: '2026-08-20',
        startMinutes: 560,
        endMinutes: 590,
      },
      {
        eventId: 'c',
        clientId: 2,
        date: '2026-08-20',
        startMinutes: 590,
        endMinutes: 620,
      },
    ]);

    expect(roles.get('a')).toBe('start');
    expect(roles.get('b')).toBe('end');
    expect(roles.get('c')).toBe('single');
  });
});
