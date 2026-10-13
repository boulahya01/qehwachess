import { useMemo } from 'react';
import { Link } from '@/context/RouterContext';
import { useTournaments } from '@/hooks/useData';
import { TournamentCard } from '@/components/TournamentCard';
import { PageLoader, EmptyState, ErrorState } from '@/components/ui/Feedback';
import { ArrowRight, MapPin, Users, Crown } from 'lucide-react';
import { formatDateRange, getDaysUntil } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

export function HomePage() {
  const { t, language } = useLanguage();
  const { tournaments, loading, error } = useTournaments();
  const upcoming = useMemo(
    () =>
      tournaments
        .filter((event) => getDaysUntil(event.start_date) >= 0)
        .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [tournaments]
  );
  const featured = useMemo(() => {
    const picks = upcoming.filter((event) => event.featured);
    return (picks.length ? picks : upcoming).slice(0, 3);
  }, [upcoming]);
  const activeCities = useMemo(() => {
    const seen = new Set<string>();
    return upcoming
      .flatMap((event) => {
        if (!event.city || seen.has(event.city.id)) return [];
        seen.add(event.city.id);
        return [event.city];
      })
      .slice(0, 4);
  }, [upcoming]);
  const locale = language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-MA' : 'en-GB';

  return (
    <div>
      <section className="v2-container home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="hero-eyebrow">
            <MapPin size={16} />
            {t('Chess across Morocco')}
          </p>
          <h1 id="home-title" className="hero-title">
            {t('Good games.')}
            <span className="block">{t('Better company.')}</span>
          </h1>
          <p className="hero-description">
            {t(
              'Find tournaments, café games, and your local chess community. Make your next move together.'
            )}
          </p>
          <div className="hero-actions">
            <Link to={{ name: 'meetups' }} className="action action-link action-primary">
              {t('Find a game')}
              <ArrowRight size={18} className="direction-arrow" />
            </Link>
            <Link to={{ name: 'tournaments' }} className="text-link">
              {t('Explore tournaments')}
              <ArrowRight size={17} className="direction-arrow" />
            </Link>
          </div>
        </div>
        <div className="hero-art">
          <img
            src="/images/chess-hero-v2.webp"
            srcSet="/images/chess-hero-v2-640.webp 640w, /images/chess-hero-v2.webp 1200w"
            sizes="(max-width: 767px) calc(100vw - 32px), 46vw"
            alt={t('Ivory knight and jade rook on a chessboard')}
            width={1200}
            height={800}
            {...{ fetchpriority: 'high' }}
          />
        </div>
      </section>

      <div className="v2-container discovery-strip">
        <p>
          <MapPin size={18} />
          {t('Find chess in your city')}
        </p>
        <nav className="city-shortcuts" aria-label={t('Cities with upcoming tournaments')}>
          {activeCities.map((city) => (
            <Link key={city.id} to={{ name: 'city', id: city.id }} className="city-shortcut">
              {city.name}
            </Link>
          ))}
          <Link to={{ name: 'cities' }} className="text-link text-sm">
            {t('All cities')}
            <ArrowRight size={15} className="direction-arrow" />
          </Link>
        </nav>
      </div>

      <section className="v2-container v2-section" aria-labelledby="events-heading">
        <div className="section-toolbar">
          <div>
            <h2 id="events-heading" className="section-heading">
              {t('A seat at the board.')}
            </h2>
            <p className="section-description">
              {t('Upcoming tournaments worth making time for.')}
            </p>
          </div>
          <Link to={{ name: 'tournaments' }} className="text-link">
            {t('View all')}
            <ArrowRight size={17} className="direction-arrow" />
          </Link>
        </div>
        {loading ? (
          <PageLoader />
        ) : error ? (
          <ErrorState message={t(error)} />
        ) : featured.length ? (
          <div className="event-grid">
            {featured.map((event) => (
              <TournamentCard key={event.id} tournament={event} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Crown size={36} />}
            title={t('No upcoming tournaments yet')}
            description={t('There are still people to play with. Explore casual meetups near you.')}
            action={
              <Link to={{ name: 'meetups' }} className="text-link">
                {t('Browse meetups')}
                <ArrowRight size={16} />
              </Link>
            }
          />
        )}
      </section>

      <section className="v2-container community-grid" aria-label={t('Find your community')}>
        <div className="community-primary">
          <div className="community-copy">
            <h2>{t('The best part is who you meet.')}</h2>
            <p>
              {t(
                'A coffee, a board, a familiar face. Find a casual game and turn an ordinary afternoon into your next chess story.'
              )}
            </p>
            <Link to={{ name: 'meetups' }} className="text-link">
              {t('Browse meetups')}
              <ArrowRight size={17} className="direction-arrow" />
            </Link>
          </div>
          <img
            src="/images/chess-community-v2.webp"
            alt={t('Friends enjoying a game of chess at a café')}
            width={960}
            height={640}
            loading="lazy"
          />
        </div>
        <div className="community-secondary">
          <Users size={32} strokeWidth={1.4} />
          <h2>{t('Find your home club.')}</h2>
          <p>
            {t(
              'Meet local players, follow club events, and keep coming back to a community that knows your game.'
            )}
          </p>
          <Link to={{ name: 'clubs' }} className="text-link">
            {t('Explore clubs')}
            <ArrowRight size={17} className="direction-arrow" />
          </Link>
        </div>
      </section>

      {!loading && !error && upcoming.length > 0 && (
        <section className="v2-container v2-section schedule" aria-labelledby="schedule-heading">
          <div>
            <h2 id="schedule-heading" className="section-heading">
              {t('Put chess on your calendar.')}
            </h2>
            <p className="section-description">
              {t('Your next few chances to play over the board.')}
            </p>
            <Link to={{ name: 'map' }} className="text-link mt-4">
              {t('Explore the event map')}
              <ArrowRight size={17} className="direction-arrow" />
            </Link>
          </div>
          <div className="schedule-list">
            {upcoming.slice(0, 3).map((event) => {
              const date = new Date(event.start_date);
              return (
                <Link
                  key={event.id}
                  to={{ name: 'tournament', id: event.id }}
                  className="schedule-row"
                >
                  <div className="schedule-date" aria-hidden="true">
                    <strong>{date.toLocaleDateString(locale, { day: '2-digit' })}</strong>
                    <span>{date.toLocaleDateString(locale, { month: 'short' })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-lg leading-snug">{event.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {event.city?.name}
                      <span className="block text-xs mt-1">
                        {formatDateRange(event.start_date, event.end_date, language)}
                      </span>
                    </p>
                  </div>
                  <ArrowRight size={18} className="shrink-0 direction-arrow" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="v2-container v2-section">
        <div className="organizer-callout">
          <div>
            <h2>{t('Bring your community to the board.')}</h2>
            <p>
              {t(
                'Publish your tournament, manage registrations, and give local players a reason to meet.'
              )}
            </p>
          </div>
          <Link to={{ name: 'signup' }} className="action action-link action-secondary">
            {t('Become an Organizer')}
            <ArrowRight size={17} className="direction-arrow" />
          </Link>
        </div>
      </section>
    </div>
  );
}
