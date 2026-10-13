import { useClub } from '@/hooks/useData';
import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TournamentCard } from '@/components/TournamentCard';
import { PageLoader, ErrorState, EmptyState } from '@/components/ui/Feedback';
import { Building2, MapPin, Mail, Phone, ArrowLeft, Trophy, Users } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface ClubTeamView {
  id: string;
  name: string;
  members: { id: string; full_name: string; username: string | null }[];
}

export function ClubDetailPage({ id }: { id: string }) {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const { navigate } = useRouter();
  const { club, tournaments, loading } = useClub(id);
  const [membershipStatus, setMembershipStatus] = useState<'pending' | 'active' | 'rejected' | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [teams, setTeams] = useState<ClubTeamView[]>([]);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setMembershipStatus(null);
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('club_memberships')
        .select('status')
        .eq('club_id', id)
        .eq('profile_id', user.id)
        .maybeSingle();
      if (!active) return;
      if (error) setMembershipError(error.message);
      setMembershipStatus(data?.status ?? null);
    })();
    return () => { active = false; };
  }, [id, user]);

  useEffect(() => {
    if (!club) return;
    let active = true;
    async function loadTeams() {
      const { data: teamData, error: teamError } = await supabase
        .from('club_teams')
        .select('id, name')
        .eq('club_id', club!.id)
        .order('name');
      if (!active) return;
      if (teamError) {
        setTeamsError(teamError.message);
        return;
      }
      let members: { id: string; team_id: string; profile: { id: string; full_name: string; username: string | null } | null }[] = [];
      const teamIds = (teamData ?? []).map((team) => team.id);
      if (membershipStatus === 'active' && teamIds.length > 0) {
        const { data: memberData, error: memberError } = await supabase
          .from('club_team_memberships')
          .select('id, team_id, profile:profiles!club_team_memberships_profile_id_fkey(id, full_name, username)')
          .in('team_id', teamIds);
        if (!active) return;
        if (memberError) setTeamsError(memberError.message);
        members = (memberData ?? []) as unknown as typeof members;
      }
      setTeams((teamData ?? []).map((team) => ({
        id: team.id,
        name: team.name,
        members: members.filter((member) => member.team_id === team.id && member.profile).map((member) => member.profile!),
      })));
    }
    void loadTeams();
    return () => { active = false; };
  }, [club, membershipStatus]);

  if (loading) return <div className="pt-24"><PageLoader /></div>;
  if (!club) return <div className="pt-24"><ErrorState message={t('Chess club not found.')} /></div>;

  async function joinClub() {
    if (!user) {
      navigate({ name: 'signin' });
      return;
    }
    setMembershipLoading(true);
    setMembershipError(null);
    if (membershipStatus === 'rejected') {
      const { error: deleteError } = await supabase
        .from('club_memberships')
        .delete()
        .eq('club_id', id)
        .eq('profile_id', user.id);
      if (deleteError) {
        setMembershipError(deleteError.message);
        setMembershipLoading(false);
        return;
      }
    }
    const { error: insertError } = await supabase
      .from('club_memberships')
      .insert({ club_id: id, profile_id: user.id, status: 'pending' });
    if (insertError) setMembershipError(insertError.message);
    else setMembershipStatus('pending');
    setMembershipLoading(false);
  }

  async function leaveClub() {
    if (!user || !confirm(t('Leave this club? Your team assignments will also be removed.'))) return;
    setMembershipLoading(true);
    setMembershipError(null);
    const { error: deleteError } = await supabase
      .from('club_memberships')
      .delete()
      .eq('club_id', id)
      .eq('profile_id', user.id);
    if (deleteError) setMembershipError(deleteError.message);
    else setMembershipStatus(null);
    setMembershipLoading(false);
  }

  const canRequestMembership = ['player', 'organizer'].includes(profile?.role ?? '') && membershipStatus !== 'active' && membershipStatus !== 'pending';

  return (
    <div className="min-h-screen pt-20 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to={{ name: 'clubs' }} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-brand-300 transition-colors mb-6 mt-4">
          <ArrowLeft className="w-4 h-4" />
          {t('Back to clubs')}
        </Link>

        {/* Header */}
        <Card className="p-6 sm:p-8 mb-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-700/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-10 h-10 text-brand-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{club.name}</h1>
              {club.city && (
                <div className="flex items-center gap-1.5 mt-2 text-gray-400">
                  <MapPin className="w-4 h-4 text-brand-400" />
                  {club.city.name}, {club.city.region}
                </div>
              )}
              <p className="text-gray-400 leading-relaxed mt-4">{club.description}</p>
              <div className="flex flex-wrap gap-3 mt-4">
                {club.contact_email && (
                  <a href={`mailto:${club.contact_email}`} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800 text-gray-300 hover:text-brand-300 transition-colors text-sm">
                    <Mail className="w-4 h-4" />
                    {club.contact_email}
                  </a>
                )}
                {club.contact_phone && (
                  <a href={`tel:${club.contact_phone}`} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800 text-gray-300 hover:text-brand-300 transition-colors text-sm">
                    <Phone className="w-4 h-4" />
                    {club.contact_phone}
                  </a>
                )}
              </div>
              {club.address && (
                <p className="text-sm text-gray-500 mt-3">{club.address}</p>
              )}
              {user && ['player', 'organizer'].includes(profile?.role ?? '') && (
                <div className="mt-5">
                  {membershipStatus === 'active' ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className="bg-success-500/10 text-success-300 border-success-500/30">{t('Club member')}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => void leaveClub()} disabled={membershipLoading}>{t('Leave club')}</Button>
                    </div>
                  ) : membershipStatus === 'pending' ? (
                    <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/30">{t('Membership request pending')}</Badge>
                  ) : canRequestMembership ? (
                    <Button size="sm" onClick={() => void joinClub()} disabled={membershipLoading}>{membershipLoading ? t('Requesting...') : membershipStatus === 'rejected' ? t('Request to join again') : t('Request to join')}</Button>
                  ) : null}
                  {membershipError && <p role="alert" className="mt-2 text-sm text-error-400">{membershipError}</p>}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Tournaments */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-1">{t('Upcoming Tournaments')}</h2>
          <p className="text-gray-500 text-sm">{t('Tournaments organized by this club')}</p>
        </div>

        {tournaments.length === 0 ? (
          <EmptyState icon={<Trophy className="w-12 h-12" />} title={t('No upcoming tournaments')} description={t("This club hasn't published any tournaments yet.")} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        )}

        <section className="mt-12">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-white"><Users className="h-5 w-5 text-brand-400" />{t('Club Teams')}</h2>
          {teamsError ? <p role="alert" className="text-sm text-error-400">{t(teamsError)}</p> : teams.length === 0 ? (
            <EmptyState icon={<Users className="h-10 w-10" />} title={t('No teams created for this club yet.')} description={t('Club teams and their rosters will appear here.')} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {teams.map((team) => (
                <Card key={team.id} className="p-5">
                  <h3 className="font-semibold text-white">{team.name}</h3>
                  {membershipStatus === 'active' ? (
                    team.members.length ? <ul className="mt-3 space-y-2">{team.members.map((member) => <li key={member.id} className="text-sm text-gray-400">{member.full_name}{member.username ? <span className="ml-2 text-gray-600">@{member.username}</span> : null}</li>)}</ul> : <p className="mt-2 text-sm text-gray-500">{t('No players assigned yet.')}</p>
                  ) : <p className="mt-2 text-sm text-gray-500">{t('Join this club to view team rosters.')}</p>}
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
