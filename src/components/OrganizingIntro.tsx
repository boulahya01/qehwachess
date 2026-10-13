import { useState } from 'react';
import { ArrowRight, CalendarPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Link } from '@/context/RouterContext';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import { AuthMessage } from '@/components/auth/AuthParts';
import { authError } from '@/lib/authFlow';

export function OrganizingIntro() {
  const { user, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="v2-container organizing-intro">
      <span className="auth-state-icon">
        <CalendarPlus size={30} aria-hidden="true" />
      </span>
      <p className="auth-eyebrow">{t('Same account. More possibilities.')}</p>
      <h1>{t('Bring people to the board.')}</h1>
      <p>
        {t(
          'Organize events with the account you already use to play. Your registrations, messages, and profile stay together.'
        )}
      </p>
      <AuthMessage message={error} />
      <button
        type="button"
        className="action action-primary"
        disabled={pending}
        onClick={async () => {
          if (!user || pending) return;
          setPending(true);
          setError(null);
          try {
            const { data, error: updateError } = await supabase
              .from('profiles')
              .update({ role: 'organizer' })
              .eq('id', user.id)
              .eq('role', 'player')
              .select('id')
              .single();
            if (updateError || !data) setError(authError(updateError));
            else await refreshProfile();
          } catch (caught) {
            setError(authError(caught));
          } finally {
            setPending(false);
          }
        }}
      >
        {t(pending ? 'Please wait...' : 'Enable organizing')}
        <ArrowRight size={18} className="direction-arrow" />
      </button>
      <Link to={{ name: 'dashboard' }} className="text-link">
        {t('Back to my games')}
      </Link>
    </section>
  );
}
