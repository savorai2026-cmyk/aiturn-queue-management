import { useEffect, useState, type FormEvent } from 'react';
import {
  listTotpFactors,
  removeTotpFactor,
  startTotpEnrollment,
  verifyTotp,
  type TotpEnrollment,
  type TotpFactor,
} from '../../auth/mfa.api';
import styles from './BusinessAccountPanel.module.css';

export default function TwoFactorPanel() {
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [removeArmed, setRemoveArmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listTotpFactors()
      .then((rows) => {
        if (!cancelled) setFactors(rows);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'לא ניתן לטעון את מצב האימות.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enabled = factors.length > 0;

  const handleStart = async () => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      setEnrollment(await startTotpEnrollment());
      setCode('');
    } catch (startError: unknown) {
      setError(startError instanceof Error ? startError.message : 'לא ניתן להתחיל את ההגדרה.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!enrollment) return;
    setError('');
    setBusy(true);
    try {
      await verifyTotp(enrollment.factorId, code);
      setEnrollment(null);
      setCode('');
      setFactors(await listTotpFactors());
      setMessage('האימות הדו-שלבי הופעל. מעכשיו תתבקשו להזין קוד מהאפליקציה בכל כניסה.');
    } catch {
      setError('הקוד שגוי או שפג תוקפו. נסו את הקוד הנוכחי באפליקציה.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      for (const factor of factors) {
        await removeTotpFactor(factor.id);
      }
      setFactors(await listTotpFactors());
      setRemoveArmed(false);
      setMessage('האימות הדו-שלבי בוטל.');
    } catch (removeError: unknown) {
      setError(removeError instanceof Error ? removeError.message : 'לא ניתן לבטל את האימות.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.panel}>
      <section className={styles.group}>
        <header className={styles.header}>
          <h3>אימות דו-שלבי</h3>
          <p>
            סורקים קוד באפליקציית אימות. Google Authenticator, Microsoft Authenticator
            ואפליקציות דומות עובדות אותו דבר: זה קוד חד־פעמי, לא התחברות לחשבון גוגל
            או מיקרוסופט. ההפעלה היא לחשבון שנכנסתם איתו.
          </p>
        </header>

        {error ? <p className={styles.error}>{error}</p> : null}
        {message ? <p className={styles.success}>{message}</p> : null}

        {enrollment ? (
          <form className={styles.form} onSubmit={(event) => void handleVerify(event)}>
            <p className={styles.hint}>
              סרקו את הקוד באפליקציית האימות. אם אי אפשר לסרוק, הזינו באפליקציה את המפתח שמתחת.
            </p>
            <img className={styles.qr} src={enrollment.qrCode} alt="קוד QR לאימות דו-שלבי" />
            <code className={styles.secret} dir="ltr">{enrollment.secret}</code>
            <label htmlFor="mfa-enroll-code">הקוד מהאפליקציה</label>
            <input
              id="mfa-enroll-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={8}
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <div className={styles.confirm}>
              <button type="submit" className={styles.primary} disabled={busy || code.trim().length < 6}>
                {busy ? 'מאמת...' : 'הפעלה'}
              </button>
              <button
                type="button"
                className={styles.cancel}
                disabled={busy}
                onClick={() => {
                  setEnrollment(null);
                  setCode('');
                }}
              >
                ביטול
              </button>
            </div>
          </form>
        ) : enabled ? (
          <div className={styles.confirm}>
            <span className={styles.badge} data-tone="ok">פעיל</span>
            {removeArmed ? (
              <>
                <span>לבטל את האימות הדו-שלבי?</span>
                <button
                  type="button"
                  className={styles.remove}
                  disabled={busy}
                  onClick={() => void handleRemove()}
                >
                  {busy ? 'מבטל...' : 'כן, לבטל'}
                </button>
                <button
                  type="button"
                  className={styles.cancel}
                  disabled={busy}
                  onClick={() => setRemoveArmed(false)}
                >
                  ביטול
                </button>
              </>
            ) : (
              <button type="button" className={styles.remove} onClick={() => setRemoveArmed(true)}>
                ביטול האימות
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className={styles.primary}
            disabled={busy}
            onClick={() => void handleStart()}
          >
            {busy ? 'מכין...' : 'הפעלת אימות דו-שלבי'}
          </button>
        )}
      </section>
    </div>
  );
}
