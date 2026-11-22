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

Case M seeds 65 synthetic orders for one customer, with active, completed and cancelled statuses, then verifies:
- exact lifetime order count, completed spend, and latest active date after repair;
- projection compaction to at most 50 entries;
- an old order outside the projection can still transition and be edited without losing aggregate totals;
- cancelling the latest active order decrements the count and selects the next latest active date;
- a subsequent create keeps the projection bounded and increments totals correctly;
- Firestore Rules reject a forged customer projection containing 52 entries.

Existing smaller-history, transaction rollback, status lifecycle, aggregate repair, and concurrent create/status tests remain in place.

## 5. Verification status

- Branch: `fix/bounded-customer-order-projection`
- PR and CI status will be recorded here after the final branch head has completed all checks.
- No production data, deployment, billing, or destructive migration touched.
