# Backend reference and boundary

| Reference | Location |
| --- | --- |
| Frontend repository | `/Users/josiaharkson/Work/Medulaworks/calmasta-frontend` |
| Backend repository | `/Users/josiaharkson/Work/Medulaworks/calmasta-api` |
| Portable sibling reference from frontend root | `../calmasta-api` |
| Backend agent instructions | [AGENTS.md](../../../calmasta-api/AGENTS.md) |
| Backend workflow rules | [rules](../../../calmasta-api/docs/rules.md), [token management](../../../calmasta-api/docs/token-management.md) |
| Canonical backend criteria | [implementation/WORK_PLAN](../../../calmasta-api/docs/implementation/WORK_PLAN.md); backend root WORK_PLAN is only a pointer |
| Current backend state | [README](../../../calmasta-api/docs/implementation/README.md), [HANDOFF](../../../calmasta-api/docs/implementation/HANDOFF.md) |
| Implemented API contract | [OpenAPI](../../../calmasta-api/openapi/calmasta-api.json), [app wiring](../../../calmasta-api/src/app.ts) |
| Auth/profile implementation | [identity service](../../../calmasta-api/src/modules/identity/identity.service.ts), [profile DTO](../../../calmasta-api/src/modules/identity/profile.dto.ts), [M1](../../../calmasta-api/docs/implementation/modules/M1.md) |
| Frontend-driven backend requests | [FRONTEND_CONTRACT_GAPS](../../../calmasta-api/docs/implementation/FRONTEND_CONTRACT_GAPS.md) |
| Local core evidence | [capture flow](../../../calmasta-api/docs/implementation/evidence/2026-10-27-capture-ui.md), [library](../../../calmasta-api/docs/implementation/evidence/2026-10-27-library.md) |
| Provider gates | [demo milestones](../../../calmasta-api/docs/implementation/DEMO_MILESTONES.md), [R2 evidence](../../../calmasta-api/docs/implementation/evidence/2026-10-27-r2-object-access.md), [billing runbook](../../../calmasta-api/docs/runbooks/recall-billing.md) |

Use backend code and OpenAPI to confirm path, method, body, response, error and ownership policy before editing a consumer. The backend has 21 documented path templates at this audit; GET /ready checks a migration baseline, not full endpoint/provider readiness. Compare the running `/openapi.json` to the intended release before treating deployed 404s as a frontend bug.

The frontend agent may read backend source/plans as references. Keep implementation edits in the frontend unless explicitly assigned backend work. Record missing contracts in the linked backend gaps file; proposed contracts stay unavailable until backend source, OpenAPI and checks exist. Do not use an absent endpoint as a reason to invent successful data.

Browser → same-origin Next `/api/*` → server-side session/proxy → Nest API. `CALMASTA_API_URL` is server-only. Normal consumers never send provider keys or bearer tokens from browser code. Providers call the API's signed/authenticated webhooks directly, not through the frontend. Recall billing imports are operator CLI operations, never frontend/admin HTTP endpoints.

Backend G01/free policy governs all paid work. M2 commerce remains blocked and does not block Free auth/capture. Keep live mode and unapproved allowances unchanged. Current R2 object operations passed a real synthetic check; public settings/lifecycle control-plane proof and frontend CORS remain unverified (the user reports adding the lifecycle rule; CORS was deferred).
