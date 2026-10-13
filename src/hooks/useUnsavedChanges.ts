import { useEffect, useRef } from 'react';
import { useRouter } from '@/context/RouterContext';
import { useLanguage } from '@/context/LanguageContext';

export function useUnsavedChanges(dirty: boolean) {
  const { registerLeaveGuard } = useRouter();
  const { t } = useLanguage();
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    const remove = registerLeaveGuard(
      () =>
        !dirtyRef.current ||
        window.confirm(t('Leave without saving your changes?'))
    );
    function beforeUnload(event: BeforeUnloadEvent) {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      remove();
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [registerLeaveGuard, t]);
  return () => {
    dirtyRef.current = false;
  };
}
