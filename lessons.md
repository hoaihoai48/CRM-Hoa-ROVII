# lessons — Engineering Lessons and Delivery Memory

This is the durable record of lessons learned while maintaining CRM Hoa ROVII. Add a dated entry when a meaningful failure, correction, architectural constraint or delivery-process lesson occurs. Keep entries actionable; do not turn this file into a raw chronological chat log.

## 2026-11-25 — Use the GitHub connector workflow the owner selected

- For repository work initiated with the GitHub connector, inspect and change the repository through the GitHub connector.
- Do not silently switch to ChatGPT Work or another workflow. The owner has explicitly corrected this more than once.
- Report concrete repository results: file/PR/commit, exact test outcome and whether the change is merged. Avoid progress narration without a verified result.

## 2026-11-25 — Verify live Git state; old handoff documents can be stale

- Always fetch the live `main` ref, active PR heads, PR state, latest Actions runs and review threads before deciding what is complete.
- A document saying a PR is open or merged is not proof. GitHub's current state and exact commit SHA are authoritative.
- A passing check on an earlier SHA does not verify a later SHA. Cancelled or skipped jobs are not passes.
- Keep the current handoff concise and update it at every meaningful milestone.

## 2026-11-25 — Control CI churn

- Never push a speculative fix just to see whether CI turns green.
- For each failed run: inspect the failed job log, locate the exact assertion/source contract, formulate one targeted fix, and validate it locally or in an isolated Emulator before pushing.
- Do not push another commit while the previous head's Actions run is still running.
- Do not rerun an unchanged failing SHA. Avoid parallel PRs for overlapping scope.
- Treat GitHub Actions and Vercel Free quotas as finite resources.

## 2026-11-25 — Firestore Rules have real evaluation limits

- Complex cross-document Rules logic and large projection checks can hit Firestore's 1,000-expression evaluation budget.
- Do not solve a data-integrity problem by adding an elaborate Rules protocol without proving that normal transactions remain within the budget.
- Prefer a simple canonical data model when duplicated projections create refill, cache invalidation and concurrency edge cases.

## 2026-11-25 — Be honest about Firebase Spark's trust boundary

- In the current Firebase Spark client-transaction architecture, Firestore Rules can validate membership, document shape and allowed lifecycle transitions, but cannot independently prove all client-computed cross-document arithmetic.
- Customer scalar aggregates such as order count and spend remain client-maintained. Do not claim they are authoritative against a malicious authenticated staff client.
- Canonical `orders/{orderId}` records are the evidence from which history and aggregates can be reconciled.
- A simplification that uses canonical orders is not automatically a security fix for scalar aggregate tampering. Record the trade-off explicitly.

## 2026-11-25 — Tests must express the actual security contract

- An Emulator assertion can be stale even when it sounds like a desirable security property.
- Before changing Rules to satisfy a failing test, compare the assertion with the documented threat model and actual product architecture.
- In PR #26, the assertion that a valid-shaped customer write with scalar aggregates must be denied contradicted the documented trusted-internal-staff/Spark limitation. Do not weaken Rules or mislabel this as an order workflow regression to make the test pass.
- Correct the test contract only after the intended boundary is explicit; retain negative tests for what Rules genuinely guarantee.

## 2026-11-25 — Keep Preview requirements proportional

- Vercel Preview is required for runtime/UI and deployment-configuration changes when the delivery policy says so.
- For docs-only changes, do not consume deployment quota unnecessarily. Record Actions/Preview as NOT RUN or N/A when the workflow explicitly excludes the diff; never describe skipped checks as passes.
- For Firebase Rules or emulator/test-infrastructure changes, run the relevant latest-head Actions checks even if a Vercel Preview is not applicable.

## 2026-11-25 — Keep production and billing boundaries intact

- Use only the explicit demo Firebase project and loopback Auth/Firestore/Storage Emulators for automated tests.
- No production deployment, customer/order data repair, destructive migration, Firebase project configuration change, paid Firebase service or billing change without owner approval.

## Maintenance rule

When a new lesson is added:
1. Include the date and the concrete incident or decision.
2. State the failure mode or misleading assumption.
3. State the rule that prevents recurrence.
4. Link the relevant PR, commit or Actions run when available.
5. If the lesson changes future agent behavior, also update `AGENTS.md` or the relevant delivery instruction; do not rely on this file alone for mandatory workflow rules.


## 2026-11-25 — Follow the owner's current implementation-first operating direction

- The owner has asked to prioritize finishing implementation and not proactively run Playwright or other test suites; report runtime defects when the owner encounters them during normal use.
- Avoid spending time on repeated manual test/CI runs unless the owner asks. Repository pushes may still trigger configured GitHub Actions automatically; never claim unrun checks passed.
- Keep untested changes clearly identified and preserve production, billing and data-safety boundaries.


## 2026-11-26 — Remove all obsolete projection assertions after canonical-history refactor

- PR #26 removed the embedded `customers.orderSummaries` write protocol, but the Emulator suite still contained three negative assertions requiring that projection on order create, status changes and total edits.
- Those assertions no longer represented the intended Spark architecture and caused the latest-head Emulator stage to fail even though order lifecycle and actor-history invariants remained valid.
- When removing a duplicated data representation, search the complete test suite and remove or redesign every assertion that enforces the retired contract; preserve tests for the invariants that still apply (document schema, identity, lifecycle, history and atomic application workflows).
- Corrected in commit `d0ca98f145b0250534a958a18c685b435b490451`; automatic Actions run [#45729703091](https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45729703091) completed successfully. Do not call this a security fix for Spark client-maintained customer scalar aggregates.


## 2026-11-26 — Verify post-merge state before starting the next delivery scope

- PR #26 was squash-merged as `867946dc8f1fe0f3fc70bc6b8547173396090e10` after its automatic PR Actions and Preview were successful.
- A passing PR check is not a substitute for the push-triggered main workflow. Verify the exact main SHA and post-merge Actions run before pushing another code scope.
- Main run [#45730525536](https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45730525536) completed SUCCESS on the exact merge commit, including lint, typecheck, Emulator, Playwright and production build.
- Record Vercel's GitHub status context separately; do not infer deployment type or manually promote a production deployment.


## 2026-11-26 — Bound Firestore image payloads including duplicated cover fields

- Product documents store the cover in both `imageUrl` and `imageUrls[0]`; per-image limits must account for this duplicate when calculating worst-case document size.
- Five 150,000-character Data URLs plus the duplicated cover field total at most 900,000 ASCII bytes, leaving margin below Firestore's 1 MiB document limit for metadata.
- Validate at the service boundary and in Firestore Rules. UI file-size checks alone are bypassable.
- Preserve legacy oversized media on unrelated edits by validating image bounds only when image fields change; require replacement with bounded media before accepting a media edit.


## 2026-11-26 — F-03 product image payload bounds merged

- PR #29 merged as `a6b4f7e32a44885eeb2725992c197a38bd2c9e14` after automatic PR Actions and Preview were successful.
- Post-merge main run [#45732373657](https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45732373657) completed SUCCESS on the exact merge SHA, including lint, typecheck, Emulator integration, Playwright E2E and production build.
- Keep the stored Data URL string limit distinct from decoded image bytes: 150,000 ASCII characters means 150 KB of Firestore string payload, while the decoded base64 image is smaller.


## 2026-11-26 — Enforce staff membership identity without breaking legacy records

- Bind every new or updated `users/{uid}` membership's `uid` field to the document path. Admin update service should always write the path UID so legacy documents missing the field can be repaired.
- Keep email, name and createdAt immutable; constrain role/status to known enums and prevent self role/status changes in Rules, not only in UI controls.
- Preserve optional legacy identity fields on update by comparing their old/new values rather than requiring them to exist on every legacy document.


## 2026-11-26 — Small tasks mean cohesive changes, not one commit per file

- The owner clarified that work should be split into bounded functional milestones to avoid tool timeouts, but files that jointly implement one behavior must be changed and committed together.
- Creating a separate commit for every file fragments a single feature, increases GitHub operations and makes review/history harder to follow.
- Plan each bounded task around one independently reviewable behavior; include its related UI/service/Rules/tests/docs in one commit. Split only when the next piece is an independent milestone. Keep each tool operation bounded and avoid huge batches.


## 2026-11-26 — Correct stale project status from live GitHub state

- HANDOFF documents can lag behind merges; always verify PR state and exact main SHA before acting. PR #30 was already merged at `ec2d74115a61fc01f13e0124ffdd2aece0f252ff` even though the prior HANDOFF still described it as Draft.
- Historical audit documents must be visibly marked as snapshots when architecture changes. In this repo, callable Cloud Functions descriptions are obsolete for routine writes; Spark-compatible client transactions are current.
- Do not promise F-01 can be fully secured against a malicious authenticated client while retaining the Spark-only trusted-client architecture. A Rules-only guard must be proven against all transaction paths and Firestore Rules limits; otherwise explicitly record the residual accepted risk.


## 2026-11-26 — Verify feature branches against live main before calling functionality incomplete

- The old `feat/order-print-view` branch was 43 commits behind main, but the print button, print-only A4 layout and Playwright print assertions were already present on current main.
- Before porting or reimplementing an old branch, compare its exact changed files and behavior with current main. A stale branch is not proof that a feature is missing.
- Keep audit runbooks aligned with the active Firebase Spark client-transaction architecture; historical callable-Functions guidance must not be presented as the current operational procedure.


## 2026-11-26 — Respect implementation-first delivery; do not initiate tests

- The owner explicitly directed that the work should be completed and merged for operational use, without running tests or sending incremental reports.
- Do not start manual test suites, rerun CI, or hold delivery waiting for test results unless the owner later asks.
- Distinguish committed test coverage from executed verification. Never imply tests passed when they were not run.
- Prioritize the working implementation, preserve production/billing boundaries, and address defects reported during actual use.

## 2026-11-26 — Keep the internal CRM on Firebase Spark

- The owner confirmed the CRM is an internal tool and should use free resources rather than be engineered as a large public product.
- Keep the Firebase project on Spark. Do not introduce Blaze billing, Cloud Functions, or paid infrastructure to close F-01.
- Accept the remaining trust boundary: active authenticated clients can potentially alter customer scalar aggregates, and Firestore Rules cannot independently prove every client-computed cross-document total.
- Treat canonical `orders/{orderId}` documents as the durable order history and reconciliation evidence; customer scalar aggregates are display/cache values.
- Do not add a restrictive profile-only customer rule unless every valid create/edit/status/cancel transaction is preserved and the rule can actually prove the intended invariant. A superficial restriction is worse than a clearly documented accepted risk.
- Continue implementation-first delivery: no manual test runs or incremental reports unless requested; fix concrete defects observed during real use.

## 2026-11-26 — Keep order customer identity bound to the selected phone

- The create-order UI previously allowed editing the phone after selecting a saved customer while retaining that customer's document ID. This could attach an order whose phone snapshot belonged to another person to the originally selected customer history and aggregates.
- Clear the selected customer and the prefilled name/address when the identity phone changes; let the operator select the newly matched customer or enter a new profile.
- Enforce the same invariant inside `createOrder()`: an explicitly selected customer must still exist and its normalized phone must match the order snapshot before any writes are committed.
- UI guards are not sufficient by themselves; validate identity at the Firestore transaction boundary as well.


## 2026-11-26 — Avoid duplicate Firestore reads on catalog mount

- Keep a single loading path for both initial page load and manual retry; do not leave a second direct collection read in the mount effect alongside a reusable loader.
- Use a monotonically increasing request token so a slow earlier request cannot overwrite a later retry, and invalidate pending requests when the page unmounts.
- On Firebase Spark, redundant collection reads consume the same limited free read quota without improving the UI.


## 2026-11-26 — Guard detail-page reads by request identity

- A boolean mounted/ignore ref is insufficient when a client component is reused across dynamic route IDs: the next route effect can set the same ref back to active before the previous route's request resolves.
- Give each load a monotonically increasing request identity; only the latest identity may update data, errors or loading state. Invalidate it during route-effect cleanup.
- Apply the same identity check to pagination requests so a prior customer's/order's history cannot append to the newly opened profile.


## 2026-11-26 — Keep React effect bodies free of synchronous state updates

- When an effect needs to start an async Firestore load through a helper that sets loading/error state, defer invocation with a microtask and guard it with an effect-local cancellation flag.
- Cleanup must cancel a not-yet-started invocation and invalidate any request already started. This satisfies the hooks lint rule without losing stale-response protection.
- A merged change that triggers CI must be treated as a delivery defect even when CI was not explicitly requested to be run; inspect the automatic workflow result and fix regressions caused by the patch.


## 2026-11-26 — Link existing Firebase identities without weakening membership authorization

- Google sign-in was available on the login page, but the staff UI could provision only new email/password Auth accounts. An existing Google identity with no `users/{uid}` membership was blocked correctly, yet there was no in-app admin path to authorize it.
- Keep authentication and CRM authorization separate: signing in never grants CRM access automatically. Show the authenticated user's own UID/email on the blocked screen; require an active admin to verify both with the employee and create the membership.
- Use a create-only Firestore transaction for linking. Do not overwrite an existing membership, trust a client-provided role, or weaken the `users/{uid}` create Rule. The existing Rules remain the authorization boundary.
- The client SDK cannot independently prove that an arbitrary UID belongs to the supplied email; this remains an explicit admin verification step, not an automated identity assertion.


- After an admin grants the membership, an authenticated employee should be able to retry membership resolution in the same session instead of being forced to sign out and back in. The retry invalidates the cached membership attempt and re-reads the current UID's membership.


## 2026-11-26 — Bind product edit state to the dynamic route identity

- A dynamic detail page must never reuse the previously loaded entity's form state with a newly changed route ID. Ignore flags prevent stale responses, but they do not prevent old data from remaining visible while the new request is loading.
- Key the data-owning child component by the route ID so its loading, error and form state are reset together when the entity changes.
- Keep service-side field bounds aligned with Firestore Rules. UI required fields alone do not protect direct service callers or oversized values.
- Treat deactivate and save as separate in-flight operations; disable repeated actions while either operation is running.


## 2026-11-26 — Bind customer profile state to the customer route identity

- Request IDs prevent an older Firestore read from overwriting a newer customer, but they do not reset component-local edit fields, save messages or pagination state when a dynamic route component is reused.
- Key the customer-detail data-owning child by customer ID. This resets the entire profile/edit/history state and lets the previous component's cleanup invalidate in-flight reads.
- Apply the same rule to any detail page with mutable form state, not only pages that fetch a record.


## 2026-11-26 — Use the CRM membership profile as the staff identity

- Firebase Auth proves who signed in; the `users/{uid}` membership is the CRM profile and role record. Use membership `name` and `email` for staff display and order audit actor attribution, with Firebase Auth fields only as a legacy fallback.
- This is especially important for linked Google identities: the Google profile display name may differ from the name the shop uses operationally.


## 2026-11-26 — Preserve order semantics across local time and product lifecycle changes

- Store delivery timestamps as ISO UTC, but convert them to/from the browser's local wall-clock value for `datetime-local` inputs. Slicing a UTC ISO string directly shifts delivery time outside UTC.
- Deactivating a catalog product must block new orders, not silently reprice or make an already accepted order impossible to edit. Existing orders may retain/reduce that product at the original snapshot price; they may not add or increase it.
- Keep service-side item-count bounds aligned with Firestore Rules and guard delayed customer prefill so it cannot overwrite a phone identity entered by the operator.


## 2026-11-26 — Keep dashboard reads bounded and make partial metrics explicit

- A date-bounded Firestore query can still grow without limit. Cap today's order snapshot and expose a visible truncation warning rather than silently reading every order or silently presenting partial totals as exact.
- Dashboard KPI values should not look like zero while the first request is pending. Keep prior values during refresh, provide a retry path on failure, and guard overlapping requests by identity.


## 2026-11-26 — Do not allow settings edits after a failed initial read

- Store settings are business-critical shared configuration. If the initial read fails, never leave an editable form populated with empty defaults; hide it until a successful read and provide a retry path.
- Keep settings loading independent from save state, invalidate stale reads on unmount, and clear delayed success-feedback timers during cleanup.
- Use the CRM membership profile as the source for the staff name shown in settings; Firebase Auth is the authentication identity, not the editable CRM display profile.
- For staff management, invalidate list requests when admin access changes or the page unmounts so an old response cannot repopulate stale privileged data.


## 2026-11-26 — Keep informational dependency audits out of the functional CI critical path

- `npm audit` depends on registry/advisory network availability and can stall an otherwise healthy lint/typecheck/Emulator/E2E/build pipeline.
- Run informational dependency audits on a weekly schedule or explicit dispatch, with a bounded timeout and an artifact/summary. Keep the functional PR workflow focused on deterministic quality gates.
- Do not remove the main-branch push trigger unless required PR checks/branch protection are confirmed; otherwise direct pushes could bypass all automated validation.

## 2026-11-27 — Enforce one order line per product at the service boundary

- UI cart controls normally keep one line per product, but service inputs are also callable independently of that UI.
- Duplicate product IDs could create duplicate lines and, on edits, bypass per-line quantity checks for discontinued products (each duplicate line could individually stay below the original quantity while their sum exceeds it).
- Reject duplicate product IDs in both create and update service paths before opening the Firestore transaction. Keep the regression in the isolated Emulator integrity suite and verify rejected writes leave customer/order documents unchanged.
- Do not rely on the UI cart as an integrity boundary.



## 2026-11-27 — Prevent stale order-detail feedback timers

- Order status updates and order edits shared a status message but each scheduled an independent three-second timeout. An earlier timeout could clear a newer message before the user had time to read it; pending callbacks also survived route changes/unmount.
- Keep one timer ref per order-detail instance. Replace the prior timer whenever a message is shown, clear it when dismissed, and clear it during route-effect cleanup.
- Keep transient feedback lifecycle scoped to the current order detail rather than allowing overlapping timers to race.


## 2026-11-27 — Upload the compressed product image, not the original file

- The image service compressed every selected file to a bounded JPEG Data URL, but when Firebase Storage was enabled it uploaded the original File with its original MIME type. This wasted bandwidth and made the Storage path bypass the compression work.
- The browser canvas output is JPEG regardless of the source extension. Decode that exact Data URL into a Blob, upload it as `image/jpeg`, and use a `.jpg` object name so content type and extension describe the actual bytes.
- Keep the existing Firebase Spark default (no Storage upload unless explicitly configured) and the same bounded Data URL fallback. Do not change billing or Firebase configuration as part of image optimization.


## 2026-11-27 — Invalidate overlapping order-creation catalog reads

- The order-creation page loaded customers and active products with an unguarded `Promise.all`. Repeated retries or navigation during a slow read could let an older response overwrite newer state or update an unmounted page.
- Give each load a monotonically increasing request ID; only the latest request may update data, errors or loading state. Invalidate the request on effect cleanup.
- Keep the fix at the UI request lifecycle; do not change Firestore query scope or introduce paid infrastructure.


## 2026-11-27 — Guard image uploader callbacks after unmount

- Single- and multi-image uploaders awaited asynchronous Storage/fallback work and continued setting local state or calling parent callbacks after their component had unmounted.
- Use a per-component upload request identity, invalidate it in effect cleanup, and guard progress/success/error/finally updates. Always revoke temporary object URLs even when the request becomes stale.
- The upload itself may finish in the background, but a departed editor must not receive stale UI updates or mutate its parent state.
