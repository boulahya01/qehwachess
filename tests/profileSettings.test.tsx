import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { RouterProvider } from '@/context/RouterContext';
import { ProfilePage } from '@/pages/ProfilePage';

const { eq, refreshProfile, profile } = vi.hoisted(() => ({
  eq: vi.fn(),
  refreshProfile: vi.fn(),
  profile: {
    id: 'test-player',
    full_name: 'Chess player',
    email: 'player@example.com',
    role: 'player',
  },
}));
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ update: () => ({ eq }) }) },
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-player' }, profile, refreshProfile }),
}));
vi.mock('@/hooks/useData', () => ({ useCities: () => ({ cities: [] }) }));
vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (text: string) => text }),
}));
let renderer: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', {
    location: { pathname: '/', hash: '#/profile' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  act(() => {
    renderer = create(
      <RouterProvider>
        <ProfilePage />
      </RouterProvider>
    );
  });
});
afterEach(() => {
  act(() => renderer.unmount());
  vi.unstubAllGlobals();
});
it('keeps account credentials out of the optional public-profile editor', () => {
  expect(
    renderer.root
      .findAllByType('input')
      .some(
        (input) =>
          input.props.type === 'email' || input.props.type === 'password'
      )
  ).toBe(false);
  expect(
    renderer.root.findAllByType('input').every((input) => !input.props.required)
  ).toBe(true);
  expect(renderer.root.findByProps({ type: 'submit' }).props.disabled).toBe(
    true
  );
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Optional - visible to other users'
  );
});
it('preserves edited details and re-enables saving after a rejected request', async () => {
  eq.mockRejectedValue(new Error('Network unavailable'));
  act(() =>
    renderer.root
      .findByProps({ id: 'profile-name' })
      .props.onChange({ target: { value: 'Updated name' } })
  );
  await act(async () =>
    renderer.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() })
  );
  expect(renderer.root.findByProps({ id: 'profile-name' }).props.value).toBe(
    'Updated name'
  );
  expect(renderer.root.findByProps({ type: 'submit' }).props.disabled).toBe(
    false
  );
  expect(JSON.stringify(renderer.toJSON())).toContain('Check your connection');
  expect(refreshProfile).not.toHaveBeenCalled();
});
