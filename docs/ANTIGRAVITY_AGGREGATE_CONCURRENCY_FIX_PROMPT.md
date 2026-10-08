# Antigravity — Fix Aggregate Concurrency Correctly

## Context

Current latest source commit:
`8068b2ce77be34aad5b773fd8b10990a0e8a6e33`

Current problem:

`createOrder()` and `updateOrderStatus()` now recompute aggregates from orders, but they call `getDocs(customerOrdersQuery)` OUTSIDE the Firestore transaction and then use that stale snapshot inside `runTransaction()`.

Therefore the current implementation is NOT concurrency-safe and must NOT be reported as an atomic source-of-truth invariant.

Example race:

T1 reads A,B
T2 reads A,B
T1 creates C and writes aggregate A+B+C
T2 creates D and writes aggregate A+B+D

Actual orders: A,B,C,D
Customer aggregate may end at 3 instead of 4.

## Objective

Fix this correctly. Do not return to delta-based aggregate updates.

Do not redesign UI.
Do not add unrelated features.
Do not change Firestore security rules in this task.
Do not use production destructive tests.

---

# 1. First audit the Firestore SDK constraints

Inspect:

- package.json
- installed Firebase version
- current Firestore transaction API
- `src/lib/services/orders.ts`

Determine exactly what the installed Web SDK supports for transactional query reads.

Do NOT assume `tx.get(query)` is supported.

Do NOT claim concurrency safety until the implementation actually provides it.

---

# 2. Required correctness model

The business invariant remains:

```
totalOrders =
  count(order where customerId == X
        and status != "cancelled")

totalSpent =
  sum(order.summary.total
      where customerId == X
      and status == "completed")

lastOrderDate =
  max(order.createdAt
      where customerId == X
      and status != "cancelled")
```

Customer aggregate fields are derived data only.

Never use the existing customer aggregate as the source of truth.

---

# 3. Concurrency-safe design

Choose the safest design supported by the CURRENT architecture and installed SDK.

### Preferred design

If Firestore transaction query reads are genuinely supported and type-safe in the installed SDK:

- move the customer-orders query INTO the transaction;
- perform all reads before writes;
- recompute aggregates from those transactional reads;
- ensure Firestore transaction retries on concurrent changes.

### If transaction query reads are NOT supported

Do NOT fake atomicity.

Choose a design that genuinely preserves correctness under concurrency.

Possible acceptable architecture:

- Make order creation/status transition transactionally update a source-of-truth structure whose document(s) can be transaction-read.
- Or maintain a customer order index / aggregate source document where all relevant order state is transactionally represented.
- Or use a backend-authoritative aggregation mechanism if already supported by the repository.

However:

**Do not introduce Cloud Functions or a major backend migration unless it is actually necessary and you clearly document why.**

Before choosing a new structure, inspect the existing schema and minimize scope.

---

# 4. Important constraint: no stale preflight snapshot

This pattern is forbidden:

```ts
const existingOrders = await getDocs(...);

return runTransaction(db, async (tx) => {
  ...
  // using existingOrders here
});
```

Likewise forbidden:

- query outside transaction followed by transaction write;
- optimistic calculation from stale customer aggregate;
- delta-only aggregate repair;
- post-transaction aggregate sync;
- swallowing aggregate update failure.

---

# 5. createOrder()

Required behavior:

1. Validate input.
2. Begin authoritative transaction/operation.
3. Verify customer.
4. Verify products.
5. Calculate order.
6. Update order/source-of-truth.
7. Recompute customer aggregate from authoritative order state.
8. Commit atomically.

Concurrent order creation for the same customer must result in:

If A, B exist and C + D are created concurrently:

```
totalOrders = 4
```

not 3.

---

# 6. updateOrderStatus()

Required:

- status transition and aggregate update must be concurrency-safe;
- concurrent status updates involving same customer must not lose an aggregate change;
- `lastOrderDate` must remain correct if the latest active order is cancelled;
- `totalSpent` must reflect completed orders only.

Example:

A = completed 100
B = delivering 200

After B → completed:

totalSpent = 300

Even if another valid order operation occurs concurrently, the final aggregate must reflect all committed orders.

---

# 7. Do not trust previous report

The existing report currently says:

`Customer Aggregate Invariant = PASS`

That claim must be reconsidered after the new implementation.

Only mark PASS if the implementation actually satisfies concurrency semantics.

---

# 8. Tests / verification

Create a deterministic test or emulator-compatible verification if the repository can support it.

At minimum verify:

### A
No existing orders → create.

### B
2 active + 1 cancelled → create.

### C
Completed order → create.

### D
new → confirmed.

### E
confirmed → delivering.

### F
delivering → completed.

### G
new → cancelled.

### H
Customer aggregate deliberately incorrect → operation repairs it.

### I — concurrency
Two concurrent creates for same customer.

Expected:
- both orders exist;
- totalOrders includes both;
- lastOrderDate is correct;
- no lost update.

### J — concurrency status
Two independent valid operations for same customer.

Expected:
- no aggregate lost update.

If emulator cannot run:

- static correctness may be reported;
- runtime concurrency remains BLOCKED;
- never call it PASS.

---

# 9. Tool gates

Run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Run tests/emulator if available.

Check:

```git diff
git status
git log -n 10 --oneline
```

No unrelated changes.

---

# 10. Report

Update `FIREBASE_FINAL_VERIFICATION_REPORT.md`.

Correctly distinguish:

- source-level correctness;
- transaction correctness;
- concurrency verification;
- runtime verification;
- security limitation.

Do not claim ALL PASS if concurrency runtime verification is BLOCKED.

Report exact baseline SHA, implementation commit SHA, and final report SHA.

---

# 11. Final acceptance criteria

The task is complete only when:

1. No aggregate calculation uses stale `getDocs()` results outside the authoritative transaction.
2. No aggregate calculation relies on old customer aggregate values.
3. Concurrent same-customer operations cannot silently overwrite each other's aggregate.
4. createOrder is correct.
5. updateOrderStatus is correct.
6. lastOrderDate remains correct after cancellation.
7. totalSpent is correct.
8. Existing UI/service contracts remain intact.
9. lint PASS.
10. typecheck PASS.
11. build PASS.
12. Runtime concurrency test PASS, OR clearly BLOCKED with evidence.
13. Report is truthful.
14. Push to `origin/main`.

Preferred commit message:

`fix: make customer aggregates concurrency safe`

Do the entire audit → implementation → tests → report → commit → push cycle in one pass. Do not stop to ask questions unless a destructive production action would otherwise be required.
