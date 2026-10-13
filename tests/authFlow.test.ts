import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SupabaseClient, Session } from '@supabase/supabase-js';

const session = { user: { id: 'test-player' } } as Session;
const auth = {
  getSession: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
};
const client = { auth } as unknown as SupabaseClient;
const replaceState = vi.fn();
function location(path: string) {
  const url = new URL(path, 'https://qehwachess-test.vercel.app');
  vi.stubGlobal('window', { location: url, history: { replaceState } });
}
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  location('/');
});
afterEach(() => vi.unstubAllGlobals());

it('exchanges a one-time callback only once and removes codes from the address bar', async () => {
  location(
    '/auth/callback?flow=oauth&code=one-time-code&tournament=12345678-1234-1234-1234-123456789abc'
  );
  auth.exchangeCodeForSession.mockResolvedValue({
    data: { session },
    error: null,
  });
  const { initializeAuth } = await import('@/lib/authFlow');
  const [first, second] = await Promise.all([
    initializeAuth(client),
    initializeAuth(client),
  ]);
  expect(first.session).toBe(session);
  expect(second.session).toBe(session);
  expect(auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith(
    'one-time-code'
  );
  expect(replaceState).toHaveBeenCalledWith(
    null,
    '',
    '/auth/callback?flow=oauth&tournament=12345678-1234-1234-1234-123456789abc'
  );
});
it('opens recovery only after a successful exchange', async () => {
  location('/auth/callback?flow=recovery&code=expired');
  auth.exchangeCodeForSession.mockResolvedValue({
    data: { session: null },
    error: { message: 'Code verifier expired' },
  });
  const { initializeAuth } = await import('@/lib/authFlow');
  expect(await initializeAuth(client)).toMatchObject({
    recovery: false,
    session: null,
    error: expect.stringContaining('expired'),
  });
});
it('accepts a recovery token hash and marks its authenticated session for recovery', async () => {
  location('/auth/callback?type=recovery&token_hash=single-use-hash');
  auth.verifyOtp.mockResolvedValue({ data: { session }, error: null });
  const { initializeAuth } = await import('@/lib/authFlow');
  expect(await initializeAuth(client)).toMatchObject({
    recovery: true,
    session,
    error: null,
  });
  expect(auth.verifyOtp).toHaveBeenCalledWith({
    type: 'recovery',
    token_hash: 'single-use-hash',
  });
});
it.each([
  '/auth/callback?type=invite&token_hash=untrusted',
  '/auth/callback?error=access_denied&code=ignored',
  '/auth/callback',
])(
  'fails safely for unsupported or missing callback data: %s',
  async (path) => {
    location(path);
    const { initializeAuth } = await import('@/lib/authFlow');
    expect(await initializeAuth(client)).toMatchObject({
      session: null,
      recovery: false,
      error: expect.any(String),
    });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  }
);
it('keeps redirects on the application origin and rejects arbitrary destinations', async () => {
  const { authRedirect } = await import('@/lib/authFlow');
  expect(authRedirect('oauth', 'https://untrusted.example')).toBe(
    'https://qehwachess-test.vercel.app/auth/callback?flow=oauth'
  );
});
it('uses ordinary session restoration outside callback routes', async () => {
  auth.getSession.mockResolvedValue({ data: { session }, error: null });
  const { initializeAuth } = await import('@/lib/authFlow');
  expect(await initializeAuth(client)).toMatchObject({
    session,
    recovery: false,
  });
  expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
});
