import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useWorkspaceLanguage as useLanguage } from '@/hooks/useWorkspaceLanguage';
import { Link, useRouter } from '@/context/RouterContext';
import { supabase } from '@/lib/supabase';
import type { Club, ClubMembershipStatus } from '@/types';
import { PageLoader } from '@/components/ui/Feedback';
import { AuthMessage } from '@/components/auth/AuthParts';
import { Building2, ArrowRight } from 'lucide-react';

type Membership = { status: ClubMembershipStatus; club: Club };
export function MyClubsPage() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { navigate } = useRouter();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [owned, setOwned] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const canOrganize =
    profile?.role === 'organizer' || profile?.role === 'admin';
  useEffect(() => {
    if (!user) {
      navigate({ name: 'signin' });
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [memberResult, ownerResult] = await Promise.all([
          supabase
            .from('club_memberships')
            .select('status, club:clubs(*, city:cities(*))')
            .eq('profile_id', user.id),
          canOrganize
            ? supabase
                .from('clubs')
                .select('*, city:cities(*)')
                .eq('organizer_id', user.id)
                .order('name')
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (memberResult.error || ownerResult.error) throw new Error('load');
        if (!active) return;
        setMemberships(
          (memberResult.data ?? []).filter(
            (row) => row.club
          ) as unknown as Membership[]
        );
        setOwned(ownerResult.data ?? []);
      } catch {
        if (active) setError('Could not load your clubs. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, canOrganize, revision, navigate]);
  if (!user) return null;
  function clubRow(club: Club, status?: string) {
    return (
      <article className="account-row" key={club.id}>
        <Building2 size={24} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3>{club.name}</h3>
          <p className="field-hint">
            {club.city?.name}
            {status ? ` · ${t(status)}` : ''}
          </p>
        </div>
        <Link
          className="text-link"
          to={
            status
              ? { name: 'club', id: club.id }
              : { name: 'clubManagement', clubId: club.id, section: 'events' }
          }
        >
          {t(status ? 'View club' : 'Open workspace')}
          <ArrowRight size={16} />
        </Link>
      </article>
    );
  }
  return (
    <div className="v2-container account-page">
      <header className="workspace-heading">
        <div>
          <p className="hero-eyebrow">{t('Your account')}</p>
          <h1>{t('My clubs')}</h1>
          <p>{t('The communities you belong to and the clubs you manage.')}</p>
        </div>
        <Link
          to={{ name: 'clubs' }}
          className="action action-link action-secondary"
        >
          {t('Explore clubs')}
        </Link>
      </header>
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
      ) : (
        !error && (
          <>
            <section className="account-section">
              <h2>{t('Memberships')}</h2>
              {memberships.length ? (
                memberships.map((row) => clubRow(row.club, row.status))
              ) : (
                <div className="quiet-empty">
                  <p>{t('You have not joined a club yet.')}</p>
                  <Link to={{ name: 'clubs' }} className="text-link">
                    {t('Find your home club.')}
                  </Link>
                </div>
              )}
            </section>
            {canOrganize && (
              <section className="account-section">
                <div className="section-toolbar">
                  <h2>{t('Clubs you manage')}</h2>
                  <Link to={{ name: 'clubManagement' }} className="text-link">
                    {t('Manage Clubs')}
                  </Link>
                </div>
                {owned.length ? (
                  owned.map((club) => clubRow(club))
                ) : (
                  <p className="field-hint">{t('No clubs managed yet')}</p>
                )}
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}
