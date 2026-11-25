# lessons — Engineering Lessons and Delivery Memory

This is the durable record of lessons learned while maintaining CRM Hoa ROVII. Add a dated entry when a meaningful failure, correction, architectural constraint or delivery-process lesson occurs. Keep entries actionable; do not turn this file into a raw chronological chat log.

## 2026-11-25 — Use the GitHub connector workflow the owner selected

- For repository work initiated with the GitHub connector, inspect and change the repository through the GitHub connector.
- Do not silently switch to ChatGPT Work or another workflow. The owner has explicitly corrected this more than once.
- Report concrete repository results: file/PR/commit, exact test outcome and whether the change is merged. Avoid progress narration without a verified result.

## 2026-11-25 — Verify live Git state; old handoff documents can be stale

- Always fetch the live `main` ref, active PR heads, PR state, latest Actions runs and review threads before deciding what is complete.
- A document saying a PR is open or merged is not proof. GitHub's current state and exact commit SHA are authoritative.
- A passing check on an earlier SHA does not verify a later SHA. Cancelled or skipped jobs are not passes.
- Keep the current handoff concise and update it at every meaningful milestone.

## 2026-11-25 — Control CI churn

- Never push a speculative fix just to see whether CI turns green.
- For each failed run: inspect the failed job log, locate the exact assertion/source contract, formulate one targeted fix, and validate it locally or in an isolated Emulator before pushing.
- Do not push another commit while the previous head's Actions run is still running.
- Do not rerun an unchanged failing SHA. Avoid parallel PRs for overlapping scope.
- Treat GitHub Actions and Vercel Free quotas as finite resources.

## 2026-11-25 — Firestore Rules have real evaluation limits

- Complex cross-document Rules logic and large projection checks can hit Firestore's 1,000-expression evaluation budget.
- Do not solve a data-integrity problem by adding an elaborate Rules protocol without proving that normal transactions remain within the budget.
- Prefer a simple canonical data model when duplicated projections create refill, cache invalidation and concurrency edge cases.

## 2026-11-25 — Be honest about Firebase Spark's trust boundary

- In the current Firebase Spark client-transaction architecture, Firestore Rules can validate membership, document shape and allowed lifecycle transitions, but cannot independently prove all client-computed cross-document arithmetic.
- Customer scalar aggregates such as order count and spend remain client-maintained. Do not claim they are authoritative against a malicious authenticated staff client.
- Canonical `orders/{orderId}` records are the evidence from which history and aggregates can be reconciled.
- A simplification that uses canonical orders is not automatically a security fix for scalar aggregate tampering. Record the trade-off explicitly.

## 2026-11-25 — Tests must express the actual security contract

- An Emulator assertion can be stale even when it sounds like a desirable security property.
- Before changing Rules to satisfy a failing test, compare the assertion with the documented threat model and actual product architecture.
- In PR #26, the assertion that a valid-shaped customer write with scalar aggregates must be denied contradicted the documented trusted-internal-staff/Spark limitation. Do not weaken Rules or mislabel this as an order workflow regression to make the test pass.
- Correct the test contract only after the intended boundary is explicit; retain negative tests for what Rules genuinely guarantee.

## 2026-11-25 — Keep Preview requirements proportional

- Vercel Preview is required for runtime/UI and deployment-configuration changes when the delivery policy says so.
- For docs-only changes, do not consume deployment quota unnecessarily. Record Actions/Preview as NOT RUN or N/A when the workflow explicitly excludes the diff; never describe skipped checks as passes.
- For Firebase Rules or emulator/test-infrastructure changes, run the relevant latest-head Actions checks even if a Vercel Preview is not applicable.

## 2026-11-25 — Keep production and billing boundaries intact

- Use only the explicit demo Firebase project and loopback Auth/Firestore/Storage Emulators for automated tests.
- No production deployment, customer/order data repair, destructive migration, Firebase project configuration change, paid Firebase service or billing change without owner approval.

## Maintenance rule

When a new lesson is added:
1. Include the date and the concrete incident or decision.
2. State the failure mode or misleading assumption.
3. State the rule that prevents recurrence.
4. Link the relevant PR, commit or Actions run when available.
5. If the lesson changes future agent behavior, also update `AGENTS.md` or the relevant delivery instruction; do not rely on this file alone for mandatory workflow rules.


## 2026-11-25 — Follow the owner's current implementation-first operating direction

- The owner has asked to prioritize finishing implementation and not proactively run Playwright or other test suites; report runtime defects when the owner encounters them during normal use.
- Avoid spending time on repeated manual test/CI runs unless the owner asks. Repository pushes may still trigger configured GitHub Actions automatically; never claim unrun checks passed.
- Keep untested changes clearly identified and preserve production, billing and data-safety boundaries.
