import { supabase } from '../../supabaseClient';
import type { Json } from '../../types/database';
import { parseUiPreferences } from './preferences';
import type { UiPreferences } from './types';

export interface UiPreferenceSources {
  memberId: string | null;
  memberPrefs: UiPreferences;
  businessPrefs: UiPreferences;
}

export async function getUiPreferenceSources(
  businessCode: string,
  userId: string,
): Promise<UiPreferenceSources> {
  const [businessResult, memberResult] = await Promise.all([
    supabase
      .from('businesses')
      .select('ui_preferences')
      .eq('business_code', businessCode)
      .single(),
    supabase
      .from('business_members')
      .select('id, ui_preferences')
      .eq('business_code', businessCode)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  if (businessResult.error) {
    throw new Error(businessResult.error.message);
  }

  if (memberResult.error) {
    throw new Error(memberResult.error.message);
  }

  return {
    memberId: memberResult.data?.id ?? null,
    memberPrefs: parseUiPreferences(memberResult.data?.ui_preferences as Json),
    businessPrefs: parseUiPreferences(businessResult.data?.ui_preferences as Json),
  };
}

export async function updateMemberUiPreferences(
  memberId: string,
  preferences: UiPreferences,
): Promise<void> {
  const { data, error } = await supabase
    .from('business_members')
    .update({ ui_preferences: preferences as Json })
    .eq('id', memberId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('לא ניתן לשמור את העדפות התצוגה.');
  }
}
