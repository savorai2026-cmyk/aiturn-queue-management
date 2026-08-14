export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function errorIncludes(error: unknown, fragment: string): boolean {
  return getErrorMessage(error).includes(fragment);
}
