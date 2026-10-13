import type { SupabaseClient, Session } from '@supabase/supabase-js';

export function validTournamentId(value: string | null | undefined) {
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
    ? value
    : undefined;
}
export function authRedirect(
  flow: 'signup' | 'recovery' | 'oauth' | 'email_change',
  tournamentId?: string
) {
  const url = new URL('/auth/callback', window.location.origin);
  url.searchParams.set('flow', flow);
  const id = validTournamentId(tournamentId);
  if (id) url.searchParams.set('tournament', id);
  return url.toString();
}
export function authError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : '';
  if (/invalid login credentials/i.test(message))
    return 'Email or password is incorrect. Please try again.';
  if (/email not confirmed/i.test(message))
    return 'Confirm your email before signing in.';
  if (/rate.?limit|too many|429/i.test(message))
    return 'Too many attempts. Please wait a moment and try again.';
  if (/already registered|already exists/i.test(message))
    return 'Try signing in or resetting your password.';
  if (/manual.*linking.*disabled|manual_linking_disabled/i.test(message))
    return 'Connecting another sign-in method is not available yet. Your account is unchanged.';
  if (/fetch|network|connection/i.test(message))
    return 'Could not connect. Check your connection and try again.';
  if (/expired|invalid.*token|flow_state|code verifier/i.test(message))
    return 'This link has expired or was already used. Request a new one.';
  return message || 'Something went wrong. Please try again.';
}
type CallbackResult = {
  session: Session | null;
  error: string | null;
  recovery: boolean;
};
let callbackPromise: Promise<CallbackResult> | undefined;
// A shared promise prevents consuming a one-time code twice in React Strict Mode.
export function initializeAuth(
  client: SupabaseClient
): Promise<CallbackResult> {
  if (window.location.pathname !== '/auth/callback')
    return client.auth.getSession().then(({ data, error }) => ({
      session: data.session,
      error: error?.message ?? null,
      recovery: false,
    }));
  if (callbackPromise) return callbackPromise;
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const flow =
    url.searchParams.get('flow') ??
    (type === 'recovery' || type === 'email_change' || type === 'signup'
      ? type
      : null);
  const hasError =
    url.searchParams.has('error') || url.searchParams.has('error_code');
  const clean = new URL('/auth/callback', url.origin);
  if (
    ['signup', 'recovery', 'oauth', 'google', 'email_change'].includes(
      flow ?? ''
    )
  )
    clean.searchParams.set('flow', flow!);
  const tournament = validTournamentId(url.searchParams.get('tournament'));
  if (tournament) clean.searchParams.set('tournament', tournament);
  window.history.replaceState(null, '', clean.pathname + clean.search);
  callbackPromise = (async () => {
    try {
      if (hasError)
        return {
          session: null,
          error:
            flow === 'oauth' || flow === 'google'
              ? 'Sign-in was not completed. Please try again.'
              : 'This link has expired or was already used. Request a new one.',
          recovery: false,
        };
      let result;
      if (code) result = await client.auth.exchangeCodeForSession(code);
      else if (
        tokenHash &&
        (type === 'signup' ||
          type === 'recovery' ||
          type === 'email_change' ||
          type === 'email')
      )
        result = await client.auth.verifyOtp({ token_hash: tokenHash, type });
      else
        return {
          session: null,
          error:
            'This link has expired or was already used. Request a new one.',
          recovery: false,
        };
      return {
        session: result.data.session,
        error: result.error ? authError(result.error) : null,
        recovery:
          Boolean(result.data.session) &&
          (flow === 'recovery' || type === 'recovery'),
      };
    } catch (error) {
      return { session: null, error: authError(error), recovery: false };
    }
  })();
  return callbackPromise;
}
