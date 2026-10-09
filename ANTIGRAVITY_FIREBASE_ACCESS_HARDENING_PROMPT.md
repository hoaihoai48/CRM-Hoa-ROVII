# Antigravity Task — Harden Firebase Firestore Access

**Repository:** `hoaihoai48/CRM-Hoa-ROVII`  
**Branch:** `main`  
**Starting point:** inspect the latest `main` before editing; do not assume the SHA below is still HEAD.  
**Goal:** implement and verify role-based Firestore authorization in one controlled pass. Do not merely write a plan/report.

## Context

The current `firestore.rules` was previously identified as allowing every authenticated account to read and write all documents in `orders`, `customers`, `products`, and `settings`. This is too broad for a CRM. The previous Case H work reportedly passed emulator, lint, TypeScript, and production build gates, but those gates must be rerun after this change.

## Required implementation

1. Inspect the current authentication flow, data model, Firestore rules, emulator configuration, and existing test scripts before changing anything.
2. Implement server-trusted workspace membership/role authorization. Do **not** let a client create or modify its own role or active status.
3. Define the minimum roles supported by the existing application (expected `admin` and `staff`, confirm from source). Require an authenticated user to have a provisioned, active membership record before accessing CRM collections.
4. Lock down membership documents:
   - a user may read only their own membership record if the app needs it;
   - clients must not list memberships or create/update/delete role records;
   - no client-controlled self-promotion or activation.
5. Apply the appropriate membership/role checks to `orders`, `customers`, `products`, and `settings`. Use least privilege, but preserve legitimate workflows evidenced by the existing app and tests. If role-specific write restrictions would break a real workflow, document the exact decision rather than guessing.
6. Provision test roles only through a trusted test setup (for example Firebase Admin SDK using emulator-only credentials, or another officially supported trusted setup). Never add a client-side role bootstrap or hard-coded production bypass. Keep test credentials/secrets out of the repository.
7. Extend emulator security tests to prove at least:
   - unauthenticated access is denied;
   - authenticated but unprovisioned users are denied;
   - provisioned active users can perform the operations permitted by their role;
   - inactive users are denied;
   - users cannot read/list or modify other users' role records;
   - users cannot self-assign `admin` or set themselves active;
   - existing business cases A–K and Case H continue to pass.
8. Update or add a short setup guide explaining how an administrator securely provisions the first admin and staff membership records using Firebase Console or a trusted administrative path. Clearly distinguish Firebase Auth user creation from Firestore role provisioning. Do not include real user identifiers or secrets.
9. Keep the diff focused. Do not refactor unrelated CRM UI or business logic. Do not modify unrelated course/repository files.

## Mandatory verification gates

Run these against the final working tree, in this order, and capture actual exit codes/output:

1. `npm run test:emulator`
2. `npm run lint`
3. `npx tsc --noEmit`
4. `npm run build`

If the repository uses a different established command for a gate, inspect `package.json`, use the correct existing command, and explain the substitution. Do not report PASS for a command that was not actually run. Fix failures and rerun all four gates after the final code change.

## Commit and report

- Make the code, rules, tests, setup documentation, and lockfile changes (if dependencies genuinely need to change) in one focused commit.
- Commit only after all applicable gates pass. Push the commit to `main` if repository policy permits; otherwise push a branch and report the exact reason.
- In the final report include: commit SHA; files changed; authorization model; test cases added; exact command + exit result for each gate; any remaining limitation. Include links to the commit and report.
- If blocked, do not fake a PASS or make a partial commit that claims completion. Report the precise blocker and the smallest next action required.
