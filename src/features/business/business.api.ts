import { supabase } from '../../supabaseClient';
import type {
  BusinessMembership,
  BusinessRole,
  CreateBusinessInput,
} from './BusinessContextState';

interface MembershipRow {
  business_code: string;
  role: BusinessRole;
  businesses:
    | { business_name: string }
    | { business_name: string }[]
    | null;
}

export async function getBusinessMemberships(
  userId: string,
): Promise<BusinessMembership[]> {
  const { data, error } = await supabase
    .from('business_members')
    .select(`
      business_code,
      role,
      businesses!inner (
        business_name
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as MembershipRow[]).map((row) => {
    const business = Array.isArray(row.businesses)
      ? row.businesses[0]
      : row.businesses;

    return {
      businessCode: row.business_code,
      businessName: business?.business_name ?? 'עסק ללא שם',
      role: row.role,
    };
  });
}

export async function createBusiness(
  input: CreateBusinessInput,
): Promise<void> {
  const { error } = await supabase.rpc('create_business', {
    p_business_name: input.businessName.trim(),
    p_contact_phone: input.contactPhone?.trim() || undefined,
  });

  if (error) {
    throw new Error(error.message);
  }
}
