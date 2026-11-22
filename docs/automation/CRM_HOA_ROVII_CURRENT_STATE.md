# CRM-Hoa-ROVII — Current Delivery Handoff

**Last updated:** 2026-11-22 07:35 Asia/Ho_Chi_Minh  
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

1. S0/S1 and MCP follow-up PR #10 are merged; PR #10 CI and its post-merge `main` workflow #44967174708 both PASS.
2. Continue S2 audit by inspecting order creation/edit regression tests, service transaction edges and preview print capabilities. Implementation has not started.
3. Record a backward-compatible candidate order model and test matrix before feature work; ask the owner only for business semantics (purchaser vs recipient, delivery slots, staff assignment rules and print layout).
4. Keep Firebase Storage/image-size design separate; do not store unbounded Data URLs in Firestore.
5. Preserve Spark compatibility and update this handoff after every meaningful session.

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

Read this handoff and the playbook, then fetch live GitHub state. S0/S1 and PR #10 are complete and merged. PR #10 CI run #44966591236 and post-merge main run #44967174708 both PASS. Continue S2 read-only audit; do not repeat completed work or reopen PR #5/#6.


### Session continuation — 2026-11-22 (MCP PR cleanup)

- Audited stale PR #5. It combined MCP structured output support with unconditional Firebase Storage removal.
- Closed PR #5 without merge. Its optional Storage removal was excluded because main already defaults to Data URL when Storage is disabled, while the PR's image-size assumptions did not enforce Firestore's 1 MiB document limit.
- Extracted only the MCP structured output schemas, structuredContent response and stronger smoke test into new branch `feat/mcp-structured-tool-outputs`.
- Opened PR #10: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/10
- PR #10 changes only `mcp-server/server.mjs` and `mcp-server/smoke-test.mjs`; fresh GitHub Actions run #44966591236 is pending at handoff. Vercel check is PASS.
- No production data, deployment, billing or Storage configuration changed.


### Session continuation — 2026-11-22 (PR #10 merged; S2 read-only audit)

- Verified PR #10 CI run #44966591236 completed successfully on head `2e745efc26d0e6786cdbb18999f6e822127e4e00`. All job steps passed: dependency audit/report, Functions syntax, MCP syntax and protocol/safety smoke, lint, TypeScript, Firebase Emulator integration, Chromium install, Playwright browser E2E, production build and diagnostics upload.
- Vercel Preview for PR #10 was Ready; review submissions and inline review threads were empty. Marked PR #10 ready for review and squash-merged.
- PR #10 merge commit: `6ac8304c8df47fe0c2a94dd444591a59ebb5b2da`; live `main` ref confirmed at this SHA.
- Main post-merge workflow #44967174708: PASS. All steps passed including Firebase Emulator integration, Playwright Chromium E2E, production build and diagnostics artifact upload. https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/44967174708
- Read-only S2 audit inspected order creation page, order list/detail pages, order/customer/staff services, TypeScript models and Firestore Rules.
- Current order-entry UI stores customer name/phone/address together in `customerSnapshot`; it does not distinguish purchaser from recipient. Delivery is a single `deliveryDate` datetime-local field, and note combines greeting-card text with instructions. No dedicated recipient phone/address, delivery window, assigned-staff ID or printable order view was found in inspected order UI/model.
- Orders receive an ID formatted `DH-${crypto.randomUUID()}`; order list/detail routes expose this document ID. It is not a human-friendly sequential code.
- `createdBy` is the creator's display name only; status history records actorName, not a staff membership UID. Existing staff membership collection can be listed by admin but no order assignment relationship exists in inspected schema.
- Important architecture issue to address before S2 implementation: the order flow currently creates a customer document before calling the order transaction. If order creation fails, the newly created customer can remain orphaned. Existing transaction then atomically writes order and customer aggregate projection.
- Firestore Rules allow order keys only for current schema and would reject additive recipient/assignment fields until rules/types/services are updated together. No migrations or writes performed.
- No production data accessed, no production deployment, billing/configuration change, or destructive migration.
- S2 remains AUDIT IN PROGRESS / implementation NOT STARTED. Follow-up: finish reviewing all order detail UI and service update methods, inspect test coverage for order creation/edit, then document candidate data model and explicitly separate business choices requiring owner input (recipient vs purchaser semantics, delivery date/time rules, staff assignment policy, print layout).


- Final verification correction: post-merge main run #44967174708 completed `success`; the earlier in-progress observation above is superseded.


### S2 continuation — 2026-11-22 (PR #11 atomic first-customer/order write)

- Opened PR #11: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/11 (`fix/atomic-customer-order-creation`).
- The new-customer order path now creates the customer and first order in one Firestore transaction; no pre-create call remains in the order form. Existing customer lookup and legacy ID reuse remain intact.
- Firestore Rules now permit a customer with a non-empty first-order projection only when `getAfter()` sees the matching valid initial order in the same atomic write. Standalone empty customer creation remains supported.
- Emulator coverage added for: failed first-order leaves no customer; forged customer projection without matching order is denied; successful first order creates customer + aggregate + projection atomically. Existing Playwright create-order flow now exercises this path.
- Initial CI run #44982205534 failed TypeScript because an optional `.some()` expression returned `boolean | undefined`; corrected with `?? false` in the next commit. Replacement run #44982298301 must be checked before merge.
- S2 source findings and open business semantics are documented in `docs/audits/CRM_HOA_ROVII_S2_ORDER_WORKFLOW_AUDIT_2026-11-22.md`.
- No production data/deployment/billing changes. No legacy data migration.
