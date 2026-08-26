import type { DisplayField, DisplayScope } from './types';

export const CLIENT_FIELDS: DisplayField[] = [
  { key: 'full_name', label: 'שם מלא', defaultVisible: true },
  { key: 'mobile_phone', label: 'נייד', defaultVisible: true, dir: 'ltr' },
  { key: 'city', label: 'עיר', defaultVisible: true },
  { key: 'last_contact', label: 'תאריך הצטרפות', defaultVisible: true },
  { key: 'id', label: 'מזהה', defaultVisible: true },
  { key: 'national_id', label: 'ת.ז', defaultVisible: false },
  { key: 'gender', label: 'מין', defaultVisible: false },
  { key: 'birth_date_gregorian', label: 'ת.לידה לועזי', defaultVisible: false },
  { key: 'birth_date_hebrew', label: 'ת.לידה עברי', defaultVisible: false },
  { key: 'language', label: 'שפה', defaultVisible: false },
  { key: 'landline_phone', label: 'נייח', defaultVisible: false, dir: 'ltr' },
  { key: 'whatsapp_number', label: 'וואטסאפ', defaultVisible: false, dir: 'ltr' },
  { key: 'allows_sms', label: 'מקבל SMS', defaultVisible: false },
  { key: 'email', label: 'אימייל', defaultVisible: false, dir: 'ltr' },
  { key: 'street', label: 'רחוב', defaultVisible: false },
  { key: 'building_number', label: 'בניין', defaultVisible: false },
  { key: 'apartment_number', label: 'דירה', defaultVisible: false },
  { key: 'entrance', label: 'כניסה', defaultVisible: false },
  { key: 'floor', label: 'קומה', defaultVisible: false },
  { key: 'zip_code', label: 'מיקוד', defaultVisible: false },
  { key: 'po_box', label: 'ת.ד', defaultVisible: false },
  { key: 'acquisition_source', label: 'מקור הגעה', defaultVisible: false },
  { key: 'preferred_channel', label: 'ערוץ מועדף', defaultVisible: false },
];

export const APPOINTMENT_FIELDS: DisplayField[] = [
  { key: 'patientName', label: 'שם מטופל', defaultVisible: true },
  { key: 'hours', label: 'שעות', defaultVisible: true },
  { key: 'appointment_date', label: 'תאריך', defaultVisible: true },
  { key: 'status', label: 'סטטוס', defaultVisible: true },
  { key: 'services', label: 'שירותים ומחירים', defaultVisible: true },
  { key: 'client_notes', label: 'הערות לקוח', defaultVisible: true },
  { key: 'business_notes', label: 'הערות עסק', defaultVisible: true },
  { key: 'clientPhone', label: 'טלפון', defaultVisible: false, dir: 'ltr' },
  { key: 'channel', label: 'ערוץ הזמנה', defaultVisible: false },
  { key: 'price', label: 'מחיר כולל', defaultVisible: false },
];

export const SERVICE_FIELDS: DisplayField[] = [
  { key: 'service_code', label: 'קוד שירות', defaultVisible: true },
  { key: 'title', label: 'שם השירות', defaultVisible: true },
  { key: 'duration_minutes', label: 'משך (דקות)', defaultVisible: true },
  { key: 'price', label: 'מחיר (₪)', defaultVisible: true },
  { key: 'color_code', label: 'צבע', defaultVisible: true },
  { key: 'is_active', label: 'סטטוס', defaultVisible: true },
  { key: 'description', label: 'תיאור', defaultVisible: false },
  { key: 'buffer_time_minutes', label: 'זמן חיץ (דקות)', defaultVisible: false },
  { key: 'deposit_amount', label: 'פיקדון (₪)', defaultVisible: false },
];

export const STATUS_FIELDS: DisplayField[] = [
  { key: 'status_code', label: 'קוד סטטוס', defaultVisible: true, dir: 'ltr' },
  { key: 'status_text', label: 'שם הסטטוס', defaultVisible: true },
  { key: 'color', label: 'צבע', defaultVisible: true },
  { key: 'created_at', label: 'נוצר ב', defaultVisible: false },
];

export const BUSINESS_FIELDS: DisplayField[] = [
  { key: 'business_name', label: 'שם העסק', defaultVisible: true },
  { key: 'contact_phone', label: 'טלפון ליצירת קשר', defaultVisible: true, dir: 'ltr' },
  { key: 'email', label: 'אימייל', defaultVisible: false, dir: 'ltr' },
  { key: 'agent_phone_number', label: 'טלפון סוכן', defaultVisible: false, dir: 'ltr' },
  { key: 'timezone', label: 'אזור זמן', defaultVisible: false, dir: 'ltr' },
  { key: 'slot_duration_minutes', label: 'משך משבצת (דקות)', defaultVisible: false },
  { key: 'max_adv_booking_days', label: 'הזמנה מראש (ימים)', defaultVisible: false },
];

const CATALOGS: Record<DisplayScope, DisplayField[]> = {
  clients: CLIENT_FIELDS,
  appointments: APPOINTMENT_FIELDS,
  services: SERVICE_FIELDS,
  business: BUSINESS_FIELDS,
  statuses: STATUS_FIELDS,
};

export function getDisplayCatalog(scope: DisplayScope): DisplayField[] {
  return CATALOGS[scope];
}

export function getDefaultVisibleKeys(scope: DisplayScope): string[] {
  return getDisplayCatalog(scope)
    .filter((field) => field.defaultVisible)
    .map((field) => field.key);
}
