import { useEffect, useState, type FormEvent } from 'react';
import logo from '../../assets/logo.png';
import { useAuth } from './AuthContextState';
import {
  requestPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  updatePassword,
} from './auth.api';
import {
  EyeIcon,
  EyeOffIcon,
  GoogleIcon,
} from '../../shared/components/icons';
import { getPasswordResetErrorMessage } from '../../shared/errors';
import styles from './Login.module.css';

type AuthMode = 'login' | 'signup';
type LoginStep = 'email' | 'password' | 'forgot';

export default function Login() {
  const { isPasswordRecovery, error: authError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  useEffect(() => {
    if (authError) {
      setErrorMessage(authError);
    }
  }, [authError]);

  const goToEmailStep = () => {
    setStep('email');
    setPassword('');
    setShowPassword(false);
    clearMessages();
  };

  const handleRecoverySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearMessages();

    if (password.length < 6) {
      setErrorMessage('הסיסמה החדשה חייבת להכיל לפחות 6 תווים.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('הסיסמאות אינן תואמות.');
      return;
    }

    setIsLoading(true);

    try {
      await updatePassword(password);
    } catch (error) {
      console.error('שגיאה בעדכון סיסמה:', error);
      setErrorMessage('לא ניתן לשמור את הסיסמה החדשה. נסו שוב.');
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearMessages();

    const trimmedEmail = email.trim();

    if (mode === 'login' && step === 'email') {
      setEmail(trimmedEmail);
      setStep('password');
      return;
    }

    if (mode === 'login' && step === 'forgot') {
      setIsLoading(true);

      try {
        await requestPasswordReset(trimmedEmail);
        setSuccessMessage(
          'אם קיים חשבון עם הדוא״ל הזה, נשלח אליו קישור לאיפוס הסיסמה.',
        );
      } catch (error) {
        console.error('שגיאה באיפוס סיסמה:', error);
        setErrorMessage(getPasswordResetErrorMessage(error));
      } finally {
        setIsLoading(false);
      }

      return;
    }

    if (password.length < 6) {
      setErrorMessage('הסיסמה חייבת להכיל לפחות 6 תווים.');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmail({ email: trimmedEmail, password });
        return;
      }

      const result = await signUpWithEmail({
        email: trimmedEmail,
        password,
      });
      setSuccessMessage(
        result.requiresEmailConfirmation
          ? 'הרשמה בוצעה בהצלחה. נשלח אליך קישור לאימות הדוא״ל.'
          : 'הרשמה בוצעה בהצלחה. מתחבר למערכת...',
      );
    } catch (error) {
      console.error('שגיאת אימות:', error);
      setErrorMessage(
        mode === 'login'
          ? 'שגיאה בהתחברות. בדוק את הדוא״ל והסיסמה.'
          : 'לא ניתן להשלים את ההרשמה. בדוק את הפרטים ונסה שוב.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    clearMessages();

    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('שגיאת התחברות Google:', error);
      setErrorMessage('לא ניתן להתחבר באמצעות Google.');
    }
  };

  const switchMode = () => {
    setMode((current) => (current === 'login' ? 'signup' : 'login'));
    setStep('email');
    setPassword('');
    setShowPassword(false);
    clearMessages();
  };

  const isLogin = mode === 'login';
  const showPasswordFields = !isLogin || step === 'password';
  const showGoogle = !isPasswordRecovery && (mode === 'signup' || step === 'email');

  const title = isPasswordRecovery
    ? 'בחירת סיסמה חדשה'
    : step === 'forgot'
      ? 'איפוס סיסמה'
      : isLogin
        ? 'כניסה למערכת'
        : 'הרשמה למערכת';

  const submitLabel = isPasswordRecovery
    ? 'שמירת סיסמה חדשה'
    : isLoading
      ? 'טוען...'
      : step === 'forgot'
        ? 'שלח קישור לאיפוס'
        : isLogin
          ? step === 'email'
            ? 'המשך'
            : 'היכנס'
          : 'צור חשבון חדש';

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <img src={logo} alt="Featurn" className={styles.logo} />
        <h1>{title}</h1>

        {errorMessage && (
          <div className={styles.error} role="alert">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className={styles.success} role="status">
            {successMessage}
          </div>
        )}

        {isPasswordRecovery ? (
          <form onSubmit={handleRecoverySubmit} className={styles.form}>
            <p className={styles.hint}>בחרו סיסמה חדשה לחשבון, ואז ייפתח הדשבורד.</p>
            <PasswordField
              label="סיסמה חדשה"
              autoComplete="new-password"
              value={password}
              showPassword={showPassword}
              onChange={setPassword}
              onToggle={() => setShowPassword((visible) => !visible)}
            />
            <label className={styles.field}>
              <span>אימות סיסמה</span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                dir="ltr"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isLoading}
            >
              {isLoading ? 'טוען...' : submitLabel}
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailAuth} className={styles.form}>
            {isLogin && step === 'forgot' ? (
              <p className={styles.hint}>
                נשלח קישור לאיפוס הסיסמה לכתובת הדוא״ל של החשבון.
              </p>
            ) : null}

            {isLogin && step === 'password' ? (
              <div className={styles.chosenEmail}>
                <span className={styles.chosenEmailAddress} dir="ltr">
                  {email}
                </span>
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={goToEmailStep}
                >
                  שינוי דוא״ל
                </button>
              </div>
            ) : (
              <label className={styles.field}>
                <span>דואר אלקטרוני</span>
                <input
                  type="email"
                  required
                  dir="ltr"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
            )}

            {showPasswordFields ? (
              <PasswordField
                label="סיסמה"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                showPassword={showPassword}
                onChange={setPassword}
                onToggle={() => setShowPassword((visible) => !visible)}
              />
            ) : null}

            {isLogin && step === 'password' ? (
              <button
                type="button"
                className={styles.forgotButton}
                onClick={() => {
                  setStep('forgot');
                  setPassword('');
                  clearMessages();
                }}
              >
                שכחתי סיסמה
              </button>
            ) : null}

            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isLoading}
            >
              {submitLabel}
            </button>

            {isLogin && step === 'forgot' ? (
              <button
                type="button"
                className={styles.secondaryTextButton}
                onClick={() => {
                  setStep(email ? 'password' : 'email');
                  clearMessages();
                }}
              >
                חזרה להתחברות
              </button>
            ) : null}
          </form>
        )}

        {isPasswordRecovery || (isLogin && step === 'forgot') ? null : (
          <p className={styles.modeSwitch}>
            {isLogin ? 'אין לך חשבון?' : 'כבר יש לך חשבון?'}
            <button type="button" onClick={switchMode}>
              {isLogin ? 'הירשם עכשיו' : 'התחבר כאן'}
            </button>
          </p>
        )}

        {showGoogle ? (
          <>
            <div className={styles.divider}>
              <span>או</span>
            </div>

            <button
              type="button"
              className={styles.googleButton}
              onClick={() => void handleGoogleLogin()}
            >
              <GoogleIcon />
              התחברות באמצעות Google
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}

function PasswordField({
  label,
  autoComplete,
  value,
  showPassword,
  onChange,
  onToggle,
}: {
  label: string;
  autoComplete: string;
  value: string;
  showPassword: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.passwordField}>
        <input
          type={showPassword ? 'text' : 'password'}
          required
          dir="ltr"
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className={styles.passwordToggle}
          onClick={onToggle}
          aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
        >
          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </label>
  );
}
