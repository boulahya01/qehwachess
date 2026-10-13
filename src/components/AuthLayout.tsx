import { ReactNode } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Link } from '@/context/RouterContext';
import { ArrowRight } from 'lucide-react';
export function AuthLayout({
  children,
  entry = false,
}: {
  children: ReactNode;
  entry?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className={`auth-layout ${entry ? 'auth-entry-layout' : 'auth-calm'}`}>
      {entry && (
        <aside
          className="auth-entry-story"
          aria-label={t('Qehwa Chess community')}
        >
          <img
            src="/images/chess-community-v2.webp"
            loading="lazy"
            width={960}
            height={640}
            alt=""
          />
          <div className="auth-entry-story-copy">
            <h2>
              {t('Good games.')}
              <span>{t('Better company.')}</span>
            </h2>
            <p>{t('Find your next game, and the people to share it with.')}</p>
            <Link to={{ name: 'meetups' }} className="text-link">
              {t('Explore first')}
              <ArrowRight
                size={17}
                className="direction-arrow"
                aria-hidden="true"
              />
            </Link>
          </div>
        </aside>
      )}
      <div className="auth-panel">
        {children}
        <nav className="auth-legal" aria-label={t('Legal information')}>
          <a href="/privacy/">{t('Privacy')}</a>
          <a href="/terms/">{t('Terms')}</a>
        </nav>
      </div>
    </div>
  );
}
