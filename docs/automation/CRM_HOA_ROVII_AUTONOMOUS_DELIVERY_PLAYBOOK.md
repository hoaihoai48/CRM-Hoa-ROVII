# CRM Hoa ROVII — Autonomous Delivery & Quality Playbook

- **Repository:** hoaihoai48/CRM-Hoa-ROVII
- **Default branch:** main
- **Operating model:** internal-first, SaaS-ready architecture, Firebase Spark-compatible, sales and CRM first
- **Current delivery state:** S0/S1 complete; S2 technical hardening delivered through PR #16; S2 business semantics await owner decisions.

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
| Preview | Vercel Preview is Ready; inspect feedback/review threads and critical flows when supported |
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
| Active step | S2 — technical hardening complete through PR #18; business semantics pending owner decisions |
| S0 | COMPLETE |
| S1 | COMPLETE |
| S2 technical hardening | COMPLETE through PR #18 |
| Open PR inventory | None at last inspection |
| Latest code merge | 83c354436ff9dfedca180832fcec324c03a36ffa (PR #18) |
| Final PR #16 CI | #44988852658 — PASS |
| PR #16 Preview | Ready; zero unresolved feedback |
| Post-merge main CI | #45008753697 — PASS (PR #18); #45008325128 — PASS (PR #17) |
| Production data | NOT ACCESSED |
| Production deployment | NOT PERFORMED |
| Next action | Await owner decisions for remaining S2 business semantics; continue only non-blocked technical work |

PR #17 paginates customer detail history (25-row pages); PR #18 makes actor UIDs mandatory on appended history entries for UID-attributed orders while preserving legacy compatibility. Do not mark S2 fully complete until the remaining owner decisions have been implemented and their end-to-end acceptance criteria pass.

## 10. Resume instruction

Every new run must re-read this playbook and docs/automation/CRM_HOA_ROVII_CURRENT_STATE.md, fetch the live main ref, inspect open PRs and the latest Actions runs, and continue from the earliest incomplete step. PRs #8–#18 must not be repeated. Never infer a successful CI result from a started or cancelled workflow.


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
