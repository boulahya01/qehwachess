import { useState } from 'react';
import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { AuthLayout } from '@/components/AuthLayout';
import {
  AuthHeading,
  AuthMessage,
  AuthSubmit,
  InboxState,
} from '@/components/auth/AuthParts';
import { authError } from '@/lib/authFlow';

export function ForgotPasswordPage() {
  const { t } = useLanguage();
  const { route } = useRouter();
  const tournamentId =
    route.name === 'forgotPassword' ? route.tournamentId : undefined;
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await requestPasswordReset(email, tournamentId);
      if (result.error) setError(result.error);
      else setSent(true);
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setPending(false);
    }
  }
  return (
    <AuthLayout>
      {sent ? (
        <InboxState
          title="Check your email"
          description="If an account exists for this address, you will receive a password reset link."
          email={email}
        >
          <Link
            to={{ name: 'signin', tournamentId }}
            className="action action-primary action-link auth-submit"
          >
            {t('Back to sign in')}
          </Link>
          <button
            className="auth-text-button"
            type="button"
            onClick={() => setSent(false)}
          >
            {t('Use a different email')}
          </button>
        </InboxState>
      ) : (
        <>
          <AuthHeading
            eyebrow="A fresh start"
            title="Forgot your password?"
            description="Enter your email and we will help you get back to your games."
          />
          <AuthMessage message={error} />
          <form className="auth-form" onSubmit={submit} aria-busy={pending}>
            <div className="auth-field">
              <label htmlFor="recovery-email">{t('Email')}</label>
              <input
                id="recovery-email"
                type="email"
                className="auth-input"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <AuthSubmit pending={pending} label="Send reset link" />
          </form>
          <Link
            to={{ name: 'signin', tournamentId }}
            className="auth-back-link"
          >
            {t('Back to sign in')}
          </Link>
        </>
      )}
    </AuthLayout>
  );
}
