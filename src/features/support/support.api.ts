import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import { getErrorMessage } from '../../shared/errors';
import type { SupportDraft } from './supportMail';

export async function sendSupportRequest(
  draft: SupportDraft & { businessCode: string },
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('support-request', {
    body: {
      business_code: draft.businessCode,
      subject: draft.subject,
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
      message: draft.message,
      business_name: draft.businessName,
    },
  });

  if (error) {
    let message = getErrorMessage(error);
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = (await error.context.json()) as { error?: string };
        message = payload.error || message;
      } catch {
        // Keep the original Functions error message.
      }
    }
    throw new Error(message);
  }

  const payload = (data ?? {}) as { error?: string };
  if (payload.error) {
    throw new Error(payload.error);
  }
}
