# Discord integration — Phase 1 proposal

Status: architecture proposal for review after the current V2 UI release. No bot configuration, integration schema, Edge Functions or Discord messages are created by this proposal.

## Existing architecture

Qehwa Chess is a React/TypeScript Vite SPA hosted on Vercel. It uses Supabase Auth, Postgres/RLS and storage directly. The isolated test project has no deployed Edge Functions. Google and Discord account sign-in are working according to the test owner; account OAuth does not configure community servers.

Clubs have one `organizer_id`. Tournaments have `club_id`, `organizer_id` and a lifecycle status. Public RLS currently exposes published tournaments. Organizer-created publications pass through the existing administrator approval rule. There is no independent private-tournament visibility column today. Announcements must follow the actual persisted publication and visibility rules, not a frontend request to publish.

## Proposed shape

One bot application serves the official community and independent club servers. Supabase holds tenant configuration and delivery state; Edge Functions make authenticated Discord REST requests. There is no persistent Gateway connection or new frontend provider SDK in Phase 1.

- A server connection records scope (`official` or `club`), optional club ID, Discord guild/channel identifiers, enabled state, locale, announcement and notification preferences, connecting actor, timestamps and latest health result. Identifiers are stored configuration, never constants in code. Store Discord snowflakes as strings.
- Club connection/configuration is authorized by the authenticated user's ownership of that club; official settings require a platform administrator. An authenticated server function rechecks access for every connect, save, test and disconnect action. RLS exposes only the permitted settings and sanitized delivery status. Queue contents, OAuth states/tokens and worker internals are private and unavailable to browser roles.
- Only organizers with Manage Server authority in Discord can connect a server. Use a separate consent flow with `identify` and `guilds`, an expiring single-use state bound to the account and club, and server-side code exchange. Recheck club ownership at the callback. Treat callback guild IDs as hints and verify the user's guild authority and bot membership through Discord APIs. Discard short-lived OAuth credentials after verification; future reconnect/reconfiguration can request fresh consent.
- Bot installation requests only View Channel, Send Messages and Embed Links for the selected destination. Do not require Administrator, message content access or a user DM scope. Offer the shared bot installation link if missing; verify membership and effective channel permissions before enabling delivery.
- The dashboard places Discord under the selected club's Integrations area. Show disconnected, connecting, connected, missing permissions, disabled and failed states, plus explicit channel selection, save, test and disconnect. A test posts a clearly labelled sample only after the organizer clicks Test. Disconnect stops that tenant's future delivery and invalidates queued jobs; it does not remove the shared bot from another tenant or erase historic posts.

## Publication and reliable delivery

A database transaction detecting the first persisted transition into `published` writes an outbox event and delivery jobs for eligible configured destinations. This follows administrator approval, and also works for database/admin publication paths. The transaction does not call Discord or delay the app response.

Official destinations opt into eligible public tournaments. Club destinations announce only tournaments belonging to their club, with the club/event notification preference enabled. Never announce drafts, pending approval, cancelled, private or inaccessible events to a public destination. Private visibility is a future schema decision; if introduced, explicitly model eligible audiences before expanding delivery.

Use Supabase Queues with a restricted worker and Cron scheduling. Claim jobs with a visibility timeout/lease; recheck tournament publication, club ownership, enabled settings and channel permissions at send time. Use one delivery record per tournament/connection/publication type, a unique constraint, a stable Discord nonce and `enforce_nonce` for nearby retries. Store the returned message ID before acknowledging the queue. Do not promise exactly-once remote delivery: Discord nonce deduplication is time-limited. Ambiguous timeouts need reconciliation or an operator-visible uncertain state rather than unlimited blind reposts.

Handle Discord rate-limit headers/429 delays, temporary failures and bounded exponential retries. Permission/deleted-channel errors become actionable configuration failures; permanent failures and exhausted attempts remain visible for retry after correction. Escape user-supplied text, allow-list the event origin, suppress all mentions by default (`allowed_mentions.parse = []`) and apply the configured quiet notification flag. Include only public title, date/timezone, city/venue and the canonical event URL; never include participation lists or private contact data.

## Manual setup needed before implementation testing

1. Add `DISCORD_BOT_TOKEN` to Supabase Edge Function secrets, not a `VITE_` variable or a frontend build environment. It has not been read or copied during the UI release.
2. Provide the Discord Application/Client ID and set its Client Secret as a backend secret (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`). Existing Supabase login-provider settings do not automatically populate custom Edge Function secrets. Do not paste secrets into a chat or committed file.
3. Register the separate server-connection OAuth callback in the Discord Developer Portal. Its exact URL will be finalized with the reviewed function deployment. Store the allowed app origin and callback as backend configuration.
4. Allow server installation for independent club owners (Public Bot / Guild Install settings), and grant the minimum channel permissions above. No privileged Gateway intent or interactions public key is needed for this REST-only Phase 1.
5. Choose the official guild and announcement channel through the admin configuration screen; club organizers choose theirs through club settings. No server/channel ID is committed.
6. Configure the worker invocation secret and scheduler credentials server-side/Vault during deployment. Supabase's service credential remains confined to the restricted worker; browser requests use the logged-in user's verified token.

## Implementation and release order

After beta.6 acceptance, use a short-lived `v2/discord-announcements` branch from `v2/release`. Review schema/RLS and publication routing first, then add new CLI-created migrations, tenant connection functions and dashboard settings, then outbox/queue delivery. Apply only to the isolated test backend. Keep reviewable commits; publish the next beta only after integration acceptance. Do not label the integration stable automatically.

Tests must cover cross-club access denial, non-admin official configuration denial, forged/reused OAuth state, lost organizer/server permissions, revoked bot permissions, disabled preferences, hidden/unpublished events, publication races, duplicate jobs, Discord 429/403/404/timeouts, retry exhaustion, disconnect with queued work, sanitized logs, secret-free frontend bundles and a real announcement in an explicitly selected test channel. Preview tests require the owner to select that channel and authorize the sample post.

Phase 2 (commands, reminders, results) and Phase 3 (rankings, achievements, discovery) are not part of this proposal.

## Sources

- [Discord OAuth2 and state](https://docs.discord.com/developers/topics/oauth2)
- [Discord message creation, mentions and nonce](https://docs.discord.com/developers/resources/message#create-message)
- [Supabase Queues and Edge Functions](https://supabase.com/docs/guides/queues/consuming-messages-with-edge-functions)
- [Scheduling Edge Functions with Vault](https://supabase.com/docs/guides/functions/schedule-functions)
