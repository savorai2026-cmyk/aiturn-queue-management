import { supabase } from '../../supabaseClient';

export interface TotpFactor {
  id: string;
  friendlyName: string | null;
  createdAt: string;
}

export interface TotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export async function listTotpFactors(): Promise<TotpFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    throw new Error(error.message);
  }
  return data.totp.map((factor) => ({
    id: factor.id,
    friendlyName: factor.friendly_name ?? null,
    createdAt: factor.created_at,
  }));
}

export async function needsMfaChallenge(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) {
    throw new Error(error.message);
  }
  return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
}

export async function startTotpEnrollment(): Promise<TotpEnrollment> {
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const factor of existing?.all ?? []) {
    if (factor.factor_type === 'totp' && factor.status !== 'verified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `QGent ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error) {
    throw new Error(error.message);
  }
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: code.replace(/\s/g, ''),
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function removeTotpFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    throw new Error(error.message);
  }
}
