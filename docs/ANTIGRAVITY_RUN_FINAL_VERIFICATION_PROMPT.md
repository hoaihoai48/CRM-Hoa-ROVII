# ANTIGRAVITY — RUN AND CLOSE CURRENT FIREBASE VERIFICATION

Work directly in the existing local checkout of `hoaihoai48/CRM-Hoa-ROVII`, branch `main`. This is a verification-and-fix task, not a redesign.

## Context
The latest source/test commits include:
- `a45d460`: repair utility retries when customer projection changes during the orders query.
- `8da7fa3`: Case H directly tests `syncCustomerAggregates()`.
- `c787a07`: Case K tests concurrent status mutations.
- `08ae50b`: report corrected to say current-code gates have not yet run.

The remote execution environment used by the reviewer could not clone GitHub due to unavailable network DNS. Do not infer PASS from source inspection or previous commits. You have the local checkout, so run the commands below there and preserve the real outputs.

## Mandatory steps — do all in one pass

1. **Synchronize and inspect**
   - `git fetch origin`
   - Confirm branch is `main`, inspect `git status --short`, then fast-forward to `origin/main` without discarding user changes.
   - Read the current `src/lib/services/orders.ts`, `scripts/test-emulator-integrity.ts`, `package.json`, Firebase config/rules, and `FIREBASE_FINAL_VERIFICATION_REPORT.md`.
   - Do not overwrite unrelated user changes.

2. **Run all gates and capture actual logs**
   - `npm install` only if dependencies are missing or lockfile requires it; do not change dependency versions unnecessarily.
   - `npm run test:emulator`
   - `npm run lint`
   - `npx tsc --noEmit`
   - `npm run build`
   - Record exact exit code and useful output for each command. Run the commands in the real checkout; do not simulate results.

3. **Fix any failures before finalizing**
   - Inspect the root cause and fix the source/test issue, not just the assertion or script to make it pass.
   - Re-run every gate affected by a code change; for the final state, run all four gates again.
   - In Case H, confirm repair rebuilds summaries and aggregates from actual `orders`, including cancelled orders in the projection while excluding them from `totalOrders`.
   - In Case K, confirm concurrent status updates leave the persisted order and customer projection in agreement and aggregate fields correct. Do not require both competing requests to succeed; a transition may legitimately fail after the other commits.
   - Confirm the repair retry protocol does not blindly preserve stale/missing projection summaries and does not overwrite a concurrent service mutation.
   - Check the TypeScript type and runtime behavior of the retry sentinel. Keep retry attempts bounded and report exhaustion honestly.
   - Keep `orders` as business source of truth; `customer.orderSummaries` is a transactional/materialized projection.
   - Do not redesign the UI, schema, or introduce Cloud Functions as part of this task.

4. **Security and scaling**
   - Keep the existing broad authenticated-only Firestore write rule explicitly documented as a security limitation. Do not claim client transactions prevent direct authenticated writes that bypass the service.
   - State that the customer document's 1 MiB Firestore limit bounds the size of `orderSummaries`; do not claim a guaranteed safe order count from a rough byte estimate.

5. **Update the report truthfully**
   - Update `FIREBASE_FINAL_VERIFICATION_REPORT.md` with the exact code commit SHA that was actually tested, test date, commands, exit codes, and concise real log evidence.
   - If a command cannot run, mark it `BLOCKED` with the exact environment error. If it runs and fails, mark `FAIL` and explain why. Never mark an unexecuted gate PASS.
   - Distinguish the code SHA tested from the later report-sync commit SHA; do not attempt to put the report's own final commit SHA inside itself.
   - Preserve the explicit Firestore rules limitation and known document-size limit.

6. **Commit and push**
   - Commit only the necessary code/test/report changes, then push to `origin/main`.
   - Finish with a clean `git status --short`.
   - In your final summary report the final code SHA, report-sync SHA, each gate's actual PASS/FAIL/BLOCKED status, any fixes made, and any remaining limitation.

## Stop conditions
Do not declare final PASS if any mandatory gate failed or was not run. Do not hide emulator startup errors. Do not claim the new Case H or Case K passed unless their output appears in the actual emulator test log.
