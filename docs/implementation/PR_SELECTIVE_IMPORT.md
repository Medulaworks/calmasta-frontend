# Selective import from Moses’s feature branch

Source reviewed: feature/local-backend-connection at 3f57939. Staging remains authoritative. The original PR is not merged and no remote push/deployment is authorized by this work.

| Group | Decision | Implementation | Verification |
| --- | --- | --- | --- |
| Auth codes and compatibility fixes | Adapted onto staging; local checkpoint49d7482 | IMPLEMENTED | PASSED (focused fixtures + user-reported local acceptance; hosted pending) |
| Shared skeletons/shimmer | Import reusable skeletons and exact loading-class changes; retain screen/query logic | IMPLEMENTED | PARTIALLY_TESTED (types/lint/source; visual acceptance pending) |
| Status indicators | Adapted onto existing status precedence | IMPLEMENTED | PARTIALLY_TESTED (17 status tests; visual pending) |
| Meeting notifications | Adapted to staging query results and canonical lifecycle states | IMPLEMENTED | PARTIALLY_TESTED (focused fixtures/build passed; live/visual pending) |
| MyJooba→Jooba rebrand | User approved separately on2026-10-31; visible copy/metadata only | IMPLEMENTED | PARTIALLY_TESTED (fixtures/build; visual pending) |
| Auth layout/showcase/illustration redesign | User approved separately on2026-10-31; adapted without auth-flow replacement | IMPLEMENTED | PARTIALLY_TESTED (fixtures/build/source review; visual pending) |

Skeleton source: src/components/ui/skeleton.tsx and skeleton-only CSS from incoming globals.css. Existing placeholders in dashboard, shell, booking, calendar, admin, plan, onboarding and document screens receive only exact animate-pulse→jb-skel substitutions. Current capture/library lists and capture detail use shared labeled skeletons. No incoming auth/layout/page-title/copy change imported. No query/mutation, assistant-name, video, cancellation or consent behavior replaced.

Backend/live/browser/provider/production acceptance remains outside this local selective import. The wider PR still contains conflicting older implementations; do not resolve it by replacing staging files wholesale.

## Separately approved design package — 2026-10-31

User explicitly approved importing Moses’s auth design and rebrand without changing logic after the earlier four selective commits. This supersedes the earlier design deferral.

- Imported auth-layout.tsx, auth-showcase.tsx and auth-stage.tsx from3f57939; reused existing theme and mark.
- Applied auth typography, spacing, fields and button styling to existing login, code-flow and legacy link screens using auth-styles.ts. Kept native visible/selectable code input and manual submission, rather than introducing a new OTP controller or auto-submission.
- Added showcase-only CSS; retained reduced-motion handling and hid SVG motion particles under reduced-motion preferences.
- Changed user-visible product copy, accessibility labels and page metadata to Jooba. Operational assistant-name copy is generic or policy-derived; no backend bot-name change.
- Kept `/MyJooba-leaf-*.png` assets and all existing preference/storage/event identifiers, session/API routes, auth state/controllers, OAuth handlers and request payloads. These are compatibility identifiers, not visible branding.
- Preserved Google/Microsoft handlers, recovery success/return behavior, current six-digit string sanitization, resend cooldowns, token memory handling and legacy links. Shared AuthLayout now presents legacy reset/change-password screens as well.

Current design changes are local/uncommitted; no original-PR merge, push or deployment. Visual/browser acceptance remains pending. See evidence/2026-10-31-auth-design-import.md.

## Prior selective checkpoint validation

See evidence/2026-10-31-selective-import.md. Focused141tests and51-route production build passed. Existing screen lint diagnostics were compared against49d7482: one pre-existing top-bar error and seven warnings, no new rule/severity diagnostics. New skeleton/status/notification files passed targeted lint. Browser/live-provider verification remains pending. Query/mutation/upload client modules and auth/layout/brand files are unchanged from the auth checkpoint. The original feature branch was not merged.
