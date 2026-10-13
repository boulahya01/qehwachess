# V2 release

## Versioning

Development branch: `v2/release`.

Use `2.0.0-beta.N` for review builds and increase N for each published beta. Keep package.json and package-lock.json aligned. Use `2.0.0` and a matching `v2.0.0` Git tag only when the stable release checks pass. Never label a beta deployment as the stable release.

## Design system

React, TypeScript, Vite, Tailwind 3, and Supabase remain the application stack. Outfit is the display and interface typeface; Noto Sans Arabic supports Arabic text. Font packages include their OFL licenses.

Colors, surfaces, feedback, and motion share semantic theme tokens in src/index.css. Jade is the interface accent. Buttons use 12px corners, cards 20px, and large editorial panels 24-28px. Navigation uses layer 40, menus 50, and dialogs 100. New controls support keyboard focus, labelled inputs, touch targets, and reduced motion.

The homepage loads responsive local WebP artwork. The community images are illustrative artwork, not documentary photos of listed venues or members. The interactive map remains on its dedicated route.

## Beta scope

Homepage, shared navigation and footer, tournament catalogue and cards, event page presentation, authentication presentation, and tournament return intent. Existing account, club, meetup, messaging, and organiser screens inherit the shared system; their workflows still require individual V2 design and validation.

## Before stable 2.0.0

- Test real sign-up, email confirmation, sign-in, session restoration, sign-out, and recovery across devices against the test backend.
- Complete the player account, meetup, inbox, profile, and organiser journeys with the same interaction system.
- Validate registration, cancellation, waitlists, and permissions as authenticated players and organisers.
- Verify private profile fields and role permissions before expanding account capabilities.
- Validate French and Arabic content, keyboard navigation, and representative assistive technology.
- Measure the built deployment on mobile and desktop. Target LCP <= 2.5s, INP <= 200ms, and CLS <= 0.1 at the 75th percentile; lab measurements do not establish field performance.
- Map the deployed commit and environment to the intended test or production backend. A new design does not resolve a domain's browser security classification.

## Authentication development

The current database requires city and chess profile data at sign-up. A shorter account flow needs a compatible profile migration before changing required frontend fields. Add Google or email OTP only after provider, redirects, production email delivery, identity linking, and recovery have been configured and tested. Return users to their explicit action without registering them automatically.

## PWA sequence

1. Add a manifest, installable shell, offline explanation, and an update prompt.
2. Cache selected public events with a visible freshness indicator. Never put authenticated API responses, messages, profiles, tokens, or registration mutations in a shared service-worker cache.
3. Add opt-in reminders using persisted scheduling and Web Push, with timezone, permission, deduplication, and cancellation handling.
4. Support offline drafts if useful. Joining and cancelling events always require server confirmation.
