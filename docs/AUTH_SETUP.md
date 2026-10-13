# Authentication setup for V2

The application uses Supabase Auth with PKCE, one profile per authenticated user ID, and the same account for playing and organizing. Signup collects email and password; city, display name, username, and chess profiles can be added later. Organizer activation uses the existing self-update policy and never grants administrator access.

## Database compatibility

Apply `supabase/migrations/20261013033842_optional_auth_profiles_and_dual_participation.sql` before deploying this frontend to a new backend. It creates minimal profiles, ignores client-supplied roles at signup, synchronizes confirmed email changes, and permits organizer accounts to participate as players. Existing accounts are preserved. The migration is already applied to the isolated test backend.

Run `supabase/tests/optional_auth_profiles.sql` against a test database. Its account fixtures and mutations run inside a rolled-back transaction.

## Environment

The browser requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never expose provider secrets or service-role keys in Vite variables. Provider buttons are enabled per build with:

```env
VITE_GOOGLE_AUTH_ENABLED=true
VITE_DISCORD_AUTH_ENABLED=true
```

Enable each only after its corresponding provider is configured in that deployment's backend. No provider SDK is loaded by the frontend.

## Redirects and providers

Set the Supabase Site URL to the intended deployment origin. Add the application's callback to the redirect allow list, including its flow and optional tournament query parameters. For the isolated test site use `https://qehwachess-test.vercel.app/auth/callback**`; for local development use only the localhost/127.0.0.1 ports you run, for example `http://127.0.0.1:4174/auth/callback**`. Use exact origin restrictions rather than a wildcard across unrelated Vercel projects. Vercel serves the SPA at `/auth/callback` through the committed rewrite.

The callback registered with Google Cloud and Discord Developer Portal is the **Supabase** URL, `https://<project-ref>.supabase.co/auth/v1/callback`. The frontend callback is a separate redirect allow-list entry. Keep client secrets in Supabase provider settings. Discord login uses identity and email scopes; it does not request bot installation or access to community messages.

Authenticated connections use `linkIdentity` rather than starting another sign-in. Enable manual identity linking in Supabase if this action should be available. Supabase handles automatic identity linking for compatible verified identities; the frontend never merges accounts based on a typed email or display name. Test both same-email and different-email scenarios before stable release. Existing duplicate accounts require a separate reviewed migration; this release does not merge or delete them.

## Email and recovery

Configure and validate production SMTP before inviting real users. Enable email confirmation and secure email change before production use. The test backend currently has email autoconfirm enabled: signup opens the account directly. The confirmation screen appears when confirmation is required by the backend; email delivery is not proven by rendering that screen.

Default PKCE links must be opened in the browser that initiated the request. Explain this to users and test refresh, expiry, reuse, and missing verifier states. If cross-device links are required, configure reviewed token-hash email templates targeting `/auth/callback?token_hash=...&type=signup|recovery|email_change` and verify the complete journey. Unsupported invite links and legacy implicit-session URL fragments are not handled by this release; request a fresh link after upgrading.

Secure email change may require both inboxes. The security screen uses the authenticated account's current email and exposes a pending address separately. The database email field changes only when Supabase changes the authenticated user's email.

## Remaining production checks

- Real Google and Discord consent, callback, session refresh, logout, and linking on the intended domain.
- Signup and password reset delivery, reuse/expiry, password updates, and confirmation from both email inboxes.
- Complete profile privacy work: legacy `profiles` SELECT policies still expose email and phone. The contact field is labelled public; the UI does not make those fields private. Split private account data or apply a reviewed column-access design before production rollout.
- Existing Supabase advisory findings, including legacy function permissions and password protection, remain a separate hardening task. See the [Supabase database linter](https://supabase.com/docs/guides/database/database-linter).

References: [Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google), [Discord sign-in](https://supabase.com/docs/guides/auth/social-login/auth-discord), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [password flows](https://supabase.com/docs/guides/auth/passwords), and [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).
