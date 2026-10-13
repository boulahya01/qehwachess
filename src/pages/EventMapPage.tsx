import { Field } from '@/components/ui/Field';
import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/context/RouterContext';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { AlertCircle, LocateFixed, MapPin } from 'lucide-react';
import { Icon, LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/components/ui/Card';
import { ErrorState, PageLoader } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import { distanceInKm, useDeviceLocation } from '@/hooks/useDeviceLocation';

type MapCity = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
};
type MapEvent = {
  id: string;
  title: string;
  city_id: string;
  starts_at: string;
  kind: 'tournament' | 'meetup';
  city: MapCity | null;
};
type MapClub = {
  id: string;
  name: string;
  city_id: string | null;
  city: MapCity | null;
};
type MapPinData = {
  key: string;
  city: MapCity;
  tournaments: MapEvent[];
  meetups: MapEvent[];
  clubs: MapClub[];
  distance: number | null;
};

const moroccoCenter: LatLngTuple = [31.7917, -7.0926];
const pinIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function normalizeCity(city: MapCity | MapCity[] | null): MapCity | null {
  if (Array.isArray(city)) return city[0] ?? null;
  return city;
}

function RecenterMap({ center, zoom }: { center: LatLngTuple; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.8 });
  }, [center, map, zoom]);
  return null;
}

export function EventMapPage() {
  const { t, language } = useLanguage();
  const {
    coordinates,
    loading: locationLoading,
    error: locationError,
    requestLocation,
  } = useDeviceLocation();
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [clubs, setClubs] = useState<MapClub[]>([]);
  const [radiusKm, setRadiusKm] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadMapData() {
      const [tournamentResult, meetupResult, clubResult] = await Promise.all([
        supabase
          .from('tournaments')
          .select(
            'id, title, city_id, start_date, city:cities(id, name, latitude, longitude)'
          )
          .eq('status', 'published')
          .gte('end_date', new Date().toISOString().slice(0, 10))
          .order('start_date'),
        supabase
          .from('casual_meetups')
          .select(
            'id, title, city_id, starts_at, city:cities(id, name, latitude, longitude)'
          )
          .eq('status', 'published')
          .gte('starts_at', new Date().toISOString())
          .order('starts_at'),
        supabase
          .from('clubs')
          .select(
            'id, name, city_id, city:cities(id, name, latitude, longitude)'
          )
          .order('name'),
      ]);
      if (!active) return;

      const queryErrors = [
        tournamentResult.error,
        meetupResult.error,
        clubResult.error,
      ].filter(Boolean);
      if (queryErrors.length)
        setError(
          queryErrors.map((queryError) => queryError?.message).join(' ')
        );

      const mappedTournaments = (tournamentResult.data ?? []).map((row) => ({
        ...row,
        starts_at: row.start_date,
        kind: 'tournament' as const,
        city: normalizeCity(row.city as MapCity | MapCity[] | null),
      }));
      const mappedMeetups = (meetupResult.data ?? []).map((row) => ({
        ...row,
        kind: 'meetup' as const,
        city: normalizeCity(row.city as MapCity | MapCity[] | null),
      }));
      const mappedClubs = (clubResult.data ?? []).map((club) => ({
        ...club,
        city: normalizeCity(club.city as MapCity | MapCity[] | null),
      }));
      setEvents([...mappedTournaments, ...mappedMeetups] as MapEvent[]);
      setClubs(mappedClubs as MapClub[]);
      setLoading(false);
    }
    void loadMapData();
    return () => {
      active = false;
    };
  }, []);

  const pins = useMemo(() => {
    const pinByCity = new Map<string, MapPinData>();
    function ensurePin(city: MapCity | null, cityId: string | null) {
      if (!city || city.latitude === null || city.longitude === null)
        return null;
      const key = cityId ?? city.id;
      let pin = pinByCity.get(key);
      if (!pin) {
        const distance = coordinates
          ? distanceInKm(coordinates, {
              latitude: city.latitude,
              longitude: city.longitude,
            })
          : null;
        pin = { key, city, tournaments: [], meetups: [], clubs: [], distance };
        pinByCity.set(key, pin);
      }
      return pin;
    }
    for (const event of events) {
      const pin = ensurePin(event.city, event.city_id);
      if (!pin) continue;
      if (event.kind === 'tournament') pin.tournaments.push(event);
      else pin.meetups.push(event);
    }
    for (const club of clubs)
      ensurePin(club.city, club.city_id)?.clubs.push(club);
    return [...pinByCity.values()];
  }, [clubs, coordinates, events]);

  const visiblePins = coordinates
    ? pins
        .filter((pin) => pin.distance !== null && pin.distance <= radiusKm)
        .sort(
          (a, b) =>
            (a.distance ?? Number.POSITIVE_INFINITY) -
            (b.distance ?? Number.POSITIVE_INFINITY)
        )
    : pins;
  const mapCenter = useMemo<LatLngTuple>(
    () =>
      coordinates
        ? [coordinates.latitude, coordinates.longitude]
        : moroccoCenter,
    [coordinates]
  );
  const locale = language === 'ar' ? 'ar' : language;
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
  });

  function locationErrorMessage() {
    switch (locationError) {
      case 'denied':
        return t(
          'Location permission was denied. Allow location access in your browser settings to find nearby events.'
        );
      case 'timeout':
        return t('Your location could not be found in time. Please try again.');
      case 'unavailable':
        return t('Location is unavailable in this browser or device.');
      case 'unknown':
        return t('Could not get your location. Please try again.');
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-7">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            {t('Chess event map')}
          </h1>
          <p className="mt-2 text-gray-500">
            {t(
              'Explore upcoming tournaments, casual meetups, and chess clubs across Morocco.'
            )}
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs text-amber-300">
            <AlertCircle className="h-4 w-4" />
            {t('Map markers show city centers, not exact venues.')}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {t(
              'Your device location is used only in this browser and is not saved.'
            )}
          </p>
        </div>

        {error && (
          <div className="mb-5">
            <ErrorState message={error} />
          </div>
        )}
        <div className="mb-3 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={requestLocation}
            disabled={locationLoading}
          >
            <LocateFixed className="h-4 w-4" />
            {locationLoading
              ? t('Finding your location...')
              : coordinates
                ? t('Refresh nearby events')
                : t('Find events near me')}
          </Button>
          {coordinates && (
            <label className="flex items-center gap-2 text-sm text-gray-400">
              {t('Within')}
              <Field>
                <select
                  value={radiusKm}
                  onChange={(event) => setRadiusKm(Number(event.target.value))}
                  aria-label={t('Search radius')}
                  className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-white"
                >
                  {[25, 50, 100, 250].map((radius) => (
                    <option key={radius} value={radius}>
                      {radius} {t('km')}
                    </option>
                  ))}
                </select>
              </Field>
            </label>
          )}
        </div>
        {locationErrorMessage() && (
          <p role="alert" className="mb-4 text-sm text-error-400">
            {locationErrorMessage()}
          </p>
        )}
        {coordinates && (
          <p className="mb-4 text-sm text-gray-400">
            {t('Showing city-center events within')} {radiusKm} {t('km')} ·{' '}
            {visiblePins.length} {t('nearby locations')}
          </p>
        )}
        {loading ? (
          <PageLoader />
        ) : (
          <>
            <Card className="overflow-hidden border border-surface-700 p-2">
              <MapContainer
                center={mapCenter}
                zoom={coordinates ? 7 : 5}
                scrollWheelZoom
                className="h-[65vh] min-h-[420px] w-full rounded-xl"
              >
                <RecenterMap center={mapCenter} zoom={coordinates ? 7 : 5} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {visiblePins.map((pin) => (
                  <Marker
                    key={pin.key}
                    position={[pin.city.latitude!, pin.city.longitude!]}
                    icon={pinIcon}
                  >
                    <Popup>
                      <div className="min-w-56">
                        <h2 className="mb-2 text-base font-bold">
                          {pin.city.name}
                          {pin.distance !== null
                            ? ` · ~${Math.round(pin.distance)} km`
                            : ''}
                        </h2>
                        {pin.tournaments.map((event) => (
                          <p key={event.id} className="mb-1">
                            <span>♟ </span>
                            <a
                              href={`#/tournaments/${event.id}`}
                              className="font-medium text-indigo-700"
                            >
                              {event.title}
                            </a>
                            <span className="block text-xs text-gray-600">
                              {t('Tournament')} ·{' '}
                              {dateFormatter.format(new Date(event.starts_at))}
                            </span>
                          </p>
                        ))}
                        {pin.meetups.map((event) => (
                          <p key={event.id} className="mb-1">
                            <span>♞ </span>
                            <a
                              href="#/meetups"
                              className="font-medium text-indigo-700"
                            >
                              {event.title}
                            </a>
                            <span className="block text-xs text-gray-600">
                              {t('Casual meetup')} ·{' '}
                              {dateFormatter.format(new Date(event.starts_at))}
                            </span>
                          </p>
                        ))}
                        {pin.clubs.map((club) => (
                          <p key={club.id} className="mb-1">
                            <span>♜ </span>
                            <a
                              href={`#/clubs/${club.id}`}
                              className="font-medium text-indigo-700"
                            >
                              {club.name}
                            </a>
                            <span className="block text-xs text-gray-600">
                              {t('Chess club')}
                            </span>
                          </p>
                        ))}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </Card>

            {visiblePins.length === 0 && !error && (
              <Card className="mt-5 p-5">
                <p className="flex items-center gap-2 text-sm text-gray-400">
                  <MapPin className="h-4 w-4" />
                  {coordinates
                    ? t('No events or clubs were found within this radius.')
                    : t(
                        'No mapped events yet. Add city coordinates using the latest database migration.'
                      )}
                </p>
              </Card>
            )}
            {visiblePins.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-400">
                <span>♟ {t('Tournaments')}</span>
                <span>♞ {t('Casual Meetups')}</span>
                <span>♜ {t('Chess Clubs')}</span>
                <Link
                  to={{ name: 'meetups' }}
                  className="text-brand-300 hover:underline"
                >
                  {t('Browse meetups')}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
