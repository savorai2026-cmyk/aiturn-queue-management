const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isEmailAddress(value: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

export function passwordRuleError(password: string): string | null {
  if (password.length < 8) {
    return 'הסיסמה חייבת להכיל לפחות 8 תווים.';
  }
  if (!/[a-z]/.test(password)) {
    return 'הסיסמה חייבת להכיל אות אנגלית קטנה.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'הסיסמה חייבת להכיל אות אנגלית גדולה.';
  }
  if (!/\d/.test(password)) {
    return 'הסיסמה חייבת להכיל ספרה.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'הסיסמה חייבת להכיל תו מיוחד.';
  }
  return null;
}
