# V2 beta.7 validation

Date: 2026-10-13. Base: accepted beta.6 (`6b1006f7`). Feature branch: `v2/discord-announcements`, coordinated release branch: `v2/release`. This remains a review beta. All backend changes target the isolated test project.

## Verified behavior

- 85 Vitest tests pass, including the ten opt-in live Supabase regressions. Seventeen Discord tests cover server/channel permission overwrites, tenant authorization before external calls, forged server selection, mention suppression, stable nonces, send-time eligibility, 403/429/transient errors, ambiguous transport and failure to persist a successful remote receipt.
- The rollback-only SQL suite passes against the isolated backend. It verifies tenant RLS and service-only operations, denial of forged/expired/reused OAuth state and hourly expiry cleanup, default-paused connections, approved-publication routing, opted-out/draft/cancelled events, first-publication deduplication, overlapping channel destinations, ownership/revision changes, retry exhaustion, explicit failed-only retry, disconnect and denied worker credentials. Fixtures and queue changes are rolled back.
- TypeScript and Deno checks pass. ESLint has zero errors; the existing ThemeContext fast-refresh warning remains.
- All three Edge Functions are active. Live unauthenticated settings/worker requests return 401; a callback without state is rejected. Browser settings require a verified user and tenant authorization.
- The owner completed separate Discord server consent, connected the test server, selected its announcement channel and sent one clearly labelled, quiet sample. Discord displays the bot message; backend history records `sent`, one attempt and a message ID. No credentials were read from the browser or copied from chat.
- The Vault-authenticated scheduler processed a harmless orphan queue job with HTTP 200 (`processed: 1`) and cleared it without sending a message. Cron is active; the selected test-club destination is explicitly saved and enabled. Other new destinations stay paused.
- The new settings route has no page/control overflow in 36 combinations: 320, 390, 768, 1024, 1440 and 1920 CSS pixels; EN/FR/AR; light/dark. The desktop view was inspected; Arabic mobile bounds were checked. In-app browser screenshot scaling limits the saved mobile image. Confirmation receives focus, Escape closes it and returns focus to the initiating button. Unsaved edits disable testing and invoke the existing navigation guard.

## Size comparison

Built with Vite 7.3.7, same frontend dependency stack as beta.6. No bot SDK or animation library was added to the browser.

| Resource                 |                     beta.6 |                     beta.7 |
| ------------------------ | -------------------------: | -------------------------: |
| Main JS                  | 493.90 kB / 140.74 kB gzip | 494.99 kB / 141.04 kB gzip |
| Shared CSS               |   58.05 kB / 12.48 kB gzip |   59.55 kB / 12.73 kB gzip |
| Lazy Discord settings JS |                     absent |    24.59 kB / 7.11 kB gzip |

Routes remain lazy, including the new integration route and its translations. Fonts are unchanged. These are bundle measurements, not proof of field loading performance or Core Web Vitals.

## Acceptance limits

The live Discord message used the explicit Test action. Publication routing is verified in Postgres and shared delivery execution is covered by tests; a scheduled announcement for a real approved tournament is not claimed from that sample. Official configuration denial is tested, but a real platform administrator and a second independent server have not completed their live acceptance journeys. Do not grant roles silently to satisfy those checks.

Full browser zoom, physical mobile keyboard and assistive-technology acceptance remain later checks for the new route. The native unsaved-change prompt required human dismissal in the in-app browser. The beta.6 route matrix is historical evidence, not a substitute for testing new functionality.

Security advisors show no new Discord warning-level findings. Private Discord tables intentionally have RLS with no browser policies and revoked browser privileges, so their informational no-policy notices are expected. Existing warnings remain for legacy functions and leaked-password protection; inspect them separately before stable release. See [database linter guidance](https://supabase.com/docs/guides/database/database-linter) and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

No automatic historical replay, slash commands, reminders, results, rankings, member discovery or Gateway service is included. Further UI refinement and stable V2 acceptance remain separate work.

## Release verification

Publish one coordinated beta.7 frontend build to the fork's Vercel test project and verify READY, commit SHA, public alias, entry assets, public policy pages and the isolated Supabase mapping. Keep bot credentials solely in backend secrets. Use [DISCORD_SETUP.md](DISCORD_SETUP.md) for operator setup and pause/retry procedures.
