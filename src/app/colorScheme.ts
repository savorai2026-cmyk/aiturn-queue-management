export type ColorScheme = 'light' | 'dark';

const STORAGE_KEY = 'featurn-color-scheme';

export function readColorScheme(): ColorScheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyColorScheme(scheme: ColorScheme) {
  document.documentElement.dataset.theme = scheme;
  try {
    localStorage.setItem(STORAGE_KEY, scheme);
  } catch {
    /* The choice still applies for this visit. */
  }
}
