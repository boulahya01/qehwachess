import { useState } from 'react';
import { AlertCircle, ArrowRight, Check, MailCheck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { ProviderIcon } from './ProviderIcon';
import { authError } from '@/lib/authFlow';
import { Button } from '@/components/ui/Button';

export function AuthHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  const { t } = useLanguage();
  return (
    <header className="auth-heading">
      <p className="auth-eyebrow">{t(eyebrow)}</p>
      <h1>{t(title)}</h1>
      <p>{t(description)}</p>
    </header>
  );
}
export function AuthMessage({
  message,
  success = false,
}: {
  message: string | null;
  success?: boolean;
}) {
  const { t } = useLanguage();
  if (!message) return null;
  return (
    <div
      className={`auth-message ${success ? 'is-success' : 'is-error'}`}
      role={success ? 'status' : 'alert'}
    >
      {success ? (
        <Check size={18} aria-hidden="true" />
      ) : (
        <AlertCircle size={18} aria-hidden="true" />
      )}
      <span>{t(message)}</span>
    </div>
  );
}
export function SocialAuthButtons({
  tournamentId,
  link = false,
  exclude = [],
}: {
  tournamentId?: string;
  link?: boolean;
  exclude?: string[];
}) {
  const { t } = useLanguage();
  const { signInWithProvider } = useAuth();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const providers = (['google', 'discord'] as const).filter(
    (provider) =>
      !exclude.includes(provider) &&
      (provider === 'google'
        ? import.meta.env.VITE_GOOGLE_AUTH_ENABLED
        : import.meta.env.VITE_DISCORD_AUTH_ENABLED) === 'true'
  );
  if (!providers.length) return null;
  async function connect(provider: 'google' | 'discord') {
    if (pending) return;
    setPending(provider);
    setError(null);
    try {
      const result = await signInWithProvider(provider, tournamentId, link);
      if (result.error) {
        setError(result.error);
        setPending(null);
      }
    } catch (caught) {
      setError(authError(caught));
      setPending(null);
    }
  }
  return (
    <div className="social-auth">
      <div className="social-auth-options">
        {providers.map((provider) => (
          <button
            key={provider}
            className={`action action-secondary social-button provider-${provider}`}
            type="button"
            disabled={Boolean(pending)}
            onClick={() => void connect(provider)}
          >
            <ProviderIcon provider={provider} />
            <span>
              {t(
                pending === provider
                  ? 'Connecting...'
                  : provider === 'google'
                    ? link
                      ? 'Connect Google'
                      : 'Continue with Google'
                    : link
                      ? 'Connect Discord'
                      : 'Continue with Discord'
              )}
            </span>
          </button>
        ))}
      </div>
      <AuthMessage message={error} />
      {!link && (
        <div className="auth-divider">
          <span>{t('or use email')}</span>
        </div>
      )}
    </div>
  );
}
export function InboxState({
  title,
  description,
  email,
  children,
}: {
  title: string;
  description: string;
  email: string;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <section className="inbox-state">
      <span className="auth-state-icon">
        <MailCheck size={32} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <AuthHeading
        eyebrow="Your next move"
        title={title}
        description={description}
      />
      <p className="auth-email-address" dir="ltr">
        {email}
      </p>
      {children}
      <p className="auth-footnote">
        {t('Check your inbox and spam folder. Keep this tab open.')}
      </p>
    </section>
  );
}
export function AuthSubmit({
  pending,
  label,
}: {
  pending: boolean;
  label: string;
}) {
  const { t } = useLanguage();
  return (
    <Button type="submit" className="auth-submit" disabled={pending}>
      {t(pending ? 'Please wait...' : label)}
      <ArrowRight size={18} className="direction-arrow" aria-hidden="true" />
    </Button>
  );
}
