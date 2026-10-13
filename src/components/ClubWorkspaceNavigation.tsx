import { Link } from '@/context/RouterContext';
import { useWorkspaceLanguage as useLanguage } from '@/hooks/useWorkspaceLanguage';

export function ClubWorkspaceNavigation({
  clubId,
  section,
  canConfigureDiscord,
  clubName,
}: {
  clubId: string;
  section: string;
  canConfigureDiscord: boolean;
  clubName?: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="club-workspace-context">
      {clubName && <p className="club-context-label">{clubName}</p>}
      <nav className="workspace-navigation" aria-label={t('Club workspace')}>
        {(['events', 'members', 'teams'] as const).map((item, index) => (
          <Link
            key={item}
            to={{ name: 'clubManagement', clubId, section: item }}
            aria-current={section === item ? 'page' : undefined}
          >
            {t(['Events', 'Members', 'Teams'][index])}
          </Link>
        ))}
        {canConfigureDiscord && (
          <Link
            to={{ name: 'discordIntegration', scope: 'club', clubId }}
            aria-current={section === 'discord' ? 'page' : undefined}
          >
            Discord
          </Link>
        )}
      </nav>
    </div>
  );
}
