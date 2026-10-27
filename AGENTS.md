# Mojooba / CalMasta frontend agent instructions

Follow docs/rules.md and docs/token-management.md. Begin API work with docs/implementation/README.md + HANDOFF.md + WORK_PLAN.md + only the target module. WORK_PLAN owns frontend criteria/status; backend criteria remain in the sibling calmasta-api/docs/implementation/WORK_PLAN.md. BACKEND_REFERENCE.md gives exact paths and source precedence.

Preserve existing code/worktree changes. Core auth/capture/library consumption already exists. Check source/OpenAPI before adding clients; a UI, type, fixture or proxy prefix is not an implemented service. Read AUTH_AUDIT.md before login/welcome/profile work. Use same-origin Next BFF routes and existing server/auth sessions; do not create browser token stores, password-login APIs or direct provider calls. UI role is profession, never authorization. Do not broaden proxy/public/admin access to hide absent backend contracts.

Keep implementation and verification separate using tracker statuses. At checkpoints update owning module + WORK_PLAN + HANDOFF and append JOURNAL (max five lines). Use only What was done (files + behavior), Proof (command + result + revision), What is NOT done, Next action (task ID + files). Evidence is for real implementation checks, never doc-validation output; no secrets, signed URLs, tokens or real private content.

Backend reference root: /Users/josiaharkson/Work/Medulaworks/calmasta-api (portable ../calmasta-api). Reading its plans/contracts is expected. Record unavailable endpoints in backend docs/implementation/FRONTEND_CONTRACT_GAPS.md, preserving canonical task ownership; do not edit backend runtime without explicit assignment. Never invent successful generation, deletion, purchases, calendar connections or bookings.

Free capture has no M2 dependency. Preserve consent/ownership/private media/idempotency and G01 guards. Do not enable live processing, choose product/demo allowances or rates, dispatch paid jobs, apply production migrations, commit/push/deploy, or run browser/simulator automation unless separately authorized. Test only disposable databases. Keep provider credentials/session secrets server-only and out of logs/Git. Preserve the existing visual system; this workflow is API consumption, not a redesign.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
