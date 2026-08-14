import { useState, type FormEvent } from 'react';
import logo from '../../assets/logo.png';
import {
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from './auth.api';
import styles from './Login.module.css';

type AuthMode = 'login' | 'signup';

export default function Login() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearMessages();

    if (password.length < 6) {
      setErrorMessage('הסיסמה חייבת להכיל לפחות 6 תווים.');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmail({ email, password });
        return;
      }

      const result = await signUpWithEmail({ email, password });
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
    clearMessages();
  };

  const isLogin = mode === 'login';

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <img src={logo} alt="Featurn" className={styles.logo} />
        <h1>{isLogin ? 'כניסה למערכת' : 'הרשמה למערכת'}</h1>

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

        <form onSubmit={handleEmailAuth} className={styles.form}>
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

          <label className={styles.field}>
            <span>סיסמה</span>
            <div className={styles.passwordField}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                dir="ltr"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
              >
                {showPassword ? 'הסתר' : 'הצג'}
              </button>
            </div>
          </label>

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={isLoading}
          >
            {isLoading
              ? 'טוען...'
              : isLogin
                ? 'היכנס'
                : 'צור חשבון חדש'}
          </button>
        </form>

        <p className={styles.modeSwitch}>
          {isLogin ? 'אין לך חשבון?' : 'כבר יש לך חשבון?'}
          <button type="button" onClick={switchMode}>
            {isLogin ? 'הירשם עכשיו' : 'התחבר כאן'}
          </button>
        </p>

        <div className={styles.divider}>
          <span>או</span>
        </div>

        <button
          type="button"
          className={styles.googleButton}
          onClick={() => void handleGoogleLogin()}
        >
          התחברות באמצעות Google
        </button>
      </section>
    </main>
  );
}
