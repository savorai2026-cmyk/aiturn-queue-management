import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import type { Database } from './types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variable',
  );
}

const globalWithSupabase = globalThis as typeof globalThis & {
  featurnSupabase?: SupabaseClient<Database>;
};

// Reuse the client during Vite hot reloads to avoid duplicate auth listeners.
export const supabase =
  globalWithSupabase.featurnSupabase ??
  createClient<Database>(supabaseUrl, supabaseAnonKey);

if (import.meta.env.DEV) {
  globalWithSupabase.featurnSupabase = supabase;
}