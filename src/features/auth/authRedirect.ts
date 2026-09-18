export const PRODUCTION_APP_URL =
  'https://featurn-web-43062247540.europe-west1.run.app';

function configuredAppUrl() {
  const fromEnv = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  return fromEnv ? fromEnv.replace(/\/$/, '') : PRODUCTION_APP_URL;
}

export function isLocalAppOrigin(origin: string) {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return /localhost|127\.0\.0\.1/.test(origin);
  }
}

export function getAuthEmailRedirectTo(
  origin = typeof window === 'undefined' ? '' : window.location.origin,
) {
  const liveOrigin = origin && !isLocalAppOrigin(origin) ? origin : configuredAppUrl();
  return `${liveOrigin.replace(/\/$/, '')}/`;
}

export function readAuthCallbackFromLocation(
  location: Pick<Location, 'search' | 'hash'> = window.location,
) {
  const search = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));

  return {
    error:
      search.get('error_description') ||
      hash.get('error_description') ||
      search.get('error') ||
      hash.get('error'),
    type: search.get('type') || hash.get('type'),
    hasCode: search.has('code'),
    hasToken: hash.has('access_token'),
  };
}

export function isAuthCallbackPending(
  location?: Pick<Location, 'search' | 'hash'>,
) {
  const callback = readAuthCallbackFromLocation(location);
  return Boolean(callback.hasCode || callback.hasToken);
}
