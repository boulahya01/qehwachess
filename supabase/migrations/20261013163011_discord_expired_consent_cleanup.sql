-- Remove temporary server-picker results without requiring another OAuth flow.
CREATE FUNCTION qehwa_private.expire_discord_consent()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  DELETE FROM qehwa_private.discord_oauth WHERE expires_at < now();
  DELETE FROM qehwa_private.discord_rate_limits WHERE last_at < now()-interval '1 day';
END $$;
REVOKE ALL ON FUNCTION qehwa_private.expire_discord_consent() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('qehwa-discord-consent-cleanup','15 * * * *','select qehwa_private.expire_discord_consent()');
