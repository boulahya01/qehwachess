import { ClubWorkspaceNavigation } from '@/components/ClubWorkspaceNavigation';
import { ClubEvents } from '@/components/ClubEvents';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { authError } from '@/lib/authFlow';
import { Field } from '@/components/ui/Field';
import { FormEvent, useEffect, useState, useRef } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  Clock3,
  MapPin,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Link, useRouter } from '@/context/RouterContext';
import { useCities } from '@/hooks/useData';
import { useWorkspaceLanguage as useLanguage } from '@/hooks/useWorkspaceLanguage';
import { supabase } from '@/lib/supabase';
import type { Club, ClubMembership } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/Feedback';

type ManagedMembership = ClubMembership & {
  profile: NonNullable<ClubMembership['profile']>;
};

interface ManagedTeamMember {
  id: string;
  team_id: string;
  profile_id: string;
  profile: { id: string; full_name: string; username: string | null } | null;
}

interface ManagedTeam {
  id: string;
  club_id: string;
  name: string;
  members: ManagedTeamMember[];
}

export function ClubManagementPage() {
  const { t } = useLanguage();
  const { user, profile, loading: authLoading } = useAuth();
  const { route, navigate } = useRouter();
  const routeClubId =
    route.name === 'clubManagement' ? route.clubId : undefined;
  const section =
    route.name === 'clubManagement' ? (route.section ?? 'events') : 'events';
  const { cities } = useCities();
  const selectedClubRef = useRef('');
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState('');
  selectedClubRef.current = selectedClubId;
  const [memberships, setMemberships] = useState<ManagedMembership[]>([]);
  const [teams, setTeams] = useState<ManagedTeam[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [memberLoadError, setMemberLoadError] = useState(false);
  const [teamLoadError, setTeamLoadError] = useState(false);
  const [rosterRevision, setRosterRevision] = useState(0);
  const [teamName, setTeamName] = useState('');
  const [teamMemberIds, setTeamMemberIds] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamSaving, setTeamSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    city_id: '',
    description: '',
    address: '',
    contact_email: '',
    contact_phone: '',
  });

  const allowLeave = useUnsavedChanges(
    Boolean(
      teamName.trim() ||
        (showForm &&
          (form.name ||
            form.description ||
            form.address ||
            form.contact_email ||
            form.contact_phone))
    )
  );

  useEffect(() => {
    if (
      !user ||
      authLoading ||
      !['organizer', 'admin'].includes(profile?.role ?? '')
    )
      return;
    let active = true;
    setLoading(true);
    setError(null);
    async function loadClubs() {
      const query = supabase
        .from('clubs')
        .select('*, city:cities(*)')
        .order('name');
      if (profile?.role !== 'admin') query.eq('organizer_id', user!.id);
      const { data, error: queryError } = await query;
      if (!active) return;
      if (queryError) setError(queryError.message);
      const ownClubs = (data ?? []) as Club[];
      setClubs(ownClubs);
      setSelectedClubId((current) =>
        ownClubs.some((club) => club.id === (routeClubId ?? current))
          ? (routeClubId ?? current)
          : routeClubId
            ? ''
            : (ownClubs[0]?.id ?? '')
      );
      setLoading(false);
    }
    void loadClubs().catch(() => {
      if (active) {
        setError('Could not load your clubs. Please try again.');
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [authLoading, profile?.role, user, routeClubId, rosterRevision]);

  useEffect(() => {
    if (!selectedClubId) {
      setMemberships([]);
      return;
    }
    setMemberships([]);
    setMembersLoading(true);
    setMemberLoadError(false);
    setTeamName('');
    setTeamMemberIds({});
    let active = true;
    async function loadMemberships() {
      const { data, error: queryError } = await supabase
        .from('club_memberships')
        .select(
          '*, profile:profiles!club_memberships_profile_id_fkey(id, full_name, avatar_url, username)'
        )
        .eq('club_id', selectedClubId)
        .order('joined_at', { ascending: false });
      if (!active) return;
      if (queryError) setMemberLoadError(true);
      setMemberships((data ?? []) as unknown as ManagedMembership[]);
      setMembersLoading(false);
    }
    void loadMemberships().catch(() => {
      if (active) {
        setMemberLoadError(true);
        setMembersLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedClubId, rosterRevision]);

  useEffect(() => {
    if (section !== 'teams') return;
    if (!selectedClubId) {
      setTeams([]);
      return;
    }
    setTeams([]);
    setTeamsLoading(true);
    setTeamLoadError(false);
    let active = true;
    async function loadTeams() {
      const { data: teamData, error: teamError } = await supabase
        .from('club_teams')
        .select('id, club_id, name')
        .eq('club_id', selectedClubId)
        .order('name');
      if (!active) return;
      if (teamError) {
        setTeamLoadError(true);
        setTeams([]);
        setTeamsLoading(false);
        return;
      }
      const teamIds = (teamData ?? []).map((team) => team.id);
      let teamMemberships: ManagedTeamMember[] = [];
      if (teamIds.length > 0) {
        const { data: membershipData, error: teamMembershipError } =
          await supabase
            .from('club_team_memberships')
            .select(
              'id, team_id, profile_id, profile:profiles!club_team_memberships_profile_id_fkey(id, full_name, username)'
            )
            .in('team_id', teamIds);
        if (!active) return;
        if (teamMembershipError) setTeamLoadError(true);
        teamMemberships = (membershipData ??
          []) as unknown as ManagedTeamMember[];
      }
      setTeams(
        (teamData ?? []).map((team) => ({
          id: team.id,
          club_id: team.club_id,
          name: team.name,
          members: teamMemberships.filter(
            (membership) => membership.team_id === team.id
          ),
        }))
      );
      setTeamsLoading(false);
    }
    void loadTeams().catch(() => {
      if (active) {
        setTeamLoadError(true);
        setTeamsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedClubId, section, rosterRevision]);

  if (authLoading)
    return (
      <div className="pt-24">
        <PageLoader />
      </div>
    );
  if (!user) {
    navigate({ name: 'signin' });
    return null;
  }
  if (profile?.role !== 'organizer' && profile?.role !== 'admin') {
    return (
      <div className="pt-24">
        <ErrorState message={t('Organizer access required to manage clubs.')} />
      </div>
    );
  }

  async function createClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !form.city_id) return;
    setSaving(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('clubs')
        .insert({
          name: form.name.trim(),
          city_id: form.city_id,
          description: form.description.trim(),
          address: form.address.trim() || null,
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          organizer_id: user.id,
        })
        .select('*, city:cities(*)')
        .single();
      if (insertError) {
        setError(insertError.message);
      } else if (data && mountedRef.current) {
        setClubs((current) =>
          [...current, data as Club].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );
        setSelectedClubId(data.id);
        setShowForm(false);
        setForm({
          name: '',
          city_id: '',
          description: '',
          address: '',
          contact_email: '',
          contact_phone: '',
        });
        allowLeave();
        navigate({
          name: 'clubManagement',
          clubId: data.id,
          section: 'events',
        });
      }
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setSaving(false);
    }
  }

  async function reviewMembership(
    membership: ManagedMembership,
    status: 'active' | 'rejected'
  ) {
    setError(null);
    const { error: updateError } = await supabase
      .from('club_memberships')
      .update({ status })
      .eq('id', membership.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMemberships((current) =>
      current.map((item) =>
        item.id === membership.id ? { ...item, status } : item
      )
    );
  }

  async function removeMembership(membership: ManagedMembership) {
    if (!confirm(t('Remove this member from the club?'))) return;
    setError(null);
    const { error: deleteError } = await supabase
      .from('club_memberships')
      .delete()
      .eq('id', membership.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setMemberships((current) =>
      current.filter((item) => item.id !== membership.id)
    );
  }

  async function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClubId || !teamName.trim() || teamSaving) return;
    const targetClubId = selectedClubId;
    setTeamSaving(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('club_teams')
        .insert({ club_id: targetClubId, name: teamName.trim() })
        .select('id, club_id, name')
        .single();
      if (!mountedRef.current || selectedClubRef.current !== targetClubId)
        return;
      if (insertError || !data)
        throw insertError || new Error('Team not saved');
      setTeams((current) =>
        [...current, { ...data, members: [] }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setTeamName('');
    } catch {
      if (mountedRef.current && selectedClubRef.current === targetClubId)
        setError('Could not create the team. Your draft is still here.');
    } finally {
      if (mountedRef.current) setTeamSaving(false);
    }
  }

  async function addTeamMember(team: ManagedTeam) {
    const profileId = teamMemberIds[team.id];
    if (!profileId) return;
    setError(null);
    const { data, error: insertError } = await supabase
      .from('club_team_memberships')
      .insert({ team_id: team.id, profile_id: profileId })
      .select(
        'id, team_id, profile_id, profile:profiles!club_team_memberships_profile_id_fkey(id, full_name, username)'
      )
      .single();
    if (insertError) {
      setError(insertError.message);
      return;
    }
    const newMember = data as unknown as ManagedTeamMember;
    setTeams((current) =>
      current.map((item) =>
        item.id === team.id
          ? { ...item, members: [...item.members, newMember] }
          : item
      )
    );
    setTeamMemberIds((current) => ({ ...current, [team.id]: '' }));
  }

  async function removeTeamMember(
    team: ManagedTeam,
    member: ManagedTeamMember
  ) {
    setError(null);
    const { error: deleteError } = await supabase
      .from('club_team_memberships')
      .delete()
      .eq('id', member.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setTeams((current) =>
      current.map((item) =>
        item.id === team.id
          ? {
              ...item,
              members: item.members.filter((entry) => entry.id !== member.id),
            }
          : item
      )
    );
  }

  async function deleteTeam(team: ManagedTeam) {
    if (!confirm(t('Delete this team?'))) return;
    setError(null);
    const { error: deleteError } = await supabase
      .from('club_teams')
      .delete()
      .eq('id', team.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setTeams((current) => current.filter((item) => item.id !== team.id));
  }

  const selectedClub = clubs.find((club) => club.id === selectedClubId);
  const pendingCount = memberships.filter(
    (membership) => membership.status === 'pending'
  ).length;
  const activeCount = memberships.filter(
    (membership) => membership.status === 'active'
  ).length;

  return (
    <div className="min-h-screen account-page club-workspace-page">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              {t('Club workspace')}
            </h1>
            <p className="mt-2 text-gray-500">
              {t(
                'Create a club, review membership requests, and manage your roster.'
              )}
            </p>
          </div>
          <Button
            onClick={() => {
              if (
                !showForm ||
                window.confirm(t('Leave without saving your changes?'))
              )
                setShowForm((current) => !current);
            }}
          >
            <Plus className="h-4 w-4" />
            {showForm ? t('Close') : t('Create Club')}
          </Button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2 rounded-lg border border-error-500/20 bg-error-500/10 p-3 text-sm text-error-400"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {t(error)}
          </div>
        )}

        {showForm && (
          <Card className="mb-7 p-5 sm:p-7">
            <h2 className="mb-5 text-xl font-bold text-white">
              {t('Create a chess club')}
            </h2>
            <form
              onSubmit={createClub}
              className="grid gap-4 sm:grid-cols-2"
              aria-busy={saving}
            >
              <fieldset disabled={saving} className="contents">
                <label className="text-sm text-gray-400">
                  {t('Club name')} *
                  <Field>
                    <input
                      required
                      maxLength={120}
                      value={form.name}
                      onChange={(event) =>
                        setForm({ ...form, name: event.target.value })
                      }
                      className="mt-1.5 w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-white"
                    />
                  </Field>
                </label>
                <label className="text-sm text-gray-400">
                  {t('City')} *
                  <Field>
                    <select
                      required
                      value={form.city_id}
                      onChange={(event) =>
                        setForm({ ...form, city_id: event.target.value })
                      }
                      className="mt-1.5 w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-white"
                    >
                      <option value="">{t('Select city')}</option>
                      {cities.map((city) => (
                        <option key={city.id} value={city.id}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </label>
                <label className="text-sm text-gray-400 sm:col-span-2">
                  {t('Description')}
                  <Field>
                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={form.description}
                      onChange={(event) =>
                        setForm({ ...form, description: event.target.value })
                      }
                      className="mt-1.5 w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-white"
                    />
                  </Field>
                </label>
                <label className="text-sm text-gray-400">
                  {t('Address')}
                  <Field>
                    <input
                      maxLength={200}
                      value={form.address}
                      onChange={(event) =>
                        setForm({ ...form, address: event.target.value })
                      }
                      className="mt-1.5 w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-white"
                    />
                  </Field>
                </label>
                <label className="text-sm text-gray-400">
                  {t('Contact Email')}
                  <Field>
                    <input
                      type="email"
                      value={form.contact_email}
                      onChange={(event) =>
                        setForm({ ...form, contact_email: event.target.value })
                      }
                      className="mt-1.5 w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-white"
                    />
                  </Field>
                </label>
                <label className="text-sm text-gray-400">
                  {t('Contact Phone')}
                  <Field>
                    <input
                      value={form.contact_phone}
                      onChange={(event) =>
                        setForm({ ...form, contact_phone: event.target.value })
                      }
                      className="mt-1.5 w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-white"
                    />
                  </Field>
                </label>
                <div className="flex justify-end sm:col-span-2">
                  <Button
                    type="submit"
                    disabled={saving || cities.length === 0}
                  >
                    {saving ? t('Creating...') : t('Create Club')}
                  </Button>
                </div>
              </fieldset>
            </form>
          </Card>
        )}

        {loading ? (
          <PageLoader />
        ) : routeClubId && !selectedClub ? (
          <ErrorState
            message={t(
              'This club is unavailable or you do not have management access.'
            )}
          />
        ) : clubs.length === 0 && error ? (
          <Button
            variant="outline"
            onClick={() => setRosterRevision((v) => v + 1)}
          >
            {t('Retry')}
          </Button>
        ) : clubs.length === 0 ? (
          <Card className="p-6">
            <EmptyState
              icon={<Building2 className="h-12 w-12" />}
              title={t('No clubs managed yet')}
              description={t(
                'Create your club to start building a local chess community.'
              )}
            />
          </Card>
        ) : (
          <>
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <Building2 className="h-4 w-4" />
                <Field>
                  <select
                    aria-label={t('Selected club')}
                    disabled={saving || teamSaving}
                    value={selectedClubId}
                    onChange={(event) =>
                      navigate({
                        name: 'clubManagement',
                        clubId: event.target.value,
                        section,
                      })
                    }
                    className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-white"
                  >
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </label>
              {!membersLoading && !memberLoadError && (
                <div className="flex gap-4 text-sm text-gray-400">
                  <span>
                    {pendingCount} {t('Pending requests')}
                  </span>
                  <span>
                    {activeCount} {t('Active members')}
                  </span>
                </div>
              )}
            </div>

            {selectedClub && (
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div>
                  <p className="flex items-center gap-1 text-sm text-gray-500">
                    <MapPin className="h-3.5 w-3.5" />
                    {selectedClub.city?.name}
                  </p>
                </div>
                <Link
                  to={{ name: 'club', id: selectedClub.id }}
                  className="text-link ms-auto"
                >
                  {t('View public club')}
                </Link>
              </div>
            )}

            {selectedClub && (
              <ClubWorkspaceNavigation
                clubId={selectedClub.id}
                clubName={selectedClub.name}
                section={section}
                canConfigureDiscord={selectedClub.organizer_id === user.id}
              />
            )}
            {section === 'events' && selectedClub && (
              <ClubEvents
                key={selectedClub.id}
                clubId={selectedClub.id}
                canCreate={selectedClub.organizer_id === user.id}
              />
            )}
            <div hidden={section !== 'members'}>
              <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-white">
                <Users className="h-5 w-5 text-brand-400" />
                {t('Members and requests')}
              </h2>
              {membersLoading ? (
                <PageLoader />
              ) : memberLoadError ? (
                <>
                  <ErrorState
                    message={t(
                      'Could not load club members. Please try again.'
                    )}
                  />
                  <Button
                    variant="outline"
                    onClick={() => setRosterRevision((v) => v + 1)}
                  >
                    {t('Retry')}
                  </Button>
                </>
              ) : memberships.length === 0 ? (
                <Card className="p-5">
                  <EmptyState
                    icon={<Users className="h-10 w-10" />}
                    title={t('No members yet')}
                    description={t('Membership requests will appear here.')}
                  />
                </Card>
              ) : (
                <div className="space-y-3">
                  {memberships.map((membership) => (
                    <Card
                      key={membership.id}
                      className="flex flex-wrap items-center gap-3 p-4"
                    >
                      {membership.profile?.avatar_url ? (
                        <img
                          src={membership.profile.avatar_url}
                          alt=""
                          className="h-11 w-11 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500/20 font-bold text-brand-200">
                          {membership.profile?.full_name?.charAt(0) ?? 'U'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-white">
                          {membership.profile?.full_name}
                        </p>
                        <p className="truncate text-sm text-gray-500">
                          {membership.profile?.username
                            ? `@${membership.profile.username}`
                            : t('Player')}
                        </p>
                      </div>
                      <span
                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${membership.status === 'active' ? 'bg-success-500/10 text-success-300' : membership.status === 'pending' ? 'bg-amber-500/10 text-amber-300' : 'bg-gray-500/10 text-gray-400'}`}
                      >
                        {membership.status === 'pending' && (
                          <Clock3 className="h-3 w-3" />
                        )}
                        {t(membership.status)}
                      </span>
                      {membership.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() =>
                              void reviewMembership(membership, 'active')
                            }
                          >
                            <Check className="h-4 w-4" />
                            {t('Approve')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void reviewMembership(membership, 'rejected')
                            }
                          >
                            <X className="h-4 w-4" />
                            {t('Reject')}
                          </Button>
                        </>
                      )}
                      {membership.status !== 'pending' && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => void removeMembership(membership)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t('Remove')}
                        </Button>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
            <section className="mt-6" hidden={section !== 'teams'}>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {t('Club Teams')}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {t(
                      'Create teams and assign active club members to their rosters.'
                    )}
                  </p>
                </div>
                <form
                  onSubmit={(event) => void createTeam(event)}
                  className="flex gap-2"
                >
                  <Field>
                    <input
                      required
                      maxLength={100}
                      disabled={teamSaving}
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                      placeholder={t('Team name')}
                      aria-label={t('Team name')}
                      className="min-w-0 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-white"
                    />
                  </Field>
                  <Button type="submit" size="sm" disabled={teamSaving}>
                    {teamSaving ? t('Creating...') : t('Create team')}
                  </Button>
                </form>
              </div>
              {teamsLoading ? (
                <PageLoader />
              ) : teamLoadError || memberLoadError ? (
                <>
                  <ErrorState
                    message={t('Could not load club teams. Please try again.')}
                  />
                  <Button
                    variant="outline"
                    onClick={() => setRosterRevision((v) => v + 1)}
                  >
                    {t('Retry')}
                  </Button>
                </>
              ) : teams.length === 0 ? (
                <Card className="p-5 text-sm text-gray-500">
                  {t('No teams created for this club yet.')}
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {teams.map((team) => {
                    const availableMembers = memberships.filter(
                      (membership) =>
                        membership.status === 'active' &&
                        !team.members.some(
                          (member) =>
                            member.profile_id === membership.profile_id
                        )
                    );
                    return (
                      <Card key={team.id} className="p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <h3 className="font-semibold text-white">
                            {team.name}
                          </h3>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void deleteTeam(team)}
                          >
                            <Trash2 className="h-4 w-4" />
                            {t('Delete team')}
                          </Button>
                        </div>
                        {team.members.length === 0 ? (
                          <p className="mb-4 text-sm text-gray-500">
                            {t('No players assigned yet.')}
                          </p>
                        ) : (
                          <ul className="mb-4 space-y-2">
                            {team.members.map((member) => (
                              <li
                                key={member.id}
                                className="flex items-center justify-between gap-2 rounded-lg bg-surface-800/70 px-3 py-2 text-sm"
                              >
                                <span className="truncate text-gray-200">
                                  {member.profile?.full_name ??
                                    t('Club member')}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    void removeTeamMember(team, member)
                                  }
                                >
                                  {t('Remove')}
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex gap-2">
                          <Field>
                            <select
                              aria-label={t('Choose active member')}
                              value={teamMemberIds[team.id] ?? ''}
                              onChange={(event) =>
                                setTeamMemberIds((current) => ({
                                  ...current,
                                  [team.id]: event.target.value,
                                }))
                              }
                              className="min-w-0 flex-1 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-white"
                            >
                              <option value="">
                                {t('Choose active member')}
                              </option>
                              {availableMembers.map((membership) => (
                                <option
                                  key={membership.profile_id}
                                  value={membership.profile_id}
                                >
                                  {membership.profile.full_name}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Button
                            size="sm"
                            disabled={!teamMemberIds[team.id]}
                            onClick={() => void addTeamMember(team)}
                          >
                            {t('Add')}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
