import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useWorkspaceLanguage as useLanguage } from '@/hooks/useWorkspaceLanguage';
import { Link } from '@/context/RouterContext';
import { supabase } from '@/lib/supabase';
import { publicProfileFields } from '@/lib/publicProfile';
import { PageLoader, ErrorState } from '@/components/ui/Feedback';
import type { Profile } from '@/types';
import { MapPin, MessageCircle } from 'lucide-react';

type PublicProfile = Pick<
  Profile,
  | 'id'
  | 'full_name'
  | 'username'
  | 'avatar_url'
  | 'bio'
  | 'city_id'
  | 'lichess_username'
  | 'chesscom_username'
  | 'fide_id'
> & { city?: { id: string; name: string } | null };
export function PublicProfilePage({ id }: { id: string }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        const { data, error: failure } = await supabase
          .from('profiles')
          .select(publicProfileFields)
          .eq('id', id)
          .maybeSingle();
        if (failure) throw failure;
        if (active) setProfile(data as unknown as PublicProfile | null);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, revision]);
  return (
    <div className="v2-container account-page public-profile-page">
      <Link to={{ name: 'players' }} className="text-link mb-6">
        {t('Back to players')}
      </Link>
      {loading ? (
        <PageLoader />
      ) : error ? (
        <>
          <ErrorState
            message={t('Could not load this profile. Please try again.')}
          />
          <button
            type="button"
            className="text-link"
            onClick={() => setRevision((v) => v + 1)}
          >
            {t('Retry')}
          </button>
        </>
      ) : !profile ? (
        <p>{t('Profile not found.')}</p>
      ) : (
        <>
          <header className="public-profile-heading">
            <div className="profile-avatar">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} width={96} height={96} alt="" />
              ) : (
                <span>{profile.full_name?.charAt(0) || 'Q'}</span>
              )}
            </div>
            <div>
              <p className="hero-eyebrow">{t('Public profile')}</p>
              <h1>{profile.full_name || t('Player')}</h1>
              {profile.username && (
                <p>
                  <bdi dir="ltr">@{profile.username}</bdi>
                </p>
              )}
              {profile.city && (
                <p className="flex gap-2 mt-2">
                  <MapPin size={18} />
                  {profile.city.name}
                </p>
              )}
            </div>
          </header>
          {profile.bio && (
            <section className="account-section">
              <h2>{t('About')}</h2>
              <p className="whitespace-pre-wrap">{profile.bio}</p>
            </section>
          )}
          <section className="account-section">
            <h2>{t('Chess accounts')}</h2>
            <p className="field-hint mb-4">
              {t(
                'User-provided links. Ownership and ratings are not verified.'
              )}
            </p>
            <div className="flex flex-wrap gap-5">
              {profile.lichess_username && (
                <a
                  className="text-link"
                  href={`https://lichess.org/@/${encodeURIComponent(profile.lichess_username)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Lichess ↗
                </a>
              )}
              {profile.chesscom_username && (
                <a
                  className="text-link"
                  href={`https://www.chess.com/member/${encodeURIComponent(profile.chesscom_username)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Chess.com ↗
                </a>
              )}
              {profile.fide_id && (
                <a
                  className="text-link"
                  href={`https://ratings.fide.com/profile/${encodeURIComponent(profile.fide_id)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  FIDE ↗
                </a>
              )}
              {!profile.lichess_username &&
                !profile.chesscom_username &&
                !profile.fide_id && (
                  <p className="field-hint">
                    {t('No chess accounts added yet.')}
                  </p>
                )}
            </div>
          </section>
          {user?.id === id ? (
            <Link
              to={{ name: 'profile' }}
              className="action action-link action-secondary"
            >
              {t('Edit profile')}
            </Link>
          ) : (
            <Link
              to={
                user ? { name: 'messages', playerId: id } : { name: 'signin' }
              }
              className="action action-link action-primary"
            >
              <MessageCircle size={18} />
              {t('Message')}
            </Link>
          )}
        </>
      )}
    </div>
  );
}
