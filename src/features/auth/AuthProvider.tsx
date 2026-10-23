import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import { AuthContext } from './AuthContextState';
import { readAuthCallbackFromLocation } from './authRedirect';
import { needsMfaChallenge } from './mfa.api';
import { getAuthCallbackErrorMessage } from '../../shared/errors';

const PASSWORD_RECOVERY_KEY = 'featurn-password-recovery';

interface AuthProviderProps {
  children: ReactNode;
}

function readPasswordRecoveryFlag() {
  try {
    return sessionStorage.getItem(PASSWORD_RECOVERY_KEY) === '1';
  } catch {
    return false;
  }
}

function writePasswordRecoveryFlag(isRecovering: boolean) {
  try {
    if (isRecovering) {
      sessionStorage.setItem(PASSWORD_RECOVERY_KEY, '1');
    } else {
      sessionStorage.removeItem(PASSWORD_RECOVERY_KEY);
    }
  } catch {
    // Ignore storage failures in private browsing.
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(
    readPasswordRecoveryFlag,
  );
  const [error, setError] = useState<string | null>(null);
  const [mfaState, setMfaState] = useState<{ userId: string; needsMfa: boolean } | null>(null);

  const userId = session?.user.id ?? null;
  const accessToken = session?.access_token ?? null;
  const mfaChecked = !userId || mfaState?.userId === userId;
  const needsMfa = Boolean(userId && mfaState?.userId === userId && mfaState.needsMfa);

  const refreshMfa = useCallback(async () => {
    if (!userId) return;
    const required = await needsMfaChallenge().catch(() => false);
    setMfaState({ userId, needsMfa: required });
  }, [userId]);

  useEffect(() => {
    if (!accessToken || !userId) return;
    let cancelled = false;
    needsMfaChallenge()
      .catch(() => false)
      .then((required) => {
        if (!cancelled) setMfaState({ userId, needsMfa: required });
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, userId]);

  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        writePasswordRecoveryFlag(true);
        setIsPasswordRecovery(true);
      }

      if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
        writePasswordRecoveryFlag(false);
        setIsPasswordRecovery(false);
      }

      setSession(nextSession);

      if (nextSession) {
        setError(null);
      } else {
        const callback = readAuthCallbackFromLocation();
        setError(
          callback.error
            ? getAuthCallbackErrorMessage(callback.error)
            : null,
        );
      }

      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      throw new Error(signOutError.message);
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading: isLoading || !mfaChecked,
      isPasswordRecovery,
      needsMfa,
      error,
      signOut,
      refreshMfa,
    }),
    [session, isLoading, mfaChecked, isPasswordRecovery, needsMfa, error, signOut, refreshMfa],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
