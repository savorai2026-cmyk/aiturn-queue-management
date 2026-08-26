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
