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

export function getAppointmentCreateErrorMessage(error: unknown): string {
  if (
    errorIncludes(error, 'prevent_overlapping_appointments') ||
    errorIncludes(error, 'exclusion constraint') ||
    errorIncludes(error, 'already exists')
  ) {
    return 'הזמן שנבחר מתנגש בתור קיים.';
  }

  if (errorIncludes(error, 'missing required')) {
    return 'שירות הזימון דיווח שחסרים שדות חובה. בדוק לקוח, טלפון, שירות ושעה.';
  }

  if (
    errorIncludes(error, 'unauthorized') ||
    errorIncludes(error, 'x-vapi-secret')
  ) {
    return 'שירות הזימון דחה את הבקשה בגלל אימות. צריך ליישר את VAPI_SECRET.';
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
