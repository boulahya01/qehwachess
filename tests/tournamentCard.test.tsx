import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import type { Tournament } from '@/types';
import { TournamentCard } from '@/components/TournamentCard';

vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ t: (text: string) => text, language: 'en' }) }));
vi.mock('@/context/RouterContext', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));

it.each([
  [undefined, '64 player capacity'],
  [0, '64 spots'],
  [1, '63 spots'],
  [64, 'Full'],
  [65, 'Full'],
])('labels capacity and known availability separately (count %s)', (registration_count, expected) => {
  const tournament = { id: 'tournament-a', title: 'Rapid Open', start_date: '2099-10-18', end_date: '2099-10-18',
    format: 'rapid', entry_fee: 0, max_participants: 64, registration_count } as Tournament;
  let renderer: ReturnType<typeof create>;
  act(() => { renderer = create(<TournamentCard tournament={tournament} />); });
  try {
    const labels = renderer!.root.findAllByType('span').map((span) => span.children.join(''));
    expect(labels).toContain(expected);
    if (registration_count === undefined) expect(labels).not.toContain('64 spots');
  } finally { act(() => renderer!.unmount()); }
});
