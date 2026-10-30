import { supabase } from '../../supabaseClient';
import { getAuthEmailRedirectTo } from './authRedirect';
import { termsAcceptanceMetadata } from './termsOfUse';

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

export async function signUpWithEmail(
  credentials: Credentials & { termsAcceptedAt: string },
) {
  const { email, password, termsAcceptedAt } = credentials;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthEmailRedirectTo(),
      data: termsAcceptanceMetadata(termsAcceptedAt),
    },
  });

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
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthEmailRedirectTo(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw new Error(error.message);
  }
}

export async function recordTermsAcceptance(acceptedAt: string) {
  const { error } = await supabase.auth.updateUser({
    data: termsAcceptanceMetadata(acceptedAt),
  });

  if (error) {
    throw new Error(error.message);
  }
}
