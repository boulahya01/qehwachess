import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  RouterProvider,
  useRouter,
  getRouteIdentity,
} from '@/context/RouterContext';
import { AccountNavigation } from '@/components/AccountNavigation';
import { ClubWorkspaceNavigation } from '@/components/ClubWorkspaceNavigation';
import { MyClubsPage } from '@/pages/MyClubsPage';
import { PublicProfilePage } from '@/pages/PublicProfilePage';
import { OrganizerDashboard } from '@/pages/OrganizerDashboard';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { ClubManagementPage } from '@/pages/ClubManagementPage';
import { PlayerDashboard } from '@/pages/PlayerDashboard';
import { tournamentWorkflow } from '@/lib/tournamentWorkflow';
import { publicProfileFields } from '@/lib/publicProfile';

const state = vi.hoisted(() => ({
  user: { id: 'self' },
  role: 'organizer',
  calls: [] as {
    table: string;
    fields?: string;
    filters: [string, string][];
  }[],
  updateError: false,
  failTable: '',
  waitlist: false,
  events: [
    {
      id: 'draft',
      title: 'My draft',
      organizer_id: 'self',
      status: 'draft',
      start_date: '2026-10-20',
      end_date: '2026-10-20',
    },
    {
      id: 'pending',
      title: 'My review',
      organizer_id: 'self',
      status: 'pending',
      start_date: '2026-10-20',
      end_date: '2026-10-20',
    },
    {
      id: 'published',
      title: 'My public event',
      organizer_id: 'self',
      status: 'published',
      start_date: '2026-10-20',
      end_date: '2026-10-20',
    },
    {
      id: 'cancelled',
      title: 'My cancelled event',
      organizer_id: 'self',
      status: 'cancelled',
      start_date: '2026-10-20',
      end_date: '2026-10-20',
    },
    {
      id: 'other',
      title: 'Someone else’s draft',
      organizer_id: 'other',
      status: 'draft',
      start_date: '2026-10-20',
      end_date: '2026-10-20',
    },
  ],
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: state.user,
    profile: { role: state.role },
    loading: false,
  }),
}));
vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: (text: string) => text }),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const call = { table, fields: '', filters: [] as [string, string][] };
      state.calls.push(call);
      let updating = false;
      const records = () => {
        if (table === 'registrations' && state.waitlist)
          return [
            {
              id: 'waitlisted',
              player_id: 'self',
              status: 'waitlisted',
              tournament: {
                id: 'waiting-event',
                title: 'Waiting tournament',
                status: 'published',
                start_date: new Date(Date.now() + 7 * 86400000).toISOString(),
                end_date: new Date(Date.now() + 7 * 86400000).toISOString(),
              },
            },
          ];
        if (table === 'tournaments')
          return state.events.filter((event) =>
            call.filters.every(
              ([key, value]) => event[key as keyof typeof event] === value
            )
          );
        if (table === 'clubs')
          return [
            { id: 'owned', name: 'Owned club', organizer_id: 'self' },
            { id: 'other', name: 'Other club', organizer_id: 'other' },
          ].filter((club) =>
            call.filters.every(
              ([key, value]) => club[key as keyof typeof club] === value
            )
          );
        if (table === 'club_memberships')
          return [
            {
              profile_id: 'self',
              status: 'pending',
              club: { id: 'joined', name: 'Joined club' },
            },
          ];
        return [];
      };
      const query = {
        insert: () => query,
        select: (fields: string) => {
          call.fields = fields;
          return query;
        },
        eq: (key: string, value: string) => {
          call.filters.push([key, value]);
          return query;
        },
        order: () => query,
        gte: () => query,
        limit: () => query,
        update: () => {
          updating = true;
          return query;
        },
        single: async () => ({
          data:
            updating && !state.updateError
              ? { id: 'pending', status: 'published' }
              : null,
          error:
            state.updateError || state.failTable === table
              ? { message: 'network' }
              : null,
        }),
        maybeSingle: async () => ({
          data: {
            id: 'self',
            full_name: 'Public name',
            bio: 'Public bio',
            email: 'PRIVATE_EMAIL',
            phone: 'PRIVATE_PHONE',
          },
          error: null,
        }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: records(),
            error: state.failTable === table ? { message: 'network' } : null,
          }).then(resolve),
      };
      return query;
    },
  },
}));
let renderer: ReactTestRenderer | undefined;
beforeEach(() => {
  state.role = 'organizer';
  state.calls = [];
  state.updateError = false;
  state.failTable = '';
  state.waitlist = false;
  vi.stubGlobal('window', {
    location: { pathname: '/', hash: '#/dashboard' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    scrollTo: vi.fn(),
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});
async function render(component: React.ReactNode, hash = '#/dashboard') {
  window.location.hash = hash;
  await act(async () => {
    renderer = create(<RouterProvider>{component}</RouterProvider>);
  });
  return renderer!;
}
function RouteProbe() {
  return <pre>{JSON.stringify(useRouter().route)}</pre>;
}

it.each([
  ['#/account/events', { name: 'dashboard', section: 'events' }],
  ['#/dashboard/clubs', { name: 'dashboard', section: 'clubs' }],
  ['#/dashboard', { name: 'dashboard', section: 'games' }],
  [
    '#/club-management/selected?section=teams',
    { name: 'clubManagement', clubId: 'selected', section: 'teams' },
  ],
  ['#/players/public-id', { name: 'publicProfile', id: 'public-id' }],
  ['#/settings', { name: 'settings' }],
])('restores the shared account destination for %s', async (hash, expected) => {
  const view = await render(<RouteProbe />, hash);
  expect(JSON.parse(view.root.findByType('pre').children.join(''))).toEqual(
    expected
  );
});
it.each(['player', 'organizer', 'admin'])(
  'keeps account navigation coherent for %s without offering staff access',
  async (role) => {
    state.role = role;
    const view = await render(<AccountNavigation />, '#/dashboard/clubs');
    const links = view.root.findAllByType('a');
    expect(links.map((link) => link.props.href)).toContain('#/dashboard/clubs');
    expect(links.some((link) => link.props.href === '#/admin')).toBe(
      role === 'admin'
    );
    expect(
      links
        .filter((link) => link.props['aria-current'] === 'page')
        .map((link) => link.props.href)
    ).toEqual(['#/dashboard/clubs']);
  }
);
it('retains the selected club in every workspace link and withholds owner-only Discord controls', async () => {
  const view = await render(
    <ClubWorkspaceNavigation
      clubId="selected"
      section="members"
      canConfigureDiscord={false}
    />
  );
  expect(view.root.findAllByType('a').map((link) => link.props.href)).toEqual([
    '#/club-management/selected?section=events',
    '#/club-management/selected?section=members',
    '#/club-management/selected?section=teams',
  ]);
});
it('loads memberships for the current user and management cards only for their owned clubs', async () => {
  const view = await render(<MyClubsPage />, '#/dashboard/clubs');
  const output = JSON.stringify(view.toJSON());
  expect(output).toContain('Joined club');
  expect(output).toContain('Owned club');
  expect(output).not.toContain('Other club');
  expect(
    state.calls.find((call) => call.table === 'club_memberships')?.filters
  ).toContainEqual(['profile_id', 'self']);
  expect(
    state.calls.find((call) => call.table === 'clubs')?.filters
  ).toContainEqual(['organizer_id', 'self']);
});
it('does not fetch management data for an ordinary player', async () => {
  state.role = 'player';
  await render(<MyClubsPage />);
  expect(state.calls.some((call) => call.table === 'clubs')).toBe(false);
});
it('requests only public profile fields and never renders private contact values', async () => {
  const view = await render(<PublicProfilePage id="self" />);
  expect(state.calls).toEqual([
    {
      table: 'profiles',
      fields: publicProfileFields,
      filters: [['id', 'self']],
    },
  ]);
  expect(publicProfileFields).not.toMatch(/email|phone|role/);
  expect(JSON.stringify(view.toJSON())).not.toMatch(
    /PRIVATE_EMAIL|PRIVATE_PHONE/
  );
  expect(JSON.stringify(view.toJSON())).toContain('Public name');
});
it('offers a correct next action for each event state and scopes the event list to its owner', async () => {
  const view = await render(<OrganizerDashboard />, '#/dashboard/events');
  const output = JSON.stringify(view.toJSON());
  for (const label of [
    'Continue draft',
    'Review details',
    'Manage event',
    'View event',
  ])
    expect(output).toContain(label);
  expect(output).not.toContain('Someone else’s draft');
  expect(tournamentWorkflow('pending').step).toBe(1);
  expect(tournamentWorkflow('published').label).toBe('Approved and published');
  expect(tournamentWorkflow('cancelled').step).toBe(-1);
});
it('starts the staff workspace at the approval queue and leaves failed approvals in the queue', async () => {
  state.role = 'admin';
  state.updateError = true;
  const view = await render(<AdminDashboard />, '#/admin');
  expect(
    view.root
      .findAllByType('button')
      .find((button) => button.props['aria-current'] === 'page')
      ?.children.join('')
  ).toContain('Approval queue');
  expect(JSON.stringify(view.toJSON())).not.toContain('Recent Registrations');
  const approve = view.root.findAllByType('button').find((button) =>
    button.children
      .filter((child) => typeof child === 'string')
      .join('')
      .includes('Approve and publish')
  );
  await act(async () => {
    await approve!.props.onClick();
  });
  expect(JSON.stringify(view.toJSON())).toContain('My review');
  expect(JSON.stringify(view.toJSON())).toContain(
    'Could not update tournament. Please try again.'
  );
});
it('keeps the staff workspace inaccessible to organizers', async () => {
  const view = await render(<AdminDashboard />, '#/admin');
  expect(JSON.stringify(view.toJSON())).toContain('Admin access required.');
  expect(state.calls).toEqual([]);
});
it('removes an approved event from the queue only after server confirmation', async () => {
  state.role = 'admin';
  const view = await render(<AdminDashboard />, '#/admin');
  const approve = view.root.findAllByType('button').find((button) =>
    button.children
      .filter((child) => typeof child === 'string')
      .join('')
      .includes('Approve and publish')
  );
  await act(async () => {
    await approve!.props.onClick();
  });
  expect(JSON.stringify(view.toJSON())).not.toContain('My review');
  expect(JSON.stringify(view.toJSON())).toContain(
    'No tournaments pending review.'
  );
});
it('does not silently switch an inaccessible club URL to a different managed club', async () => {
  const view = await render(
    <ClubManagementPage />,
    '#/club-management/other?section=members'
  );
  expect(JSON.stringify(view.toJSON())).toContain(
    'This club is unavailable or you do not have management access.'
  );
  expect(
    view.root.findAllByProps({ 'aria-label': 'Selected club' })
  ).toHaveLength(0);
});
it('reports a failed roster load instead of claiming the club has no members', async () => {
  state.failTable = 'club_memberships';
  const view = await render(
    <ClubManagementPage />,
    '#/club-management/owned?section=members'
  );
  expect(JSON.stringify(view.toJSON())).toContain(
    'Could not load club members. Please try again.'
  );
  expect(JSON.stringify(view.toJSON())).not.toContain('No members yet');
});
it('preserves a team draft and permits retry after a failed save', async () => {
  state.failTable = 'club_teams';
  const view = await render(
    <ClubManagementPage />,
    '#/club-management/owned?section=teams'
  );
  const input = view.root.findByProps({ 'aria-label': 'Team name' });
  act(() => input.props.onChange({ target: { value: 'Friends team' } }));
  await act(async () => {
    await view.root
      .findByType('form')
      .props.onSubmit({ preventDefault: vi.fn() });
  });
  expect(view.root.findByProps({ 'aria-label': 'Team name' }).props.value).toBe(
    'Friends team'
  );
  expect(
    view.root.findByProps({ 'aria-label': 'Team name' }).props.disabled
  ).toBe(false);
  expect(JSON.stringify(view.toJSON())).toContain(
    'Could not create the team. Your draft is still here.'
  );
});
it('shows a waitlisted registration without presenting it as a confirmed next game', async () => {
  state.waitlist = true;
  const view = await render(<PlayerDashboard />);
  expect(JSON.stringify(view.toJSON())).toContain('Waiting tournament');
  expect(JSON.stringify(view.toJSON())).toContain('waitlisted');
  const headings = view.root
    .findAllByType('h2')
    .map((node) =>
      node.children.filter((child) => typeof child === 'string').join('')
    );
  expect(headings).toContain('Find your next game');
  expect(headings).not.toContain('Your next game');
});
it('isolates grouped page failures and excludes ephemeral consent tickets from route identity', () => {
  expect(getRouteIdentity({ name: 'dashboard', section: 'games' })).not.toBe(
    getRouteIdentity({ name: 'dashboard', section: 'events' })
  );
  expect(
    getRouteIdentity({
      name: 'clubManagement',
      clubId: 'one',
      section: 'members',
    })
  ).not.toBe(
    getRouteIdentity({
      name: 'clubManagement',
      clubId: 'two',
      section: 'members',
    })
  );
  expect(
    getRouteIdentity({
      name: 'discordIntegration',
      scope: 'club',
      clubId: 'one',
      ticket: 'ephemeral-consent',
    })
  ).not.toContain('ephemeral-consent');
});
