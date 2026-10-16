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

**Important limitation:** this PR now denies direct client writes to orders and protects customer aggregate/identity fields in Firestore Rules. Emulator negative tests were added for forged order creation/status/totals/history and forged customer aggregates. This is a significant source-level boundary improvement, but the current head's CI must pass before it is considered verified. Product writes remain available to active members and still need a role/field-boundary decision; customer create/profile rules also need regression validation against every UI path. Do not deploy to production or claim the full system secure until CI passes and product/customer policy is explicitly reviewed.

## Required migration

1. **Add a trusted mutation backend** using Firebase Cloud Functions callable/HTTPS endpoints (or a secured Next.js server endpoint using Admin SDK). Verify Firebase ID token, active membership and role on every request. Never trust actorName, price, totals, role or status supplied by the browser.
2. **Move order mutations** (createOrder, updateOrder, updateOrderStatus) to the backend. Re-read product prices and active status on the server; validate quantity, discount, status transition and order ownership/relationships; calculate totals server-side; atomically update order and customer aggregates.
3. **Move aggregate repair** (syncCustomerAggregates) behind a privileged server-only operation, or remove it from client-accessible code. It must not be a public arbitrary customer-field update.
4. **Adjust Firestore Rules only after the client migration**: allow active members to read business records; deny direct client creates/updates/deletes on orders; allow customer profile-only updates while requiring computed fields to remain unchanged; restrict aggregate fields to trusted Admin SDK paths (which bypass Firestore Rules).
5. **Add Emulator negative tests** proving direct active-member writes to order totals/status/history and customer aggregate fields are denied, while callable operations succeed for active members and fail for inactive/unauthenticated members.
6. **Deploy in stages**: deploy backend, switch UI service calls, verify Emulator and staging, then enforce deny rules. Do not expose production secrets to PR workflows.

## Release acceptance criteria

- A client cannot directly forge order summary totals, item unit prices, status, or status history.
- A client cannot directly create/update/delete orders or change customer aggregate/identity fields through the client SDK (covered by Emulator negative tests).
- Server calculates order totals from current product records and validates allowed state transitions.
- Valid create/edit/status workflows pass integration tests end-to-end.
- Inactive and unauthenticated accounts cannot mutate business data.
- Production rules are enforced only after the UI no longer depends on direct client writes.
