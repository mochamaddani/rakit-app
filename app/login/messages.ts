const RATE_LIMITED = 'Too many sign-in attempts. Wait a minute and try again.';
const UNAVAILABLE = 'Sign-in is unavailable right now. Check your connection and try again.';

/** Says what actually went wrong, so rate limits and outages are not reported as a wrong password. */
export function signInErrorMessage(error: { code?: string; status?: number }): string {
  if (error.status === 429 || error.code?.startsWith('over_')) return RATE_LIMITED;
  if (error.status === undefined || error.status === 0 || error.status >= 500) return UNAVAILABLE;
  if (error.code === 'invalid_credentials') return 'Wrong email or password.';
  if (error.code === 'email_not_confirmed')
    return 'This account’s email address is not confirmed yet.';
  return 'Could not sign in. Try again.';
}
