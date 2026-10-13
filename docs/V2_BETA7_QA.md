# V2 beta.7 validation

Date: 2026-10-13. Base: accepted beta.6 (`6b1006f7`). Feature branch: `v2/discord-announcements`, coordinated release branch: `v2/release`. This remains a review beta. All backend changes target the isolated test project.

## Verified behavior

- 85 Vitest tests pass, including the ten opt-in live Supabase regressions. Seventeen Discord tests cover server/channel permission overwrites, tenant authorization before external calls, forged server selection, mention suppression, stable nonces, send-time eligibility, 403/429/transient errors, ambiguous transport and failure to persist a successful remote receipt.
- The rollback-only SQL suite passes against the isolated backend. It verifies tenant RLS and service-only operations, denial of forged/expired/reused OAuth state and hourly expiry cleanup, default-paused connections, approved-publication routing, opted-out/draft/cancelled events, first-publication deduplication, overlapping channel destinations, ownership/revision changes, retry exhaustion, explicit failed-only retry, disconnect and denied worker credentials. Fixtures and queue changes are rolled back.
- TypeScript and Deno checks pass. ESLint has zero errors; the existing ThemeContext fast-refresh warning remains.
- All three Edge Functions are active. Live unauthenticated settings/worker requests return 401; a callback without state is rejected. Browser settings require a verified user and tenant authorization.
- The owner completed separate Discord server consent, connected the test server, selected its announcement channel and sent one clearly labelled, quiet sample. Discord displays the bot message; backend history records `sent`, one attempt and a message ID. No credentials were read from the browser or copied from chat.
- The Vault-authenticated scheduler first processed a harmless orphan queue job with HTTP 200 (`processed: 1`). After explicit approval for an additional post, the normal one-minute Cron delivered a labelled test tournament publication on its first attempt, recorded its Discord message ID and acknowledged the queue. Both Discord and the app delivery history display the message. Repeating publication through draft/published transitions retained exactly one outbox record and one delivery. The fixture was then cancelled with zero registrations and no remaining queue work. The selected test-club destination stays enabled; other new destinations start paused.
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

Live evidence covers the explicit Test action and a scheduled publication in the selected club channel. The scheduled fixture was published through a privileged SQL operation in the isolated test backend, without granting account roles. A real platform administrator has not completed the official configuration and dashboard approval journeys; a second independent server has not completed its live connection/delivery journey. Do not infer those journeys from the club test or grant roles silently to satisfy them.

Full browser zoom, physical mobile keyboard and assistive-technology acceptance remain later checks for the new route. The native unsaved-change prompt required human dismissal in the in-app browser. The owner completed that step; saved automatic/quiet preferences were retained and the temporary unsaved edit was discarded. The beta.6 route matrix is historical evidence, not a substitute for testing new functionality.

Security advisors show no new Discord warning-level findings. Private Discord tables intentionally have RLS with no browser policies and revoked browser privileges, so their informational no-policy notices are expected. Existing warnings remain for legacy functions and leaked-password protection; inspect them separately before stable release. See [database linter guidance](https://supabase.com/docs/guides/database/database-linter) and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

No automatic historical replay, slash commands, reminders, results, rankings, member discovery or Gateway service is included. Further UI refinement and stable V2 acceptance remain separate work.

## Release verification

The coordinated beta.7 frontend build is READY on the fork's Vercel test project from commit `0642e67c8612b21b0c307914a9b57a7bdea8be37`. The public alias is `https://qehwachess-test.vercel.app/`. Entry assets match the local build; Privacy, Terms and Brand return HTTP 200, and the bundle maps to the isolated Supabase backend. Subsequent acceptance-note changes do not publish another frontend release. Keep bot credentials solely in backend secrets. Use [DISCORD_SETUP.md](DISCORD_SETUP.md) for operator setup and pause/retry procedures.
