# V2 release

## Versioning

Development branch: `v2/release`.

Use `2.0.0-beta.N` for review builds and increase N for each published beta. Keep package.json and package-lock.json aligned. Use `2.0.0` and a matching `v2.0.0` Git tag only when the stable release checks pass. Never label a beta deployment as the stable release.

## Design system

React, TypeScript, Vite, Tailwind 3, and Supabase remain the application stack. Outfit is the display and interface typeface; Tajawal supports Arabic text. Font packages include their OFL licenses.

Colors, surfaces, feedback, and motion share semantic theme tokens in src/index.css. Jade is the interface accent. Buttons use 12px corners, cards 20px, and large editorial panels 24-28px. Navigation uses layer 40, menus 50, and dialogs 100. New controls support keyboard focus, labelled inputs, touch targets, and reduced motion.

The homepage uses a lightweight local geographic backdrop with light and dark variants. Community WebP images remain illustrative artwork, not documentary photos of listed venues or members. The interactive map remains on its dedicated route. See [HOMEPAGE_MAP.md](HOMEPAGE_MAP.md) for the geographic asset source and generation.

## Beta scope

Beta.6 coordinates the shared layouts, Play/Community/Messages/Account navigation, game-first account dashboard, public directories, event details, maps, messaging and organizer workspace. Sign-in and signup use the selected image-and-form desktop composition, with a focused form on smaller screens. Recovery, confirmation and account feedback stay compact. Required signup data remains email/password only.

Fields share persistent labels, contextual hints, validation after interaction, accessible errors, and normal/focused/disabled/pending states. Hover motion is restrained. The tournament editor is a dedicated route with grouped sections, explicit saving, failed-save preservation and unsaved-edit guards. Settings distinguish public details and private contact data.

The Shared Cup mark retains the original coffee/board idea with refined proportions, rim and handle. `/brand/` publishes color and monochrome vector downloads, PNGs, a construction diagram and usage guidance. `/privacy/` and `/terms/` are accessible without login in EN/FR/AR.

See [V2_BETA6_QA.md](V2_BETA6_QA.md) for the tested scope and remaining acceptance checks. The new marketing landing page, MFA, individual device management and PWA functionality remain later stages.

## Before stable 2.0.0

- Test real sign-up, email confirmation, sign-in, session restoration, sign-out, and recovery across devices against the test backend.
- Complete the player account, meetup, inbox, profile, and organiser journeys with the same interaction system.
- Validate registration, cancellation, waitlists, and permissions as authenticated players and organisers.
- Verify private profile fields and role permissions before expanding account capabilities.
- Validate French and Arabic content, keyboard navigation, and representative assistive technology.
- Measure the built deployment on mobile and desktop. Target LCP <= 2.5s, INP <= 200ms, and CLS <= 0.1 at the 75th percentile; lab measurements do not establish field performance.
- Map the deployed commit and environment to the intended test or production backend. A new design does not resolve a domain's browser security classification.

## Beta.8 account and workspace sprint

The short-lived `v2/account-workflows` branch coordinates through `v2/release`. Package and lockfile version: `2.0.0-beta.8`.

The account home groups My games, My events, My clubs and Settings. Existing dashboard, organizer, club management, profile, security and Discord URLs remain compatible. Platform tools are visible to administrators only. Permissions, ownership and database role boundaries remain unchanged.

Tournament creation starts as a draft. Submitting enters review; administrator approval publishes the event in the existing transaction. State-specific next actions explain this lifecycle. Waitlisted registrations remain visible without being presented as confirmed next games.

Club workspaces retain the selected club in the URL and a sticky context header across Events, Members, Teams and Discord. Owner-only Discord setup stays protected. The platform workspace starts at the complete approval queue; statistics, users and official Discord configuration are secondary views. Team and statistics data load when their views are opened.

Settings group public identity, private contact, sign-in controls and browser display preferences. Shareable public profile pages use an explicit field allowlist that excludes login email and private phone. Chess account links are labelled as user-provided and unverified.

See [V2_BETA8_QA.md](V2_BETA8_QA.md) for verification and [V2_BETA8_USABILITY.md](V2_BETA8_USABILITY.md) for participant tasks. The owner will test first and invite friends afterwards. Human acceptance remains pending; this is a preview release.

## Authentication development

Beta.4 introduces short email signup, optional profile settings, Google and Discord entry points, single-use callbacks, confirmation, recovery, password reset, email changes, and connected sign-in controls. The compatible profile migration is provided and applied to the isolated test backend. Playing and organizing share one profile; organizer activation does not grant administrator access. See [AUTH_SETUP.md](AUTH_SETUP.md) for migration, redirects, provider flags, identity linking, and email setup.

Provider enablement is separate from verified consent and account linking. Test complete email and social-provider journeys before stable release. Beta.6 separates private contact data with owner-only access and direct SQL regression coverage; validate those access rules again on the eventual production backend. Return users to their explicit action without registering them automatically.

## PWA sequence

1. Add a manifest, installable shell, offline explanation, and an update prompt.
2. Cache selected public events with a visible freshness indicator. Never put authenticated API responses, messages, profiles, tokens, or registration mutations in a shared service-worker cache.
3. Add opt-in reminders using persisted scheduling and Web Push, with timezone, permission, deduplication, and cancellation handling.
4. Support offline drafts if useful. Joining and cancelling events always require server confirmation.

## Discord sequence

Beta.6 was accepted on 2026-10-13; further UI refinement remains later work. Beta.7 adds Phase 1 tournament announcements on the short-lived `v2/discord-announcements` branch, coordinated through `v2/release`. One shared bot supports official and club destinations. Google/Discord sign-in remains separate from server consent and bot credentials. The isolated test backend has the integration migrations and three Edge Functions. See [DISCORD_PHASE1_PLAN.md](DISCORD_PHASE1_PLAN.md), [DISCORD_SETUP.md](DISCORD_SETUP.md) and [V2_BETA7_QA.md](V2_BETA7_QA.md). Slash commands, reminders, results, rankings and discovery remain later phases.
