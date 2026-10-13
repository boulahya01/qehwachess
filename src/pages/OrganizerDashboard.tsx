import { AuthMessage } from '@/components/auth/AuthParts';
import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { OrganizingIntro } from '@/components/OrganizingIntro';
import { PageLoader, EmptyState } from '@/components/ui/Feedback';
import {
  Trophy,
  Plus,
  Edit3,
  Trash2,
  Eye,
  MapPin,
  Calendar,
  Clock,
} from 'lucide-react';
import { Tournament } from '@/types';
import {
  formatDateRange,
  getDaysUntil,
  tournamentFormatLabels,
  tournamentStatusLabels,
  tournamentStatusColors,
} from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

export function OrganizerDashboard() {
  const { t, language } = useLanguage();
  const translate = t;
  const { user, profile, loading: authLoading } = useAuth();
  const { navigate } = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error: queryError } = await supabase
        .from('tournaments')
        .select('*, city:cities(*)')
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false });
      if (queryError) setError('Could not load your tournaments.');
      setTournaments(data ?? []);
      setLoading(false);
    })();
  }, [user]);

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
  if (profile?.role !== 'organizer' && profile?.role !== 'admin')
    return <OrganizingIntro />;

  const stats = {
    total: tournaments.length,
    published: tournaments.filter((t) => t.status === 'published').length,
    pending: tournaments.filter((t) => t.status === 'pending').length,
    upcoming: tournaments.filter(
      (t) => t.status === 'published' && getDaysUntil(t.start_date) >= 0
    ).length,
  };

  async function handleDelete(id: string) {
    if (
      !confirm(
        t(
          'Are you sure you want to delete this tournament? This cannot be undone.'
        )
      )
    )
      return;
    setDeleting(id);
    setError(null);
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
      setError('Could not delete the tournament. Please try again.');
    } finally {
      setDeleting(null);
    }
  }
  function handleEdit(tournament: Tournament) {
    navigate({ name: 'tournamentEditor', id: tournament.id });
  }
  function handleNew() {
    navigate({ name: 'tournamentEditor' });
  }

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">
              {t('Organizer workspace')}
            </h1>
            <p className="text-gray-500 mt-2">
              {t('Manage your tournaments and registrations')}
            </p>
          </div>
          <Button onClick={handleNew}>
            <Plus className="w-4 h-4" />
            {t('New Tournament')}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate({ name: 'clubManagement' })}
          >
            {t('Manage Clubs')}
          </Button>
        </div>

        <AuthMessage message={error} />
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              icon: Trophy,
              label: t('Total'),
              value: stats.total,
              color: 'text-brand-400',
            },
            {
              icon: Eye,
              label: t('Published'),
              value: stats.published,
              color: 'text-success-400',
            },
            {
              icon: Clock,
              label: t('Pending'),
              value: stats.pending,
              color: 'text-amber-400',
            },
            {
              icon: Calendar,
              label: t('Upcoming'),
              value: stats.upcoming,
              color: 'text-accent-400',
            },
          ].map((stat, i) => (
            <Card key={i} className="p-5">
              <stat.icon className={`w-5 h-5 ${stat.color} mb-3`} />
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </Card>
          ))}
        </div>

        {/* Tournament list */}
        {loading ? (
          <PageLoader />
        ) : tournaments.length === 0 ? (
          <Card className="p-6">
            <EmptyState
              icon={<Trophy className="w-12 h-12" />}
              title={t('No tournaments yet')}
              description={t(
                'Create your first tournament to start accepting registrations.'
              )}
              action={
                <Button onClick={handleNew}>
                  <Plus className="w-4 h-4" />
                  {t('Create Tournament')}
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {tournaments.map((t) => (
              <Card key={t.id} className="p-5 flex items-center gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-surface-800 border border-surface-700 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">
                    {t.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {t.city?.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDateRange(t.start_date, t.end_date, language)}
                    </span>
                    <span>{translate(tournamentFormatLabels[t.format])}</span>
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-1.5">
                  <Badge className={tournamentStatusColors[t.status]}>
                    {translate(tournamentStatusLabels[t.status])}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {t.max_participants} {translate('max')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link to={{ name: 'tournament', id: t.id }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={translate('View')}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={translate('Edit Tournament')}
                    onClick={() => handleEdit(t)}
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={translate('Delete tournament')}
                    disabled={Boolean(deleting)}
                    onClick={() => void handleDelete(t.id)}
                    className="text-error-400 hover:bg-error-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
