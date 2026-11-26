# HANDOFF — CRM Hoa ROVII

**Last verified:** 2026-11-26 07:40 (Asia/Ho_Chi_Minh)  
**Repository:** `hoaihoai48/CRM-Hoa-ROVII`  
**Default branch:** `main`  
**Main SHA:** `b93d336137be1873623ff461790b18c3231ce8ed`  
**Canonical project memory:** [GOAL.md](GOAL.md) · [lessons.md](lessons.md) · [HANDOFF.md](HANDOFF.md)

> Re-fetch live GitHub state before acting. This file is a handoff, not a substitute for checking refs, PRs, Actions, reviews and Preview status.

## Owner operating direction

- Prioritize completing implementation. Do not proactively initiate manual test suites or repeated CI runs.
- GitHub Actions may run automatically after pushes; report only observed results and never claim an unrun check passed.
- Continue to preserve production, billing and Firebase Spark safety boundaries.

## Executive status

**In progress — PR #26 has passing automated checks but is not ready to merge until review and current Preview are confirmed.**

The CRM's operational areas are Dashboard, Products, Customers, Orders, Staff and Store Settings. Active delivery work simplifies customer order history around canonical order documents.

## Repository and PR state

### Main

- Live `main`: `b93d336137be1873623ff461790b18c3231ce8ed`.
- PR #27's project-memory foundation is merged; `AGENTS.md`, `GOAL.md`, `lessons.md` and `HANDOFF.md` are present on main.
- PR #25 is closed without merge and superseded by PR #26.

### PR #26 — canonical customer order history

- URL: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/26
- Branch: `refactor/simple-customer-order-source-2026-11-23`
- Exact current head: `df3fdb9a4d54a2b2d41d966ad72e1a2f2090eb13`
- State: open, Draft, mergeable; branch is synchronized with main (0 commits behind).
- Goal: use `orders/{orderId}` as the only canonical customer history source; remove runtime dependence on embedded `customers.orderSummaries` and its bounded projection/refill/fingerprint protocol; retain the three scalar UI summaries.
- Legacy `orderSummaries` values are tolerated and left untouched. No production migration is included.
- This is a complexity reduction, **not** a fix for customer scalar aggregate tampering.

### Latest automatic GitHub Actions result

- Run: https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/45729703091
- Result: **completed / SUCCESS**.
- The run executed against synthetic PR merge commit `f2cecde899028c68ea9aa98860254bf0d04d1610`; its tree SHA `bf3d97e5b954fa3875befa5f41510eab7871d050` is identical to the current branch head tree at `df3fdb9a4d54a2b2d41d966ad72e1a2f2090eb13`.
- Lint: **PASS**.
- TypeScript: **PASS**.
- Firebase Auth/Firestore/Storage Emulator integration: **PASS**.
- Playwright E2E against Emulators: **PASS**.
- Production build: **PASS**.
- This was an automatically triggered workflow after the branch commit; no manual test command or manual rerun was initiated.
- The earlier failed run #45647601442 exposed a second stale assertion requiring customer order projections. Commit `d0ca98f145b0250534a958a18c685b435b490451` removed those obsolete assertions; run #45729703091 then passed all stages.

### Preview and review

- Current Vercel Preview for the merge-synced head was reported as **Building** at 2026-11-26 00:37 UTC; confirm latest deployment status before merging.
- Previous Preview on the immediately preceding tree was Ready, but does not replace checking the current deployment.
- PR review submissions: none. Inline review threads: none.
- Keep PR #26 Draft until the current Preview is Ready and an adequate code/security review is recorded. Do not merge solely because Actions passed.

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

1. Confirm the Vercel Preview for head `df3fdb9a4d54a2b2d41d966ad72e1a2f2090eb13` is Ready.
2. Complete a fresh code/security review on the synchronized PR head; resolve any findings and keep F-01's Spark limitation explicit.
3. Do not run manual tests unless the owner asks. The latest automatic PR Actions run already passed on a tree identical to the current head.
4. Only after Preview and review are clear, mark PR #26 ready and merge if all repository merge requirements are satisfied.
5. After PR #26 is resolved, handle F-03, F-04 and F-05 in separate small scopes.

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
