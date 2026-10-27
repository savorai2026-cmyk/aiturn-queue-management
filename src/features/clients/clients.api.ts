import { supabase } from '../../supabaseClient';
import { normalizeClientValues } from './clients.mappers';
import type {
  Client,
  ClientFormValues,
  ClientInsert,
} from './clients.types';
import type { Json } from '../../types/database';

export async function getClients(businessCode: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('business_code', businessCode)
    .is('deleted_at', null)
    .order('id', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createClient(
  businessCode: string,
  values: ClientFormValues,
): Promise<void> {
  const client: ClientInsert = {
    ...normalizeClientValues(values),
    business_code: businessCode,
    mobile_phone: values.mobile_phone.trim(),
  };

  const { error } = await supabase.from('clients').insert(client);

  if (!error) {
    return;
  }

  if (error.message.includes('unique_mobile_per_business')) {
    const { data: existing, error: lookupError } = await supabase
      .from('clients')
      .select('id, deleted_at')
      .eq('business_code', businessCode)
      .eq('mobile_phone', client.mobile_phone)
      .maybeSingle();

    if (!lookupError && existing?.deleted_at) {
      const { error: restoreError } = await supabase
        .from('clients')
        .update({
          ...normalizeClientValues(values),
          mobile_phone: client.mobile_phone,
          deleted_at: null,
        })
        .eq('business_code', businessCode)
        .eq('id', existing.id);

      if (restoreError) {
        throw new Error(restoreError.message);
      }
      return;
    }
  }

  throw new Error(error.message);
}

export async function updateClient(
  businessCode: string,
  clientId: number,
  values: ClientFormValues,
): Promise<void> {
  const update = normalizeClientValues(values);
  const { error } = await supabase
    .from('clients')
    .update(update)
    .eq('business_code', businessCode)
    .eq('id', clientId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function countClientUpcomingAppointments(
  businessCode: string,
  clientId: number,
): Promise<number> {
  const { data, error } = await supabase.rpc('count_client_upcoming_appointments', {
    p_business_code: businessCode,
    p_client_id: clientId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return typeof data === 'number' ? data : 0;
}

export async function queueClientCancellationNotices(
  businessCode: string,
  clientId: number,
): Promise<number> {
  const { data, error } = await supabase.rpc('queue_client_cancellation_notices', {
    p_business_code: businessCode,
    p_client_id: clientId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return typeof data === 'number' ? data : 0;
}

export interface CancellationNoticeResult {
  pending: number;
  sent: number;
  failed: number;
  errorText: string | null;
}

function noticeCount(value: Json | undefined) {
  return typeof value === 'number' ? value : 0;
}

export async function clientCancellationNoticeResult(
  businessCode: string,
  clientId: number,
): Promise<CancellationNoticeResult> {
  const { data, error } = await supabase.rpc('client_cancellation_notice_result', {
    p_business_code: businessCode,
    p_client_id: clientId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = (data ?? {}) as {
    pending?: Json;
    sent?: Json;
    failed?: Json;
    error_text?: Json;
  };

  return {
    pending: noticeCount(result.pending),
    sent: noticeCount(result.sent),
    failed: noticeCount(result.failed),
    errorText: typeof result.error_text === 'string' ? result.error_text : null,
  };
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export async function sendCancellationNotices(
  businessCode: string,
  clientId: number,
): Promise<CancellationNoticeResult> {
  const queued = await queueClientCancellationNotices(businessCode, clientId);
  if (queued === 0) {
    return { pending: 0, sent: 0, failed: 0, errorText: null };
  }

  const started = Date.now();
  let result = await clientCancellationNoticeResult(businessCode, clientId);
  while (result.pending > 0 && Date.now() - started < 20000) {
    await wait(1000);
    result = await clientCancellationNoticeResult(businessCode, clientId);
  }

  return result;
}

export function cancellationNoticeError(result: CancellationNoticeResult) {
  if (result.sent > 0 || (result.pending === 0 && result.failed === 0)) {
    return '';
  }

  if (result.pending > 0) {
    return 'העדכון ללקוח עדיין נשלח. הלקוח לא נמחק. נסה שוב בעוד רגע.';
  }

  if (result.errorText === 'appointment_canceled') {
    return 'העדכון לא נשלח כי התור סומן כמבוטל לפני ההודעה. הלקוח לא נמחק.';
  }

  return 'לא הצלחנו לשלוח ללקוח עדכון על הביטול. הלקוח לא נמחק.';
}

export async function deleteClient(
  businessCode: string,
  clientId: number,
): Promise<void> {
  const { error } = await supabase.rpc('delete_client', {
    p_business_code: businessCode,
    p_client_id: clientId,
  });

  if (error) {
    throw new Error(error.message);
  }
}
