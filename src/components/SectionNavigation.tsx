import { Link, useRouter } from '@/context/RouterContext';
import { useLanguage } from '@/context/LanguageContext';
export function SectionNavigation() {
  const { route } = useRouter();
  const { t } = useLanguage();
  const play = ['meetups', 'tournaments', 'map'].includes(route.name);
  const community = ['players', 'clubs', 'cities'].includes(route.name);
  if (!play && !community) return null;
  const links = play
    ? [
        { name: 'meetups' as const, label: 'Casual games' },
        { name: 'tournaments' as const, label: 'Tournaments' },
      ]
    : [
        { name: 'players' as const, label: 'Players' },
        { name: 'clubs' as const, label: 'Clubs' },
        { name: 'cities' as const, label: 'Cities' },
      ];
  return (
    <nav
      className="v2-container section-navigation"
      aria-label={t(play ? 'Play' : 'Community')}
    >
      {links.map((link) => (
        <Link
          key={link.name}
          to={{ name: link.name }}
          aria-current={route.name === link.name ? 'page' : undefined}
        >
          {t(link.label)}
        </Link>
      ))}
      {play && (
        <Link
          to={{ name: 'map' }}
          className="map-link"
          aria-current={route.name === 'map' ? 'page' : undefined}
        >
          {t('Map')}
        </Link>
      )}
    </nav>
  );
}
