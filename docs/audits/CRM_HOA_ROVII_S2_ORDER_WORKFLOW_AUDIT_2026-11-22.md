# ROVII S2 Order Workflow Audit — 2026-11-22

**Scope:** Recipient and delivery data, order identifiers, staff assignment, printable order view, and new-customer/order transaction integrity.  
**Environment:** Read-only GitHub source audit plus proposed regression coverage on Firebase Auth/Firestore Emulators.  
**Production safety:** No production customer/order data accessed or modified; no production deployment or billing changes.

## 1. Existing behavior verified

| Area | Current implementation |
|---|---|
| Customer identity | `customers/CUST_<normalized-phone>` for canonical new customer records; legacy IDs are still searched/reused |
| Order/customer relationship | `orders/{orderId}.customerId` |
| Customer snapshot | `name`, `phone`, `address`; current UI labels vary between customer and recipient |
| Delivery schedule | One optional ISO `deliveryDate`, entered with `datetime-local`; no separate delivery window |
| Note | One optional `note` field used for order note and greeting-card content/instructions |
| Order code | UUID-based `DH-` prefix; not a sequential/human-readable code |
| Creator/history actor | Display names plus optional stable `createdByUid` / `actorUid` (PR #12); legacy records remain valid |
| Staff assignment | Staff memberships have UID/role/status, but no order-to-staff assignment field or workflow was found |
| Print | Browser-native A4 print view exists (PR #13); contents currently use the existing order snapshot and note |
| Customer aggregates | Lifetime counters updated by deltas; embedded recent-order projection capped at 51 entries (PR #14) |

## 2. Confirmed S2 findings

1. Purchaser and recipient are conflated in the customer snapshot. Existing order detail text even labels the same values as both “Người nhận / Người đặt”.
2. Recipient-specific phone and address cannot differ from the customer profile in the current order contract.
3. Delivery supports one datetime only; no delivery window, preferred period, or scheduling validation is represented.
4. The single note field combines greeting-card copy with delivery instructions and internal notes.
5. The generated order ID is UUID-based. Changing it to a sequence requires a collision-safe counter design and a business-approved display format; do not infer a format.
6. Stable creator and status-actor UIDs now exist for new records (PR #12); assignment still requires a separate policy for owner, reassignment, and permissions.
7. A browser-native A4 print view now exists (PR #13); whether it should be a customer receipt, internal fulfilment sheet, or both remains a business choice.
8. The recent `orderSummaries` projection is now bounded to 51 entries (PR #14), while lifetime totals remain scalar counters; full history stays in `orders`.

## 3. Safe technical improvement in PR #11

The new-customer UI path previously called `createCustomer()` before `createOrder()`. A failed order could leave a customer record with zero orders.

PR #11 changes this safely:
- The order form resolves an existing customer if one is found; it no longer creates a new customer before order submission.
- `createOrder()` derives the canonical customer document ID from the validated Vietnamese phone when no existing customer ID is supplied.
- The first customer record and first order are written in the same Firestore transaction.
- Firestore Rules permit a customer with a non-empty first-order projection only if `getAfter()` finds the matching valid initial order in the same atomic write. Standalone empty customer creation remains supported.
- Emulator tests cover failed order creation leaving no customer, rejection of a forged customer projection without an order, and successful atomic creation of customer/order/aggregate.
- Existing Playwright order creation E2E now exercises the new first-time customer path.

## 4. Business semantics deliberately not guessed

Before implementing recipient/delivery/assignment/print UX, obtain explicit requirements for:
- Whether customer means purchaser, recipient, or a reusable contact record; and whether recipient details should be mandatory.
- Whether recipient phone/address are optional and how they interact with saved customer profile data.
- Delivery scheduling rules: exact timestamp vs morning/afternoon/evening slots, timezone policy, and whether past dates are allowed.
- Whether greeting-card message, delivery instructions, and internal note should be separate fields.
- Order-code format, uniqueness scope, reset cadence, and whether historical UUID IDs remain the canonical route key.
- Staff assignment policy: single owner vs multiple staff, who can assign/reassign, and whether assigned staff can see/edit all orders.
- Printable output: customer receipt, internal picking/fulfilment sheet, or both; required branding and fields.

## 5. Verification status

- PR #11: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/11
- Implementation branch: `fix/atomic-customer-order-creation`
- Initial CI run #44982205534 failed TypeScript because the new test assertion returned `boolean | undefined`; corrected in the following commit.
- Final PR CI run #44982355903: PASS on PR head `d9be7e09d90404b6487f9293d46526b7c597b65b`, including lint, typecheck, Emulator integration, Playwright and production build.
- PR #11 merged by squash at `73bb72ca19e5af82027e7f27096e693cb5892497`.
- Post-merge main workflow #44982521247: PASS.
- No production data, deployment, billing, or destructive migration touched.

## 6. Backward-compatible candidate data contract (not yet implemented)

The current order schema is stable and existing orders must remain readable. Any approved extension should be additive and optional so legacy documents continue to pass mapping and Rules validation.

| Candidate field | Purpose | Compatibility / implementation notes |
|---|---|---|
| `recipientSnapshot?: { name, phone?, address? }` | Distinguish delivery recipient from the customer/contact linked by `customerId` | Keep `customerId` and `customerSnapshot` unchanged; never overwrite the reusable customer profile from recipient edits |
| `cardMessage?: string` | Greeting-card text | Keep existing `note` meaning intact for old records; do not silently reinterpret old note values |
| `deliveryInstructions?: string` | Instructions for courier/fulfilment | Optional additive field; internal-only visibility should be decided before exposing it on customer-facing print |
| `deliveryWindow?: { start, end }` or a defined slot enum | Delivery time window | Do not implement until the shop chooses exact-time vs slot semantics and timezone/past-date rules |
| `assignedStaffUid?: string`, `assignedStaffName?: string` | Assignment | UID is authoritative; name is a display snapshot. Rules must validate active membership and define who may assign/reassign |
| `orderCode?: string` | Human-friendly display code separate from UUID document ID | Keep existing UUID document ID as route/key. A counter must allocate atomically in the Firestore transaction; format, reset cadence and uniqueness scope require approval |

Do not add all candidate fields merely because they are listed. Implement only fields that map to a confirmed shop workflow. Avoid destructive backfills; legacy fields remain optional.

## 7. Regression matrix required for approved extensions

- Legacy order without any new optional fields loads, edits (only while `new`/`confirmed`) and prints unchanged.
- New order stores purchaser/contact and recipient snapshots independently; editing recipient never mutates the customer profile or historical purchaser snapshot.
- Optional card message and delivery instructions are validated, mapped, rendered and print-filtered according to their visibility policy.
- Delivery time validation covers exact timestamp/slot boundaries, timezone, empty values and disallowed past times after rules are approved.
- Assignment rejects unknown/inactive members and forged UIDs; only authorized roles can assign/reassign; assignment history is auditable if required.
- Order-code allocation is collision-safe under concurrent Emulator transactions; failed order creation must not consume an inconsistent counter value if transaction rolls back.
- Firestore Rules allow legacy documents and valid new documents, reject unknown keys/invalid nested shapes, and preserve S1 status/history invariants.
- Playwright covers order creation/edit, recipient/contact distinction, assignment controls, print layout, mobile layout and error states.

## 8. Remaining owner decisions

1. Is `customerSnapshot` the purchaser/contact and may the recipient be a different person? Are recipient phone and address optional or required?
2. Should delivery use an exact datetime, predefined time slots, or support both? Which slots and timezone rules apply?
3. Should the current note remain an internal/order note, with card message and delivery instructions separated? Who may see each field?
4. What order-code format is wanted (for example date prefix + sequence), and should the sequence reset daily, monthly, yearly or never?
5. Is assignment single-staff or multi-staff? Who can assign/reassign, and should staff visibility/edit permissions change?
6. Should printing produce a customer receipt, internal fulfilment sheet, or both? Which fields/branding belong on each?

These are the only blockers before implementing the corresponding S2 UX/schema. No assumptions should be made on the owner's behalf.

## 9. Next engineering steps

1. PRs #11–#16 are merged/verified as described below; technical safety improvements are complete for this audit slice.
2. Wait for owner decisions in Section 8 before implementing purchaser/recipient, delivery-slot, card/instruction, order-code or assignment semantics.
3. After decisions, implement one cohesive vertical slice at a time: TypeScript model + service + Firestore Rules + Emulator negative/positive cases + Playwright + print output.
4. Preserve Spark compatibility. No paid Firebase services, production data repair, destructive migration or production deployment without explicit approval.


## 10. Verified technical delivery after the initial audit

- PR #11 — atomic first-time customer + first order; merge `73bb72ca19e5af82027e7f27096e693cb5892497`; PR CI #44982355903 and post-merge #44982521247 PASS.
- PR #12 — stable creator/history UIDs; merge `64c539e423c78bfe0b7089889b40d479afdfa799`; PR CI #44982896197 and post-merge #44983058488 PASS.
- PR #13 — browser-native A4 print; merge `bd3e259082b8f600db4474e39947b0ee0218e4fa`; PR CI #44983725322 and post-merge #44983907739 PASS.
- PR #14 — bounded customer order projection and delta-based lifetime aggregates; merge `568083053d7311f6d5abbe608f3a100f0c803444`; PR CI #44985057671 and post-merge #44985288167 PASS.
- PR #15 — dashboard bounded reads/local-day query; merge `4ce6d95095141180cb855426bff8c94c722b880b`; PR CI #44985805872 and post-merge #44986041575 PASS.
- PR #16 — cursor pagination for order/customer lists; merge `7e923b5a0a996468a211f76b8d1ff715699e3ce4`; final PR head `83e0d6c09978ea163e7b4d0f6280d3dd3b0f2f8c`; PR CI #44988852658 PASS (lint, typecheck, Emulator Case Q, Playwright, production build). Post-merge main workflow #44989024153 completed PASS on merge commit `7e923b5a0a996468a211f76b8d1ff715699e3ce4`, including lint, typecheck, Emulator, Playwright, production build and diagnostics artifact upload.
- PR #16 preserves global substring search and status filtering by loading the full collection only when those filters are active; ordinary browsing uses 50-row cursor pages and explicit load-more. This trade-off is intentional and documented.
- No production customer/order data, migration, production deployment, billing change or paid Firebase service was used.
