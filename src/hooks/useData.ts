import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { City, Club, Tournament, TournamentWithRelations } from '@/types';
import { tournamentSearchFilter } from '@/lib/tournamentSearch';

export function useCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('cities').select('*').order('name');
      setCities(data ?? []);
      setLoading(false);
    })();
  }, []);

  return { cities, loading };
}

export function usePlayerCount() {
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const { count, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
          .eq('role', 'player').abortSignal(controller.signal);
        if (!controller.signal.aborted) setPlayerCount(error ? null : count);
      } catch {
        if (!controller.signal.aborted) setPlayerCount(null);
      }
    })();
    return () => controller.abort();
  }, []);
  return playerCount;
}

export function useTournaments(filters?: {
  cityId?: string;
  format?: string;
  search?: string;
  featuredOnly?: boolean;
  organizerId?: string;
  status?: string;
}) {
  const [tournaments, setTournaments] = useState<TournamentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    (async () => {
      let query = supabase
        .from('tournaments')
        .select('*, city:cities(*), club:clubs(*), organizer:profiles(*)')
        .order('start_date', { ascending: true });

      if (filters?.cityId) query = query.eq('city_id', filters.cityId);
      if (filters?.format) query = query.eq('format', filters.format);
      if (filters?.featuredOnly) query = query.eq('featured', true);
      if (filters?.organizerId) query = query.eq('organizer_id', filters.organizerId);
      if (filters?.status) query = query.eq('status', filters.status);
      else query = query.eq('status', 'published');

      if (filters?.search?.trim()) {
        query = query.or(tournamentSearchFilter(filters.search));
      }

      const { data, error: queryError } = await query.abortSignal(controller.signal);
      if (controller.signal.aborted) return;
      setTournaments(data ?? []);
      setError(queryError ? 'Could not load tournaments. Please try again.' : null);
      setLoading(false);
    })();
    return () => controller.abort();
  }, [filters?.cityId, filters?.format, filters?.search, filters?.featuredOnly, filters?.organizerId, filters?.status]);

  return { tournaments, loading, error };
}

export function useTournament(id: string | undefined) {
  const [tournament, setTournament] = useState<TournamentWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [registrationCount, setRegistrationCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function refreshRegistrationCount() {
    if (!id) return;
    const { data, error: countError } = await supabase.rpc('get_tournament_registration_count', { p_tournament_id: id });
    if (countError) throw new Error('Could not load registration availability. Please try again.');
    setRegistrationCount(data ?? 0);
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setTournament(null);
    setRegistrationCount(0);
    setError(null);
    if (!id) {
      setLoading(false);
      return;
    }
    (async () => {
      const [detailResult, countResult] = await Promise.all([
        supabase.from('tournaments')
          .select('*, city:cities(*), club:clubs(*), organizer:profiles(*)')
          .eq('id', id).abortSignal(controller.signal).maybeSingle(),
        supabase.rpc('get_tournament_registration_count', { p_tournament_id: id })
          .abortSignal(controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setTournament(detailResult.data as TournamentWithRelations | null);
      setRegistrationCount(countResult.data ?? 0);
      setError(detailResult.error || countResult.error ? 'Could not load tournament details. Please try again.' : null);
      setLoading(false);
    })();
    return () => controller.abort();
  }, [id]);

  return { tournament, loading, error, registrationCount, refreshRegistrationCount };
}

export function useClubs() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clubs')
        .select('*, city:cities(*), organizer:profiles(*)')
        .order('name');
      setClubs(data ?? []);
      setLoading(false);
    })();
  }, []);

  return { clubs, loading };
}

export function useClub(id: string | undefined) {
  const [club, setClub] = useState<Club | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('clubs')
        .select('*, city:cities(*), organizer:profiles(*)')
        .eq('id', id)
        .maybeSingle();
      setClub(data as Club | null);

      const { data: tData } = await supabase
        .from('tournaments')
        .select('*, city:cities(*)')
        .eq('club_id', id)
        .eq('status', 'published')
        .order('start_date', { ascending: true });
      setTournaments(tData ?? []);

      setLoading(false);
    })();
  }, [id]);

  return { club, tournaments, loading };
}

export function useCityTournaments(id: string | undefined) {
  const [city, setCity] = useState<City | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: cityData } = await supabase
        .from('cities')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      setCity(cityData as City | null);

      const { data: tData } = await supabase
        .from('tournaments')
        .select('*, city:cities(*), club:clubs(*)')
        .eq('city_id', id)
        .eq('status', 'published')
        .order('start_date', { ascending: true });
      setTournaments(tData ?? []);

      const { data: cData } = await supabase
        .from('clubs')
        .select('*, city:cities(*)')
        .eq('city_id', id)
        .order('name');
      setClubs(cData ?? []);

      setLoading(false);
    })();
  }, [id]);

  return { city, tournaments, clubs, loading };
}
