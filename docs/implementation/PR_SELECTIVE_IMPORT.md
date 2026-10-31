# Selective import from Moses’s feature branch

Source reviewed: feature/local-backend-connection at 3f57939. Staging remains authoritative. The original PR is not merged and no remote push/deployment is authorized by this work.

| Group | Decision | Implementation | Verification |
| --- | --- | --- | --- |
| Auth codes and compatibility fixes | Adapted onto staging; local checkpoint49d7482 | IMPLEMENTED | PASSED (focused fixtures + user-reported local acceptance; hosted pending) |
| Shared skeletons/shimmer | Import reusable skeletons and exact loading-class changes; retain screen/query logic | IMPLEMENTED | PARTIALLY_TESTED (types/lint/source; visual acceptance pending) |
| Status indicators | Adapted onto existing status precedence | IMPLEMENTED | PARTIALLY_TESTED (17 status tests; visual pending) |
| Meeting notifications | Adapted to staging query results and canonical lifecycle states | IMPLEMENTED | PARTIALLY_TESTED (focused fixtures/build passed; live/visual pending) |
| MyJooba→Jooba rebrand | Separate product/design decision; excluded | DEFERRED | NOT_TESTED |
| Auth layout/showcase/illustration redesign | Separate design decision; excluded | DEFERRED | NOT_TESTED |

Skeleton source: src/components/ui/skeleton.tsx and skeleton-only CSS from incoming globals.css. Existing placeholders in dashboard, shell, booking, calendar, admin, plan, onboarding and document screens receive only exact animate-pulse→jb-skel substitutions. Current capture/library lists and capture detail use shared labeled skeletons. No incoming auth/layout/page-title/copy change imported. No query/mutation, assistant-name, video, cancellation or consent behavior replaced.

Backend/live/browser/provider/production acceptance remains outside this local selective import. The wider PR still contains conflicting older implementations; do not resolve it by replacing staging files wholesale.

## Deferred design package — intentionally not imported

- `src/components/auth-layout.tsx`: incoming split-screen/auth field layout and sizing redesign.
- `src/components/auth-showcase.tsx`, `auth-stage.tsx`: incoming animated illustration/showcase and scaling component (not added).
- `src/components/ui/brand.tsx`, app metadata and branding copy: incoming MyJooba→Jooba rename.
- Auth/showcase-specific CSS and login typography/button restyling: excluded. Existing code-flow forms remain in staging's visual system.

These can be reviewed as a separate design package later; backend compatibility does not imply approval of them. No such design package is merged by this task.

## Final local validation

See evidence/2026-10-31-selective-import.md. Focused141tests and51-route production build passed. Existing screen lint diagnostics were compared against49d7482: one pre-existing top-bar error and seven warnings, no new rule/severity diagnostics. New skeleton/status/notification files passed targeted lint. Browser/live-provider verification remains pending. Query/mutation/upload client modules and auth/layout/brand files are unchanged from the auth checkpoint. The original feature branch was not merged.
