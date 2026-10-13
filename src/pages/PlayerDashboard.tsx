import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Feedback';
import { AuthMessage } from '@/components/auth/AuthParts';
import { Calendar, MapPin, Clock, CheckCircle2, Trophy } from 'lucide-react';
import { Registration, CasualMeetup, Tournament } from '@/types';
import { formatDateRange, getDaysUntil } from '@/lib/utils';
import { useWorkspaceLanguage as useLanguage } from '@/hooks/useWorkspaceLanguage';

export function PlayerDashboard() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { navigate } = useRouter();
  const userId = user?.id;
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [games, setGames] = useState<CasualMeetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [registrationsResult, attendeesResult, createdResult] =
          await Promise.all([
            supabase
              .from('registrations')
              .select(
                '*, tournament:tournaments(*, city:cities(*), club:clubs(*))'
              )
              .eq('player_id', userId)
              .order('registered_at', { ascending: false }),
            supabase
              .from('meetup_attendees')
              .select('meetup:casual_meetups(*, city:cities(*))')
              .eq('player_id', userId)
              .eq('status', 'joined'),
            supabase
              .from('casual_meetups')
              .select('*, city:cities(*)')
              .eq('creator_id', userId)
              .eq('status', 'published')
              .gte('starts_at', new Date().toISOString()),
          ]);
        if (
          registrationsResult.error ||
          attendeesResult.error ||
          createdResult.error
        )
          throw new Error('Could not load your games.');
        if (!active) return;
        setRegistrations(registrationsResult.data ?? []);
        const joined = (attendeesResult.data ?? []).flatMap((row) =>
          row.meetup ? [row.meetup as unknown as CasualMeetup] : []
        );
        const all = new Map(
          [...joined, ...(createdResult.data ?? [])].map((game) => [
            game.id,
            game,
          ])
        );
        setGames(
          [...all.values()]
            .filter(
              (game) =>
                game.status === 'published' &&
                new Date(game.starts_at).getTime() >= Date.now()
            )
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        );
      } catch {
        if (active) setError('Could not load your games. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, revision]);
  useEffect(() => {
    if (!user) navigate({ name: 'signin' });
  }, [user, navigate]);
  if (!user) return null;
  const active = registrations.filter((reg) => reg.status !== 'cancelled');
  const upcoming = active
    .filter(
      (reg) => reg.tournament && getDaysUntil(reg.tournament.start_date) >= 0
    )
    .sort((a, b) =>
      a.tournament!.start_date.localeCompare(b.tournament!.start_date)
    );
  const past = active.filter(
    (reg) => reg.tournament && getDaysUntil(reg.tournament.start_date) < 0
  );
  const nextGame = games[0];
  const nextTournament = upcoming.find(
    (reg) => reg.status === 'confirmed'
  )?.tournament;
  const meetupFirst =
    nextGame &&
    (!nextTournament || nextGame.starts_at < nextTournament.start_date);
  const nextTitle = meetupFirst ? nextGame.title : nextTournament?.title;
  return (
    <div className="v2-container account-page">
      <header className="security-heading">
        <p className="hero-eyebrow">{t('Your account')}</p>
        <h1>{t('My games')}</h1>
        <p className="field-hint">
          {t('Your next game and everything you have joined.')}
        </p>
      </header>
      <AuthMessage message={error} />
      {error && (
        <button
          type="button"
          className="text-link"
          onClick={() => setRevision((value) => value + 1)}
        >
          {t('Retry')}
        </button>
      )}
      {loading ? (
        <PageLoader />
      ) : (
        <>
          <section className="dashboard-next">
            <h2>{t(nextTitle ? 'Your next game' : 'Find your next game')}</h2>
            {nextTitle ? (
              <>
                <p>{nextTitle}</p>
                <p>
                  {new Intl.DateTimeFormat(language, {
                    dateStyle: 'medium',
                  }).format(
                    new Date(
                      meetupFirst
                        ? nextGame.starts_at
                        : nextTournament!.start_date
                    )
                  )}
                </p>
                <Link
                  className="action action-link action-primary"
                  to={
                    meetupFirst
                      ? { name: 'messages', meetupId: nextGame.id }
                      : { name: 'tournament', id: nextTournament!.id }
                  }
                >
                  {t(
                    meetupFirst ? 'Open game conversation' : 'View tournament'
                  )}
                </Link>
              </>
            ) : (
              <>
                <p>
                  {t('Join a casual game or explore upcoming tournaments.')}
                </p>
                <Link
                  to={{ name: 'meetups' }}
                  className="action action-link action-primary"
                >
                  {t('Find a game')}
                </Link>
              </>
            )}
          </section>
          {games.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-4 text-xl">{t('Upcoming games')}</h2>
              <div className="grid gap-3">
                {games.map((game) => (
                  <Card key={game.id} className="p-5">
                    <h3 className="font-medium">{game.title}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {game.venue} · {game.city?.name} ·{' '}
                      {new Intl.DateTimeFormat(language, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(game.starts_at))}
                    </p>
                    <Link
                      to={{ name: 'messages', meetupId: game.id }}
                      className="text-link mt-3"
                    >
                      {t('Open game conversation')}
                    </Link>
                  </Card>
                ))}
              </div>
            </section>
          )}
          <section className="mb-8">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xl">{t('Upcoming Tournaments')}</h2>
              <Link to={{ name: 'tournaments' }} className="text-link">
                {t('Browse Tournaments')}
              </Link>
            </div>
            {upcoming.length ? (
              <div className="grid gap-3">
                {upcoming.map((reg) => (
                  <RegCard key={reg.id} reg={reg} />
                ))}
              </div>
            ) : (
              <p className="text-gray-500">{t('No upcoming tournaments')}</p>
            )}
          </section>
          {past.length > 0 && (
            <details className="profile-disclosure">
              <summary>
                {t('Past Events')} · {past.length}
              </summary>
              <div className="grid gap-3">
                {past.map((reg) => (
                  <RegCard key={reg.id} reg={reg} past />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
function RegCard({ reg, past = false }: { reg: Registration; past?: boolean }) {
  const { t: translate, language } = useLanguage();
  const tournament = reg.tournament as Tournament;
  if (!tournament) return null;
  const days = getDaysUntil(tournament.start_date);

  return (
    <Link to={{ name: 'tournament', id: tournament.id }}>
      <Card
        hover
        className="p-5 flex flex-wrap items-center gap-4 group cursor-pointer"
      >
        <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white group-hover:text-brand-300 transition-colors truncate">
            {tournament.title}
          </h3>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {tournament.city?.name}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatDateRange(
                tournament.start_date,
                tournament.end_date,
                language
              )}
            </span>
          </div>
        </div>
        <div className="flex basis-full sm:basis-auto flex-col items-start sm:items-end gap-1">
          <Badge
            className={
              reg.status === 'confirmed'
                ? 'bg-success-500/20 text-success-300 border-success-500/30'
                : reg.status === 'waitlisted'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
            }
          >
            {reg.status === 'confirmed' ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <Clock className="w-3 h-3" />
            )}
            {translate(reg.status)}
          </Badge>
          {!past && days >= 0 && (
            <span className="text-xs text-gray-500">
              {days === 0
                ? translate('Today')
                : `${translate('in')} ${days} ${translate('days')}`}
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
