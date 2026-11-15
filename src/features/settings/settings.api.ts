import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import { getErrorMessage } from '../../shared/errors';
import { decodeAudioBase64, readAgentVoices, type AgentVoiceOption } from './agentVoices';
import type {
  AppointmentStatusRow,
  AppointmentStatusUpdate,
  BusinessSettings,
  EditableBusinessSettings,
  OperatingHoursUpdate,
  Service,
  ServiceInsert,
  ServiceUpdate,
} from './settings.types';
import { parseDepositPercent } from './settings.mappers';
import { parseSubscriptionPlan, type SubscriptionPlan } from '../usage/planPricing';
import {
  MissingAgentVoiceColumnError,
  isMissingAgentVoiceColumn,
} from './agentVoiceColumn';

const businessColumns = `
  business_code,
  business_name,
  contact_phone,
  email,
  agent_phone_number,
  owner_alert_channel,
  owner_alert_phone,
  owner_alert_lead_hours,
  timezone,
  slot_duration_minutes,
  deposit_percent,
  default_payment_requirement,
  payment_payee_name,
  payment_instructions,
  payment_hold_hours,
  agent_prompt,
  cancellation_policy,
  arrival_address,
  arrival_parking,
  arrival_waze_url,
  arrival_photo_paths,
  save_recordings,
  recordings_retention_days,
  history_retention_months,
  voice_log_retention_months,
  whatsapp_retention_months,
  subscription_plan,
  storage_quota_gb,
  is_active,
  closed_at,
  max_adv_booking_days,
  working_hours,
  vapi_assistant_id,
  wa_instance_id
`;

const businessColumnsWithoutArrival = `
  business_code,
  business_name,
  contact_phone,
  email,
  agent_phone_number,
  owner_alert_channel,
  owner_alert_phone,
  owner_alert_lead_hours,
  timezone,
  slot_duration_minutes,
  deposit_percent,
  default_payment_requirement,
  payment_payee_name,
  payment_instructions,
  payment_hold_hours,
  agent_prompt,
  cancellation_policy,
  save_recordings,
  recordings_retention_days,
  history_retention_months,
  voice_log_retention_months,
  whatsapp_retention_months,
  subscription_plan,
  storage_quota_gb,
  is_active,
  closed_at,
  max_adv_booking_days,
  working_hours,
  vapi_assistant_id,
  wa_instance_id
`;

let agentVoiceColumnAvailable = true;

function toBusinessSettings(
  data: Omit<BusinessSettings, 'deposit_percent' | 'agent_voice_id' | 'cancellation_policy'> & {
    deposit_percent: number | string;
    agent_voice_id?: string | null;
    cancellation_policy?: BusinessSettings['cancellation_policy'];
  },
): BusinessSettings {
  return {
    ...data,
    agent_voice_id: data.agent_voice_id ?? null,
    cancellation_policy: data.cancellation_policy ?? null,
    arrival_address: data.arrival_address ?? null,
    arrival_parking: data.arrival_parking ?? null,
    arrival_waze_url: data.arrival_waze_url ?? null,
    arrival_photo_paths: data.arrival_photo_paths ?? [],
    deposit_percent: parseDepositPercent(data.deposit_percent),
  };
}

export const ARRIVAL_BUCKET = 'business-arrival';
export const MAX_ARRIVAL_PHOTOS = 3;

export function arrivalPhotoPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .slice(0, MAX_ARRIVAL_PHOTOS);
}

export async function uploadArrivalPhoto(businessCode: string, file: File): Promise<string> {
  const ext = file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg';
  const path = `${businessCode}/${crypto.randomUUID()}${ext}`;
  const { error } = await supabase.storage.from(ARRIVAL_BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (error) {
    throw new Error(error.message);
  }
  return path;
}

export async function removeArrivalPhotos(paths: string[]): Promise<void> {
  const targets = paths.filter(Boolean);
  if (targets.length === 0) return;
  const { error } = await supabase.storage.from(ARRIVAL_BUCKET).remove(targets);
  if (error) {
    throw new Error(error.message);
  }
}

export async function arrivalPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(ARRIVAL_BUCKET).createSignedUrls(paths, 3600);
  if (error) {
    throw new Error(error.message);
  }
  const signed: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) {
      signed[item.path] = item.signedUrl;
    }
  }
  return signed;
}

function isMissingArrivalColumn(error: { message?: string } | null) {
  const message = (error?.message || '').toLowerCase();
  if (message.includes('permission denied') || message.includes('42501')) return false;
  const namesArrivalColumn = [
    'arrival_address',
    'arrival_parking',
    'arrival_waze_url',
    'arrival_photo_paths',
  ].some((column) => message.includes(column));
  return namesArrivalColumn && (
    message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('could not find')
  );
}

export async function getBusinessSettings(
  businessCode: string,
): Promise<BusinessSettings> {
  if (agentVoiceColumnAvailable) {
    const { data, error } = await supabase
      .from('businesses')
      .select(`${businessColumns}, agent_voice_id`)
      .eq('business_code', businessCode)
      .single();

    if (!error) {
      return toBusinessSettings(data);
    }

    if (isMissingArrivalColumn(error)) {
      const fallback = await supabase
        .from('businesses')
        .select(`${businessColumnsWithoutArrival}, agent_voice_id`)
        .eq('business_code', businessCode)
        .single();
      if (fallback.error) {
        throw new Error(fallback.error.message);
      }
      return toBusinessSettings({
        ...fallback.data,
        arrival_address: null,
        arrival_parking: null,
        arrival_waze_url: null,
        arrival_photo_paths: [],
      });
    }

    if (!isMissingAgentVoiceColumn(error)) {
      throw new Error(error.message);
    }

    agentVoiceColumnAvailable = false;
  }

  const { data, error } = await supabase
    .from('businesses')
    .select(businessColumns)
    .eq('business_code', businessCode)
    .single();

  if (error && isMissingArrivalColumn(error)) {
    const fallback = await supabase
      .from('businesses')
      .select(businessColumnsWithoutArrival)
      .eq('business_code', businessCode)
      .single();
    if (fallback.error) {
      throw new Error(fallback.error.message);
    }
    return toBusinessSettings({
      ...fallback.data,
      arrival_address: null,
      arrival_parking: null,
      arrival_waze_url: null,
      arrival_photo_paths: [],
    });
  }

  if (error) {
    throw new Error(error.message);
  }

  return toBusinessSettings(data);
}

export async function getServices(businessCode: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('business_code', businessCode)
    .order('title', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createService(service: ServiceInsert): Promise<Service> {
  const { data, error } = await supabase
    .from('services')
    .insert(service)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateService(
  businessCode: string,
  serviceId: number,
  values: ServiceUpdate,
): Promise<Service> {
  const { data, error } = await supabase
    .from('services')
    .update(values)
    .eq('business_code', businessCode)
    .eq('id', serviceId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

function isMissingRpc(error: { code?: string; message: string }): boolean {
  return (
    error.code === 'PGRST202' ||
    error.message.toLowerCase().includes('could not find the function')
  );
}

export async function deleteService(
  businessCode: string,
  serviceId: number,
): Promise<void> {
  const rpc = await supabase.rpc('delete_catalog_service', {
    p_business_code: businessCode,
    p_service_id: serviceId,
  });

  if (!rpc.error) {
    return;
  }

  if (!isMissingRpc(rpc.error)) {
    throw new Error(rpc.error.message);
  }

  const unlinkedAppointments = await supabase
    .from('appointments')
    .update({ service_id: null })
    .eq('business_code', businessCode)
    .eq('service_id', serviceId);

  if (unlinkedAppointments.error) {
    throw new Error(unlinkedAppointments.error.message);
  }

  const unlinkedLines = await supabase
    .from('appointment_services')
    .delete()
    .eq('business_code', businessCode)
    .eq('service_id', serviceId);

  if (unlinkedLines.error) {
    throw new Error(unlinkedLines.error.message);
  }

  const { data, error } = await supabase
    .from('services')
    .delete()
    .eq('business_code', businessCode)
    .eq('id', serviceId)
    .select('id');

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error('לא ניתן למחוק את השירות. ייתכן שחסרה הרשאת מחיקה.');
  }
}

export async function getStatuses(
  businessCode: string,
): Promise<AppointmentStatusRow[]> {
  const { data, error } = await supabase
    .from('statuses')
    .select('*')
    .eq('business_code', businessCode)
    .order('status_text', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateStatus(
  businessCode: string,
  statusCode: string,
  values: AppointmentStatusUpdate,
): Promise<AppointmentStatusRow> {
  const { data, error } = await supabase
    .from('statuses')
    .update(values)
    .eq('business_code', businessCode)
    .eq('status_code', statusCode)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getBusinessStorageUsedBytes(
  businessCode: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('business_storage_used_bytes', {
    p_business_code: businessCode,
  });

  if (error) {
    throw new Error(error.message);
  }

  const parsed = typeof data === 'number' ? data : Number(data);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getBusinessSubscriptionPlan(
  businessCode: string,
): Promise<SubscriptionPlan> {
  const { data, error } = await supabase
    .from('businesses')
    .select('subscription_plan')
    .eq('business_code', businessCode)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return parseSubscriptionPlan(data.subscription_plan);
}

export async function getBusinessStorageQuotaGb(
  businessCode: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('businesses')
    .select('storage_quota_gb')
    .eq('business_code', businessCode)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.storage_quota_gb;
}

export async function getBusinessPlanUsage(
  businessCode: string,
): Promise<{
  memberCount: number;
  voiceSeconds: number;
  whatsappCustomerWindows: number;
  whatsappBusinessWindows: number;
}> {
  const { data, error } = await supabase.rpc('business_plan_usage', {
    p_business_code: businessCode,
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as {
    member_count?: unknown;
    voice_seconds?: unknown;
    whatsapp_windows?: unknown;
    whatsapp_customer_windows?: unknown;
    whatsapp_business_windows?: unknown;
  };
  const memberCount = Number(payload.member_count);
  const voiceSeconds = Number(payload.voice_seconds);
  const customerWindows = Number(payload.whatsapp_customer_windows);
  const businessWindows = Number(payload.whatsapp_business_windows);
  const legacyWindows = Number(payload.whatsapp_windows);

  return {
    memberCount: Number.isFinite(memberCount) ? memberCount : 0,
    voiceSeconds: Number.isFinite(voiceSeconds) ? voiceSeconds : 0,
    whatsappCustomerWindows: Number.isFinite(customerWindows)
      ? customerWindows
      : Number.isFinite(legacyWindows)
        ? legacyWindows
        : 0,
    whatsappBusinessWindows: Number.isFinite(businessWindows) ? businessWindows : 0,
  };
}

function assertBusinessUpdated(rows: unknown[] | null) {
  if (!rows?.length) {
    throw new Error('השינויים לא נשמרו. ייתכן שחסרה הרשאת עריכה לעסק.');
  }
}

function withoutAgentVoice(
  settings: Partial<EditableBusinessSettings>,
): Partial<EditableBusinessSettings> {
  const rest = { ...settings };
  delete rest.agent_voice_id;
  return rest;
}

function withoutArrival(
  settings: Partial<EditableBusinessSettings>,
): Partial<EditableBusinessSettings> {
  const rest = { ...settings };
  delete rest.arrival_address;
  delete rest.arrival_parking;
  delete rest.arrival_waze_url;
  delete rest.arrival_photo_paths;
  return rest;
}

export async function updateBusinessSettings(
  businessCode: string,
  settings: Partial<EditableBusinessSettings>,
): Promise<void> {
  const requestedVoice = 'agent_voice_id' in settings
    ? settings.agent_voice_id?.trim() || null
    : undefined;
  const payload = agentVoiceColumnAvailable ? settings : withoutAgentVoice(settings);
  const { data, error } = Object.keys(payload).length === 0
    ? { data: [{ business_code: businessCode }], error: null }
    : await supabase
      .from('businesses')
      .update(payload)
      .eq('business_code', businessCode)
      .select('business_code');

  if (error && isMissingAgentVoiceColumn(error)) {
    agentVoiceColumnAvailable = false;
    const rest = withoutAgentVoice(settings);
    if (Object.keys(rest).length > 0) {
      const retry = await supabase
        .from('businesses')
        .update(rest)
        .eq('business_code', businessCode)
        .select('business_code');
      if (retry.error) {
        throw new Error(retry.error.message);
      }
      assertBusinessUpdated(retry.data);
    }
  } else if (error && isMissingArrivalColumn(error)) {
    const rest = withoutArrival(settings);
    if (Object.keys(rest).length > 0) {
      const retry = await supabase
        .from('businesses')
        .update(rest)
        .eq('business_code', businessCode)
        .select('business_code');
      if (retry.error) {
        throw new Error(retry.error.message);
      }
      assertBusinessUpdated(retry.data);
    }
    throw new Error('שאר ההגדרות נשמרו. פרטי ההגעה לא נשמרו כי העמודות עדיין לא קיימות במסד.');
  } else if (error) {
    const message = error.message || '';
    if (/permission denied/i.test(message) && /arrival_/i.test(message)) {
      throw new Error('אין הרשאה לשמור את פרטי ההגעה.');
    }
    throw new Error(message);
  } else {
    assertBusinessUpdated(data);
  }

  if (!agentVoiceColumnAvailable && requestedVoice) {
    throw new MissingAgentVoiceColumnError();
  }
}

export interface ClosureDemandRow {
  range_date: string;
  range_start: string;
  range_end: string;
  state: string;
}

export async function listClosureDemand(
  businessCode: string,
): Promise<ClosureDemandRow[]> {
  const { data, error } = await supabase
    .from('closure_demand')
    .select('range_date, range_start, range_end, state')
    .eq('business_code', businessCode)
    .order('range_date', { ascending: false })
    .limit(300);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function updateOperatingHours(
  businessCode: string,
  settings: OperatingHoursUpdate,
): Promise<void> {
  const { data, error } = await supabase
    .from('businesses')
    .update(settings)
    .eq('business_code', businessCode)
    .select('business_code');

  if (error) {
    throw new Error(error.message);
  }
  assertBusinessUpdated(data);
}

export async function rewriteAgentPrompt(
  businessCode: string,
  draft: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('rewrite-agent-prompt', {
    body: {
      business_code: businessCode,
      draft,
    },
  });

  if (error) {
    let message = getErrorMessage(error);

    if (error instanceof FunctionsHttpError) {
      try {
        const body = (await error.context.json()) as { error?: string };
        message = body.error || message;
      } catch {
        // Keep the original Functions error message.
      }
    }

    throw new Error(message);
  }

  const payload = (data ?? {}) as { text?: unknown; error?: string };
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  if (!text) {
    throw new Error(payload.error || 'Empty rewrite');
  }

  return text;
}

async function functionErrorMessage(error: unknown): Promise<string> {
  let message = getErrorMessage(error);

  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };
      message = body.error || message;
    } catch {
      // Keep the original Functions error message.
    }
  }

  return message;
}

export async function listAgentVoices(
  businessCode: string,
): Promise<AgentVoiceOption[]> {
  const { data, error } = await supabase.functions.invoke('agent-voices', {
    body: { business_code: businessCode },
  });

  if (error) {
    throw new Error(await functionErrorMessage(error));
  }

  const payload = (data ?? {}) as { voices?: unknown };
  return readAgentVoices(payload.voices);
}

export async function fetchAgentVoicePreview(
  businessCode: string,
  voiceId: string,
): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke('agent-voices', {
    body: {
      business_code: businessCode,
      voice_id: voiceId,
    },
  });

  if (error) {
    throw new Error(await functionErrorMessage(error));
  }

  const payload = (data ?? {}) as {
    audio_base64?: unknown;
    content_type?: unknown;
    error?: string;
  };
  const audio = typeof payload.audio_base64 === 'string' ? payload.audio_base64 : '';
  const contentType = typeof payload.content_type === 'string' ? payload.content_type : '';
  if (!audio) {
    throw new Error(payload.error || 'Voice has no preview');
  }

  return decodeAudioBase64(audio, contentType);
}
