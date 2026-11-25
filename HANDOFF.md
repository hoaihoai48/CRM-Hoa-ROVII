# HANDOFF — CRM Hoa ROVII

**Last verified:** 2026-11-25 21:20 (Asia/Ho_Chi_Minh)  
**Repository:** `hoaihoai48/CRM-Hoa-ROVII`  
**Default branch:** `main`  
**Main SHA at verification:** `2bf61618b8424e576115e6647cbef21aad635493`  
**Canonical project memory:** [GOAL.md](GOAL.md) · [lessons.md](lessons.md) · [HANDOFF.md](HANDOFF.md)

> This is the canonical live handoff. Re-fetch GitHub before acting: every SHA, PR and CI state below can change. Do not assume this file is current just because it exists.

## Current owner operating direction — 2026-11-25

- Owner has asked to prioritize completing implementation and not proactively run Playwright or other test suites; report runtime defects when the owner encounters them during use.
- Do not spend time repeatedly running CI/tests unless the owner asks. GitHub Actions may still start automatically on code pushes according to workflow triggers; do not describe an unexecuted test as passed.
- Continue to preserve production/billing safety boundaries. An untested change must not be described as verified; keep merge/release risk explicit.

## Executive status

<badge color="warning">In progress — not ready to merge</badge>

The CRM has the main operational areas in place: Dashboard, Products, Customers, Orders, Staff and Store Settings. Current delivery work is focused on simplifying customer order history around canonical order documents while preserving the known Firebase Spark trust boundary.

## Repository and PR state

### Main

- Main currently points to `46d989cc0e638ff305e3f45cfdbf0670e6a70d86`.
- PR #27 merged this delivery-memory foundation as `46d989cc0e638ff305e3f45cfdbf0670e6a70d86`; the three canonical files and mandatory `AGENTS.md` instructions are now present on main.
- The changes described below are not merged to main.
- PR #25 is closed without merge; it was superseded by the simpler direction in PR #26.

### PR #26 — canonical customer order history

- URL: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/26
- Branch: `refactor/simple-customer-order-source-2026-11-23`
- Exact head at last verification: `ba3c4770ba168b5049b9f52ee30031f8ea5101e4`
- State: open, Draft, mergeable reported true.
- Goal: use `orders/{orderId}` as the canonical customer history source; remove runtime dependence on embedded `customers.orderSummaries` and its bounded projection/refill/fingerprint protocol; retain scalar UI summaries.
- Legacy `orderSummaries` data is tolerated and left untouched. No production migration is included.
- This is a complexity reduction, **not** a fix for customer scalar aggregate tampering.

### Latest verified CI on PR #26

- Actions run: https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45539044812
- Exact head: `ba3c4770ba168b5049b9f52ee30031f8ea5101e4`
- Lint: **PASS**.
- TypeScript: **PASS**. The prior TS2532 issue at `scripts/test-emulator-integrity.ts:1014` was fixed by narrowing one snapshot value before reading its optional data.
- Firebase Emulator integration: **FAIL** at `scripts/test-emulator-integrity.ts:437`.
- Failure: test expects an active member's valid-shaped customer create containing scalar aggregates to be denied. Current Rules intentionally permit an active internal member to write a valid customer record; the assertion contradicts the explicitly documented Spark/trusted-staff limitation at test lines 422–426. This is a stale test contract, not proof that order creation/status/history failed.
- Playwright E2E: **SKIPPED** because the Emulator stage failed.
- Production build: **SKIPPED** because the Emulator stage failed.
- Vercel Preview status: success on this exact head (does not replace Actions gates).
- Review threads: none were returned on PR #26 at last check; a complete code/security review has not been recorded.

## Security backlog

| Finding | State | Notes |
|---|---|---|
| F-01 — customer aggregate integrity | OPEN / PARTIAL MITIGATION ONLY | Scalar aggregates remain client-maintained under Spark; do not claim authoritative protection from a malicious active staff client. |
| F-02 — Storage authorization mismatch | RESOLVED | PR #22 merged; Storage writes require active admin, public reads preserved; emulator regression coverage exists. |
| F-03 — product image Data URL size / payload bounds | OPEN | Bound actual encoded bytes and aggregate payload; do not rely only on a UI limit. |
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

1. Re-fetch live main, PR #26 head, all recent workflow runs, review threads and Vercel status. Stop if the head advanced.
2. Inspect the failing assertion at `scripts/test-emulator-integrity.ts:428–437` and the corresponding Rules contract.
3. Rewrite the test to assert what the current architecture actually guarantees; do not weaken Firestore Rules or pretend scalar arithmetic is protected. Keep the trusted-internal-staff limitation explicit.
4. Run the narrow test against the isolated `demo-crm-hoa-rovii` Auth/Firestore Emulator before pushing. If local checkout/Emulator access is unavailable, record BLOCKED and do not push a speculative commit.
5. Only after local verification, push one cohesive fix and wait for the exact-head Actions run to finish.
6. Require Lint, TypeScript, Emulator, Playwright and production build to pass; complete code/security review; verify Preview as applicable. Keep PR #26 Draft until all gates pass.
7. After PR #26 is safely resolved, address F-03, F-04 and F-05 in separate small scopes, and expand missing product/customer/staff/settings E2E coverage.

## Delivery and safety rules

- Use the GitHub connector for this repository workflow. Do not switch to ChatGPT Work unless the owner explicitly requests it.
- Do not create overlapping PRs or multiple speculative commits. One active code PR at a time.
- Do not push while the previous exact-head Actions run is still running.
- Do not merge failed, pending, stale or inadequately reviewed changes.
- Preserve Firebase Spark; no paid Firebase service or billing changes.
- No production deployment, production customer/order access or mutation, destructive migration, Firebase project configuration change or billing change without explicit approval.
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
