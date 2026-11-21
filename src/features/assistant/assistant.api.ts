import { FunctionsHttpError } from '@supabase/supabase-js';
import type { AppTab } from '../../app/navigation.ts';
import { getErrorMessage } from '../../shared/errors.ts';
import { supabase } from '../../supabaseClient.ts';

export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function askOwnerAssistant(input: {
  businessCode: string;
  tab: AppTab;
  messages: AssistantTurn[];
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke('owner-assistant', {
    body: {
      business_code: input.businessCode,
      tab: input.tab,
      messages: input.messages,
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
    throw new Error(payload.error || 'Empty answer');
  }
  return text;
}
