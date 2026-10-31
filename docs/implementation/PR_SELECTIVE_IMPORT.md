# Selective import from Moses’s feature branch

Source reviewed: feature/local-backend-connection at 3f57939. Staging remains authoritative. The original PR is not merged and no remote push/deployment is authorized by this work.

| Group | Decision | Implementation | Verification |
| --- | --- | --- | --- |
| Auth codes and compatibility fixes | Adapted onto staging; local checkpoint49d7482 | IMPLEMENTED | PASSED (focused fixtures + user-reported local acceptance; hosted pending) |
| Shared skeletons/shimmer | Import reusable skeletons and exact loading-class changes; retain screen/query logic | IMPLEMENTED | PARTIALLY_TESTED (types/lint/source; visual acceptance pending) |
| Status indicators | Adapt onto existing status precedence | IN_PROGRESS | NOT_TESTED |
| Meeting notifications | Adapt to staging query results and real lifecycle outcomes | NOT_STARTED | NOT_TESTED |
| MyJooba→Jooba rebrand | Separate product/design decision; excluded | DEFERRED | NOT_TESTED |
| Auth layout/showcase/illustration redesign | Separate design decision; excluded | DEFERRED | NOT_TESTED |

Skeleton source: src/components/ui/skeleton.tsx and skeleton-only CSS from incoming globals.css. Existing placeholders in dashboard, shell, booking, calendar, admin, plan, onboarding and document screens receive only exact animate-pulse→jb-skel substitutions. Current capture/library lists and capture detail use shared labeled skeletons. No incoming auth/layout/page-title/copy change imported. No query/mutation, assistant-name, video, cancellation or consent behavior replaced.

Backend/live/browser/provider/production acceptance remains outside this local selective import. The wider PR still contains conflicting older implementations; do not resolve it by replacing staging files wholesale.
