---
trigger: model_decision
description: Apply before substantial CRM feature work, bug fixes, refactors, reviews, and commits.
---
# CRM Development Workflow

1. Inspect the current branch/HEAD, working-tree state, relevant routes, services, types, Firestore rules/indexes, and existing tests before editing.
2. Identify the concrete defect, acceptance criteria, affected user journeys, and data/security risks. Avoid unrelated refactors.
3. Check version-specific Next.js guidance under `node_modules/next/dist/docs/` when available; confirm package versions and scripts in `package.json`.
4. Make the smallest complete change. Add regression/security coverage appropriate to the risk.
5. Review the final diff for unintended edits, swallowed errors, stale state, race conditions, accessibility, and authorization gaps.
6. Run relevant checks. For final CRM verification, run emulator tests, lint, TypeScript typecheck, and production build.
7. Update reports only with evidence from the exact commit. Never reuse old logs as proof for new code or claim browser testing without exercising the flow.
8. Summarize changed files, tests and their observed results, remaining risks, and commit SHA.
