export const SUPPORT_INBOX = 'office@savorai.biz';

export interface SupportDraft {
  subject: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  businessName: string;
}

export function readProfileName(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return '';
  const record = metadata as Record<string, unknown>;
  for (const key of ['full_name', 'name', 'display_name']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function supportFieldError(draft: SupportDraft): string | null {
  if (!draft.subject.trim()) return 'חסר נושא.';
  if (!draft.name.trim()) return 'חסר שם מלא.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    return 'כתובת הדוא״ל לא תקינה.';
  }
  if (!draft.phone.trim()) return 'חסר טלפון לחזרה.';
  if (!draft.message.trim()) return 'חסר תוכן הפנייה.';
  return null;
}

export function buildSupportMessage(draft: SupportDraft): string {
  const lines = [
    `שם: ${draft.name.trim()}`,
    `דוא״ל: ${draft.email.trim()}`,
    `טלפון: ${draft.phone.trim()}`,
  ];
  if (draft.businessName.trim()) lines.push(`עסק: ${draft.businessName.trim()}`);
  lines.push('', draft.message.trim());
  return lines.join('\n');
}
