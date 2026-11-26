# HANDOFF — CRM Hoa ROVII

**Last verified:** 2026-11-25 22:10 (Asia/Ho_Chi_Minh)  
**Repository:** `hoaihoai48/CRM-Hoa-ROVII`  
**Default branch:** `main`  
**Main SHA at verification:** `cf398d1c73cd5b641084db1a19612f4b5147de2e`  
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

- Main currently points to `cf398d1c73cd5b641084db1a19612f4b5147de2e` (two docs-only commits after PR #28).
- PR #27 merged this delivery-memory foundation as `46d989cc0e638ff305e3f45cfdbf0670e6a70d86`; the three canonical files and mandatory `AGENTS.md` instructions are now present on main.
- The changes described below are not merged to main.
- PR #25 is closed without merge; it was superseded by the simpler direction in PR #26.

### PR #26 — canonical customer order history

- URL: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/26
- Branch: `refactor/simple-customer-order-source-2026-11-23`
- Exact head at last verification: `498733d00f99858f853e3f76819ffff9a7d25f2a`
- State: open, Draft; latest metadata reports mergeable true.
- Goal: use `orders/{orderId}` as the canonical customer history source; remove runtime dependence on embedded `customers.orderSummaries` and its bounded projection/refill/fingerprint protocol; retain scalar UI summaries.
- Legacy `orderSummaries` data is tolerated and left untouched. No production migration is included.
- This is a complexity reduction, **not** a fix for customer scalar aggregate tampering.

### Latest verified CI on PR #26

- Actions run: https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45539044812
- Exact head: `ba3c4770ba168b5049b9f52ee30031f8ea5101e4`
- Lint: **PASS**.
- TypeScript: **PASS**. The prior TS2532 issue at `scripts/test-emulator-integrity.ts:1014` was fixed by narrowing one snapshot value before reading its optional data.
- Firebase Emulator integration on the prior head: **FAIL** at `scripts/test-emulator-integrity.ts:437`; that head has since been superseded.
- Corrective commit `498733d00f99858f853e3f76819ffff9a7d25f2a` changes the stale assertion to explicitly document that valid-shaped customer scalar aggregates are client-maintained under the Spark trusted-staff model. This corrects the test contract; it has **NOT BEEN RUN**.
- Playwright E2E on the prior head: **SKIPPED** because the Emulator stage failed; new head: **NOT RUN / not yet reported**.
- Production build on the prior head: **SKIPPED** because the Emulator stage failed; new head: **NOT RUN / not yet reported**.
- Vercel Preview: a new deployment was reported as Building on 2026-11-25 22:39 local time; not yet confirmed Ready.
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

1. Owner has explicitly requested implementation-first work and no proactive test runs. Do not initiate manual tests/CI; distinguish automatic workflow results from tests deliberately run.
2. Corrected the stale Spark trust-boundary assertion in `scripts/test-emulator-integrity.ts`; current head is `498733d00f99858f853e3f76819ffff9a7d25f2a`.
3. Keep PR #26 Draft until the owner uses the app and any runtime defects are addressed, or explicitly asks to resume verification/review. Do not merge an unverified code change merely to close the PR.
4. After PR #26 is resolved, address F-03, F-04 and F-05 in separate small scopes, and improve daily product/customer/staff/settings workflows.

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
