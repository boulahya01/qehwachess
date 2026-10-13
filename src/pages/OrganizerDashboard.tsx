import { useEffect, useState } from 'react';
import { AuthMessage } from '@/components/auth/AuthParts';
import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { useWorkspaceLanguage as useLanguage } from '@/hooks/useWorkspaceLanguage';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { OrganizingIntro } from '@/components/OrganizingIntro';
import { PageLoader } from '@/components/ui/Feedback';
import { TournamentProgress } from '@/components/TournamentProgress';
import { tournamentWorkflow } from '@/lib/tournamentWorkflow';
import { Plus, Trash2, Calendar } from 'lucide-react';
import type { Tournament } from '@/types';
import { formatDateRange } from '@/lib/utils';

export function OrganizerDashboard() {
  const { t, language } = useLanguage();
  const { user, profile, loading: authLoading } = useAuth();
  const { navigate } = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const canOrganize =
    profile?.role === 'organizer' || profile?.role === 'admin';
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ name: 'signin' });
      return;
    }
    if (!canOrganize) return;
    let active = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const result = await supabase
          .from('tournaments')
          .select('*, city:cities(*)')
          .eq('organizer_id', user.id)
          .order('created_at', { ascending: false });
        if (result.error) throw result.error;
        if (active) setTournaments(result.data ?? []);
      } catch {
        if (active) setError('Could not load your tournaments.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, authLoading, canOrganize, navigate, revision]);
  if (authLoading) return <PageLoader />;
  if (!user) return null;
  if (!canOrganize) return <OrganizingIntro />;
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
      const result = await supabase.from('tournaments').delete().eq('id', id);
      if (result.error) throw result.error;
      setTournaments((current) => current.filter((event) => event.id !== id));
    } catch {
      setError('Could not delete the tournament. Please try again.');
    } finally {
      setDeleting(null);
    }
  }
  const ordered = [...tournaments].sort((a, b) => {
    const order = {
      draft: 0,
      pending: 1,
      published: 2,
      completed: 3,
      cancelled: 4,
    };
    return order[a.status] - order[b.status];
  });
  return (
    <div className="v2-container account-page">
      <header className="workspace-heading">
        <div>
          <p className="hero-eyebrow">{t('Your account')}</p>
          <h1>{t('My events')}</h1>
          <p>
            {t('Create, follow review progress and manage your tournaments.')}
          </p>
        </div>
        <Link
          to={{ name: 'tournamentEditor' }}
          className="action action-link action-primary"
        >
          <Plus size={18} />
          {t('Create tournament')}
        </Link>
      </header>
      <TournamentProgress />
      <AuthMessage message={error} />
      {error && (
        <button
          className="text-link"
          type="button"
          onClick={() => setRevision((v) => v + 1)}
        >
          {t('Retry')}
        </button>
      )}
      {loading ? (
        <PageLoader />
      ) : !error && !ordered.length ? (
        <section className="quiet-empty">
          <h2>{t('No tournaments yet')}</h2>
          <p>
            {t('Start with a draft. Submit it when the details are ready.')}
          </p>
        </section>
      ) : (
        <div className="event-workflow-list">
          {ordered.map((event) => {
            const flow = tournamentWorkflow(event.status);
            return (
              <article key={event.id} className="event-workflow-row">
                <div className="event-workflow-main">
                  <span className={`workflow-status status-${event.status}`}>
                    {t(flow.label)}
                  </span>
                  <h2>{event.title}</h2>
                  <p className="field-hint flex items-center gap-2 flex-wrap">
                    <Calendar size={16} />
                    {formatDateRange(
                      event.start_date,
                      event.end_date,
                      language
                    )}{' '}
                    · {event.city?.name}
                  </p>
                  <p className="field-hint mt-3">{t(flow.hint)}</p>
                </div>
                <div className="event-workflow-actions">
                  <Link
                    to={
                      ['published', 'cancelled', 'completed'].includes(
                        event.status
                      )
                        ? { name: 'tournament', id: event.id }
                        : { name: 'tournamentEditor', id: event.id }
                    }
                    className="action action-link action-secondary"
                  >
                    {t(flow.action)}
                  </Link>
                  <details className="event-more">
                    <summary>{t('More options')}</summary>
                    <Link
                      className="text-link"
                      to={{ name: 'tournamentEditor', id: event.id }}
                    >
                      {t('Edit Tournament')}
                    </Link>
                    <Link
                      className="text-link"
                      to={{ name: 'tournament', id: event.id }}
                    >
                      {t('Preview event')}
                    </Link>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={Boolean(deleting)}
                      onClick={() => void handleDelete(event.id)}
                    >
                      <Trash2 size={16} />
                      {t('Delete tournament')}
                    </Button>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
