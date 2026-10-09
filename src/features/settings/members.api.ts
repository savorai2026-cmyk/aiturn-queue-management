import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import { getErrorMessage } from '../../shared/errors';
import { getAuthEmailRedirectTo } from '../auth/authRedirect';

export interface BusinessMemberAccount {
  userId: string;
  email: string;
  role: string;
  status: string;
  emailConfirmed: boolean;
  createdAt: string;
}

interface MembersResponse {
  members?: BusinessMemberAccount[];
  error?: string;
}

async function invokeMembers<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('manage-business-users', {
    body,
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

  const payload = (data ?? {}) as T & { error?: string };
  if (payload.error) {
    throw new Error(payload.error);
  }
  return payload;
}

export async function listBusinessMembers(
  businessCode: string,
): Promise<BusinessMemberAccount[]> {
  const payload = await invokeMembers<MembersResponse>({
    action: 'list',
    business_code: businessCode,
  });
  return payload.members ?? [];
}

export async function createBusinessMember(input: {
  businessCode: string;
  email: string;
  password: string;
}): Promise<void> {
  await invokeMembers({
    action: 'create',
    business_code: input.businessCode,
    email: input.email,
    password: input.password,
    redirect_to: getAuthEmailRedirectTo(),
  });
}

export async function removeBusinessMember(input: {
  businessCode: string;
  userId: string;
}): Promise<void> {
  await invokeMembers({
    action: 'remove',
    business_code: input.businessCode,
    user_id: input.userId,
  });
}

export async function closeBusinessAccount(businessCode: string): Promise<void> {
  const { error } = await supabase.rpc('close_business_account', {
    p_business_code: businessCode,
  });

  if (error) {
    throw new Error(error.message);
  }
}
