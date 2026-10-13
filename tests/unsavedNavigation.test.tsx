import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { RouterProvider, Link } from '@/context/RouterContext';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (text: string) => text }),
}));
let renderer: ReactTestRenderer;
const confirm = vi.fn();
function Draft() {
  useUnsavedChanges(true);
  return <Link to={{ name: 'tournaments' }}>Leave</Link>;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', {
    location: { pathname: '/', hash: '#/profile' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    scrollTo: vi.fn(),
    confirm,
  });
  act(() => {
    renderer = create(
      <RouterProvider>
        <Draft />
      </RouterProvider>
    );
  });
});
afterEach(() => {
  act(() => renderer.unmount());
  vi.unstubAllGlobals();
});
it('keeps an unsaved draft on the page when navigation is declined', () => {
  confirm.mockReturnValue(false);
  act(() =>
    renderer.root
      .findByType('a')
      .props.onClick({ button: 0, preventDefault: vi.fn() })
  );
  expect(window.location.hash).toBe('#/profile');
});
it('asks once and navigates after the user chooses to leave', () => {
  confirm.mockReturnValue(true);
  act(() =>
    renderer.root
      .findByType('a')
      .props.onClick({ button: 0, preventDefault: vi.fn() })
  );
  expect(confirm).toHaveBeenCalledOnce();
  expect(window.location.hash).toBe('/tournaments');
});
