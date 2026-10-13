import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { Language, useLanguage } from '@/context/LanguageContext';
import { BrandMark } from '@/components/BrandMark';
import { authError } from '@/lib/authFlow';
import { useTheme } from '@/context/ThemeContext';
import {
  Menu,
  X,
  ChevronDown,
  Crown,
  MessageCircle,
  Sun,
  Moon,
  Trophy,
  MapPin,
  Users,
  UserRound,
  LogOut,
} from 'lucide-react';

export function Navbar() {
  const { route } = useRouter();
  const { user, profile, signOut } = useAuth();
  const { language, chooseLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signoutError, setSignoutError] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const accountRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
    setAccountOpen(false);
  }, [route]);
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setMobileOpen(false);
        setMoreOpen(false);
        setAccountOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (mobileOpen) menuRef.current?.focus();
      else if (moreOpen) moreRef.current?.focus();
      else if (accountOpen) accountRef.current?.focus();
      setMobileOpen(false);
      setMoreOpen(false);
      setAccountOpen(false);
    }
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', escape);
    };
  }, [mobileOpen, moreOpen, accountOpen]);

  const navLinks = [
    {
      label: 'Tournaments',
      to: { name: 'tournaments' } as const,
      icon: Trophy,
    },
    { label: 'Casual Meetups', to: { name: 'meetups' } as const, icon: Users },
    { label: 'Players', to: { name: 'players' } as const, icon: UserRound },
    { label: 'Map', to: { name: 'map' } as const, icon: MapPin },
    { label: 'Clubs', to: { name: 'clubs' } as const, icon: Crown },
    { label: 'Cities', to: { name: 'cities' } as const, icon: MapPin },
  ];
  function isActive(name: string) {
    return (
      route.name === name ||
      (name === 'tournaments' && route.name === 'tournament') ||
      (name === 'clubs' && route.name === 'club') ||
      (name === 'cities' && route.name === 'city')
    );
  }
  const accountRoute = { name: 'dashboard' } as const;
  const themeLabel = t(
    theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  );
  const authPage = [
    'signin',
    'signup',
    'forgotPassword',
    'resetPassword',
    'authCallback',
  ].includes(route.name);
  const accountLinks = (
    <>
      <Link to={accountRoute} className="nav-link">
        {t('Dashboard')}
      </Link>
      <Link to={{ name: 'messages' }} className="nav-link">
        {t('Messages')}
      </Link>
      <Link to={{ name: 'profile' }} className="nav-link">
        {t('Profile Settings')}
      </Link>
      <Link to={{ name: 'security' }} className="nav-link">
        {t('Sign-in & security')}
      </Link>
      <Link to={{ name: 'organizer' }} className="nav-link">
        {t('Organize events')}
      </Link>
      {profile?.role === 'organizer' && (
        <Link to={{ name: 'clubManagement' }} className="nav-link">
          {t('Manage Clubs')}
        </Link>
      )}
      <button
        type="button"
        className="nav-link gap-2 w-full"
        onClick={() => {
          setSignoutError(null);
          void signOut().catch((caught) => setSignoutError(authError(caught)));
          setAccountOpen(false);
          setMobileOpen(false);
        }}
      >
        <LogOut size={16} />
        {t('Sign Out')}
      </button>
    </>
  );

  return (
    <>
      <header
        className={`site-header ${authPage ? 'auth-header' : ''}`}
        ref={headerRef}
      >
        <nav aria-label={t('Main navigation')} className="v2-container">
          <div className="nav-inner">
            <Link
              to={{ name: 'home' }}
              className="brand-lockup"
              aria-label="Qehwa Chess"
            >
              <span className="brand-symbol">
                <BrandMark />
              </span>
              Qehwa Chess
            </Link>
            <div
              className={authPage ? 'hidden' : 'hidden xl:flex items-center'}
            >
              {navLinks.slice(0, 4).map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="nav-link"
                  aria-current={isActive(link.to.name) ? 'page' : undefined}
                >
                  {t(link.label)}
                </Link>
              ))}
              <div className="relative">
                <button
                  type="button"
                  ref={moreRef}
                  onClick={() => {
                    setMoreOpen(!moreOpen);
                    setAccountOpen(false);
                  }}
                  className="nav-link gap-1"
                  aria-expanded={moreOpen}
                  aria-controls="more-navigation"
                >
                  {t('More')}
                  <ChevronDown size={14} />
                </button>
                {moreOpen && (
                  <div id="more-navigation" className="nav-popover">
                    {navLinks.slice(4).map((link) => (
                      <Link
                        key={link.label}
                        to={link.to}
                        className="nav-link"
                        aria-current={
                          isActive(link.to.name) ? 'page' : undefined
                        }
                      >
                        {t(link.label)}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <select
                aria-label={t('Language / Langue')}
                value={language}
                onChange={(e) => chooseLanguage(e.target.value as Language)}
                className="language-select"
              >
                <option value="en">EN</option>
                <option value="fr">FR</option>
                <option value="ar">العربية</option>
              </select>
              <button
                type="button"
                onClick={toggleTheme}
                className="icon-button header-theme-control"
                aria-label={themeLabel}
                title={themeLabel}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <div
                className={
                  authPage ? 'hidden' : 'hidden xl:flex items-center gap-2'
                }
              >
                {user ? (
                  <>
                    <Link
                      to={{ name: 'messages' }}
                      className="icon-button"
                      aria-label={t('Messages')}
                    >
                      <MessageCircle size={19} />
                    </Link>
                    <div className="relative">
                      <button
                        type="button"
                        ref={accountRef}
                        aria-label={t('Account menu')}
                        aria-expanded={accountOpen}
                        aria-controls="account-navigation"
                        onClick={() => {
                          setAccountOpen(!accountOpen);
                          setMoreOpen(false);
                        }}
                        className="nav-link gap-2"
                      >
                        <span className="brand-symbol text-sm">
                          {profile?.full_name?.charAt(0) ?? 'U'}
                        </span>
                        <ChevronDown size={14} />
                      </button>
                      {accountOpen && (
                        <div id="account-navigation" className="nav-popover">
                          {accountLinks}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Link to={{ name: 'signin' }} className="nav-link">
                      {t('Sign In')}
                    </Link>
                    <Link
                      to={{ name: 'signup' }}
                      className="action action-link action-primary text-sm"
                    >
                      {t('Get Started')}
                    </Link>
                  </>
                )}
              </div>
              <button
                type="button"
                ref={menuRef}
                className={authPage ? 'hidden' : 'icon-button xl:hidden'}
                aria-label={t(mobileOpen ? 'Close menu' : 'Open menu')}
                aria-expanded={mobileOpen}
                aria-controls="mobile-navigation"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
          {mobileOpen && (
            <div id="mobile-navigation" className="mobile-menu xl:hidden">
              <div className="grid grid-cols-2 gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    to={link.to}
                    className="nav-link gap-2"
                    aria-current={isActive(link.to.name) ? 'page' : undefined}
                  >
                    <link.icon size={16} />
                    {t(link.label)}
                  </Link>
                ))}
              </div>
              <div className="grid gap-1 mt-3 pt-3 border-t border-surface-700">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="nav-link menu-theme-control gap-2"
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                  {themeLabel}
                </button>
                {user ? (
                  accountLinks
                ) : (
                  <>
                    <Link
                      to={{ name: 'signin' }}
                      className="action action-link action-secondary"
                    >
                      {t('Sign In')}
                    </Link>
                    <Link
                      to={{ name: 'signup' }}
                      className="action action-link action-primary"
                    >
                      {t('Get Started')}
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </nav>
        {signoutError && (
          <p className="nav-auth-error" role="alert">
            {t(signoutError)}
          </p>
        )}
      </header>
      {!authPage && (
        <nav className="mobile-dock" aria-label={t('Quick navigation')}>
          {navLinks.slice(0, 2).map((link) => (
            <Link
              key={link.label}
              to={link.to}
              aria-current={isActive(link.to.name) ? 'page' : undefined}
            >
              <link.icon size={20} strokeWidth={1.7} />
              <span>{t(link.label)}</span>
            </Link>
          ))}
          <Link
            to={{ name: 'map' }}
            aria-current={isActive('map') ? 'page' : undefined}
          >
            <MapPin size={20} strokeWidth={1.7} />
            <span>{t('Map')}</span>
          </Link>
          <Link
            to={user ? accountRoute : { name: 'signin' }}
            aria-current={isActive('dashboard') ? 'page' : undefined}
          >
            <UserRound size={20} strokeWidth={1.7} />
            <span>{t(user ? 'Dashboard' : 'Sign In')}</span>
          </Link>
        </nav>
      )}
    </>
  );
}
