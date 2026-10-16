# CRM Hoa ROVII — Source Audit & CI Baseline

- **Repository:** `hoaihoai48/CRM-Hoa-ROVII`
- **Audit date:** 2026-10-16
- **Reviewed base commit:** `c9d7871fbbfcc5a0c7176c1581340041928a3ee7`
- **Scope:** package/configuration, Firebase rules/configuration, customer/order/product/staff/settings/storage services, AuthProvider, existing emulator integrity suite, workflow presence and current commit status.
- **Execution note:** GitHub Actions run #18 passed lint, typecheck, Emulator integration tests and production build on the current code changes, including the staff-provisioning compensation and dependency audit reporting. The Local Bridge status endpoint is now responding, but it is configured for `/Users/vu/Developer/giao-trinh-ikh`, not this CRM repository, so it cannot safely execute CRM commands in the current configuration.

## Executive summary

The repository has real Firebase Authentication and Firestore service code, a customer/order transaction model, role-aware membership rules, and an integration suite. It is not accurate to describe the current app as mock-only; the README had stale Phase 1/Phase 2 wording.

The highest-priority unresolved issue is data-integrity enforcement at the Firestore security boundary. The existing emulator suite's Case H intentionally writes corrupt aggregate fields to a customer document using the authenticated client and expects the write to succeed before calling the repair utility. That is direct evidence that an active member can write system-computed fields without going through order service invariants.

## Findings

### P0 — Production gate: business documents permit broad client writes

**Evidence:** `firestore.rules` allows `read, write: if isActiveMember()` for `orders`, `customers`, and `products`. The existing `scripts/test-emulator-integrity.ts` Case H directly merges corrupt values for `totalOrders`, `totalSpent`, and `orderSummaries` into a customer record, then verifies that the repair function restores them.

**Impact:** a signed-in active staff/admin client can bypass TypeScript service validation and mutate business records directly. Client-side transactions and UI checks are not a security boundary.

**Recommendation:** do not attempt a superficial field allowlist without modeling cross-document invariants. First add negative security tests for direct customer aggregate writes and forged order totals/status transitions. Then move critical mutations to a trusted server endpoint/Cloud Function (or implement rigorously tested Firestore Rules using `getAfter()` and field-level invariants). Admin SDK paths must independently validate caller identity, role, and input because Admin SDK bypasses Firestore Rules.

**Status:** still an unresolved P0 production gate. The existing client-side order/customer transaction architecture cannot be secured by a superficial field allowlist: order creation, edits, status changes and customer aggregates are coupled across documents, and Firestore Rules cannot safely recompute the full customer projection from an unbounded orders collection. The safe remediation is a staged migration of critical writes to a trusted callable/HTTPS backend (or an equivalently trusted server path), followed by denying direct client writes to orders and computed customer fields. Do not tighten these write rules before migrating the client services, or normal order creation/edit/status flows will break.

### P1 — Phone normalization allows equivalent Vietnamese numbers to diverge

**Evidence:** `src/lib/services/customers.ts` strips non-digits, while `isValidVNPhone()` accepts both `0xxxxxxxxx` and `84xxxxxxxxx`. Customer document IDs and `phoneNormalized` use the uncanonicalized digit string. Thus `0912345678` and `+84912345678` can resolve to different deterministic IDs/normalized values.

**Impact:** duplicate customer records and split purchase history are possible.

**Action in this PR:** canonicalize valid Vietnamese mobile numbers to national `0...` format, search canonical plus raw/international variants, and preserve existing deterministic legacy IDs. Emulator regression cases cover `0...` versus `+84...` aliases and lookup/reuse of a legacy `CUST_84...` record; CI run #11 passed these cases.

### P1 — Staff creation can leave an orphan Authentication account

**Evidence:** `src/lib/services/staff.ts:createStaffAccount()` creates the secondary Firebase Auth user, then writes the Firestore membership in a `try/finally` that signs out the secondary Auth instance. If `setDoc(users/{uid})` fails, the Auth user remains but the membership is absent.

**Impact:** the user may authenticate but cannot access the CRM; the admin sees a failed operation while the account remains provisioned.

**Action in this PR:** if writing the membership fails after Firebase Authentication creates the account, attempt a compensating deleteUser() on that newly created account. If cleanup also fails, surface the UID and both errors so an administrator can recover it deliberately. This is best-effort client-side compensation, not a substitute for server-side provisioning; a forced failure-path test remains outstanding.

### P1 — CI was not present at the standard workflow paths

**Evidence:** `.github/workflows/ci.yml`, `ci.yaml`, and `deploy.yml` were not found on the reviewed base branch. The latest reviewed base commit status reported Vercel success only. `package.json` had no typecheck script. The repository already has an Emulator integration suite, and prior audit notes indicate a local run was blocked by JDK 17 while Firebase tooling requires JDK 21+.

**Action in this PR:** add PR/push/manual quality workflow with Node 24 and Java 21, running lint, typecheck, Firebase Emulator integration tests and production build. The first run passed lint but uncovered the independent TypeScript error noted below. The workflow must rerun after the fix before this baseline can be called green.

### P1 — Clean-checkout TypeScript error (found by new CI)

**Evidence:** the first GitHub Actions run failed at `src/app/layout.tsx(22,50): error TS2304: Cannot find name 'LayoutProps'.` The root layout used a generated Next route helper type that was not available before a build generated route types.

**Action in this PR:** replace that dependency with an explicit `Readonly<{ children: ReactNode }>` type, which is sufficient because the layout does not consume route params. The next CI run passed this typecheck step.

### P1 — Emulator suite lost its authenticated session before CRUD regression tests

**Evidence:** the first full Emulator run passed the order lifecycle, concurrency and membership checks, then failed at the first customer creation in the later CRUD regression block with `permission-denied`. The preceding unauthenticated-access test intentionally called `signOut(auth)`, but the script did not sign back in before the customer/order update regression cases.

**Action in this PR:** sign back in as the active test staff user after verifying the unauthenticated denial, and rename the later test labels to avoid reusing CASE K/L labels already used earlier. CI run #11 passed the complete Emulator suite and production build.

### P2 — Dependency vulnerabilities require version-by-version triage

**Evidence:** the current Node 24 CI install reports 20 npm audit findings: 15 high and 5 moderate, with no critical findings. The report identifies direct dependencies `firebase`, `firebase-tools`, and `eslint-config-next`, plus vulnerable transitive dependencies including `@firebase/firestore`, `@grpc/grpc-js`, `basic-ftp`, `braces`, `chokidar`, `fast-glob`, `get-uri`, `micromatch`, `pac-proxy-agent`, `proxy-agent`, `@google-cloud/pubsub`, `@opentelemetry/core`, `gaxios`, `re2`, and `uuid`. Most suggested fixes require reviewing version changes rather than a clearly safe patch-only upgrade.

**Action in this PR:** add an informational npm audit summary to CI and upload the full JSON report as a 7-day artifact. Do not run `npm audit fix --force` blindly; dependency updates must be reviewed for compatibility and regenerated lockfile consistency. See [Dependency Audit](DEPENDENCY_AUDIT_2026-10-16.md).

### P2 — Unbounded list reads will become expensive as the dataset grows

**Evidence:** `listOrders()`, `listCustomers()`, and `listProducts()` retrieve collection snapshots without pagination. Some list methods fall back to unordered full-collection reads when an index-related error is detected.

**Impact:** read cost, memory use, and initial page latency grow with the entire dataset.

**Recommendation:** add cursor pagination and explicit query/index coverage after the current correctness/security baseline is stable. Do not treat a missing index as a normal production fallback.

### P2 — Product images can be stored as Data URLs in Firestore

**Evidence:** `src/lib/services/storage.ts` defaults to compressed Data URLs unless `NEXT_PUBLIC_FIREBASE_STORAGE_ENABLED=true`. The product service limits image count to five, but a count limit alone does not guarantee every Firestore document stays under the document-size limit.

**Impact:** larger product documents, repeated image transfer on list reads, and potential document-size failures.

**Recommendation:** keep the current fallback only as an intentional small-catalog mode; validate encoded size before saving. Prefer Firebase Storage URLs for production after bucket and billing constraints are confirmed.

### P2 — README no longer matches implementation

**Evidence:** README on the base branch still described mock data and Firebase as a future Phase 2, while services already use Firebase Authentication/Firestore.

**Action in this PR:** update README with current architecture, routes, setup requirements, commands and known risks.

### Security remediation progress — trusted order mutation callables

The PR now adds four Firebase Functions v2 callables: `createOrderSecure`, `updateOrderSecure`, `updateOrderStatusSecure`, and `syncCustomerAggregatesSecure`. The browser services for order creation, editing, status changes, and aggregate repair call these server endpoints. Each operation checks the authenticated UID's active membership in the same Firestore transaction as the mutation; create/edit re-read product records and calculate totals on the server; status changes enforce the transition graph and derive the history actor from membership data; aggregate repair queries the orders collection on the server. The current head's GitHub Actions run must still complete before these changes are considered verified.

This is not closure of the P0 issue. Firestore rules still allow direct client writes to entire order/customer/product documents, so a malicious client can bypass the callables until rules are tightened. Negative tests proving direct writes to totals/status/history/customer aggregate fields are denied are still outstanding. Keep the production gate open until the direct-write boundary is enforced after all valid UI flows are migrated and verified.

## Test isolation and command setup

The repository has no `.firebaserc` file. To prevent emulator tests from silently targeting a non-demo project, this PR adds `scripts/run-emulator-tests.mjs`, which runs Auth/Firestore emulators with the isolated project ID `demo-crm-hoa-rovii` and passes the same ID to the test process.

Commands:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:emulator`

## MCP / execution architecture recommendation

Do not add a second arbitrary-shell server inside the Next.js application. The existing iKH Local Bridge is the natural place for local allowlisted command execution, while GitHub Actions is the clean runner for repeatable CI.

Recommended separation:

1. **Local Bridge tools:** repository identity/status, read/search source, diff, and a strict allowlist of project commands (`npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:emulator`). Require an explicit configured working directory; reject arbitrary shell strings, path traversal, installs, secret reads, and Git push/merge.
2. **GitHub Actions:** PR CI and manually dispatched named tasks only. Never accept an arbitrary shell command as a workflow input. Use least-privilege token permissions and do not pass production secrets to PR jobs.
3. **GitHub connector:** use existing repository/PR APIs for file inspection, branch/PR creation and run status; avoid duplicating these APIs in MCP.
4. **Results:** return command, exit code, bounded logs, commit SHA, workflow URL and artifact references. Never report success from a queued/running workflow.

**Integration blocker:** the Local Bridge status endpoint responds, but the configured workspace is `/Users/vu/Developer/giao-trinh-ikh`, not this CRM repository. No CRM commands were run through the mismatched workspace. Configure and verify a dedicated CRM working directory before using the Bridge for CRM-specific commands. This PR adds CI and documents the contract; it does not claim a CRM-specific MCP/Bridge configuration has been deployed.
