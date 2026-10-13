import { useEffect, useRef, useState } from 'react';
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
import { supabase } from '@/lib/supabase';
import { useAuthCapabilities } from '@/hooks/useAuthCapabilities';
import { Field } from '@/components/ui/Field';
import { ProviderIcon } from '@/components/auth/ProviderIcon';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

export function SecurityPage() {
  const { t } = useLanguage();
  const { user, updateEmail, updatePassword, signOut } = useAuth();
  const { navigate, confirmLeave } = useRouter();
  const [editing, setEditing] = useState<'email' | 'password' | null>(null);
  const [email, setEmail] = useState('');
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<'global' | string | null>(
    null
  );
  const confirmationRegion = useRef<HTMLElement>(null);
  const confirmationTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (confirmation) confirmationRegion.current?.focus();
  }, [confirmation]);
  function requestConfirmation(value: string, trigger: HTMLButtonElement) {
    confirmationTrigger.current = trigger;
    setConfirmation(value);
  }
  function cancelConfirmation() {
    setConfirmation(null);
    confirmationTrigger.current?.focus();
  }
  const capabilities = useAuthCapabilities(user?.id);
  const hasPassword = capabilities.hasPassword;
  const allowLeave = useUnsavedChanges(
    Boolean(editing && (email || current || password || confirm))
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
          : await updatePassword(password, hasPassword ? current : undefined);
      if (result.error) setError(result.error);
      else {
        allowLeave();
        capabilities.refresh();
        setNotice(
          editing === 'email'
            ? 'Email change requested. Check your inboxes for any confirmation steps.'
            : 'Password updated.'
        );
        setEditing(null);
        setEmail('');
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
    if (editing && editing !== value && !confirmLeave()) return;
    setEditing(value);
    setError(null);
    setNotice(null);
    setPassword('');
    setConfirm('');
    setCurrent('');
    setEmail('');
  }
  function cancelEdit() {
    setEditing(null);
    setEmail('');
    setCurrent('');
    setPassword('');
    setConfirm('');
    setError(null);
  }
  async function confirmAction() {
    if (!confirmation || pending) return;
    if (confirmation === 'global' && !confirmLeave()) return;
    setPending(true);
    setError(null);
    try {
      if (confirmation === 'global') {
        allowLeave();
        await signOut('global');
        navigate({ name: 'home' });
      } else {
        const { data, error: identityError } =
          await supabase.auth.getUserIdentities();
        if (identityError) throw identityError;
        const identity = data.identities.find(
          (item) => item.provider === confirmation
        );
        const remaining = data.identities.filter(
          (item) =>
            ['google', 'discord'].includes(item.provider) &&
            item.provider !== confirmation
        );
        if (!identity || (!capabilities.hasPassword && !remaining.length))
          throw new Error('Keep a usable sign-in method before disconnecting.');
        const { error: unlinkError } =
          await supabase.auth.unlinkIdentity(identity);
        if (unlinkError) throw unlinkError;
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
        capabilities.refresh();
        setNotice('Sign-in method disconnected.');
      }
      setConfirmation(null);
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="v2-container account-security">
      <Link to={{ name: 'settings' }} className="text-link">
        <ArrowLeft size={16} className="direction-arrow" />
        {t('Settings')}
      </Link>
      <header className="security-heading">
        <p className="auth-eyebrow">{t('Account settings')}</p>
        <h1>{t('Sign-in & security')}</h1>
      </header>
      <AuthMessage message={error} />
      <AuthMessage message={notice} success />
      {capabilities.error && (
        <div className="auth-message is-error" role="alert">
          <span>{t('Could not load security settings.')}</span>
          <button
            type="button"
            className="text-link"
            onClick={capabilities.refresh}
          >
            {t('Retry')}
          </button>
        </div>
      )}
      <section className="security-section" aria-labelledby="email-heading">
        <span className="security-section-icon">
          <Mail size={22} />
        </span>
        <div>
          <h2 id="email-heading">{t('Email address')}</h2>
          <p className="security-detail" dir="ltr">
            {user.email}
          </p>
          {user.new_email && (
            <p role="status">
              {t('Pending confirmation')}: <b dir="ltr">{user.new_email}</b>
            </p>
          )}
          {editing === 'email' ? (
            <form onSubmit={submit} className="auth-form">
              <div className="auth-field">
                <label htmlFor="change-email">{t('New email address')}</label>
                <Field>
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
                    dir="ltr"
                  />
                </Field>
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
                  onClick={cancelEdit}
                >
                  {t('Cancel')}
                </button>
              </div>
            </form>
          ) : (
            <button
              className="text-link"
              type="button"
              disabled={pending}
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
          <p>
            {t(
              hasPassword === null
                ? 'Loading...'
                : hasPassword
                  ? 'Password available'
                  : 'No password added'
            )}
          </p>
          {editing === 'password' ? (
            <form onSubmit={submit} className="auth-form">
              {hasPassword && (
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
                  match={password}
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
                  onClick={cancelEdit}
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
              disabled={hasPassword === null || pending}
              onClick={() => edit('password')}
            >
              {t(
                hasPassword === null
                  ? 'Loading...'
                  : hasPassword
                    ? 'Change password'
                    : 'Add a password'
              )}
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
            {connectedProviders.map((provider) => (
              <div key={provider} className="security-provider">
                <span>
                  <ProviderIcon provider={provider as 'google' | 'discord'} />
                  <span>
                    {provider === 'google' ? 'Google' : 'Discord'}
                    <small>{t('Connected')}</small>
                  </span>
                </span>
                <button
                  type="button"
                  className="auth-text-button text-danger"
                  disabled={
                    pending ||
                    hasPassword === null ||
                    (!hasPassword && connectedProviders.length < 2)
                  }
                  onClick={(event) =>
                    requestConfirmation(provider, event.currentTarget)
                  }
                >
                  {t('Disconnect')}
                </button>
              </div>
            ))}
            {!hasPassword && connectedProviders.length === 1 && (
              <p className="field-hint">
                {t('Add another sign-in method before disconnecting.')}
              </p>
            )}
            <SocialAuthButtons
              link
              exclude={connectedProviders}
              disabled={pending}
              onPendingChange={setPending}
            />
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
          <div className="security-form-actions">
            <button
              className="action action-danger"
              type="button"
              disabled={pending}
              onClick={async () => {
                if (!confirmLeave()) return;
                setPending(true);
                setError(null);
                try {
                  allowLeave();
                  await signOut('local');
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
            <button
              className="auth-text-button text-danger"
              type="button"
              disabled={pending}
              onClick={(event) =>
                requestConfirmation('global', event.currentTarget)
              }
            >
              {t('Sign out everywhere')}
            </button>
          </div>
        </div>
      </section>
      {confirmation && (
        <section
          ref={confirmationRegion}
          tabIndex={-1}
          className="security-confirm"
          role="region"
          aria-label={t('Confirm account action')}
        >
          <h2>
            {t(
              confirmation === 'global'
                ? 'Sign out everywhere?'
                : 'Disconnect this sign-in method?'
            )}
          </h2>
          <p>
            {t(
              confirmation === 'global'
                ? 'Other sessions lose access when their current access tokens expire.'
                : 'You will need another sign-in method to access this account.'
            )}
          </p>
          <div className="security-form-actions">
            <button
              className="action action-danger"
              disabled={pending}
              type="button"
              onClick={() => void confirmAction()}
            >
              {t(pending ? 'Please wait...' : 'Confirm')}
            </button>
            <button
              className="auth-text-button"
              disabled={pending}
              type="button"
              onClick={cancelConfirmation}
            >
              {t('Cancel')}
            </button>
          </div>
        </section>
      )}
      <section className="security-section">
        <div>
          <h2>{t('Your data')}</h2>
          <p>
            {t(
              'For account deletion, email us from your account address. We will review your request and confirm when it is completed.'
            )}
          </p>
          <a
            className="text-link text-danger"
            href="mailto:marwaneboulahya@gmail.com?subject=Qehwa%20Chess%20account%20deletion"
          >
            {t('Email a deletion request')}
          </a>
          <p className="field-hint">
            {t(
              'Opens your email app. Your request is sent only when you send the email.'
            )}
          </p>
          <a href="/privacy/" className="text-link">
            {t('Privacy')}
          </a>
        </div>
      </section>
    </div>
  );
}
