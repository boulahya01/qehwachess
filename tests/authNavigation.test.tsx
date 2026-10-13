import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { RouterProvider } from '@/context/RouterContext';
import { SignInPage } from '@/pages/SignInPage';
import { SignUpPage } from '@/pages/SignUpPage';

const { signIn, signUp } = vi.hoisted(() => ({ signIn: vi.fn(), signUp: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ signIn, signUp }) }));
vi.mock('@/hooks/useData', () => ({
  useCities: () => ({ cities: [{ id: 'city-a', name: 'Rabat' }] }),
}));
vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (text: string) => text }),
}));

const tournamentId = '12345678-1234-1234-1234-123456789abc';
let renderer: ReactTestRenderer | undefined;
let location: { hash: string };

beforeEach(() => {
  location = { hash: '#/signin' };
  vi.stubGlobal('window', { location, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  signIn.mockReset().mockResolvedValue({ error: null });
  signUp.mockReset().mockResolvedValue({ error: null, confirmationRequired: false });
});

it.each([false, true])(
  'preserves tournament intent through signup (email confirmation required: %s)',
  async (confirmationRequired) => {
    const hash = `#/signup?tournament=${tournamentId}`;
    location.hash = hash;
    signUp.mockResolvedValue({ error: null, confirmationRequired });
    act(() => {
      renderer = create(
        <RouterProvider>
          <SignUpPage />
        </RouterProvider>
      );
    });
    act(() => {
      const values = {
        'signup-name': 'Test Player',
        'signup-username': 'testplayer',
        'signup-email': 'player@example.com',
        'signup-lichess': 'testplayer',
      };
      for (const [id, value] of Object.entries(values)) {
        renderer!.root
          .findAllByType('input')
          .find((input) => input.props.id === id)!
          .props.onChange({ target: { value } });
      }
      renderer!.root.findByType('select').props.onChange({ target: { value: 'city-a' } });
    });
    expect(renderer!.root.findByType('a').props.href).toBe(`#/signin?tournament=${tournamentId}`);
    await act(async () => {
      await renderer!.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() });
    });
    expect(signUp).toHaveBeenCalledOnce();
    expect(location.hash).toBe(confirmationRequired ? hash : `/tournaments/${tournamentId}`);
    if (confirmationRequired)
      expect(renderer!.root.findByProps({ role: 'status' }).children.join('')).toContain(
        'Check your email'
      );
  }
);
afterEach(() => {
  if (renderer) act(() => renderer!.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});

function mount(hash: string) {
  location.hash = hash;
  act(() => {
    renderer = create(
      <RouterProvider>
        <SignInPage />
      </RouterProvider>
    );
  });
}

it('restores a tournament from the URL after sign-in and preserves it in the signup link', async () => {
  mount(`#/signin?tournament=${tournamentId}`);
  expect(renderer!.root.findByType('a').props.href).toBe(`#/signup?tournament=${tournamentId}`);
  await act(async () => {
    await renderer!.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() });
  });
  expect(location.hash).toBe(`/tournaments/${tournamentId}`);
});

it.each([
  '#/signin',
  '#/signin?tournament=https%3A%2F%2Fexample.com',
  '#/signin?tournament=..%2Fadmin',
])('uses the dashboard for missing or invalid tournament IDs (%s)', async (hash) => {
  mount(hash);
  expect(renderer!.root.findByType('a').props.href).toBe('#/signup');
  await act(async () => {
    await renderer!.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() });
  });
  expect(location.hash).toBe('/dashboard');
});

it('keeps the tournament intent after a failed sign-in', async () => {
  signIn.mockResolvedValue({ error: 'Invalid login credentials' });
  const hash = `#/signin?tournament=${tournamentId}`;
  mount(hash);
  await act(async () => {
    await renderer!.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() });
  });
  expect(location.hash).toBe(hash);
  expect(renderer!.root.findByType('a').props.href).toBe(`#/signup?tournament=${tournamentId}`);
});
