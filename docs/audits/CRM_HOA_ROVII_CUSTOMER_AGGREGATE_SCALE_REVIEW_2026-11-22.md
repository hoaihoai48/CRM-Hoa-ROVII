# Customer Order Aggregate Scale Review — 2026-11-22

**Scope:** Bound the embedded customer order projection while preserving lifetime counters and the existing order/customer transaction invariants.  
**Environment:** Source audit and synthetic Firebase Emulator coverage only.  
**Production safety:** No production customer/order data was read or changed; no production migration or deployment.

## 1. Problem verified

The previous implementation stored every order summary in `customers/{customerId}.orderSummaries` and re-read/recomputed lifetime totals from that array on each create, status transition, and edit. The array grew with the customer's full lifetime order count and therefore risked exceeding Firestore's 1 MiB document limit. The same array was also the input to routine transaction calculations, making writes increasingly expensive as a customer's history grew.

The customer detail page already loads its full order history from the canonical `orders` collection through `listOrdersByCustomer(customerId)`; it does not need the embedded array to render history.

## 2. Implemented approach in this PR

- Keep `orders/{orderId}` as the canonical record and the existing customer scalar fields (`totalOrders`, `totalSpent`, `lastOrderDate`) as lifetime aggregates.
- Redefine `orderSummaries` as a bounded, internal projection rather than the lifetime source of truth.
- Keep up to 50 most recent active summaries. During a cancellation transition, retain the currently changed cancelled order as an additional entry so Firestore Rules can still verify the order/customer write pair; the hard maximum is 51.
- Small histories of 50 or fewer entries preserve their existing complete projection for backward compatibility.
- Create transactions increment `totalOrders` by one and keep completed spend unchanged.
- Status transactions update `totalOrders` and `totalSpent` using old/new status deltas. If the latest active order is cancelled, `lastOrderDate` is recomputed from the bounded active projection, which retains the next latest active order.
- Editing is only allowed for `new` / `confirmed` orders, so an edit updates the bounded summary row but does not alter lifetime count or completed spend.
- `syncCustomerAggregates()` remains the repair path: it scans canonical orders to rebuild exact lifetime totals, and compacts the embedded projection when it exceeds 50 entries.
- Firestore Rules reject newly created or changed projections larger than 51 entries and continue to require the changed order's exact summary in the same atomic write. Legacy oversized projections are still allowed through profile-only edits when the projection itself is unchanged; their next order mutation or aggregate repair compacts them.

## 3. Compatibility and trade-offs

- No schema migration or backfill is required. Existing customer fields remain unchanged; large arrays are compacted lazily by the repair function or the next order mutation.
- Historical order documents are never deleted or rewritten by this change.
- Customer order history remains complete because it is queried from `orders`, not from `orderSummaries`. Profile edits on legacy customers with an oversized array remain compatible until a repair or order mutation compacts that array.
- The scalar aggregate fields remain transactionally updated on the customer document. This reduces array growth and routine O(n) recomputation, but it does not remove contention on one very active customer's aggregate document.
- Firestore Rules still cannot independently prove the arithmetic of lifetime aggregates. Trusted client service transactions update them by deltas, Emulator tests exercise the transitions, and `syncCustomerAggregates()` can repair them from canonical orders.
- No Cloud Functions, paid Firebase products, or server-side triggers are introduced; this remains Firebase Spark-compatible.

## 4. Emulator regression coverage

Case N seeds 65 synthetic orders for one customer, with active, completed and cancelled statuses, then verifies:
- exact lifetime order count, completed spend, and latest active date after repair;
- projection compaction to at most 50 entries;
- an old order outside the projection can still transition and be edited without losing aggregate totals;
- cancelling the latest active order decrements the count and selects the next latest active date;
- a subsequent create keeps the projection bounded and increments totals correctly;
- Firestore Rules reject a forged customer projection containing 52 entries.

Existing smaller-history, transaction rollback, status lifecycle, aggregate repair, and concurrent create/status tests remain in place.

## 5. Verification status

- Branch: `fix/bounded-customer-order-projection`
- PR #14: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/14 — merged at `568083053d7311f6d5abbe608f3a100f0c803444`.
- Final PR CI #44985057671: PASS. Post-merge main CI #44985288167: PASS, including lint, typecheck, Firebase Emulator Case N, Playwright E2E and production build.
- Final test case label: Case N (the suite already had a separate Case M for admin staff management).
- No production data, deployment, billing, or destructive migration touched.


## 2026-11-23 architecture correction — canonical orders, scalar customer summary

The embedded `customers/{customerId}.orderSummaries` array is **not required** by the customer detail page: that page already reads paginated history from canonical `orders`. It is not a source of truth and must not be reintroduced as an order-history dependency.

The simpler target is:
- `orders/{orderId}` is the only canonical order/history record.
- Customer documents keep only three small display summaries: `totalOrders` (non-cancelled orders), `totalSpent` (completed-order total), and `lastOrderDate` (most recently placed order, even if later cancelled).
- Create/status transactions update those scalar values only. Editing order content does not change customer counters.
- Any aggregate repair reads canonical customer orders and updates only the three scalar values.
- Legacy `orderSummaries` fields already stored in Firestore are left untouched for backward compatibility; new application code must neither depend on nor maintain them. No production migration or data deletion is part of this change.

**Security trade-off (must remain explicit):** Firebase Spark client transactions cannot make client-computed cross-document financial arithmetic authoritative. Active internal staff are a trusted client population under this deployment model. Firestore Rules should enforce authentication, active membership, immutable customer identity fields, order shape, actor identity and legal status/history transitions. Do not imply that Rules prove the scalar arithmetic. If the threat model later includes untrusted staff or public order writers, revisit the write boundary with an approved trusted backend/billing plan.

**Verification status:** This is an architecture decision, not a completion claim. Do not mark the refactor complete until the focused diff, lint/typecheck, Firestore Emulator tests, Playwright and production build have passed on the exact PR head. Do not access production customer/order data or run migrations.
