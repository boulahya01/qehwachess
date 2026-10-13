import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export function AccountNavigation() {
  const { route } = useRouter();
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const active =
    route.name === 'dashboard'
      ? (route.section ?? 'games')
      : ['organizer', 'tournamentEditor'].includes(route.name)
        ? 'events'
        : route.name === 'clubManagement' ||
            (route.name === 'discordIntegration' && route.scope === 'club')
          ? 'clubs'
          : ['settings', 'profile', 'security'].includes(route.name)
            ? 'settings'
            : 'admin';
  if (
    !user ||
    ![
      'dashboard',
      'organizer',
      'tournamentEditor',
      'clubManagement',
      'discordIntegration',
      'settings',
      'profile',
      'security',
      'admin',
    ].includes(route.name)
  )
    return null;
  return (
    <nav
      className="v2-container account-navigation"
      aria-label={t('Your account')}
    >
      {(['games', 'events', 'clubs'] as const).map((section, index) => (
        <Link
          key={section}
          to={{ name: 'dashboard', section }}
          aria-current={active === section ? 'page' : undefined}
        >
          {t(['My games', 'My events', 'My clubs'][index])}
        </Link>
      ))}
      <Link
        to={{ name: 'settings' }}
        aria-current={active === 'settings' ? 'page' : undefined}
      >
        {t('Settings')}
      </Link>
      {profile?.role === 'admin' && (
        <Link
          to={{ name: 'admin' }}
          aria-current={active === 'admin' ? 'page' : undefined}
        >
          {t('Platform')}
        </Link>
      )}
    </nav>
  );
}
