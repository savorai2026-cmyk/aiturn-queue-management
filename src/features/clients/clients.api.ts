import { supabase } from '../../supabaseClient';
import { normalizeClientValues } from './clients.mappers';
import type {
  Client,
  ClientFormValues,
  ClientInsert,
} from './clients.types';

export async function getClients(businessCode: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('business_code', businessCode)
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

  if (error) {
    throw new Error(error.message);
  }
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
