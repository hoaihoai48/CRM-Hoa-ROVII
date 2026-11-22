# CRM Hoa ROVII — Autonomous Delivery & Quality Playbook

- **Repository:** `hoaihoai48/CRM-Hoa-ROVII`
- **Default branch:** `main`
- **Operating model:** internal-first, SaaS-ready architecture, Firebase Spark-compatible, sales and CRM first
- **Status:** operating policy and implementation plan; this document does not claim that Playwright has already been installed or that any application feature has been changed.

## 1. Non-negotiable delivery rules

1. Work in small, ordered delivery steps. Finish, test, inspect and record the current step before starting the next one.
2. If any required check fails, stop progression, diagnose and fix the current step. Do not hide failures or mark the step complete because the build alone passed.
3. Do not require the owner to open a local Mac, run commands or manually test the UI for routine verification. Prefer GitHub Actions, Firebase Emulators and a Vercel Preview deployment.
4. Never claim that a test was run unless the corresponding command/workflow actually ran and its result was inspected.
5. Never use production customer/order data for automated tests. Use Firebase Auth/Firestore Emulators or a dedicated isolated test project and test accounts.
6. Do not merge to `main`, deploy to production, change billing plans, enable paid Firebase services, or run destructive data migrations without explicit owner approval.
7. If credentials, environment configuration, permissions, an unavailable runner or a human-only decision blocks progress, stop and report the exact blocker. Do not invent a successful result.

## 2. Required quality gates for every delivery step

A step is complete only when all applicable gates pass:

| Gate | Required evidence |
|---|---|
| Source review | Relevant services, types, Firestore Rules, indexes and affected UI routes inspected |
| Static quality | `npm run lint` and `npm run typecheck` pass |
| Unit/integration | Relevant unit tests and Firebase Emulator tests pass |
| Production build | `npm run build` passes |
| Browser E2E | Playwright tests pass against an isolated test environment |
| Preview verification | Preview deployment is ready; critical flows and browser console/network errors are inspected |
| Regression | Existing critical flows still work; no unrelated regression is known |
| Git hygiene | One or a small number of cohesive commits, clean diff, PR contains test evidence |
| Handoff | Step status, commit SHA, PR URL, CI run URL, test summary and remaining risks recorded |

A gate that cannot run must be marked **BLOCKED / NOT RUN**, with the reason. It must not be marked PASS.

## 3. Playwright strategy — browser testing without owner-local testing

### 3.1 Test architecture

Add Playwright as a repository development dependency and configure `@playwright/test` with:

- Chromium as the initial required browser; add Firefox/WebKit only when the product and CI budget justify it.
- Separate E2E configuration and scripts, for example `test:e2e` and `test:e2e:ui`.
- Deterministic fixtures and test data; unique test identifiers per run.
- Screenshots, traces and videos on failure (retain only what is useful to diagnose failures).
- Stable accessible selectors (`getByRole`, labels and test IDs where necessary), not brittle CSS/XPath selectors.
- No production credentials or secrets in committed files, screenshots, traces or logs.

### 3.2 Test environment

Preferred order:

1. Run the Next.js app and Firebase Auth/Firestore Emulators in GitHub Actions.
2. Seed only synthetic test data and create/reuse dedicated test identities.
3. Run Playwright against that isolated app.
4. Deploy a Vercel Preview for a second smoke/regression pass when environment variables and safe test data are available.

Do not point write-capable E2E tests at the production Firebase project. Preview deployment by itself is not proof that the app is connected to a safe database.

### 3.3 Minimum browser scenarios

| Area | Required scenarios |
|---|---|
| Authentication | Valid login, invalid login, logout, unauthenticated route protection |
| Staff/permissions | Admin-only pages and actions; staff access boundaries |
| Customers | Create, edit, search, open profile and view purchase history |
| Products | Create/edit where permitted, price and active/inactive state |
| Orders | Create, view, edit allowed fields, totals and validation |
| Order lifecycle | Allowed transitions, forbidden transitions, history consistency |
| Resilience | Empty states, validation errors, loading/error states, duplicate submission protection |
| Responsive | Critical workflows at desktop and mobile viewport sizes |

Add tests alongside the feature they protect. Do not build a huge speculative test suite before understanding the current application behavior.

### 3.4 CI integration

The existing pull-request workflow runs, in order:

1. Dependency installation with the lockfile.
2. Cloud Functions syntax check and dependency audit report.
3. MCP syntax/safety smoke tests.
4. Lint and TypeScript checks.
5. Firebase Emulator integration/security tests.
6. Install Chromium only with `npx playwright install --with-deps chromium`.
7. Run `npm run test:e2e` against isolated Auth/Firestore Emulators (login form, anonymous route guard, invalid credentials and active synthetic-member login).
8. Production build.
9. Upload Playwright HTML/JUnit report, traces and failure screenshots as CI artifacts (7-day retention).

Use supported project runtime versions from the repository configuration (currently documented as Node.js 24 and Java 21+ for Emulator tests). Keep CI permissions minimal. Avoid printing environment variables or secrets.

## 4. Step-by-step delivery protocol

Only one implementation step is active at a time. The next step starts only after the current step has passed its quality gates and its outcome has been recorded.

| Step | Scope | Exit criteria |
|---|---|---|
| S0 — Baseline & delivery infrastructure | Re-check current `main`, open PRs, CI, environment constraints, test scripts and security risks; establish Playwright and isolated E2E foundation | Baseline is current; lint/typecheck/build/Emulator tests are green; at least one authenticated browser smoke test passes in CI; no production data touched |
| S1 — Order workflow integrity | Audit and complete order validation, status state machine, status history, totals and customer aggregate consistency | Positive and negative Emulator tests pass; Playwright covers create/edit/status lifecycle; concurrency and invalid transitions are tested |
| S2 — Sales workflow completion | Improve order entry, recipient/delivery information, schedule, order code, staff assignment and printable order view according to verified business requirements | End-to-end order workflow passes on desktop/mobile; calculations and validation are verified |
| S3 — Customer CRM | Customer profile, purchase history, segmentation foundations, interaction history and follow-up data model | Customer CRUD/search/history and permission tests pass; no duplicate/incorrect aggregate regressions |
| S4 — Product catalog | Product categories/types, variants or options where justified, image constraints and pricing model | Product management E2E passes; Firestore document size and Spark constraints verified |
| S5 — Operations & finance foundations | Payment ledger, expenses, inventory/supplier foundations only after sales/CRM data contracts are stable | Reconciliation and permission tests pass; no totals inferred from untrusted client state |
| S6 — Reporting & automation | Useful operational metrics, reminders and low-cost automation within Spark constraints | Metrics reconcile against source records; recurring work has observable status and failure handling |

This is an ordered backlog, not permission to implement every item without validating the current source and actual shop workflow. Re-scope a step if the codebase or owner requirements contradict this plan.

## 5. Git, branch, commit and pull-request policy

### Branching

- Never develop directly on `main`.
- Use one feature/fix/docs branch per cohesive delivery step.
- Keep a PR focused on one step or one tightly related outcome.
- Do not create a PR for every individual file.

### Commit grouping

A commit represents one complete logical change, not one file.

Good examples:

- `feat(orders): complete order lifecycle workflow`
- `test(orders): cover order lifecycle and validation`
- `feat(crm): add customer interaction history`
- `test(e2e): add customer and order browser coverage`

Rules:

- Multiple files that implement one feature belong in the same commit.
- Do not create one commit per file.
- Do not combine unrelated features merely to reduce the commit count.
- Prefer a small number of meaningful commits per step; split only when the changes are independently understandable/revertible (for example, implementation versus a separate test-only follow-up).
- Avoid fixup/noise commits in the final PR history where practical.
- Each commit must be coherent; the PR as a whole must pass all required gates.

### Pull-request requirements

Every PR description must include:

- Goal and scope.
- Key files/modules changed.
- Data model, Firestore Rules and index impact.
- Tests run and exact PASS/FAIL/BLOCKED status.
- CI and Preview URLs where available.
- Screenshots or Playwright report for UI changes.
- Risks, migration/rollback notes and out-of-scope items.

Do not merge automatically. The owner retains the final merge and production-release decision.

## 6. Autonomous execution and scheduled follow-up

A scheduled agent/check-in may:

1. Read this playbook and inspect the repository's current branch, open PRs and latest CI results.
2. Identify the earliest incomplete step; never skip a failed or blocked earlier step.
3. Continue only that step on a feature branch.
4. Run the available checks and Playwright E2E; inspect actual results.
5. Group related files into meaningful commits and open/update a focused PR when the changes are ready.
6. Stop on missing credentials, unavailable test infrastructure, ambiguous business rules, data migration risk, failed checks or any action requiring owner approval.
7. Report what changed, commit/PR references, tests and evidence, blockers, and the exact next action.

Scheduling is a trigger to resume work, not a guarantee of uninterrupted execution or an unlimited chain of agents. Every run must re-read repository state and this playbook; do not assume a previous run completed successfully. Avoid overlapping runs and conflicting branches. Never let an automation merge a PR or deploy to production.

## 7. Completed delivery steps

### S0 — Baseline & delivery infrastructure

<badge>PASS</badge> CI, Firebase Emulator, authenticated Playwright smoke test and production build passed.

- PR #8: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/8
- Verified workflow: https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/44903815116
- Playwright: 4/4 passed (authentication form, anonymous dashboard guard, invalid credentials, active synthetic member login)

### S1 — Order workflow integrity

<badge>PASS</badge> Order lifecycle, history integrity, atomic customer projection and aggregate regression gates passed.

- PR #9: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/9
- Branch: `feat/order-workflow-integrity`
- Head commit: `6c603747f0de25dd676bcefaa29eebc490f1f572`
- Verified workflow: https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/44907652688
- Playwright: 5/5 passed, including create/edit/confirm/edit-confirmed/deliver/complete order journey
- Emulator: PASS — lifecycle, invalid transitions, history tampering, projection atomicity, aggregate repair and concurrency cases
- Static/build gates: PASS — dependency install/audit, Functions syntax, MCP smoke tests, ESLint, TypeScript and production build

## 8. Progress log

| Field | Value |
|---|---|
| Active step | S2 — Sales workflow completion |
| Step status | READY — S0 and S1 are merged; proceed to PR #5 audit then S2 |
| S0 PR | MERGED — https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/8 (c63f2da0d2250bf8957877ce33e17142a8d6f8d3) |
| S1 PR | MERGED — https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/9 (8ea157041599ca95966a02695e7c1a25ffe3c9a7) |
| S1 commit | `53781a838495ac6bcf438dc42214ae4a7faf464e` (PR head); merge `8ea157041599ca95966a02695e7c1a25ffe3c9a7` |
| CI run | https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/44966311523 — PASS |
| Playwright result | 5/5 PASS — 4 auth/access tests + complete order lifecycle |
| Emulator result | PASS — all integration and invariant checks |
| Vercel PR check | PASS — https://vercel.com/vu-nhim/tiem-hoa-rovii/E9N8oW7FWNUF9DrVkwz6nZwKsxVP |
| Production data | NOT ACCESSED |
| Merge | S0 and S1 merged; production deployment NOT PERFORMED |
| Next permitted step | Verify/merge PR #10 MCP structured outputs; then S2 read-only audit of recipient/delivery details, scheduling, order code, staff assignment and printable order view |

Do not mark a step PASS unless all required exit criteria have verifiable evidence.


## 9. Delivery session log — 2026-11-22

- PR #8 was squash-merged to main as `c63f2da0d2250bf8957877ce33e17142a8d6f8d3` after CI and Vercel checks passed.
- PR #6 was closed without merge; PR #9 is the canonical replacement.
- PR #9 was retargeted to main and its description refreshed.
- Squash merge caused the S1 branch to diverge from main by one historical S0 commit. Synchronize/rebase the S1 branch onto the new main, then rerun PR CI before merging.
- Main post-merge workflow #44966225503 was still in progress at handoff; verify its final conclusion.
- No production deployment, production data access, billing change or destructive migration occurred.


## 10. Delivery session log — 2026-11-22

- PR #8 merged to main by squash (`c63f2da0d2250bf8957877ce33e17142a8d6f8d3`).
- PR #6 closed without merge because its implementation was superseded by PR #9.
- PR #9 branch synchronized with main after the squash-history mismatch; final head `53781a838495ac6bcf438dc42214ae4a7faf464e`.
- Final PR #9 GitHub Actions run #44966311523 passed all gates: dependency installation/audit, Functions syntax, MCP safety smoke, lint, typecheck, Emulator suite, Playwright, production build and artifact upload. Vercel Preview feedback check passed with zero unresolved feedback.
- PR #9 marked ready and squash-merged to main (`8ea157041599ca95966a02695e7c1a25ffe3c9a7`).
- S0 and S1 are complete. PR #5 is the only remaining open PR and must be revalidated before any merge.
- No production deployment, production data access, billing changes or destructive migrations.


## 11. MCP follow-up — 2026-11-22

- Closed stale PR #5 without merging its combined diff.
- Extracted the MCP structured-output portion into PR #10: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/10
- New branch: `feat/mcp-structured-tool-outputs`
- Scope limited to MCP output schemas, structuredContent and smoke-test coverage for schema declarations and README file reads.
- Fresh CI run #44966591236 pending at handoff; Vercel check passed.
- Firebase Storage removal was excluded; the existing optional Storage path remains unchanged. Any future Spark-only image-storage refactor must enforce Firestore document size constraints.
