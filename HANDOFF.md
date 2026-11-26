# CURRENT HANDOFF — updated 2026-11-26 (Spark-first operating decision)

- Repository: `hoaihoai48/CRM-Hoa-ROVII`; default branch: `main`.
- Live `main`: `cf42153c4dd3af62fb6cc46b7f9f0ca0521c5144` (includes PR #36).
- Main includes the order/customer identity fix from [PR #35](https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/35), squash merge `550c9c487688a7d7f797a2d040d93fc71c4efa12`.
- PR #33 ([Admin catalog and staff workflows](https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/33)) is **MERGED**. It adds Playwright scenarios for product create/edit/deactivation, customer create/search/profile update, staff membership/provisioning, store settings and staff permission boundaries. The secondary Firebase Auth instance now connects to the configured Auth Emulator.
- PR #34 ([Spark-first handoff and audit alignment](https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/34)) is **MERGED**; it records the Spark-only decision in `HANDOFF.md`, `lessons.md`, and the current Firebase security audit.
- PR #35 fixes customer identity mismatch during order creation: changing the selected customer's phone clears the old selection/profile, and `createOrder()` validates the selected record's normalized phone before any write. Its E2E regression case is committed but was not run.
- PR #36 ([avoid duplicate product catalog reads](https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/36)) is **MERGED** as `cf42153c4dd3af62fb6cc46b7f9f0ca0521c5144`: the products page now performs one collection read on mount and ignores stale async responses after retry/unmount. No open PRs remain.
- F-01 customer aggregate integrity is **OPEN / ACCEPTED RESIDUAL RISK** under the approved internal-team + Firebase Spark model. Customer scalar aggregates remain client-maintained; Firestore Rules cannot independently prove all client-computed cross-document arithmetic or product-price totals. Canonical `orders/{orderId}` documents remain the evidence for reconciliation. Do not claim authoritative financial integrity.
- F-02 Storage authorization: **RESOLVED** (PR #22).
- F-03 product image payload bounds: **RESOLVED** (PR #29).
- F-04 staff membership identity/immutability: **RESOLVED** (PR #30).
- F-05 historical audit drift: **DOCUMENTATION-CORRECTED** (PR #31 plus historical-audit notices).
- Order print view is already implemented on `main`; do not port the stale feature branch.
- PR #33 and PR #35 E2E coverage is committed, but tests were not manually run for those deliveries. PR #36 is a focused loading-path fix; no tests were run per owner direction. Do not describe unrun scenarios as executed or passing.

## Approved architecture and delivery direction

- Keep Firebase on **Spark**. Do not link billing, move to Blaze, introduce Cloud Functions, or add paid infrastructure for this internal CRM.
- Continue using the existing client-side Firestore transactions for routine order/customer workflows. Treat customer scalar aggregates as display/cache summaries, not an independently trusted financial ledger.
- Use canonical order documents for order history and as the source from which customer summaries can be reconciled if an operational discrepancy is reported.
- Do not add a superficial Firestore Rules restriction for F-01: it could break legitimate order create/edit/status/cancel transactions without solving every arithmetic trust issue.
- Prioritize practical reliability in daily operations. Fix concrete defects reported during actual use; avoid speculative architecture work.
- Owner direction: do not manually run test suites, rerun CI, or wait for test reports unless explicitly requested. Be honest about what was and was not executed.
- Use the GitHub connector for this repository. Keep related changes in cohesive commits, not one commit per file. Update this handoff and `lessons.md` at meaningful milestones.

## Safety boundaries

Preserve Firebase Spark. Do not access or mutate production customer/order records, perform destructive migrations, change Firebase project configuration/billing, or manually deploy/promote production without explicit approval. An owner-authorized merge may trigger the repository's configured automatic deployment; do not manually promote it.

- Product catalog page duplicate-read defect fixed in [PR #36](https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/36) once merged: initial mount previously issued two identical full product collection reads; it now shares one request path for initial load/retry and ignores stale in-flight responses after unmount or a newer retry.

- Customer and order detail pages now invalidate route-bound Firestore reads on navigation/retry, preventing a slower response for the previous record from replacing the currently opened record (PR #37).

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
