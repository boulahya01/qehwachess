BEGIN;
DO $test$
DECLARE a uuid=gen_random_uuid(); b uuid=gen_random_uuid(); admin uuid=gen_random_uuid();
  ca uuid=gen_random_uuid(); cb uuid=gen_random_uuid(); c1 uuid; c2 uuid; official uuid;
  event uuid=gen_random_uuid(); opted uuid=gen_random_uuid(); city uuid; tenant jsonb; job uuid; task jsonb; claim text; n integer; extra uuid; scenario text;
BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
    (a,'discord-a-'||a||'@example.invalid','{}'),(b,'discord-b-'||b||'@example.invalid','{"role":"admin"}'),(admin,'discord-admin-'||admin||'@example.invalid','{}');
  UPDATE public.profiles SET role=CASE WHEN id=admin THEN 'admin' ELSE 'organizer' END WHERE id IN(a,b,admin);
  SELECT id INTO city FROM public.cities LIMIT 1;
  INSERT INTO public.clubs(id,name,organizer_id) VALUES(ca,'Test A',a),(cb,'Test B',b);
  tenant=jsonb_build_object('user_id',a,'scope','club','club_id',ca);
  EXECUTE 'SET LOCAL ROLE service_role';
  BEGIN PERFORM public.discord_backend('status',tenant||jsonb_build_object('user_id',b)); RAISE EXCEPTION 'Cross-club access allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.discord_backend('status',jsonb_build_object('user_id',b,'scope','official')); RAISE EXCEPTION 'Non-admin official access allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.discord_backend('oauth_begin',tenant||jsonb_build_object('hash',repeat('a',64)));
  PERFORM public.discord_backend('oauth_consume',jsonb_build_object('hash',repeat('a',64)));
  BEGIN PERFORM public.discord_backend('oauth_consume',jsonb_build_object('hash',repeat('a',64))); RAISE EXCEPTION 'OAuth state replay allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'expired_flow' THEN RAISE; END IF; END;
  PERFORM public.discord_backend('oauth_finish',jsonb_build_object('hash',repeat('a',64),'ticket',repeat('b',64),'discord_user_id','100000000000000003','guilds','[{"id":"100000000000000001","name":"A"}]'::jsonb));
  BEGIN PERFORM public.discord_backend('connect',tenant||jsonb_build_object('ticket',repeat('b',64),'guild_id','200000000000000001')); RAISE EXCEPTION 'Forged guild accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'server_denied' THEN RAISE; END IF; END;
  c1=(public.discord_backend('connect',tenant||jsonb_build_object('ticket',repeat('b',64),'guild_id','100000000000000001','guild_name','A'))#>>'{}')::uuid;
  IF (SELECT enabled FROM public.discord_connections WHERE id=c1) THEN RAISE EXCEPTION 'New connection enabled automatically'; END IF;
  PERFORM public.discord_backend('settings',tenant||jsonb_build_object('channel_id','100000000000000004','channel_name','test','enabled',true,'silent',true,'locale','en'));
  INSERT INTO public.discord_connections(scope,club_id,guild_id,guild_name,channel_id,connected_by,discord_user_id,enabled)
    VALUES('club',cb,'200000000000000001','B','200000000000000004',b,'200000000000000003',true) RETURNING id INTO c2;
  INSERT INTO public.discord_connections(scope,guild_id,guild_name,channel_id,connected_by,discord_user_id,enabled)
    VALUES('official','300000000000000001','Official','300000000000000004',admin,'300000000000000003',true) RETURNING id INTO official;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub',a::text,true); EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.discord_connections WHERE id IN(c1,c2,official);
  IF n<>1 THEN RAISE EXCEPTION 'Connection RLS leaked another tenant'; END IF;
  BEGIN UPDATE public.discord_connections SET enabled=true WHERE id=c1; RAISE EXCEPTION 'Direct configuration write allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.discord_backend('claim'); RAISE EXCEPTION 'Browser could claim queue'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN SELECT count(*) INTO n FROM qehwa_private.discord_oauth; RAISE EXCEPTION 'Browser could read OAuth states'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub','',true); EXECUTE 'SET LOCAL ROLE service_role';
  INSERT INTO public.tournaments(id,title,city_id,club_id,organizer_id,start_date,end_date,venue,status)
    VALUES(event,'Test publication',city,ca,a,'2027-01-01','2027-01-02','Test venue','draft');
  IF EXISTS(SELECT 1 FROM qehwa_private.discord_deliveries WHERE tournament_id=event) THEN RAISE EXCEPTION 'Draft announced'; END IF;
  UPDATE public.tournaments SET status='published' WHERE id=event;
  SELECT count(*) INTO n FROM qehwa_private.discord_deliveries WHERE tournament_id=event;
  IF n<>2 OR EXISTS(SELECT 1 FROM qehwa_private.discord_deliveries WHERE tournament_id=event AND connection_id=c2) THEN RAISE EXCEPTION 'Wrong publication destinations'; END IF;
  UPDATE public.tournaments SET status='published' WHERE id=event;
  UPDATE public.tournaments SET status='draft' WHERE id=event;
  UPDATE public.tournaments SET status='published' WHERE id=event;
  IF (SELECT count(*) FROM qehwa_private.discord_deliveries WHERE tournament_id=event)<>2 THEN RAISE EXCEPTION 'Duplicate publication jobs'; END IF;
  INSERT INTO public.tournaments(id,title,city_id,club_id,organizer_id,start_date,end_date,venue,status,discord_announcements_enabled)
    VALUES(opted,'Opt out',city,ca,a,'2027-01-01','2027-01-02','Test venue','published',false);
  IF EXISTS(SELECT 1 FROM qehwa_private.discord_deliveries WHERE tournament_id=opted) THEN RAISE EXCEPTION 'Opted-out event announced'; END IF;
  SELECT id INTO job FROM qehwa_private.discord_deliveries WHERE tournament_id=event AND connection_id=c1;
  task=public.discord_backend('prepare',jsonb_build_object('id',job));
  claim=task#>>'{delivery,claim_token}';
  UPDATE public.tournaments SET discord_announcements_enabled=false WHERE id=event;
  IF public.discord_backend('arm',jsonb_build_object('id',job,'claim',claim))<>'false'::jsonb THEN RAISE EXCEPTION 'Send-time opt out ignored'; END IF;
  UPDATE public.tournaments SET discord_announcements_enabled=true WHERE id=event;
  SELECT id INTO job FROM qehwa_private.discord_deliveries WHERE tournament_id=event AND connection_id=official;
  task=public.discord_backend('prepare',jsonb_build_object('id',job)); claim=task#>>'{delivery,claim_token}';
  PERFORM public.discord_backend('arm',jsonb_build_object('id',job,'claim',claim));
  PERFORM public.discord_backend('prepare',jsonb_build_object('id',job));
  IF (SELECT status FROM qehwa_private.discord_deliveries WHERE id=job)<>'uncertain' THEN RAISE EXCEPTION 'Ambiguous send was replayed'; END IF;
  IF public.discord_retry_failed(official,job) THEN RAISE EXCEPTION 'Uncertain delivery could be blindly retried'; END IF;
  IF public.discord_retry_failed(c2,job) THEN RAISE EXCEPTION 'Cross-connection retry allowed'; END IF;
  -- Expired state cannot be consumed, even when it has never been used.
  UPDATE qehwa_private.discord_rate_limits SET last_at=now()-interval '1 minute' WHERE user_id=a AND action='oauth_begin';
  PERFORM public.discord_backend('oauth_begin',tenant||jsonb_build_object('hash',repeat('c',64)));
  UPDATE qehwa_private.discord_oauth SET expires_at=now()-interval '1 minute' WHERE state_hash=repeat('c',64);
  BEGIN PERFORM public.discord_backend('oauth_consume',jsonb_build_object('hash',repeat('c',64))); RAISE EXCEPTION 'Expired state accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'expired_flow' THEN RAISE; END IF; END;
  EXECUTE 'RESET ROLE';
  PERFORM qehwa_private.expire_discord_consent();
  IF EXISTS(SELECT 1 FROM qehwa_private.discord_oauth WHERE state_hash=repeat('c',64)) THEN RAISE EXCEPTION 'Expired consent retained after cleanup'; END IF;
  EXECUTE 'SET LOCAL ROLE service_role';
  -- Official and club routes to the same channel produce only one publication.
  UPDATE public.discord_connections SET guild_id='100000000000000001',channel_id='100000000000000004' WHERE id=official;
  extra=gen_random_uuid();
  INSERT INTO public.tournaments(id,title,city_id,club_id,organizer_id,start_date,end_date,venue,status)
    VALUES(extra,'Shared destination',city,ca,a,'2027-01-01','2027-01-02','Test venue','published');
  IF (SELECT count(*) FROM qehwa_private.discord_deliveries WHERE tournament_id=extra)<>1 THEN RAISE EXCEPTION 'Shared channel received duplicate jobs'; END IF;
  UPDATE public.discord_connections SET guild_id='300000000000000001',channel_id='300000000000000004' WHERE id=official;
  FOREACH scenario IN ARRAY ARRAY['cancelled','owner','revision','exhaustion'] LOOP
    extra=gen_random_uuid();
    INSERT INTO public.tournaments(id,title,city_id,club_id,organizer_id,start_date,end_date,venue,status)
      VALUES(extra,'Eligibility test',city,ca,a,'2027-01-01','2027-01-02','Test venue','published');
    SELECT id INTO job FROM qehwa_private.discord_deliveries WHERE tournament_id=extra AND connection_id=c1;
    IF scenario='cancelled' THEN UPDATE public.tournaments SET status='cancelled' WHERE id=extra;
    ELSIF scenario='owner' THEN UPDATE public.clubs SET organizer_id=b WHERE id=ca;
    ELSIF scenario='revision' THEN UPDATE public.discord_connections SET revision=revision+1 WHERE id=c1;
    END IF;
    task=public.discord_backend('prepare',jsonb_build_object('id',job));
    IF scenario<>'exhaustion' THEN
      IF task<>'null'::jsonb OR (SELECT status FROM qehwa_private.discord_deliveries WHERE id=job)<>'skipped' THEN RAISE EXCEPTION 'Eligibility guard failed: %',scenario; END IF;
    ELSE
      claim=task#>>'{delivery,claim_token}';
      UPDATE qehwa_private.discord_deliveries SET attempts=8 WHERE id=job;
      IF public.discord_backend('settle',jsonb_build_object('id',job,'claim',claim,'status','retry','error_code','discord_rate_limited','delay',30))<>'"failed"'::jsonb THEN RAISE EXCEPTION 'Retry exhaustion ignored'; END IF;
      IF NOT public.discord_retry_failed(c1,job) THEN RAISE EXCEPTION 'Corrected failed delivery could not be retried'; END IF;
      IF (SELECT status FROM qehwa_private.discord_deliveries WHERE id=job)<>'queued' OR (SELECT attempts FROM qehwa_private.discord_deliveries WHERE id=job)<>0 THEN RAISE EXCEPTION 'Explicit retry was not queued'; END IF;
      IF public.discord_retry_failed(c1,job) THEN RAISE EXCEPTION 'Already queued job was retried again'; END IF;
    END IF;
    IF scenario='owner' THEN UPDATE public.clubs SET organizer_id=a WHERE id=ca;
    ELSIF scenario='revision' THEN UPDATE public.discord_connections SET revision=revision-1 WHERE id=c1;
    END IF;
  END LOOP;
  PERFORM public.discord_backend('disconnect',tenant);
  IF (SELECT enabled FROM public.discord_connections WHERE id=c1) THEN RAISE EXCEPTION 'Disconnect left announcements enabled'; END IF;
  IF public.discord_backend('worker_auth',jsonb_build_object('token',repeat('0',64)))='true'::jsonb THEN RAISE EXCEPTION 'Forged worker authorization accepted'; END IF;
  EXECUTE 'RESET ROLE'; EXECUTE 'SET LOCAL ROLE anon';
  BEGIN SELECT count(*) INTO n FROM public.discord_connections; RAISE EXCEPTION 'Anonymous settings exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  EXECUTE 'RESET ROLE';
END $test$;
ROLLBACK;
