# ROVII Order Workflow Integrity Audit

**Date:** 2026-11-21  
**Scope:** Order creation/edit/status lifecycle, Firestore Rules, status history, customer order projections and aggregate recomputation.  
**Environment:** GitHub Actions with isolated Firebase Auth/Firestore Emulators and synthetic records only.

## Executive result

S1 passes its required quality gates. The order service already used Firestore transactions and server-read product prices, but the original Firestore Rules allowed clients to bypass important service-level lifecycle guarantees. The changes in PR #9 move those guarantees into Rules and require the order's per-customer projection to remain coherent in the same transaction.

## Findings and changes

### 1. Initial order state and history

**Finding:** A client could create a structurally valid order with a status other than `new`, or an initial history entry inconsistent with the order status.

**Change:**
- New orders must begin with status `new`.
- The initial history list must contain exactly one valid entry.
- The initial history entry must also have status `new`.
- History entries are schema-checked for ID, status, timestamp, actor and optional note.

### 2. Status transition enforcement

**Finding:** Active staff could bypass the service state machine with direct Firestore writes.

**Change:**
- Allowed transitions are `new → confirmed/cancelled`, `confirmed → delivering/cancelled`, and `delivering → completed`.
- A transition must append exactly one matching history entry.
- The entire previous history list must remain an exact ordered prefix; replacing or reordering old entries is denied.
- Same-status content edits are permitted only while the order is `new` or `confirmed`.
- A lifecycle transition may change only `status` and `statusHistory`; it cannot smuggle item or financial changes into the transition.
- Delivering, completed and cancelled orders are immutable through client updates.

### 3. Customer projection consistency

**Finding:** A client could create or update an order without atomically updating the matching `customer.orderSummaries` entry.

**Change:**
- Rules use `getAfter()` to verify that the post-transaction customer document contains the order's matching ID, status, total and createdAt.
- Order creation, order edits and status transitions must therefore keep the order and its per-customer summary coherent in one transaction/batch.
- The service now refreshes status, total and createdAt in the matching projection during order edits/status changes, repairing stale per-order summary fields as part of the transaction.

This verifies the matching per-order projection. It does **not** prove that the customer's complete aggregate totals are mathematically correct across every order; Firestore Rules cannot conveniently recompute an unbounded collection. The trusted internal-team service transaction remains responsible for full aggregate calculation, with Emulator regression coverage.

### 4. Existing service behavior verified

- Product prices are re-read from Firestore inside the transaction; client-submitted prices are not trusted.
- Order totals are recalculated from validated quantities, current product prices, delivery fee and discount.
- Customer totals distinguish active orders from cancelled orders and completed revenue from non-completed orders.
- Aggregate repair reconstructs the order projection from source orders and removes a forged summary.
- Concurrent order creation and status mutations are covered by integration tests.

## Verification evidence

GitHub Actions: https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/44907652688

- ESLint: PASS
- TypeScript: PASS
- Firebase Emulator integration/invariant suite: PASS (all cases, including projection atomicity, state machine, history integrity, repair and concurrency)
- Playwright: **5/5 PASS**
  - Login form renders
  - Anonymous dashboard access is redirected
  - Invalid credentials are rejected
  - Active synthetic member signs in
  - Staff creates an order, edits it while new, confirms it, edits it while confirmed, starts delivery and completes it; totals, history and customer aggregates are verified against Emulator records
- Production build: PASS
- Vercel PR check: PASS

## Remaining risks / follow-up

1. `customer.orderSummaries` is an embedded growing array. Firestore document-size limits mean this design needs a threshold/scale-out plan before customer order volume becomes large.
2. Customer aggregate totals are maintained by trusted service transactions and repaired from source orders; the current Rules check matching per-order projection coherence, not a full aggregate recomputation.
3. The new-customer UI path creates the customer before the order transaction. If order creation later fails, a customer with zero orders can remain. S2 should decide whether this is acceptable or whether customer + order creation should be made atomic.
4. S2 should audit recipient/delivery details, delivery scheduling, order code, staff assignment and printable order view. Confirm business requirements before changing workflows or data contracts.

## Git / delivery state

- PR #8 (S0): https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/8 — open, not merged.
- PR #9 (S1): https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/9 — quality gates passed, not merged.
- PR #6 contains an earlier draft of status-transition Rules. PR #9 now includes a stronger implementation; do not merge both overlapping implementations. Review/retire PR #6 after PR #9 is accepted.
- No production credentials/data, billing changes, production deployment or merge were used/performed.
