---
trigger: model_decision
description: Apply when implementing or fixing CRM features, data services, Firebase behavior, or UI interactions that need regression coverage.
---
# CRM Testing Rules

- Choose tests based on changed behavior and risk; do not claim every change requires unit, integration, and E2E suites or a fixed coverage percentage.
- For Firestore authorization or data-integrity changes, add emulator tests for permitted and denied operations whenever practical.
- For UI/service changes, add a focused regression test for the bug or edge case when the repository's test setup supports it.
- Use Arrange–Act–Assert and assert user-visible behavior or service contracts rather than implementation details.
- Use the repository's actual scripts. The CRM release verification commands are `npm run test:emulator`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
- Never assume `npm test`, coverage tooling, Jest, Vitest, Playwright, or RTL is installed. Check `package.json` and existing test files first.
- Report each gate as PASS, FAIL, or NOT RUN based on the command's actual exit code. Historical logs do not verify a newer commit.
