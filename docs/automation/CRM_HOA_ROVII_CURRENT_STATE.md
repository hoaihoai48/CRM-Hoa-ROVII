# CRM-Hoa-ROVII — Current Delivery Handoff

**Last updated:** 2026-11-22  
**Repository:** https://github.com/hoaihoai48/CRM-Hoa-ROVII  
**Default branch:** main  
**Latest code merge:** 83c354436ff9dfedca180832fcec324c03a36ffa (PR #18; PR #21 was a documentation-only merge)  
**Resume rule:** Always read this file and the playbook, then inspect live GitHub state and latest main ref before acting. This file is updated last in a delivery session.

## Owner delegation and safety boundaries

- The owner has delegated routine engineering decisions: inspect, implement, test, maintain PRs, and merge ordinary low-risk code/docs PRs when all required checks pass and the diff is safe.
- Do not interrupt with progress reports. Continue autonomously and stop only for a real business decision, missing credentials/permissions, paid-service or billing change, production data repair/migration, production deployment/release, or another irreversible/high-risk action.
- Preserve Firebase Spark compatibility. Do not introduce paid Firebase services without approval.
- Use Firebase Auth/Firestore Emulators and synthetic identities only. Never read or mutate production customer/order data for tests.
- No production deployment, billing/configuration change, destructive migration or production data repair without explicit approval.
- Work on feature branches; use cohesive commits; inspect final PR head, completed CI evidence, Preview feedback and review threads before merge.
- Keep this handoff and the playbook current at each meaningful milestone. Never report a workflow as PASS until its completed result is inspected.

## Current status

- S0 — CI/Playwright foundation: COMPLETE.
- S1 — Order lifecycle integrity: COMPLETE.
- S2 — Sales/order workflow technical hardening: substantial safe work COMPLETE; business semantics remain blocked on owner decisions listed below.
- PR #16 cursor pagination: MERGED.
- Open PR inventory: PR #22 (Storage Rules/test isolation) is open; PR #21 merged; PR #23 closed unmerged and superseded.
- Post-merge main workflow #44989024153 completed PASS on PR #16 merge commit; all CI steps passed.
- No production data, deployment, billing or destructive migration touched.

## Merged delivery inventory

| PR | Scope | Merge commit | Verification |
|---|---|---|---|
| #8 | Playwright/CI foundation | c63f2da0d2250bf8957877ce33e17142a8d6f8d3 | PR CI passed |
| #9 | Order lifecycle, history and customer projection integrity | 8ea157041599ca95966a02695e7c1a25ffe3c9a7 | PR CI #44966311523 and post-merge #44966474046 passed |
| #10 | MCP structured output schemas and safety smoke tests | 6ac8304c8df47fe0c2a94dd444591a59ebb5b2da | PR CI #44966591236 and post-merge #44967174708 passed |
| #11 | Atomic first-time customer + first order creation | 73bb72ca19e5af82027e7f27096e693cb5892497 | PR CI #44982355903 and post-merge #44982521247 passed |
| #12 | Stable creator/history actor UIDs | 64c539e423c78bfe0b7089889b40d479afdfa799 | PR CI #44982896197 and post-merge #44983058488 passed |
| #13 | Browser-native A4 printable order slip | bd3e259082b8f600db4474e39947b0ee0218e4fa | PR CI #44983725322 and post-merge #44983907739 passed |
| #14 | Bounded customer order projection and delta aggregates | 568083053d7311f6d5abbe608f3a100f0c803444 | PR CI #44985057671 and post-merge #44985288167 passed |
| #15 | Dashboard bounded reads/local-day query | 4ce6d95095141180cb855426bff8c94c722b880b | PR CI #44985805872 and post-merge #44986041575 passed |
| #16 | Cursor pagination for orders/customers | 7e923b5a0a996468a211f76b8d1ff715699e3ce4 | Final PR head 83e0d6c09978ea163e7b4d0f6280d3dd3b0f2f8c; PR CI #44988852658 and post-merge #44989024153 passed |

Relevant links:
- [PR #16](https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/16)
- [PR #16 CI](https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/44988852658)
- [PR #16 post-merge CI](https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/44989024153)
- [S2 order workflow audit](https://github.com/hoaihoai48/CRM-Hoa-ROVII/blob/main/docs/audits/CRM_HOA_ROVII_S2_ORDER_WORKFLOW_AUDIT_2026-11-22.md)
- [Collection read/pagination audit](https://github.com/hoaihoai48/CRM-Hoa-ROVII/blob/main/docs/audits/CRM_HOA_ROVII_COLLECTION_READ_PAGINATION_AUDIT_2026-11-22.md)

## Important invariants to preserve

- New orders start in new with exactly one valid initial history entry.
- Allowed transitions: new → confirmed/cancelled, confirmed → delivering/cancelled, delivering → completed.
- History is append-only; every status mutation appends exactly one valid entry and preserves the previous sequence.
- Same-status content edits are allowed only in new and confirmed; lifecycle transitions change only status/history.
- Order service reads product prices from Firestore and recomputes totals inside a transaction.
- Order/customer projection updates are atomic and Firestore Rules use getAfter() to require the matching per-order projection.
- First-time customer and first order are created in one transaction; a failed first order must not leave an orphan customer.
- New records may store createdByUid and history actorUid; these are optional for legacy compatibility and must match request.auth.uid.
- Customer orderSummaries is bounded to at most 51 rows; lifetime counters are scalar values updated by transaction deltas. Full order history remains in orders.
- Dashboard loads the local-day order range and six newest orders, not the full collection.
- Order/customer list pages browse 50-row snapshot-cursor pages. Global substring search and non-default order status filtering intentionally load the full collection to preserve existing semantics.
- Keep all changes Spark-compatible; do not move business writes to paid Cloud Functions.

## S2: completed technical work vs owner decisions

Completed:
1. Atomic customer/order creation (PR #11).
2. Stable creator and status-actor UIDs for attribution (PR #12); this is not staff assignment.
3. Browser-native A4 print action/layout (PR #13); no PDF dependency.
4. Bounded customer projection and lifetime aggregate delta updates (PR #14).
5. Dashboard bounded reads (PR #15).
6. Cursor pagination for order/customer browsing while preserving global search semantics (PR #16).

Still requires owner decisions before schema/UI implementation:
1. Purchaser/customer vs recipient: may they differ, and are recipient phone/address optional?
2. Delivery scheduling: exact datetime, defined time slots, or both; timezone and past-date rules.
3. Separate fields: greeting-card message, delivery instructions and internal note; who can see each?
4. Human-readable order code: format, uniqueness scope and reset cadence. Existing UUID document IDs should remain canonical route keys.
5. Staff assignment: single or multiple assignees, who may assign/reassign, and whether visibility/edit permissions change.
6. Print output: customer receipt, internal fulfilment sheet, or both; required fields/branding.

A backward-compatible optional-field candidate and regression matrix are recorded in the S2 audit. Do not implement these business semantics by guessing.

## Known technical trade-offs / follow-ups

- Search and non-default status filters still read the full order/customer collection by design; the behavior is documented and must not be silently narrowed.
- Customer detail order history now uses 25-row snapshot-cursor pages with explicit load-more (PR #17); the full history remains available without a single unbounded read.
- Firestore Rules validate document shape, lifecycle, actor identity and matching customer projection, but cannot prove all cross-document aggregate arithmetic. Emulator coverage and transaction code remain essential.
- syncCustomerAggregates() is a full-scan repair path; do not run it against production without a separately reviewed operational plan and explicit approval.
- Browser print output uses current stored fields; expanding it depends on the owner choosing receipt/fulfilment content.

## Next action

1. PR #17 (customer order-history pagination) merged at `8ce9930ee181b1fca788e823a53ffac8860d9067`; PR CI #45008095660 and post-merge main CI #45008325128 PASS.
2. PR #18 (require authenticated actor UID for appended history on UID-attributed orders) merged at `83c354436ff9dfedca180832fcec324c03a36ffa`; PR CI #45008498582 and post-merge main CI #45008753697 PASS.
3. Firestore Rules now require `actorUid == request.auth.uid` for every appended status-history entry when the existing order has `createdByUid`; legacy orders without creator UID retain backward-compatible optional actor UIDs.
4. No further purchaser/recipient, delivery-slot, note, order-code, assignment or print-content implementation until the owner supplies the business decisions above.
5. Once those decisions are supplied, implement one vertical slice at a time with coordinated types + service + Firestore Rules + Emulator positive/negative tests + Playwright + print verification.
6. PR #21 merged as docs-only commit `e728de1b8b98f91e976a3336a657720f4020f6b8`. Its F-01 impact wording was corrected after independent security review; no Actions run is expected under `paths-ignore`, and the Vercel quota failure is not a gate for docs-only changes.
7. PR #22 is the active security-hardening step. CI run #45043396941 on pre-fix head `5562214aa1aaf89300be79dc7cb3a5f4abfa5bea` passed lint/typecheck and Auth/Firestore/Storage Emulator tests but failed 3 of 6 Playwright tests because E2E fixtures still seeded project `crm-hoa-rovii` while the app ran under `demo-crm-hoa-rovii`; production build was skipped. The fixture project IDs were corrected in commits `df358a63ebfecc62b98c0bb131febbf5eae44c59` and `2f643fd07c85c58d35b2ba37a6a0f1cac3133765`. Re-run full CI on the synchronized latest head and complete code/security review before merge.

## New-chat instruction

Read this handoff and docs/automation/CRM_HOA_ROVII_AUTONOMOUS_DELIVERY_PLAYBOOK.md. Fetch the live main ref, open PR inventory and latest Actions runs. PRs #8–#18 and #21 are merged; PR #23 is closed unmerged; PR #22 is the active Storage Rules/test-isolation hardening PR. The previous PR #22 run #45043396941 failed only in Playwright because E2E fixtures still used the old project ID; those fixtures were corrected in commits `df358a63ebfecc62b98c0bb131febbf5eae44c59` and `2f643fd07c85c58d35b2ba37a6a0f1cac3133765`. Recheck the latest head and run full CI/reviews before merge; do not repeat PRs #8–#18, #21 or #23.


## Delivery update — 2026-11-22 (PRs #17–#18)

- PR #17: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/17 — customer history now loads 25 newest orders, then uses the existing customer-scoped Firestore snapshot cursor for older pages. Playwright Case verifies 27 synthetic orders, newest-first ordering and load-more retrieval of the final two without skipping. Merge `8ce9930ee181b1fca788e823a53ffac8860d9067`; PR CI #45008095660 PASS; post-merge main #45008325128 PASS.
- PR #18: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/18 — Firestore Rules now require `actorUid == request.auth.uid` on every appended history entry for orders that already contain `createdByUid`. Emulator verifies missing UID is rejected without partial order/customer writes and valid authenticated UID succeeds. Legacy orders without `createdByUid` remain compatible. Merge `83c354436ff9dfedca180832fcec324c03a36ffa`; PR CI #45008498582 PASS; post-merge main #45008753697 PASS.
- Vercel Preview for both PRs Ready; zero unresolved feedback. No production data/deployment, migration, billing or paid Firebase service touched.
- Latest code merge: `83c354436ff9dfedca180832fcec324c03a36ffa`; handoff and audit documentation is synced through PR #18.


## Delivery update — 2026-11-22 (PR #19)

- PR #19: https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/19 — documentation-only synchronization of the Autonomous Delivery Playbook. Corrected the stale PR #16 post-merge CI note, added PRs #17–#18 to the merged inventory, removed stale statements that customer detail history remained unpaginated, and clarified that S2 technical hardening is complete through PR #18 while business semantics remain owner-gated.
- Squash merge: `53698b09cc73acaa56135ac2e62f602f02374aea`.
- PR #19 Vercel Preview check passed before merge. Post-merge Vercel status was still pending at handoff; no GitHub Actions run was returned for the docs-only merge commit. Do not mark post-merge verification PASS until the status is rechecked.
- No application code, Firestore schema/Rules, production data, production deployment, migration, billing or Firebase configuration changed.


## Security review correction — 2026-11-22

- Independent review identified an overstatement in F-01: same-status edits to `new`/`confirmed` orders can change editable items/summary values because Rules validate shape and lifecycle/history, not product-price arithmetic. The impact statement now says this explicitly.
- No application code or policy changed in this documentation correction. The remaining customer aggregate weakness is unchanged: an active client can directly forge customer scalar aggregates/projection fields within the current schema.


## Delivery update — 2026-11-22 (PR #21 merged; PR #22 E2E fixture correction)

- PR #21 merged by squash as `e728de1b8b98f91e976a3336a657720f4020f6b8`. It adds the Firebase Security & Access-Control Audit and the F-01 wording correction. Codex code review completed with no findings on `f9fa49c5`; independent security review found/corrected the editable-order-total qualification. No GitHub Actions run was returned because docs-only changes are excluded by `paths-ignore`; Vercel failed with the Free daily deployment quota, which is not applicable to docs-only work.
- PR #22 (`feat/storage-rules-emulator-coverage`) implements active-admin-only Storage product image writes/deletes, Storage Emulator regression coverage, fail-closed demo/loopback guards for both Emulator test scripts, and Playwright demo-project isolation.
- PR #22 run #45043396941 on old head `5562214aa1aaf89300be79dc7cb3a5f4abfa5bea`: lint, typecheck, Auth/Firestore/Storage Emulator tests passed; Playwright had 3 failures and 3 passes because `auth.spec.ts` and `orders.spec.ts` still seeded `crm-hoa-rovii` while the app used `demo-crm-hoa-rovii`; production build was skipped. Fixed the fixtures in `df358a63ebfecc62b98c0bb131febbf5eae44c59` and `2f643fd07c85c58d35b2ba37a6a0f1cac3133765`.
- PR #22 branch is being synchronized with main after PR #21. The next gate is a completed latest-head Actions run plus current-head code/security review. Vercel Preview is N/A because this PR changes Rules/test infrastructure only, not runtime/UI or Vercel deployment configuration.
- PR #23 was closed unmerged at `2026-11-22T15:48:14Z`; do not reopen or duplicate it.
- No production Auth/Firestore/Storage data, deployment, billing, migration or Firebase project settings were accessed or changed.
