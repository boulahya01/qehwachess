ALTER TABLE qehwa_private.discord_oauth ADD COLUMN return_origin text;
CREATE FUNCTION public.discord_set_return_origin(p_hash text,p_origin text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  UPDATE qehwa_private.discord_oauth SET return_origin=p_origin WHERE state_hash=p_hash AND NOT used AND expires_at>now();
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.discord_set_return_origin(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.discord_set_return_origin(text,text) TO service_role;
NOTIFY pgrst,'reload schema';
