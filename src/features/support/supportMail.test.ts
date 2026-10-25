import { describe, expect, it } from 'vitest';
import {
  buildSupportMessage,
  readProfileName,
  supportFieldError,
  type SupportDraft,
} from './supportMail';

const DRAFT: SupportDraft = {
  subject: 'תקלה ביומן',
  name: 'נועה לוי',
  email: 'noa@example.com',
  phone: '050-0000000',
  message: 'היומן לא נטען.',
  businessName: 'קליניקה לדוגמה',
};

describe('support mail', () => {
  it('reads a full name from the signed-in profile', () => {
    expect(readProfileName({ full_name: '  נועה לוי  ' })).toBe('נועה לוי');
    expect(readProfileName({ name: 'Noa' })).toBe('Noa');
    expect(readProfileName({})).toBe('');
  });

  it('asks for the missing callback details', () => {
    expect(supportFieldError({ ...DRAFT, email: 'not-an-email' })).toBe(
      'כתובת הדוא״ל לא תקינה.',
    );
    expect(supportFieldError({ ...DRAFT, message: '  ' })).toBe('חסר תוכן הפנייה.');
    expect(supportFieldError(DRAFT)).toBeNull();
  });

  it('includes the callback details in the message', () => {
    const text = buildSupportMessage(DRAFT);
    expect(text).toContain('שם: נועה לוי');
    expect(text).toContain('דוא״ל: noa@example.com');
    expect(text).toContain('טלפון: 050-0000000');
    expect(text).toContain('עסק: קליניקה לדוגמה');
    expect(text).toContain('היומן לא נטען.');
  });
});
