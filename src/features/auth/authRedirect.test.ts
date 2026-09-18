import { describe, expect, it } from 'vitest';
import {
  getAuthEmailRedirectTo,
  isAuthCallbackPending,
  isLocalAppOrigin,
  PRODUCTION_APP_URL,
  readAuthCallbackFromLocation,
} from './authRedirect';

describe('auth email redirects', () => {
  it('sends local auth emails to the public app instead of localhost', () => {
    expect(isLocalAppOrigin('http://127.0.0.1:5175')).toBe(true);
    expect(getAuthEmailRedirectTo('http://127.0.0.1:5175')).toBe(
      `${PRODUCTION_APP_URL}/`,
    );
    expect(getAuthEmailRedirectTo('http://localhost:5175')).toBe(
      `${PRODUCTION_APP_URL}/`,
    );
  });

  it('keeps production redirects on the same origin', () => {
    expect(
      getAuthEmailRedirectTo('https://featurn-web-43062247540.europe-west1.run.app'),
    ).toBe('https://featurn-web-43062247540.europe-west1.run.app/');
  });

  it('reads recovery and error details from the callback URL', () => {
    expect(
      readAuthCallbackFromLocation({
        search: '?code=abc',
        hash: '#type=recovery',
      }),
    ).toMatchObject({
      hasCode: true,
      type: 'recovery',
    });

    expect(
      isAuthCallbackPending({
        search: '',
        hash: '#access_token=tok&type=signup',
      }),
    ).toBe(true);
  });
});
