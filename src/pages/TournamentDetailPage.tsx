import { useState, useEffect } from 'react';
import { Link, useRouter } from '@/context/RouterContext';
import { useTournament } from '@/hooks/useData';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PageLoader, ErrorState } from '@/components/ui/Feedback';
import { supabase } from '@/lib/supabase';
import {
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Trophy,
  Clock,
  Mail,
  Phone,
  Building2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  CalendarClock,
} from 'lucide-react';
import {
  formatDate,
  formatDateRange,
  formatPrice,
  getDaysUntil,
  tournamentFormatLabels,
  tournamentStatusColors,
} from '@/lib/utils';
import { Registration } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { TournamentCheckInPanel } from '@/components/TournamentCheckInPanel';
import { TournamentPairingsPanel } from '@/components/TournamentPairingsPanel';

export function TournamentDetailPage({ id }: { id: string }) {
  const { t, language } = useLanguage();
  const { navigate } = useRouter();
  const { user, profile } = useAuth();
  const {
    tournament,
    loading,
    error: loadError,
    registrationCount,
    refreshRegistrationCount,
  } = useTournament(id);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [checkInQr, setCheckInQr] = useState<string | null>(null);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [registrationLoadError, setRegistrationLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setRegistration(null);
    setRegistrationLoadError(null);
    setRegistrationLoading(false);
    if (!user || !tournament) return;
    setRegistrationLoading(true);
    (async () => {
      const { data, error: queryError } = await supabase
        .from('registrations')
        .select('*')
        .eq('tournament_id', id)
        .eq('player_id', user.id)
        .abortSignal(controller.signal)
        .maybeSingle();
      if (controller.signal.aborted) return;
      setRegistration(data as Registration | null);
      setRegistrationLoadError(
        queryError ? 'Could not load your registration. Please try again.' : null
      );
      setRegistrationLoading(false);
    })();
    return () => controller.abort();
  }, [user, tournament, id]);

  useEffect(() => {
    if (registration?.status !== 'confirmed' || !registration.check_in_token) {
      setCheckInQr(null);
      return;
    }
    let active = true;
    const checkInToken = registration.check_in_token;
    void import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(checkInToken, {
          width: 220,
          margin: 1,
          color: { dark: '#111827', light: '#ffffff' },
        })
      )
      .then((url) => {
        if (active) setCheckInQr(url);
      })
      .catch((qrError: unknown) => {
        if (active)
          setError(
            qrError instanceof Error ? qrError.message : 'Could not create your check-in QR code.'
          );
      });
    return () => {
      active = false;
    };
  }, [registration?.check_in_token, registration?.status]);

  if (loading)
    return (
      <div className="pt-24">
        <PageLoader />
      </div>
    );
  if (loadError)
    return (
      <div className="pt-24">
        <ErrorState message={t(loadError)} />
      </div>
    );
  if (!tournament)
    return (
      <div className="pt-24">
        <ErrorState message={t('Tournament not found or no longer available.')} />
      </div>
    );

  const spotsLeft = tournament.max_participants - registrationCount;
  const isFull = spotsLeft <= 0;
  const daysUntil = getDaysUntil(tournament.start_date);
  const isPast = daysUntil < 0;
  const regDeadlinePassed =
    tournament.registration_deadline !== null && getDaysUntil(tournament.registration_deadline) < 0;
  const isRegistered = registration && registration.status !== 'cancelled';
  const canManageTournament = profile?.role === 'admin' || tournament.organizer_id === user?.id;

  async function handleRegister() {
    if (!user) {
      navigate({ name: 'signin', tournamentId: id });
      return;
    }
    if (!['player', 'organizer'].includes(profile?.role ?? '')) {
      setError(t('Only player accounts can register for tournaments.'));
      return;
    }

    setRegistering(true);
    setError(null);
    setSuccess(null);

    try {
      const status = isFull ? 'waitlisted' : 'confirmed';
      // Reuse a cancelled record: tournament/player is a unique pair.
      const mutation =
        registration?.status === 'cancelled'
          ? supabase
              .from('registrations')
              .update({ status, checked_in_at: null })
              .eq('id', registration.id)
              .eq('player_id', user.id)
              .eq('status', 'cancelled')
          : supabase.from('registrations').insert({
              tournament_id: id,
              player_id: user.id,
              status,
            });
      const { data, error: insertError } = await mutation.select().single();

      if (insertError) {
        setError(
          insertError.code === '23505'
            ? t('You are already registered for this tournament.')
            : insertError.message
        );
      } else {
        setRegistration(data as Registration);
        setSuccess(
          data.status === 'waitlisted'
            ? t("You've been added to the waitlist!")
            : t("You're registered! See you at the tournament.")
        );
        await refreshRegistrationCount();
      }
    } catch (registerError) {
      setError(
        registerError instanceof Error
          ? registerError.message
          : t('Could not update your registration. Please try again.')
      );
    } finally {
      setRegistering(false);
    }
  }

  async function handleCancel() {
    if (!registration) return;
    setRegistering(true);
    setError(null);
    setSuccess(null);
    try {
      const { data, error: updateError } = await supabase
        .from('registrations')
        .update({ status: 'cancelled' })
        .eq('id', registration.id)
        .eq('player_id', user!.id)
        .select()
        .single();
      if (updateError) {
        setError(updateError.message);
      } else {
        setRegistration(data as Registration);
        setSuccess(t('Your registration has been cancelled.'));
        await refreshRegistrationCount();
      }
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : t('Could not update your registration. Please try again.')
      );
    } finally {
      setRegistering(false);
    }
  }

  const infoRows = [
    {
      icon: Calendar,
      label: t('Dates'),
      value: formatDateRange(tournament.start_date, tournament.end_date, language),
    },
    { icon: Clock, label: t('Time Control'), value: tournament.time_control ?? t('TBD') },
    { icon: Trophy, label: t('Format'), value: t(tournamentFormatLabels[tournament.format]) },
    { icon: MapPin, label: t('Venue'), value: tournament.venue },
    { icon: MapPin, label: t('Address'), value: tournament.address ?? t('TBD') },
    { icon: Users, label: t('Capacity'), value: `${tournament.max_participants} ${t('players')}` },
    { icon: DollarSign, label: t('Entry Fee'), value: formatPrice(Number(tournament.entry_fee)) },
    {
      icon: CalendarClock,
      label: t('Registration Deadline'),
      value: tournament.registration_deadline
        ? formatDate(tournament.registration_deadline, language)
        : t('No deadline'),
    },
  ];

  return (
    <div className="min-h-screen pt-20 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          to={{ name: 'tournaments' }}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-brand-300 transition-colors mb-6 mt-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('Back to tournaments')}
        </Link>

        <section className="event-detail-hero" aria-labelledby="tournament-title">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Badge className="bg-brand-500/10 text-brand-300 border-brand-500/30">
                {t(tournamentFormatLabels[tournament.format])}
              </Badge>
              <Badge className={tournamentStatusColors[tournament.status]}>
                {t(tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1))}
              </Badge>
              {!isPast && daysUntil <= 30 && (
                <span className="text-sm text-gray-500">
                  {daysUntil === 0
                    ? t('Today!')
                    : daysUntil === 1
                      ? t('Tomorrow')
                      : `${t('In')} ${daysUntil} ${t('days')}`}
                </span>
              )}
            </div>
            <h1 id="tournament-title">{tournament.title}</h1>
            <div className="grid gap-3 mt-5 text-gray-400 text-sm">
              <span className="flex items-center gap-2">
                <MapPin size={17} aria-hidden="true" />
                {[tournament.venue, tournament.city?.name].filter(Boolean).join(', ')}
              </span>
              <span className="flex items-center gap-2">
                <Calendar size={17} aria-hidden="true" />
                {formatDateRange(tournament.start_date, tournament.end_date, language)}
              </span>
            </div>
          </div>
          <img
            src={tournament.image_url || '/images/chess-hero-v2.webp'}
            alt=""
            width={1200}
            height={800}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = '/images/chess-hero-v2.webp';
            }}
          />
        </section>
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6 order-2 lg:order-1 min-w-0">
            {(profile?.role === 'admin' || tournament.organizer_id === user?.id) && (
              <TournamentCheckInPanel tournamentId={tournament.id} />
            )}
            {(tournament.status === 'published' || canManageTournament) &&
              (tournament.format === 'swiss' || canManageTournament) && (
                <TournamentPairingsPanel
                  tournamentId={tournament.id}
                  isManager={canManageTournament}
                  format={tournament.format}
                />
              )}
            {/* About */}
            <Card className="p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white mb-4">{t('About this tournament')}</h2>
              <p className="text-gray-400 leading-relaxed whitespace-pre-wrap">
                {tournament.description}
              </p>
            </Card>

            {/* Details grid */}
            <Card className="p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white mb-5">{t('Tournament Details')}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {infoRows.map((row, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-surface-800/50">
                    <div className="w-9 h-9 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
                      <row.icon className="w-4 h-4 text-brand-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                        {row.label}
                      </p>
                      <p className="text-sm text-white font-medium mt-0.5">{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Prize fund */}
            {tournament.prize_fund && (
              <Card className="p-6 sm:p-8 relative overflow-hidden">
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-5 h-5 text-accent-400" />
                    <h2 className="text-xl font-bold text-white">{t('Prize Fund')}</h2>
                  </div>
                  <p className="text-2xl font-bold text-accent-400">{tournament.prize_fund}</p>
                </div>
              </Card>
            )}

            {/* Club */}
            {tournament.club && (
              <Link to={{ name: 'club', id: tournament.club.id }}>
                <Card hover className="p-6 flex items-center gap-4 group cursor-pointer">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-700/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-7 h-7 text-brand-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                      {t('Organized by')}
                    </p>
                    <p className="text-lg font-bold text-white group-hover:text-brand-300 transition-colors">
                      {tournament.club.name}
                    </p>
                    <p className="text-sm text-gray-500">{tournament.club.city?.name}</p>
                  </div>
                  <ArrowLeft className="w-5 h-5 text-surface-600 group-hover:text-brand-400 transition-colors rotate-180" />
                </Card>
              </Link>
            )}

            {/* Contact */}
            {(tournament.contact_email || tournament.contact_phone) && (
              <Card className="p-6 sm:p-8">
                <h2 className="text-xl font-bold text-white mb-4">{t('Contact Organizer')}</h2>
                <div className="flex flex-col sm:flex-row gap-3">
                  {tournament.contact_email && (
                    <a
                      href={`mailto:${tournament.contact_email}`}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-800 text-gray-300 hover:text-brand-300 transition-colors text-sm"
                    >
                      <Mail className="w-4 h-4" />
                      {tournament.contact_email}
                    </a>
                  )}
                  {tournament.contact_phone && (
                    <a
                      href={`tel:${tournament.contact_phone}`}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-800 text-gray-300 hover:text-brand-300 transition-colors text-sm"
                    >
                      <Phone className="w-4 h-4" />
                      {tournament.contact_phone}
                    </a>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar - Registration */}
          <div className="lg:col-span-1 order-1 lg:order-2 min-w-0">
            <div className="sticky top-24 space-y-4">
              <Card className="p-6">
                {/* Registration status */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">{t('Available spots')}</span>
                    <span
                      className={`text-sm font-bold ${isFull ? 'text-error-400' : 'text-success-400'}`}
                    >
                      {isFull ? t('Full') : `${spotsLeft} ${t('left')}`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isFull ? 'bg-error-500' : 'bg-gradient-to-r from-brand-500 to-brand-400'}`}
                      style={{
                        width: `${Math.min(100, (registrationCount / tournament.max_participants) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {registrationCount} / {tournament.max_participants} {t('registered')}
                  </p>
                </div>

                {/* Alerts */}
                {(error || registrationLoadError) && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 p-3 rounded-lg bg-error-500/10 border border-error-500/20 text-error-400 text-sm mb-4 animate-fade-in"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {t(error || registrationLoadError || '')}
                  </div>
                )}
                {success && (
                  <div
                    role="status"
                    className="flex items-start gap-2 p-3 rounded-lg bg-success-500/10 border border-success-500/20 text-success-400 text-sm mb-4 animate-fade-in"
                  >
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {t(success)}
                  </div>
                )}

                {/* Action button */}
                {registrationLoading || registrationLoadError ? (
                  <Button variant="secondary" size="lg" className="w-full" disabled>
                    {registrationLoading
                      ? t('Loading your registration...')
                      : t('Registration unavailable')}
                  </Button>
                ) : isPast ? (
                  <Button variant="secondary" size="lg" className="w-full" disabled>
                    {t('Tournament Ended')}
                  </Button>
                ) : isRegistered ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-success-500/10 border border-success-500/20 text-success-400 text-sm font-medium">
                      <CheckCircle2 className="w-5 h-5" />
                      {registration?.status === 'waitlisted'
                        ? t("You've been added to the waitlist!")
                        : t("You're registered!")}
                    </div>
                    {registration?.status === 'confirmed' && (
                      <div className="rounded-xl border border-surface-700 bg-surface-800/60 p-4 text-center">
                        <p className="mb-3 text-sm font-medium text-gray-300">
                          {t('Your event check-in QR code')}
                        </p>
                        {checkInQr ? (
                          <img
                            src={checkInQr}
                            alt={t('Tournament check-in QR code')}
                            className="mx-auto rounded-lg bg-white p-2"
                          />
                        ) : (
                          <p className="text-xs text-gray-500">{t('Preparing your QR code...')}</p>
                        )}
                        <p className="mt-3 text-xs text-gray-500">
                          {t('Show this code to the organizer at the event.')}
                        </p>
                      </div>
                    )}
                    <Button
                      variant="danger"
                      size="md"
                      className="w-full"
                      onClick={handleCancel}
                      disabled={registering}
                    >
                      {registering ? t('Cancelling...') : t('Cancel Registration')}
                    </Button>
                  </div>
                ) : regDeadlinePassed ? (
                  <Button variant="secondary" size="lg" className="w-full" disabled>
                    {t('Registration Closed')}
                  </Button>
                ) : isFull ? (
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    onClick={handleRegister}
                    disabled={registering}
                  >
                    {registering
                      ? t('Joining waitlist...')
                      : user
                        ? t('Join Waitlist')
                        : t('Sign In to Register')}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleRegister}
                    disabled={registering}
                  >
                    {registering
                      ? t('Registering...')
                      : user
                        ? t('Register Now')
                        : t('Sign In to Register')}
                  </Button>
                )}

                {!user && !isPast && !regDeadlinePassed && (
                  <p className="text-xs text-gray-500 text-center mt-3">
                    {t('Need an account?')}{' '}
                    <Link
                      to={{ name: 'signup', tournamentId: id }}
                      className="text-brand-400 hover:underline"
                    >
                      {t('Sign Up')}
                    </Link>
                  </p>
                )}
              </Card>

              {/* Quick info */}
              <Card className="p-6">
                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
                  {t('Quick Info')}
                </h3>
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">{t('Entry Fee')}</span>
                    <span className="text-white font-medium">
                      {t(formatPrice(Number(tournament.entry_fee)))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">{t('Format')}</span>
                    <span className="text-white font-medium">
                      {t(tournamentFormatLabels[tournament.format])}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">{t('City')}</span>
                    <span className="text-white font-medium">{tournament.city?.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">{t('Starts')}</span>
                    <span className="text-white font-medium">
                      {formatDate(tournament.start_date, language)}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
