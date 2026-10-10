---
name: crm-quality-gate
description: Run the CRM Hoa repository's real final verification gates after a feature, bug fix, refactor, or before release. Use the actual repository scripts and report evidence for the exact HEAD.
---
# CRM Hoa Quality Gate

## Purpose
Verify the CRM Hoa Next.js/TypeScript/Firebase repository without assuming generic scripts or claiming checks that were not run.

## Before running
1. Inspect `git status --short --branch`, `git rev-parse HEAD`, and `git diff --stat`.
2. Read `package.json` scripts and `FIREBASE_FINAL_VERIFICATION_REPORT.md`.
3. Confirm Firebase Emulator prerequisites and Java version from the repository's documented setup.
4. Never use production credentials or mutate production data for tests.

## Required final gates
Run each command and record its actual exit code:
1. `npm run test:emulator`
2. `npm run lint`
3. `npx tsc --noEmit`
4. `npm run build`

Do not replace `test:emulator` with a generic `npm test` command. Do not assume coverage tooling is installed. If a command cannot run, label it NOT RUN and explain why. Any non-zero exit code is FAIL.

## Change-sensitive checks
- Firestore rules/auth/membership: include positive and negative emulator cases (self-read vs cross-user read, active vs inactive, role escalation, unauthorized writes).
- Orders and customer summaries: test totals, validation, state transitions, and aggregate consistency.
- React/Next.js route changes: inspect loading, empty, error, retry, auth redirects, responsive behavior, and accessible controls. Run browser E2E only when a safe configured test environment is available.
- Environment/config changes: ensure secrets are not committed and document required variables without exposing values.

## Final diff review
Review the exact diff and check for unrelated edits, swallowed errors, stale async state, unsafe fallbacks, authorization gaps, and accidental real-data artifacts.

## Report format
- HEAD SHA and working-tree status
- Each gate: PASS / FAIL / NOT RUN, command, observed exit code, concise evidence
- Security/regression tests added or updated
- Remaining risks and any browser checks not performed
- Overall verdict: READY only if all four required gates passed on the same reported HEAD

Never copy a previous report's PASS status onto a newer commit. Update the verification report only when the current HEAD's results are actually observed.
