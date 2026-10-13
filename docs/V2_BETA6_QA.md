# V2 beta.6 validation

Review build: `2.0.0-beta.6`, branch `v2/release`, checked on 2026-10-13. This is a preview for functional and visual acceptance, not stable 2.0.0.

## Environment and baseline

The source belongs to `boulahya01/qehwachess`; the test site is [qehwachess-test.vercel.app](https://qehwachess-test.vercel.app/). Its Vercel project is `qehwachess-test`, using the isolated Supabase project `wtbfmauzcomvhtxotnki`. Khalid's production hosting and database are outside this release.

The beta.5 comparison is commit `47dd08440161046d14f8911e7896d8eb092b0ecc`, verified against the previous test deployment. The private-contact and optional-profile migrations are applied to the isolated backend. Their recorded remote timestamps differ from the local filenames; match migration names and inspect history before applying to another environment. Do not replay them on this backend.

## Automated and database checks

- `npm run typecheck`: passed.
- `npm run lint`: no errors; the existing ThemeContext fast-refresh warning remains.
- `RUN_SUPABASE_TESTS=1 npm test`: 68 tests passed in 12 files, including 10 live read-only tournament integration cases.
- SQL suites `optional_auth_profiles.sql` and `private_profile_contacts.sql`: passed on the isolated database with fixtures rolled back. Coverage includes anonymous and other-user contact denial, public profile column exclusion, own contact access, atomic profile saves, confirmed-email synchronization, minimum signup, role injection denial, player/organizer participation and OAuth-only password availability.
- New frontend regressions cover validation after blur and correction, password mismatch feedback, failed-save preservation, preservation during background profile refresh, unsaved navigation, local/global sign-out, provider linking, missing capability information and preventing removal of the only usable provider in the UI.
- Production build passed. Routes, map and QR scanning remain lazy; no animation framework was added.

## Layout and interaction coverage

The route matrix contains 792 loaded-route checks: 22 routes × six widths (320, 390, 768, 1024, 1440 and 1920 CSS pixels) × EN/FR/AR × light/dark. There was no global page overflow or content outside the page bounds. Admin access-denied alerts were expected for the non-admin test account; these checks do not establish the full admin content journey.

Routes include home, casual games, tournaments and details, players, clubs and details, cities and details, map, messages, dashboard, profile, security, organizer, club management, tournament editor, administration, signin, signup and recovery. Seeded tournament/club/city details were loaded. Reset-password checks used the missing-link state, not a new live credential submission.

The public Privacy, Terms and Brand pages passed a separate 108-case language/theme/width matrix. Versioned static CSS/JS references avoid stale policy-page controls after a release. Download links include the refined color and monochrome marks, PNGs and construction diagram.

Desktop auth follows the selected community-image/form composition; smaller layouts hide the story panel. Arabic uses Tajawal, RTL alignment and LTR email/technical identifiers. Final visual inspection corrected password icon padding in both writing directions. Representative desktop, mobile and Arabic screenshots were reviewed.

Keyboard checks exercised opening Play with Enter, reaching its first link with Tab, and closing with Escape with focus returned. A short viewport simulated keyboard-reduced space for the email field; blur validation and correction remained visible. Unsaved state was visible while editing; accept/decline logic is covered by unit tests. Native browser-dialog dismissal still needs physical-browser acceptance testing.

These matrices check rendering bounds and loaded states. They do not replace review of every dialog, mutation, assistive technology, physical mobile keyboard or native 200% browser zoom.

## Authentication evidence and remaining acceptance

The owner reports working Google and Discord authentication. A human-assisted local Google callback was observed returning successfully. Callback, expired/missing recovery context, pending/error feedback and security controls have regression coverage. Live password/email changes, mail delivery to both inboxes, provider conflict/link/unlink combinations and cross-device recovery still require acceptance on the intended domain. The test backend currently has email autoconfirm enabled.

Existing Supabase advisories remain: legacy function search-path/execute permissions and disabled leaked-password protection. The new private-contact boundary was tested directly; this release is not a claim that every legacy backend advisory has been resolved. Review these before stable production use.

## Bundle comparison

Sizes are Vite build output, decimal kB. Gzip figures describe the built files, not an assertion about field loading performance.

| Resource             |                  beta.5 |                  beta.6 |
| -------------------- | ----------------------: | ----------------------: |
| Main JS              | 494.26 kB / 140.93 gzip | 493.90 kB / 140.74 gzip |
| Main CSS             |   49.09 kB / 10.74 gzip |   58.05 kB / 12.48 gzip |
| Arabic font weights  |               165.96 kB |                26.89 kB |
| Outfit variable font |                32.29 kB |                32.29 kB |

Arabic font delivery is approximately 84% smaller. The desktop auth illustration is the existing 79.33 kB local WebP. Performance acceptance still needs representative mobile/network lab runs and eventual LCP/INP/CLS field data; a warm browser reload cannot establish those percentiles.

## Release and next stage

Publish one coordinated beta.6 test preview from the final release commit, then verify its deployment SHA, entry assets, public pages and backend mapping. Stable V2 waits for functional and visual acceptance. The marketing landing redesign, MFA/device management, PWA and automatic account deletion remain later work.

[Discord Phase 1](DISCORD_PHASE1_PLAN.md) is an architecture proposal only. Implement it after UI acceptance, with tenant permissions, separate server consent, a publication outbox and durable queue delivery. No bot schema, function or announcement is included in beta.6.
