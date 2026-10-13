// This allowlist deliberately excludes login email, private phone and role.
export const publicProfileFields =
  'id, full_name, username, avatar_url, bio, city_id, lichess_username, chesscom_username, fide_id, city:cities(id, name)';
