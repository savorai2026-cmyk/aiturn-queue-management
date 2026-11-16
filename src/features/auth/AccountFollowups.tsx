import { useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import { startTotpEnrollment, verifyTotp } from './mfa.api';
import { passwordRuleError } from '../settings/passwordRules';
import styles from './Login.module.css';

const MFA_OFFER_KEY = 'qgent-offer-mfa';

export function mustChangePassword(user: User) {
  return user.user_metadata?.must_change_password === true;
}

export function mfaOfferPending() {
  try {
    return sessionStorage.getItem(MFA_OFFER_KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberMfaOffer() {
  try {
    sessionStorage.setItem(MFA_OFFER_KEY, '1');
  } catch {
    // Ignore private browsing.
  }
}

function clearMfaOffer() {
  try {
    sessionStorage.removeItem(MFA_OFFER_KEY);
  } catch {
    // Ignore private browsing.
  }
}

export function MustChangePassword() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ruleError = passwordRuleError(password);
    if (ruleError) {
      setError(ruleError);
      return;
    }
    setIsSaving(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setIsSaving(false);
    if (updateError) {
      setError('לא ניתן לשמור את הסיסמה החדשה.');
      return;
    }
    window.location.assign('/');
  };

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={(event) => void submit(event)}>
        <h1>יש לבחור סיסמה חדשה</h1>
        <p>הסיסמה הראשונה נקבעה על ידי בעל העסק. לפני הכניסה צריך להחליף אותה.</p>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
        {error ? <p className={styles.error}>{error}</p> : null}
        <button type="submit" className={styles.primaryButton} disabled={isSaving}>
          {isSaving ? 'שומר...' : 'שמירת סיסמה'}
        </button>
      </form>
    </main>
  );
}

export function MfaSignupOffer() {
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const start = async () => {
    setIsBusy(true);
    setError('');
    try {
      const enrollment = await startTotpEnrollment();
      setFactorId(enrollment.factorId);
      setQrCode(enrollment.qrCode);
    } catch {
      setError('לא ניתן להתחיל את האימות הדו-שלבי.');
    } finally {
      setIsBusy(false);
    }
  };

  const confirm = async (event: FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    setError('');
    try {
      await verifyTotp(factorId, code);
      clearMfaOffer();
      window.location.assign('/');
    } catch {
      setError('הקוד לא אומת.');
      setIsBusy(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>אימות דו-שלבי</h1>
        <p>אפשר להפעיל עכשיו אימות באפליקציית קודים. אפשר גם לדלג ולהפעיל אחר כך בהגדרות.</p>
        {qrCode ? (
          <form onSubmit={(event) => void confirm(event)}>
            <img src={qrCode} alt="קוד להגדרת האימות" />
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
            {error ? <p className={styles.error}>{error}</p> : null}
            <button type="submit" className={styles.primaryButton} disabled={isBusy}>
              אישור
            </button>
          </form>
        ) : (
          <>
            {error ? <p className={styles.error}>{error}</p> : null}
            <button type="button" className={styles.primaryButton} onClick={() => void start()} disabled={isBusy}>
              להפעיל עכשיו
            </button>
          </>
        )}
        <button
          type="button"
          className={styles.secondaryTextButton}
          onClick={() => {
            clearMfaOffer();
            window.location.assign('/');
          }}
        >
          לא עכשיו
        </button>
      </section>
    </main>
  );
}
