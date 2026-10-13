import { useEffect, useState } from 'react';
import { Clock3, LocateFixed, MapPin, MessageCircle, Search, UserRound } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { useCities } from '@/hooks/useData';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { distanceInKm, useDeviceLocation } from '@/hooks/useDeviceLocation';
import type { PlayerAvailability } from '@/types';

interface PublicPlayer {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  city_id: string | null;
  lichess_username: string | null;
  chesscom_username: string | null;
  fide_id: string | null;
  city: { name: string; latitude: number | null; longitude: number | null } | null;
  availability: PlayerAvailability | null;
}

export function PlayersPage() {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const { navigate } = useRouter();
  const { cities } = useCities();
  const { coordinates, loading: locationLoading, error: locationError, requestLocation } = useDeviceLocation();
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [search, setSearch] = useState('');
  const [cityId, setCityId] = useState('');
  const [radiusKm, setRadiusKm] = useState(100);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [availability, setAvailability] = useState<PlayerAvailability | null>(null);
  const [availabilityFormat, setAvailabilityFormat] = useState<PlayerAvailability['time_control']>('Casual / no clock');
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [playerResult, availabilityResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, bio, city_id, lichess_username, chesscom_username, fide_id, city:cities(name, latitude, longitude)')
          .in('role', ['player', 'organizer'])
          .order('full_name')
          .limit(100),
        supabase
          .from('player_availability')
          .select('profile_id, time_control, expires_at, updated_at')
          .gt('expires_at', new Date().toISOString()),
      ]);
      if (!active) return;
      const availabilityByPlayer = new Map(
        (availabilityResult.data ?? []).map((item) => [item.profile_id, item as PlayerAvailability]),
      );
      const currentAvailability = availabilityByPlayer.get(user?.id ?? '');
      setAvailability(currentAvailability ?? null);
      if (currentAvailability) setAvailabilityFormat(currentAvailability.time_control);
      setPlayers((playerResult.data ?? []).map((player) => ({
        id: player.id,
        full_name: player.full_name,
        username: player.username,
        avatar_url: player.avatar_url,
        bio: player.bio,
        city_id: player.city_id,
        lichess_username: player.lichess_username,
        chesscom_username: player.chesscom_username,
        fide_id: player.fide_id,
        city: Array.isArray(player.city) ? player.city[0] ?? null : player.city ?? null,
        availability: availabilityByPlayer.get(player.id) ?? null,
      })));
      setError([playerResult.error?.message, availabilityResult.error?.message].filter(Boolean).join(' ') || null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user]);

  const query = search.trim().toLowerCase();
  const visiblePlayers = players.flatMap((player) => {
    const matchesCity = !cityId || player.city_id === cityId;
    const searchable = `${player.full_name} ${player.username ?? ''} ${player.bio ?? ''} ${player.city?.name ?? ''}`.toLowerCase();
    if (!matchesCity || !searchable.includes(query) || (availableOnly && !player.availability)) return [];
    const hasCoordinates = player.city?.latitude !== null && player.city?.latitude !== undefined
      && player.city?.longitude !== null && player.city?.longitude !== undefined;
    const distance = coordinates && hasCoordinates
      ? distanceInKm(coordinates, { latitude: player.city!.latitude!, longitude: player.city!.longitude! })
      : null;
    if (coordinates && (distance === null || distance > radiusKm)) return [];
    return [{ ...player, distance }];
  }).sort((a, b) => coordinates
    ? (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY)
    : a.full_name.localeCompare(b.full_name));

  function locationErrorMessage() {
    switch (locationError) {
      case 'denied': return t('Location permission was denied. Allow location access in your browser settings to find nearby players.');
      case 'timeout': return t('Your location could not be found in time. Please try again.');
      case 'unavailable': return t('Location is unavailable in this browser or device.');
      case 'unknown': return t('Could not get your location. Please try again.');
      default: return null;
    }
  }

  async function setOpenToPlay() {
    if (!user || !['player', 'organizer'].includes(profile?.role ?? '')) return;
    setAvailabilitySaving(true);
    setError(null);
    try {
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const { data, error: saveError } = await supabase
        .from('player_availability')
        .upsert(
          { profile_id: user.id, time_control: availabilityFormat, expires_at: expiresAt, updated_at: new Date().toISOString() },
          { onConflict: 'profile_id' },
        )
        .select('profile_id, time_control, expires_at, updated_at')
        .single();
      if (saveError) {
        setError(saveError.message);
      } else {
        const nextAvailability = data as PlayerAvailability;
        setAvailability(nextAvailability);
        setPlayers((current) => current.map((player) => player.id === user.id ? { ...player, availability: nextAvailability } : player));
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Could not update availability. Please try again.'));
    } finally {
      setAvailabilitySaving(false);
    }
  }

  async function stopBeingAvailable() {
    if (!user) return;
    setAvailabilitySaving(true);
    setError(null);
    try {
      const { error: removeError } = await supabase.from('player_availability').delete().eq('profile_id', user.id);
      if (removeError) {
        setError(removeError.message);
      } else {
        setAvailability(null);
        setPlayers((current) => current.map((player) => player.id === user.id ? { ...player, availability: null } : player));
      }
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : t('Could not update availability. Please try again.'));
    } finally {
      setAvailabilitySaving(false);
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">{t('Player Directory')}</h1>
          <p className="mt-2 text-gray-500">{t('Find chess players in your city and discover their chess accounts.')}</p>
          <p className="mt-2 text-sm text-gray-500">{t('Nearby matching uses approximate city-center locations. Your device location stays in this browser and is not saved.')}</p>
        </div>

        {error && (
          <div className="mb-5">
            <ErrorState message={error} />
          </div>
        )}

        <div className="mb-3 flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" onClick={requestLocation} disabled={locationLoading}>
            <LocateFixed className="h-4 w-4" />
            {locationLoading ? t('Finding your location...') : coordinates ? t('Refresh nearby players') : t('Find players near me')}
          </Button>
          {coordinates && (
            <label className="flex items-center gap-2 text-sm text-gray-400">
              {t('Within')}
              <select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} aria-label={t('Search radius')} className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-white">
                {[25, 50, 100, 250].map((radius) => <option key={radius} value={radius}>{radius} {t('km')}</option>)}
              </select>
            </label>
          )}
        </div>
        {locationErrorMessage() && <p role="alert" className="mb-4 text-sm text-error-400">{locationErrorMessage()}</p>}
        {coordinates && <p className="mb-4 text-xs text-gray-500">{t('Nearby players are sorted by distance to their city center; exact player locations are not shared.')} {t('Open a player card and choose Message to start a private chat.')}</p>}

        {user && ['player', 'organizer'].includes(profile?.role ?? '') && (
          <section className="mb-6 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-white">{t('Find a game now')}</h2>
                <p className="mt-1 text-sm text-gray-400">{t('Show nearby players that you are available for a chess game. This expires automatically in two hours.')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={availabilityFormat} onChange={(event) => setAvailabilityFormat(event.target.value as PlayerAvailability['time_control'])} aria-label={t('Preferred time control')} className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white">
                  <option value="Casual / no clock">{t('Casual / no clock')}</option>
                  <option value="Blitz">{t('Blitz')}</option>
                  <option value="Rapid">{t('Rapid')}</option>
                  <option value="Classical">{t('Classical')}</option>
                </select>
                {availability ? (
                  <Button size="sm" variant="secondary" onClick={() => void stopBeingAvailable()} disabled={availabilitySaving}>{availabilitySaving ? t('Saving...') : t('Stop looking')}</Button>
                ) : (
                  <Button size="sm" onClick={() => void setOpenToPlay()} disabled={availabilitySaving}>{availabilitySaving ? t('Saving...') : t('I’m available')}</Button>
                )}
              </div>
            </div>
            {availability && <p role="status" className="mt-3 flex items-center gap-2 text-xs text-success-300"><Clock3 className="h-3.5 w-3.5" />{t('You are open to play')} · {t(availability.time_control)}</p>}
          </section>
        )}

        <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_240px]">
          <label className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('Search players...')}
              className="w-full rounded-xl border border-surface-700 bg-surface-900 py-3 pl-10 pr-4 text-white placeholder-gray-500"
            />
          </label>
          <select
            value={cityId}
            onChange={(event) => setCityId(event.target.value)}
            aria-label={t('Filter by city')}
            className="rounded-xl border border-surface-700 bg-surface-900 px-3.5 py-3 text-white"
          >
            <option value="">{t('All cities')}</option>
            {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
          </select>
        </div>
        <label className="mb-5 inline-flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} className="h-4 w-4 accent-brand-500" />
          {t('Show players open to play')}
        </label>

        {loading ? <PageLoader /> : error && players.length === 0 ? null : visiblePlayers.length === 0 ? (
          <EmptyState icon={<UserRound className="h-12 w-12" />} title={t('No players found')} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePlayers.map((player) => (
              <Card key={player.id} className="p-5">
                <div className="flex items-center gap-3">
                  {player.avatar_url ? (
                    <img src={player.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">
                      {player.full_name.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-white">{player.full_name}</h2>
                    {player.username && <p className="truncate text-sm text-brand-300">@{player.username}</p>}
                  </div>
                </div>
                {player.city?.name && (
                  <p className="mt-4 flex items-center gap-1.5 text-sm text-gray-400">
                    <MapPin className="h-4 w-4 text-brand-400" />{player.city.name}
                    {player.distance !== null && <span className="ml-auto text-xs text-brand-300">~{Math.round(player.distance)} {t('km away')}</span>}
                  </p>
                )}
                {player.availability && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-success-300"><span className="h-2 w-2 rounded-full bg-success-400" />{t('Open to play')} · {t(player.availability.time_control)}</p>
                )}
                {player.bio && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-gray-400">{player.bio}</p>}
                <div className="mt-4 flex flex-wrap gap-3 border-t border-surface-700 pt-4 text-sm">
                  {player.lichess_username && <a href={`https://lichess.org/@/${encodeURIComponent(player.lichess_username)}`} target="_blank" rel="noreferrer" className="text-brand-300 hover:underline">Lichess ↗</a>}
                  {player.chesscom_username && <a href={`https://www.chess.com/member/${encodeURIComponent(player.chesscom_username)}`} target="_blank" rel="noreferrer" className="text-brand-300 hover:underline">Chess.com ↗</a>}
                  {player.fide_id && <a href={`https://ratings.fide.com/profile/${encodeURIComponent(player.fide_id)}`} target="_blank" rel="noreferrer" className="text-brand-300 hover:underline">FIDE ↗</a>}
                  {!player.lichess_username && !player.chesscom_username && !player.fide_id && (
                    <span className="text-xs text-gray-500">{t('No chess accounts linked yet.')}</span>
                  )}
                </div>
                {user && player.id !== user.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => navigate({ name: 'messages', playerId: player.id })}
                  >
                    <MessageCircle className="h-4 w-4" />
                    {t('Message')}
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
