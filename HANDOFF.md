# CURRENT HANDOFF — 2026-11-26 (sequential V1 completion plan)

- Repository: `hoaihoai48/CRM-Hoa-ROVII`; default branch: `main`.
- Verified main commit: `5021a67fad65c61590f5ddceecca2a0d3b952b34` (PR #38).
- PR #38 is **MERGED**. It fixes the product-page React effect lint regression.
- PR #38 Actions run [#45844772182](https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45844772182): **SUCCESS** — lint, typecheck, Firebase Emulator integration, Playwright E2E and production build all passed.
- Main push Actions run [#45844801586](https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45844801586): **SUCCESS** on the same main commit, including lint, typecheck, Emulator, Playwright E2E and production build.
- No open PRs were found at the start of this delivery.
- Vercel status context on the main commit: **SUCCESS**. No manual deployment or promotion was initiated.
- The previous handoff header contained stale SHAs and duplicated current-state entries. This header supersedes them; older snapshots remain below for historical audit only.

## Product scope and completion definition

V1 is the internal flower-shop CRM defined in `GOAL.md` and `README.md`: Dashboard, orders, customers, products, staff/access, store settings, Zalo contact and printable order output. Explicitly out of scope: public storefront, customer accounts, cart/checkout, payments, inventory, suppliers and Zalo API.

V1 is complete only when the supported daily workflow works end to end across these modules, access rules match UI/service behavior, critical states/errors are handled, the app remains Spark-compatible, and the handoff records known residual risks. A green CI run alone is not product completion.

## Sequential delivery plan

| Step | Scope | Status | Completion gate |
|---|---|---|---|
| 1 | Baseline, scope and project inventory | **COMPLETE** | V1 routes, service boundaries, Rules and existing coverage have been mapped below. |
| 2 | Authentication, membership and access | **IMPLEMENTED IN PR #41** | Existing Firebase identities can be linked by an active admin after verifying the UID/email shown to the signed-in employee; the employee can refresh membership without signing out. Membership creation remains admin-only. Await delivery outcome before marking complete. |
| 3 | Product catalog | PENDING | Admin product create/edit/activate/deactivate, image handling, catalog selection and error/retry states work together. |
| 4 | Customer management | PENDING | Create/search/profile/history and phone identity are consistent; canonical order history is used. |
| 5 | Order lifecycle | PENDING | Create, totals, snapshots, edits allowed by lifecycle, transitions, cancellation, history and print are coherent. |
| 6 | Dashboard and operational summaries | PENDING | Date/status metrics reconcile to canonical orders; cancelled orders are excluded from completed revenue. |
| 7 | Cross-module UX and reliability | PENDING | Desktop/mobile navigation, loading/empty/error states, duplicate submission and stale-response cases are addressed. |
| 8 | Final handoff and delivery hygiene | PENDING | Latest merged SHA/PR/CI state and all residual limitations are recorded; no unresolved regression caused by delivery. |

### Execution rules

1. Work in the order above. Do not jump to an unrelated module because a minor issue is noticed elsewhere; log it for its planned step unless it blocks the current one.
2. Each milestone is a coherent behavior, including the related UI, service, types, Rules, tests and documentation where applicable. Do not create one commit per file.
3. Keep one active implementation PR at a time. Inspect current `main`, PRs and latest Actions before starting the next scope.
4. Do not manually run test suites or rerun CI unless the owner asks. Automatic GitHub Actions may run; inspect their results and fix regressions caused by our changes. Never claim unrun checks passed.
5. Avoid speculative pushes and redundant workflow runs. Preserve the existing CI quality gates and use `paths-ignore` for documentation-only changes.
6. Preserve Firebase Spark and the current client-side Firestore transaction architecture. No Blaze upgrade, Cloud Functions, paid infrastructure or billing changes.
7. Do not read or mutate production customer/order records, perform destructive migrations, change Firebase project configuration, or manually deploy/promote production without explicit approval.
8. Update this current-state section and `lessons.md` at meaningful milestones. Keep historical snapshots below; do not leave stale claims in the current-state section.

## Known accepted architecture boundary

F-01 customer scalar aggregates (`totalOrders`, `totalSpent`, `lastOrderDate`) remain client-maintained display/cache summaries under Firebase Spark. Firestore Rules cannot independently prove all cross-document arithmetic. Canonical `orders/{orderId}` documents are the durable order history and reconciliation evidence. Do not claim authoritative financial integrity or add superficial Rules restrictions that break legitimate transactions.

Resolved items: F-02 Storage authorization (PR #22), F-03 product image payload bounds (PR #29), F-04 staff membership identity/immutability (PR #30), F-05 historical audit drift correction (PR #31). PR #35 fixes selected-customer/phone identity mismatch. PR #36 consolidates product catalog loading but its initial lint regression was corrected by PR #38. PR #37 protects route-bound detail and pagination reads from stale responses. Order print output is already implemented on main; do not port the stale feature branch.

## Initial inventory findings

- `GOAL.md` and `README.md` define a finite internal V1 scope; the work must not expand into unrelated storefront/inventory/payment features.
- Orders list uses cursor pagination for the unfiltered default view, but switches to full collection loading for search/status filtering. README documents full-dataset search as a small-CRM limitation; evaluate its actual impact during the relevant module audit before changing it.
- Customer and product selection on order creation currently load complete customer/product collections; README documents this as acceptable only for small internal datasets. Assess practical usage and avoid adding costly infrastructure.
- Dashboard currently derives today's KPIs from a bounded order query; verify its date boundaries and status/revenue semantics during Step 6.
- Product and settings pages have client-side workflows; inspect service/Rules constraints together before changing their behavior.
- The main Actions run above is now successful. This verifies the current code snapshot only; it does not complete the remaining product audit.

## V1 route-to-service-to-permission inventory (Step 1 complete)

| Route / area | UI entry | Service/data boundary | Access contract | Existing automated coverage |
|---|---|---|---|---|
| `/login` | `src/app/login/page.tsx` | `src/lib/firebase/authService.ts`; membership resolved by `AuthProvider` via `getCurrentUser()` | Firebase Auth authenticates; a matching active `users/{uid}` membership is required before any AppShell route renders. | Email login is exercised by Playwright fixtures; no explicit Google onboarding E2E. |
| Shared protected shell | `src/components/layout/AppShell.tsx`, `AuthProvider.tsx` | `settings.getCurrentUser()`; Firebase auth observer | Requires authenticated UID, matching membership UID, active status and role admin/staff. Firestore Rules independently enforce active membership on business data. | Emulator checks unauthenticated, unprovisioned and inactive access; E2E tests use active memberships. |
| `/dashboard` | `src/app/dashboard/page.tsx` | `orders.getDashboardOrders()`, `settings.getStoreSettings()` | Active member read access to orders/settings. | Emulator Case P verifies bounded day/recent queries; dashboard UI has no dedicated E2E scenario. |
| `/orders`, `/orders/new`, `/orders/[id]` | Order list/create/detail pages | `services/orders.ts`, `customers.ts`, `products.ts` | Active members read/create/update according to Firestore order schema and state machine; order delete denied. | `tests/e2e/orders.spec.ts` covers create/edit/complete/print, phone identity change and customer-history pagination. Emulator suite covers totals, atomicity, state transitions, actor attribution, concurrency, canonical history and pagination. |
| `/customers`, `/customers/[id]` | Customer list/detail pages | `services/customers.ts`, canonical `orders` queries in `services/orders.ts` | Active members read/create/update; phone identity and createdAt immutable in Rules; delete denied. | Admin workflow E2E covers create/search/profile update; Emulator suite covers phone aliases, identity, aggregates and canonical history. |
| `/products`, `/products/new`, `/products/[id]` | Product list/create/edit pages | `services/products.ts`, `services/storage.ts` | Active members read; admin only create/update; delete denied. Storage image reads public, writes/deletes active-admin only. | Admin workflow E2E covers create/edit/deactivate; Emulator suite covers staff write denial, payload bounds, legacy-safe edits and Storage Rules. |
| `/staff` | `src/app/staff/page.tsx` | `services/staff.ts`; secondary Firebase Auth instance provisions email/password accounts | Admin only. Rules restrict membership list/create/update to active admins, bind UID to document path and prevent self-demotion/deactivation. | Admin workflow E2E covers provisioning and role/status management; Emulator suite covers membership identity and role boundaries. |
| `/settings` | `src/app/settings/page.tsx` | `services/settings.ts`, `services/storage.ts` for logo | Active members read; only active admins write settings. | Admin workflow E2E covers save; Emulator suite covers staff read-only/admin write. |
| Shared media | `ImageUploader`, `MultiImageUploader` | `services/storage.ts` | Product image writes require active admin when Storage is enabled; default Spark path stores bounded Data URLs in product docs. | Storage Rules script and product payload Emulator cases. |
| Shared navigation | `Sidebar`, `MobileHeader`, `MobileBottomNav` | Uses `AuthProvider` membership | Staff link hidden for non-admin; direct `/staff` route also renders an admin-only message. | E2E verifies staff cannot access staff-management controls. |

### Prioritized findings from the baseline audit

1. **Step 2 — Auth onboarding mismatch addressed in PR #41:** an authenticated but unprovisioned user can now provide their UID/email to an admin; the admin can create a membership for that existing Auth UID. The service uses a create-only transaction, and Firestore Rules still require an active admin. Admin must verify UID/email with the employee; the client cannot independently query Firebase Auth user records.
2. **Step 3/4/5 — Dataset-size trade-off:** orders/customers search and order-entry customer/product selection can read full collections. This is explicitly documented as a small-CRM constraint; keep it unless measured operational volume makes it a real problem. Do not add paid infrastructure.
3. **Step 6 — Dashboard semantics:** the service has bounded date and recent-order queries; verify timezone boundaries and completed-only revenue during the dashboard step.
4. **Step 7 — UX/reliability:** staff list/settings and several form loaders need a cross-route review for retry/unmount/duplicate-submit behavior. Do not broaden this into unrelated refactors.
5. **Accepted residual risk:** customer scalar aggregates remain client-maintained under Spark (F-01). The Emulator suite explicitly documents this trust boundary and verifies aggregate reconciliation from canonical orders; this is not a security guarantee against a malicious authenticated client.

### Existing quality gates

- `npm run lint`
- `npm run typecheck`
- `npm run test:emulator` (isolated demo Auth/Firestore/Storage Emulators)
- `npm run test:e2e` (Playwright against Auth/Firestore Emulators)
- `npm run build`

The latest exact-main Actions run recorded above passed these gates. No manual test suite was run during this audit.


## Historical handoff archive

The previous handoff snapshots are retained below for audit history only. Their PR states and next actions are superseded by the current-state section above.

---

# CURRENT HANDOFF — verified 2026-11-26 (supersedes stale status below)

- Repository: `hoaihoai48/CRM-Hoa-ROVII`; default branch: `main`.
- Live main SHA: `ec2d74115a61fc01f13e0124ffdd2aece0f252ff`.
- PR #30 (F-04 staff membership identity invariants) is **MERGED**, not open/draft. Main Actions run [#45735593396](https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45735593396) completed **SUCCESS** on this exact SHA. PR #30 head Actions [#45735493508](https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45735493508) also completed SUCCESS.
- PR #22 / F-02 Storage admin-only writes: RESOLVED.
- PR #29 / F-03 product image payload bounds: RESOLVED.
- PR #30 / F-04 staff membership identity: RESOLVED.
- F-05 stale audit narrative: documentation correction prepared in this branch; pending PR review/merge.
- F-01 customer aggregate integrity: OPEN. Under Firebase Spark, scalar customer aggregates remain client-maintained. No trusted server can be introduced without changing the approved hosting/billing architecture. A Firestore Rules-only solution must prove all valid order transaction cases and stay within Rules evaluation/access-call limits; do not ship a superficial restriction that breaks normal orders.
- Other backlog: broader Playwright coverage for Products, Customers, Staff, Settings and responsive workflows; verify/port order-print feature only after reviewing its old divergent branch.

## Operating constraints

Use GitHub connector only for this repo. Preserve Firebase Spark. Do not access/mutate production customer/order records, deploy/promote production, change Firebase project configuration/billing, or perform migrations without explicit approval. Do not manually run broad test suites unless requested; rely on automatically triggered Actions and report exact-head results. Update this handoff and lessons after every meaningful milestone. Keep one active code PR at a time and commit cohesive feature changes together.

---

# HANDOFF — CRM Hoa ROVII

**Last verified:** 2026-11-26 08:18 (Asia/Ho_Chi_Minh)  
**Repository:** `hoaihoai48/CRM-Hoa-ROVII`  
**Default branch:** `main`  
**Main SHA:** `f32814c65204a53d89a3502c09420235f3353f6b`  
**Canonical project memory:** [GOAL.md](GOAL.md) · [lessons.md](lessons.md) · [HANDOFF.md](HANDOFF.md)

> Re-fetch live GitHub state before acting. This handoff records verified state, not a substitute for checking current refs, PRs, Actions and deployment contexts.

## Owner operating direction

- Prioritize completing implementation. Do not proactively initiate manual test suites or repeated CI runs.
- GitHub Actions may run automatically after pushes; report only observed results and never claim an unrun check passed.
- Preserve Firebase Spark and production-data safety. No production data access/mutation, destructive migration, Firebase configuration or billing changes without approval.

## Executive status

**PR #26 and PR #29 merged successfully. PR #30 contains the F-04 staff membership identity/immutability implementation and remains Draft pending final latest-head verification/review.** Customer history uses canonical order documents, and product image payload bounds are enforced in code and Firestore Rules. The Spark scalar-aggregate limitation remains explicitly open.

## Repository and delivery state

### Main

- Live `main`: `f32814c65204a53d89a3502c09420235f3353f6b` (includes the F-03 merge verification lesson).
- PR #27 project-memory foundation remains on main: `AGENTS.md`, `GOAL.md`, `lessons.md`, `HANDOFF.md`.
- PR #25 closed without merge; superseded by PR #26.

### PR #26 — canonical customer order history

- URL: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/26
- State: **MERGED** (squash) into main.
- Merge commit: `867946dc8f1fe0f3fc70bc6b8547173396090e10`.
- Implementation: `orders/{orderId}` is the sole canonical customer order-history source; removed runtime dependence on embedded `customers.orderSummaries` and its bounded projection/refill/fingerprint protocol. Retained scalar UI summaries.
- Legacy `orderSummaries` fields are tolerated and left untouched. No production migration or data cleanup.
- This is a complexity reduction, **not** a security fix for scalar aggregate tampering.

### PR and post-merge verification

- PR Actions run: https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45729703091 — **SUCCESS** on the same application-code tree: lint, TypeScript, Firebase Emulator integration, Playwright E2E and production build all PASS.
- Post-merge main Actions run: https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45730525536 — **SUCCESS** on exact main commit `867946dc8f1fe0f3fc70bc6b8547173396090e10`. Dependency vulnerability report, MCP syntax/smoke checks, lint, TypeScript, Firebase Emulator, Playwright E2E and production build all completed successfully.
- Main commit Vercel status context: **SUCCESS**. The merge was owner-authorized; no manual production deployment or promotion was initiated.
- Manual final diff/security review found no new blocker in canonical order reads, transaction ordering, status/history invariants or Firestore access rules. The known Spark scalar-aggregate trust boundary remains explicit.
- No production customer/order records were read or modified; no migration, Firebase configuration or billing change.

### PR #29 — product image payload bounds (F-03)

- URL: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/29
- State: **MERGED** (squash) into main.
- Merge commit: `a6b4f7e32a44885eeb2725992c197a38bd2c9e14`.
- Enforces at most five images/product, Data URLs up to 150,000 characters (150 KB stored text), HTTPS URLs up to 2,048 characters, and changed note/category bounds.
- The cover is duplicated in `imageUrl` and `imageUrls[0]`; five images plus the duplicate cover are capped at 900,000 ASCII bytes, below Firestore's 1 MiB document limit.
- The zero-cost Firestore fallback progressively compresses image quality/dimensions and returns a clear error if the stored Data URL still exceeds the cap. Firebase Storage HTTPS URLs remain supported.
- Firestore Rules enforce the same bounds on create and image-field updates. Unchanged legacy oversized image/text values remain readable; unrelated edits do not rewrite or validate unchanged fields.
- PR Actions run [#45731819337](https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45731819337) — **SUCCESS**: dependency audit, MCP checks, lint, TypeScript, Emulator integration, Playwright E2E and production build.
- Post-merge main Actions run [#45732373657](https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45732373657) — **SUCCESS** on exact merge SHA `a6b4f7e32a44885eeb2725992c197a38bd2c9e14`.
- Main Vercel status context: **SUCCESS**. No manual production deployment, Firebase Storage provisioning, billing change or production data mutation.
- No manual test command was initiated; Actions ran automatically after the owner-authorized merge.

### F-04 — staff membership identity/immutability

- Branch: `security/staff-membership-identity-immutability-2026-11-26`.
- Base: `f32814c65204a53d89a3502c09420235f3353f6b`.
- Implementation head before this documentation refresh: `61af96b8baf458612b970d509b286c45079492bf`.
- PR: [#30](https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/30), **OPEN / DRAFT**; base `f32814c65204a53d89a3502c09420235f3353f6b`.
- Firestore Rules now require `users/{uid}` path/field UID consistency on create/update; keep email, name and createdAt immutable; constrain role/status enums; and prevent users from changing their own role/status. Admins may still update another member.
- Staff service writes the document path UID on updates, allowing legacy records without a UID field to be repaired without changing their identity fields. New staff name/email lengths are aligned with Rules.
- Emulator regression cases cover mismatched path UID on create/update, immutable email/name/createdAt, self-demotion/deactivation denial, allowed status changes, and repair of a legacy membership without UID. No manual tests were run per owner direction.
- Automatic PR Actions run [#45733162211](https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45733162211): **SUCCESS** on code head `61af96b8baf458612b970d509b286c45079492bf`.
- Vercel Preview status on that code head: **SUCCESS** ([Preview](https://vercel.com/vu-nhim/tiem-hoa-rovii/AgS6Nec3kdsrcoNYMuSD25st5s1V)). No PR reviews or inline review comments were present at last check.
- This documentation-only follow-up will create a new PR head; its automatic Actions/Preview state must be checked separately. PR remains Draft until that exact head is verified.
- No production data, Firebase project configuration, billing or deployment changes.

## Security backlog

| Finding | State | Notes |
|---|---|---|
| F-01 — customer aggregate integrity | OPEN / PARTIAL MITIGATION ONLY | Scalar aggregates remain client-maintained under Spark; do not claim authoritative protection from a malicious active staff client. |
| F-02 — Storage authorization mismatch | RESOLVED | PR #22 merged; Storage writes require active admin, public reads preserved; emulator regression coverage exists. |
| F-03 — product image Data URL size / payload bounds | RESOLVED (PR #29) | 150,000-character Data URL cap, five-image/900,000-character worst-case payload, HTTPS URL bounds and legacy-safe unrelated edits; PR and post-merge Actions PASS. |
| F-04 — membership identity/immutable fields | IN PROGRESS (PR #30, Draft) | UID/path match, immutable email/name/createdAt, role/status enums, no self role/status changes and legacy UID repair. Code-head Actions and Preview passed; documentation follow-up checks pending. |
| F-05 — stale security-audit narrative | OPEN | Align historical documentation with the actual Spark client-transaction architecture. |

## Product test coverage gap

Current E2E coverage is concentrated on authentication and order flows. Add focused browser scenarios for:
- Product create/edit, price and active/inactive behavior.
- Customer create/edit/search/profile/history.
- Staff management and permission boundaries.
- Store settings read/update.
- Responsive smoke coverage for critical daily workflows.

Keep broader product/customer/settings E2E expansion as a separate scope after F-04 and F-05; do not mix it into the current security PR.

## Next actions — in order

1. Verify the new PR #30 head after this documentation refresh; keep it Draft until latest-head Actions and Preview are confirmed.
2. Complete review of F-04 and merge only when latest-head checks and review are satisfactory.
3. Close F-05 by aligning the historical Firebase security-audit narrative with the actual Spark client-transaction architecture and accepted trust boundary.
4. Keep one active code PR at a time. Do not manually run tests unless the owner asks; observe automatically triggered Actions and report exact results.
5. Add focused product/staff browser coverage only as a separate later UX/E2E scope.

## Delivery and safety rules

- Use the GitHub connector for this repository workflow. Do not switch to ChatGPT Work unless the owner explicitly requests it.
- Do not create overlapping PRs or multiple speculative commits. One active code PR at a time.
- Make commits task-sized, not file-sized: group all tightly coupled files for one complete functional change into a single commit. Split only at independent milestones; never create one commit per file.
- Do not push while the previous exact-head Actions run is still running.
- Do not merge failed, pending, stale or inadequately reviewed changes.
- Preserve Firebase Spark; no paid Firebase service or billing changes.
- Do not manually create/promote a production deployment. An owner-authorized merge may trigger the repository's configured automatic Vercel deployment; never manually promote/alias it without approval. No production customer/order access or mutation, destructive migration, Firebase project configuration change or billing change without explicit approval.
- Keep reports clear about what is merged into main versus what remains on a branch/PR.
- Update this file after every meaningful milestone, including exact SHA, PR/Actions URLs, PASS/FAIL/SKIPPED states, review/Preview state, risks and next action.
- Add reusable failures and corrections to [lessons.md](lessons.md). Change [GOAL.md](GOAL.md) only when product objectives or priorities materially change.

## Previous handoff documents

The repository also contains older `docs/automation/CRM_HOA_ROVII_CURRENT_STATE.md` and `docs/automation/CRM_HOA_ROVII_AUTONOMOUS_DELIVERY_PLAYBOOK.md`. They are historical/supporting references and may contain stale status. This root-level HANDOFF plus live GitHub state is the first source to consult.

## Delivery update — 2026-11-25 (canonical agent memory files merged)

- PR #27: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/27 — squash-merged as `46d989cc0e638ff305e3f45cfdbf0670e6a70d86`.
- Added root-level `GOAL.md`, `lessons.md` and `HANDOFF.md`; updated `AGENTS.md` to require every agent to read all three before work and maintain them after meaningful milestones.
- Verified all four files exist on main at merge commit `46d989cc0e638ff305e3f45cfdbf0670e6a70d86`.
- Diff was documentation/instructions only: four Markdown files, no application code, Firebase Rules, configuration or tests changed.
- Actions did not run for the docs-only PR; no CI PASS is claimed. Vercel Preview was pending but is not a required gate for this docs-only change.
- The new HANDOFF records PR #26 as open Draft with Emulator failure on exact head `ba3c4770ba168b5049b9f52ee30031f8ea5101e4`; PR #25 is closed unmerged. These remain separate from the merged documentation change.
- No production data, deployment, billing, Firebase configuration or migration changed.
