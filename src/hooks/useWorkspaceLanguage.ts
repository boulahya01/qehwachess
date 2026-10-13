import { useLanguage } from '@/context/LanguageContext';
import { workspaceTranslations } from '@/lib/translationsWorkspaces';

// Detailed workspace copy is loaded with the lazy pages, not the app shell.
export function useWorkspaceLanguage() {
  const context = useLanguage();
  const t = (text: string) =>
    context.language === 'fr' || context.language === 'ar'
      ? (workspaceTranslations[context.language][text] ?? context.t(text))
      : context.t(text);
  return { ...context, t };
}
