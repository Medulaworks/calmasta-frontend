# Password reset by code: API contract

The sign-in screen resets a password with a **6-digit code** in three screens: email, code, new password. The frontend
is finished. The backend (`CALMASTA_API_URL`) must change before it works end to end; until then a person receives the
old "Reset password" link email and cannot use the code screens. The old link page (`/auth/reset-password?token=...`)
still works for emails already sent.

## What the person sees

1. **Forgot password?** on sign-in, then their email address, then **Send code**.
2. **Check your email**: six separate boxes. Typing, pasting and phone autofill all work. The code is checked as soon as
   the sixth digit is in; a wrong code shakes the boxes, clears them and shows an error. A **Send a new code** link
   appears after a 60 second cooldown; **Use a different email** goes back one step.
3. **Create a new password** (only reachable with a valid code): new password, confirm password, a live checklist
   (8+ characters, both match), then **Update password**.
4. Back on sign-in with "Your password was updated. Sign in with your new password."

The reset token from step 2 lives only in memory on the page: never in a URL, cookie or storage.

## Endpoints

The frontend proxies each call through its own server (`/api/auth/<name>`), which forwards the JSON body unchanged to
`POST /auth/<name>`.

### 1. `POST /auth/forgot-password` (request unchanged, email changes)

Request: `{ "email": "person@example.com" }`

- Always answer `200` with the same body, whether or not the address has an account (no account enumeration).
- If an account exists, email a **6-digit numeric code** (CSPRNG; store only a hash). It is valid for **10 minutes**,
  single use, and a newer request invalidates the older code.
- Rate limit per address and per IP; answer `429` when exceeded. The screen enforces a 60 second resend cooldown.

### 2. `POST /auth/verify-reset-code` (new)

Request: `{ "email": "person@example.com", "code": "123456" }`

- `200 { "resetToken": "<opaque string>" }` for a correct, unexpired code. Consume the code. The token is single use and
  valid for about **15 minutes**, bound to that account.
- Compare in constant time. Count wrong attempts per account; after **5** wrong attempts invalidate the code.
- Errors use the `code` field of the error body (the frontend reads it as `error`):

| Situation | Status | `code` | Message the screen shows |
| --- | --- | --- | --- |
| Wrong code, or unknown email (indistinguishable) | 400 | `invalid_code` | That code isn't right. Check the email and try again. |
| Code older than 10 minutes | 400 or 410 | `expired_code` | That code has expired. Send a new one below. |
| Too many wrong attempts, or rate limited | 429 | `too_many_attempts` | Too many attempts. Send a new code below. |

### 3. `POST /auth/reset-password` (existing endpoint, same body)

Request: `{ "token": "<resetToken>", "password": "new password" }`

This is the same shape the emailed-link flow already uses, so old links keep working with no change.

- `200 { "ok": true }`. Consume the token and revoke the person's existing sessions. Password rules as today (8 to 128).
- Expired or used token: `400` or `410`. The screen sends the person back to the first step with "Your reset session
  expired. Request a new code to continue."

## The email (this is what is wrong today)

The current email is branded "CalMasta" and says "This single-use link expires in one hour". It needs to become:

- Brand: **Jooba** (same wordmark and colours as the app), not CalMasta.
- Subject: `Your Jooba password reset code`
- Body, with the code large and monospaced so it is easy to read and copy:

  > We received a request to reset your Jooba password.
  >
  > **Your code is `482 915`**
  >
  > It expires in 10 minutes. If you didn't ask for this, you can ignore this email: your password hasn't changed.
  > Never share this code with anyone. Jooba will never ask you for it.

- Show the code as plain text, not an image, and set the 6 digits as `482915` in the text part so mail clients and
  phones can offer to autofill it. A link may stay as a fallback below the code.

## Frontend files

- `src/components/password-reset.tsx`: the three screens and their calls.
- `src/components/otp-input.tsx`: the six-box code field.
- `src/app/api/auth/verify-reset-code/route.ts`: the new proxy route; `src/server/auth/service.ts` allows it.
- `src/components/login.tsx`: opens the flow from "Forgot password?".
- `src/app/auth/reset-password/page.tsx` and `src/components/auth-account-action.tsx`: the old link page, unchanged.

---

# Email verification by code

The "Verify your email" screen (`/auth/verify-email`) also uses six boxes. It is checked as soon as the sixth digit is
entered, then shows "Email verified" and continues to setup. A verification link from an older email still works.

## Endpoints

### `POST /auth/verify-email` (existing endpoint, new body)

Request with a code: `{ "code": "123456" }`. The frontend sends it **with the signed-in session** (the proxy requires a
session whenever the body contains `code`), so the account comes from the session, not from the body.

- `200` marks the address verified and consumes the code.
- Same rules as the reset code: 6 digits, 10 minutes, single use, 5 wrong attempts invalidate it.
- Errors use the `code` field: `invalid_code` (400), `expired_code` (400 or 410), `too_many_attempts` (429).

The old form `{ "token": "..." }` (from an emailed link) keeps working and needs no session.

### `POST /auth/verify-email/resend` (existing)

Must now send a **new 6-digit code** (and invalidate the previous one). The screen allows one request every 60 seconds;
answer `429` if called faster than that.

### The email

Same layout and wording as the reset email, with the subject `Your Jooba verification code`, the code shown large, and
"It expires in 10 minutes." A link may stay as a fallback.

## Frontend files

- `src/components/verify-email.tsx`: the screen. `src/app/auth/verify-email/page.tsx` renders it.
- `src/server/auth/service.ts`: sends the session along with a `code` verification (tested in `service.test.ts`).
- `src/components/auth-account-action.tsx` still contains the old link-only verification branch. It is no longer used
  by any page and can be removed.
