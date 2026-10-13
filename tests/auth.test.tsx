import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from '@/context/AuthContext';

const { getSession, onAuthStateChange, from, signInWithOAuth, linkIdentity } =
  vi.hoisted(() => ({
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    from: vi.fn(),
    signInWithOAuth: vi.fn(),
    linkIdentity: vi.fn(),
  }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from,
    auth: { getSession, onAuthStateChange, signInWithOAuth, linkIdentity },
  },
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function session(id: string) {
  return { user: { id } } as Session;
}
let state: ReturnType<typeof useAuth>;
let renderer: ReactTestRenderer;
let emit: (event: AuthChangeEvent, value: Session | null) => void;
function Probe() {
  state = useAuth();
  return null;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', {
    location: {
      pathname: '/',
      origin: 'http://localhost',
      href: 'http://localhost/',
    },
  });
  vi.stubGlobal('sessionStorage', {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  onAuthStateChange.mockImplementation((callback) => {
    emit = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function profileQuery(promise: Promise<unknown>) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () => promise,
  };
  return query;
}
it('does not restore a profile after sign-out while its request is pending', async () => {
  const profile = deferred<{ data: { id: string }; error: null }>();
  getSession.mockResolvedValue({
    data: { session: session('player-a') },
    error: null,
  });
  from.mockReturnValue(profileQuery(profile.promise));
  await act(async () => {
    renderer = create(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
  act(() => emit('SIGNED_OUT', null));
  await act(async () =>
    profile.resolve({ data: { id: 'player-a' }, error: null })
  );
  expect(state.user).toBeNull();
  expect(state.profile).toBeNull();
  expect(state.loading).toBe(false);
});
it('ignores a stale initial session after a newer auth event', async () => {
  const initial = deferred<{ data: { session: Session }; error: null }>();
  getSession.mockReturnValue(initial.promise);
  from.mockReturnValue(
    profileQuery(Promise.resolve({ data: { id: 'player-b' }, error: null }))
  );
  await act(async () => {
    renderer = create(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
  await act(async () => emit('SIGNED_IN', session('player-b')));
  await act(async () =>
    initial.resolve({ data: { session: session('player-a') }, error: null })
  );
  expect(state.user?.id).toBe('player-b');
  expect(state.profile?.id).toBe('player-b');
});
it('ends loading and exposes session initialization failures', async () => {
  getSession.mockResolvedValue({
    data: { session: null },
    error: { message: 'Session storage failed' },
  });
  await act(async () => {
    renderer = create(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
  expect(state.loading).toBe(false);
  expect(state).toMatchObject({
    error: 'Could not restore your session. Please reload and try again.',
  });
});
it('reports profile failures instead of silently leaving authenticated pages spinning', async () => {
  getSession.mockResolvedValue({
    data: { session: session('player-a') },
    error: null,
  });
  from.mockReturnValue(
    profileQuery(
      Promise.resolve({ data: null, error: { message: 'Network failed' } })
    )
  );
  await act(async () => {
    renderer = create(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
  expect(state.loading).toBe(false);
  expect(state).toMatchObject({
    error: 'Could not load your profile. Please reload and try again.',
  });
  await act(async () => emit('TOKEN_REFRESHED', session('player-a')));
  expect(from).toHaveBeenCalledTimes(1);
  expect(state.error).toBeTruthy();
});
it('handles rejected session promises without leaving the app loading', async () => {
  getSession.mockRejectedValue(new Error('Session initialization failed'));
  await act(async () => {
    renderer = create(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
  expect(state.loading).toBe(false);
  expect(state.error).toBeTruthy();
});
it.each(['google', 'discord'] as const)(
  'starts %s with a same-origin callback and preserves tournament intent',
  async (provider) => {
    vi.stubEnv(
      provider === 'google'
        ? 'VITE_GOOGLE_AUTH_ENABLED'
        : 'VITE_DISCORD_AUTH_ENABLED',
      'true'
    );
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    signInWithOAuth.mockResolvedValue({ error: null });
    await act(async () => {
      renderer = create(
        <AuthProvider>
          <Probe />
        </AuthProvider>
      );
    });
    await act(async () => {
      await state.signInWithProvider(
        provider,
        '12345678-1234-1234-1234-123456789abc'
      );
    });
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider,
      options: {
        redirectTo:
          'http://localhost/auth/callback?flow=oauth&tournament=12345678-1234-1234-1234-123456789abc',
      },
    });
    expect(linkIdentity).not.toHaveBeenCalled();
  }
);
it('links a provider to the signed-in account without starting another sign-in', async () => {
  vi.stubEnv('VITE_DISCORD_AUTH_ENABLED', 'true');
  getSession.mockResolvedValue({
    data: { session: session('player-a') },
    error: null,
  });
  from.mockReturnValue(
    profileQuery(Promise.resolve({ data: { id: 'player-a' }, error: null }))
  );
  linkIdentity.mockResolvedValue({ error: null });
  await act(async () => {
    renderer = create(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
  await act(async () => {
    await state.signInWithProvider('discord', undefined, true);
  });
  expect(linkIdentity).toHaveBeenCalledWith({
    provider: 'discord',
    options: { redirectTo: 'http://localhost/auth/callback?flow=oauth' },
  });
  expect(signInWithOAuth).not.toHaveBeenCalled();
});
