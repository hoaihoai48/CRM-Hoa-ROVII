# Legacy Order Data Audit — Read-Only Runbook

## Purpose

The new order callables and Firestore rules prevent future client-side corruption paths, but they do not retroactively validate documents written before the rules were tightened. Run this audit against the intended Firebase project before production approval.

## Safety guarantees

- `functions/audit-legacy-orders.js` is read-only. It only queries `orders` and `customers`; it never writes, repairs, or deletes documents.
- It requires an explicit `FIREBASE_PROJECT_ID` or `GCLOUD_PROJECT`. Demo project IDs require `FIRESTORE_EMULATOR_HOST`; conversely, if the Emulator host is set, non-demo project IDs are rejected. This prevents accidentally believing an Emulator scan audited production, or pointing a demo scan at production.
- Authenticate with Application Default Credentials for a principal that has only the read access needed for the audit when practical.
- Output includes counts and at most 25 sample document IDs per anomaly category; it does not print customer names, phone numbers, addresses, or order line details.
- A document may appear in more than one anomaly category. Exit code 1 means one or more anomalies were found; exit code 2 means the audit could not safely run.

## Run

### Validate the audit on an empty Emulator (CI/local)

The repository Emulator test command now runs this audit before integration tests seed any fixtures. It expects zero orders, zero customers, and zero anomaly references in the clean demo project.

### Run against the intended Firebase project

From the repository root, install the Functions dependencies first. Then authenticate to the intended Google Cloud project using Application Default Credentials and run:

```bash
gcloud auth application-default login
export FIREBASE_PROJECT_ID="YOUR_EXPLICIT_FIREBASE_PROJECT_ID"
npm run audit:legacy-orders --prefix functions
```

Do not paste credentials into a command, commit a service-account key, or run the command against an unspecified project. Confirm the printed project ID before interpreting results.

## Checks performed

1. Orders missing a customer ID or referencing a missing customer document.
2. Invalid order status values.
3. Missing or malformed order summary fields.
4. Per-item `quantity × unitPrice` mismatches and subtotal mismatch.
5. Order total mismatch against `subtotal + deliveryFee - discount`, including negative fees/discounts or discount greater than subtotal.
6. Customer `totalOrders`, `totalSpent`, and `lastOrderDate` mismatch against order documents.
7. Duplicate customer order-summary IDs, projection entries for missing/wrong-customer orders, and mismatched order-summary projections.

The audit intentionally does not compare an order's historical `unitPrice` with the product's current price: the product price can legitimately change after an order was placed.

## Remediation process — do not auto-fix

1. Run and retain the JSON output in an access-controlled location; it contains document IDs.
2. Review anomaly samples and determine whether the source of truth is the order document, a customer projection, or a genuinely ambiguous historical record.
3. Take a Firestore managed export/backup before any write-based repair, and verify the target project and restore procedure. Firestore exports consume document reads and require Cloud Storage and appropriate permissions.
4. Build a separately reviewed, dry-run-first repair script with explicit per-document decisions, idempotency, and a change log. Do not mass-rewrite financial totals based only on the current product catalog.
5. Run repair in staging against a production-like export, verify order/customer invariants, and obtain owner approval before production writes.
6. Re-run this read-only audit after repair. Preserve before/after counts and the reviewed repair log.

Official Firebase guidance: [Firestore export/import](https://firebase.google.com/docs/firestore/manage-data/export-import). The managed export is a recovery/offline-processing mechanism, not a substitute for validating the repair logic.
