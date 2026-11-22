# CRM Hoa ROVII — Autonomous Delivery & Quality Playbook

- **Repository:** hoaihoai48/CRM-Hoa-ROVII
- **Default branch:** main
- **Operating model:** internal-first, SaaS-ready architecture, Firebase Spark-compatible, sales and CRM first
- **Current delivery state:** S0/S1 complete; S2 technical hardening delivered through PR #18; F-02 Storage authorization is resolved by PR #22; PR #24 has synchronized the post-merge handoff; F-01 staff aggregate-write hardening is in active PR #25 and awaits final-head CI, Preview and review; F-03/F-04/F-05 remain in the backlog; S2 business semantics await owner decisions.

## 1. Non-negotiable delivery rules

1. Work in small, ordered delivery steps. Finish, test, inspect and record each step before starting unrelated work.
2. If a required check fails, diagnose and fix the current step. Never hide failures or mark a step complete because the build alone passed.
3. Do not require the owner to open a local Mac, run commands or manually test the UI for routine verification. Prefer GitHub Actions, Firebase Emulators and Vercel Preview.
4. Never claim that a test ran unless the corresponding workflow actually ran and its completed result was inspected.
5. Never use production customer/order data for automated tests. Use Firebase Auth/Firestore Emulators and synthetic identities.
6. The owner delegated routine engineering decisions, including merging ordinary low-risk code/docs PRs after all required checks pass and the diff is reviewed. This delegation does not include production deployment/release, paid-service/billing changes, destructive migrations or production data repair.
7. Preserve Firebase Spark compatibility. Do not introduce paid Firebase services, Cloud Functions or external paid search services without approval.
8. If credentials, permissions, unavailable infrastructure, ambiguous business rules or high-risk actions block progress, stop only at that boundary and ask the owner for the specific decision/approval.
9. Do not interrupt the owner with continuous progress reports. Continue autonomously; update this playbook and the current-state handoff at meaningful milestones.

## 2. Required quality gates

A delivery step is complete only when all applicable gates pass:

| Gate | Required evidence |
|---|---|
| Source review | Relevant services, types, Firestore Rules, indexes and affected UI routes inspected |
| Static quality | npm run lint and npm run typecheck pass |
| Integration/security | Firebase Emulator tests pass, including negative Rules cases where applicable |
| Browser E2E | Playwright tests pass against isolated Auth/Firestore Emulators |
| Production build | npm run build passes |
| Preview | Required for runtime/UI or Vercel deployment-config changes. For Firebase Rules, emulator/test infrastructure and other non-runtime code changes, Preview may be N/A only after latest-head Actions production build and relevant isolated tests pass. **Docs-only exception:** when the entire PR diff is limited to `docs/**` and Markdown, Actions may be skipped by `paths-ignore`; record Actions as NOT RUN (never PASS), state that application build/isolated app tests are not relevant, and mark Preview N/A because runtime/UI and Vercel deployment configuration are unchanged. Do not use prior baseline CI as evidence for the docs head; avoid consuming Free deployment quota |
| Regression | Existing critical flows remain intact; known trade-offs are documented |
| Git hygiene | Feature branch, cohesive commits, focused PR, final head SHA checked |
| Handoff | Status, commit SHA, PR/CI links, tests, risks and next action recorded |

A gate that cannot run must be marked BLOCKED / NOT RUN with the reason. Never mark it PASS.

## 3. Test architecture and environment

### 3.1 Preferred test environment

1. Run Next.js and Firebase Auth/Firestore Emulators in GitHub Actions.
2. Seed synthetic records and unique test identities only.
3. Run Emulator integration/security tests.
4. Run Playwright against the isolated app.
5. Run the production build.
6. Use Vercel Preview for deployment readiness and feedback checks; Preview alone does not prove a human workflow walkthrough or safe database wiring.

Do not point write-capable E2E tests at production Firebase. Do not include production credentials or secrets in fixtures, screenshots, traces or logs.

### 3.2 Current CI workflow

The repository workflow currently runs:

1. npm dependency installation with lockfile.
2. Cloud Functions syntax and dependency audit report.
3. MCP syntax/protocol/safety smoke tests.
4. ESLint and TypeScript typecheck.
5. Firebase Auth/Firestore Emulator integration tests.
6. Chromium install and Playwright browser E2E.
7. Production build.
8. Playwright diagnostics artifact upload.

Current runner versions: Node.js 24 and Java 21. CI concurrency cancels superseded runs on the same ref; do not interpret cancelled runs as passing.

### 3.3 Minimum browser scenarios

| Area | Required scenarios |
|---|---|
| Authentication | Valid/invalid login, logout, unauthenticated route protection |
| Staff/permissions | Admin-only actions and staff access boundaries |
| Customers | Create/edit/search/profile/history |
| Products | Create/edit where permitted, price and active/inactive state |
| Orders | Create/view/edit, validation and total calculation |
| Order lifecycle | Allowed/forbidden transitions and append-only history |
| Print | Print action and print-media visibility |
| Resilience | Empty/loading/error states and duplicate-submit protection |
| Responsive | Critical flows at desktop and mobile widths |

Add tests alongside the feature they protect. Prefer accessible selectors and stable labels.

## 4. Delivery protocol

1. Read the current-state handoff and inspect live GitHub refs, open PRs and recent Actions runs.
2. Identify the earliest incomplete or failing delivery step; do not skip failed gates.
3. Work on a feature branch, not directly on main.
4. Inspect all affected layers before changing a data contract: TypeScript types, service functions, Firestore Rules, indexes, UI, Emulator tests and Playwright.
5. Group related files into cohesive commits; avoid one commit per file and unrelated feature bundles.
6. Open/update a focused PR with goal, scope, data/Rules/index impact, exact test results, Preview URL and risks.
7. Before merge, verify the exact final PR head SHA, completed CI result, Preview feedback, reviews and unresolved inline threads.
8. When all required gates pass and no unresolved high-risk issue remains, the delegated agent may mark the PR ready and squash-merge it. Use expected_head_sha to prevent merging a moved head.
9. Verify the post-merge main workflow before recording final PASS.
10. Update the audit, current-state handoff and this playbook. Never deploy production as a side effect of a code merge.

## 5. Git and pull-request policy

- One feature/fix/docs branch per cohesive delivery step.
- Multiple files implementing one feature belong in the same logical commit.
- Do not combine unrelated features merely to reduce commit count.
- PR descriptions must include goal/scope, affected files, schema/Rules/index impact, exact tests, CI/Preview links, risks and rollback/migration notes.
- Merge normal low-risk PRs autonomously only after the checks above pass. Ask the owner for business semantics, production release, billing, production data repair/migration, or irreversible/high-risk actions.
- Preserve historical UUID order IDs and existing Firestore documents unless an explicitly approved migration is designed.

## 6. S0/S1 completed delivery

### S0 — CI and Playwright foundation

- PR #8: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/8
- Merge: c63f2da0d2250bf8957877ce33e17142a8d6f8d3
- Established isolated Emulator + Playwright CI and authenticated browser smoke coverage.

### S1 — Order workflow integrity

- PR #9: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/9
- Merge: 8ea157041599ca95966a02695e7c1a25ffe3c9a7
- State graph: new → confirmed/cancelled; confirmed → delivering/cancelled; delivering → completed.
- History is append-only; lifecycle transitions can change only status/history; content edits are limited to new/confirmed.
- Service transactions recompute product prices and customer aggregates; Rules enforce matching order/customer projection atomically.
- PR CI #44966311523 and post-merge main CI #44966474046 passed.

## 7. S2 delivered technical work

| PR | Delivered | Merge SHA | CI |
|---|---|---|---|
| #10 | MCP structured output schemas and smoke tests | 6ac8304c8df47fe0c2a94dd444591a59ebb5b2da | PR #44966591236 + main #44967174708 PASS |
| #11 | Atomic first-time customer + first order creation | 73bb72ca19e5af82027e7f27096e693cb5892497 | PR #44982355903 + main #44982521247 PASS |
| #12 | Optional creator/history actor UIDs, validated against auth UID | 64c539e423c78bfe0b7089889b40d479afdfa799 | PR #44982896197 + main #44983058488 PASS |
| #13 | Browser-native A4 printable order slip | bd3e259082b8f600db4474e39947b0ee0218e4fa | PR #44983725322 + main #44983907739 PASS |
| #14 | Bounded customer order projection; lifetime aggregate deltas | 568083053d7311f6d5abbe608f3a100f0c803444 | PR #44985057671 + main #44985288167 PASS |
| #15 | Dashboard local-day range + six newest orders | 4ce6d95095141180cb855426bff8c94c722b880b | PR #44985805872 + main #44986041575 PASS |
| #16 | Cursor pagination for orders/customers | 7e923b5a0a996468a211f76b8d1ff715699e3ce4 | PR #44988852658 PASS; post-merge main #44989024153 PASS |
| #17 | Customer order-history cursor pagination (25 rows + load more) | 8ce9930ee181b1fca788e823a53ffac8860d9067 | PR #45008095660 PASS; post-merge main #45008325128 PASS |
| #18 | Require authenticated actor UID on appended history for UID-attributed orders | 83c354436ff9dfedca180832fcec324c03a36ffa | PR #45008498582 PASS; post-merge main #45008753697 PASS |
| #21 | Firebase Security & Access-Control source audit | e728de1b8b98f91e976a3336a657720f4020f6b8 | Docs-only; code review + independent security review completed |
| #22 | Active-admin product image Storage Rules + Storage Emulator suite and demo-only test guards | 3efd04c601b4bffaa976edad38c282e921d82be4 | PR #45043911114 PASS on final head; post-merge main #45047810582 PASS |

### S2 technical invariants and trade-offs

- New customer and first order are written in one transaction; no orphan customer on failed order creation.
- Creator UID and history actor UID are optional for legacy compatibility; no staff assignment permission change.
- Print uses browser-native print CSS; no PDF dependency.
- Customer recent-order projection is capped at 51 entries; lifetime counters update by transaction deltas; full order history remains canonical in orders.
- Dashboard reads only the local-day range plus six newest orders.
- Normal order/customer browsing loads 50-row snapshot-cursor pages with explicit load-more.
- Search and non-default order status filters still load the full collection to preserve the existing global substring-search contract. This is intentional and documented.
- Customer detail order history is paginated independently (PR #17): 25 newest orders initially, then snapshot-cursor load-more; Playwright verifies 27 synthetic orders without skips.

## 8. S2 business decisions — do not guess

The following are documented in docs/audits/CRM_HOA_ROVII_S2_ORDER_WORKFLOW_AUDIT_2026-11-22.md and require owner input before implementation:

1. Whether customerSnapshot represents purchaser/contact and whether recipient can differ; recipient phone/address required or optional.
2. Exact delivery datetime, predefined time slots, or both; timezone and past-date rules.
3. Whether greeting-card message, delivery instructions and internal note are separate fields, and who can see each.
4. Human-readable order-code format, uniqueness scope and reset cadence. Keep UUID document ID canonical.
5. Single/multiple staff assignment, who can assign/reassign, and visibility/edit permissions.
6. Customer receipt, internal fulfilment sheet, or both; required print fields and branding.

The audit contains a backward-compatible optional-field candidate and regression matrix. Implement only after these semantics are confirmed. Do not backfill production records or change existing order IDs as part of ordinary feature work.

## 9. Progress log and next action

| Field | Value |
|---|---|
| Active step | PR #25 F-01 customer aggregate write boundary: restrict staff aggregate/projection writes to order-linked transactions, verify exact count/completed-spend deltas, preserve admin-only aggregate repair and run the full isolated Emulator/Playwright/build gates |
| S0 | COMPLETE |
| S1 | COMPLETE |
| S2 technical hardening | COMPLETE through PR #18 |
| Open PR inventory | PR #25 customer aggregate write-boundary hardening open and ready for review; PR #24 merged; PR #23 closed unmerged |
| Latest code merge | 3efd04c601b4bffaa976edad38c282e921d82be4 (PR #22) |
| Latest docs merge | 8f2d0d3695429ebdd47733caca1b51b80067f582 (PR #24; PR #21 was prior docs merge) |
| Final PR #16 CI | #44988852658 — PASS |
| PR #16 Preview | Ready; zero unresolved feedback |
| Post-merge main CI | #45008753697 — PASS (PR #18); #45008325128 — PASS (PR #17) |
| Production data | NOT ACCESSED |
| Production deployment | NOT PERFORMED |
| Next action | Finish PR #25 handoff/audit synchronization, mark ready, run latest-head CI and required Vercel Preview, complete exact-head code/security reviews, resolve all findings, and merge only after every gate passes; then verify post-merge main Actions |

PR #17 paginates customer detail history (25-row pages); PR #18 makes actor UIDs mandatory on appended history entries for UID-attributed orders while preserving legacy compatibility. Do not mark S2 fully complete until the remaining owner decisions have been implemented and their end-to-end acceptance criteria pass.

## 10. Resume instruction

Every new run must re-read this playbook and docs/automation/CRM_HOA_ROVII_CURRENT_STATE.md from main, fetch live refs, inspect open PRs/branches and latest Actions/Preview/review state, and continue from the earliest incomplete step. PRs #8–#24 are merged; PR #23 is closed unmerged; PR #25 is the active F-01 customer aggregate write-boundary PR on branch security/customer-aggregate-write-boundary-2026-11-23. PR #24 merged as 8f2d0d3695429ebdd47733caca1b51b80067f582 from head 4cf733f40da3ed8ddc79ffdd20f65645b3b7b84d; its code and independent documentation-focused security reviews completed without findings. PR #25 implementation commits are 7e886508dfa6f1c4315d38a2ad1899ca6e676fb0 and fb8842e7df3ba0109038fa7509e2b2dc259f87be (Rules helper split); its final head, CI, Preview and reviews must be checked live. Never infer a successful test or workflow result from a started, skipped or cancelled run.


## 11. Delivery update — PRs #17–#18

| PR | Delivery | Merge SHA | PR CI | Post-merge CI |
|---|---|---|---|---|
| #17 | Customer order history cursor pagination (25 rows + load more) | `8ce9930ee181b1fca788e823a53ffac8860d9067` | #45008095660 PASS | #45008325128 PASS |
| #18 | Require authenticated actor UID on appended history entries for UID-attributed orders; preserve legacy records | `83c354436ff9dfedca180832fcec324c03a36ffa` | #45008498582 PASS | #45008753697 PASS |

Both Vercel Previews were Ready with zero unresolved feedback. No production data or deployment, migration, billing change or paid Firebase service was involved.


## 12. Resume update — PRs #17–#18 (2026-11-22)

- PR #17 completed customer detail order-history pagination: first 25 newest orders, then explicit load-more using the customer-scoped snapshot cursor. Playwright verified 27 synthetic orders, ordering and complete traversal without duplicates/skips. Merge `8ce9930ee181b1fca788e823a53ffac8860d9067`; PR CI #45008095660 PASS; post-merge main #45008325128 PASS.
- PR #18 strengthened Firestore Rules: every appended status-history entry on an order with `createdByUid` must include `actorUid == request.auth.uid`. Emulator coverage verifies rejection without partial writes and acceptance of a valid authenticated UID; legacy orders without creator UID remain compatible. Merge `83c354436ff9dfedca180832fcec324c03a36ffa`; PR CI #45008498582 PASS; post-merge main #45008753697 PASS.
- Both Preview deployments were Ready with zero unresolved feedback. No production data/deployment, migration, billing or paid Firebase service was touched.
- Remaining owner decisions are unchanged: purchaser vs recipient, delivery scheduling/timezone, note visibility and separation, human-readable order code, staff assignment policy, and customer receipt vs fulfilment print content.


## 16. Audit review correction — 2026-11-22

- PR #21 security review found one wording issue in F-01: Firestore Rules constrain lifecycle transitions and preserve append-only status history, but same-status edits on `new`/`confirmed` orders can still change item/summary values without server-side price arithmetic validation. The audit impact text was corrected to state this precisely.
- This was a documentation-only correction; no Firestore/Storage Rules, application code, data, billing or deployment changed. Re-review the latest PR head before merge. Docs-only PRs are excluded from Actions by `paths-ignore`; no CI PASS should be inferred.


## 17. Delivery update — 2026-11-22 (PR #21 merged; PR #22 test fixture correction)

- PR #21 merged as docs-only commit `e728de1b8b98f91e976a3336a657720f4020f6b8`; code review on `f9fa49c5` completed without findings and an independent security review corrected F-01's same-status editable-order-total wording. Docs-only Actions are `paths-ignore`; Vercel Preview is N/A for docs-only changes.
- PR #22 adds active-admin Storage Rules, Storage Emulator tests, fail-closed demo/loopback guards, and Playwright demo-project isolation. CI #45043396941 on head `5562214aa1aaf89300be79dc7cb3a5f4abfa5bea` passed lint/typecheck and all Auth/Firestore/Storage Emulator tests, but 3/6 Playwright tests failed because fixture REST calls still used project `crm-hoa-rovii`; build was skipped. The E2E fixtures were corrected in `df358a63ebfecc62b98c0bb131febbf5eae44c59` and `2f643fd07c85c58d35b2ba37a6a0f1cac3133765`.
- Re-run the full workflow on the current synchronized PR #22 head and inspect the exact code/security review results before merging. Preview is N/A for this Rules/test-infrastructure-only PR; do not consume Vercel Free quota.
- PR #23 is closed unmerged and superseded. No production data, deployment, billing, migration or project-level Firebase configuration changed.


## 18. Delivery update — 2026-11-23 (PR #22 merged; F-02 resolved)

- PR #22 squash-merged as 3efd04c601b4bffaa976edad38c282e921d82be4 from final head 36ae3bf27c74e55cb674c00209e78df580ebf562.
- Storage product-image create/update/delete now requires authenticated active-admin membership; public reads remain intentional. The Storage Emulator suite covers anonymous, missing/malformed membership, active/inactive staff, admin upload/overwrite/delete, invalid MIME/extension, public read and the under-10-MiB boundary.
- Both Firestore and Storage Emulator test scripts fail closed outside project demo-crm-hoa-rovii with loopback Auth/Firestore/Storage hosts. Playwright and fixture REST calls use the same demo project.
- PR CI #45043911114 completed SUCCESS on the exact final head: lint, typecheck, Auth/Firestore/Storage Emulator, Playwright (6 tests) and production build. Earlier run #45043396941 failed 3/6 Playwright cases due mismatched fixture project IDs; corrected and re-run successfully.
- Codex code review on the exact head completed with no major findings; independent security review found no blocker; zero unresolved inline review threads. Vercel Free daily deployment quota was exhausted; Preview is N/A for this non-runtime Rules/test-infrastructure change.
- Post-merge main Actions for merge commit 3efd04c601b4bffaa976edad38c282e921d82be4 were not returned by the connector's PR-only workflow query; do not claim post-merge CI PASS until verified separately.
- F-02 is resolved. Next technical step: F-01 customer aggregate integrity. Preserve Spark architecture and all production safety boundaries.


## 19. Delivery update — 2026-11-23 (PR #24 handoff synchronization opened)

- PR #24 opened as a documentation-only follow-up to record PR #22's merge, close F-02, and refresh the handoff/playbook next action.
- Branch: docs/record-pr22-storage-security-merge-2026-11-23; initial head e36bf7fa119601ab4c5d0722a0d93805b8c6fb83; base merge 3efd04c601b4bffaa976edad38c282e921d82be4.
- Codex code review was running on the initial head at last inspection. Re-request if the branch changes; merge only after the final-head review completes without findings and the diff remains docs-only.
- Actions and Preview are not applicable to this Markdown-only change; no CI/Preview result is claimed.


## 20. Post-merge verification — PR #22 (2026-11-23)

- GitHub Actions push run #45047810582 on exact main merge `3efd04c601b4bffaa976edad38c282e921d82be4` completed SUCCESS; job #137286140172 confirms every step completed, including Auth/Firestore/Storage Emulator tests, Playwright and production build.
- PR #22 is verified at both final PR head CI #45043911114 and post-merge main CI #45047810582. The previous NOT VERIFIED note is superseded by this evidence.
- PR #24 remains docs-only: Codex code review on head `5fdd2b838dbc68ec28f5fc76d8b1c699fcd417e4` completed with two P2 findings (stale review-state wording and an ambiguous docs-only CI/Preview exemption). The corrections are being committed; both code and documentation-focused security reviews must complete on the new exact head. Actions are NOT RUN because `paths-ignore` excludes Markdown/docs; no CI PASS is claimed. Under the explicit docs-only exception, app build/isolated tests are not relevant and Preview is N/A; this exception does not cover Rules or emulator/test-infrastructure code.
- Next delivery step after PR #24 is closed: F-01 customer aggregate integrity, beginning with a focused Rules/Emulator design that preserves all valid create/edit/status/cancel transactions.


## 21. PR #24 review correction — 2026-11-23

- Codex code review on `5fdd2b838dbc68ec28f5fc76d8b1c699fcd417e4` completed with two P2 findings: the Next action described stale review state, and the docs-only CI/Preview exemption was ambiguous. Both documentation issues are corrected in the follow-up commit.
- The PR is strictly docs-only. The workflow `.github/workflows/ci.yml` excludes Markdown and `docs/**` through `paths-ignore`; therefore Actions are NOT RUN and no CI PASS is claimed. The docs-only exception is explicit: no application build or isolated app tests are relevant, and Preview is N/A when runtime/UI and Vercel deployment configuration are untouched. This does not waive latest-head build/test evidence for Rules, emulator/test-infrastructure or other non-runtime code changes.
- Reviews on older heads are stale. Request fresh code review and documentation-focused security review on the exact new head; merge only after both complete without findings and no unresolved threads remain. Vercel Free quota errors are not a docs-only merge gate.


## 22. PR #24 follow-up — stale resume instruction correction (2026-11-23)

- At the time of this historical entry, the fresh Codex code review on PR #24 head `05b58f7f147b1c351f5422d3ac933e576285f4ac` found one P3 documentation issue: the New-chat instruction still said the two P2 corrections were “being committed” although they were already present. Both P2 issues remain corrected; this follow-up changed the stale wording to a completed state and required reviewers to inspect the live PR head.
- At the time of this historical entry, PR #24 was documentation-only (three Markdown files). GitHub Actions were NOT RUN because the workflow excludes `docs/**` and Markdown via `paths-ignore`; no CI PASS was claimed. Vercel status on the previous head was success, but Preview was N/A for this docs-only diff and was not a merge gate.
- The two P2 threads are resolved/outdated; the P3 thread is unresolved until the correction is committed. The review receipts on earlier heads are stale. After this commit, request fresh code review and documentation-focused security review on the exact resulting head; do not merge while either review or any thread is unresolved.
- No application code, Firebase Rules, emulator/test infrastructure, production data, deployment, billing, project configuration or migration changed in PR #24. F-01 became the next code-delivery step after PR #24 merged.


## 23. Delivery update — 2026-11-23 (PR #24 merged; PR #25 F-01 in progress)

- PR #24 merged by squash as `8f2d0d3695429ebdd47733caca1b51b80067f582` from final head `4cf733f40da3ed8ddc79ffdd20f65645b3b7b84d`. Codex code review on that exact head reported no major issues; independent documentation-focused security review #6014579099 found no additional findings; all inline threads were resolved/outdated. Actions were NOT RUN because the entire diff was docs/Markdown excluded by `paths-ignore`; Vercel status was success but Preview was not a required gate.
- PR #25: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/25, branch `security/customer-aggregate-write-boundary-2026-11-23`, implementation commits `7e886508dfa6f1c4315d38a2ad1899ca6e676fb0` and `fb8842e7df3ba0109038fa7509e2b2dc259f87be` (Rules helper split to stay within per-function let-binding limits). It restricts staff customer updates to profile-only edits or order-linked aggregate/projection writes, checks exact `totalOrders` and completed-`totalSpent` deltas from the order before/after state, validates last-order date source markers, and keeps full aggregate repair admin-only.
- Emulator Case H now attempts a forged aggregate/projection update from active staff and a staff repair call; both must be denied. The same repair utility remains exercised as an active admin. Case N repair/compaction also runs as admin. Test REST helpers now use the explicit `demo-crm-hoa-rovii` project constant.
- First CI attempt #45072163005 on prior head `86843619b11a20212ba43faf8a3dcdf6800601ae` failed in the isolated Firestore Emulator at Rules compile time (`L253:7 Maximum allowed variable count of 10`). Commit `fb8842e7df3ba0109038fa7509e2b2dc259f87be` refactored the aggregate validation into smaller helper functions. The failure is not PASS; rerun the full workflow on the final live head.
- Second CI attempt #45072462152 on head `3ece609ac96af85bd1f897938b6f67001177eae1` reached concurrent order creation and then failed with Rules evaluation errors across order/customer/product operations. The next refactor separates the order ID from the unique appended history-entry ID and reduces customer-rule reads to one order before/after pair plus one optional latest-date source read. This is a hypothesis-driven reduction in Rules access pressure; only a fresh successful Emulator run can validate it.
- Third CI attempt #45072873209 on head `117bad7120d0f3fbbb93abb1d50f2ebffe012dc4` passed lint/typecheck and earlier Emulator cases, including staff aggregate-tamper denial and admin repair, but failed during the five-way concurrent order-create case with `PERMISSION_DENIED`/Rules evaluation errors. Commit `a46082a0e690bfeded48e27491da5c07f841ded9` changes create/status counter writes to Firestore `increment()` transforms while retaining exact Rules delta checks. This targeted concurrency fix is unverified until the next full isolated run passes.
- Fourth CI attempt #45073282950 on head `372bd7c04521f267ad463f3a403f5f0402904c32` passed lint/typecheck and all order/aggregate Emulator cases, including five-way concurrent creation, tamper/repair denial, admin repair, projection compaction and lifecycle transitions. It failed later in the membership/product-admin suite because the new aggregate-repair helper reused the existing `admin.tester@cuatiemhoa.vn` identity with a different password. Commit `dc56d5423d72c4da54f7d1e34b367b22474f2ebd` assigns the helper a unique email/password and removes its broad catch; rerun the full workflow on the final head. CI, Playwright, production build, Vercel Preview and exact-head code/security reviews remain pending. Preview is required because client-side order transaction behavior changes. Do not mark F-01 resolved until all gates pass and PR #25 merges.
- Residual trust boundary: active admins retain a privileged aggregate repair path; Firestore Rules still cannot independently prove client-side product-price arithmetic. No production data, deployment, billing, project configuration, migration or paid service touched.
