import { supabase } from '../../supabaseClient';

interface Credentials {
  email: string;
  password: string;
}

export async function signInWithEmail(credentials: Credentials) {
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    throw new Error(error.message);
  }
}

export async function signUpWithEmail(credentials: Credentials) {
  const { data, error } = await supabase.auth.signUp(credentials);

  if (error) {
    throw new Error(error.message);
  }

  return {
    requiresEmailConfirmation: data.user !== null && data.session === null,
  };
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  });

  if (error) {
    throw new Error(error.message);
  }
}
