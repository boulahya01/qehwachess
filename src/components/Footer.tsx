import { Link } from '@/context/RouterContext';
import { Crown } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <div className="v2-container">
        <div className="footer-top">
          <div>
            <Link to={{ name: 'home' }} className="brand-lockup">
              <span className="brand-symbol">
                <Crown size={19} strokeWidth={1.7} />
              </span>
              Qehwa Chess
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed">
              {t('Built for the Moroccan chess community')}
            </p>
          </div>
          <nav aria-label={t('Explore')} className="footer-links">
            <Link to={{ name: 'tournaments' }}>{t('Tournaments')}</Link>
            <Link to={{ name: 'meetups' }}>{t('Casual Meetups')}</Link>
            <Link to={{ name: 'clubs' }}>{t('Clubs')}</Link>
            <Link to={{ name: 'cities' }}>{t('Cities')}</Link>
          </nav>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Qehwa Chess</p>
          <p>{t('Find your people. Play over the board.')}</p>
        </div>
      </div>
    </footer>
  );
}
