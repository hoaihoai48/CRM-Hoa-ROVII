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

## 7. Progress log

| Field | Value |
|---|---|
| Active step | S0 — Baseline & delivery infrastructure |
| Step status | PASS — CI, Emulator integration, authenticated browser smoke test and production build all passed |
| Branch / PR | `feat/ci-playwright-emulator-e2e` — https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/8 |
| Commit SHA | `2c24fafa79568f3ff267d125e624fe4c26744986` |
| CI run | https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/44903815116 |
| Playwright result | 4/4 PASS — login form, anonymous dashboard redirect, invalid credentials, active synthetic member login/dashboard |
| Emulator integration | PASS — existing Firestore/Auth integrity suite |
| Static/build gates | PASS — npm ci, Functions lint, MCP checks, ESLint, TypeScript, production build |
| Preview verification | Vercel PR deployment check PASS; interactive Preview walkthrough not applicable to this test-infrastructure-only change |
| Production data | NOT ACCESSED |
| Next permitted step | S1 — Order workflow integrity |

Do not mark a step PASS unless all required exit criteria have verifiable evidence.
