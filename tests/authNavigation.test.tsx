import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { RouterProvider, Link } from '@/context/RouterContext';
import { SignInPage } from '@/pages/SignInPage';
import { SignUpPage } from '@/pages/SignUpPage';

const { signIn, signUp } = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ signIn, signUp }),
}));
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
  vi.stubGlobal('sessionStorage', {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal('window', {
    location,
    setTimeout,
    clearTimeout,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  signIn.mockReset().mockResolvedValue({ error: null });
  signUp
    .mockReset()
    .mockResolvedValue({ error: null, confirmationRequired: false });
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
      for (const [id, value] of Object.entries({
        'signup-email': 'player@example.com',
        'signup-password': 'longpassphrase',
      })) {
        renderer!.root
          .findAllByType('input')
          .find((input) => input.props.id === id)!
          .props.onChange({ target: { value } });
      }
    });
    expect(
      renderer!.root
        .findAllByType('a')
        .some((a) => a.props.href === `#/signin?tournament=${tournamentId}`)
    ).toBe(true);
    await act(async () => {
      await renderer!.root
        .findByType('form')
        .props.onSubmit({ preventDefault: vi.fn() });
    });
    expect(signUp).toHaveBeenCalledOnce();
    expect(signUp).toHaveBeenCalledWith(
      'player@example.com',
      'longpassphrase',
      tournamentId
    );
    expect(location.hash).toBe(
      confirmationRequired ? hash : `/tournaments/${tournamentId}`
    );
    if (confirmationRequired)
      expect(renderer!.root.findByType('h1').children.join('')).toBe(
        'Check your email'
      );
  }
);
afterEach(() => {
  if (renderer) act(() => renderer!.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});

it('leaves the callback pathname when following or opening an auth link', () => {
  const replaceState = vi.fn();
  vi.stubGlobal('window', {
    location: {
      pathname: '/auth/callback',
      search: `?tournament=${tournamentId}`,
      hash: '',
    },
    history: { replaceState },
    scrollTo: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  act(() => {
    renderer = create(
      <RouterProvider>
        <Link to={{ name: 'signin', tournamentId }}>Sign in</Link>
      </RouterProvider>
    );
  });
  const link = renderer!.root.findByType('a');
  expect(link.props.href).toBe(`/#/signin?tournament=${tournamentId}`);
  act(() => link.props.onClick({ button: 0, preventDefault: vi.fn() }));
  expect(replaceState).toHaveBeenCalledWith(
    null,
    '',
    `/#/signin?tournament=${tournamentId}`
  );
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
  expect(
    renderer!.root
      .findAllByType('a')
      .some((a) => a.props.href === `#/signup?tournament=${tournamentId}`)
  ).toBe(true);
  await act(async () => {
    await renderer!.root
      .findByType('form')
      .props.onSubmit({ preventDefault: vi.fn() });
  });
  expect(location.hash).toBe(`/tournaments/${tournamentId}`);
});

it.each([
  '#/signin',
  '#/signin?tournament=https%3A%2F%2Fexample.com',
  '#/signin?tournament=..%2Fadmin',
])(
  'uses the dashboard for missing or invalid tournament IDs (%s)',
  async (hash) => {
    mount(hash);
    expect(
      renderer!.root.findAllByType('a').some((a) => a.props.href === '#/signup')
    ).toBe(true);
    await act(async () => {
      await renderer!.root
        .findByType('form')
        .props.onSubmit({ preventDefault: vi.fn() });
    });
    expect(location.hash).toBe('/dashboard');
  }
);

it('keeps the tournament intent after a failed sign-in', async () => {
  signIn.mockResolvedValue({ error: 'Invalid login credentials' });
  const hash = `#/signin?tournament=${tournamentId}`;
  mount(hash);
  await act(async () => {
    await renderer!.root
      .findByType('form')
      .props.onSubmit({ preventDefault: vi.fn() });
  });
  expect(location.hash).toBe(hash);
  expect(
    renderer!.root
      .findAllByType('a')
      .some((a) => a.props.href === `#/signup?tournament=${tournamentId}`)
  ).toBe(true);
});
