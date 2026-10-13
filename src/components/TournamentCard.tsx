import { Link } from '@/context/RouterContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tournament } from '@/types';
import {
  formatDateRange,
  formatPrice,
  getDaysUntil,
  tournamentFormatLabels,
} from '@/lib/utils';
import { MapPin, Users, Calendar } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  const { t, language } = useLanguage();
  const daysUntil = getDaysUntil(tournament.start_date);
  const spotsLeft = tournament.registration_count == null ? null : Math.max(0, tournament.max_participants - tournament.registration_count);
  const isPast = daysUntil < 0;

  return (
    <Link to={{ name: 'tournament', id: tournament.id }}>
      <Card hover className="overflow-hidden h-full flex flex-col group cursor-pointer">
        {/* Image / Header */}
        <div className="relative h-40 bg-gradient-to-br from-surface-800 to-surface-700 overflow-hidden">
          {tournament.image_url ? (
            <img
              src={tournament.image_url}
              alt={tournament.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center chess-pattern">
              <span className="text-6xl opacity-20">♚</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-950/90 via-surface-950/20 to-transparent" />

          {/* Format badge */}
          <div className="absolute top-3 left-3">
            <Badge className="bg-surface-950/70 text-brand-300 border-brand-500/30 backdrop-blur-sm">
              {t(tournamentFormatLabels[tournament.format])}
            </Badge>
          </div>

          {/* Days until badge */}
          {!isPast && daysUntil <= 30 && daysUntil >= 0 && (
            <div className="absolute top-3 right-3">
              <Badge className="bg-accent-500/90 text-surface-950 border-accent-400 font-bold">
                {daysUntil === 0 ? t('Today!') : daysUntil === 1 ? t('Tomorrow') : `${daysUntil} ${t('days')}`}
              </Badge>
            </div>
          )}
          {isPast && (
            <div className="absolute top-3 right-3">
              <Badge className="bg-surface-950/70 text-gray-400 border-surface-600 backdrop-blur-sm">
                {t('Completed')}
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col flex-1">
          <h3 className="font-bold text-white text-lg leading-snug group-hover:text-brand-300 transition-colors line-clamp-2">
            {tournament.title}
          </h3>

          <div className="flex flex-col gap-2 mt-3 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-400 flex-shrink-0" />
              <span>{formatDateRange(tournament.start_date, tournament.end_date, language)}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-400 flex-shrink-0" />
              <span className="truncate">
                {tournament.venue}, {tournament.city?.name}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-auto pt-4 border-t border-surface-700/40">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Users className="w-3.5 h-3.5" />
                <span>{spotsLeft === null ? `${tournament.max_participants} ${t('player capacity')}` : spotsLeft === 0 ? t('Full') : `${spotsLeft} ${t('spots')}`}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400">
                <span className="font-semibold text-brand-300">{t(formatPrice(Number(tournament.entry_fee)))}</span>
              </div>
            </div>
            {tournament.club && (
              <span className="text-xs text-gray-500 truncate max-w-[120px]">{tournament.club.name}</span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
