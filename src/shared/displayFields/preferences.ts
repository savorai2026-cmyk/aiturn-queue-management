import type { Json } from '../../types/database';
import { getDefaultVisibleKeys, getDisplayCatalog } from './catalogs';
import type { DisplayScope, UiPreferences } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readVisibleFields(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.visibleFields)) {
    return null;
  }

  const keys = value.visibleFields.filter(
    (item): item is string => typeof item === 'string',
  );
  return keys.length > 0 ? keys : null;
}

export function parseUiPreferences(value: Json | null | undefined): UiPreferences {
  if (!isRecord(value)) {
    return {};
  }

  const asScope = (entry: unknown): UiPreferences['clients'] => {
    const keys = readVisibleFields(entry);
    return keys ? { visibleFields: keys } : undefined;
  };

  return {
    ...(asScope(value.clients) ? { clients: asScope(value.clients) } : {}),
    ...(asScope(value.appointments)
      ? { appointments: asScope(value.appointments) }
      : {}),
    ...(asScope(value.services) ? { services: asScope(value.services) } : {}),
    ...(asScope(value.business) ? { business: asScope(value.business) } : {}),
    ...(asScope(value.statuses) ? { statuses: asScope(value.statuses) } : {}),
  };
}

export function sanitizeVisibleFields(
  scope: DisplayScope,
  keys: string[],
): string[] {
  const validKeys = new Set(getDisplayCatalog(scope).map((field) => field.key));
  const unique = Array.from(new Set(keys.filter((key) => validKeys.has(key))));
  return unique.length > 0 ? unique : getDefaultVisibleKeys(scope);
}

export function resolveVisibleFields(
  scope: DisplayScope,
  memberPrefs: UiPreferences,
  businessPrefs: UiPreferences,
  fallbackKeys?: string[],
): string[] {
  const memberKeys = memberPrefs[scope]?.visibleFields;
  if (memberKeys && memberKeys.length > 0) {
    return sanitizeVisibleFields(scope, memberKeys);
  }

  const businessKeys = businessPrefs[scope]?.visibleFields;
  if (businessKeys && businessKeys.length > 0) {
    return sanitizeVisibleFields(scope, businessKeys);
  }

  if (fallbackKeys && fallbackKeys.length > 0) {
    return sanitizeVisibleFields(scope, fallbackKeys);
  }

  return getDefaultVisibleKeys(scope);
}

export function toggleVisibleField(keys: string[], key: string): string[] {
  if (keys.includes(key)) {
    const next = keys.filter((item) => item !== key);
    return next.length > 0 ? next : keys;
  }

  return [...keys, key];
}

export function withScopeVisibleFields(
  preferences: UiPreferences,
  scope: DisplayScope,
  visibleFields: string[],
): UiPreferences {
  return {
    ...preferences,
    [scope]: { visibleFields },
  };
}

export function hasStoredUiPreferences(preferences: UiPreferences): boolean {
  return Boolean(
    preferences.clients ||
      preferences.appointments ||
      preferences.services ||
      preferences.business ||
      preferences.statuses,
  );
}

function uiPreferencesStorageKey(businessCode: string, userId: string) {
  return `uiPreferences:${businessCode}:${userId}`;
}

export function readCachedUiPreferences(
  businessCode: string,
  userId: string,
): UiPreferences {
  if (!businessCode || !userId) return {};

  try {
    const saved = localStorage.getItem(
      uiPreferencesStorageKey(businessCode, userId),
    );
    if (!saved) return {};
    return parseUiPreferences(JSON.parse(saved) as Json);
  } catch {
    return {};
  }
}

export function writeCachedUiPreferences(
  businessCode: string,
  userId: string,
  preferences: UiPreferences,
): void {
  if (!businessCode || !userId) return;

  try {
    localStorage.setItem(
      uiPreferencesStorageKey(businessCode, userId),
      JSON.stringify(preferences),
    );
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function readLegacyClientColumns(businessCode: string): string[] | null {
  try {
    const saved = localStorage.getItem(`clientTableColumns:${businessCode}`);
    if (!saved) return null;

    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : null;
  } catch {
    return null;
  }
}
