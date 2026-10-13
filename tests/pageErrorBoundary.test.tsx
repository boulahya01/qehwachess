import { lazy, Suspense } from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

it('offers recovery when a page chunk fails and lets navigation open another page', async () => {
  const reload = vi.fn();
  vi.stubGlobal('window', { location: { reload } });
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const BrokenPage = lazy(() => Promise.reject(new Error('Chunk download failed')));
  const boundary = (key: string, children: React.ReactNode) => (
    <PageErrorBoundary key={key} message="Unable to load this page" reloadLabel="Reload">
      <Suspense fallback={<p>Loading</p>}>{children}</Suspense>
    </PageErrorBoundary>
  );
  let renderer: ReturnType<typeof create> | undefined;
  try {
    await act(async () => { renderer = create(boundary('tournament:a', <BrokenPage />)); });
    expect(renderer!.root.findByProps({ role: 'alert' }).findByType('p').children).toEqual(['Unable to load this page']);
    act(() => renderer!.root.findByType('button').props.onClick());
    expect(reload).toHaveBeenCalledOnce();
    act(() => renderer!.update(boundary('tournament:b', <h1>Another tournament</h1>)));
    expect(renderer!.root.findByType('h1').children).toEqual(['Another tournament']);
    expect(renderer!.root.findAllByProps({ role: 'alert' })).toHaveLength(0);
  } finally {
    act(() => renderer?.unmount());
    consoleError.mockRestore();
    vi.unstubAllGlobals();
  }
});
