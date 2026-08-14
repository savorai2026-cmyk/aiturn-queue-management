import { supabase } from '../../supabaseClient';
import type {
  BusinessSettings,
  EditableBusinessSettings,
  Service,
} from './settings.types';

export async function getBusinessSettings(
  businessCode: string,
): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from('businesses')
    .select(`
      business_code,
      business_name,
      contact_phone,
      vapi_assistant_id,
      wa_instance_id
    `)
    .eq('business_code', businessCode)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
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

export async function updateBusinessSettings(
  businessCode: string,
  settings: EditableBusinessSettings,
): Promise<void> {
  const { error } = await supabase
    .from('businesses')
    .update(settings)
    .eq('business_code', businessCode);

  if (error) {
    throw new Error(error.message);
  }
}
