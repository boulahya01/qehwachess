-- Move account contacts out of the publicly readable profile relation.
CREATE TABLE public.profile_contacts (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  phone text
);
ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;
INSERT INTO public.profile_contacts(profile_id, email, phone)
SELECT id, email, phone FROM public.profiles;
REVOKE ALL ON public.profile_contacts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_contacts TO authenticated;
GRANT UPDATE(phone) ON public.profile_contacts TO authenticated;
CREATE POLICY "Read own private contact" ON public.profile_contacts FOR SELECT TO authenticated
USING (profile_id = (select auth.uid()));
CREATE POLICY "Update own private phone" ON public.profile_contacts FOR UPDATE TO authenticated
USING (profile_id = (select auth.uid())) WITH CHECK (profile_id = (select auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE display_name text;
BEGIN
  display_name := coalesce(nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''), nullif(trim(NEW.raw_user_meta_data->>'name'), ''), 'Chess player');
  INSERT INTO public.profiles(id, full_name, role)
  VALUES (NEW.id, left(display_name, 100), 'player') ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.profile_contacts(profile_id, email)
  VALUES (NEW.id, coalesce(NEW.email, '')) ON CONFLICT(profile_id) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_auth_profile_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.profile_contacts SET email = coalesce(NEW.email, '') WHERE profile_id = NEW.id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_auth_profile_email() FROM PUBLIC, anon, authenticated;
ALTER TABLE public.profiles DROP COLUMN email, DROP COLUMN phone;

-- Auth internals stay in an unexposed schema; return only the caller's capability.
CREATE SCHEMA IF NOT EXISTS qehwa_private;
REVOKE ALL ON SCHEMA qehwa_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA qehwa_private TO authenticated;
CREATE FUNCTION qehwa_private.my_password_available()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501'; END IF;
  RETURN EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND coalesce(encrypted_password, '') <> '');
END $$;
REVOKE ALL ON FUNCTION qehwa_private.my_password_available() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION qehwa_private.my_password_available() TO authenticated;
CREATE FUNCTION public.get_my_auth_capabilities()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('has_password', qehwa_private.my_password_available());
$$;
REVOKE ALL ON FUNCTION public.get_my_auth_capabilities() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_auth_capabilities() TO authenticated;
CREATE FUNCTION public.save_my_profile(p_details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501'; END IF;
  UPDATE public.profiles SET
    full_name = left(coalesce(nullif(btrim(p_details->>'full_name'), ''), 'Chess player'), 100),
    bio = nullif(btrim(p_details->>'bio'), ''),
    city_id = nullif(p_details->>'city_id', '')::uuid,
    username = nullif(btrim(p_details->>'username'), ''),
    lichess_username = nullif(btrim(p_details->>'lichess_username'), ''),
    chesscom_username = nullif(btrim(p_details->>'chesscom_username'), ''),
    fide_id = nullif(btrim(p_details->>'fide_id'), '')
  WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable'; END IF;
  UPDATE public.profile_contacts SET phone = nullif(btrim(p_details->>'phone'), '') WHERE profile_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Private contact unavailable'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_my_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_profile(jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
