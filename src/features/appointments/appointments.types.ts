import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from '../../types/database';

export type AppointmentRow = Tables<'appointments'>;
export type AppointmentInsert = TablesInsert<'appointments'>;
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
  | 'color_code'
>;

export interface CreateAppointmentRequest {
  businessCode: string;
  clientId: number;
  appointmentDate: string;
  startTime: string;
  serviceIds: number[];
  status: AppointmentStatus;
  clientNotes: string;
  businessNotes: string;
}

export interface CreatedAppointment {
  appointmentId: number;
  endTime: string;
  totalDurationMinutes: number;
  totalPrice: number;
}

export interface AppointmentAvailabilitySlot {
  startTime: string;
  endTime: string;
}

export const APPOINTMENT_STATUSES = [
  'waiting',
  'scheduled',
  'canceled',
  'completed',
  'no_show',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export interface AppointmentWithClient extends AppointmentRow {
  clients: ClientSummary | null;
}

export interface AppointmentDetails extends AppointmentRow {
  patientName: string;
  clientPhone: string | null;
  time: string;
  notes: string | null;
}

export interface AppointmentEditValues {
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  client_notes: string;
  business_notes: string;
}
