import { useState } from 'react';
import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { useCities } from '@/hooks/useData';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Mail, User, AlertCircle, ArrowRight, Trophy, Building2 } from 'lucide-react';
import { UserRole } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import { AuthLayout } from '@/components/AuthLayout';
import { PasswordInput } from '@/components/ui/PasswordInput';

export function SignUpPage() {
  const { t } = useLanguage();
  const { route, navigate } = useRouter();
  const tournamentId = route.name === 'signup' ? route.tournamentId : undefined;
  const { signUp } = useAuth();
  const { cities } = useCities();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('player');
  const [cityId, setCityId] = useState('');
  const [lichessUsername, setLichessUsername] = useState('');
  const [chesscomUsername, setChesscomUsername] = useState('');
  const [fideId, setFideId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!fullName.trim()) {
        setError('Full name is required.');
        setLoading(false);
        return;
      }
      if (!cityId) {
        setError('City is required.');
        setLoading(false);
        return;
      }
      const normalizedUsername = username.trim().replace(/^@/, '');
      const lichess = lichessUsername.trim().replace(/^@/, '');
      const chesscom = chesscomUsername.trim().replace(/^@/, '');
      const fide = fideId.trim();
      if (!/^[A-Za-z0-9_]{3,24}$/.test(normalizedUsername)) {
        setError('Username must be 3–24 letters, numbers, or underscores.');
        setLoading(false);
        return;
      }
      if (!lichess && !chesscom && !fide) {
        setError('Enter at least one Chess.com, Lichess, or FIDE ID.');
        setLoading(false);
        return;
      }
      const result = await signUp(email, password, fullName.trim(), role, cityId, {
        username: normalizedUsername,
        lichessUsername: lichess,
        chesscomUsername: chesscom,
        fideId: fide,
      });
      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else if (result.confirmationRequired) {
        setNotice('Account created. Check your email for a confirmation link before signing in.');
        setLoading(false);
      } else {
        navigate(tournamentId ? { name: 'tournament', id: tournamentId } : { name: 'dashboard' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account creation failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">{t('Join Qehwa Chess')}</h1>
          <p className="text-gray-500 mt-2">
            {t('Create your account and start discovering tournaments')}
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 p-3 rounded-lg bg-error-500/10 border border-error-500/20 text-error-400 text-sm mb-4"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {t(error)}
            </div>
          )}
          {notice && (
            <div
              role="status"
              className="flex items-center gap-2 p-3 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm mb-4"
            >
              {t(notice)}
            </div>
          )}

          {/* Role selector */}
          <div className="mb-5">
            <label className="text-sm font-medium text-gray-400 mb-2 block">
              {t('I want to...')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                aria-pressed={role === 'player'}
                onClick={() => setRole('player')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  role === 'player'
                    ? 'bg-brand-500/10 border-brand-500/40'
                    : 'bg-surface-800 border-surface-700 hover:border-surface-600'
                }`}
              >
                <Trophy
                  className={`w-5 h-5 mb-2 ${role === 'player' ? 'text-brand-400' : 'text-gray-500'}`}
                />
                <p className="text-sm font-bold text-white">{t('Play')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('Find & join tournaments')}</p>
              </button>
              <button
                type="button"
                aria-pressed={role === 'organizer'}
                onClick={() => setRole('organizer')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  role === 'organizer'
                    ? 'bg-brand-500/10 border-brand-500/40'
                    : 'bg-surface-800 border-surface-700 hover:border-surface-600'
                }`}
              >
                <Building2
                  className={`w-5 h-5 mb-2 ${role === 'organizer' ? 'text-brand-400' : 'text-gray-500'}`}
                />
                <p className="text-sm font-bold text-white">{t('Organize')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('Publish tournaments')}</p>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="signup-name"
                className="text-sm font-medium text-gray-400 mb-1.5 block"
              >
                {t('Full Name')} *
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  id="signup-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('Your name')}
                  className="w-full pl-11 pr-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="signup-username"
                className="text-sm font-medium text-gray-400 mb-1.5 block"
              >
                {t('Player username')} *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={24}
                  pattern="[A-Za-z0-9_]{3,24}"
                  autoComplete="username"
                  id="signup-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('3–24 letters, numbers, or underscores')}
                  className="w-full pl-11 pr-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="signup-email"
                className="text-sm font-medium text-gray-400 mb-1.5 block"
              >
                {t('Email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  id="signup-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-11 pr-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="signup-password"
                className="text-sm font-medium text-gray-400 mb-1.5 block"
              >
                {t('Password')}
              </label>
              <PasswordInput
                id="signup-password"
                value={password}
                onChange={setPassword}
                newPassword
              />
            </div>
            <div>
              <label
                htmlFor="signup-city"
                className="text-sm font-medium text-gray-400 mb-1.5 block"
              >
                {t('City')} *
              </label>
              <select
                required
                id="signup-city"
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white focus:outline-none focus:border-brand-500 transition-colors"
              >
                <option value="">{t('Select your city')}</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="border-t border-surface-700 pt-4">
              <div className="mb-3">
                <label className="text-sm font-medium text-gray-200">
                  {t('Link at least one chess account')} *
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  {t(
                    'Add a Chess.com username, Lichess username, or FIDE ID. Ratings are not verified during sign-up.'
                  )}
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label htmlFor="signup-lichess" className="text-xs font-medium text-gray-400">
                    Lichess
                  </label>
                  <input
                    id="signup-lichess"
                    value={lichessUsername}
                    onChange={(e) => setLichessUsername(e.target.value)}
                    maxLength={50}
                    autoComplete="off"
                    className="mt-1 w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
                    placeholder="e.g. magnus"
                  />
                </div>
                <div>
                  <label htmlFor="signup-chesscom" className="text-xs font-medium text-gray-400">
                    Chess.com
                  </label>
                  <input
                    id="signup-chesscom"
                    value={chesscomUsername}
                    onChange={(e) => setChesscomUsername(e.target.value)}
                    maxLength={50}
                    autoComplete="off"
                    className="mt-1 w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
                    placeholder="e.g. hikaru"
                  />
                </div>
                <div>
                  <label htmlFor="signup-fide" className="text-xs font-medium text-gray-400">
                    {t('FIDE ID')}
                  </label>
                  <input
                    id="signup-fide"
                    value={fideId}
                    onChange={(e) => setFideId(e.target.value)}
                    maxLength={20}
                    autoComplete="off"
                    className="mt-1 w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
                    placeholder="e.g. 1503014"
                  />
                </div>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? t('Creating account...') : t('Create Account')}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>

          <p className="text-sm text-gray-500 text-center mt-6">
            {t('Already have an account?')}{' '}
            <Link
              to={{ name: 'signin', tournamentId }}
              className="text-brand-400 hover:underline font-medium"
            >
              {t('Sign In')}
            </Link>
          </p>
        </Card>
      </div>
    </AuthLayout>
  );
}
