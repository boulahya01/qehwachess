-- One identity per account; profile enrichment is optional after registration.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  display_name text;
BEGIN
  display_name := coalesce(nullif(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
                           nullif(btrim(NEW.raw_user_meta_data->>'name'), ''), 'Chess player');
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (NEW.id, left(display_name, 100), coalesce(NEW.email, ''), 'player')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Keep the profile contact address aligned after a verified auth email change.
CREATE OR REPLACE FUNCTION public.sync_auth_profile_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.profiles SET email = coalesce(NEW.email, '') WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_auth_profile_email() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_email_changed AFTER UPDATE OF email ON auth.users
FOR EACH ROW WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION public.sync_auth_profile_email();

-- Organizing is additional functionality; it must not remove participation.
DROP POLICY "Players can request club membership" ON public.club_memberships;
CREATE POLICY "Players can request club membership" ON public.club_memberships
FOR INSERT TO authenticated WITH CHECK (
  profile_id = (select auth.uid()) AND status = 'pending'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role IN ('player', 'organizer'))
);
DROP POLICY "Players can publish their availability" ON public.player_availability;
CREATE POLICY "Players can publish their availability" ON public.player_availability
FOR INSERT TO authenticated WITH CHECK (
  profile_id = (select auth.uid()) AND expires_at > now() AND expires_at <= now() + interval '8 hours'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role IN ('player', 'organizer'))
);
DROP POLICY "Players can update their availability" ON public.player_availability;
CREATE POLICY "Players can update their availability" ON public.player_availability
FOR UPDATE TO authenticated USING (profile_id = (select auth.uid())) WITH CHECK (
  profile_id = (select auth.uid()) AND expires_at > now() AND expires_at <= now() + interval '8 hours'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.role IN ('player', 'organizer'))
);
NOTIFY pgrst, 'reload schema';
