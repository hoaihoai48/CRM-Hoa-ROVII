# CRM-Hoa-ROVII — Current Delivery Handoff

**Last updated:** 2026-11-21 20:15 Asia/Ho_Chi_Minh  
**Repository:** https://github.com/hoaihoai48/CRM-Hoa-ROVII  
**Default branch:** `main`  
**Current main SHA:** `bdf7d8ecb698b4e7bb44990a67cd74dea99568d9`

This file is the restart point for a new ChatGPT conversation. Read it together with `docs/automation/CRM_HOA_ROVII_AUTONOMOUS_DELIVERY_PLAYBOOK.md` before making changes.

## Project guardrails

- Internal-first flower-shop order management / mini CRM.
- Stack: Next.js App Router + TypeScript, Firebase Auth, Firestore, Firebase Spark, Vercel, GitHub Actions, local MCP integration.
- Preserve Spark compatibility; do not assume Blaze features or introduce paid services without approval.
- Work on feature branches, group related files into meaningful commits, and open focused PRs.
- Use GitHub Actions, Firebase Emulators, Playwright and Vercel Preview for verification. Do not ask the owner to run local tests for routine work.
- Never touch production data, deploy production, change billing, perform destructive migrations or merge PRs without explicit owner approval.
- Never claim a test passed without a completed run and inspectable evidence.

## Completed steps

### S0 — Baseline & delivery infrastructure: PASS

- PR #8: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/8
- Branch: `feat/ci-playwright-emulator-e2e`
- Current PR head: `dc051ee44ee5428ae423597327796a977c033f82`
- Verified CI run: https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/44903815116
- Playwright 4/4: login form, anonymous dashboard guard, invalid credentials, active synthetic member login.
- CI includes dependency audit, Functions lint, MCP smoke tests, ESLint, TypeScript, Emulator tests, Chromium E2E, production build and report artifacts.
- PR #8 is open and not merged.

### S1 — Order workflow integrity: PASS

- PR #9: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/9
- Branch: `feat/order-workflow-integrity`
- Current branch head: `6c603747f0de25dd676bcefaa29eebc490f1f572`
- Verified CI run: https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/44907652688
- All CI jobs passed: install, Functions syntax, dependency audit, MCP smoke tests, ESLint, TypeScript, Firebase Emulator integration, Chromium install, browser E2E, production build, artifact upload.
- Playwright **5/5 PASS** (4 auth/access tests + one complete order lifecycle test).
- Emulator suite: **ALL INTEGRATION & INVARIANT TESTS PASSED 100%**. It verifies initial order state, state machine, history append/immutability/order, projection atomicity, aggregates, aggregate repair, concurrency, staff rules and order edit recomputation.
- Vercel Preview check: PASS — https://vercel.com/vu-nhim/tiem-hoa-rovii/E9N8oW7FWNUF9DrVkwz6nZwKsxVP
- PR #9 remains draft/open and not merged. It is based on the PR #8 S0 branch history; it includes S0 ancestry while PR #8 remains unmerged. After PR #8 is merged, PR #9's diff against main will reduce to S1.

## Current open PRs / conflicts to avoid

| PR | Purpose | State | Handling |
|---|---|---|---|
| #9 | S1 order workflow integrity | Open, draft, checks pass | Ready to mark non-draft; do not merge without owner approval |
| #8 | S0 Playwright/CI foundation | Open, ready for review, checks pass | Merge before or together with dependent S1 |
| #6 | Earlier Firestore order status transition draft | Open, draft | Overlaps S1; PR #9 supersedes with stronger rules. Do not merge both |
| #5 | Spark compatibility + MCP structured reads draft | Open, draft | Separate scope; inspect before S2 if relevant |

## Important implementation details

- Firestore Rules require new orders to start in `new` with one valid matching history entry.
- Status transitions: `new → confirmed/cancelled`, `confirmed → delivering/cancelled`, `delivering → completed`.
- History is append-only: exactly one valid new entry, exact prior sequence retained.
- Same-status order content edits are allowed only in `new` and `confirmed`.
- Status transitions can modify only status/history fields.
- Delivering, completed and cancelled orders cannot be edited.
- `getAfter()` requires order and customer per-order projection to match atomically in the same transaction/batch.
- Order service recalculates from current Firestore product prices and recomputes customer aggregates transactionally.
- Full customer aggregate math is not recomputed in Rules; service transactions and Emulator tests cover it.

## Known follow-up risks

1. `customer.orderSummaries` grows as an embedded array; monitor Firestore 1 MiB document limit and plan a scalable projection before volume becomes large.
2. Rules enforce a matching per-order customer projection, not the full totalOrders/totalSpent math across an unbounded order set.
3. New customer creation currently precedes the order transaction; failed order creation can leave an empty customer. Review during S2.
4. S2 scope from playbook: recipient/delivery information, delivery scheduling, order code, staff assignment and printable order view. Inspect existing implementation and verify business requirements before changing data contracts.
5. PR #6 overlaps status-transition logic. Do not merge #6 and #9 together.

## Next permitted step

**S2 — Sales workflow completion.** Start with a read-only audit of the current order-entry, recipient/delivery, schedule, staff assignment and printable-view code. Then implement only confirmed gaps with Emulator + Playwright tests. Keep PR #9 open until owner approval; no merge or production deployment.

## Automation

- Automation: `ROVII Delivery Cycle`
- ID: `6b0189e334488191a17414a05dd26853`
- Enabled, hourly, timezone `Asia/Ho_Chi_Minh`; next run at 20:12:04 on 2026-11-21.
- Prompt instructs it to re-read main playbook/open PRs/branches/CI each run, avoid overlapping work, test before PR updates, and never merge/deploy production.
- Environment selection is inherited and no explicit environment is attached; rely on GitHub Actions/Emulator/Preview evidence, not assumptions about a persistent Mac/browser session.

## New-chat instruction

Read this file and the playbook first. Continue from S2 only after checking current GitHub state, especially whether PR #8 and PR #9 have been merged or changed. Do not repeat S0/S1 work or duplicate PR #6.
