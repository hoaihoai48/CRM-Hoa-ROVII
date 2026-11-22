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
| Creator/history actor | `createdBy` and history `actorName` store display names; no membership UID in order/history |
| Staff assignment | Staff memberships have UID/role/status, but no order-to-staff assignment field or workflow was found |
| Print | No dedicated order print/invoice view or `window.print` implementation found in the inspected app |
| Customer aggregates | `orderSummaries` embedded in customer document and updated transactionally |

## 2. Confirmed S2 findings

1. Purchaser and recipient are conflated in the customer snapshot. Existing order detail text even labels the same values as both “Người nhận / Người đặt”.
2. Recipient-specific phone and address cannot differ from the customer profile in the current order contract.
3. Delivery supports one datetime only; no delivery window, preferred period, or scheduling validation is represented.
4. The single note field combines greeting-card copy with delivery instructions and internal notes.
5. The generated order ID is UUID-based. Changing it to a sequence requires a collision-safe counter design and a business-approved display format; do not infer a format.
6. Order attribution is display-name-only. Reliable assignment/audit requires storing stable membership UIDs and defining reassignment/permission semantics.
7. No dedicated printable view exists in the inspected routes.
8. Customer `orderSummaries` remains an embedded growing array and retains the previously documented Firestore 1 MiB scale risk.

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

## 6. Next engineering steps

1. PR #11 is merged and its post-merge main workflow passed.
2. Continue S2 architecture audit and draft a backward-compatible order data contract plus Rules/test matrix.
3. Keep customer identity/profile separate from immutable order snapshots; do not migrate existing order documents without a reviewed migration plan.
4. Preserve Spark compatibility and avoid introducing paid Firebase services.


## 7. Stable audit identity groundwork (PR #12)

- Added optional `createdByUid` to new orders and `actorUid` to status history; UI sources these from the authenticated membership UID.
- Firestore Rules validate any supplied actor UID against `request.auth.uid` and preserve `createdByUid` after creation.
- Legacy orders/history remain valid without these fields; no data backfill required.
- Emulator verifies a forged creator UID is denied; Playwright verifies all create/edit/status-history entries retain the signed-in staff UID.
- PR #12 merged at `64c539e423c78bfe0b7089889b40d479afdfa799`; PR CI #44982896197 and post-merge main CI #44983058488 PASS.
- This does not implement assignment or change staff permissions. Assignment policy remains a separate business decision.


## 8. Printable order slip (PR #13)

- Added browser-native print action and A4 print styling to order detail.
- Output uses only existing order data: order code/creation metadata, status, customer/delivery snapshot, note, products and totals. Internal timeline and interactive controls are excluded.
- Playwright covers invoking `window.print()` and print-media visibility.
- PR #13 merged at `bd3e259082b8f600db4474e39947b0ee0218e4fa`; PR CI #44983725322 PASS and post-merge main CI #44983907739 PASS.
- No schema changes, data migration, production data access, deployment, or paid Firebase services.


## 9. Customer aggregate scale remediation (PR #14)

- PR #14: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/14 — merged at `568083053d7311f6d5abbe608f3a100f0c803444`.
- Bounded `orderSummaries` to 50 recent active rows plus at most one currently changed cancelled row (maximum 51). Full historical orders remain in the canonical `orders` collection.
- Lifetime `totalOrders` and `totalSpent` now update by transaction deltas on create/status changes. Edits to new/confirmed orders only update the projection. `syncCustomerAggregates()` remains the full-scan repair path.
- Firestore Rules enforce the size cap only when the projection is created/changed; profile-only edits on legacy oversized arrays remain allowed. A subsequent order mutation or aggregate repair compacts those arrays.
- Emulator Case N verifies 65 synthetic orders, exact totals/date, compaction, old order update/edit, latest active cancellation, subsequent create, oversize rejection, legacy profile edit and repair compaction.
- PR CI #44985057671 PASS and post-merge main CI #44985288167 PASS. No production migration/data access, paid Firebase service, or deployment.
