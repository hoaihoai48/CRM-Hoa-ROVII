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
