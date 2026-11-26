# HANDOFF — CRM Hoa ROVII

**Last verified:** 2026-11-26 07:50 (Asia/Ho_Chi_Minh)  
**Repository:** `hoaihoai48/CRM-Hoa-ROVII`  
**Default branch:** `main`  
**Main SHA:** `46197e0d31207c64509a9ac4ebebfb895664f5aa`  
**Canonical project memory:** [GOAL.md](GOAL.md) · [lessons.md](lessons.md) · [HANDOFF.md](HANDOFF.md)

> Re-fetch live GitHub state before acting. This handoff records verified state, not a substitute for checking current refs, PRs, Actions and deployment contexts.

## Owner operating direction

- Prioritize completing implementation. Do not proactively initiate manual test suites or repeated CI runs.
- GitHub Actions may run automatically after pushes; report only observed results and never claim an unrun check passed.
- Preserve Firebase Spark and production-data safety. No production data access/mutation, destructive migration, Firebase configuration or billing changes without approval.

## Executive status

**PR #26 merged successfully.** Customer history now uses canonical order documents; the Spark scalar-aggregate limitation remains explicitly open. Next implementation priority is F-03 product image payload bounds.

## Repository and delivery state

### Main

- Live `main`: `867946dc8f1fe0f3fc70bc6b8547173396090e10`.
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

### F-03 — product image payload bounds

- Branch: `security/product-image-payload-bounds-2026-11-26`.
- Main base: `46197e0d31207c64509a9ac4ebebfb895664f5aa`.
- Current branch head before this handoff update: `d86528c4eaf23ed5a8772cc863a4421aeea7ff18`.
- PR: not opened yet.
- Changes: service validation for at most five images, Data URLs up to 150,000 characters and HTTPS URLs up to 2,048 characters; progressive browser compression for the zero-cost Firestore fallback; Firestore Rules validate new/changed image payloads and bound note/category fields.
- Backward compatibility: legacy oversized image references remain readable and unrelated product edits do not rewrite or validate unchanged media fields. Replacing legacy media requires replacing the complete image payload with bounded references.
- Emulator regression cases were added for allowed small Data URL/HTTPS, oversized Data URL create/update, over-five images, HTTP URLs, oversized remote URLs, note bounds and legacy-safe unrelated edits. Execution status: **NOT RUN manually** per owner direction; wait for automatic PR Actions after opening the PR.
- No production data, Firebase project configuration, Storage provisioning, billing or deployment changes.

## Security backlog

| Finding | State | Notes |
|---|---|---|
| F-01 — customer aggregate integrity | OPEN / PARTIAL MITIGATION ONLY | Scalar aggregates remain client-maintained under Spark; do not claim authoritative protection from a malicious active staff client. |
| F-02 — Storage authorization mismatch | RESOLVED | PR #22 merged; Storage writes require active admin, public reads preserved; emulator regression coverage exists. |
| F-03 — product image Data URL size / payload bounds | IN PROGRESS (branch only) | Enforce 150,000-character Data URL limit, five-image/900,000-character worst-case payload, HTTPS URL bounds and legacy-safe unrelated edits. |
| F-04 — membership identity/immutable fields | OPEN | Review UID/path consistency, createdAt immutability and role/status mutable fields. |
| F-05 — stale security-audit narrative | OPEN | Align historical documentation with the actual Spark client-transaction architecture. |

## Product test coverage gap

Current E2E coverage is concentrated on authentication and order flows. Add focused browser scenarios for:
- Product create/edit, price and active/inactive behavior.
- Customer create/edit/search/profile/history.
- Staff management and permission boundaries.
- Store settings read/update.
- Responsive smoke coverage for critical daily workflows.

Do not start these unrelated suites while PR #26 is blocked on its current required Emulator gate.

## Next actions — in order

1. Complete F-03 product image Data URL and total payload bounds in a focused branch/PR.
2. Then address F-04 membership UID/path consistency, immutable identity fields and role/status update constraints.
3. Update stale F-05 security-audit narrative to match the actual Spark client-transaction architecture and accepted trust boundary.
4. Keep one active code PR at a time. Do not manually run tests unless the owner asks; observe automatically triggered Actions and report exact results.
5. Add focused product/staff browser coverage only as a separate later UX/E2E scope.

## Delivery and safety rules

- Use the GitHub connector for this repository workflow. Do not switch to ChatGPT Work unless the owner explicitly requests it.
- Do not create overlapping PRs or multiple speculative commits. One active code PR at a time.
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
