# Account deletion: what the frontend is ready for

Settings > Delete account is fully built (button, confirmation dialog with type-DELETE, waiting / deleting / still-finishing
panel, cancel). It is switched off at the last step because the API has no deletion endpoints yet: `src/lib/plan-client.ts`
(`fetchDeletion`, `requestDeletion`, `cancelDeletion`) deliberately throws `feature_unavailable` without sending a request.
The dialog explains this and keeps the final button disabled.

## To switch it on

Add these endpoints (all for the signed-in account), then replace the three stubs in `plan-client.ts` with real calls:

| Call | Purpose | Success body |
| --- | --- | --- |
| `GET /account/deletion` | Current request, or `null` | `{ status, requestedAt, filesRemoved, filesFailed, canCancel, startsAt } \| null` |
| `POST /account/deletion` `{ "confirmation": "DELETE" }` | Start. Refuse unless `confirmation` is exactly `DELETE` | the same object, `status: "requested"` |
| `DELETE /account/deletion` | Cancel while `canCancel` is true | `204` |

`status` is one of `requested` (waiting, not removed yet, `startsAt` set), `in_progress`, `partial_failure`, `completed`, `cancelled`.

Rules the screens rely on: nothing is removed during `requested`, cancelling is allowed only then, an account is not reported
as deleted until every file is gone (`partial_failure` retries automatically), and only a one-way fingerprint of the email is
kept. The sidebar and banners re-read the status when the frontend fires the `calmasta:account-changed` event.
