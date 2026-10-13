import { useEffect, useState } from 'react';
import { Link } from '@/context/RouterContext';
import { useWorkspaceLanguage as useLanguage } from '@/hooks/useWorkspaceLanguage';
import { supabase } from '@/lib/supabase';
import { PageLoader } from '@/components/ui/Feedback';
import { AuthMessage } from '@/components/auth/AuthParts';
import { tournamentWorkflow } from '@/lib/tournamentWorkflow';
import type { Tournament } from '@/types';

export function ClubEvents({
  clubId,
  canCreate,
}: {
  clubId: string;
  canCreate: boolean;
}) {
  const { t, language } = useLanguage();
  const [events, setEvents] = useState<
    Pick<Tournament, 'id' | 'title' | 'status' | 'start_date'>[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const result = await supabase
          .from('tournaments')
          .select('id, title, status, start_date')
          .eq('club_id', clubId)
          .order('start_date', { ascending: false });
        if (result.error) throw result.error;
        if (active) setEvents(result.data ?? []);
      } catch {
        if (active) setError('Could not load club events. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [clubId, revision]);
  return (
    <section className="account-section">
      <h2>{t('Club events')}</h2>
      {canCreate && (
        <Link
          to={{ name: 'tournamentEditor', clubId }}
          className="action action-link action-primary mb-5"
        >
          {t('Create tournament')}
        </Link>
      )}
      <AuthMessage message={error} />
      {error && (
        <button
          type="button"
          className="text-link"
          onClick={() => setRevision((v) => v + 1)}
        >
          {t('Retry')}
        </button>
      )}
      {loading ? (
        <PageLoader />
      ) : !error && !events.length ? (
        <p className="field-hint">
          {t(
            'No events for this club yet. Select this club in your tournament editor to add one.'
          )}
        </p>
      ) : (
        events.map((event) => (
          <article key={event.id} className="account-row">
            <div className="flex-1">
              <h3>{event.title}</h3>
              <p className="field-hint">
                {new Date(event.start_date).toLocaleDateString(language)} ·{' '}
                {t(tournamentWorkflow(event.status).label)}
              </p>
            </div>
            <Link
              to={{ name: 'tournament', id: event.id }}
              className="text-link"
            >
              {t('View event')}
            </Link>
          </article>
        ))
      )}
      <Link
        to={{ name: 'dashboard', section: 'events' }}
        className="text-link mt-5"
      >
        {t('Manage your events')}
      </Link>
    </section>
  );
}
