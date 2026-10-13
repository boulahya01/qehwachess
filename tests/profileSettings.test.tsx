import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { RouterProvider } from '@/context/RouterContext';
import { ProfilePage } from '@/pages/ProfilePage';

const { eq, refreshProfile, profileState } = vi.hoisted(() => ({
  eq: vi.fn(),
  refreshProfile: vi.fn(),
  profileState: {
    value: {
      id: 'test-player',
      full_name: 'Chess player',
      role: 'player',
      avatar_url: null as string | null,
    },
  },
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: eq,
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { phone: null }, error: null }),
        }),
      }),
    }),
  },
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-player' },
    profile: profileState.value,
    refreshProfile,
  }),
}));
vi.mock('@/hooks/useData', () => ({ useCities: () => ({ cities: [] }) }));
vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (text: string) => text }),
}));
let renderer: ReactTestRenderer;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal('window', {
    location: { pathname: '/', hash: '#/profile' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  await act(async () => {
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
    'Optional - only you can see this'
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

it('preserves a public-profile draft when an avatar or session refresh replaces the profile object', async () => {
  act(() =>
    renderer.root
      .findByProps({ id: 'profile-name' })
      .props.onChange({ target: { value: 'Unfinished name' } })
  );
  profileState.value = {
    ...profileState.value,
    avatar_url: 'https://example.com/avatar.png',
  };
  await act(async () =>
    renderer.update(
      <RouterProvider>
        <ProfilePage />
      </RouterProvider>
    )
  );
  expect(renderer.root.findByProps({ id: 'profile-name' }).props.value).toBe(
    'Unfinished name'
  );
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'You have unsaved changes.'
  );
});
