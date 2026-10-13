import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { RouterProvider } from '@/context/RouterContext';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { SecurityPage } from '@/pages/SecurityPage';
import { SocialAuthButtons } from '@/components/auth/AuthParts';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';

const { auth } = vi.hoisted(() => ({
  auth: {
    user: null as null | {
      id: string;
      email: string;
      identities: { provider: string }[];
    },
    recoveryReady: false,
    loading: false,
    error: null as string | null,
    requestPasswordReset: vi.fn(),
    updatePassword: vi.fn(),
    updateEmail: vi.fn(),
    finishRecovery: vi.fn(),
    signInWithProvider: vi.fn(),
    signOut: vi.fn(),
  },
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (text: string) => text }),
}));
let renderer: ReactTestRenderer | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  auth.user = null;
  auth.recoveryReady = false;
  auth.error = null;
  vi.stubEnv('VITE_GOOGLE_AUTH_ENABLED', 'true');
  vi.stubEnv('VITE_DISCORD_AUTH_ENABLED', 'true');
  vi.stubGlobal('window', {
    location: { hash: '#/forgot-password', pathname: '/', search: '' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});
afterEach(() => {
  if (renderer) act(() => renderer!.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function mount(component: React.ReactNode) {
  act(() => {
    renderer = create(<RouterProvider>{component}</RouterProvider>);
  });
}
function fill(id: string, value: string) {
  act(() =>
    renderer!.root
      .findAllByType('input')
      .find((input) => input.props.id === id)!
      .props.onChange({ target: { value } })
  );
}
async function submit() {
  await act(async () =>
    renderer!.root
      .findByType('form')
      .props.onSubmit({ preventDefault: vi.fn() })
  );
}
function text() {
  return JSON.stringify(renderer!.toJSON());
}
function signedIn() {
  auth.user = {
    id: 'player-a',
    email: 'player@example.com',
    identities: [{ provider: 'email' }],
  };
}

it('does not reveal whether an email exists after a reset request', async () => {
  auth.requestPasswordReset.mockResolvedValue({ error: null });
  mount(<ForgotPasswordPage />);
  fill('recovery-email', 'unknown@example.com');
  await submit();
  expect(text()).toContain('If an account exists for this address');
  expect(renderer!.root.findAllByType('form')).toHaveLength(0);
});
it('keeps the recovery form usable after a network failure', async () => {
  auth.requestPasswordReset.mockRejectedValue(new Error('Network unavailable'));
  mount(<ForgotPasswordPage />);
  fill('recovery-email', 'player@example.com');
  await submit();
  expect(text()).toContain('Check your connection');
  expect(renderer!.root.findByProps({ id: 'recovery-email' }).props.value).toBe(
    'player@example.com'
  );
  expect(renderer!.root.findByType('form').props['aria-busy']).toBe(false);
});
it('requires a recovery session before offering a new password form', () => {
  signedIn();
  mount(<ResetPasswordPage />);
  expect(renderer!.root.findAllByType('form')).toHaveLength(0);
  expect(text()).toContain('Request a fresh link');
});

it('does not promise confirmation emails when the backend can confirm email changes immediately', async () => {
  signedIn(); auth.updateEmail.mockResolvedValue({ error: null }); mount(<SecurityPage />);
  const change = renderer!.root.findAllByType('button').find(button => button.children.includes('Change email'))!;
  act(() => change.props.onClick()); fill('change-email', 'new@example.com'); await submit();
  expect(text()).toContain('Email change requested.');
  expect(text()).not.toContain('Your current address stays active until confirmation.');
});
it('rejects mismatched recovery passwords without changing credentials', async () => {
  signedIn();
  auth.recoveryReady = true;
  mount(<ResetPasswordPage />);
  fill('reset-password', 'first-passphrase');
  fill('reset-confirm', 'different-passphrase');
  await submit();
  expect(auth.updatePassword).not.toHaveBeenCalled();
  expect(text()).toContain('Passwords do not match.');
});
it('clears the recovery state and secret fields only after a confirmed password update', async () => {
  signedIn();
  auth.recoveryReady = true;
  auth.updatePassword.mockResolvedValue({ error: null });
  mount(<ResetPasswordPage />);
  fill('reset-password', 'test-passphrase');
  fill('reset-confirm', 'test-passphrase');
  await submit();
  expect(auth.finishRecovery).toHaveBeenCalledOnce();
  expect(text()).toContain('Password updated');
  expect(renderer!.root.findAllByType('input')).toHaveLength(0);
});
it('offers a provider connection through the existing account rather than a new sign-in', async () => {
  signedIn();
  auth.user!.identities.push({ provider: 'google' });
  auth.signInWithProvider.mockResolvedValue({ error: 'Linking unavailable' });
  mount(<SecurityPage />);
  expect(text()).toContain('Connected');
  expect(text()).not.toContain('Connect Google');
  const button = renderer!.root
    .findAllByType('button')
    .find((button) =>
      button
        .findAllByType('span')
        .some((span) => span.children.includes('Connect Discord'))
    )!;
  await act(async () => button.props.onClick());
  expect(auth.signInWithProvider).toHaveBeenCalledWith(
    'discord',
    undefined,
    true
  );
});
it('recovers provider controls after a failed redirect', async () => {
  auth.signInWithProvider.mockRejectedValue(new Error('Network unavailable'));
  mount(<SocialAuthButtons />);
  await act(async () => {
    renderer!.root.findAllByType('button')[0].props.onClick();
  });
  expect(text()).toContain('Check your connection');
  expect(
    renderer!.root
      .findAllByType('button')
      .every((button) => !button.props.disabled)
  ).toBe(true);
});
it('handles the first confirmation of a secure email change without showing an invalid-link error', () => {
  window.location.search = '?flow=email_change';
  mount(<AuthCallbackPage />);
  expect(text()).toContain('Check your other inbox');
  expect(text()).not.toContain('This link could not be used');
});
