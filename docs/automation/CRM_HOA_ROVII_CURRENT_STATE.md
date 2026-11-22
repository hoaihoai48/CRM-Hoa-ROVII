# CRM-Hoa-ROVII — Current Delivery Handoff

**Last updated:** 2026-11-22 07:27 Asia/Ho_Chi_Minh  
**Repository:** https://github.com/hoaihoai48/CRM-Hoa-ROVII  
**Default branch:** `main`  
**Current main SHA:** read the live `main` ref before resuming (this handoff file is updated on every delivery session).

This is the restart point for a new ChatGPT conversation. Read it together with `docs/automation/CRM_HOA_ROVII_AUTONOMOUS_DELIVERY_PLAYBOOK.md` and inspect live GitHub state before acting.

## Owner delegation and guardrails

- Owner delegated routine engineering decisions: inspect, implement, test, update PRs, and merge normal code/docs PRs when all required checks pass and changes are safe.
- Ask the owner only for decisions that genuinely require business clarification, credentials, paid-service/billing changes, production data repair/migration, production deployment/release, or other irreversible/high-risk actions.
- Preserve Firebase Spark compatibility; do not introduce paid services without approval.
- Never access or mutate production customer/order data for tests. Use Firebase Auth/Firestore Emulators and synthetic identities.
- Do not deploy production, change billing, or perform destructive migrations without explicit approval.
- Work on feature branches, group related files into cohesive commits, and update this handoff/playbook during every meaningful delivery session.
- Never report tests as PASS without inspecting completed workflow evidence.

## Completed delivery

### S0 — Playwright/CI foundation: MERGED

- PR #8: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/8
- Squash merge commit: `c63f2da0d2250bf8957877ce33e17142a8d6f8d3`
- Pre-merge CI: https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/44904053612 — PASS
- Vercel check — PASS; Playwright Chromium 4/4 auth/access tests passed.
- Post-merge `main` workflow: https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/44966225503 — IN PROGRESS at this handoff. PR #9's stronger combined workflow passed.

### S1 — Order workflow integrity: MERGED

- PR #9: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/9
- Branch: `feat/order-workflow-integrity`
- Final PR head: `53781a838495ac6bcf438dc42214ae4a7faf464e`
- Squash merge commit on main: `8ea157041599ca95966a02695e7c1a25ffe3c9a7`
- Final retargeted CI: https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/44966311523 — PASS
- Checks: dependency install/audit, Functions syntax, MCP syntax/protocol/safety smoke, ESLint, TypeScript, Firebase Emulator integration/invariants, Playwright Chromium, production build and diagnostics artifact upload — all PASS.
- Vercel Preview check: PASS; no unresolved feedback.
- Emulator tests use synthetic isolated data only. No production data accessed or changed.
- Preview browser interactive walkthrough was not performed; Vercel's PR check confirms deployment feedback status, not a full human workflow walkthrough.

### Superseded PR

- PR #6 (older Firestore status-transition implementation) was closed without merge: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/6
- PR #9 is the canonical stronger implementation. Do not reopen PR #6.

## Open PR inventory

| PR | Scope | State | Next action |
|---|---|---|---|
| #10 | MCP structured tool output schemas | Open, draft | Wait for fresh GitHub Actions; inspect MCP smoke test, then mark ready and merge if all checks pass |

### Closed / superseded PRs
- PR #5 closed without merge. MCP changes extracted into focused PR #10; Firebase Storage removal intentionally excluded pending Firestore document-size safeguards.
- PR #6 closed without merge; superseded by merged PR #9.
- PR #8 merged as S0.

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

1. Verify completion of post-merge `main` workflow #44966225503.
2. Verify PR #10 current GitHub Actions run; merge only if the fresh checks pass and no blocking review feedback remains.
3. Treat Firebase Storage removal as a separate design item. Do not store unbounded image Data URLs in Firestore; add explicit size enforcement or a storage strategy before changing this area.
4. Start S2 with a read-only audit of existing order-entry and fulfilment flows: recipient/delivery details, scheduling, order code, staff assignment and printable view.
5. Keep each implementation step isolated and update this handoff after every meaningful session.

## Session log — 2026-11-22

- Squash-merged PR #8 (S0) to main: `c63f2da0d2250bf8957877ce33e17142a8d6f8d3`.
- Closed PR #6 without merge; PR #9 superseded it.
- Retargeted PR #9 to main and synchronized its branch after the S0 squash merge created Git-history divergence.
- Updated both delivery docs with the delegated merge policy, current PR/CI status and restart instructions.
- PR #9 retargeted CI passed on head `53781a838495ac6bcf438dc42214ae4a7faf464e`; marked ready and squash-merged.
- S1 squash merge commit: `8ea157041599ca95966a02695e7c1a25ffe3c9a7`.
- Closed stale PR #5 after extracting its MCP structured-output improvement into focused PR #10. Firebase Storage removal remains intentionally excluded.
- No production deployment, production data access, billing change or destructive migration was performed.

## New-chat instruction

Read this handoff and the playbook, then fetch live GitHub state. S0 and S1 are complete and merged. Verify and merge PR #10 if its fresh checks pass, then proceed to S2 read-only workflow audit. Do not repeat S0/S1 work or reopen PR #5/#6.


### Session continuation — 2026-11-22 (MCP PR cleanup)

- Audited stale PR #5. It combined MCP structured output support with unconditional Firebase Storage removal.
- Closed PR #5 without merge. Its optional Storage removal was excluded because main already defaults to Data URL when Storage is disabled, while the PR's image-size assumptions did not enforce Firestore's 1 MiB document limit.
- Extracted only the MCP structured output schemas, structuredContent response and stronger smoke test into new branch `feat/mcp-structured-tool-outputs`.
- Opened PR #10: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/10
- PR #10 changes only `mcp-server/server.mjs` and `mcp-server/smoke-test.mjs`; fresh GitHub Actions run #44966591236 is pending at handoff. Vercel check is PASS.
- No production data, deployment, billing or Storage configuration changed.
