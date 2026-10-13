import { useState } from 'react';
import {
  ArrowLeft,
  KeyRound,
  Mail,
  Link2,
  LogOut,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Link, useRouter } from '@/context/RouterContext';
import { useLanguage } from '@/context/LanguageContext';
import { PasswordInput } from '@/components/ui/PasswordInput';
import {
  AuthMessage,
  AuthSubmit,
  SocialAuthButtons,
} from '@/components/auth/AuthParts';
import { authError } from '@/lib/authFlow';

export function SecurityPage() {
  const { t } = useLanguage();
  const { user, updateEmail, updatePassword, signOut } = useAuth();
  const { navigate } = useRouter();
  const [editing, setEditing] = useState<'email' | 'password' | null>(null);
  const [email, setEmail] = useState('');
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hasEmail = user?.identities?.some(
    (identity) => identity.provider === 'email'
  );
  const connectedProviders =
    user?.identities
      ?.filter(
        (identity) =>
          identity.provider === 'google' || identity.provider === 'discord'
      )
      .map((identity) => identity.provider) ?? [];
  if (!user)
    return (
      <div className="v2-container account-security">
        <h1>{t('Your account, in one place.')}</h1>
        <p>{t('Sign in to manage your account security.')}</p>
        <Link
          to={{ name: 'signin' }}
          className="action action-link action-primary"
        >
          {t('Sign in')}
        </Link>
      </div>
    );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setNotice(null);
    if (editing === 'password' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (
      editing === 'email' &&
      email.trim().toLowerCase() === user!.email?.toLowerCase()
    ) {
      setError('Enter a different email address.');
      return;
    }
    setPending(true);
    try {
      const result =
        editing === 'email'
          ? await updateEmail(email)
          : await updatePassword(password, hasEmail ? current : undefined);
      if (result.error) setError(result.error);
      else {
        setNotice(
          editing === 'email'
            ? 'Check your email to confirm the change. Your current address stays active until confirmation.'
            : 'Password updated.'
        );
        setEditing(null);
        setPassword('');
        setConfirm('');
        setCurrent('');
      }
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setPending(false);
    }
  }
  function edit(value: 'email' | 'password') {
    setEditing(value);
    setError(null);
    setNotice(null);
    setPassword('');
    setConfirm('');
    setCurrent('');
  }
  return (
    <div className="v2-container account-security">
      <Link to={{ name: 'profile' }} className="text-link">
        <ArrowLeft size={16} className="direction-arrow" />
        {t('Back to profile')}
      </Link>
      <header className="security-heading">
        <p className="auth-eyebrow">{t('Account settings')}</p>
        <h1>{t('Sign-in & security')}</h1>
        <p>{t('Simple controls for how you access your account.')}</p>
      </header>
      <AuthMessage message={error} />
      <AuthMessage message={notice} success />
      <section className="security-section" aria-labelledby="email-heading">
        <span className="security-section-icon">
          <Mail size={22} />
        </span>
        <div>
          <h2 id="email-heading">{t('Email address')}</h2>
          <p className="security-detail" dir="ltr">
            {user.email}
          </p>
          <p>{t('Use this address to sign in and receive account emails.')}</p>
          {user.new_email && (
            <p role="status">
              {t('Pending confirmation')}: <b dir="ltr">{user.new_email}</b>
            </p>
          )}
          {editing === 'email' ? (
            <form onSubmit={submit} className="auth-form">
              <div className="auth-field">
                <label htmlFor="change-email">{t('New email address')}</label>
                <input
                  id="change-email"
                  className="auth-input"
                  type="email"
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <p className="auth-field-hint">
                {t(
                  'You may need to confirm from both your old and new inboxes.'
                )}
              </p>
              <div className="security-form-actions">
                <AuthSubmit pending={pending} label="Send confirmation" />
                <button
                  className="auth-text-button"
                  type="button"
                  disabled={pending}
                  onClick={() => setEditing(null)}
                >
                  {t('Cancel')}
                </button>
              </div>
            </form>
          ) : (
            <button
              className="text-link"
              type="button"
              onClick={() => edit('email')}
            >
              {t('Change email')}
              <ArrowRight size={16} className="direction-arrow" />
            </button>
          )}
        </div>
      </section>
      <section className="security-section" aria-labelledby="password-heading">
        <span className="security-section-icon">
          <KeyRound size={22} />
        </span>
        <div>
          <h2 id="password-heading">{t('Password')}</h2>
          <p>{t('Use a long, memorable password you do not use elsewhere.')}</p>
          {editing === 'password' ? (
            <form onSubmit={submit} className="auth-form">
              {hasEmail && (
                <div className="auth-field">
                  <label htmlFor="current-password">
                    {t('Current password')}
                  </label>
                  <PasswordInput
                    id="current-password"
                    value={current}
                    onChange={setCurrent}
                  />
                </div>
              )}
              <div className="auth-field">
                <label htmlFor="change-password">{t('New password')}</label>
                <PasswordInput
                  id="change-password"
                  value={password}
                  onChange={setPassword}
                  newPassword
                />
              </div>
              <div className="auth-field">
                <label htmlFor="change-confirm">
                  {t('Confirm new password')}
                </label>
                <PasswordInput
                  id="change-confirm"
                  value={confirm}
                  onChange={setConfirm}
                  newPassword
                />
              </div>
              <div className="security-form-actions">
                <AuthSubmit pending={pending} label="Save new password" />
                <button
                  className="auth-text-button"
                  type="button"
                  disabled={pending}
                  onClick={() => setEditing(null)}
                >
                  {t('Cancel')}
                </button>
              </div>
              <Link to={{ name: 'forgotPassword' }} className="text-link">
                {t('Forgot password?')}
              </Link>
            </form>
          ) : (
            <button
              className="text-link"
              type="button"
              onClick={() => edit('password')}
            >
              {t(hasEmail ? 'Change password' : 'Add a password')}
              <ArrowRight size={16} className="direction-arrow" />
            </button>
          )}
        </div>
      </section>
      {(connectedProviders.length > 0 ||
        import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true' ||
        import.meta.env.VITE_DISCORD_AUTH_ENABLED === 'true') && (
        <section
          className="security-section"
          aria-labelledby="connected-heading"
        >
          <span className="security-section-icon">
            <Link2 size={22} />
          </span>
          <div>
            <h2 id="connected-heading">{t('Connected sign-in')}</h2>
            <p>{t('Keep your sign-in methods connected to this account.')}</p>
            {connectedProviders.map((provider) => (
              <p key={provider} className="security-detail">
                {provider === 'google' ? 'Google' : 'Discord'} ·{' '}
                {t('Connected')}
              </p>
            ))}
            <SocialAuthButtons link exclude={connectedProviders} />
          </div>
        </section>
      )}
      <section className="security-section">
        <span className="security-section-icon">
          <LogOut size={22} />
        </span>
        <div>
          <h2>{t('Sign out')}</h2>
          <p>{t('Sign out of this browser when you are done.')}</p>
          <button
            className="text-link"
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              try {
                await signOut();
                navigate({ name: 'home' });
              } catch (caught) {
                setError(authError(caught));
              } finally {
                setPending(false);
              }
            }}
          >
            {t('Sign out')}
          </button>
        </div>
      </section>
    </div>
  );
}
