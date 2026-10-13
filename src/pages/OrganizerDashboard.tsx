import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { OrganizingIntro } from '@/components/OrganizingIntro';
import { PageLoader, EmptyState } from '@/components/ui/Feedback';
import {
  Trophy,
  Plus,
  Edit3,
  Trash2,
  Eye,
  X,
  Save,
  MapPin,
  Calendar,
  Clock,
} from 'lucide-react';
import { Tournament, TournamentStatus, City, Club } from '@/types';
import {
  formatDateRange,
  getDaysUntil,
  tournamentFormatLabels,
  tournamentStatusLabels,
  tournamentStatusColors,
} from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

export function OrganizerDashboard() {
  const { t, language } = useLanguage();
  const translate = t;
  const { user, profile, loading: authLoading } = useAuth();
  const { navigate } = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: cData } = await supabase.from('cities').select('*').order('name');
      setCities(cData ?? []);

      const { data: clubData } = await supabase
        .from('clubs')
        .select('*')
        .eq('organizer_id', user.id)
        .order('name');
      setClubs(clubData ?? []);

      const { data } = await supabase
        .from('tournaments')
        .select('*, city:cities(*)')
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false });
      setTournaments(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  if (authLoading) return <div className="pt-24"><PageLoader /></div>;
  if (!user) {
    navigate({ name: 'signin' });
    return null;
  }
  if (profile?.role !== 'organizer' && profile?.role !== 'admin') return <OrganizingIntro />;

  const stats = {
    total: tournaments.length,
    published: tournaments.filter((t) => t.status === 'published').length,
    pending: tournaments.filter((t) => t.status === 'pending').length,
    upcoming: tournaments.filter((t) => t.status === 'published' && getDaysUntil(t.start_date) >= 0).length,
  };

  async function handleDelete(id: string) {
    if (!confirm(t('Are you sure you want to delete this tournament? This cannot be undone.'))) return;
    await supabase.from('tournaments').delete().eq('id', id);
    setTournaments(tournaments.filter((t) => t.id !== id));
  }

  function handleEdit(t: Tournament) {
    setEditingTournament(t);
    setShowForm(true);
  }

  function handleNew() {
    setEditingTournament(null);
    setShowForm(true);
  }

  async function refreshTournaments() {
    if (!user) return;
    const { data } = await supabase
      .from('tournaments')
      .select('*, city:cities(*)')
      .eq('organizer_id', user.id)
      .order('created_at', { ascending: false });
    setTournaments(data ?? []);
  }

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">{t('Organizer Panel')}</h1>
            <p className="text-gray-500 mt-2">{t('Manage your tournaments and registrations')}</p>
          </div>
          <Button onClick={handleNew}>
            <Plus className="w-4 h-4" />
            {t('New Tournament')}
          </Button>
          <Button variant="outline" onClick={() => navigate({ name: 'clubManagement' })}>
            {t('Manage Clubs')}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Trophy, label: t('Total'), value: stats.total, color: 'text-brand-400' },
            { icon: Eye, label: t('Published'), value: stats.published, color: 'text-success-400' },
            { icon: Clock, label: t('Pending'), value: stats.pending, color: 'text-amber-400' },
            { icon: Calendar, label: t('Upcoming'), value: stats.upcoming, color: 'text-accent-400' },
          ].map((stat, i) => (
            <Card key={i} className="p-5">
              <stat.icon className={`w-5 h-5 ${stat.color} mb-3`} />
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </Card>
          ))}
        </div>

        {/* Tournament list */}
        {loading ? (
          <PageLoader />
        ) : tournaments.length === 0 ? (
          <Card className="p-6">
            <EmptyState
              icon={<Trophy className="w-12 h-12" />}
              title={t('No tournaments yet')}
              description={t('Create your first tournament to start accepting registrations.')}
              action={<Button onClick={handleNew}><Plus className="w-4 h-4" />{t('Create Tournament')}</Button>}
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {tournaments.map((t) => (
              <Card key={t.id} className="p-5 flex items-center gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-surface-800 border border-surface-700 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">{t.title}</h3>
                  <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{t.city?.name}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDateRange(t.start_date, t.end_date, language)}</span>
                    <span>{translate(tournamentFormatLabels[t.format])}</span>
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-1.5">
                  <Badge className={tournamentStatusColors[t.status]}>
                    {translate(tournamentStatusLabels[t.status])}
                  </Badge>
                  <span className="text-xs text-gray-500">{t.max_participants} {translate('max')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link to={{ name: 'tournament', id: t.id }}>
                    <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(t)}><Edit3 className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)} className="text-error-400 hover:bg-error-500/10"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Tournament form modal */}
      {showForm && (
        <TournamentForm
          tournament={editingTournament}
          cities={cities}
          clubs={clubs}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            refreshTournaments();
          }}
        />
      )}
    </div>
  );
}

interface FormProps {
  tournament: Tournament | null;
  cities: City[];
  clubs: Club[];
  onClose: () => void;
  onSaved: () => void;
}

function TournamentForm({ tournament, cities, clubs, onClose, onSaved }: FormProps) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: tournament?.title ?? '',
    description: tournament?.description ?? '',
    city_id: tournament?.city_id ?? cities[0]?.id ?? '',
    club_id: tournament?.club_id ?? '',
    start_date: tournament?.start_date ?? '',
    end_date: tournament?.end_date ?? '',
    venue: tournament?.venue ?? '',
    address: tournament?.address ?? '',
    format: tournament?.format ?? 'swiss',
    time_control: tournament?.time_control ?? '',
    max_participants: tournament?.max_participants ?? 60,
    registration_deadline: tournament?.registration_deadline ?? '',
    entry_fee: tournament?.entry_fee ?? 0,
    prize_fund: tournament?.prize_fund ?? '',
    contact_email: tournament?.contact_email ?? '',
    contact_phone: tournament?.contact_phone ?? '',
    status: tournament?.status ?? 'pending',
    image_url: tournament?.image_url ?? '',
  });

  function set(key: string, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      ...form,
      organizer_id: user!.id,
      club_id: form.club_id || null,
      registration_deadline: form.registration_deadline || null,
      entry_fee: Number(form.entry_fee),
      max_participants: Number(form.max_participants),
      image_url: form.image_url || null,
    };

    if (tournament) {
      const { error } = await supabase.from('tournaments').update(payload).eq('id', tournament.id);
      if (error) setError(error.message);
      else onSaved();
    } else {
      const { error } = await supabase.from('tournaments').insert(payload);
      if (error) setError(error.message);
      else onSaved();
    }
    setSaving(false);
  }

  const inputClass = 'w-full px-3.5 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors text-sm';
  const labelClass = 'text-sm font-medium text-gray-400 mb-1.5 block';
  const availableStatuses: TournamentStatus[] = ['draft', 'pending'];
  if (profile?.role === 'admin' || tournament?.status === 'published') {
    availableStatuses.push('published');
  }
  if (tournament && !availableStatuses.includes(tournament.status)) {
    availableStatuses.push(tournament.status);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-surface-900 border-b border-surface-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-white">
            {tournament ? t('Edit Tournament') : t('Create Tournament')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-error-500/10 border border-error-500/20 text-error-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className={labelClass}>{t('Title')} *</label>
            <input required value={form.title} onChange={(e) => set('title', e.target.value)} className={inputClass} placeholder={t('Tournament name')} />
          </div>

          <div>
            <label className={labelClass}>{t('Description')} *</label>
            <textarea required value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} className={inputClass} placeholder={t('Describe the tournament...')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('City')} *</label>
              <select required value={form.city_id} onChange={(e) => set('city_id', e.target.value)} className={inputClass}>
                <option value="">{t('Select city')}</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('Club (optional)')}</label>
              <select value={form.club_id} onChange={(e) => set('club_id', e.target.value)} className={inputClass}>
                <option value="">{t('No club')}</option>
                {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('Start Date')} *</label>
              <input type="date" required value={form.start_date} onChange={(e) => set('start_date', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('End Date')} *</label>
              <input type="date" required value={form.end_date} onChange={(e) => set('end_date', e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('Venue')} *</label>
              <input required value={form.venue} onChange={(e) => set('venue', e.target.value)} className={inputClass} placeholder={t('Venue name')} />
            </div>
            <div>
              <label className={labelClass}>{t('Address')}</label>
              <input value={form.address} onChange={(e) => set('address', e.target.value)} className={inputClass} placeholder={t('Full address')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('Format')} *</label>
              <select value={form.format} onChange={(e) => set('format', e.target.value)} className={inputClass}>
                {Object.entries(tournamentFormatLabels).map(([v, l]) =>                 <option key={v} value={v}>{t(l)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('Time Control')}</label>
              <input value={form.time_control} onChange={(e) => set('time_control', e.target.value)} className={inputClass} placeholder="e.g. 90 min + 30 sec" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('Max Participants')} *</label>
              <input type="number" required min={1} value={form.max_participants} onChange={(e) => set('max_participants', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('Entry Fee (MAD)')}</label>
              <input type="number" min={0} value={form.entry_fee} onChange={(e) => set('entry_fee', e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('Registration Deadline')}</label>
              <input type="date" value={form.registration_deadline} onChange={(e) => set('registration_deadline', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('Status')}</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputClass}>
                {availableStatuses.map((s) => (
                  <option key={s} value={s}>{t(tournamentStatusLabels[s])}</option>
                ))}
              </select>
              {profile?.role === 'organizer' && (
                <p className="mt-1.5 text-xs text-gray-500">{t('New tournaments require admin approval before players can see or join them.')}</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>{t('Prize Fund')}</label>
            <input value={form.prize_fund} onChange={(e) => set('prize_fund', e.target.value)} className={inputClass} placeholder={t('e.g. 15,000 MAD total')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('Contact Email')}</label>
              <input type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} className={inputClass} placeholder={t('organizer@email.com')} />
            </div>
            <div>
              <label className={labelClass}>{t('Contact Phone')}</label>
              <input value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} className={inputClass} placeholder="+212 ..." />
            </div>
          </div>

          <div>
            <label className={labelClass}>{t('Image URL (optional)')}</label>
            <input value={form.image_url} onChange={(e) => set('image_url', e.target.value)} className={inputClass} placeholder="https://..." />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-700">
            <Button type="button" variant="ghost" onClick={onClose}>{t('Cancel')}</Button>
            <Button type="submit" disabled={saving}>
              <Save className="w-4 h-4" />
              {saving ? t('Saving...') : tournament ? t('Update') : t('Create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
