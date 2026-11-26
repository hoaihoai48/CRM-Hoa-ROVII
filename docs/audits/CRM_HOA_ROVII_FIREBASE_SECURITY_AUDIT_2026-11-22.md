# Firebase Security & Access-Control Audit — 2026-11-22

**Repository:** `hoaihoai48/CRM-Hoa-ROVII`  
**Audited branch:** `main`  
**Code baseline:** `93da6165ebec95a864c139baf1e4a4955e59fdcd` (PR #20 merge)  
**Method:** Read-only review of Firestore Rules, Storage Rules, client services, authentication context, emulator test harness, CI and architecture decisions.  
**Data safety:** No production customer/order data accessed or modified. No production deployment, Firebase configuration change or billing operation performed.

## Executive summary

The active order workflow is the Spark-compatible client Firestore transaction path in `src/lib/services/orders.ts`. The repository contains a `functions/index.js` file with callable implementations, but the documented architecture decision says routine order/customer workflows must not depend on callable Cloud Functions because the project remains on Firebase Spark. The older 2026-10-16 Source Audit's description of callable Functions as the active browser write boundary is therefore stale and must not be used as a current architecture statement.

Firestore Rules already enforce important controls: active membership for business data; admin-only product writes; immutable order identity fields; initial status/history shape; valid status transitions; append-only history; creator/actor UID matching on attributed orders; and atomic per-order customer projection updates via `getAfter()`. The Rules explicitly cannot prove product-price arithmetic or complete customer aggregate arithmetic. The application transaction computes these values. This remains an acknowledged trusted-internal-team trade-off, not server-enforced financial integrity.

## Findings

### F-01 — Customer aggregate scalar fields can be client-forged by any active member

**Severity:** High for data integrity; accepted trust-boundary limitation under the documented Spark model.

**Evidence:** `firestore.rules` permits an active member to update any valid customer document as long as the customer schema remains valid, phone/phoneNormalized/createdAt stay unchanged, and any changed `orderSummaries` projection remains bounded. The rule does not restrict updates to `name`, `address` and `note`, nor does it verify `totalOrders`, `totalSpent`, or `lastOrderDate` arithmetic against canonical orders when those scalar fields change. Consequently, an authenticated active staff client can directly update the scalar aggregate values without an order mutation. The existing emulator Case H uses the trusted Emulator REST owner token to inject corruption for the repair test; it does not currently assert that an authenticated client is denied from changing only the scalar aggregates.

**Impact:** Customer lifetime counts/spend and any UI relying on them can be corrupted by a modified or compromised active client. Order lifecycle rules still constrain status transitions and keep `statusHistory` append-only. However, same-status edits are allowed while an order is `new` or `confirmed`, and the Rules do not independently verify product-price arithmetic or summary totals for those edits. A modified active client can therefore change editable order items/summary and keep the matching customer projection coherent in the same transaction.

**Recommendation:** Keep the limitation explicit while the trusted-staff/Spark decision remains in force. A future Rules hardening should permit profile-only updates separately from atomic order/customer writes, and prove valid aggregate deltas against the matching order's before/after state. Do not add a superficial `hasOnly(profileFields)` rule without preserving create/edit/status/cancel transactions. Add negative Emulator tests for direct scalar-only tampering and positive tests for every supported order transaction before changing this boundary. If the threat model changes to untrusted staff/public customers, move critical writes to a trusted backend after an approved plan/billing decision.

**Status:** Documented limitation; not changed in this audit because a safe, compatible Rules design needs a focused implementation/test cycle.

### F-02 — Storage image deletion is broader than Firestore product write permissions

**Severity:** Medium.

**Evidence at the audit baseline (before PR #22):** `storage.rules` allowed `allow delete: if isActiveStaff()` on `/products/{allPaths=**}`. Active staff and admins can therefore delete product image objects. In contrast, `firestore.rules` allows product document create/update only to admins. The Storage rule also allows any active staff member to upload an image, which is wider than the admin-only catalog write policy. The Storage rule itself validates image MIME/extension and a per-object size under 10 MiB, but does not require admin role.

**Impact:** Staff who cannot edit product records can still replace or delete image objects, potentially breaking catalog images or changing product media outside the catalog's admin-only workflow.

**Recommendation:** If product image management is intended to follow product catalog permissions, change Storage write/delete to active admin only. Before implementation, add Storage Emulator tests (staff denied upload/delete, admin allowed valid image upload/delete, invalid type/extension/oversize rejected) and include Storage in the isolated emulator test runner. This audit did not change the rule because the existing CI runs only Auth/Firestore Emulators; changing policy without an equivalent Storage Rules regression suite would reduce assurance.

**Status:** RESOLVED by PR #22 (merged 2026-11-22 as `3efd04c601b4bffaa976edad38c282e921d82be4`). Storage create/update/delete now requires an authenticated active admin; public reads remain unchanged. The final PR-head CI run #45043911114 passed the Auth/Firestore/Storage Emulator suite, Playwright and production build. Codex code review and independent security review found no blocker; no unresolved inline threads remained. Post-merge main Actions #45047810582 completed SUCCESS on exact merge commit 3efd04c601b4bffaa976edad38c282e921d82be4.

### F-03 — Storage Rules enforce per-object limits but image/document payload limits are not end-to-end bounded

**Severity:** Medium (availability/data-integrity).

**Evidence:** Storage objects have a 10 MiB per-object cap. The Spark-default product image path instead compresses images in the browser and stores Data URLs in Firestore. `uploadProductImage()` limits canvas dimensions and JPEG quality, but does not verify the resulting Data URL's actual encoded byte length or the total image payload across a product document. `products.ts` limits the image count to five but does not cap each URL/Data URL string. The source comments estimate roughly 80–150 KB but the implementation does not enforce that estimate.

**Impact:** A large or unusual source image can still produce an oversized encoded Data URL or a product document close to Firestore's document-size limit. Five-image count alone does not prove a safe maximum.

**Recommendation:** Add deterministic client validation of the compressed Data URL byte length and aggregate product media payload before write, with clear user feedback. Add a Rules-side per-string/total bound where Firestore Rules language and document shape allow it, plus Emulator rejection tests. Avoid claiming a fixed compressed size unless the code enforces it.

**Status:** Confirmed gap; no product data/schema change made.

### F-04 — User membership update validates field names and enums but permits broader admin edits than necessary

**Severity:** Low/Medium.

**Evidence:** `match /users/{userId}` allows admin create/update when role/status are valid enums and keys are in the allow-list. It does not enforce `request.resource.data.uid == userId`, immutable UID/createdAt on update, nor explicitly limit an update to the role/status/updatedAt fields. The UI only changes role/status, but the Rules boundary permits an admin client to rewrite other allowed membership fields. An admin can also deactivate/demote their own membership, potentially locking themselves out.

**Impact:** This does not let a normal staff member self-promote: only a currently active admin can perform the update. It does permit inconsistent membership metadata and accidental admin self-lockout.

**Recommendation:** Restrict updates to the fields needed by the staff workflow, require the document UID to match its path, keep createdAt immutable, and decide whether self-demotion/deactivation should be blocked or deliberately supported. Add Emulator positive/negative tests before applying.

**Status:** Improvement candidate; no role-policy change made.

### F-05 — Legacy audit/source documentation is internally inconsistent with the Spark architecture

**Severity:** Medium (operational/documentation).

**Evidence:** `docs/audits/CRM_HOA_ROVII_SOURCE_AUDIT_2026-10-16.md` includes a later narrative that order callables are the active write boundary. The later decision document `docs/security/FIRESTORE_BUSINESS_WRITE_BOUNDARY_PLAN.md` records the owner-approved Spark model and client-side transaction path. The current client order service uses Firestore `runTransaction`; the current CI emulator runner starts only Auth and Firestore, not Functions. Storage Rules also differ from the old source audit's description of admin-only product writes.

**Impact:** A new contributor/agent could incorrectly assume Cloud Functions are required or deployed for normal order workflows, or overlook the staff Storage write/delete allowance.

**Recommendation:** Treat the business-write-boundary decision as authoritative. Mark the 2026-10-16 source audit as historical and point readers to this audit plus the Spark boundary decision. Do not remove the Functions source tree or change Firebase deployment configuration without a separate repository-wide dependency/use review.

**Status:** Documentation correction to be prepared separately.

## Verified controls

- Unauthenticated and inactive memberships do not qualify as active members in Firestore Rules.
- The login UI exposes email/password and Google sign-in; it does not expose the registration/phone-OTP helper functions. Auth alone does not grant CRM access without an active `users/{uid}` membership.
- Non-admin users cannot create or update membership documents through the Firestore client rules. Active admins can update membership documents, including their own; an admin can therefore demote or deactivate themselves, as noted in F-04.
- Product document create/update is admin-only; direct product deletion is denied.
- Orders require a valid initial `new` state/history and matching customer projection; updates preserve append-only history and valid transitions.
- New records with creator UID require actor UID equal to the authenticated UID for appended status-history entries. Legacy orders without creator UID remain compatible.
- Customer phone identity and creation timestamp are immutable through customer updates.
- The emulator test harness targets the explicit demo project `demo-crm-hoa-rovii` and starts Auth + Firestore + Storage; direct Emulator test scripts fail closed unless the demo project and loopback emulator hosts are configured.
- Docs-only changes under `docs/**` and Markdown files are excluded from the quality workflow by `paths-ignore`; for a PR whose entire diff is documentation, record Actions as NOT RUN (never PASS), state that application build/isolated app tests are not relevant, and mark Preview N/A when runtime/UI and Vercel deployment configuration are unchanged. This docs-only exception does not apply to Rules or emulator/test-infrastructure changes, which require latest-head Actions production build and relevant isolated tests before Preview can be N/A.

## Verification boundaries

This was a source/configuration audit only. No Emulator command was executed by this GitHub-only review. Existing CI evidence from PRs #17/#18 remains the last inspected executable evidence: PR #45008095660 / main #45008325128 and PR #45008498582 / main #45008753697 all completed successfully. Storage Emulator coverage was added in PR #22 and passed in PR CI #45043911114 on final head `36ae3bf27c74e55cb674c00209e78df580ebf562`. The initial audit itself was source-only; later CI provides the executable evidence for the remediation.

## Recommended next delivery order

1. Add negative Emulator coverage for active-member customer scalar aggregate tampering and design a compatible Rules guard that preserves valid create/edit/status/cancel transactions.
2. Add deterministic Data URL encoded-byte and aggregate media-payload bounds with Emulator rejection coverage where Rules can enforce them.
3. Tighten membership field immutability and explicitly decide the self-demotion/self-deactivation behavior.
4. Correct the historical Source Audit and CRUD permission audit to point to current rules and the Spark write-boundary decision.

No production data, deployment, billing or paid Firebase service was touched.


## Initial remediation plan and pre-merge verification — F-02 (2026-11-22)

- PR #22 changes `/products/{allPaths=**}` Storage writes/deletes to require an authenticated active admin, matching the Firestore product catalog boundary. Public reads remain unchanged by design.
- PR #22 adds Storage Emulator coverage for anonymous, missing-membership, malformed/non-admin, active staff, inactive staff and active admin; valid upload/overwrite/delete, public read, MIME/extension rejection and the 10 MiB boundary are exercised.
- CI #45043396941 on pre-fixture-fix head `5562214aa1aaf89300be79dc7cb3a5f4abfa5bea` passed lint/typecheck and Auth/Firestore/Storage Emulator tests, but 3/6 Playwright tests failed because test fixtures used `crm-hoa-rovii` while the app used `demo-crm-hoa-rovii`; production build was skipped. The fixture project IDs were corrected in commits `df358a63ebfecc62b98c0bb131febbf5eae44c59` and `2f643fd07c85c58d35b2ba37a6a0f1cac3133765`. This was the pre-merge state; it is superseded by the remediation completion record below.


## Remediation completion — F-02 (2026-11-23)

- PR #22 merged by squash as 3efd04c601b4bffaa976edad38c282e921d82be4; final PR head 36ae3bf27c74e55cb674c00209e78df580ebf562.
- /products/{allPaths=**} now allows public reads, active-admin create/update of valid image objects, and active-admin deletes. Missing membership, malformed/non-admin membership, inactive staff and active staff are denied.
- Storage Emulator tests cover upload, overwrite and delete authorization, intentional public reads, MIME/extension mismatch and object size at/above 10 MiB. The test runner starts Auth/Firestore/Storage Emulators under explicit project demo-crm-hoa-rovii; test scripts fail closed unless all required emulator hosts are loopback.
- PR CI #45043911114 completed SUCCESS on the exact final head, including lint, typecheck, Auth/Firestore/Storage Emulator tests, six Playwright cases and production build. The earlier Playwright failure on #45043396941 was caused by mismatched fixture project IDs and was corrected before the final run.
- Codex code review on the exact head reported no major findings; independent security review found no additional blocker; zero unresolved inline review threads. Vercel Preview was not applicable because no runtime/UI or Vercel deployment configuration changed; the Free daily quota limit was not treated as a required gate.
- Post-merge main Actions #45047810582 were independently found by exact merge SHA; the push-triggered main workflow completed SUCCESS, including lint, typecheck, Auth/Firestore/Storage Emulator integration, Playwright and production build.


## Post-merge main verification — F-02 (2026-11-23)

- GitHub Actions run [#45047810582](https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45047810582) is the push-triggered `main` workflow for exact merge commit `3efd04c601b4bffaa976edad38c282e921d82be4`; status `completed`, conclusion `success`.
- Inspected job #137286140172: dependency/MCP checks, lint, TypeScript typecheck, Firebase Auth/Firestore/Storage Emulator integration, Playwright E2E and production build all completed successfully.
- This supersedes the earlier handoff note that post-merge main Actions were unverified. PR #22 F-02 remediation has both PR-head CI and post-merge main CI evidence.


## F-01 architecture decision — simplify rather than add a projection protocol (2026-11-23)

The customer order-history array is not required by the UI: customer detail already reads all order history from the canonical `orders` collection using cursor pagination. The 10/50-row projection, refill protocol, latest-date order markers and projection fingerprint are an unnecessary second representation of order history.

The intended simplification is to stop depending on or maintaining `orderSummaries`, leave legacy values untouched, and retain only scalar customer display summaries. `lastOrderDate` is defined as the most recent order placement date, including orders later cancelled. The scalar summaries remain a trusted-internal-team/client-computed cache under Firebase Spark.

**Residual F-01 risk is not solved by this simplification:** an active member can still tamper with client-maintained `totalOrders`, `totalSpent`, or `lastOrderDate` unless a trusted backend is introduced or a separately proven Rules protocol is implemented. Firestore Rules cannot independently prove all product-price arithmetic. Do not describe these fields as authoritative financial records or claim that the refactor closes scalar forgery. The canonical `orders` documents remain the evidence from which summaries can be recomputed.

No production data, billing, deployment, Firebase configuration or migration is authorized.

**Implementation status (2026-11-26):** PR #26 is open and Draft at head `c52b9f5f1aa59126992e50d5aead9e65ec53d079`. Its application-code tree passed the automatically triggered Actions run [#45729703091](https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45729703091): lint, TypeScript, Auth/Firestore/Storage Emulator integration, Playwright E2E and production build all PASS. The Vercel Preview for the latest head is Ready. No PR review submissions or inline review threads are recorded; do not merge until an adequate code/security review is completed. F-01 remains OPEN / PARTIAL MITIGATION ONLY because scalar aggregate tampering remains possible under the Spark trusted-client model.
