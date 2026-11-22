# CRM-Hoa-ROVII — Current Delivery Handoff

**Last updated:** 2026-11-22 07:25 Asia/Ho_Chi_Minh  
**Repository:** https://github.com/hoaihoai48/CRM-Hoa-ROVII  
**Default branch:** `main`  
**Current main SHA:** `c63f2da0d2250bf8957877ce33e17142a8d6f8d3`

This is the restart point for a new ChatGPT conversation. Read it together with `docs/automation/CRM_HOA_ROVII_AUTONOMOUS_DELIVERY_PLAYBOOK.md` and inspect live GitHub state before acting.

## Owner delegation and guardrails

- Owner delegated routine engineering decisions: inspect, implement, test, update PRs, merge normal code/docs PRs when all required checks pass and changes are safe.
- Ask the owner only for decisions that genuinely require business clarification, credentials, paid-service/billing changes, production data repair/migration, production deployment/release, or other irreversible/high-risk actions.
- Preserve Firebase Spark compatibility; do not introduce paid services without approval.
- Never access or mutate production customer/order data for tests. Use Firebase Auth/Firestore Emulators and synthetic identities.
- Do not deploy production, change billing, or perform destructive migrations without explicit approval.
- Work on feature branches, group related files into cohesive commits, and keep this handoff/playbook updated during every meaningful delivery session.
- Never report tests as PASS without inspecting completed workflow evidence.

## Completed delivery

### S0 — Playwright/CI foundation: MERGED

- PR #8: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/8
- Squash merge commit: `c63f2da0d2250bf8957877ce33e17142a8d6f8d3`
- Pre-merge CI: https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/44904053612
- GitHub Actions and Vercel Preview checks passed.
- Playwright Chromium: 4/4 auth/access tests passed.
- CI includes install, dependency audit, Functions syntax, MCP smoke tests, ESLint, TypeScript, Firebase Emulator tests, Playwright and production build.
- A post-merge `main` workflow was triggered: https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/44966225503. At handoff it was IN PROGRESS; inspect before treating post-merge main as green.

### S1 — Order workflow integrity: implementation CI PASS, retargeted CI pending

- PR #9: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/9
- Branch: `feat/order-workflow-integrity`
- Head: `cadb7ae60080a6bf269bd3023f32b90c4613cf45`
- Original CI on this exact head: https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/44908094922
- Original CI passed: lint, TypeScript, Firebase Emulator integration/invariants, Playwright Chromium 5/5 and production build.
- PR #9 has been retargeted to `main` after PR #8 merged.
- The branch currently has the original PR #8 commit as ancestry while `main` contains a squash commit, so GitHub reports the branch and main as diverged (5 commits ahead, 1 behind) and mergeable=false. Do not merge until the branch is synchronized/rebased onto current main and a fresh PR-head CI run passes.
- Preview interactive walkthrough remains NOT RUN until Preview Firebase configuration and safe test credentials are verified.

### Superseded PR

- PR #6 (older Firestore status transition implementation) was closed without merge: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/6
- PR #9 is the canonical, stronger implementation. Do not reopen or merge PR #6.

## Open PR inventory at handoff

| PR | Scope | State | Next action |
|---|---|---|---|
| #9 | S1 order workflow | Open, draft | Synchronize branch with main, rerun CI, inspect Preview, then merge if green |
| #5 | Spark compatibility + MCP structured reads | Open, draft, stale | Audit diff and current main for duplicate/already-landed changes; close if obsolete, otherwise refresh CI and assess separately |

## Important S1 implementation details

- New orders must start in `new` with one valid matching history entry.
- Status transitions: `new → confirmed/cancelled`, `confirmed → delivering/cancelled`, `delivering → completed`.
- History is append-only: exactly one valid new entry, exact prior sequence retained.
- Same-status order content edits are allowed only in `new` and `confirmed`.
- Status transitions can modify only status/history fields.
- Delivering, completed and cancelled orders cannot be edited.
- `getAfter()` requires order and customer per-order projection to match atomically in the same transaction/batch.
- Order service recalculates from current Firestore product prices and recomputes customer aggregates transactionally.
- Full customer aggregate math is not recomputed in Rules; service transactions and Emulator tests cover it.

## Known follow-up risks / S2 audit targets

1. `customer.orderSummaries` grows as an embedded array; monitor Firestore 1 MiB document limit and plan a scalable projection before volume becomes large.
2. Rules enforce a matching per-order customer projection, not the full totalOrders/totalSpent math across an unbounded order set.
3. New customer creation currently precedes the order transaction; failed order creation can leave an empty customer. Review during S2.
4. Audit recipient/delivery information, delivery scheduling, order code, staff assignment and printable order view before changing data contracts.
5. Validate all customer/order changes against Spark constraints and avoid Cloud Functions or paid Firebase services unless separately approved.

## Next action

1. Check completion of main workflow #44966225503.
2. Synchronize `feat/order-workflow-integrity` with squash-merged `main` (the current divergence is caused by PR #8 squash history; preserve the S1 tree).
3. Run fresh PR CI and verify Vercel Preview.
4. Merge PR #9 only after fresh checks pass and no unresolved blocking review feedback remains.
5. Start S2 with a read-only audit of existing order-entry and fulfilment flows.
6. Audit PR #5 independently; close it if its value is already present or no longer needed. Do not merge it on stale October evidence.

## Session log — 2026-11-22

- Merged PR #8 by squash after confirming its CI workflow and Vercel check succeeded.
- Closed PR #6 without merge because PR #9 supersedes it.
- Retargeted PR #9 from PR #8's branch to `main`.
- Detected expected Git-history divergence after squash merge: PR #9's source branch still contains the pre-squash PR #8 commit. This must be synchronized before merge.
- Updated PR #9 description with current scope, CI evidence, merge dependency and safety gates.
- No production deployment, production data access, billing change or migration was performed.

## New-chat instruction

Read this handoff and the playbook, then fetch live PR/branch/Actions state. Do not assume the pending main workflow or PR #9 retargeted CI passed. Continue with branch synchronization and S1 verification before starting S2.
