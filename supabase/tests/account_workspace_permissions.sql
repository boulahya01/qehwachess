BEGIN;
DO $test$
DECLARE
  owner_id uuid := gen_random_uuid(); other_id uuid := gen_random_uuid();
  staff_id uuid := gen_random_uuid(); player_id uuid := gen_random_uuid();
  event_id uuid := gen_random_uuid(); city_id uuid; n integer;
BEGIN
  SELECT id INTO city_id FROM public.cities LIMIT 1;
  IF city_id IS NULL THEN RAISE EXCEPTION 'A test city is required'; END IF;
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
    (owner_id,owner_id||'@example.invalid','{}'),(other_id,other_id||'@example.invalid','{}'),
    (staff_id,staff_id||'@example.invalid','{}'),(player_id,player_id||'@example.invalid','{}');
  UPDATE public.profiles SET role='organizer' WHERE id IN(owner_id,other_id);
  UPDATE public.profiles SET role='admin' WHERE id=staff_id;

  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.tournaments(id,title,organizer_id,city_id,start_date,end_date,venue,status,discord_announcements_enabled)
  VALUES(event_id,'Workspace regression fixture',owner_id,city_id,current_date+7,current_date+7,'Test only','draft',false);
  UPDATE public.tournaments SET status='pending' WHERE id=event_id;
  BEGIN
    UPDATE public.tournaments SET status='published' WHERE id=event_id;
    RAISE EXCEPTION 'Organizer bypassed review';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.tournaments(title,organizer_id,city_id,start_date,end_date,venue,status,discord_announcements_enabled)
    VALUES('Forbidden publication',owner_id,city_id,current_date+7,current_date+7,'Test only','published',false);
    RAISE EXCEPTION 'Organizer created a published event';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  PERFORM set_config('request.jwt.claim.sub',other_id::text,true);
  SELECT count(*) INTO n FROM public.tournaments WHERE id=event_id;
  IF n<>0 THEN RAISE EXCEPTION 'Another organizer read a pending event'; END IF;
  UPDATE public.tournaments SET title='Unauthorized edit' WHERE id=event_id;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'Another organizer changed the event'; END IF;

  PERFORM set_config('request.jwt.claim.sub',player_id::text,true);
  BEGIN
    INSERT INTO public.tournaments(title,organizer_id,city_id,start_date,end_date,venue,status,discord_announcements_enabled)
    VALUES('Forbidden player event',player_id,city_id,current_date+7,current_date+7,'Test only','draft',false);
    RAISE EXCEPTION 'Player created an organizer tournament';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  PERFORM set_config('request.jwt.claim.sub',staff_id::text,true);
  UPDATE public.tournaments SET status='published' WHERE id=event_id;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'Admin approval did not publish the event'; END IF;

  EXECUTE 'RESET ROLE'; EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.tournaments WHERE id=event_id AND status='published';
  IF n<>1 THEN RAISE EXCEPTION 'Published event not public'; END IF;
  EXECUTE 'RESET ROLE';
END;
$test$;
ROLLBACK;
SELECT 'Passed account workspace ownership, player restrictions, organizer review and admin publication; fixtures rolled back' AS result;
