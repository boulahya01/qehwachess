import { Link } from '@/context/RouterContext';
import { Tournament } from '@/types';
import { formatDateRange, formatPrice, getDaysUntil, tournamentFormatLabels } from '@/lib/utils';
import { ArrowRight, MapPin, Calendar } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  const { t, language } = useLanguage();
  const spotsLeft =
    tournament.registration_count == null
      ? null
      : Math.max(0, tournament.max_participants - tournament.registration_count);
  const isPast = getDaysUntil(tournament.end_date) < 0;
  return (
    <Link to={{ name: 'tournament', id: tournament.id }} className="event-card group">
      <div className="event-image">
        <img
          src={tournament.image_url || '/images/chess-hero-v2-640.webp'}
          alt=""
          width={640}
          height={360}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = '/images/chess-hero-v2-640.webp';
          }}
        />
      </div>
      <div className="event-body">
        <div className="event-meta">
          <span>{t(tournamentFormatLabels[tournament.format])}</span>
          {isPast && <span>{t('Completed')}</span>}
          {tournament.time_control && <span>{tournament.time_control}</span>}
        </div>
        <h3>{tournament.title}</h3>
        <div className="event-details">
          <div>
            <Calendar />
            <span>{formatDateRange(tournament.start_date, tournament.end_date, language)}</span>
          </div>
          <div>
            <MapPin />
            <span className="truncate">
              {[tournament.city?.name, tournament.venue].filter(Boolean).join(', ')}
            </span>
          </div>
        </div>
        <div className="event-footer">
          <span className="event-price">{t(formatPrice(Number(tournament.entry_fee)))}</span>
          <span className="event-availability">
            {spotsLeft === null
              ? `${t('Capacity')}: ${tournament.max_participants}`
              : spotsLeft === 0
                ? t('Full')
                : `${spotsLeft} ${t('spots')}`}
          </span>
          <ArrowRight size={17} className="direction-arrow" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
}
