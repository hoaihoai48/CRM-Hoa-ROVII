# CRM Hoa ROVII — Source Audit & CI Baseline

- **Repository:** `hoaihoai48/CRM-Hoa-ROVII`
- **Audit date:** 2026-10-16
- **Reviewed base commit:** `c9d7871fbbfcc5a0c7176c1581340041928a3ee7`
- **Scope:** package/configuration, Firebase rules/configuration, customer/order/product/staff/settings/storage services, AuthProvider, existing emulator integrity suite, workflow presence and current commit status.
- **Execution limitation:** GitHub source was inspected through the connected GitHub integration. The connected iKH Local Bridge status probe returned HTTP 404, so local commands could not be run from this session. This report does not claim a fresh local lint/build/emulator run.

## Executive summary

The repository has real Firebase Authentication and Firestore service code, a customer/order transaction model, role-aware membership rules, and an integration suite. It is not accurate to describe the current app as mock-only; the README had stale Phase 1/Phase 2 wording.

The highest-priority unresolved issue is data-integrity enforcement at the Firestore security boundary. The existing emulator suite's Case H intentionally writes corrupt aggregate fields to a customer document using the authenticated client and expects the write to succeed before calling the repair utility. That is direct evidence that an active member can write system-computed fields without going through order service invariants.

## Findings

### P0 — Production gate: business documents permit broad client writes

**Evidence:** `firestore.rules` allows `read, write: if isActiveMember()` for `orders`, `customers`, and `products`. The existing `scripts/test-emulator-integrity.ts` Case H directly merges corrupt values for `totalOrders`, `totalSpent`, and `orderSummaries` into a customer record, then verifies that the repair function restores them.

**Impact:** a signed-in active staff/admin client can bypass TypeScript service validation and mutate business records directly. Client-side transactions and UI checks are not a security boundary.

**Recommendation:** do not attempt a superficial field allowlist without modeling cross-document invariants. First add negative security tests for direct customer aggregate writes and forged order totals/status transitions. Then move critical mutations to a trusted server endpoint/Cloud Function (or implement rigorously tested Firestore Rules using `getAfter()` and field-level invariants). Admin SDK paths must independently validate caller identity, role, and input because Admin SDK bypasses Firestore Rules.

**Status:** confirmed design risk; remediation requires a dedicated, tested change and is not silently changed in this CI groundwork patch.

### P1 — Phone normalization allows equivalent Vietnamese numbers to diverge

**Evidence:** `src/lib/services/customers.ts` strips non-digits, while `isValidVNPhone()` accepts both `0xxxxxxxxx` and `84xxxxxxxxx`. Customer document IDs and `phoneNormalized` use the uncanonicalized digit string. Thus `0912345678` and `+84912345678` can resolve to different deterministic IDs/normalized values.

**Impact:** duplicate customer records and split purchase history are possible.

**Recommendation:** define one canonical storage format (for example, Vietnamese national format), search canonical and legacy variants during migration, and add tests for `0...`, `84...`, `+84...`, separators, existing legacy records, and concurrent creation. Do not change IDs without a backward-compatible lookup/migration plan.

### P1 — Staff creation can leave an orphan Authentication account

**Evidence:** `src/lib/services/staff.ts:createStaffAccount()` creates the secondary Firebase Auth user, then writes the Firestore membership in a `try/finally` that signs out the secondary Auth instance. If `setDoc(users/{uid})` fails, the Auth user remains but the membership is absent.

**Impact:** the user may authenticate but cannot access the CRM; the admin sees a failed operation while the account remains provisioned.

**Recommendation:** move provisioning to a trusted server workflow where possible, or explicitly handle membership-write failure with a documented compensating action and a recovery/audit path. Add a test that forces the membership write to fail.

### P1 — CI was not present at the standard workflow paths

**Evidence:** `.github/workflows/ci.yml`, `ci.yaml`, and `deploy.yml` were not found. The latest reviewed commit status reported Vercel success only. `package.json` had no typecheck script. The repository already has `npm run test:emulator`, and prior audit notes indicate the local emulator run was blocked by JDK 17 while Firebase tooling requires JDK 21+.

**Recommendation:** add a pull-request/push/manual quality workflow with Node 22 and Java 21, running lint, typecheck, Firebase Emulator integration tests, and production build. Keep workflow permissions read-only and do not expose production secrets to test jobs.

### P2 — Unbounded list reads will become expensive as the dataset grows

**Evidence:** `listOrders()`, `listCustomers()`, and `listProducts()` retrieve collection snapshots without pagination. Some list methods fall back to unordered full-collection reads when an index-related error is detected.

**Impact:** read cost, memory use, and initial page latency grow with the entire dataset.

**Recommendation:** add cursor pagination and explicit query/index coverage after the current correctness/security baseline is stable. Do not treat a missing index as a normal production fallback.

### P2 — Product images can be stored as Data URLs in Firestore

**Evidence:** `src/lib/services/storage.ts` defaults to compressed Data URLs unless `NEXT_PUBLIC_FIREBASE_STORAGE_ENABLED=true`. The product service limits image count to five, but a count limit alone does not guarantee every Firestore document stays under the document-size limit.

**Impact:** larger product documents, repeated image transfer on list reads, and potential document-size failures.

**Recommendation:** keep the current fallback only as an intentional small-catalog mode; validate encoded size before saving. Prefer Firebase Storage URLs for production after bucket and billing constraints are confirmed.

### P2 — README no longer matches implementation

**Evidence:** README still describes mock data and Firebase as a future Phase 2, while services import Firebase Auth/Firestore and the repository has security rules, indexes, and emulator tests.

**Recommendation:** document the actual architecture, current verification commands, and known limitations.

## Baseline commands

The repository currently defines:

- `npm run lint`
- `npm run build`
- `npm run test:emulator`

TypeScript check is available directly as `npx tsc --noEmit`; this patch adds the equivalent `npm run typecheck` script.

No fresh command result is asserted in this report. The new GitHub Actions workflow is intended to produce the first repeatable CI result after the branch is opened as a PR.

## MCP / execution architecture recommendation

Do not add a second arbitrary-shell server inside the Next.js application. The existing iKH Local Bridge is the natural place for local allowlisted command execution, while GitHub Actions is the clean runner for repeatable CI.

Recommended separation:

1. **Local Bridge tools:** repository identity/status, read/search source, diff, and a strict allowlist of project commands (`npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:emulator`). Require an explicit configured working directory; reject arbitrary shell strings, path traversal, installs, secret reads, and Git push/merge.
2. **GitHub Actions:** PR CI and manually dispatched named tasks only. Never accept an arbitrary shell command as a workflow input. Use least-privilege token permissions and do not pass production secrets to PR jobs.
3. **GitHub connector:** use existing repository/PR APIs for file inspection, branch/PR creation and run status; avoid duplicating these APIs in MCP.
4. **Results:** return command, exit code, bounded logs, commit SHA, workflow URL and artifact references. Never report success from a queued/running workflow.

**Integration blocker:** the Local Bridge status tool returned HTTP 404 during this session. The Bridge implementation/configuration must be inspected and its endpoint restored before writing or registering new Bridge tools. This patch therefore adds CI and documents the contract; it does not claim an MCP server has been deployed or connected.
