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

## Configure a local MCP client

Use an absolute path to the clone. Example generic MCP client configuration:

```json
{
  "mcpServers": {
    "crm-hoa-rovii-local": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/CRM-Hoa-ROVII/mcp-server/server.mjs"],
      "env": {
        "CRM_HOA_ROVII_ROOT": "/ABSOLUTE/PATH/TO/CRM-Hoa-ROVII"
      }
    }
  }
}
```

Replace both example paths with the actual path of the user's local clone. Do not put tokens, service-account keys, or other secrets in this configuration. Restart the MCP client after saving it, then call `crm_repo_status`; verify that the returned root is the intended CRM repository before running checks.

Client configuration formats differ. This example is the common `mcpServers` shape, not a claim that the MCP server has been registered automatically in ChatGPT/Codex.

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
