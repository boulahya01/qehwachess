/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    cityId: string,
    chessAccounts: {
      username: string;
      lichessUsername: string;
      chesscomUsername: string;
      fideId: string;
    }
  ) => Promise<{ error: string | null; confirmationRequired?: boolean }>;
  resendSignupConfirmation: (email: string) => Promise<{ error: string | null }>;
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
  const active = useRef(false);
  const currentUserId = useRef<string | null>(null);
  const profileRequest = useRef(0);

  const loadProfile = useCallback(async (userId: string) => {
    if (!active.current || currentUserId.current !== userId) return { error: 'Your session changed. Please sign in again.' };
    const request = ++profileRequest.current;
    const isCurrent = () => active.current && currentUserId.current === userId && request === profileRequest.current;
    const message = 'Could not load your profile. Please reload and try again.';
    try {
      const { data, error: profileError } = await supabase
        .from('profiles').select('*, city:cities(*)').eq('id', userId).maybeSingle();
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
      if (isCurrent()) { setProfile(null); setError(message); }
      return { error: message };
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    active.current = true;
    let receivedAuthEvent = false;
    let disposed = false;
    const invalidateRequests = () => { ++profileRequest.current; };
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
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true;
      applySession(nextSession);
    });
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (disposed || receivedAuthEvent) return;
      if (sessionError) throw sessionError;
      applySession(data.session);
    }).catch(() => {
      if (disposed || receivedAuthEvent) return;
      setError('Could not restore your session. Please reload and try again.');
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
  useEffect(() => {
    if (userId) void loadProfile(userId);
  }, [userId, loadProfile]);

  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  async function ensureProfile(authUser: User) {
    const { data: existingProfile, error: lookupError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', authUser.id)
      .maybeSingle();

    if (lookupError) return { error: lookupError.message };

    const metadata = authUser.user_metadata;
    const requestedRole = metadata.role;
    const role: UserRole = requestedRole === 'organizer' ? 'organizer' : 'player';
    if (existingProfile) {
      if (role === 'organizer' && existingProfile.role === 'player') {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'organizer' })
          .eq('id', authUser.id);
        return { error: updateError?.message ?? null };
      }
      return { error: null };
    }

    const fullName =
      (typeof metadata.full_name === 'string' && metadata.full_name) ||
      (typeof metadata.name === 'string' && metadata.name) ||
      authUser.email?.split('@')[0] ||
      'Player';
    const cityId = typeof metadata.city_id === 'string' ? metadata.city_id : null;

    const { error: insertError } = await supabase.from('profiles').upsert(
      {
        id: authUser.id,
        full_name: fullName,
        email: authUser.email ?? '',
        role,
        city_id: cityId,
        username: typeof metadata.username === 'string' ? metadata.username : null,
        lichess_username: typeof metadata.lichess_username === 'string' ? metadata.lichess_username : null,
        chesscom_username: typeof metadata.chesscom_username === 'string' ? metadata.chesscom_username : null,
        fide_id: typeof metadata.fide_id === 'string' ? metadata.fide_id : null,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );

    return { error: insertError?.message ?? null };
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (!data.user) return { error: 'Sign-in succeeded but no user was returned.' };

    const profileResult = await ensureProfile(data.user);
    if (profileResult.error) return profileResult;

    return loadProfile(data.user.id);
  }

  async function signUp(
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    cityId: string,
    chessAccounts: {
      username: string;
      lichessUsername: string;
      chesscomUsername: string;
      fideId: string;
    }
  ) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          city_id: cityId,
          username: chessAccounts.username.trim().replace(/^@/, ''),
          lichess_username: chessAccounts.lichessUsername.trim().replace(/^@/, '') || null,
          chesscom_username: chessAccounts.chesscomUsername.trim().replace(/^@/, '') || null,
          fide_id: chessAccounts.fideId.trim() || null,
        },
      },
    });

    if (error) {
      if (error.status === 429 || /rate.?limit/i.test(error.message)) {
        return {
          error:
            'Sign-ups are temporarily rate-limited by Supabase. Please wait a while before trying again.',
        };
      }
      return { error: error.message };
    }

    if (!data.user) return { error: 'Failed to create account' };

    if (!data.session) {
      return { error: null, confirmationRequired: true };
    }

    if (data.session) {
      const profileResult = await ensureProfile(data.user);
      if (profileResult.error) return profileResult;
      return loadProfile(data.user.id);
    }

    return { error: null };
  }

  async function resendSignupConfirmation(email: string) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, error, signIn, signUp, resendSignupConfirmation, signOut, refreshProfile }}
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
