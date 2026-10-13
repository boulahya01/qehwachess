import { ReactNode } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Link } from '@/context/RouterContext';
import { ArrowRight } from 'lucide-react';
export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="auth-layout auth-upgrade">
      <aside className="auth-story" aria-label={t('Find your community')}>
        <img
          src="/images/chess-community-v2.webp"
          alt={t('Friends enjoying a game of chess at a café')}
          width={960}
          height={640}
          loading="lazy"
        />
        <div className="auth-story-copy">
          <p className="auth-eyebrow">{t('Made for over-the-board moments')}</p>
          <h2>
            {t('Good games.')}
            <span>{t('Better company.')}</span>
          </h2>
          <p>
            {t(
              'Your tournaments, your people, and your next game. All in one place.'
            )}
          </p>
          <Link to={{ name: 'home' }} className="text-link">
            {t('Explore first')}
            <ArrowRight size={17} className="direction-arrow" />
          </Link>
        </div>
      </aside>
      <div className="auth-panel">{children}</div>
    </div>
  );
}
