# Admin Invitation On One Page — Design

## Intent

Let an invited person complete account setup, email verification, invitation acceptance, and admin sign-in from `/admin/accept-invite`. They should not need to discover a separate signup page or guess which email address the invitation targets.

## Current constraints

- The backend invite acceptance requires an existing account whose normalized email matches the invite and is verified.
- Existing public auth APIs support account creation, normal sign-in, and signed-in email-code verification.
- The accept endpoint grants staff role only after the token, signed-in user, verified email, pending state, and expiry all match.
- The frontend BFF uses separate normal and admin sessions. Invite acceptance uses the normal session; admin endpoints use the admin session.
- No schema or migration change is needed.

## Approaches considered

1. **One-page guided onboarding (selected):** validate the invitation token server-side, identify whether its recipient has an account, show only the relevant create-account or sign-in form, verify an email code inline, accept the invite, then establish an admin session. Reuses existing auth APIs and keeps the invitee on the requested page.
2. **Link to existing account pages:** less code, but sends the invitee away and fails the stated one-page requirement.
3. **Create an account automatically from the invite:** avoids sign-up controls but cannot safely establish a user password or prove control of the email before granting staff access.

## Design

- Add a rate-limited `POST /admin/staff/invites/lookup` accepting the token in a JSON body. It returns the invited email, role, expiry, and whether an account exists for that invite email, but only for a valid pending, unexpired token. It returns the generic `invalid_invitation` error for all other token states. The raw token is never returned, persisted, logged, or placed in a URL/query for this lookup. No endpoint accepts arbitrary email addresses to check account existence.
- Permit only this lookup route through the frontend BFF without a session. It remains same-origin and is protected by the backend auth rate guard. The accept route uses the invitee's normal session.
- On `/admin/accept-invite`, resolve the token once and clear it from the address bar. Show the locked invite email and only the relevant form: create account (name/password) if no account exists, or sign in (password) if one exists. If a new account races with lookup, handle `email_already_registered` by switching directly to sign-in. Registration requests a verification code. Sign-in and registration both establish the normal session.
- For an unverified account, provide a six-digit code form and resend-code action on the same page. Use existing APIs and their rate limits/cooldowns. Do not log or persist passwords, codes, or invite tokens.
- Existing passwordless/Google/Microsoft accounts need a password for the admin login API. Provide an inline set/reset-password path using the existing forgot-password, recovery-code exchange, and reset-password APIs; keep the returned reset token in memory only.
- After verified identity is established, submit the invite token to the existing accept endpoint. Then request an admin session using the supplied password; if that step fails, keep the accepted state and present admin sign-in on the same page without attempting acceptance again.
- Keep acceptance one-use and role assignment backend-authoritative. Never let the client choose the recipient email or role.

## Non-goals

- Password recovery redesign, changing admin roles, account/session schema changes, email template changes, or deployment.

## Acceptance criteria

- A new invitee can create a password account, enter a verification code, accept, and reach the admin area without leaving `/admin/accept-invite`.
- An existing invitee can sign in, verify if needed, accept, and reach the admin area on the same page.
- The page selects create-account or sign-in from the valid token lookup; it has no account-mode buttons and no arbitrary email-existence check.
- An existing passwordless provider account can set a password through inline recovery before admin sign-in, without leaving the page.
- Invalid, expired, cancelled, replaced, already-used, mismatched, or unverified invitations never grant staff access and produce clear safe guidance.
- Only the invitation's verified recipient can accept it; the API remains authoritative.
- Invite tokens, passwords, and verification codes are not logged or stored in browser persistence.
