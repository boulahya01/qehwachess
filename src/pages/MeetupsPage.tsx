import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { authError } from '@/lib/authFlow';
import { Field } from '@/components/ui/Field';
import { FormEvent, useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Clock3,
  MapPin,
  MessageCircle,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { useCities } from '@/hooks/useData';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import type { CasualMeetup } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, PageLoader } from '@/components/ui/Feedback';

function localDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function initialStartTime() {
  const date = new Date();
  date.setHours(date.getHours() + 2, 0, 0, 0);
  return localDateTimeValue(date);
}

export function MeetupsPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { navigate } = useRouter();
  const { cities } = useCities();
  const [meetups, setMeetups] = useState<CasualMeetup[]>([]);
  const [joinedMeetups, setJoinedMeetups] = useState<Set<string>>(new Set());
  const [cityFilter, setCityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyMeetupId, setBusyMeetupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    city_id: '',
    venue: '',
    address: '',
    starts_at: initialStartTime(),
    time_control: 'Casual / no clock',
    skill_level: 'Any level',
  });

  const hasDraft = Boolean(
    showForm && (form.title || form.description || form.venue || form.address)
  );
  useUnsavedChanges(hasDraft);
  function closeForm() {
    if (!hasDraft || window.confirm(t('Leave without saving your changes?')))
      setShowForm(false);
  }

  useEffect(() => {
    if (cities.length > 0) {
      setForm((current) =>
        current.city_id ? current : { ...current, city_id: cities[0].id }
      );
    }
  }, [cities]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      const meetupQuery = supabase
        .from('casual_meetups')
        .select(
          '*, city:cities(*), creator:profiles!casual_meetups_creator_id_fkey(id, full_name, avatar_url, username)'
        )
        .eq('status', 'published')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at');
      const joinedQuery = user
        ? supabase
            .from('meetup_attendees')
            .select('meetup_id')
            .eq('player_id', user.id)
            .eq('status', 'joined')
        : Promise.resolve({ data: [], error: null });
      const [meetupResult, joinedResult] = await Promise.all([
        meetupQuery,
        joinedQuery,
      ]);
      if (!active) return;
      if (meetupResult.error || joinedResult.error) {
        setError(
          [meetupResult.error?.message, joinedResult.error?.message]
            .filter(Boolean)
            .join(' ')
        );
      }
      setMeetups((meetupResult.data ?? []) as CasualMeetup[]);
      setJoinedMeetups(
        new Set((joinedResult.data ?? []).map((item) => item.meetup_id))
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const visibleMeetups = meetups.filter((meetup) => {
    const matchesCity = !cityFilter || meetup.city_id === cityFilter;
    const searchText =
      `${meetup.title} ${meetup.description} ${meetup.venue} ${meetup.city?.name ?? ''}`.toLowerCase();
    return matchesCity && searchText.includes(search.trim().toLowerCase());
  });

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createMeetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('casual_meetups')
        .insert({
          creator_id: user.id,
          title: form.title.trim(),
          description: form.description.trim(),
          city_id: form.city_id,
          venue: form.venue.trim(),
          address: form.address.trim() || null,
          starts_at: new Date(form.starts_at).toISOString(),
          time_control: form.time_control,
          skill_level: form.skill_level,
        })
        .select(
          '*, city:cities(*), creator:profiles!casual_meetups_creator_id_fkey(id, full_name, avatar_url, username)'
        )
        .single();
      if (insertError) {
        setError(insertError.message);
      } else if (data) {
        setMeetups((current) =>
          [...current, data as CasualMeetup].sort(
            (a, b) =>
              new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
          )
        );
        setShowForm(false);
        setForm((current) => ({
          ...current,
          title: '',
          description: '',
          venue: '',
          address: '',
          starts_at: initialStartTime(),
        }));
      }
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setSaving(false);
    }
  }

  async function toggleAttendance(meetup: CasualMeetup) {
    if (!user) return;
    setBusyMeetupId(meetup.id);
    setError(null);
    try {
      const isJoined = joinedMeetups.has(meetup.id);
      const result = isJoined
        ? await supabase
            .from('meetup_attendees')
            .update({ status: 'cancelled' })
            .eq('meetup_id', meetup.id)
            .eq('player_id', user.id)
        : await supabase
            .from('meetup_attendees')
            .upsert(
              { meetup_id: meetup.id, player_id: user.id, status: 'joined' },
              { onConflict: 'meetup_id,player_id' }
            );
      if (result.error) {
        setError(result.error.message);
      } else {
        setJoinedMeetups((current) => {
          const updated = new Set(current);
          if (isJoined) updated.delete(meetup.id);
          else updated.add(meetup.id);
          return updated;
        });
      }
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setBusyMeetupId(null);
    }
  }

  const dateFormatter = new Intl.DateTimeFormat(
    language === 'ar' ? 'ar' : language,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  );

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">
              {t('Find a game')}
            </h1>
            <p className="mt-2 text-gray-500">
              {t('Find a nearby player and arrange a casual game.')}
            </p>
          </div>
          {user && (
            <Button
              onClick={() => {
                if (showForm) closeForm();
                else setShowForm(true);
              }}
            >
              {showForm ? t('Close') : t('Post a meetup')}
            </Button>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2 rounded-lg border border-error-500/20 bg-error-500/10 p-3 text-sm text-error-400"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {showForm && user && (
          <Card className="mb-8 p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {t('Create a casual game')}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                aria-label={t('Close')}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={createMeetup} className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-gray-400 sm:col-span-2">
                {t('Title')}
                <Field>
                  <input
                    required
                    maxLength={100}
                    value={form.title}
                    onChange={(event) =>
                      updateForm('title', event.target.value)
                    }
                    className="mt-1.5 w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-white"
                    placeholder={t('e.g. Casual blitz at the café')}
                  />
                </Field>
              </label>
              <label className="text-sm text-gray-400">
                {t('City')}
                <Field>
                  <select
                    required
                    value={form.city_id}
                    onChange={(event) =>
                      updateForm('city_id', event.target.value)
                    }
                    className="mt-1.5 w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-white"
                  >
                    <option value="">{t('Select city')}</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </label>
              <label className="text-sm text-gray-400">
                {t('Date and time')}
                <Field>
                  <input
                    required
                    type="datetime-local"
                    min={localDateTimeValue(new Date())}
                    value={form.starts_at}
                    onChange={(event) =>
                      updateForm('starts_at', event.target.value)
                    }
                    className="mt-1.5 w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-white"
                  />
                </Field>
              </label>
              <label className="text-sm text-gray-400">
                {t('Venue')}
                <Field>
                  <input
                    required
                    maxLength={120}
                    value={form.venue}
                    onChange={(event) =>
                      updateForm('venue', event.target.value)
                    }
                    className="mt-1.5 w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-white"
                    placeholder={t('Café, park, or chess club')}
                  />
                </Field>
              </label>
              <label className="text-sm text-gray-400">
                {t('Address (optional)')}
                <Field>
                  <input
                    maxLength={200}
                    value={form.address}
                    onChange={(event) =>
                      updateForm('address', event.target.value)
                    }
                    className="mt-1.5 w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-white"
                  />
                </Field>
              </label>
              <label className="text-sm text-gray-400">
                {t('Time Control')}
                <Field>
                  <select
                    value={form.time_control}
                    onChange={(event) =>
                      updateForm('time_control', event.target.value)
                    }
                    className="mt-1.5 w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-white"
                  >
                    {[
                      'Casual / no clock',
                      'Blitz (3+0)',
                      'Blitz (5+3)',
                      'Rapid (10+0)',
                      'Rapid (15+10)',
                      'Classical',
                    ].map((control) => (
                      <option key={control} value={control}>
                        {t(control)}
                      </option>
                    ))}
                  </select>
                </Field>
              </label>
              <label className="text-sm text-gray-400">
                {t('Skill level')}
                <Field>
                  <select
                    value={form.skill_level}
                    onChange={(event) =>
                      updateForm('skill_level', event.target.value)
                    }
                    className="mt-1.5 w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-white"
                  >
                    {['Any level', 'Beginner', 'Intermediate', 'Advanced'].map(
                      (level) => (
                        <option key={level} value={level}>
                          {t(level)}
                        </option>
                      )
                    )}
                  </select>
                </Field>
              </label>
              <label className="text-sm text-gray-400 sm:col-span-2">
                {t('Description (optional)')}
                <Field>
                  <textarea
                    maxLength={1000}
                    rows={3}
                    value={form.description}
                    onChange={(event) =>
                      updateForm('description', event.target.value)
                    }
                    className="mt-1.5 w-full rounded-lg border border-surface-700 bg-surface-800 px-3.5 py-2.5 text-white"
                  />
                </Field>
              </label>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" disabled={saving || cities.length === 0}>
                  {saving ? t('Publishing...') : t('Publish meetup')}
                </Button>
              </div>
            </form>
          </Card>
        )}

        <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_240px]">
          <label className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Field>
              <input
                aria-label={t('Search meetups')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('Search meetups...')}
                className="w-full rounded-xl border border-surface-700 bg-surface-900 py-3 pl-10 pr-4 text-white placeholder-gray-500"
              />
            </Field>
          </label>
          <Field>
            <select
              value={cityFilter}
              onChange={(event) => setCityFilter(event.target.value)}
              aria-label={t('Filter by city')}
              className="rounded-xl border border-surface-700 bg-surface-900 px-3.5 py-3 text-white"
            >
              <option value="">{t('All cities')}</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {loading ? (
          <PageLoader />
        ) : error && meetups.length === 0 ? null : visibleMeetups.length ===
          0 ? (
          <EmptyState
            title={t('No upcoming meetups')}
            description={t(
              'Be the first to post a casual chess game in your city.'
            )}
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleMeetups.map((meetup) => {
              const mapQuery = encodeURIComponent(
                [meetup.address, meetup.venue, meetup.city?.name]
                  .filter(Boolean)
                  .join(', ')
              );
              return (
                <Card key={meetup.id} className="flex flex-col p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        {meetup.title}
                      </h2>
                      <p className="mt-1 text-sm text-gray-400">
                        {meetup.creator?.full_name}
                      </p>
                    </div>
                    <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-300">
                      {t(meetup.skill_level)}
                    </span>
                  </div>
                  {meetup.description && (
                    <p className="mb-4 text-sm leading-relaxed text-gray-400">
                      {meetup.description}
                    </p>
                  )}
                  <div className="mb-5 space-y-2 text-sm text-gray-300">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-brand-400" />
                      {dateFormatter.format(new Date(meetup.starts_at))}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-brand-400" />
                      {meetup.venue}
                      {meetup.city?.name ? ` · ${meetup.city.name}` : ''}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-brand-400" />
                      {t(meetup.time_control)}
                    </p>
                    <a
                      className="inline-flex items-center gap-1 text-brand-300 hover:underline"
                      href={`https://www.openstreetmap.org/search?query=${mapQuery}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {t('Open map')}
                    </a>
                  </div>
                  <div className="mt-auto space-y-2 border-t border-surface-700 pt-4">
                    {user ? (
                      <>
                        <Button
                          size="sm"
                          variant={
                            joinedMeetups.has(meetup.id) ? 'danger' : 'primary'
                          }
                          disabled={
                            busyMeetupId === meetup.id ||
                            meetup.creator_id === user.id
                          }
                          onClick={() => void toggleAttendance(meetup)}
                          className="w-full"
                        >
                          <Users className="h-4 w-4" />
                          {meetup.creator_id === user.id
                            ? t('Your meetup')
                            : joinedMeetups.has(meetup.id)
                              ? t('Cancel attendance')
                              : t('Join meetup')}
                        </Button>
                        {(meetup.creator_id === user.id ||
                          joinedMeetups.has(meetup.id)) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              navigate({
                                name: 'messages',
                                meetupId: meetup.id,
                              })
                            }
                            className="w-full"
                          >
                            <MessageCircle className="h-4 w-4" />
                            {t('Meetup chat')}
                          </Button>
                        )}
                      </>
                    ) : (
                      <p className="text-center text-sm text-gray-500">
                        {t('Sign in to join this meetup.')}
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
