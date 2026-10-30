import { useEffect, useState, type FormEvent } from 'react';
import logo from '../../assets/logo.png';
import { useAuth } from './AuthContextState';
import { recordTermsAcceptance } from './auth.api';
import TermsConsent from './TermsConsent';
import {
  TERMS_ACCEPTANCE_REQUIRED_MESSAGE,
  forgetPendingTermsAcceptance,
  takePendingTermsAcceptance,
} from './termsOfUse';
import styles from './Login.module.css';

export default function TermsAcceptance() {
  const { signOut } = useAuth();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(() => takePendingTermsAcceptance() !== null);

  useEffect(() => {
    const pending = takePendingTermsAcceptance();
    if (!pending) return;

    let cancelled = false;
    recordTermsAcceptance(pending.terms_accepted_at)
      .then(() => {
        if (!cancelled) forgetPendingTermsAcceptance();
      })
      .catch(() => {
        if (cancelled) return;
        forgetPendingTermsAcceptance();
        setIsSaving(false);
        setErrorMessage('לא נשמרה ההסכמה. יש לאשר שוב את תנאי השימוש.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!acceptedTerms) {
      setTermsError(true);
      setErrorMessage(TERMS_ACCEPTANCE_REQUIRED_MESSAGE);
      return;
    }

    setErrorMessage('');
    setIsSaving(true);
    try {
      await recordTermsAcceptance(new Date().toISOString());
    } catch {
      setErrorMessage('לא ניתן לשמור את ההסכמה. נסו שוב.');
      setIsSaving(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <img src={logo} alt="QGent" className={styles.logo} />
        <h1>אישור תנאי השימוש</h1>

        {errorMessage ? (
          <div className={styles.error} role="alert">
            {errorMessage}
          </div>
        ) : null}

        {isSaving ? (
          <p className={styles.hint}>שומרים את ההסכמה...</p>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)} className={styles.form}>
            <p className={styles.hint}>כדי להשלים את ההרשמה יש לאשר את תנאי השימוש.</p>
            <TermsConsent
              checked={acceptedTerms}
              invalid={termsError}
              onChange={(checked) => {
                setAcceptedTerms(checked);
                if (checked) setTermsError(false);
              }}
              onInvalid={() => {
                setTermsError(true);
                setErrorMessage(TERMS_ACCEPTANCE_REQUIRED_MESSAGE);
              }}
            />
            <button type="submit" className={styles.primaryButton}>
              המשך
            </button>
            <button
              type="button"
              className={styles.secondaryTextButton}
              onClick={() => void signOut()}
            >
              יציאה
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
