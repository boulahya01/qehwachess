BEGIN;
DO $test$
DECLARE a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); n int;
BEGIN
  INSERT INTO auth.users(id,email,encrypted_password,raw_user_meta_data)
  VALUES(a,'private-a-'||a||'@example.invalid','test-hash','{"role":"admin"}'),(b,'private-b-'||b||'@example.invalid','','{}');
  IF (SELECT count(*) FROM public.profile_contacts WHERE profile_id IN(a,b)) <> 2 THEN RAISE EXCEPTION 'Missing contacts'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name IN('email','phone')) THEN RAISE EXCEPTION 'Public contact columns remain'; END IF;
  PERFORM set_config('request.jwt.claim.sub', a::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.profile_contacts WHERE profile_id IN(a,b);
  IF n <> 1 THEN RAISE EXCEPTION 'Cross-user private read'; END IF;
  UPDATE public.profile_contacts SET phone='cross-user' WHERE profile_id=b;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Cross-user update'; END IF;
  IF NOT (public.get_my_auth_capabilities()->>'has_password')::boolean THEN RAISE EXCEPTION 'Wrong password capability'; END IF;
  PERFORM public.save_my_profile('{"full_name":"Private player","phone":"test-private-phone","role":"admin","email":"injected"}'::jsonb);
  IF (SELECT role FROM public.profiles WHERE id=a) <> 'player' THEN RAISE EXCEPTION 'Role injection'; END IF;
  IF (SELECT phone FROM public.profile_contacts WHERE profile_id=a) <> 'test-private-phone' THEN RAISE EXCEPTION 'Save failed'; END IF;
  BEGIN UPDATE public.profile_contacts SET email='overwrite' WHERE profile_id=a; RAISE EXCEPTION 'Email overwrite allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  EXECUTE 'RESET ROLE';
  UPDATE auth.users SET email='verified-change-'||a||'@example.invalid' WHERE id=a;
  IF (SELECT email FROM public.profile_contacts WHERE profile_id=a) <> 'verified-change-'||a||'@example.invalid' THEN RAISE EXCEPTION 'Email sync'; END IF;
  PERFORM set_config('request.jwt.claim.sub', b::text, true); EXECUTE 'SET LOCAL ROLE authenticated';
  IF (public.get_my_auth_capabilities()->>'has_password')::boolean THEN RAISE EXCEPTION 'OAuth-only mislabelled'; END IF;
  EXECUTE 'RESET ROLE'; EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.profiles;
  BEGIN PERFORM public.get_my_auth_capabilities(); RAISE EXCEPTION 'Anonymous auth internals exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN SELECT count(*) INTO n FROM public.profile_contacts; RAISE EXCEPTION 'Anonymous contacts exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  EXECUTE 'RESET ROLE';
END $test$;
ROLLBACK;
SELECT 'Passed privacy, ownership, profile save, role protection, email sync and password capability checks; fixtures rolled back' AS result;
