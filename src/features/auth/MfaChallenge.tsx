import { useEffect, useState, type FormEvent } from 'react';
import logo from '../../assets/logo.png';
import { useAuth } from './AuthContextState';
import { listTotpFactors, verifyTotp } from './mfa.api';
import styles from './Login.module.css';

export default function MfaChallenge() {
  const { refreshMfa, signOut } = useAuth();
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listTotpFactors()
      .then((factors) => {
        if (!cancelled) setFactorId(factors[0]?.id ?? '');
      })
      .catch(() => {
        if (!cancelled) setError('לא ניתן לטעון את פרטי האימות. נסו להתחבר מחדש.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!factorId) return;
    setError('');
    setBusy(true);
    try {
      await verifyTotp(factorId, code);
      await refreshMfa();
    } catch {
      setError('הקוד שגוי או שפג תוקפו. נסו את הקוד הנוכחי באפליקציה.');
      setBusy(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <img src={logo} alt="QGent" className={styles.logo} />
        <h1>אימות דו-שלבי</h1>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={(event) => void handleSubmit(event)} className={styles.form}>
          <p className={styles.hint}>הזינו את הקוד בן 6 הספרות מאפליקציית האימות.</p>
          <label className={styles.field}>
            <span>קוד אימות</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={8}
              required
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={busy || !factorId || code.trim().length < 6}
          >
            {busy ? 'מאמת...' : 'כניסה'}
          </button>
          <button
            type="button"
            className={styles.secondaryTextButton}
            onClick={() => void signOut()}
          >
            יציאה
          </button>
        </form>
      </section>
    </main>
  );
}
