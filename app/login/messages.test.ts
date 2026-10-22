import { expect, it } from 'vitest';
import { signInErrorMessage } from './messages';

it.each([
  [{ code: 'invalid_credentials', status: 400 }, 'Wrong email or password.'],
  [
    { code: 'over_request_rate_limit', status: 429 },
    'Too many sign-in attempts. Wait a minute and try again.',
  ],
  [{ status: 429 }, 'Too many sign-in attempts. Wait a minute and try again.'],
  [
    { code: 'email_not_confirmed', status: 400 },
    'This account’s email address is not confirmed yet.',
  ],
  [{ status: 0 }, 'Sign-in is unavailable right now. Check your connection and try again.'],
  [{ status: 503 }, 'Sign-in is unavailable right now. Check your connection and try again.'],
  [{}, 'Sign-in is unavailable right now. Check your connection and try again.'],
  [{ code: 'something_new', status: 400 }, 'Could not sign in. Try again.'],
])('%j → %s', (error, message) => expect(signInErrorMessage(error)).toBe(message));
