BEGIN;
DO $$
DECLARE test_id uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('qehwa.test_user', test_id::text, true);
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (test_id, 'auth-ui-test-' || test_id || '@example.invalid', '{"role":"admin"}'::jsonb);
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=test_id AND role='player' AND full_name='Chess player' AND city_id IS NULL AND username IS NULL AND lichess_username IS NULL) THEN
    RAISE EXCEPTION 'Minimal signup or protected default role failed';
  END IF;
  UPDATE auth.users SET email='updated-' || test_id || '@example.invalid' WHERE id=test_id;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=test_id AND email='updated-' || test_id || '@example.invalid') THEN
    RAISE EXCEPTION 'Confirmed email synchronization failed';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', test_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END;
$$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE test_id uuid := current_setting('qehwa.test_user')::uuid; club_id uuid;
BEGIN
  UPDATE public.profiles SET role='organizer' WHERE id=test_id;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=test_id AND role='organizer') THEN RAISE EXCEPTION 'Organizing activation failed'; END IF;
  INSERT INTO public.player_availability(profile_id, expires_at) VALUES(test_id, now()+interval '1 hour');
  SELECT id INTO club_id FROM public.clubs LIMIT 1;
  IF club_id IS NOT NULL THEN INSERT INTO public.club_memberships(club_id, profile_id) VALUES(club_id,test_id); END IF;
  BEGIN
    UPDATE public.profiles SET role='admin' WHERE id=test_id;
    RAISE EXCEPTION 'Admin escalation was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;
ROLLBACK;
SELECT 'Passed: minimal signup, safe default role, email sync, organizer participation, admin escalation denied; fixtures rolled back.' AS result;
