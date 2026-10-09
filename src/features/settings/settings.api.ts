import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import { getErrorMessage } from '../../shared/errors';
import type {
  AppointmentStatusInsert,
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

export async function getBusinessSettings(
  businessCode: string,
): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from('businesses')
    .select(`
      business_code,
      business_name,
      contact_phone,
      email,
      agent_phone_number,
      timezone,
      slot_duration_minutes,
      deposit_percent,
      agent_prompt,
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
    `)
    .eq('business_code', businessCode)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    ...data,
    deposit_percent: parseDepositPercent(data.deposit_percent),
  };
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

export async function createStatus(
  status: AppointmentStatusInsert,
): Promise<AppointmentStatusRow> {
  const { data, error } = await supabase
    .from('statuses')
    .insert(status)
    .select()
    .single();

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

export async function deleteStatus(
  businessCode: string,
  statusCode: string,
): Promise<void> {
  const rpc = await supabase.rpc('delete_catalog_status', {
    p_business_code: businessCode,
    p_status_code: statusCode,
  });

  if (!rpc.error) {
    return;
  }

  if (!isMissingRpc(rpc.error)) {
    throw new Error(rpc.error.message);
  }

  const { data, error } = await supabase
    .from('statuses')
    .delete()
    .eq('business_code', businessCode)
    .eq('status_code', statusCode)
    .select('status_code');

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    throw new Error('לא ניתן למחוק את הסטטוס.');
  }
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
): Promise<{ memberCount: number; voiceSeconds: number }> {
  const { data, error } = await supabase.rpc('business_plan_usage', {
    p_business_code: businessCode,
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload = (data ?? {}) as {
    member_count?: unknown;
    voice_seconds?: unknown;
  };
  const memberCount = Number(payload.member_count);
  const voiceSeconds = Number(payload.voice_seconds);

  return {
    memberCount: Number.isFinite(memberCount) ? memberCount : 0,
    voiceSeconds: Number.isFinite(voiceSeconds) ? voiceSeconds : 0,
  };
}

export async function updateBusinessSettings(
  businessCode: string,
  settings: Partial<EditableBusinessSettings>,
): Promise<void> {
  const { error } = await supabase
    .from('businesses')
    .update(settings)
    .eq('business_code', businessCode);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateOperatingHours(
  businessCode: string,
  settings: OperatingHoursUpdate,
): Promise<void> {
  const { error } = await supabase
    .from('businesses')
    .update(settings)
    .eq('business_code', businessCode);

  if (error) {
    throw new Error(error.message);
  }
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
