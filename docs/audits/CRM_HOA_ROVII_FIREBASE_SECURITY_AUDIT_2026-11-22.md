# Firebase Security & Access-Control Audit — 2026-11-22

**Repository:** `hoaihoai48/CRM-Hoa-ROVII`  
**Audited branch:** `main`  
**Code baseline:** `93da6165ebec95a864c139baf1e4a4955e59fdcd` (PR #20 merge)  
**Method:** Read-only review of Firestore Rules, Storage Rules, client services, authentication context, emulator test harness, CI and architecture decisions.  
**Data safety:** No production customer/order data accessed or modified. No production deployment, Firebase configuration change or billing operation performed.

## Executive summary

The active order workflow is the Spark-compatible client Firestore transaction path in `src/lib/services/orders.ts`. The repository contains a `functions/index.js` file with callable implementations, but the documented architecture decision says routine order/customer workflows must not depend on callable Cloud Functions because the project remains on Firebase Spark. The older 2026-10-16 Source Audit's description of callable Functions as the active browser write boundary is therefore stale and must not be used as a current architecture statement.

Firestore Rules already enforce important controls: active membership for business data; admin-only product writes; immutable order identity fields; initial status/history shape; valid status transitions; append-only history; creator/actor UID matching on attributed orders; and atomic per-order customer projection updates via `getAfter()`. The proposed PR #25 additionally separates staff profile-only customer edits from order-linked aggregate/projection writes and validates exact order-count/completed-spend deltas. The Rules still cannot prove product-price arithmetic, and active admins retain a privileged aggregate-repair path. The application transaction computes prices; this remains an acknowledged trusted-internal-team/Spark trade-off, not server-enforced financial integrity.

## Findings

### F-01 — Customer aggregate scalar fields can be client-forged by any active member

**Severity:** High for data integrity; accepted trust-boundary limitation under the documented Spark model.

**Evidence:** `firestore.rules` permits an active member to update any valid customer document as long as the customer schema remains valid, phone/phoneNormalized/createdAt stay unchanged, and any changed `orderSummaries` projection remains bounded. The rule does not restrict updates to `name`, `address` and `note`, nor does it verify `totalOrders`, `totalSpent`, or `lastOrderDate` arithmetic against canonical orders when those scalar fields change. Consequently, an authenticated active staff client can directly update the scalar aggregate values without an order mutation. The existing emulator Case H uses the trusted Emulator REST owner token to inject corruption for the repair test; it does not currently assert that an authenticated client is denied from changing only the scalar aggregates.

**Impact:** Customer lifetime counts/spend and any UI relying on them can be corrupted by a modified or compromised active client. Order lifecycle rules still constrain status transitions and keep `statusHistory` append-only. However, same-status edits are allowed while an order is `new` or `confirmed`, and the Rules do not independently verify product-price arithmetic or summary totals for those edits. A modified active client can therefore change editable order items/summary and keep the matching customer projection coherent in the same transaction.

**Recommendation:** Keep the limitation explicit while the trusted-staff/Spark decision remains in force. A future Rules hardening should permit profile-only updates separately from atomic order/customer writes, and prove valid aggregate deltas against the matching order's before/after state. Do not add a superficial `hasOnly(profileFields)` rule without preserving create/edit/status/cancel transactions. Add negative Emulator tests for direct scalar-only tampering and positive tests for every supported order transaction before changing this boundary. If the threat model changes to untrusted staff/public customers, move critical writes to a trusted backend after an approved plan/billing decision.

**Status at this audit baseline:** Documented limitation. PR #25 now proposes a compatible mitigation; it is not yet merged or verified. See the remediation record at the end of this audit.

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
- PR #25 proposal (not yet merged): active staff profile updates are limited to name/address/note; aggregate/projection writes require a matching order mutation, one appended history entry, and exact totalOrders/completed-total deltas. Active admins retain a separate aggregate repair path.
- The emulator test harness targets the explicit demo project `demo-crm-hoa-rovii` and starts Auth + Firestore + Storage; direct Emulator test scripts fail closed unless the demo project and loopback emulator hosts are configured.
- Docs-only changes under `docs/**` and Markdown files are excluded from the quality workflow by `paths-ignore`; for a PR whose entire diff is documentation, record Actions as NOT RUN (never PASS), state that application build/isolated app tests are not relevant, and mark Preview N/A when runtime/UI and Vercel deployment configuration are unchanged. This docs-only exception does not apply to Rules or emulator/test-infrastructure changes, which require latest-head Actions production build and relevant isolated tests before Preview can be N/A.

## Verification boundaries

This was a source/configuration audit only. No Emulator command was executed by this GitHub-only review. Existing CI evidence from PRs #17/#18 remains the last inspected executable evidence: PR #45008095660 / main #45008325128 and PR #45008498582 / main #45008753697 all completed successfully. Storage Emulator coverage was added in PR #22 and passed in PR CI #45043911114 on final head `36ae3bf27c74e55cb674c00209e78df580ebf562`. The initial audit itself was source-only; later CI provides the executable evidence for the remediation.

## Recommended next delivery order

1. Complete PR #25 F-01 customer aggregate write-boundary hardening: verify direct staff aggregate tampering and staff repair are denied while valid create/edit/status/cancel transactions and active-admin repair continue to pass.
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


## F-01 remediation proposal — PR #25 (2026-11-23)

- PR: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/25 — draft on branch `security/customer-aggregate-write-boundary-2026-11-23`; implementation commits `7e886508dfa6f1c4315d38a2ad1899ca6e676fb0` and `fb8842e7df3ba0109038fa7509e2b2dc259f87be` (the latter splits Rules helpers to stay within per-function let-binding limits). Final PR head must be read live after the handoff/audit commit.
- Firestore Rules proposal: customer updates by staff are limited to profile fields or order-linked writes. The latter use `lastOrderMutationId` to resolve the order with `get()/getAfter()`, require exactly one appended history entry, require the changed order's summary in the bounded customer projection, and enforce `totalOrders` and completed-`totalSpent` deltas from before/after status and order total.
- `lastOrderDateOrderId` binds a changed last-order date to a real, non-cancelled order for the same customer and a matching projection summary. Order creation, status changes and editable-order updates set `lastOrderMutationId` atomically with the order write.
- The full-scan `syncCustomerAggregates()` repair path is retained for active admins only. This is a deliberate trusted-admin exception; it does not protect against a compromised admin. Staff direct aggregate writes and staff repair attempts are covered by new negative Emulator cases.
- The test runner remains fail-closed on project `demo-crm-hoa-rovii` and loopback Auth/Firestore/Storage Emulators. Existing lifecycle, customer projection, concurrency and legacy-profile tests remain in the same suite.
- Verification is pending: latest-head GitHub Actions, Playwright, production build, Vercel Preview (required because client order transaction behavior changes), and exact-head code/security review. Do not call F-01 resolved until all gates pass and the PR is merged.
- First CI attempt #45072163005 on prior head `86843619b11a20212ba43faf8a3dcdf6800601ae` failed because the Firestore Emulator rejected Rules compilation at L253 (`Maximum allowed variable count of 10`). The validation was split into smaller helpers in `fb8842e7df3ba0109038fa7509e2b2dc259f87be`; the failed run remains historical failure evidence, not a pass. A fresh full workflow is required on the final live head.
- Second CI attempt #45072462152 on head `3ece609ac96af85bd1f897938b6f67001177eae1` failed during the concurrent-order Emulator case with Rules evaluation errors across order/customer/product operations. The follow-up separates the order document ID from the unique appended history-entry ID and consolidates customer validation around one before/after order read pair, with only one optional latest-date source read. This is a targeted reduction in Rules access pressure; it remains unverified until the next full isolated workflow passes.
- Third CI attempt #45072873209 on head `117bad7120d0f3fbbb93abb1d50f2ebffe012dc4` passed lint/typecheck and earlier Emulator cases but failed at the five-way concurrent order-create case with `PERMISSION_DENIED`/Rules evaluation errors. The follow-up commit `a46082a0e690bfeded48e27491da5c07f841ded9` uses Firestore atomic `increment()` transforms for create/status counter deltas while retaining exact before/after Rules checks. This is a targeted concurrency fix, not yet verified by a fresh passing Emulator run.
- Fourth CI attempt #45073282950 on head `372bd7c04521f267ad463f3a403f5f0402904c32` passed lint/typecheck and the order/aggregate Emulator cases (including concurrent create, direct staff tamper denial, staff repair denial, admin repair and lifecycle transitions), then failed in the later membership/product-admin suite due a test-only email/password collision with the existing admin fixture. Commit `dc56d5423d72c4da54f7d1e34b367b22474f2ebd` gives the aggregate-repair test a distinct identity; a fresh complete workflow is still required.
- Residual limitation remains: Firestore Rules cannot independently verify client-side product prices against the catalog; the Spark-compatible trusted-team write-boundary decision remains in force.


## F-01 projection and date-marker hardening — 2026-11-23

- Follow-up implementation commits: `5903c6df3833d3a2caa9383b34b72664cd62c8b6` (Rules) and `358f99922f6f784429933b68ed76e5df522b91f7` (Emulator regression tests).
- Staff order-linked customer writes now require the resulting bounded projection to contain only summaries already present before the transaction plus the exact summary for the order being mutated. This permits intentional compaction/removal of old cached rows but prevents injecting or rewriting unrelated summary maps during a valid order mutation.
- A change to either `lastOrderDate` or `lastOrderDateOrderId` now requires a real active order for the same customer, with matching date and projection summary. Previously a staff client could change the source marker alone while leaving the date unchanged.
- Case H adds paired-write negative tests: a legitimate order status mutation cannot add a forged unrelated summary, and changing only the latest-date source marker to a nonexistent order is denied. Existing direct aggregate-forgery and staff-repair denial assertions now require the exact Firestore `permission-denied` error; unrelated test/runtime errors are rethrown instead of being counted as successful denials.
- Latest completed CI #45073464330 was SUCCESS on the preceding head `908b6fb714481acbd3483ff861a502e6dd926a11`; it is stale for these follow-up commits. A fresh complete isolated workflow is required on the new live head. The latest Vercel deployment attempt failed with the Free daily quota (`api-deployments-free-per-day`); Preview remains a required gate because `orders.ts` and Firestore Rules change. Do not merge until a current-head Preview is Ready and current-head code/security reviews complete without findings.
- This projection remains a bounded cache: staff may compact/drop old cached rows during an order mutation, while canonical order documents remain authoritative. The full aggregate repair path remains active-admin-only. Firestore Rules still cannot independently prove client-side product-price arithmetic; no production data, deployment, billing, project configuration or migration was touched.

## F-01 follow-up — latest active date source (2026-11-23)

- Codex identified P2 finding #4660218658 on superseded PR head `9ec5be74e1f06636ef6aeba537450d5d2941268a`: a valid order mutation could select an older active summary as `lastOrderDateOrderId`, or clear the date/source while active orders remained.
- Firestore Rules now require the date-source ID to equal the first (latest) active summary in a validated active-only projection. The referenced order must belong to the same customer, remain in an active status, and exactly match the first summary's ID/status/total/createdAt. An empty date and null source are accepted only when the post-delta `totalOrders == 0` and the active projection is empty.
- Projection writes preserve all prior active summaries except the order being mutated. Cancelled cache rows may be removed; a full 51-row projection may compact only its oldest row when a new/newly projected order is newer than that boundary. An older canonical order outside the 51-row cache is not allowed to displace recent summaries. The service and admin repair path normalize the active-only projection newest-first using createdAt plus order ID as a deterministic tie-break.
- Order creation, editable-order updates, status transitions and aggregate repair recompute `lastOrderDate` and `lastOrderDateOrderId` from the latest projected active summary. Cancelled orders remain canonical in `orders` but are omitted from the bounded active cache.
- New Emulator cases attempt a legitimate same-status order mutation paired with (a) a real but older active source and (b) an empty source while active orders remain; both must fail with `permission-denied`. Positive cases verify cancelling the latest order restores the prior active source, cancelling all active orders clears the source, old canonical orders do not displace the cache, and the 51-row oldest-compaction path remains usable.
- The bounded cache has an explicit fail-closed edge: if more than 51 active orders exist and all active rows currently represented in the cache are cancelled while older active orders remain outside it, a staff mutation cannot invent a replacement source. The write is denied until an active admin runs the existing aggregate repair to rebuild the cache. Do not weaken the empty-source rule to hide this limitation; a future scalable solution would need a separately verified active-order index or an approved trusted backend.
- Code commits in this follow-up: Rules `9b15859c939727209df6bfbc300aa83f80426449`, `6fb72e40ce4d876e7262e2c704da89ba876bb33e`, `afb23959c7b1d61d5ec3f82d19ac2a2efb7bb3a9`; order service `73e2e35d348ea2cc4d7b711a3c71324d1250d0fd`, `17c13d03c19aeef6e6c508fb2a74133335415e26`; Emulator tests `35e61446c43df77e57178f859936ce293314f549`. Branch: `security/customer-aggregate-write-boundary-2026-11-23`, PR #25, base `main` at `8f2d0d3695429ebdd47733caca1b51b80067f582`.
- Verification is pending for the new code. CI #45074119012 completed SUCCESS on the superseded head `9ec5be7`; it does not verify these changes. No PR-triggered Actions run was returned for the then-live head `17c13d03c19aeef6e6c508fb2a74133335415e26`. The combined status remains Vercel FAILURE due `api-deployments-free-per-day`; the earlier Ready Vercel comment points to a deployment built from a different commit and is not current-head Preview evidence. Vercel's deployment lookup also returned 403 because this connection is not authorized for team scope `vu-nhim`.
- The old P2 review thread is outdated after the fix but must be resolved only after checking the exact live diff. Fresh Codex code review and independent security review are required on the final PR head. F-01 remains IN PROGRESS and PR #25 must not merge until latest-head Actions, required Preview and both reviews pass without findings.
- No production customer/order data, production deployment, billing, Firebase project configuration, paid service or migration was touched.
