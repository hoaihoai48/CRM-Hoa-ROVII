# Firestore Business Write Boundary — Remediation Plan

## Current decision

**Production gate: not fixed yet.** Do not claim business-data write integrity is secure until critical writes are moved behind a trusted server boundary and direct client writes are denied by rules.

The current browser services use Firebase Web SDK transactions to update both orders/{id} and materialized fields on customers/{id}. The current rules allow any active member to write entire documents. A client-side-only field allowlist cannot prove totals, line-item prices, state transitions, status history and customer aggregates are mutually consistent across documents.

## Why a rules-only patch is unsafe

- Allowing writes to customers for the order transaction also exposes the computed projection unless rules can independently verify it.
- getAfter() can inspect documents in a transaction but cannot enumerate and recompute an arbitrary customer's complete orders collection.
- Order edits change items and totals; status transitions change both order history and customer projections.
- Denying order/customer writes immediately would break the current UI because these services write through the Firebase Web SDK.

## Implemented first slice in PR #1 (not a full security fix)

- Added a Firebase Cloud Functions v2 callable named `updateOrderStatusSecure` in `functions/index.js`.
- The callable requires Firebase Authentication, reads `users/{uid}` on the server, and requires an active `admin` or `staff` membership for every mutation.
- The server enforces the order-status state machine, derives the history actor from the membership record rather than trusting the browser's `actorName`, and atomically writes the order status/history plus customer aggregate projection.
- The browser's `updateOrderStatus` service now calls this callable. The Auth, Firestore, and Functions emulators are configured together, and the integration suite checks trusted actor identity plus inactive/unauthenticated rejection.
- CI installs and syntax-checks the Functions package and audits its dependency tree separately.

**Important limitation:** this is only the status-mutation vertical slice. Order creation, order editing, aggregate repair, product/customer writes and direct Firestore rules have not all crossed the trusted boundary yet. Since current rules still allow active clients to write entire order/customer documents, this change alone does not close the production write-integrity vulnerability. Do not deploy/enforce the final rules or call the system secure until the remaining mutations are migrated and tested.

## Required migration

1. **Add a trusted mutation backend** using Firebase Cloud Functions callable/HTTPS endpoints (or a secured Next.js server endpoint using Admin SDK). Verify Firebase ID token, active membership and role on every request. Never trust actorName, price, totals, role or status supplied by the browser.
2. **Move order mutations** (createOrder, updateOrder, updateOrderStatus) to the backend. Re-read product prices and active status on the server; validate quantity, discount, status transition and order ownership/relationships; calculate totals server-side; atomically update order and customer aggregates.
3. **Move aggregate repair** (syncCustomerAggregates) behind a privileged server-only operation, or remove it from client-accessible code. It must not be a public arbitrary customer-field update.
4. **Adjust Firestore Rules only after the client migration**: allow active members to read business records; deny direct client creates/updates/deletes on orders; allow customer profile-only updates while requiring computed fields to remain unchanged; restrict aggregate fields to trusted Admin SDK paths (which bypass Firestore Rules).
5. **Add Emulator negative tests** proving direct active-member writes to order totals/status/history and customer aggregate fields are denied, while callable operations succeed for active members and fail for inactive/unauthenticated members.
6. **Deploy in stages**: deploy backend, switch UI service calls, verify Emulator and staging, then enforce deny rules. Do not expose production secrets to PR workflows.

## Release acceptance criteria

- A client cannot directly forge order summary totals, item unit prices, status, or status history.
- A client cannot directly change totalOrders, totalSpent, lastOrderDate, or orderSummaries.
- Server calculates order totals from current product records and validates allowed state transitions.
- Valid create/edit/status workflows pass integration tests end-to-end.
- Inactive and unauthenticated accounts cannot mutate business data.
- Production rules are enforced only after the UI no longer depends on direct client writes.
