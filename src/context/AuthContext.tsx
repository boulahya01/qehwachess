/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';
import { authError, authRedirect, initializeAuth } from '@/lib/authFlow';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    tournamentId?: string
  ) => Promise<{ error: string | null; confirmationRequired?: boolean }>;
  resendSignupConfirmation: (
    email: string,
    tournamentId?: string
  ) => Promise<{ error: string | null }>;
  requestPasswordReset: (
    email: string,
    tournamentId?: string
  ) => Promise<{ error: string | null }>;
  updatePassword: (
    password: string,
    currentPassword?: string
  ) => Promise<{ error: string | null }>;
  updateEmail: (email: string) => Promise<{ error: string | null }>;
  signInWithProvider: (
    provider: 'google' | 'discord',
    tournamentId?: string,
    link?: boolean
  ) => Promise<{ error: string | null }>;
  recoveryReady: boolean;
  finishRecovery: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(() =>
    sessionStorage.getItem('qehwa-recovery-user')
  );
  const active = useRef(false);
  const currentUserId = useRef<string | null>(null);
  const profileRequest = useRef(0);

  const loadProfile = useCallback(async (userId: string) => {
    if (!active.current || currentUserId.current !== userId)
      return { error: 'Your session changed. Please sign in again.' };
    const request = ++profileRequest.current;
    const isCurrent = () =>
      active.current &&
      currentUserId.current === userId &&
      request === profileRequest.current;
    const message = 'Could not load your profile. Please reload and try again.';
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*, city:cities(*)')
        .eq('id', userId)
        .maybeSingle();
      if (!isCurrent()) return { error: null };
      if (profileError || !data) {
        setProfile(null);
        setError(message);
        return { error: message };
      }
      setProfile(data as Profile);
      setError(null);
      return { error: null };
    } catch {
      if (isCurrent()) {
        setProfile(null);
        setError(message);
      }
      return { error: message };
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    active.current = true;
    let receivedAuthEvent = false;
    let disposed = false;
    const invalidateRequests = () => {
      ++profileRequest.current;
    };
    function applySession(nextSession: Session | null) {
      if (disposed) return;
      const nextUserId = nextSession?.user.id ?? null;
      if (nextUserId !== currentUserId.current) {
        invalidateRequests();
        currentUserId.current = nextUserId;
        setProfile(null);
        setLoading(Boolean(nextUserId));
        setError(null);
      }
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextUserId) {
        setProfile(null);
        setError(null);
        setLoading(false);
      }
    }
    // Keep the auth callback synchronous. Profile requests run in an effect,
    // outside the Supabase auth lock, and only for a changed account ID.
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (event === 'PASSWORD_RECOVERY' && nextSession) {
          sessionStorage.setItem('qehwa-recovery-user', nextSession.user.id);
          setRecoveryUserId(nextSession.user.id);
        }
        receivedAuthEvent = true;
        applySession(nextSession);
      }
    );
    void initializeAuth(supabase)
      .then(({ session: initialSession, error: initialError, recovery }) => {
        if (disposed) return;
        if (recovery && initialSession) {
          sessionStorage.setItem('qehwa-recovery-user', initialSession.user.id);
          setRecoveryUserId(initialSession.user.id);
        }
        if (initialError) {
          setError(
            window.location.pathname === '/auth/callback'
              ? authError({ message: initialError })
              : 'Could not restore your session. Please reload and try again.'
          );
          setLoading(false);
          return;
        }
        if (!receivedAuthEvent || window.location.pathname === '/auth/callback')
          applySession(initialSession);
      })
      .catch(() => {
        if (disposed || receivedAuthEvent) return;
        setError(
          'Could not restore your session. Please reload and try again.'
        );
        setLoading(false);
      });
    return () => {
      disposed = true;
      active.current = false;
      invalidateRequests();
      listener.subscription.unsubscribe();
    };
  }, []);

  const userId = user?.id;
  const userEmail = user?.email;
  useEffect(() => {
    if (userId) void loadProfile(userId);
  }, [userId, userEmail, loadProfile]);

  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  async function attempt(
    action: () => Promise<{ error: { message: string } | null }>
  ) {
    try {
      const { error: actionError } = await action();
      return { error: actionError ? authError(actionError) : null };
    } catch (actionError) {
      return { error: authError(actionError) };
    }
  }

  async function signIn(email: string, password: string) {
    const result = await attempt(() =>
      supabase.auth.signInWithPassword({ email: email.trim(), password })
    );
    if (result.error) return result;
    return { error: null };
  }

  async function signUp(
    email: string,
    password: string,
    tournamentId?: string
  ) {
    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: authRedirect('signup', tournamentId) },
      });
      if (signupError) return { error: authError(signupError) };
      if (!data.user) return { error: 'Failed to create account' };
      return { error: null, confirmationRequired: !data.session };
    } catch (signupError) {
      return { error: authError(signupError) };
    }
  }

  function resendSignupConfirmation(email: string, tournamentId?: string) {
    return attempt(() =>
      supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: authRedirect('signup', tournamentId) },
      })
    );
  }
  function requestPasswordReset(email: string, tournamentId?: string) {
    return attempt(() =>
      supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authRedirect('recovery', tournamentId),
      })
    );
  }
  async function updatePassword(password: string, currentPassword?: string) {
    if (!user) return { error: 'Please sign in to continue.' };
    if (currentPassword && user.email) {
      const result = await signIn(user.email, currentPassword);
      if (result.error) return result;
    }
    return attempt(() => supabase.auth.updateUser({ password }));
  }
  function updateEmail(email: string) {
    if (!user) return Promise.resolve({ error: 'Please sign in to continue.' });
    return attempt(() =>
      supabase.auth.updateUser(
        { email: email.trim() },
        { emailRedirectTo: authRedirect('email_change') }
      )
    );
  }
  function signInWithProvider(
    provider: 'google' | 'discord',
    tournamentId?: string,
    link = false
  ) {
    if (link && !user)
      return Promise.resolve({ error: 'Please sign in to continue.' });
    const enabled =
      provider === 'google'
        ? import.meta.env.VITE_GOOGLE_AUTH_ENABLED
        : import.meta.env.VITE_DISCORD_AUTH_ENABLED;
    if (enabled !== 'true')
      return Promise.resolve({
        error: 'This sign-in method is not available yet.',
      });
    const options = { redirectTo: authRedirect('oauth', tournamentId) };
    return attempt(() =>
      link
        ? supabase.auth.linkIdentity({ provider, options })
        : supabase.auth.signInWithOAuth({ provider, options })
    );
  }
  function finishRecovery() {
    sessionStorage.removeItem('qehwa-recovery-user');
    setRecoveryUserId(null);
  }

  async function signOut() {
    const { error: signoutError } = await supabase.auth.signOut();
    if (signoutError) throw new Error(authError(signoutError));
    finishRecovery();
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        error,
        signIn,
        signUp,
        resendSignupConfirmation,
        signOut,
        refreshProfile,
        requestPasswordReset,
        updatePassword,
        updateEmail,
        signInWithProvider,
        recoveryReady: Boolean(user && recoveryUserId === user.id),
        finishRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
