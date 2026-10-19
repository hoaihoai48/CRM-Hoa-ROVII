# CRM Hoa ROVII Security Audit — 2026-10-19

## Scope and safety

Repository: `hoaihoai48/CRM-Hoa-ROVII`  
Base: `main` at `8f002a3f6f42a248e4f41af8477087ac68854ea1`  
Audit branch: `fix/firestore-status-transition-guard`  
Pull request: [#6](https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/6)

This audit does not authorize production deployment, merge, production data access/mutation, billing changes, or paid services. The local working copy had pre-existing staged changes in `mcp-server/server.mjs` and `mcp-server/smoke-test.mjs`; they were preserved and are not part of this PR.

## Changes in this PR

- Add Firestore Rules enforcement for the existing order lifecycle transition graph.
- Require each order update to append exactly one status-history entry whose status matches the document status.
- Require the updated history to retain all existing history entries.
- Add Emulator regression tests for direct illegal status jumps, status changes without a matching history append, and attempts to erase existing status history.

## Verification

- Local checks on the unchanged local working copy: lint PASS, typecheck PASS, production build PASS.
- Local Emulator test execution could not run because the installed Java runtime is below JDK 21.
- GitHub Actions on earlier PR head `070effede56d49c2bb3092bc42aecbc73b7b9e`: lint, typecheck, Emulator tests, and build PASS.
- CI for the final audit-branch head must be green before this PR is considered verified. See the [PR checks](https://github.com/hoaihoai48/CRM-Hoa-ROVII/pull/6).

## Remaining risks / production gate

1. **Trusted staff model:** with client-side writes on Firebase Spark, active staff/admin clients are within the trusted application boundary. Firestore Rules validate schema and selected invariants but cannot prove the full cross-document business truth of every write.
2. **Order arithmetic:** Rules do not independently recompute totals from every product, quantity, fee, and discount. A malicious or compromised authorized client may still attempt a schema-valid but mathematically inconsistent order write unless the write path is moved behind a trusted server.
3. **Customer aggregates:** Rules cannot independently reconstruct a customer's complete order history and prove every aggregate/projection field is accurate. Existing client transactions and repair logic reduce accidental inconsistency but are not a server trust boundary.
4. **History ordering:** Rules require old history entries to remain present and one matching entry to be appended; list-set preservation does not by itself prove that every historical entry remains in its exact original order.
5. **Legacy data:** run the existing read-only legacy order/customer audit with explicitly scoped read-only credentials and review the output before approving any separate data repair. No production data was queried or changed during this audit.
6. **Hosting plan:** confirm the actual use case complies with the Vercel Hobby non-commercial restriction before production use. Do not upgrade or enable billing without explicit approval.

## Pricing constraints

- Keep Firebase Spark; do not introduce Cloud Functions deployments or other features requiring Blaze.
- Do not link Cloud Billing or enable paid services.
- Keep deployment and merge as separate, explicit approvals.

## Final disposition

PR #6 is a targeted security improvement, not a claim that the entire CRM is production-secure. Do not merge until the latest PR checks are green and the remaining trust-boundary and legacy-data risks have been reviewed.
