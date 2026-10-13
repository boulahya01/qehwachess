CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
SELECT pgmq.create('qehwa_discord_announcements');
REVOKE ALL ON SCHEMA pgmq FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA pgmq TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA pgmq TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA pgmq TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pgmq TO service_role;
ALTER TABLE pgmq.q_qehwa_discord_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pgmq.a_qehwa_discord_announcements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tournaments ADD COLUMN discord_announcements_enabled boolean NOT NULL DEFAULT true;
CREATE TABLE public.discord_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('official','club')),
  club_id uuid REFERENCES public.clubs ON DELETE CASCADE,
  guild_id text NOT NULL CHECK (guild_id ~ '^[0-9]{17,20}$'),
  guild_name text NOT NULL,
  channel_id text CHECK (channel_id ~ '^[0-9]{17,20}$'),
  channel_name text,
  connected_by uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  discord_user_id text NOT NULL CHECK (discord_user_id ~ '^[0-9]{17,20}$'),
  enabled boolean NOT NULL DEFAULT false,
  silent boolean NOT NULL DEFAULT true,
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en','fr','ar')),
  revision integer NOT NULL DEFAULT 1,
  health text NOT NULL DEFAULT 'connected',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'club' AND club_id IS NOT NULL) OR (scope = 'official' AND club_id IS NULL))
);
CREATE UNIQUE INDEX discord_club_connection ON public.discord_connections(club_id) WHERE scope='club';
CREATE UNIQUE INDEX discord_official_connection ON public.discord_connections(scope) WHERE scope='official';
ALTER TABLE public.discord_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.discord_connections FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.discord_connections TO authenticated;
GRANT ALL ON public.discord_connections TO service_role;
CREATE POLICY "Tenant can read Discord settings" ON public.discord_connections FOR SELECT TO authenticated
USING (
  (scope='club' AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=club_id AND c.organizer_id=(SELECT auth.uid())))
  OR (scope='official' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='admin'))
);

CREATE TABLE qehwa_private.discord_oauth (
  state_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('official','club')),
  club_id uuid REFERENCES public.clubs ON DELETE CASCADE,
  used boolean NOT NULL DEFAULT false,
  ticket_hash text UNIQUE,
  discord_user_id text,
  guilds jsonb,
  expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
);
CREATE TABLE qehwa_private.discord_publications (
  tournament_id uuid PRIMARY KEY REFERENCES public.tournaments ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE qehwa_private.discord_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.discord_connections ON DELETE CASCADE,
  tournament_id uuid REFERENCES public.tournaments ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('publication','test')),
  revision integer NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','checking','sending','retry','sent','failed','uncertain','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  queue_message_id bigint,
  claim_token uuid,
  message_id text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, tournament_id, kind)
);
CREATE INDEX discord_delivery_recent ON qehwa_private.discord_deliveries(connection_id,created_at DESC);
CREATE TABLE qehwa_private.discord_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  worker_url text,
  enabled boolean NOT NULL DEFAULT false
);
INSERT INTO qehwa_private.discord_settings DEFAULT VALUES;
CREATE TABLE qehwa_private.discord_rate_limits (
  user_id uuid REFERENCES public.profiles ON DELETE CASCADE,
  action text NOT NULL,
  last_at timestamptz NOT NULL,
  PRIMARY KEY(user_id,action)
);
ALTER TABLE qehwa_private.discord_oauth ENABLE ROW LEVEL SECURITY;
ALTER TABLE qehwa_private.discord_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE qehwa_private.discord_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE qehwa_private.discord_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE qehwa_private.discord_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA qehwa_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA qehwa_private TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA qehwa_private TO service_role;

CREATE FUNCTION qehwa_private.discord_assert_tenant(actor uuid, target_scope text, target_club uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF (target_scope='official' AND target_club IS NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND role='admin'))
    OR (target_scope='club' AND EXISTS(SELECT 1 FROM public.clubs WHERE id=target_club AND organizer_id=actor))
  THEN RETURN; END IF;
  RAISE EXCEPTION 'tenant_denied' USING ERRCODE='42501';
END $$;
REVOKE ALL ON FUNCTION qehwa_private.discord_assert_tenant(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION qehwa_private.discord_assert_tenant(uuid,text,uuid) TO service_role;

CREATE FUNCTION qehwa_private.discord_eligible(c public.discord_connections, t public.tournaments)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT c.enabled AND c.channel_id IS NOT NULL AND t.status='published' AND t.discord_announcements_enabled
    AND ((c.scope='official' AND EXISTS(SELECT 1 FROM public.profiles WHERE id=c.connected_by AND role='admin'))
      OR (c.scope='club' AND t.club_id=c.club_id AND EXISTS(SELECT 1 FROM public.clubs WHERE id=c.club_id AND organizer_id=c.connected_by)));
$$;
REVOKE ALL ON FUNCTION qehwa_private.discord_eligible(public.discord_connections,public.tournaments) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION qehwa_private.discord_eligible(public.discord_connections,public.tournaments) TO service_role;

CREATE FUNCTION qehwa_private.discord_on_publication()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.discord_connections; delivery uuid; message bigint;
BEGIN
  IF NEW.status<>'published' OR (TG_OP='UPDATE' AND OLD.status='published') THEN RETURN NEW; END IF;
  INSERT INTO qehwa_private.discord_publications(tournament_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN NEW; END IF;
  FOR c IN SELECT * FROM public.discord_connections LOOP
    IF NOT qehwa_private.discord_eligible(c,NEW) THEN CONTINUE; END IF;
    INSERT INTO qehwa_private.discord_deliveries(connection_id,tournament_id,kind,revision)
    VALUES(c.id,NEW.id,'publication',c.revision) RETURNING id INTO delivery;
    SELECT * INTO message FROM pgmq.send('qehwa_discord_announcements',jsonb_build_object('delivery_id',delivery));
    UPDATE qehwa_private.discord_deliveries SET queue_message_id=message WHERE id=delivery;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION qehwa_private.discord_on_publication() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER discord_on_publication AFTER INSERT OR UPDATE OF status ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION qehwa_private.discord_on_publication();

-- The scheduler credential is generated and retained in Vault, never returned.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='qehwa_discord_worker_secret') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'qehwa_discord_worker_secret');
  END IF;
END $$;
CREATE FUNCTION qehwa_private.discord_worker_authorized(token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT length(token)=64 AND EXISTS(
    SELECT 1 FROM vault.decrypted_secrets WHERE name='qehwa_discord_worker_secret'
    AND extensions.digest(token,'sha256')=extensions.digest(decrypted_secret,'sha256'));
$$;
REVOKE ALL ON FUNCTION qehwa_private.discord_worker_authorized(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION qehwa_private.discord_worker_authorized(text) TO service_role;

CREATE FUNCTION public.discord_backend(p_action text,p jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor uuid; target_scope text; target_club uuid; c public.discord_connections;
  f qehwa_private.discord_oauth; d qehwa_private.discord_deliveries; t public.tournaments;
  result jsonb; delivery_id uuid; next_status text; prev_rate timestamptz;
BEGIN
  IF p_action='worker_auth' THEN
    RETURN to_jsonb(qehwa_private.discord_worker_authorized(p->>'token'));
  ELSIF p_action='worker_configure' THEN
    IF (p->>'url') !~ '^https://[a-z]{20}\.supabase\.co/functions/v1/discord-announcement-worker$' THEN RAISE EXCEPTION 'invalid_worker_url'; END IF;
    UPDATE qehwa_private.discord_settings SET worker_url=p->>'url',enabled=(p->>'enabled')::boolean;
    RETURN 'true';
  ELSIF p_action='claim' THEN
    IF NOT EXISTS(SELECT 1 FROM qehwa_private.discord_settings WHERE enabled) THEN RETURN '[]'; END IF;
    SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') INTO result FROM pgmq.read('qehwa_discord_announcements',120,3) q;
    RETURN result;
  ELSIF p_action='oauth_consume' THEN
    UPDATE qehwa_private.discord_oauth SET used=true WHERE state_hash=p->>'hash' AND NOT used AND expires_at>now() RETURNING * INTO f;
    IF NOT FOUND THEN RAISE EXCEPTION 'expired_flow'; END IF;
    RETURN to_jsonb(f);
  ELSIF p_action='oauth_finish' THEN
    UPDATE qehwa_private.discord_oauth SET ticket_hash=p->>'ticket',discord_user_id=p->>'discord_user_id',
      guilds=p->'guilds',expires_at=now()+interval '10 minutes' WHERE state_hash=p->>'hash' AND used AND expires_at>now();
    IF NOT FOUND THEN RAISE EXCEPTION 'expired_flow'; END IF;
    RETURN 'true';
  ELSIF p_action IN ('prepare','arm','settle') THEN
    SELECT * INTO d FROM qehwa_private.discord_deliveries WHERE id=(p->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN
      IF p->>'msg_id' IS NOT NULL THEN PERFORM pgmq.delete('qehwa_discord_announcements',(p->>'msg_id')::bigint); END IF;
      RETURN 'null';
    END IF;
    IF p_action='prepare' THEN
      IF d.status='sending' THEN UPDATE qehwa_private.discord_deliveries SET status='uncertain',error_code='delivery_uncertain',updated_at=now() WHERE id=d.id; END IF;
      IF d.status NOT IN ('queued','retry','checking') THEN
        IF d.queue_message_id IS NOT NULL THEN PERFORM pgmq.delete('qehwa_discord_announcements',d.queue_message_id); END IF;
        RETURN 'null';
      END IF;
      SELECT * INTO c FROM public.discord_connections WHERE id=d.connection_id;
      SELECT * INTO t FROM public.tournaments WHERE id=d.tournament_id;
      IF c.id IS NULL OR c.channel_id IS NULL OR c.revision<>d.revision
        OR (c.scope='club' AND NOT EXISTS(SELECT 1 FROM public.clubs WHERE id=c.club_id AND organizer_id=c.connected_by))
        OR (c.scope='official' AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=c.connected_by AND role='admin'))
        OR (d.kind='publication' AND (t.id IS NULL OR NOT qehwa_private.discord_eligible(c,t))) THEN
        UPDATE qehwa_private.discord_deliveries SET status='skipped',error_code='no_longer_eligible',updated_at=now() WHERE id=d.id;
        IF d.queue_message_id IS NOT NULL THEN PERFORM pgmq.delete('qehwa_discord_announcements',d.queue_message_id); END IF;
        RETURN 'null';
      END IF;
      UPDATE qehwa_private.discord_deliveries SET status='checking',attempts=attempts+1,claim_token=gen_random_uuid(),updated_at=now() WHERE id=d.id RETURNING * INTO d;
      RETURN jsonb_build_object('delivery',to_jsonb(d),'connection',to_jsonb(c),'tournament',
        CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object('id',t.id,'title',t.title,'start_date',t.start_date,'end_date',t.end_date,'venue',t.venue) END);
    END IF;
    IF d.claim_token IS DISTINCT FROM (p->>'claim')::uuid THEN RETURN 'null'; END IF;
    IF p_action='arm' THEN
      SELECT * INTO c FROM public.discord_connections WHERE id=d.connection_id;
      SELECT * INTO t FROM public.tournaments WHERE id=d.tournament_id;
      IF c.id IS NULL OR c.channel_id IS NULL OR c.revision<>d.revision
        OR (c.scope='club' AND NOT EXISTS(SELECT 1 FROM public.clubs WHERE id=c.club_id AND organizer_id=c.connected_by))
        OR (c.scope='official' AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=c.connected_by AND role='admin'))
        OR (d.kind='publication' AND (t.id IS NULL OR NOT coalesce(qehwa_private.discord_eligible(c,t),false))) THEN
        UPDATE qehwa_private.discord_deliveries SET status='skipped',error_code='no_longer_eligible',updated_at=now() WHERE id=d.id;
        IF d.queue_message_id IS NOT NULL THEN PERFORM pgmq.delete('qehwa_discord_announcements',d.queue_message_id); END IF;
        RETURN 'false';
      END IF;
      IF d.status<>'checking' THEN RETURN 'false'; END IF;
      UPDATE qehwa_private.discord_deliveries SET status='sending',updated_at=now() WHERE id=d.id;
      RETURN 'true';
    END IF;
    next_status=p->>'status';
    IF next_status NOT IN ('sent','failed','uncertain','retry','skipped') THEN RAISE EXCEPTION 'invalid_status'; END IF;
    IF next_status='retry' AND (d.attempts>=8 OR d.kind='test') THEN next_status='failed'; END IF;
    UPDATE qehwa_private.discord_deliveries SET status=next_status,message_id=p->>'message_id',error_code=p->>'error_code',updated_at=now() WHERE id=d.id;
    IF next_status='failed' THEN UPDATE public.discord_connections SET health=coalesce(p->>'error_code','delivery_failed') WHERE id=d.connection_id; END IF;
    IF next_status='sent' THEN UPDATE public.discord_connections SET health='connected' WHERE id=d.connection_id; END IF;
    IF d.queue_message_id IS NOT NULL THEN
      IF next_status='retry' THEN PERFORM pgmq.set_vt('qehwa_discord_announcements',d.queue_message_id,greatest(1,least(3600,(p->>'delay')::integer)));
      ELSE PERFORM pgmq.delete('qehwa_discord_announcements',d.queue_message_id); END IF;
    END IF;
    RETURN to_jsonb(next_status);
  END IF;
  actor=(p->>'user_id')::uuid; target_scope=p->>'scope'; target_club=nullif(p->>'club_id','')::uuid;
  PERFORM qehwa_private.discord_assert_tenant(actor,target_scope,target_club);
  SELECT * INTO c FROM public.discord_connections WHERE scope=target_scope AND club_id IS NOT DISTINCT FROM target_club FOR UPDATE;
  IF p_action IN ('oauth_begin','test') THEN
    INSERT INTO qehwa_private.discord_rate_limits VALUES(actor,p_action,now()-interval '1 minute') ON CONFLICT DO NOTHING;
    SELECT last_at INTO prev_rate FROM qehwa_private.discord_rate_limits WHERE user_id=actor AND action=p_action FOR UPDATE;
    IF prev_rate>now()-interval '30 seconds' THEN RAISE EXCEPTION 'too_many_requests'; END IF;
    UPDATE qehwa_private.discord_rate_limits SET last_at=now() WHERE user_id=actor AND action=p_action;
  END IF;
  IF p_action='status' THEN
    SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM (
      SELECT id,kind,status,attempts,message_id,error_code,created_at FROM qehwa_private.discord_deliveries WHERE connection_id=c.id ORDER BY created_at DESC LIMIT 10) x;
    RETURN jsonb_build_object('connection',CASE WHEN c.id IS NULL THEN NULL ELSE to_jsonb(c)-'discord_user_id' END,
      'deliveries',result,'worker_ready',(SELECT enabled FROM qehwa_private.discord_settings));
  ELSIF p_action='oauth_begin' THEN
    DELETE FROM qehwa_private.discord_oauth WHERE expires_at<now();
    INSERT INTO qehwa_private.discord_oauth(state_hash,user_id,scope,club_id) VALUES(p->>'hash',actor,target_scope,target_club);
    RETURN 'true';
  ELSIF p_action IN ('pending','connect') THEN
    SELECT * INTO f FROM qehwa_private.discord_oauth WHERE ticket_hash=p->>'ticket' AND user_id=actor
      AND scope=target_scope AND club_id IS NOT DISTINCT FROM target_club AND expires_at>now() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'expired_flow'; END IF;
    IF p_action='pending' THEN RETURN jsonb_build_object('guilds',f.guilds,'discord_user_id',f.discord_user_id); END IF;
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f.guilds) g WHERE g->>'id'=p->>'guild_id') THEN RAISE EXCEPTION 'server_denied'; END IF;
    IF c.id IS NOT NULL THEN
      UPDATE public.discord_connections SET guild_id=p->>'guild_id',guild_name=p->>'guild_name',connected_by=actor,
        discord_user_id=f.discord_user_id,channel_id=NULL,channel_name=NULL,enabled=false,revision=revision+1,health='connected',updated_at=now() WHERE id=c.id
        RETURNING id INTO delivery_id;
    ELSE
      INSERT INTO public.discord_connections(scope,club_id,guild_id,guild_name,connected_by,discord_user_id)
      VALUES(target_scope,target_club,p->>'guild_id',p->>'guild_name',actor,f.discord_user_id) RETURNING id INTO delivery_id;
    END IF;
    DELETE FROM qehwa_private.discord_oauth WHERE state_hash=f.state_hash;
    RETURN to_jsonb(delivery_id);
  ELSIF p_action IN ('settings','test','disconnect','identity') THEN
    IF c.id IS NULL THEN RAISE EXCEPTION 'not_connected'; END IF;
    IF p_action='disconnect' THEN
      UPDATE public.discord_connections SET enabled=false,revision=revision+1,health='disconnected',updated_at=now() WHERE id=c.id;
      RETURN 'true';
    END IF;
    IF c.connected_by<>actor OR c.health='disconnected' THEN RAISE EXCEPTION 'reconnect_required'; END IF;
    IF p_action='identity' THEN RETURN to_jsonb(c); END IF;
    IF p_action='settings' THEN
      UPDATE public.discord_connections SET channel_id=p->>'channel_id',channel_name=p->>'channel_name',
        enabled=(p->>'enabled')::boolean,silent=(p->>'silent')::boolean,locale=p->>'locale',revision=revision+1,health='connected',updated_at=now() WHERE id=c.id;
      RETURN 'true';
    END IF;
    IF c.channel_id IS NULL THEN RAISE EXCEPTION 'choose_channel'; END IF;
    INSERT INTO qehwa_private.discord_deliveries(connection_id,kind,revision) VALUES(c.id,'test',c.revision) RETURNING id INTO delivery_id;
    RETURN to_jsonb(delivery_id);
  END IF;
  RAISE EXCEPTION 'invalid_action';
END $$;
REVOKE ALL ON FUNCTION public.discord_backend(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discord_backend(text,jsonb) TO service_role;

CREATE FUNCTION qehwa_private.invoke_discord_worker()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE worker_url text; token text;
BEGIN
  DELETE FROM qehwa_private.discord_oauth WHERE expires_at<now();
  SELECT s.worker_url INTO worker_url FROM qehwa_private.discord_settings s WHERE enabled;
  IF worker_url IS NULL OR NOT EXISTS(SELECT 1 FROM pgmq.q_qehwa_discord_announcements) THEN RETURN; END IF;
  SELECT decrypted_secret INTO token FROM vault.decrypted_secrets WHERE name='qehwa_discord_worker_secret';
  PERFORM net.http_post(url:=worker_url,headers:=jsonb_build_object('Content-Type','application/json','X-Qehwa-Worker-Secret',token),body:='{}'::jsonb,timeout_milliseconds:=60000);
END $$;
REVOKE ALL ON FUNCTION qehwa_private.invoke_discord_worker() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('qehwa-discord-announcements','* * * * *','select qehwa_private.invoke_discord_worker()');
NOTIFY pgrst,'reload schema';
