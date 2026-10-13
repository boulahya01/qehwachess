# Discord tournament announcements

Phase 1 uses one shared bot with separate official and club destinations. It needs no Gateway process, slash commands or privileged member-list intent. All credentials belong in Supabase Edge Function secrets, never `VITE_*` variables or browser code.

## Deployment

Apply the five `20261013` Discord migrations in order. They add tenant settings, a publication outbox, a private PGMQ queue, destination snapshots, explicit failed-delivery retries and trusted OAuth return origins. They are already applied to the isolated test project. Do not edit an applied migration.

Deploy `discord-integrations`, `discord-connect-callback` and `discord-announcement-worker` with the shared modules and `deno.json`. Their gateway JWT setting is disabled because they perform their own authentication: verified Supabase user tokens for settings, expiring single-use OAuth state for the callback, and a Vault-generated scheduler credential for the worker. Do not remove those checks.

Required Edge Function secrets:

- `DISCORD_BOT_TOKEN`: the bot token, rotated if exposed.
- `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`: the same Discord application. Supabase Authentication provider settings do not populate these custom secrets.
- `QEHWA_APP_ORIGIN`: the canonical HTTPS app origin, without a path, query or fragment.
- `QEHWA_ALLOWED_ORIGINS`: optional comma-separated additional exact origins for local development. Avoid wildcard origins. A trusted return origin is bound to each OAuth state server-side.

Register `https://<project-ref>.supabase.co/functions/v1/discord-connect-callback` in Discord Developer Portal → OAuth2 → General → Redirects. Keep the existing Supabase `/auth/v1/callback` entry for account login. Server connection separately requests `identify guilds`; it does not request email or permission to message as the user. Short-lived OAuth tokens are discarded after verification and revocation is attempted. The server-picker result expires after ten minutes and is removed when used; hourly Cron also removes expired results without requiring another connection attempt.

Enable installation on the intended servers in the Discord application settings. The install link requests only View Channel, Send Messages and Embed Links (19456). Check channel overrides as well as the bot role. The connecting Discord account must own the server or have Administrator/Manage Server authority; that authority and bot channel access are checked again before posting.

## Scheduler

The migrations generate `qehwa_discord_worker_secret` inside Vault. Operators do not need to copy it into a chat, file or client environment. Cron calls the private invoker once per minute when the queue has work. Configure the worker through a privileged SQL session in the intended backend:

```sql
SELECT public.discord_backend('worker_configure', jsonb_build_object(
  'url', 'https://<project-ref>.supabase.co/functions/v1/discord-announcement-worker',
  'enabled', true
));
```

This global switch enables queue processing, not every destination. Every new/reconnected destination starts paused without a channel. Platform admins configure the official destination; a club's owner configures its destination through Club workspace → Discord announcements. Choose a channel, language and notification preference, explicitly enable automatic announcements, and save. The Test control requires confirmation and posts a clearly labelled sample. Disconnect pauses future work without uninstalling the shared bot or deleting past Discord messages.

## Delivery behavior

Only the first persisted `published` transition creates jobs, after existing approval rules. Drafts, pending/cancelled events, other clubs and event opt-outs are excluded. Connecting a server does not replay older tournaments. Official and club routes to the same channel are deduplicated, with the official route taking precedence. Changes to saved configuration invalidate queued jobs through connection revisions.

The worker claims at most three jobs with a 120-second visibility lease, verifies current authorization and eligibility, then sends public title/date/venue/event links. Mentions are suppressed; quiet mode suppresses notification sounds. Private contacts and participant lists are excluded. The returned message ID is retained with its actual destination before acknowledging the queue.

Rate limits and transient pre-send failures get bounded retries, at most eight attempts. Permission/configuration failures remain visible. Correct the problem, save the destination, then explicitly retry a failed publication. Tests and uncertain sends cannot use that retry action. A timeout, ambiguous remote error or receipt-persistence failure becomes uncertain; inspect Discord before taking further action. Stable nonces reduce nearby duplicates but do not guarantee exactly-once remote delivery.

To pause processing, call the same `worker_configure` operation with `enabled: false`. Queued jobs remain available for later processing and will be revalidated. Tenant disconnect/opt-out invalidates future delivery; it does not retract messages already posted.

## Validation

Run `npm run typecheck`, `npm run lint`, and `RUN_SUPABASE_TESTS=1 npm test` with the isolated frontend environment. The opt-in tests do not use service-role credentials. Run `supabase/tests/discord_announcements.sql` through a privileged SQL session; its fixtures and queue writes are rolled back. Check functions with:

```sh
npx deno check --config supabase/functions/deno.json supabase/functions/discord-integrations/index.ts supabase/functions/discord-connect-callback/index.ts supabase/functions/discord-announcement-worker/index.ts
```

For live acceptance, an authorized organizer selects a test server/channel and approves a sample. Verify the Discord message, saved message ID and queue acknowledgment separately from unit-test results. Official-admin and independent-server acceptance require their respective operators; do not grant account roles merely to make a test pass.

References: [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2), [permissions](https://docs.discord.com/developers/topics/permissions), [message creation](https://docs.discord.com/developers/resources/message#create-message), [Supabase Queues](https://supabase.com/docs/guides/queues), [Cron](https://supabase.com/docs/guides/cron).
