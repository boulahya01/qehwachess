import { useState, useMemo } from 'react';
import { useTournaments, useCities } from '@/hooks/useData';
import { TournamentCard } from '@/components/TournamentCard';
import { PageLoader, EmptyState, ErrorState } from '@/components/ui/Feedback';
import { Search, SlidersHorizontal, X, Trophy, ArrowRight } from 'lucide-react';
import { Link } from '@/context/RouterContext';
import { useLanguage } from '@/context/LanguageContext';

export function TournamentsPage() {
  const { t } = useLanguage();
  const { cities } = useCities();
  const [search, setSearch] = useState('');
  const [cityId, setCityId] = useState('');
  const [format, setFormat] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const filters = useMemo(
    () => ({
      search: search || undefined,
      cityId: cityId || undefined,
      format: format || undefined,
    }),
    [search, cityId, format]
  );
  const { tournaments, loading, error } = useTournaments(filters);
  const activeFilterCount = (cityId ? 1 : 0) + (format ? 1 : 0);
  function clearFilters() {
    setCityId('');
    setFormat('');
    setSearch('');
  }
  const formats = [
    { value: 'swiss', label: 'Swiss System' },
    { value: 'round-robin', label: 'Round Robin' },
    { value: 'knockout', label: 'Knockout' },
    { value: 'blitz', label: 'Blitz' },
    { value: 'rapid', label: 'Rapid' },
    { value: 'classical', label: 'Classical' },
    { value: 'simultaneous', label: 'Simultaneous' },
  ];
  return (
    <div className="min-h-screen pt-24 pb-20 v2-container">
      <div className="catalog-header">
        <div>
          <h1>{t('Tournaments')}</h1>
          <p className="section-description">
            {t('Discover chess tournaments happening across Morocco')}
          </p>
        </div>
        <Link to={{ name: 'map' }} className="text-link">
          {t('Explore the event map')}
          <ArrowRight size={17} className="direction-arrow" />
        </Link>
      </div>
      <div className="catalog-search mb-6">
        <div className="relative flex-1 min-w-0">
          <label htmlFor="tournament-search" className="sr-only">
            {t('Search tournaments')}
          </label>
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
            aria-hidden="true"
          />
          <input
            id="tournament-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search by name, venue, or description...')}
            className="w-full pl-12 pr-4 py-3 bg-transparent rounded-xl text-white"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          aria-label={t('Filters')}
          aria-expanded={showFilters}
          aria-controls="tournament-filters"
          className="action action-secondary px-4 flex items-center gap-2 text-sm"
        >
          <SlidersHorizontal size={17} />
          <span className="hidden sm:inline">{t('Filters')}</span>
          {activeFilterCount > 0 && <span className="font-semibold">{activeFilterCount}</span>}
        </button>
      </div>
      {showFilters && (
        <div id="tournament-filters" className="surface-card p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="tournament-city"
                className="text-sm font-medium text-gray-400 mb-2 block"
              >
                {t('City')}
              </label>
              <select
                id="tournament-city"
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                className="w-full px-3 py-3 bg-surface-800 border border-surface-700 rounded-xl"
              >
                <option value="">{t('All cities')}</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="tournament-format"
                className="text-sm font-medium text-gray-400 mb-2 block"
              >
                {t('Format')}
              </label>
              <select
                id="tournament-format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full px-3 py-3 bg-surface-800 border border-surface-700 rounded-xl"
              >
                <option value="">{t('All formats')}</option>
                {formats.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.label)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
      {(search || activeFilterCount > 0) && (
        <button type="button" onClick={clearFilters} className="text-link mb-4 text-sm">
          <X size={16} />
          {t('Clear all filters')}
        </button>
      )}
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={t(error)} />
      ) : tournaments.length === 0 ? (
        <EmptyState
          icon={<Trophy size={36} />}
          title={t('No tournaments found')}
          description={t('Try adjusting your search or filters to find tournaments.')}
          action={
            search || activeFilterCount > 0 ? (
              <button
                type="button"
                className="action action-link action-secondary"
                onClick={clearFilters}
              >
                {t('Clear all filters')}
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p role="status" className="text-sm text-gray-500 mb-5">
            {t('Results')}: <strong className="font-medium">{tournaments.length}</strong>
          </p>
          <div className="event-grid">
            {tournaments.map((event) => (
              <TournamentCard key={event.id} tournament={event} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
