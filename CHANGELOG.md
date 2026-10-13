# Changelog

## 2.0.0-beta.7 — 2026-10-13

- Add tenant-scoped Discord server connection and announcement settings to club and admin workspaces, with explicit saves, EN/FR/AR feedback, test, disconnect and recent delivery status.
- Queue the first approved tournament publication for eligible official/club channels, with opt-out, quiet posts, mention suppression and overlapping-destination deduplication.
- Run delivery in Supabase Edge Functions using server-only credentials, Vault-authenticated Cron, bounded retries and visible uncertain delivery handling.
- Document separate Discord consent and deployment setup; extend privacy information and add permission, publication and delivery regressions.

## 2.0.0-beta.5

- Keep email-change feedback accurate when the backend confirms changes immediately or requires confirmation links.

## 2.0.0-beta.4

- Short email signup with optional profile details after account creation.
- Google and Discord entry points, connected sign-in controls, and single-use PKCE callbacks.
- Consistent confirmation, recovery, password reset, email change, and security screens.
- One account can play and enable organizing; existing registrations and messages stay together.
- Focused profile settings with optional sections, public-contact disclosure, and persistent save feedback.
- Integrate the approved Shared Cup logo, favicon, and touch icon.
- French and Arabic auth copy, keyboard controls, mobile layouts, and reduced-motion loading states.
- Add a compatible profile migration and regression coverage for callbacks, recovery, identity linking, and organizer participation.

Social-provider consent, email delivery, secure email changes, and cross-device recovery remain release checks against the configured backend. This is a test preview, not the stable 2.0.0 release.

## 2.0.0-beta.3

- Improve status badge contrast in the light theme.

## 2.0.0-beta.2

- Load the small homepage directly to prevent the route skeleton and footer from moving during startup.
- Preload the responsive hero image and show the main heading without an entrance delay.
- Reserve space for city shortcuts while event data loads.
- Keep route loading placeholders at least one screen tall.

## 2.0.0-beta.1

The first V2 preview introduces a shared visual system and redesigns the main discovery and authentication journeys.

- New responsive homepage with original chess artwork, upcoming events, city shortcuts, and community discovery.
- Consistent typography, jade palette, accessible controls, and light/dark themes.
- Mobile navigation with direct access to tournaments, meetups, the map, and the account.
- Searchable tournament catalogue with labelled filters and a recoverable empty state.
- Event pages place registration before secondary details on mobile.
- Sign-in and sign-up preserve the selected tournament, including refreshes and switching forms.
- Password visibility controls, autofill hints, associated form labels, and announced feedback.
- French and Arabic copy for the new surfaces, with right-to-left layouts.
- Self-hosted fonts, responsive WebP artwork, reduced-motion support, skeleton loading, and no homepage map downloads.

This is a prerelease. The stable 2.0.0 release follows full account, organiser, and deployment validation.
