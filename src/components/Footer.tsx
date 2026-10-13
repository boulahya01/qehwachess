import { Link } from '@/context/RouterContext';
import { Crown, Mail } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="bg-surface-950 border-t border-surface-700/50 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-base font-bold text-white">Qehwa Chess</span>
                <span className="text-[10px] text-brand-400 font-medium tracking-wider uppercase">{t('Discover · Play · Compete')}</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 max-w-md leading-relaxed">
              {t('The central platform for chess in Morocco. Discover tournaments across the kingdom, connect with clubs, and compete with the best players in the country.')}
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">{t('Explore')}</h4>
            <div className="flex flex-col gap-2.5">
              <Link to={{ name: 'tournaments' }} className="text-sm text-gray-500 hover:text-brand-400 transition-colors">
                {t('Tournaments')}
              </Link>
              <Link to={{ name: 'meetups' }} className="text-sm text-gray-500 hover:text-brand-400 transition-colors">
                {t('Casual Meetups')}
              </Link>
              <Link to={{ name: 'players' }} className="text-sm text-gray-500 hover:text-brand-400 transition-colors">
                {t('Players')}
              </Link>
              <Link to={{ name: 'map' }} className="text-sm text-gray-500 hover:text-brand-400 transition-colors">
                {t('Event Map')}
              </Link>
              <Link to={{ name: 'clubs' }} className="text-sm text-gray-500 hover:text-brand-400 transition-colors">
                {t('Chess Clubs')}
              </Link>
              <Link to={{ name: 'cities' }} className="text-sm text-gray-500 hover:text-brand-400 transition-colors">
                {t('Cities')}
              </Link>
              <Link to={{ name: 'signup' }} className="text-sm text-gray-500 hover:text-brand-400 transition-colors">
                {t('Become an Organizer')}
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">{t('Contact')}</h4>
            <div className="flex flex-col gap-2.5">
              <a href="mailto:contact@chessmorocco.ma" className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-400 transition-colors">
                <Mail className="w-4 h-4" />
                contact@chessmorocco.ma
              </a>
              <p className="text-sm text-gray-500">{t('Casablanca, Morocco')}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-surface-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">© 2026 Qehwa Chess. {t('All rights reserved.')}</p>
          <p className="text-xs text-gray-600">{t('Built for the Moroccan chess community')}</p>
        </div>
      </div>
    </footer>
  );
}
