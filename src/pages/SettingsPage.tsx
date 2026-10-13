import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import type { Language } from '@/context/LanguageContext';
import { useWorkspaceLanguage as useLanguage } from '@/hooks/useWorkspaceLanguage';
import { useTheme } from '@/context/ThemeContext';
import { useEffect } from 'react';
import { UserRound, KeyRound, Palette, ArrowRight } from 'lucide-react';

export function SettingsPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const { t, language, chooseLanguage, languageNames } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  useEffect(() => {
    if (!user) navigate({ name: 'signin' });
  }, [user, navigate]);
  if (!user) return null;
  return (
    <div className="v2-container account-page settings-home">
      <header className="workspace-heading">
        <div>
          <p className="hero-eyebrow">{t('Your account')}</p>
          <h1>{t('Settings')}</h1>
          <p>{t('Your profile, sign-in and display preferences.')}</p>
        </div>
      </header>
      <section className="account-section">
        <h2>{t('Profile and privacy')}</h2>
        <Link to={{ name: 'profile' }} className="account-row">
          <UserRound size={24} />
          <div className="flex-1">
            <h3>{t('Edit profile')}</h3>
            <p className="field-hint">
              {t(
                'Public identity, optional chess accounts and private contact details.'
              )}
            </p>
          </div>
          <ArrowRight size={18} />
        </Link>
        <Link
          to={{ name: 'publicProfile', id: user.id }}
          className="text-link mt-4"
        >
          {t('View public profile')}
        </Link>
      </section>
      <section className="account-section">
        <h2>{t('Sign-in & security')}</h2>
        <Link to={{ name: 'security' }} className="account-row">
          <KeyRound size={24} />
          <div className="flex-1">
            <h3>{t('Manage sign-in')}</h3>
            <p className="field-hint">
              {t('Email, password, connected providers and sessions.')}
            </p>
          </div>
          <ArrowRight size={18} />
        </Link>
      </section>
      <section className="account-section">
        <h2 className="flex items-center gap-2">
          <Palette size={22} />
          {t('Appearance')}
        </h2>
        <div className="settings-controls">
          <label htmlFor="settings-language">
            {t('Language')}
            <select
              id="settings-language"
              className="auth-input"
              value={language}
              onChange={(e) => chooseLanguage(e.target.value as Language)}
            >
              {(['en', 'fr', 'ar'] as const).map((value) => (
                <option key={value} value={value}>
                  {languageNames[value]}
                </option>
              ))}
            </select>
          </label>
          <div>
            <p>{t('Theme')}</p>
            <button
              type="button"
              className="action action-secondary mt-2"
              onClick={toggleTheme}
            >
              {t(
                theme === 'dark'
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              )}
            </button>
          </div>
        </div>
        <p className="field-hint mt-3">
          {t('Display preferences are saved on this browser.')}
        </p>
      </section>
      <div className="flex flex-wrap gap-5">
        <a href="/privacy/" className="text-link">
          {t('Privacy')}
        </a>
        <a href="/terms/" className="text-link">
          {t('Terms')}
        </a>
      </div>
    </div>
  );
}
