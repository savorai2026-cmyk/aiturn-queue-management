import { useState } from 'react';
import { supabase } from '../supabaseClient';
import logo from '../assets/logo.png';

export default function Login() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (password.length < 6) {
      setErrorMsg('הסיסמה חייבת להכיל לפחות 6 תווים.');
      return;
    }

    setIsLoading(true);

    if (isLoginMode) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErrorMsg('שגיאה בהתחברות: בדוק את שם המשתמש והסיסמה.');
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setErrorMsg(`שגיאה בהרשמה: ${error.message}`);
      } else {
        if (data?.user && data?.session === null) {
          setSuccessMsg('הרשמה בוצעה בהצלחה! נשלח אליך קישור לאימות לכתובת המייל.');
        } else {
          setSuccessMsg('הרשמה בוצעה בהצלחה! מתחבר למערכת...');
        }
      }
    }
    
    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setErrorMsg(`שגיאת התחברות מול גוגל: ${error.message}`);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <img src={logo} alt="Featurn Logo" className="login-logo" />
        <h2>{isLoginMode ? 'כניסה למערכת' : 'הרשמה למערכת'}</h2>
        
        {errorMsg && <div className="error-message">{errorMsg}</div>}
        {successMsg && <div className="success-message" style={{ backgroundColor: '#e8f8f5', color: '#1abc9c', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '0.9em' }}>{successMsg}</div>}

        <form onSubmit={handleEmailAuth}>
          <div className="form-group">
            <label>דואר אלקטרוני</label>
            <input 
              type="email" 
              required 
              dir="ltr"
              className="form-select"
              autoComplete="email"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          
          <div className="form-group" style={{ position: 'relative' }}>
            <label>סיסמה</label>
            <input 
              type={showPassword ? "text" : "password"}
              required 
              dir="ltr"
              className="form-select"
              autoComplete="new-password"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              style={{ paddingLeft: '40px' }}
            />
            {/* כפתור העין להצגה/הסתרה של הסיסמה */}
            <span 
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                left: '12px',
                top: '36px',
                cursor: 'pointer',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '24px',
                width: '24px'
              }}
              title={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              )}
            </span>
          </div>

          <button type="submit" className="btn action-btn login-btn" disabled={isLoading}>
            {isLoading ? 'טוען...' : (isLoginMode ? 'היכנס' : 'צור חשבון חדש')}
          </button>
        </form>

        {/* זה החלק שהפונקציה setIsLoginMode מופעלת בו */}
        <div style={{ marginTop: '15px', fontSize: '0.9em' }}>
          {isLoginMode ? 'אין לך חשבון? ' : 'כבר יש לך חשבון? '}
          <span 
            style={{ color: '#3498db', cursor: 'pointer', fontWeight: 'bold' }} 
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            {isLoginMode ? 'הירשם עכשיו' : 'התחבר כאן'}
          </span>
        </div>

        <div className="login-divider">
          <span>או</span>
        </div>

        <button 
          type="button" 
          className="btn cancel-btn google-btn" 
          onClick={handleGoogleLogin}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          התחברות באמצעות Google
        </button>
      </div>
    </div>
  );
}