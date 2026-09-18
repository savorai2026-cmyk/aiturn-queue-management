export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function errorIncludes(error: unknown, fragment: string): boolean {
  return getErrorMessage(error).toLowerCase().includes(fragment.toLowerCase());
}

export function getAppointmentSaveErrorMessage(error: unknown): string {
  if (
    errorIncludes(error, 'prevent_overlapping_appointments') ||
    errorIncludes(error, 'exclusion constraint') ||
    errorIncludes(error, 'already exists')
  ) {
    return 'כבר קיים תור בטווח השעות שנבחר.';
  }

  if (
    errorIncludes(error, 'range lower bound') ||
    errorIncludes(error, 'tsrange')
  ) {
    return 'שעת הסיום חייבת להיות מאוחרת משעת ההתחלה.';
  }

  return getErrorMessage(error) || 'לא ניתן לשמור את השינויים.';
}

export function isSchedulerUnavailable(error: unknown): boolean {
  return (
    errorIncludes(error, 'edge function') ||
    errorIncludes(error, 'failed to send a request') ||
    errorIncludes(error, 'failed to send a request to the edge function')
  );
}

function isVoiceAgentOccupancyMessage(message: string) {
  return (
    message.includes('חלונות הפנויים') ||
    message.includes('חובה להציע') ||
    message.includes('אסור להציע')
  );
}

export function isOccupiedAppointmentSlotError(error: unknown): boolean {
  return (
    errorIncludes(error, 'prevent_overlapping_appointments') ||
    errorIncludes(error, 'exclusion constraint') ||
    errorIncludes(error, 'already exists') ||
    isVoiceAgentOccupancyMessage(getErrorMessage(error))
  );
}

export function getAppointmentCreateErrorMessage(error: unknown): string {
  if (isOccupiedAppointmentSlotError(error)) {
    return 'הזמן שנבחר מתנגש בתור קיים.';
  }

  if (errorIncludes(error, 'invalid or inactive')) {
    return 'אחד או יותר מהשירותים שנבחרו אינם זמינים.';
  }

  if (errorIncludes(error, 'at least one service')) {
    return 'יש לבחור לפחות שירות אחד.';
  }

  if (errorIncludes(error, 'not authorized')) {
    return 'אין הרשאה ליצור תור בעסק הזה.';
  }

  if (errorIncludes(error, 'missing required')) {
    return 'חסרים שדות חובה. בדוק לקוח, שירות ושעה.';
  }

  if (
    errorIncludes(error, 'unauthorized') ||
    errorIncludes(error, 'x-vapi-secret')
  ) {
    return 'שירות הזימון דחה את הבקשה בגלל אימות.';
  }

  const message = getErrorMessage(error).trim();
  if (
    message &&
    !errorIncludes(error, 'edge function') &&
    !errorIncludes(error, 'failed to send a request')
  ) {
    return message;
  }

  return 'לא ניתן ליצור את התור. בדוק את הפרטים ונסה שוב.';
}

export function getSchedulerUnavailableMessage(action: 'create' | 'slots'): string {
  return action === 'slots'
    ? 'לא ניתן לחפש זמנים פנויים כי שירות הזימון (Webhook) לא זמין כרגע.'
    : 'לא ניתן ליצור את התור כי שירות הזימון (Webhook) לא זמין כרגע.';
}

export function getPasswordResetErrorMessage(error: unknown): string {
  if (
    errorIncludes(error, 'redirect') ||
    errorIncludes(error, 'not allowed') ||
    errorIncludes(error, 'whitelist') ||
    errorIncludes(error, 'allow list')
  ) {
    return 'כתובת האתר לא מאושרת לשליחת קישור איפוס. צריך לאשר אותה בהגדרות האימות.';
  }

  if (
    errorIncludes(error, 'rate') ||
    errorIncludes(error, 'seconds') ||
    errorIncludes(error, 'for security purposes')
  ) {
    return 'נשלח קישור לא מזמן. בדקו את תיבת הדוא״ל, כולל ספאם, או נסו שוב בעוד דקה.';
  }

  return 'לא ניתן לשלוח קישור לאיפוס הסיסמה. נסו שוב בעוד רגע.';
}

export function getAuthCallbackErrorMessage(error: string): string {
  const text = error.toLowerCase();

  if (text.includes('expired') || text.includes('otp')) {
    return 'קישור האימות פג. אפשר לבקש קישור חדש או להתחבר אם החשבון כבר אומת.';
  }

  if (text.includes('verifier') || text.includes('pkce') || text.includes('code')) {
    return 'הדוא״ל אומת. היכנסו למערכת עם הסיסמה.';
  }

  return 'לא ניתן להשלים את האימות אוטומטית. אם החשבון אומת, היכנסו עם הסיסמה.';
}

export function getAgentPromptRewriteErrorMessage(error: unknown): string {
  if (errorIncludes(error, 'not configured') || errorIncludes(error, 'openai is not configured')) {
    return 'ניסוח בעזרת AI עדיין לא הוגדר בשרת.';
  }

  if (errorIncludes(error, 'too many') || errorIncludes(error, '429')) {
    return 'נשלחו יותר מדי בקשות ניסוח. נסו שוב בעוד כמה דקות.';
  }

  if (errorIncludes(error, 'not allowed') || errorIncludes(error, 'not authenticated')) {
    return 'אין הרשאה לנסח את התיאור בעסק הזה.';
  }

  if (errorIncludes(error, 'too long')) {
    return 'הטיוטה ארוכה מדי. קצרו אותה ונסו שוב.';
  }

  if (errorIncludes(error, 'missing draft')) {
    return 'כתבו קודם תיאור קצר במילים שלכם.';
  }

  return 'לא ניתן לנסח את התיאור כרגע. נסו שוב בעוד רגע.';
}
