import type {
  Json,
  Tables,
  TablesUpdate,
} from '../../types/database';

export type AppointmentRow = Tables<'appointments'>;
export type AppointmentUpdate = TablesUpdate<'appointments'>;
export type AppointmentServiceRow = Tables<'appointment_services'>;
export type ClientSummary = Pick<
  Tables<'clients'>,
  'full_name' | 'mobile_phone'
>;
export type AppointmentClientOption = Pick<
  Tables<'clients'>,
  'id' | 'full_name' | 'mobile_phone'
>;
export type AppointmentServiceOption = Pick<
  Tables<'services'>,
  | 'id'
  | 'title'
  | 'description'
  | 'duration_minutes'
  | 'buffer_time_minutes'
  | 'price'
>;

export type AppointmentStatus = string;

export interface AppointmentWithClient extends AppointmentRow {
  clients: ClientSummary | null;
  appointment_services: AppointmentServiceRow[] | null;
}

export interface TimedAppointmentService {
  serviceId: number;
  title: string;
  durationMinutes: number;
  bufferMinutes: number;
  price: number;
  startTime: string;
  endTime: string;
  position: number;
  colorCode: string | null;
}

export interface AppointmentDetails extends AppointmentRow {
  patientName: string;
  clientPhone: string | null;
  time: string;
  notes: string | null;
  services: TimedAppointmentService[];
}

export interface AppointmentEditValues {
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  price: number;
  client_notes: string;
  business_notes: string;
  servicePrices: Array<{ serviceId: number; price: number }>;
}

export interface BusinessCalendarSettings {
  workingHours: Json | null;
  slotDurationMinutes: number | null;
  maxAdvBookingDays: number | null;
  timezone: string | null;
}

export interface CalendarEventSegment {
  appointmentId: number;
  serviceId: number;
  status: string;
  startMinutes: number;
  endMinutes: number;
}

export interface CalendarEventProps {
  appointmentId: number;
  serviceId: number;
  clientId: number;
  clientPhone: string | null;
  status: string;
  groupRole: 'single' | 'start' | 'middle' | 'end' | 'combined';
  timeLabel: string;
  serviceTitle: string;
  clientName: string;
  tooltip: string;
  holdLabel?: string;
  /** Calendar date and start, so a stretch can be told apart from a drag. */
  date?: string;
  startHm?: string;
  /** Later appointments in the same back-to-back visit. */
  continuationIds?: number[];
  segments?: CalendarEventSegment[];
}

export interface SchedulerSlot {
  startTime: string;
  endTime: string;
}
