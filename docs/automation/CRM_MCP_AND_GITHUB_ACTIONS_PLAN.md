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
- **GitHub Actions:** run lint, typecheck, Emulator tests and build in a clean Ubuntu runner. Use Node 22, Java 21, and `permissions: contents: read`.
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

## Current blocker

On 2026-10-16 the connected `mcp__iKH_Local_Bridge__get_bridge_status` call returned HTTP 404. Before implementing or registering additional Bridge tools, inspect the actual `hoaihoai48/ikh-local-bridge` repository and the local endpoint configuration, restore the existing Bridge connection, and verify its allowlist and path protections. Do not create a parallel Bridge implementation while the existing one is unverified.
