# PENDING consumption

Tasks: FE-X02–FE-X07. [Acceptance and authoritative statuses](../WORK_PLAN.md) · [API readiness](../API_READINESS.md) · [Backend references](../BACKEND_REFERENCE.md).

Target files: src/lib/avatar-client.ts, documents-client.ts, calendar-client.ts, booking-client.ts, plan-client.ts, notifications-client.ts; src/components/admin/

These services have UI/client expectations but no implemented backend contracts. The readiness map and backend contract-request file own the exact blockers; proxy allowlists do not change that.

## Current checkpoint

- **What was done (files + behavior):** Source audited; existing implementation versus pending consumer/backend work recorded. No runtime edits in this documentation task.
- **Proof (command + result + revision):** Frontend e9ad534/backend 5b690cc source inspection; `python3 docs/implementation/validate.py` passed: 15 documentation files, 48 local links, 15 READY_LOCAL contract rows, 18 unique task IDs and six matching professions. Historical application evidence is linked from backend references, not rerun or promoted to live acceptance here.
- **What is NOT done:** Pending tasks and external gates listed in WORK_PLAN; no new application verification claimed.
- **Next action (task ID + files):** FE-X02–FE-X07 — await linked backend contracts; keep unavailable actions honest; stay within the listed target files and follow the cross-repository contract boundary.
