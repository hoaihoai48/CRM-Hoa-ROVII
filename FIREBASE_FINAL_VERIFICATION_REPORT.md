# FIREBASE FINAL VERIFICATION REPORT

**Repository**: `hoaihoai48/CRM-Hoa-ROVII`  
**Branch**: `main`  
**Baseline SHA**: `814163630472fc8a7ad21d02f2b309a262271066`  
**Code under this review**: `c787a07ebcb89857da7f9e99440dbe9b1c89ed29`  
**Report status**: Updated after repair-utility and test-suite changes; full runtime verification is still required.  
**Audit date**: 2026-10-09

> SHA note: this report identifies the code commit reviewed. Its own report-sync commit is intentionally not written into the file because a commit cannot reliably contain its own final SHA.

## 1. Current verdict

### NOT YET VERIFIED — code changes committed, runtime gates not executed in this environment

The previous report marked several checks PASS against code commit `4460512`. The service and test suite have since changed, so those historical results must not be presented as verification of the current code.

The current review made these changes:

- Reworked `syncCustomerAggregates(customerId)` to stop blindly merging stale projection entries or automatically preferring projection status over the queried order.
- Added a bounded retry protocol: capture the customer's projection before querying `orders`, compare it inside a transaction, and retry the entire repair if the projection changed during the query/commit window.
- Changed Case H to call `syncCustomerAggregates()` directly after deliberately corrupting aggregate fields, then assert that the projection and aggregates are repaired from the `orders` collection.
- Added Case K for concurrent status updates, asserting that the persisted order and customer projection agree and aggregate fields match the final projection.

These are source-level changes. They have **not** been executed in the current environment.

## 2. Verification gates

| Gate | Current status | Evidence / next action |
|---|---|---|
| `npm run test:emulator` | **NOT RUN** | The current environment cannot clone the GitHub repository because network DNS access is unavailable. Run this command in the repository's normal development environment or CI and retain the complete log. |
| `npm run lint` | **NOT RUN on current code** | Prior report results predate the latest service/test edits. Re-run. |
| `npx tsc --noEmit` | **NOT RUN on current code** | Re-run after the latest edits. |
| `npm run build` | **NOT RUN on current code** | Re-run after the latest edits. |
| Repair utility direct test | **ADDED, NOT EXECUTED** | Case H now calls `syncCustomerAggregates()` directly. |
| Concurrent order creation | **TEST EXISTS, NOT RE-EXECUTED** | Cases I/J issue five concurrent creates for one customer. |
| Concurrent status updates | **TEST ADDED, NOT EXECUTED** | Case K runs two status transitions concurrently and checks persisted order/projection/aggregate consistency. |
| Firestore rules hardening | **LIMITATION REMAINS** | Existing rules allow any authenticated user to read/write documents. Client transactions do not prevent a signed-in client from directly writing inconsistent data outside these service functions. |

## 3. Repair algorithm and correctness boundary

`orders` remains the business source of truth. `customers/{customerId}.orderSummaries` is a transactional/materialized projection used by the normal create/status mutation flows, and `totalOrders`, `totalSpent`, and `lastOrderDate` are derived fields.

The Firestore Web SDK transaction cannot make the preceding collection query part of the same transaction. The repair utility therefore:

1. Reads the customer's current projection fingerprint.
2. Queries the customer's orders.
3. Opens a transaction and reads the customer again.
4. If the projection fingerprint changed, aborts that attempt and repeats the query rather than guessing which summary is newer.
5. If unchanged, replaces the projection with the queried orders and recomputes aggregate fields.
6. Stops after five changing attempts and reports an error instead of writing a potentially stale repair.

This protects against concurrent mutations that use the normal service paths, which atomically update the order and customer projection. It does **not** protect against direct authenticated writes to `orders` that bypass those service paths; the broad Firestore rules must be addressed separately if that threat must be prevented.

## 4. Scalability and known limitations

- Firestore documents have a 1 MiB maximum size. Storing every order summary in one customer document has a growth ceiling; any order-count estimate is only approximate because document encoding, field names, and other customer fields contribute to the size.
- This review does not redesign the projection schema or introduce Cloud Functions.
- Firestore rules currently permit reads and writes for any authenticated user. Application-level transactions are not a substitute for server-enforced write validation.
- No current-code lint, typecheck, build, or emulator result is claimed in this report until the commands are run and their logs are recorded.

## 5. Required closure steps

Run the following on the current `main` commit and attach the actual logs:

```bash
npm run test:emulator
npm run lint
npx tsc --noEmit
npm run build
```

If any command fails, fix the cause and rerun all gates affected by the change. If the emulator cannot start, record **BLOCKED** with the concrete environment error; do not report PASS based only on source inspection or prior commits.
