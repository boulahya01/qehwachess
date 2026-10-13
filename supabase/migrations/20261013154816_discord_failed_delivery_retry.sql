CREATE FUNCTION public.discord_retry_failed(p_connection uuid,p_delivery uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.discord_connections; d qehwa_private.discord_deliveries; t public.tournaments; message bigint;
BEGIN
  SELECT * INTO c FROM public.discord_connections WHERE id=p_connection FOR UPDATE;
  SELECT * INTO d FROM qehwa_private.discord_deliveries WHERE id=p_delivery AND connection_id=p_connection FOR UPDATE;
  SELECT * INTO t FROM public.tournaments WHERE id=d.tournament_id;
  IF c.id IS NULL OR d.id IS NULL OR d.kind<>'publication' OR d.status<>'failed'
    OR t.id IS NULL OR NOT coalesce(qehwa_private.discord_eligible(c,t),false) THEN RETURN false; END IF;
  UPDATE qehwa_private.discord_deliveries SET status='queued',attempts=0,claim_token=NULL,error_code=NULL,
    revision=c.revision,guild_id=c.guild_id,channel_id=c.channel_id,updated_at=now() WHERE id=d.id;
  SELECT * INTO message FROM pgmq.send('qehwa_discord_announcements',jsonb_build_object('delivery_id',d.id));
  UPDATE qehwa_private.discord_deliveries SET queue_message_id=message WHERE id=d.id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.discord_retry_failed(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.discord_retry_failed(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
