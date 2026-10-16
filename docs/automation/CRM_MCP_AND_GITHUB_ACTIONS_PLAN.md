# CRM-Hoa-ROVII — Local Bridge, MCP and GitHub Actions Plan

## Decision

Use the existing iKH Local Bridge as the local execution boundary, and GitHub Actions as the clean CI runner. Do not add an arbitrary shell executor to the Next.js application or duplicate GitHub's repository API.

## Command allowlist

The local runner may expose these named tasks only:

| Task ID | Command | Purpose |
|---|---|---|
| `lint` | `npm run lint` | ESLint |
| `typecheck` | `npm run typecheck` | TypeScript |
| `build` | `npm run build` | Production build |
| `emulator-tests` | `npm run test:emulator` | Auth/Firestore Emulator integration suite |

Each task must run with the configured CRM repository as its working directory, a timeout, bounded output, and an explicit exit code. Do not accept arbitrary command strings from tool arguments. Do not permit install, filesystem traversal, reading environment/secrets, deployment, push, or merge as part of these checks.

## Responsibilities

- **Local Bridge:** inspect the configured working copy, run allowlisted checks, return Git status/diff and bounded logs.
- **GitHub connector:** read repository files, manage branches/PRs and retrieve workflow status.
- **GitHub Actions:** run lint, typecheck, Emulator tests and build in a clean Ubuntu runner. Use Node 24, Java 21, and `permissions: contents: read`.
- **MCP server:** expose narrow typed tools that call the Bridge or GitHub APIs; do not execute shell commands itself unless a separate, explicitly hardened local runner is designed and approved.

## Proposed MCP tools

- `crm_repo_status` — repository path, branch, HEAD and clean/dirty state.
- `crm_read_file` / `crm_search_source` — bounded read-only source inspection.
- `crm_get_diff` — current diff, with changed paths.
- `crm_run_check` — enum input limited to `lint | typecheck | build | emulator-tests`.
- `crm_dispatch_ci` — dispatch only a named workflow/task, never a raw shell command.
- `crm_get_ci_result` — workflow state, conclusion, commit SHA, run URL and bounded logs.
- `crm_create_branch` / `crm_create_pr` — optional later phase; no automatic merge.

All mutating operations should be separated from read/check tools and should target a non-protected feature branch. PR merge and production deploy remain explicit human decisions.

## Implementation status (2026-10-16)

A dedicated, dependency-free stdio MCP server has been added under `mcp-server/` for the CRM repository. It exposes four narrow tools: `crm_repo_status`, `crm_read_file`, `crm_get_diff`, and `crm_run_check`. The latter accepts only `lint | typecheck | build | emulator-tests`; there is no arbitrary shell, install, deploy, commit, push, merge, or file-write tool. The server requires `CRM_HOA_ROVII_ROOT`, verifies the package name and Git root, and has path/secret/output bounds. CI runs syntax checks and a protocol/safety smoke test.

The connected iKH Local Bridge still reports its workspace as `/Users/vu/Developer/giao-trinh-ikh`. Its path confinement correctly rejected a path attempting to escape that workspace. We did not repoint or modify that bridge because it is the curriculum workspace and the exposed tools do not provide a safe workspace-reconfiguration operation.

## Remaining client-side registration

Repository code and CI validation do not automatically register a server in ChatGPT/Codex. On the machine that has a local clone, add the generic `mcpServers` entry documented in `mcp-server/README.md`, substituting the actual absolute CRM clone path, then restart the MCP client and call `crm_repo_status`. Verify that the returned root is the CRM repo before running checks. The exact configuration file depends on the MCP client; no client config was edited by this repository-side change.


## Firebase free-tier constraint

The current CRM uses the Firebase Spark plan. Cloud Functions cannot be deployed on Spark, so the active application workflow must not call callable Functions. The Spark-compatible branch `fix/spark-compatible-order-workflows` uses client Firestore transactions and Auth/Firestore Emulators only. This is a deliberate trusted-internal-team trade-off: Firestore Rules enforce membership and schema but cannot prove cross-document financial calculations. Do not link billing or deploy Functions unless the owner explicitly changes the cost requirement.
