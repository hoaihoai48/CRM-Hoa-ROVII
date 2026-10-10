<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


<!-- BEGIN:CRM-HOA-PROJECT-RULES -->

## CRM Hoa — project-specific instructions

### Stack and source of truth
- This repository is a Next.js App Router application using TypeScript, React, Tailwind CSS, Firebase Authentication, and Cloud Firestore. Confirm exact versions and scripts from `package.json` before choosing APIs or commands.
- Preserve existing project conventions. For Next.js changes, consult the installed version's documentation under `node_modules/next/dist/docs/` before relying on remembered APIs.
- Treat Firebase data, Firestore rules, service-layer validation, and UI state as one end-to-end feature. A UI restriction is not a substitute for server/database authorization.
- Never replace a Firebase/network failure with mock data or a success-looking empty state. Distinguish missing data, denied access, and transient failures; provide retry where appropriate.
- Order status transitions and customer aggregates are business-critical. Preserve transaction atomicity and verify aggregate updates when changing order logic.
- Do not commit secrets, production credentials, real customer data, or emulator artifacts.

### Relevant agent selection
Use only the agents relevant to the files and risks being changed; do not run the entire multi-language agent catalog.
- React/TSX, hooks, route UI, client/server boundaries: `react-reviewer` + `typescript-reviewer`.
- Authentication, authorization, Firestore rules, sensitive data: `security-reviewer`; use the Firebase security-rules auditor skill when rules are in scope.
- Swallowed errors, fallback behavior, loading/retry states: `silent-failure-hunter`.
- Build/type/lint failures: `react-build-resolver` or the narrowest relevant resolver.
- Critical user journeys and responsive/accessibility behavior: `e2e-runner` / browser QA when a configured browser environment and safe test account are available.
- Architecture changes: `architect` or `code-architect`; use only when the change actually affects architecture.
Agent files are guidance, not proof that their named tools, hooks, or external plugins are installed. Verify a referenced command or integration exists before invoking it.

### Required delivery workflow
1. Inspect the current branch/HEAD, working-tree changes, relevant route, service, types, Firebase rules/indexes, and existing tests before editing.
2. State the actual defect/risk and make the smallest complete fix. Do not perform unrelated refactors or overwrite unrelated user changes.
3. Add or update a regression/security test for behavior changes where practical. For Firestore authorization changes, test allowed and denied cases in the emulator.
4. Run the applicable checks. For a complete CRM release/final verification, run all four:
   - `npm run test:emulator`
   - `npm run lint`
   - `npx tsc --noEmit`
   - `npm run build`
5. If any command cannot run, report it as NOT RUN; if it fails, report FAIL. Never reuse old logs as proof for a newer HEAD. Do not claim a gate passed unless its exit code was observed on the exact code being reported.
6. Review the final diff, update the relevant report/docs, and summarize changed files, test evidence, remaining risks, and exact commit SHA. Do not claim browser verification without actually exercising the flow.

### CRM-specific quality priorities
- Authorization must fail closed, but an unreadable membership caused by a transient service error must not be mislabeled as a confirmed unprovisioned account.
- Validate numeric inputs at both UI/service boundaries where applicable; do not trust client-supplied totals or role fields.
- Keep product deactivation labels consistent with soft-deactivation behavior; do not hard-delete records referenced by orders without an explicit data-migration plan.
- Keep error messages useful to staff while avoiding leakage of secrets, tokens, or sensitive backend details.

<!-- END:CRM-HOA-PROJECT-RULES -->
