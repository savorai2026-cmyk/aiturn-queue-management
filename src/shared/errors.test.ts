import { describe, expect, it } from 'vitest';
import {
  getAgentPromptRewriteErrorMessage,
  getAppointmentCreateErrorMessage,
  getPasswordResetErrorMessage,
  isOccupiedAppointmentSlotError,
} from './errors';

describe('appointment create errors', () => {
  it('rewrites voice-agent occupancy copy into a staff message', () => {
    const occupancy =
      'יום רביעי, שישה עשר בספטמבר, בשעה תשע בבוקר תפוסה. החלונות הפנויים: בבוקר משעה תשע וחצי בבוקר עד שעה שתים עשרה ורבע בצהריים. חובה להציע קודם את שעות הבוקר אם הן ברשימה. אסור להציע שעה שלא מופיעה כאן.';

    expect(isOccupiedAppointmentSlotError(new Error(occupancy))).toBe(true);
    expect(getAppointmentCreateErrorMessage(new Error(occupancy))).toBe(
      'הזמן שנבחר מתנגש בתור קיים.',
    );
  });

  it('maps overlap constraint names to the same staff message', () => {
    expect(
      getAppointmentCreateErrorMessage(
        new Error('prevent_overlapping_appointments'),
      ),
    ).toBe('הזמן שנבחר מתנגש בתור קיים.');
  });

  it('maps inactive service errors', () => {
    expect(
      getAppointmentCreateErrorMessage(
        new Error('One or more services are invalid or inactive'),
      ),
    ).toBe('אחד או יותר מהשירותים שנבחרו אינם זמינים.');
  });
});

describe('password reset errors', () => {
  it('explains a blocked redirect URL', () => {
    expect(
      getPasswordResetErrorMessage(new Error('Redirect URL not allowed')),
    ).toMatch(/כתובת האתר לא מאושרת/);
  });

  it('explains a rate limit', () => {
    expect(
      getPasswordResetErrorMessage(
        new Error('For security purposes, you can only request this after 60 seconds'),
      ),
    ).toMatch(/נשלח קישור לא מזמן/);
  });
});

describe('agent prompt rewrite errors', () => {
  it('maps missing configuration and rate limits', () => {
    expect(
      getAgentPromptRewriteErrorMessage(new Error('OpenAI is not configured')),
    ).toMatch(/עדיין לא הוגדר/);
    expect(
      getAgentPromptRewriteErrorMessage(new Error('Too many rewrite requests')),
    ).toMatch(/יותר מדי בקשות/);
    expect(
      getAgentPromptRewriteErrorMessage(new Error('Missing draft')),
    ).toMatch(/כתבו קודם תיאור/);
  });
});
