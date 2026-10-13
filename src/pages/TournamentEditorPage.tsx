import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, Link } from '@/context/RouterContext';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import { authError } from '@/lib/authFlow';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Feedback';
import { AuthMessage } from '@/components/auth/AuthParts';
import { OrganizingIntro } from '@/components/OrganizingIntro';
import { City, Club, TournamentFormat, TournamentStatus } from '@/types';
import { tournamentFormatLabels, tournamentStatusLabels } from '@/lib/utils';

const initial = {
  title: '',
  description: '',
  city_id: '',
  club_id: '',
  start_date: '',
  end_date: '',
  venue: '',
  address: '',
  format: 'swiss' as TournamentFormat,
  time_control: '',
  max_participants: 60,
  registration_deadline: '',
  entry_fee: 0,
  prize_fund: '',
  contact_email: '',
  contact_phone: '',
  status: 'pending' as TournamentStatus,
  image_url: '',
  discord_announcements_enabled: true,
};
function dateOnly(value: string | null) {
  return value ? value.slice(0, 10) : '';
}

export function TournamentEditorPage() {
  const { user, profile } = useAuth();
  const { route, navigate } = useRouter();
  const { t } = useLanguage();
  const userId = user?.id;
  const id = route.name === 'tournamentEditor' ? route.id : undefined;
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [cities, setCities] = useState<City[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const allowLeave = useUnsavedChanges(dirty);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    setError(null);
    if (!userId || !['organizer', 'admin'].includes(profile?.role ?? '')) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const [cityResult, clubResult] = await Promise.all([
          supabase.from('cities').select('*').order('name'),
          supabase
            .from('clubs')
            .select('*')
            .eq('organizer_id', userId)
            .order('name'),
        ]);
        if (cityResult.error || clubResult.error)
          throw cityResult.error || clubResult.error;
        let next = { ...initial };
        if (id) {
          const query = supabase.from('tournaments').select('*').eq('id', id);
          if (profile?.role !== 'admin') query.eq('organizer_id', userId);
          const { data, error } = await query.single();
          if (error || !data)
            throw error || new Error('Tournament unavailable');
          next = Object.fromEntries(
            Object.keys(initial).map((key) => [
              key,
              data[key] ?? initial[key as keyof typeof initial],
            ])
          ) as typeof initial;
          next.start_date = dateOnly(data.start_date);
          next.end_date = dateOnly(data.end_date);
          next.registration_deadline = dateOnly(data.registration_deadline);
        }
        if (active) {
          setCities(cityResult.data ?? []);
          setClubs(clubResult.data ?? []);
          setForm(next);
          setSaved(next);
        }
      } catch {
        if (active) {
          setLoadFailed(true);
          setError(
            'Could not load the event editor. Please reload and try again.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, userId, profile?.role]);
  function update(key: keyof typeof initial, value: string | number | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !user || loadFailed) return;
    if (form.end_date < form.start_date) {
      setError('End date must be on or after the start date.');
      return;
    }
    if (
      form.registration_deadline &&
      form.registration_deadline > form.start_date
    ) {
      setError('Registration must close on or before the start date.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        venue: form.venue.trim(),
        club_id: form.club_id || null,
        registration_deadline: form.registration_deadline || null,
        image_url: form.image_url || null,
      };
      const result = id
        ? await supabase
            .from('tournaments')
            .update(payload)
            .eq('id', id)
            .select('id')
            .single()
        : await supabase
            .from('tournaments')
            .insert({ ...payload, organizer_id: user.id })
            .select('id')
            .single();
      if (result.error) throw result.error;
      setSaved(form);
      allowLeave();
      navigate({ name: 'organizer' });
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setSaving(false);
    }
  }
  if (!user)
    return (
      <div className="v2-container editor-page">
        <Link to={{ name: 'signin' }} className="text-link">
          {t('Sign in')}
        </Link>
      </div>
    );
  if (!['organizer', 'admin'].includes(profile?.role ?? ''))
    return <OrganizingIntro />;
  if (loading)
    return (
      <div className="v2-container editor-page">
        <PageLoader />
      </div>
    );
  function input(
    key: Exclude<keyof typeof initial, 'discord_announcements_enabled'>,
    label: string,
    type = 'text',
    required = false,
    extra: Record<string, string | number> = {}
  ) {
    return (
      <div className="auth-field">
        <label htmlFor={`event-${key}`}>
          {t(label)}
          {required && ' *'}
        </label>
        <Field>
          <input
            id={`event-${key}`}
            className="auth-input"
            type={type}
            required={required}
            value={form[key]}
            disabled={saving}
            onChange={(event) =>
              update(
                key,
                type === 'number'
                  ? Number(event.target.value)
                  : event.target.value
              )
            }
            {...extra}
          />
        </Field>
      </div>
    );
  }
  const statuses: TournamentStatus[] = ['draft', 'pending'];
  if (profile?.role === 'admin' || saved.status === 'published')
    statuses.push('published');
  if (!statuses.includes(saved.status)) statuses.push(saved.status);
  return (
    <div className="v2-container editor-page">
      <Link to={{ name: 'organizer' }} className="text-link">
        {t('Back to organizer workspace')}
      </Link>
      <header className="security-heading">
        <h1>{t(id ? 'Edit Tournament' : 'Create Tournament')}</h1>
      </header>
      <AuthMessage message={error} />
      {!loadFailed && (
        <form onSubmit={submit} aria-busy={saving}>
          <section className="editor-section">
            <h2>{t('Event details')}</h2>
            <div className="editor-grid">
              {input('title', 'Title', 'text', true, { maxLength: 160 })}
              <div className="auth-field">
                <label htmlFor="event-status">{t('Status')}</label>
                <Field>
                  <select
                    id="event-status"
                    className="auth-input"
                    value={form.status}
                    disabled={saving}
                    onChange={(event) => update('status', event.target.value)}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {t(tournamentStatusLabels[status])}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="auth-field wide">
                <label htmlFor="event-description">{t('Description')}</label>
                <Field>
                  <textarea
                    id="event-description"
                    className="auth-input"
                    rows={4}
                    maxLength={10000}
                    value={form.description}
                    disabled={saving}
                    onChange={(event) =>
                      update('description', event.target.value)
                    }
                  />
                </Field>
              </div>
            </div>
            {profile?.role === 'organizer' && (
              <p className="field-hint">
                {t(
                  'New tournaments require admin approval before players can see or join them.'
                )}
              </p>
            )}
          </section>
          <section className="editor-section">
            <h2>{t('When and where')}</h2>
            <div className="editor-grid">
              {input('start_date', 'Start Date', 'date', true)}
              {input('end_date', 'End Date', 'date', true, {
                min: form.start_date,
              })}
              <div className="auth-field">
                <label htmlFor="event-city">{t('City')} *</label>
                <Field>
                  <select
                    id="event-city"
                    className="auth-input"
                    required
                    value={form.city_id}
                    disabled={saving}
                    onChange={(event) => update('city_id', event.target.value)}
                  >
                    <option value="">{t('Select city')}</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {input('venue', 'Venue', 'text', true, { maxLength: 200 })}
              {input('address', 'Address', 'text', false, { maxLength: 500 })}
              <div className="auth-field">
                <label htmlFor="event-club">{t('Club')}</label>
                <Field>
                  <select
                    id="event-club"
                    className="auth-input"
                    value={form.club_id}
                    disabled={saving}
                    onChange={(event) => update('club_id', event.target.value)}
                  >
                    <option value="">{t('No club')}</option>
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </section>
          <section className="editor-section">
            <h2>{t('Participation')}</h2>
            <div className="editor-grid">
              <div className="auth-field">
                <label htmlFor="event-format">{t('Format')}</label>
                <Field>
                  <select
                    id="event-format"
                    className="auth-input"
                    value={form.format}
                    disabled={saving}
                    onChange={(event) => update('format', event.target.value)}
                  >
                    {Object.entries(tournamentFormatLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {t(label)}
                        </option>
                      )
                    )}
                  </select>
                </Field>
              </div>
              {input('max_participants', 'Max Participants', 'number', true, {
                min: 1,
                max: 10000,
                step: 1,
              })}
              {input('time_control', 'Time Control')}
              {input(
                'registration_deadline',
                'Registration Deadline',
                'date',
                false,
                { max: form.start_date }
              )}
            </div>
          </section>
          <details className="profile-disclosure">
            <summary>{t('Optional details')}</summary>
            <label className="discord-check">
              <input
                type="checkbox"
                disabled={saving}
                checked={form.discord_announcements_enabled}
                onChange={(e) =>
                  update('discord_announcements_enabled', e.target.checked)
                }
              />
              {t('Allow Discord announcement when published')}
            </label>
            <div className="editor-grid">
              {input('entry_fee', 'Entry Fee (MAD)', 'number', false, {
                min: 0,
                step: 0.01,
              })}
              {input('prize_fund', 'Prize Fund')}
              {input('contact_email', 'Contact Email', 'email')}
              {input('contact_phone', 'Contact Phone', 'tel')}
              {input('image_url', 'Image URL (optional)', 'url')}
            </div>
            <p className="field-hint">
              {t(
                'Event contact details are public. Add only what you want to share.'
              )}
            </p>
          </details>
          <div className="editor-actions">
            <p role="status">
              {t(dirty ? 'You have unsaved changes.' : 'No unsaved changes.')}
            </p>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => navigate({ name: 'organizer' })}
            >
              {t('Cancel')}
            </Button>
            <Button type="submit" disabled={saving || (Boolean(id) && !dirty)}>
              {t(
                saving ? 'Saving...' : id ? 'Save Changes' : 'Create Tournament'
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
