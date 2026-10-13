# 2.0.0-beta.8 verification

Target: the fork's isolated Qehwa Chess test application and Supabase project. No maintainer production project, auth provider configuration, schema policy or bot backend is changed by this sprint.

## Automated verification

- 107 tests passed, including the opt-in live integration tests (`RUN_SUPABASE_TESTS=1 npm test`).
- TypeScript and production build pass. ESLint has zero errors; the existing ThemeContext fast-refresh warning remains.
- New regression coverage checks account aliases, current destinations, staff access, club selection, ownership filters, public-field queries, tournament next actions, successful/failed approvals, failed roster loads, preserved team drafts and waitlisted next-game behavior.
- Direct SQL tests passed on the isolated backend: private profile contacts, optional auth profiles and account workspace permissions. Fixtures roll back. These verify private contacts, safe role defaults, organizer participation, denied privilege escalation, cross-organizer isolation and required admin publication.
- No migration, credential change, new frontend dependency or bot message is required by this release.

## Browser checks

The local organizer session covered homepage, account games/events/clubs, settings, profile editing, security, club events/members/teams, Discord settings, public profile and tournament editor. The matrix covers widths 320, 390, 768, 1024, 1440 and 1920 with EN/FR/AR and light/dark themes: 468 route-and-layout checks with no page overflow or load errors. A further 144 checks covered the final club and Discord refinements in both themes and all three languages. The test data includes empty lists and the cancelled Discord fixture; this is not a claim that every possible data state was visually tested.

Arabic uses Tajawal and RTL direction. Desktop Account opens by keyboard; Escape closes it and restores trigger focus. Reduced motion reduces transitions. Empty draft submission focuses the first invalid field and associates errors with inputs. Club selection is retained across links and Discord callbacks. Inaccessible club URLs do not silently fall back to another managed club.

One French club-events load exceeded the five-second test wait; a final English club-events load also exceeded the browser action deadline. Both rendered correctly in the next snapshot. Record these as loading observations for usability acceptance rather than treating them as failed routes or verified backend performance measurements.

Local screenshots and matrix records are kept outside the source repository in the task's beta8 artifact folder. Browser interaction checks use the actual isolated backend; staff behavior is covered by rendering tests and direct database checks. Live staff UI acceptance remains pending because the browser account is an organizer.

## Performance

Routes remain lazy. Detailed workspace translations load with the lazy pages. The hero requires one local SVG of 8,473 bytes for the chosen theme, with no initial map SDK or tile traffic. Existing font files are unchanged. The interactive map remains a lazy route and no animation framework is added.

Beta.7 main script: 494.99 KB / 141.04 KB gzip; CSS: 59.55 KB / 12.73 KB gzip. Beta.8 main script: 497.85 KB / 141.77 KB gzip; CSS: 65.48 KB / 13.82 KB gzip. The main script adds 0.73 KB gzip. Detailed workspace copy adds a separate lazy chunk of 11.90 KB / 3.92 KB gzip. Bundle size is a transfer comparison, not a field Core Web Vitals measurement.

## Pending acceptance

The owner will test first, then recruit players and an organizer using [the task sheet](V2_BETA8_USABILITY.md). No participant results have been invented. Live staff UI, physical mobile keyboards, native 200% browser zoom and assistive-technology acceptance remain device/session checks. Stable 2.0.0 still waits for functional and visual acceptance.

## Published test preview

Release source: `d60279ea283a135ea0330e8e11c161c09809b9f3` from `boulahya01/qehwachess`, coordinated through `v2/release` and available on `v2/account-workflows`.

Vercel test project `prj_uQoBmzYMaTFBfM5pZEcmfHceQlWH`, deployment `dpl_J3NqqRf4BMFQBjYt6CKgWJvNq8Qv`, is READY and assigned to [qehwachess-test.vercel.app](https://qehwachess-test.vercel.app/). The public entry `/assets/index-xBP6JUJ4.js` matches the local release build and references the isolated Supabase project `wtbfmauzcomvhtxotnki`. Homepage, both map variants, Privacy, Terms and Brand returned HTTP 200 anonymously.

Live organizer checks passed for account games/events/clubs, club events/members/teams, saved Discord connection status, settings and the public profile. The organizer is denied staff access and can return to the account home. Existing Discord deliveries remain intact; no additional announcement was sent.

A 720×500 layout check approximated the available layout space of a 1440px desktop at 200% zoom and kept account destinations accessible without overflow. It does not substitute for the pending native browser zoom check.

Verification notes are a documentation-only follow-up to the deployed release source above.
