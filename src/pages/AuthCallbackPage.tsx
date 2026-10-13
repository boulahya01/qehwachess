import { Check, Link2Off, MailCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Link, useRouter } from '@/context/RouterContext';
import { useLanguage } from '@/context/LanguageContext';
import { AuthLayout } from '@/components/AuthLayout';
import { AuthHeading, AuthMessage } from '@/components/auth/AuthParts';

export function AuthCallbackPage() {
  const { t } = useLanguage();
  const { user, loading, error, recoveryReady } = useAuth();
  const { route } = useRouter();
  const tournamentId =
    route.name === 'authCallback' ? route.tournamentId : undefined;
  const flow = new URLSearchParams(window.location.search).get('flow');
  if (loading)
    return (
      <AuthLayout>
        <AuthHeading
          eyebrow="One moment"
          title="Getting your account ready"
          description="We are checking your link. You will be ready to continue shortly."
        />
        <div
          className="auth-progress"
          role="status"
          aria-label={t('Loading')}
        />
      </AuthLayout>
    );
  const ready = Boolean(user && !error);
  const oauth = flow === 'oauth' || flow === 'link' || flow === 'google';
  if (!user && !error && flow === 'email_change')
    return (
      <AuthLayout>
        <span className="auth-state-icon">
          <MailCheck size={32} aria-hidden="true" />
        </span>
        <AuthHeading
          eyebrow="Your next move"
          title="Check your other inbox"
          description="Email confirmation received. Complete the link in your other inbox to finish the change."
        />
        <Link
          to={{ name: 'signin' }}
          className="action action-link action-primary auth-submit"
        >
          {t('Back to sign in')}
        </Link>
      </AuthLayout>
    );
  return (
    <AuthLayout>
      <span className="auth-state-icon">
        {ready ? (
          <Check size={32} aria-hidden="true" />
        ) : (
          <Link2Off size={32} aria-hidden="true" />
        )}
      </span>
      <AuthHeading
        eyebrow={ready ? 'Your next move' : 'Let’s try again'}
        title={
          ready
            ? recoveryReady
              ? 'Choose a new password'
              : flow === 'email_change' || flow === 'link'
                ? flow === 'link'
                  ? 'Sign-in method connected'
                  : 'Email confirmation received'
                : 'You’re ready to play'
            : oauth
              ? 'Sign-in was not completed'
              : 'This link could not be used'
        }
        description={
          ready
            ? 'Continue with your account. Your games and profile are in one place.'
            : oauth
              ? 'Return to sign in and choose a method to continue. Your existing account is still there.'
              : 'Request a fresh link and open it in the same browser. Your existing account is still there.'
        }
      />
      <AuthMessage message={error} />
      {ready ? (
        <Link
          to={
            recoveryReady
              ? { name: 'resetPassword' }
              : flow === 'email_change' || flow === 'link'
                ? { name: 'security' }
                : tournamentId
                  ? { name: 'tournament', id: tournamentId }
                  : { name: 'dashboard' }
          }
          className="action action-link action-primary auth-submit"
        >
          {t(
            recoveryReady
              ? 'Choose a new password'
              : tournamentId
                ? 'Return to tournament'
                : 'Continue to my account'
          )}
        </Link>
      ) : (
        <>
          <Link
            to={{
              name: flow === 'recovery' ? 'forgotPassword' : 'signin',
              tournamentId,
            }}
            className="action action-link action-primary auth-submit"
          >
            {t(
              flow === 'recovery' ? 'Send a new reset link' : 'Back to sign in'
            )}
          </Link>
          <Link
            to={{ name: 'signup', tournamentId }}
            className="auth-back-link"
          >
            {t('Create an account')}
          </Link>
        </>
      )}
    </AuthLayout>
  );
}
