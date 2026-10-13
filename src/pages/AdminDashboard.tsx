import { useEffect, useState } from 'react';
import { useRouter, Link } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader, ErrorState, EmptyState } from '@/components/ui/Feedback';
import {
  Shield,
  Trophy,
  Users,
  Building2,
  MapPin,
  Eye,
  CheckCircle2,
  XCircle,
  Trash2,
  Calendar,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { Tournament, Profile, Registration } from '@/types';
import {
  formatDateRange,
  tournamentStatusLabels,
  tournamentStatusColors,
} from '@/lib/utils';
import { useWorkspaceLanguage as useLanguage } from '@/hooks/useWorkspaceLanguage';

export function AdminDashboard() {
  const { t, language } = useLanguage();
  const translate = t;
  const { user, profile, loading: authLoading } = useAuth();
  const { navigate } = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<
    'review' | 'tournaments' | 'users' | 'overview'
  >('review');
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== 'admin') {
      setLoading(false);
      return;
    }

    let active = true;
    void (async () => {
      setLoading(true);
      setDataError(null);
      const [tournamentResult, profileResult, registrationResult] =
        await Promise.all([
          supabase
            .from('tournaments')
            .select(
              '*, city:cities(*), organizer:profiles!tournaments_organizer_id_fkey(*)'
            )
            .order('created_at', { ascending: false }),
          tab === 'overview' || tab === 'users'
            ? supabase
                .from('profiles')
                .select('*, city:cities(*)')
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [], error: null }),
          tab === 'overview'
            ? supabase
                .from('registrations')
                .select(
                  '*, tournament:tournaments(title), player:profiles!registrations_player_id_fkey(full_name, username)'
                )
                .order('registered_at', { ascending: false })
                .limit(20)
            : Promise.resolve({ data: [], error: null }),
        ]);

      if (!active) return;
      setTournaments(tournamentResult.data ?? []);
      setProfiles(profileResult.data ?? []);
      setRegistrations(registrationResult.data ?? []);
      const errors = [
        tournamentResult.error,
        profileResult.error,
        registrationResult.error,
      ].filter((error) => error !== null);
      if (errors.length > 0) {
        setDataError('Please try again.');
      }
      setLoading(false);
    })().catch(() => {
      if (active) {
        setDataError('Please try again.');
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [authLoading, user, profile?.role, tab]);

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
  if (profile?.role !== 'admin') {
    return (
      <div className="v2-container account-page">
        <h1>{t('Access restricted')}</h1>
        <ErrorState
          message={t(
            'Admin access required. This area is restricted to platform administrators.'
          )}
        />
        <Link to={{ name: 'dashboard' }} className="text-link">
          {t('Account home')}
        </Link>
      </div>
    );
  }

  async function updateStatus(id: string, status: string) {
    if (pendingAction) return;
    setPendingAction(id);
    setActionError(null);
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .update({ status })
        .eq('id', id)
        .select('id, status')
        .single();
      if (error || !data) throw error || new Error('Update unavailable');
      setTournaments((current) =>
        current.map((event) =>
          event.id === id
            ? { ...event, status: data.status as Tournament['status'] }
            : event
        )
      );
    } catch {
      setActionError(t('Could not update tournament. Please try again.'));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this tournament permanently?')) return;
    setActionError(null);
    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setTournaments((current) =>
        current.filter((tournament) => tournament.id !== id)
      );
    } catch {
      setActionError(t('Could not delete the tournament. Please try again.'));
    }
  }

  const stats = {
    totalTournaments: tournaments.length,
    pending: tournaments.filter((t) => t.status === 'pending').length,
    published: tournaments.filter((t) => t.status === 'published').length,
    totalUsers: profiles.length,
    organizers: profiles.filter((p) => p.role === 'organizer').length,
    players: profiles.filter((p) => p.role === 'player').length,
  };

  const tabs = [
    { id: 'review' as const, label: t('Approval queue'), icon: Clock },
    { id: 'overview' as const, label: t('Overview'), icon: TrendingUp },
    { id: 'tournaments' as const, label: t('Tournaments'), icon: Trophy },
    { id: 'users' as const, label: t('Users'), icon: Users },
  ];

  return (
    <div className="min-h-screen account-page admin-workspace-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">
              {t('Platform workspace')}
            </h1>
            <p className="text-gray-500 mt-1">
              {t('Platform moderation and management')}
            </p>
          </div>
        </div>

        {tab === 'overview' && (
          <div className="flex flex-wrap gap-3 mb-6">
            <Link
              to={{ name: 'discordIntegration', scope: 'official' }}
              className="action action-link action-secondary"
            >
              {t('Official Discord announcements')}
            </Link>
            <Link
              to={{ name: 'clubManagement' }}
              className="action action-link action-secondary"
            >
              {t('Manage Clubs')}
            </Link>
          </div>
        )}
        {/* Stats */}
        {tab === 'overview' && (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            {[
              {
                icon: Trophy,
                label: t('Tournaments'),
                value: stats.totalTournaments,
                color: 'text-brand-400',
              },
              {
                icon: Clock,
                label: t('Pending Review'),
                value: stats.pending,
                color: 'text-amber-400',
              },
              {
                icon: CheckCircle2,
                label: t('Published'),
                value: stats.published,
                color: 'text-success-400',
              },
              {
                icon: Users,
                label: t('Total Users'),
                value: stats.totalUsers,
                color: 'text-brand-400',
              },
              {
                icon: Building2,
                label: t('Organizers'),
                value: stats.organizers,
                color: 'text-accent-400',
              },
              {
                icon: Trophy,
                label: t('Players'),
                value: stats.players,
                color: 'text-gray-400',
              },
            ].map((stat, i) => (
              <Card key={i} className="p-4">
                <stat.icon className={`w-4 h-4 ${stat.color} mb-2`} />
                <p className="text-xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
              </Card>
            ))}
          </div>
        )}
        {/* Tabs */}
        {dataError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-error-500/30 bg-error-500/10 p-4 text-sm text-error-300"
          >
            {t('Could not load admin data:')} {t(dataError)}
          </div>
        )}
        {actionError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-error-500/30 bg-error-500/10 p-4 text-sm text-error-300"
          >
            {t('Could not update tournament:')} {actionError}
          </div>
        )}
        <nav
          className="workspace-navigation mb-6"
          aria-label={t('Platform tools')}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </nav>

        {loading ? (
          <PageLoader />
        ) : tab === 'overview' || tab === 'review' ? (
          <div className="grid gap-6">
            {/* Pending tournaments */}
            {tab === 'review' && (
              <Card className="p-6">
                <h2 className="text-lg font-bold text-white mb-4">
                  {t('Pending Approvals')}
                </h2>
                <p className="field-hint mb-5">
                  {t(
                    'Review the details before approving. Approval makes the tournament public and can send configured announcements.'
                  )}
                </p>
                {tournaments.filter((t) => t.status === 'pending').length ===
                0 ? (
                  <p className="text-sm text-gray-500">
                    {t('No tournaments pending review.')}
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {tournaments
                      .filter((t) => t.status === 'pending')
                      .map((t) => (
                        <div
                          key={t.id}
                          className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-surface-800/50"
                        >
                          <Trophy className="w-5 h-5 text-amber-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {t.title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {t.organizer?.full_name}
                            </p>
                          </div>
                          <Link
                            className="text-link"
                            to={{ name: 'tournament', id: t.id }}
                          >
                            {translate('Review details')}
                          </Link>
                          <Button
                            size="sm"
                            disabled={Boolean(pendingAction)}
                            onClick={() => updateStatus(t.id, 'published')}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {translate('Approve and publish')}
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </Card>
            )}

            {/* Recent registrations */}
            {tab === 'overview' && (
              <Card className="p-6">
                <h2 className="text-lg font-bold text-white mb-4">
                  {t('Recent Registrations')}
                </h2>
                {registrations.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {t('No registrations yet.')}
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {registrations.slice(0, 5).map((r) => (
                      <div
                        key={r.id}
                        className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-surface-800/50"
                      >
                        <Users className="w-5 h-5 text-brand-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {r.player?.full_name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {r.tournament?.title}
                          </p>
                        </div>
                        <Badge className="bg-brand-500/10 text-brand-300 border-brand-500/30">
                          {t(r.status)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        ) : tab === 'tournaments' ? (
          <div className="flex flex-col gap-4">
            {tournaments.length === 0 ? (
              <EmptyState
                icon={<Trophy className="w-12 h-12" />}
                title={t('No tournaments')}
              />
            ) : (
              tournaments.map((t) => (
                <Card
                  key={t.id}
                  className="p-5 flex flex-wrap items-center gap-4"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-surface-800 border border-surface-700 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">
                      {t.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {t.city?.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateRange(t.start_date, t.end_date, language)}
                      </span>
                      <span>
                        {translate('by')} {t.organizer?.full_name}
                      </span>
                    </div>
                  </div>
                  <Badge className={tournamentStatusColors[t.status]}>
                    {translate(tournamentStatusLabels[t.status])}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Link to={{ name: 'tournament', id: t.id }}>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                    {t.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => updateStatus(t.id, 'published')}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {translate('Approve and publish')}
                      </Button>
                    )}
                    {t.status === 'published' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateStatus(t.id, 'cancelled')}
                        className="text-error-400"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(t.id)}
                      className="text-error-400 hover:bg-error-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {profiles.length === 0 ? (
              <EmptyState
                icon={<Users className="w-12 h-12" />}
                title={t('No users')}
              />
            ) : (
              profiles.map((p) => (
                <Card
                  key={p.id}
                  className="p-5 flex flex-wrap items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {p.full_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">
                      {p.full_name}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {p.username ? `@${p.username}` : t('Player')}
                    </p>
                  </div>
                  <Badge
                    className={
                      p.role === 'admin'
                        ? 'bg-error-500/20 text-error-300 border-error-500/30'
                        : p.role === 'organizer'
                          ? 'bg-accent-500/20 text-accent-300 border-accent-500/30'
                          : 'bg-brand-500/20 text-brand-300 border-brand-500/30'
                    }
                  >
                    {translate(p.role)}
                  </Badge>
                  {p.city && (
                    <span className="text-xs text-gray-500 hidden sm:inline">
                      {p.city.name}
                    </span>
                  )}
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
