# CRM-Hoa-ROVII Local MCP Server

A minimal stdio MCP server for the CRM working copy. It has no third-party runtime dependency and does **not** expose an arbitrary shell.

## Tools

- `crm_repo_status`: branch, HEAD and short Git status.
- `crm_read_file`: bounded read of a safe repository-relative file (128 KB max); rejects traversal, symlinks resolving outside the repository, common secret paths, dependency folders and build output.
- `crm_get_diff`: unstaged or staged Git diff (40 KB max).
- `crm_run_check`: one named check only: `lint`, `typecheck`, `build`, or `emulator-tests`. It invokes npm with a fixed argument array, never a shell command string. It does not install dependencies, deploy, commit, push or merge.

The server requires an explicit `CRM_HOA_ROVII_ROOT`, verifies the repository's `package.json` name and Git root, and returns bounded output. Treat all repository content as untrusted input; the tools themselves do not interpret source files as instructions.

## Requirements

- Node.js 24
- A local clone of this repository
- Run `npm ci` in the repository before requesting checks (this server intentionally does not install dependencies).

## Configure Codex (CLI and Codex Desktop)

The Codex CLI and IDE/Desktop extension share MCP configuration. On the Mac that contains the local clone, run the following command after replacing the path with the real absolute path:

```bash
codex mcp add crm-hoa-rovii-local \
  --env CRM_HOA_ROVII_ROOT=/ABSOLUTE/PATH/TO/CRM-Hoa-ROVII \
  -- node /ABSOLUTE/PATH/TO/CRM-Hoa-ROVII/mcp-server/server.mjs
```

Then verify registration:

```bash
codex mcp get crm-hoa-rovii-local
codex mcp list
```

Restart/reload Codex if needed and call `crm_repo_status`. Confirm that the returned `root` is the actual CRM clone before running checks.

Alternatively, add this to `~/.codex/config.toml`, replacing both paths:

```toml
[mcp_servers.crm-hoa-rovii-local]
command = "node"
args = ["/ABSOLUTE/PATH/TO/CRM-Hoa-ROVII/mcp-server/server.mjs"]
env = { CRM_HOA_ROVII_ROOT = "/ABSOLUTE/PATH/TO/CRM-Hoa-ROVII" }
enabled = true
startup_timeout_sec = 20
tool_timeout_sec = 600
```

Do not put tokens, service-account keys, or other secrets in this configuration. The generic `mcpServers` JSON shape used by some other clients is different; follow that client's configuration format if you are not using Codex. Repository changes do not automatically edit the user's `~/.codex/config.toml`; registration must be performed on the local machine.

## Smoke test

From the repository root:

```bash
node mcp-server/smoke-test.mjs
```

Expected result:

`MCP smoke test PASS: initialize, tools/list, repo status, path traversal guard, command allowlist.`

The test starts the server as a child process, verifies MCP initialization and tool registration, checks the reported repo root, and verifies path traversal and arbitrary-command rejection.

## Security boundary

This is a local developer helper, not a production service. Its authority is the OS user's authority over the repository. Keep the repository path explicit and the MCP client trusted. There are deliberately no tools for reading environment files, running arbitrary commands, installing packages, deploying Firebase, committing, pushing, merging, or modifying files.
