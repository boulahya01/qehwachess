import { ReactNode } from 'react';
import { useLanguage } from '@/context/LanguageContext';
export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="auth-layout">
      <aside className="auth-story" aria-label={t('Find your community')}>
        <img
          src="/images/chess-community-v2.webp"
          alt={t('Friends enjoying a game of chess at a café')}
          width={960}
          height={640}
        />
        <h2>{t('Good games. Better company.')}</h2>
        <p>{t('Your tournaments, your people, and your next game. All in one place.')}</p>
      </aside>
      <div className="auth-panel">{children}</div>
    </div>
  );
}
