import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useAuthCapabilities(userId?: string) {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setHasPassword(null);
    setError(false);
    if (userId)
      void (async () => {
        try {
          const { data, error: queryError } = await supabase.rpc(
            'get_my_auth_capabilities'
          );
          if (!active) return;
          if (queryError || typeof data?.has_password !== 'boolean')
            setError(true);
          else setHasPassword(data.has_password);
        } catch {
          if (active) setError(true);
        }
      })();
    return () => {
      active = false;
    };
  }, [userId, revision]);
  return { hasPassword, error, refresh };
}
