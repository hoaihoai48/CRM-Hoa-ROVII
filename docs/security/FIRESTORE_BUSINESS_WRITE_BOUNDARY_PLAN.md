# Firestore Business Write Boundary — Spark-Compatible Decision

## Decision for the current internal CRM

The owner has confirmed this application is built for a trusted internal team and Firebase must remain on the free Spark plan. Cloud Functions require the Blaze plan to deploy; therefore, the application must not depend on callable Cloud Functions for its normal order workflows.

This branch restores client-side Firestore transactions for order creation, editing, status changes and aggregate maintenance. The existing service logic re-reads products within the transaction, calculates totals from current product prices, applies the order status state machine, and updates the order and customer projection atomically. Firestore Rules require an authenticated active admin/staff membership, enforce document schemas, keep customer phone identity immutable, prohibit deletes, and retain admin-only product catalog writes.

## Explicit trade-off

Firestore Security Rules cannot prove that a client-calculated order total matches the price of every product or recompute a customer's complete order history across arbitrary documents. In this Spark-compatible trusted-team model, the application relies on the shipped client service logic and trusted staff workflow for those business invariants. This is not an accusation against staff; it is a technical boundary that matters only if the app later needs to defend against a compromised or adversarial client.

Do not describe this as server-enforced financial integrity. If the threat model changes (public customers, untrusted staff, strict audit requirements), move mutations to a trusted backend. Cloud Functions would require Blaze; alternatives would need their own hosting, authentication, secret management, and cost review.

## Implemented on this branch

- Restored the pre-Functions client transaction implementation in `src/lib/services/orders.ts`.
- Removed the client SDK dependency on `firebase/functions`.
- Removed Functions from Firebase deploy/emulator configuration so routine workflows do not require a Functions runtime or deployment.
- Updated Firestore Rules to allow active members to use the client transaction model while validating order/customer schemas and preserving immutable customer identity fields.
- Kept product writes admin-only and deletes denied.
- Updated Emulator tests to validate the Spark-compatible path and reject malformed order documents, while no longer claiming rules can block all forged financial values.
- Emulator suite runs Auth and Firestore only.

## Operational guidance

1. Keep the Firebase project on Spark; do not link a billing account solely to enable Cloud Functions.
2. Test with Auth and Firestore Emulators before deploying rules.
3. Verify normal staff workflows: create customer, create order, edit new/confirmed order, move status, and view customer aggregates.
4. Keep the app restricted to the trusted team and use strong account passwords, deactivate departing staff, and maintain periodic data exports/backups outside paid Firebase backup features.
5. If the app's trust assumptions change, revisit the backend boundary before exposing it to public users.

## Release acceptance criteria

- Active staff/admin can complete the intended order/customer workflows using client transactions on Spark.
- Inactive and unauthenticated users cannot access or mutate protected records.
- Staff cannot create/update/delete products; active admins can create/update product records.
- Order/customer documents must satisfy the expected schema; customer phone identity cannot be rewritten.
- No routine app flow requires Cloud Functions.
- Documentation accurately states the trade-off: client-side calculation is not a trusted server-side security boundary.
