# Firestore Business Write Boundary — Remediation Plan

## Current decision

**Production gate: not fixed yet.** Do not claim business-data write integrity is secure until critical writes are moved behind a trusted server boundary and direct client writes are denied by rules.

The current browser services use Firebase Web SDK transactions to update both orders/{id} and materialized fields on customers/{id}. The current rules allow any active member to write entire documents. A client-side-only field allowlist cannot prove totals, line-item prices, state transitions, status history and customer aggregates are mutually consistent across documents.

## Why a rules-only patch is unsafe

- Allowing writes to customers for the order transaction also exposes the computed projection unless rules can independently verify it.
- getAfter() can inspect documents in a transaction but cannot enumerate and recompute an arbitrary customer's complete orders collection.
- Order edits change items and totals; status transitions change both order history and customer projections.
- Denying order/customer writes immediately would break the current UI because these services write through the Firebase Web SDK.

## Implemented mutation paths in PR #1 (not a full security fix)

- Added Firebase Cloud Functions v2 callables in `functions/index.js`: `createOrderSecure`, `updateOrderSecure`, `updateOrderStatusSecure`, and `syncCustomerAggregatesSecure`.
- Each callable requires Firebase Authentication and checks the current active `admin`/`staff` membership inside the same Firestore transaction as the mutation.
- Create/edit operations re-read product documents on the server, validate quantity/price/discount constraints, calculate totals server-side, and atomically update the order and customer aggregate projection.
- Status changes enforce the state machine and derive history actor identity from the trusted membership record instead of trusting browser-provided `actorName`.
- Aggregate repair queries the authoritative orders collection on the server rather than accepting a client-provided projection.
- The browser services now route create, edit, status, and aggregate repair through these callables. Auth, Firestore and Functions emulators are configured together; tests cover aggregate invariants, server-side pricing behavior, actor spoofing, and inactive/unauthenticated status mutation rejection.
- CI installs and syntax-checks the Functions package and audits its dependency tree separately.

**Important limitation:** the Firestore rules still permit active clients to write order/customer/product documents directly. A malicious client can bypass the callables until the rules are tightened. The current tests do not yet prove direct writes to computed fields are denied, and customer/product create/profile paths still need a final field-boundary review. This work therefore does not close the production write-integrity gate by itself. Do not deploy restrictive rules until the legitimate UI flows and migration have been verified end-to-end.

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
