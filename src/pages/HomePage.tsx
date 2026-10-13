import { useMemo } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from '@/context/RouterContext';
import { useTournaments, useCities, usePlayerCount } from '@/hooks/useData';
import { TournamentCard } from '@/components/TournamentCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageLoader, ErrorState } from '@/components/ui/Feedback';
import {
  Trophy,
  MapPin,
  Users,
  ArrowRight,
  Calendar,
  Building2,
  Search,
} from 'lucide-react';
import { getDaysUntil, formatDateRange, tournamentFormatLabels } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

const moroccoCenter: [number, number] = [31.7917, -7.0926];

export function HomePage() {
  const { t, language } = useLanguage();
  const translate = t;
  const { tournaments, loading, error } = useTournaments();
  const { cities } = useCities();
  const playerCount = usePlayerCount();

  const featured = useMemo(
    () => tournaments.filter((t) => t.featured).slice(0, 4),
    [tournaments]
  );
  const upcoming = useMemo(
    () =>
      tournaments
        .filter((t) => getDaysUntil(t.start_date) >= 0)
        .sort((a, b) => getDaysUntil(a.start_date) - getDaysUntil(b.start_date))
        .slice(0, 3),
    [tournaments]
  );

  const stats = useMemo(
    () => ({
      tournaments: tournaments.length,
      cities: cities.length,
      players: playerCount,
    }),
    [tournaments, cities, playerCount]
  );

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative isolate flex min-h-[720px] items-center justify-center overflow-hidden border-b border-surface-700/40 px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <MapContainer
          center={moroccoCenter}
          zoom={5}
          scrollWheelZoom={false}
          zoomControl={false}
          attributionControl={false}
          className="home-hero-map"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {cities.filter((city) => city.latitude !== null && city.longitude !== null).map((city) => (
            <CircleMarker
              key={city.id}
              center={[city.latitude as number, city.longitude as number]}
              radius={6}
              pathOptions={{ className: 'home-map-marker', weight: 2, fillOpacity: 1 }}
            >
              <Tooltip direction="top" offset={[0, -5]}>{city.name}</Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
        <div className="home-hero-wash pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 chess-pattern opacity-30" />

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-500/25 bg-surface-900/75 font-display text-5xl text-brand-500 shadow-xl backdrop-blur-sm animate-scale-in" aria-hidden="true">
            ♞
          </div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-surface-900/80 px-4 py-2 text-sm font-semibold text-brand-600 shadow-sm backdrop-blur-sm animate-fade-in">
            <MapPin className="h-4 w-4" />
            {t('Chess across Morocco')}
          </div>
          <h1 className="font-display text-6xl font-bold leading-none text-white text-balance sm:text-7xl lg:text-8xl animate-fade-in-up">
            {t('Qehwa Chess')}
            <span className="mt-3 block font-sans text-2xl font-semibold text-brand-600 sm:text-3xl">{t('Find your people. Play over the board.')}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            {t('Find local meetups, chess clubs, and tournaments from Casablanca to Tangier.')}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <Link to={{ name: 'map' }}>
              <Button size="lg">
                <MapPin className="h-4 w-4" />
                {t('Find a game')}
              </Button>
            </Link>
            <Link to={{ name: 'tournaments' }}>
              <Button variant="secondary" size="lg">
                {t('Explore tournaments')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            {[
              { icon: Trophy, label: t('Tournaments'), value: stats.tournaments + '+' },
              { icon: MapPin, label: t('Cities'), value: stats.cities + '+' },
              { icon: Users, label: t('Players'), value: stats.players ?? '—' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2 text-sm text-gray-400">
                <stat.icon className="h-4 w-4 text-brand-600" />
                <span className="font-bold text-white">{stat.value}</span>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-3 right-4 z-10 rounded bg-surface-900/75 px-2 py-1 text-[10px] text-gray-300 backdrop-blur-sm">
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a> contributors
        </div>
      </section>

      {/* Featured Tournaments */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">{t('Featured Tournaments')}</h2>
            <p className="text-gray-500 mt-1">{t("Hand-picked events you don't want to miss")}</p>
          </div>
          <Link to={{ name: 'tournaments' }}>
            <Button variant="ghost" size="sm">
              {t('View all')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {loading ? (
          <PageLoader />
        ) : error ? (
          <ErrorState message={t(error)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((t, i) => (
              <div key={t.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <TournamentCard tournament={t} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">{t('Happening Soon')}</h2>
            <p className="text-gray-500 mt-1">{t('Next tournaments across Morocco')}</p>
            <Link to={{ name: 'tournaments' }}>
              <Button variant="outline" size="sm" className="mt-4">
                {t('See all upcoming')}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {upcoming.map((t) => {
              const days = getDaysUntil(t.start_date);
              return (
                <Link key={t.id} to={{ name: 'tournament', id: t.id }}>
                  <Card hover className="p-5 flex items-center gap-5 group cursor-pointer">
                    {/* Date block */}
                    <div className="flex-shrink-0 w-16 text-center">
                      <div className="text-3xl font-bold text-brand-400">{days === 0 ? translate('NOW') : days}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{days === 0 ? '' : days === 1 ? translate('day') : translate('days')}</div>
                    </div>
                    <div className="w-px h-12 bg-surface-700" />
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white group-hover:text-brand-300 transition-colors truncate">
                        {t.title}
                      </h3>
                      <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {t.city?.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDateRange(t.start_date, t.end_date, language)}
                        </span>
                      </div>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1">
                      <span className="text-xs text-brand-300 font-medium">{tournamentFormatLabels[t.format]}</span>
                      {t.club && <span className="text-xs text-gray-500">{t.club.name}</span>}
                    </div>
                    <ArrowRight className="w-5 h-5 text-surface-600 group-hover:text-brand-400 transition-colors flex-shrink-0" />
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">{t('Everything for local chess')}</h2>
          <p className="text-gray-500 mt-2">{t('Find players, places, and events in one place')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Search,
              title: t('Meetups near you'),
              desc: t('Find a casual game at a local café, park, or club and make plans with nearby players.'),
            },
            {
              icon: Building2,
              title: t('Tournaments and clubs'),
              desc: t('Discover local clubs and upcoming events, then register and keep the details together.'),
            },
            {
              icon: Trophy,
              title: t('Player profiles'),
              desc: t('Browse players, connect over chess, and message before you meet across the board.'),
            },
          ].map((feature, i) => (
            <Card key={i} className="p-8 animate-fade-in-up" >
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-5">
                <feature.icon className="w-6 h-6 text-brand-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-400">{t('Getting started')}</p>
          <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{t('How it works')}</h2>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { title: t('Choose your city'), description: t('Set up your player profile and find chess happening near you.') },
            { title: t('Find your game'), description: t('Browse meetups, clubs, and tournaments that fit your schedule.') },
            { title: t('Meet and play'), description: t('Message players, make a plan, and enjoy chess face to face.') },
          ].map((step, index) => (
            <div key={step.title} className="border-t border-surface-700 pt-5">
              <span className="font-display text-3xl text-brand-400">0{index + 1}</span>
              <h3 className="mt-3 text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-400">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Card className="relative overflow-hidden p-10 sm:p-16 text-center">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-transparent to-accent-500/10" />
          <div className="absolute top-0 right-0 text-[200px] text-brand-500/5 select-none leading-none">♛</div>
          <div className="relative">
            <h2 className="text-2xl sm:text-4xl font-bold text-white max-w-2xl mx-auto text-balance">
              {t('Are you organizing a chess tournament?')}
            </h2>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto">
              {t('Publish your tournament on Qehwa Chess and reach thousands of players across the country. Manage registrations and grow your event.')}
            </p>
            <Link to={{ name: 'signup' }}>
              <Button size="lg" className="mt-8">
                {t('Become an Organizer')}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}
