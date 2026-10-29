> Historical hosted-provider audit. Current authentication uses internal backend sessions; see HANDOFF.md and ../calmasta-api/docs/implementation/modules/M1.md for the replacement and deployment requirements. Core profile/profession boundaries still apply.

# Login and welcome contract audit

Verdict: core login/signup/profile/welcome persistence is supported locally. Do not create password-login, password-reset or duplicate onboarding endpoints in Nest. Real retired identity provider configuration and hosted acceptance are still pending.

| Frontend action | Implemented support | Remaining work |
| --- | --- | --- |
| Login bootstrap | components/login.tsx GET /api/me; BFF resolves session + API GET /account/me | FE-A02: inspect onboarded before redirect; distinguish 401 from 503/config/network failure |
| Sign in / create account | GET /api/auth/login with safe returnTo; signup=1 requests hosted account creation | Hosted retired identity provider signup/verification settings and real proof; UI link presence alone is not proof |
| Callback | GET /api/auth/callback verifies state/PKCE/nonce/signature/UserInfo, immutable subject and verified email, writes encrypted DB session | Correct issuer/client/project/audience/HTTPS callback and migration/grants required |
| New-user routing | Callback uses API onboarded to choose /welcome; AppShell redirects incomplete profiles to /welcome | /welcome itself currently lacks robust 401/already-onboarded guards |
| Role step | saveProfile({role}) → PATCH /api/me → PATCH /account/me {profession} | Six role IDs match backend PROFESSIONS; never pass UI role as a workspace role |
| Timezone/completion | PATCH /api/me {timezone}; then {complete:true}; API validates IANA timezone and persists onboarded | Current welcome load errors still set loaded=true; gate completion and provide retry/sign-in states |
| Skip role | Role may remain null; complete:true is supported; backend derives default template | Do not invent mandatory employment/profession requirements |
| Profile name/timezone/output preference | BFF supports name, timezone, outputsOnly, role, complete | Empty/null name semantics already supported; no email/sub/isStaff/plan mutation |
| Sign out / all app sessions | POST /api/auth/logout {all:false/true}, matching Origin, local revoke plus provider revoke/logout attempt | All means CalMasta sessions, not every app using the IdP |
| Password management | Provider-hosted login/recovery is used | passwordUrl is missing from guaranteed profile shape; nullable/default or trusted provider-management link design needed |
| Avatar | UI has preparation/upload/delete client code | No avatar backend contract/BFF forwarding; request B-AUTH-02, keep feature unavailable |

## Field mapping that must stay explicit

Browser ProfileView.role is profession (consultant/founder/sales/coach/student/other/null). API /account/me.role is DB membership; BFF exposes it as workspaceRole. /api/me email/emailVerified come from verified session UserInfo; name is API-owned. Default templates are derived, not proof document-generation endpoints are available. isStaff stays DB-authoritative.

The BFF PATCH allowlist is role/name/timezone/outputsOnly/complete. It maps role → profession before Nest. `complete` accepts true, not a reset-to-false mechanism. Signup/password/email verification belong to retired identity provider, not a new frontend token/password store.

## Immediate next-agent work

FE-A02: preserve error/dirty state; redirect unauthenticated welcome users to login; send already-onboarded users onward; do not let failed initial profile loading masquerade as successful onboarding. On login bootstrap honor onboarded. Keep server safeReturnTo authoritative and reuse its security constraints; the client helper is only convenience.

FE-A03: normalize missing optional avatarUrl/passwordUrl as null until the agreed contract exists; make unsupported controls honest. Align welcome copy with available capture/transcript features, actual visible bot name and unimplemented deletion/document generation. These frontend repairs do not need new auth endpoints.

See backend [contract requests](../../../calmasta-api/docs/implementation/FRONTEND_CONTRACT_GAPS.md) for scoped extensions. No actual auth endpoint was added by this audit.
