import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage, Language } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { BrandMark } from './BrandMark';
import { authError } from '@/lib/authFlow';
import {
  ChevronDown,
  Menu,
  X,
  Sun,
  Moon,
  Users,
  MessageCircle,
  UserRound,
  Coffee,
} from 'lucide-react';
export function Navbar() {
  const { route, confirmLeave } = useRouter();
  const { user, profile, signOut } = useAuth();
  const { language, chooseLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState<
    'play' | 'community' | 'account' | 'mobile' | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const header = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const authPage = [
    'signin',
    'signup',
    'forgotPassword',
    'resetPassword',
    'authCallback',
  ].includes(route.name);
  useEffect(() => {
    setOpen(null);
  }, [route]);
  useEffect(() => {
    function outside(e: PointerEvent) {
      if (!header.current?.contains(e.target as Node)) setOpen(null);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        clearTimeout(timer.current);
        setOpen(null);
        trigger.current?.focus();
      }
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  function hover(value: typeof open, e: React.PointerEvent) {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(value), value ? 180 : 250);
  }
  const play = (
    <>
      <Link to={{ name: 'meetups' }} className="nav-link">
        {t('Find a game')}
      </Link>
      <Link to={{ name: 'tournaments' }} className="nav-link">
        {t('Tournaments')}
      </Link>
      <Link to={{ name: 'map' }} className="nav-link">
        {t('Map')}
      </Link>
    </>
  );
  const community = (
    <>
      <Link to={{ name: 'players' }} className="nav-link">
        {t('Players')}
      </Link>
      <Link to={{ name: 'clubs' }} className="nav-link">
        {t('Clubs')}
      </Link>
      <Link to={{ name: 'cities' }} className="nav-link">
        {t('Cities')}
      </Link>
    </>
  );
  const account = user ? (
    <>
      <Link to={{ name: 'dashboard' }} className="nav-link">
        {t('Account home')}
      </Link>
      <Link to={{ name: 'settings' }} className="nav-link">
        {t('Settings')}
      </Link>
      {profile?.role === 'admin' && (
        <Link to={{ name: 'admin' }} className="nav-link">
          {t('Administration')}
        </Link>
      )}
      <button
        type="button"
        className="nav-link text-danger"
        disabled={pending}
        onClick={async () => {
          if (!confirmLeave()) return;
          setPending(true);
          setError(null);
          try {
            await signOut('local');
            setOpen(null);
          } catch (e) {
            setError(authError(e));
          } finally {
            setPending(false);
          }
        }}
      >
        {t(pending ? 'Please wait...' : 'Sign out')}
      </button>
    </>
  ) : (
    <>
      <Link to={{ name: 'signin' }} className="nav-link">
        {t('Sign in')}
      </Link>
      <Link to={{ name: 'signup' }} className="nav-link">
        {t('Create an account')}
      </Link>
    </>
  );
  function dropdown(
    name: 'play' | 'community' | 'account',
    label: string,
    children: React.ReactNode
  ) {
    return (
      <div
        className="relative"
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse')
            trigger.current = e.currentTarget.querySelector('button');
          hover(name, e);
        }}
        onPointerLeave={(e) => {
          if (!e.currentTarget.contains(document.activeElement)) hover(null, e);
        }}
        onFocus={() => clearTimeout(timer.current)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            clearTimeout(timer.current);
            setOpen((current) => (current === name ? null : current));
          }
        }}
      >
        <button
          type="button"
          className="nav-link"
          aria-current={
            (name === 'play' &&
              ['meetups', 'tournaments', 'tournament', 'map'].includes(
                route.name
              )) ||
            (name === 'community' &&
              [
                'players',
                'publicProfile',
                'clubs',
                'club',
                'cities',
                'city',
              ].includes(route.name)) ||
            (name === 'account' &&
              [
                'dashboard',
                'settings',
                'profile',
                'security',
                'organizer',
                'tournamentEditor',
                'clubManagement',
                'discordIntegration',
                'admin',
              ].includes(route.name))
              ? 'page'
              : undefined
          }
          aria-expanded={open === name}
          aria-controls={`nav-${name}`}
          onClick={(e) => {
            clearTimeout(timer.current);
            trigger.current = e.currentTarget;
            setOpen(open === name ? null : name);
          }}
        >
          {t(label)}
          <ChevronDown size={14} />
        </button>
        {open === name && (
          <div id={`nav-${name}`} className="nav-popover">
            {children}
          </div>
        )}
      </div>
    );
  }
  return (
    <>
      <header
        ref={header}
        className={`site-header calm-header ${authPage ? 'auth-header' : ''}`}
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
            {!authPage && (
              <div className="calm-desktop">
                {dropdown('play', 'Play', play)}
                {dropdown('community', 'Community', community)}
                <Link
                  to={{ name: user ? 'messages' : 'signin' }}
                  className="nav-link"
                  aria-current={route.name === 'messages' ? 'page' : undefined}
                >
                  {t('Messages')}
                </Link>
                {dropdown('account', 'Account', account)}
              </div>
            )}
            <div className="flex items-center gap-2">
              <select
                aria-label="Language / Langue"
                value={language}
                onChange={(e) => chooseLanguage(e.target.value as Language)}
                className="header-language-control"
              >
                <option value="en">EN</option>
                <option value="fr">FR</option>
                <option value="ar">العربية</option>
              </select>
              <button
                className="icon-button header-theme-control"
                type="button"
                aria-label={t(
                  theme === 'dark'
                    ? 'Switch to light mode'
                    : 'Switch to dark mode'
                )}
                onClick={toggleTheme}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              {!authPage && (
                <button
                  type="button"
                  className="icon-button calm-mobile-toggle"
                  aria-label={t(open === 'mobile' ? 'Close menu' : 'Open menu')}
                  aria-expanded={open === 'mobile'}
                  aria-controls="mobile-navigation"
                  onClick={(e) => {
                    trigger.current = e.currentTarget;
                    setOpen(open === 'mobile' ? null : 'mobile');
                  }}
                >
                  {open === 'mobile' ? <X size={22} /> : <Menu size={22} />}
                </button>
              )}
            </div>
          </div>
          {open === 'mobile' && !authPage && (
            <div id="mobile-navigation" className="mobile-menu">
              <p className="field-hint">{t('Play')}</p>
              {play}
              <p className="field-hint">{t('Community')}</p>
              {community}
              <p className="field-hint">{t('Account')}</p>
              {account}
              <button
                type="button"
                className="nav-link menu-theme-control"
                onClick={toggleTheme}
              >
                {t(
                  theme === 'dark'
                    ? 'Switch to light mode'
                    : 'Switch to dark mode'
                )}
              </button>
            </div>
          )}
        </nav>
        {error && (
          <p className="nav-auth-error" role="alert">
            {t(error)}
          </p>
        )}
      </header>
      {!authPage && (
        <nav
          className="mobile-dock calm-dock"
          aria-label={t('Quick navigation')}
        >
          {[
            {
              name: 'meetups' as const,
              label: 'Play',
              icon: Coffee,
              active: ['meetups', 'tournaments', 'tournament', 'map'].includes(
                route.name
              ),
            },
            {
              name: 'players' as const,
              label: 'Community',
              icon: Users,
              active: [
                'players',
                'publicProfile',
                'clubs',
                'club',
                'cities',
                'city',
              ].includes(route.name),
            },
            {
              name: user ? ('messages' as const) : ('signin' as const),
              label: 'Messages',
              icon: MessageCircle,
              active: route.name === 'messages',
            },
            {
              name: user ? ('dashboard' as const) : ('signin' as const),
              label: 'Account',
              icon: UserRound,
              active: [
                'dashboard',
                'profile',
                'security',
                'settings',
                'discordIntegration',
                'organizer',
                'clubManagement',
                'admin',
                'tournamentEditor',
              ].includes(route.name),
            },
          ].map((item) => (
            <Link
              key={item.label}
              to={{ name: item.name }}
              aria-current={item.active ? 'page' : undefined}
            >
              <item.icon size={20} strokeWidth={1.7} />
              <span>{t(item.label)}</span>
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
