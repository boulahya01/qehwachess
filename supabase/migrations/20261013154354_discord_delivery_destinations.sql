-- Retain the actual destination in history and deduplicate overlapping tenant routes.
ALTER TABLE qehwa_private.discord_deliveries ADD COLUMN guild_id text, ADD COLUMN channel_id text;
UPDATE qehwa_private.discord_deliveries d SET guild_id=c.guild_id,channel_id=c.channel_id FROM public.discord_connections c WHERE c.id=d.connection_id;
ALTER TABLE qehwa_private.discord_deliveries ALTER COLUMN guild_id SET NOT NULL, ALTER COLUMN channel_id SET NOT NULL;
CREATE UNIQUE INDEX discord_publication_destination ON qehwa_private.discord_deliveries(tournament_id,guild_id,channel_id) WHERE kind='publication';
CREATE FUNCTION qehwa_private.discord_snapshot_destination()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  SELECT guild_id,channel_id INTO NEW.guild_id,NEW.channel_id FROM public.discord_connections WHERE id=NEW.connection_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION qehwa_private.discord_snapshot_destination() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER discord_snapshot_destination BEFORE INSERT ON qehwa_private.discord_deliveries FOR EACH ROW EXECUTE FUNCTION qehwa_private.discord_snapshot_destination();
CREATE OR REPLACE FUNCTION qehwa_private.discord_on_publication()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.discord_connections; delivery uuid; message bigint;
BEGIN
  IF NEW.status<>'published' OR (TG_OP='UPDATE' AND OLD.status='published') THEN RETURN NEW; END IF;
  INSERT INTO qehwa_private.discord_publications(tournament_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN NEW; END IF;
  FOR c IN SELECT * FROM public.discord_connections ORDER BY CASE WHEN scope='official' THEN 0 ELSE 1 END,id LOOP
    IF NOT qehwa_private.discord_eligible(c,NEW) THEN CONTINUE; END IF;
    INSERT INTO qehwa_private.discord_deliveries(connection_id,tournament_id,kind,revision)
    VALUES(c.id,NEW.id,'publication',c.revision) ON CONFLICT DO NOTHING RETURNING id INTO delivery;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT * INTO message FROM pgmq.send('qehwa_discord_announcements',jsonb_build_object('delivery_id',delivery));
    UPDATE qehwa_private.discord_deliveries SET queue_message_id=message WHERE id=delivery;
  END LOOP;
  RETURN NEW;
END $$;

CREATE FUNCTION public.discord_delivery_history(p_connection uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT id,kind,status,attempts,message_id,error_code,created_at,guild_id,channel_id FROM qehwa_private.discord_deliveries WHERE connection_id=p_connection ORDER BY created_at DESC LIMIT 10) x;
$$;
REVOKE ALL ON FUNCTION public.discord_delivery_history(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.discord_delivery_history(uuid) TO service_role;
NOTIFY pgrst,'reload schema';
