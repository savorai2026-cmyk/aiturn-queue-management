import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import type { Database } from './types/database';

interface FeaturnRuntimeConfig {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

const runtimeConfig = (window as Window & {
  __FEATURN_CONFIG__?: FeaturnRuntimeConfig;
}).__FEATURN_CONFIG__;

const supabaseUrl =
  runtimeConfig?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  runtimeConfig?.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

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