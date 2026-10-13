import { useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Link } from '@/context/RouterContext';
import { useLanguage } from '@/context/LanguageContext';
import { AuthLayout } from '@/components/AuthLayout';
import { PasswordInput } from '@/components/ui/PasswordInput';
import {
  AuthHeading,
  AuthMessage,
  AuthSubmit,
} from '@/components/auth/AuthParts';
import { authError } from '@/lib/authFlow';

export function ResetPasswordPage() {
  const { t } = useLanguage();
  const { user, recoveryReady, updatePassword, finishRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await updatePassword(password);
      if (result.error) setError(result.error);
      else {
        setPassword('');
        setConfirm('');
        finishRecovery();
        setDone(true);
      }
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setPending(false);
    }
  }
  return (
    <AuthLayout>
      {done ? (
        <>
          <span className="auth-state-icon">
            <Check size={32} aria-hidden="true" />
          </span>
          <AuthHeading
            eyebrow="Ready to play"
            title="Password updated"
            description="Your new password is ready. You can continue with your account."
          />
          <Link
            to={{ name: 'dashboard' }}
            className="action action-link action-primary auth-submit"
          >
            {t('Continue to my account')}
          </Link>
        </>
      ) : !user || !recoveryReady ? (
        <>
          <AuthHeading
            eyebrow="Let’s get you back"
            title="Request a fresh link"
            description="Open the latest password reset email in the same browser where you requested it."
          />
          <Link
            to={{ name: 'forgotPassword' }}
            className="action action-link action-primary auth-submit"
          >
            {t('Send a new reset link')}
          </Link>
          <Link to={{ name: 'signin' }} className="auth-back-link">
            {t('Back to sign in')}
          </Link>
        </>
      ) : (
        <>
          <AuthHeading
            eyebrow="A fresh start"
            title="Choose a new password"
            description="Make it memorable for you and difficult to guess."
          />
          <AuthMessage message={error} />
          <form className="auth-form" onSubmit={submit} aria-busy={pending}>
            <div className="auth-field">
              <label htmlFor="reset-password">{t('New password')}</label>
              <PasswordInput
                id="reset-password"
                value={password}
                onChange={setPassword}
                newPassword
              />
            </div>
            <div className="auth-field">
              <label htmlFor="reset-confirm">{t('Confirm new password')}</label>
              <PasswordInput
                id="reset-confirm"
                value={confirm}
                onChange={setConfirm}
                newPassword
              />
            </div>
            <AuthSubmit pending={pending} label="Save new password" />
          </form>
        </>
      )}
    </AuthLayout>
  );
}
