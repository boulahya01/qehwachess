import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { AuthLayout } from '@/components/AuthLayout';
import { PasswordInput } from '@/components/ui/PasswordInput';
import {
  AuthHeading,
  AuthMessage,
  AuthSubmit,
  SocialAuthButtons,
  InboxState,
} from './AuthParts';
import { authError } from '@/lib/authFlow';

export function AuthEntry({ mode }: { mode: 'signin' | 'signup' }) {
  const signup = mode === 'signup';
  const { t } = useLanguage();
  const { route, navigate } = useRouter();
  const tournamentId = route.name === mode ? route.tournamentId : undefined;
  const { signIn, signUp, resendSignupConfirmation } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const result = signup
        ? await signUp(email, password, tournamentId)
        : await signIn(email, password);
      if (result.error) setError(result.error);
      else if (
        signup &&
        'confirmationRequired' in result &&
        result.confirmationRequired
      ) {
        setPassword('');
        setConfirmation(true);
        setCooldown(60);
      } else
        navigate(
          tournamentId
            ? { name: 'tournament', id: tournamentId }
            : { name: 'dashboard' }
        );
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setPending(false);
    }
  }
  async function resend() {
    if (pending || cooldown > 0) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await resendSignupConfirmation(email, tournamentId);
      if (result.error) setError(result.error);
      else {
        setNotice('If confirmation is needed, a new link is on its way.');
        setCooldown(60);
      }
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setPending(false);
    }
  }
  return (
    <AuthLayout>
      {confirmation ? (
        <InboxState
          title="Check your email"
          description="If this address needs confirmation, follow the link in your email to continue."
          email={email}
        >
          <AuthMessage message={error} />
          <AuthMessage message={notice} success />
          <button
            type="button"
            className="action action-primary auth-submit"
            disabled={pending || cooldown > 0}
            onClick={resend}
          >
            {t('Resend confirmation email')}
            {cooldown > 0 && <span aria-live="off"> ({cooldown}s)</span>}
          </button>
          <button
            type="button"
            className="auth-text-button"
            onClick={() => {
              setConfirmation(false);
              setError(null);
              setNotice(null);
            }}
          >
            {t('Use a different email')}
          </button>
          <Link to={{ name: 'signin', tournamentId }} className="text-link">
            {t('Already confirmed? Sign in')}
          </Link>
        </InboxState>
      ) : (
        <>
          <AuthHeading
            eyebrow={
              signup ? 'Your community starts here' : 'Your next game awaits'
            }
            title={signup ? 'Join Qehwa Chess' : 'Welcome back'}
            description={
              signup
                ? 'One account to play, meet people, and organize events.'
                : 'Your games, your people. Pick up where you left off.'
            }
          />
          <SocialAuthButtons tournamentId={tournamentId} />
          <AuthMessage message={error} />
          {error === 'Confirm your email before signing in.' && (
            <button
              type="button"
              className="auth-text-button"
              onClick={() => {
                setConfirmation(true);
                setPassword('');
              }}
            >
              {t('Resend confirmation email')}
            </button>
          )}
          <form onSubmit={submit} className="auth-form" aria-busy={pending}>
            <div className="auth-field">
              <label htmlFor={`${mode}-email`}>{t('Email')}</label>
              <input
                id={`${mode}-email`}
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="auth-input"
              />
            </div>
            <div className="auth-field">
              <div className="auth-label-row">
                <label htmlFor={`${mode}-password`}>{t('Password')}</label>
                {!signup && (
                  <Link to={{ name: 'forgotPassword', tournamentId }}>
                    {t('Forgot password?')}
                  </Link>
                )}
              </div>
              <PasswordInput
                id={`${mode}-password`}
                value={password}
                onChange={setPassword}
                newPassword={signup}
              />
              {signup && (
                <p className="auth-field-hint">
                  {t('Use at least 8 characters. A longer phrase works well.')}
                </p>
              )}
            </div>
            <AuthSubmit
              pending={pending}
              label={signup ? 'Create account' : 'Sign in'}
            />
          </form>
          {signup && (
            <p className="auth-footnote">
              {t('Add your city and chess profiles whenever you want.')}
            </p>
          )}
          <p className="auth-switch">
            {t(signup ? 'Already have an account?' : 'New to Qehwa Chess?')}{' '}
            <Link to={{ name: signup ? 'signin' : 'signup', tournamentId }}>
              {t(signup ? 'Sign in' : 'Create an account')}
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
