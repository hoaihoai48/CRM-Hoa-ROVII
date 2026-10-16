#!/usr/bin/env node
import { spawn } from "node:child_process";
import { realpath, readFile, stat } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const PROTOCOL_VERSION = "2025-06-18";
const MAX_FILE_BYTES = 128 * 1024;
const MAX_OUTPUT_CHARS = 40 * 1024;
const ALLOWED_CHECKS = new Set(["lint", "typecheck", "build", "emulator-tests"]);
const BLOCKED_PARTS = new Set([".git", "node_modules", ".next", ".env", ".firebase"]);
const SECRET_NAME = /(^|\/)(\.env($|\.)|.*\.(pem|key|p12|pfx)$|service-account.*\.json$|.*secret.*)/i;

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}
function result(id, text, isError = false) {
  send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) } });
}
function error(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}
function tool(name, description, properties = {}, required = []) {
  return { name, description, inputSchema: { type: "object", properties, required, additionalProperties: false } };
}
const TOOLS = [
  tool("crm_repo_status", "Read-only Git status, branch and HEAD for the configured CRM-Hoa-ROVII working copy."),
  tool("crm_read_file", "Read a bounded UTF-8 text file inside the configured repository. Secrets, dependencies, build output and paths outside the repository are blocked.", { path: { type: "string", description: "Repository-relative file path" } }, ["path"]),
  tool("crm_get_diff", "Read-only Git diff for the configured working copy; returns at most 40 KB.", { staged: { type: "boolean", description: "Read staged diff instead of unstaged diff" } }),
  tool("crm_run_check", "Run one allowlisted npm check only: lint, typecheck, build, or emulator-tests. No arbitrary shell commands, installs, deploys, commits, pushes, or merges.", { check: { type: "string", enum: [...ALLOWED_CHECKS] } }, ["check"])
];

async function getRoot() {
  const configured = process.env.CRM_HOA_ROVII_ROOT;
  if (!configured) throw new Error("Set CRM_HOA_ROVII_ROOT to the absolute path of your CRM-Hoa-ROVII clone.");
  const root = await realpath(configured);
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  if (packageJson.name !== "crm-hoa-rovii") throw new Error("Configured path is not the CRM-Hoa-ROVII repository (package.json name mismatch).");
  const git = await run(root, "git", ["rev-parse", "--show-toplevel"], 5000);
  if (path.resolve(git.stdout.trim()) !== root) throw new Error("Configured directory is not the Git repository root.");
  return root;
}

function run(cwd, command, args, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
    let stdout = "", stderr = "", overflow = false, settled = false;
    const append = (target, chunk) => {
      const value = chunk.toString();
      if (target === "stdout") stdout = (stdout + value).slice(-MAX_OUTPUT_CHARS);
      else stderr = (stderr + value).slice(-MAX_OUTPUT_CHARS);
      if (stdout.length + stderr.length >= MAX_OUTPUT_CHARS) overflow = true;
    };
    child.stdout.on("data", chunk => append("stdout", chunk));
    child.stderr.on("data", chunk => append("stderr", chunk));
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.on("error", err => { if (!settled) { settled = true; clearTimeout(timer); reject(err); } });
    child.on("close", code => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr, overflow, timedOut: code === null });
    });
  });
}

async function handleTool(name, args) {
  const root = await getRoot();
  if (name === "crm_repo_status") {
    const [status, branch, head] = await Promise.all([
      run(root, "git", ["status", "--short", "--branch"]),
      run(root, "git", ["branch", "--show-current"]),
      run(root, "git", ["rev-parse", "HEAD"])
    ]);
    return JSON.stringify({ root, branch: branch.stdout.trim(), head: head.stdout.trim(), status: status.stdout.trim(), readOnly: true }, null, 2);
  }
  if (name === "crm_read_file") {
    if (typeof args.path !== "string" || !args.path.trim()) throw new Error("path must be a non-empty repository-relative path.");
    const normalized = args.path.replaceAll("\\", "/");
    const segments = normalized.split("/");
    if (path.isAbsolute(normalized) || segments.some(p => p === ".." || BLOCKED_PARTS.has(p)) || SECRET_NAME.test(normalized)) {
      throw new Error("Blocked path: use a safe repository-relative source/document path.");
    }
    const target = await realpath(path.resolve(root, normalized));
    if (target !== root && !target.startsWith(root + path.sep)) throw new Error("Path resolves outside the repository.");
    const info = await stat(target);
    if (!info.isFile()) throw new Error("Only regular files can be read.");
    if (info.size > MAX_FILE_BYTES) throw new Error("File exceeds the 128 KB read limit.");
    const content = await readFile(target, "utf8");
    return JSON.stringify({ path: normalized, bytes: info.size, content }, null, 2);
  }
  if (name === "crm_get_diff") {
    const staged = args.staged === true;
    const diff = await run(root, "git", staged ? ["diff", "--cached", "--no-ext-diff", "--unified=3"] : ["diff", "--no-ext-diff", "--unified=3"]);
    const output = diff.stdout || "(no diff)";
    return JSON.stringify({ staged, exitCode: diff.code, truncated: diff.overflow, diff: output.slice(-MAX_OUTPUT_CHARS) }, null, 2);
  }
  if (name === "crm_run_check") {
    if (!ALLOWED_CHECKS.has(args.check)) throw new Error("Unsupported check. Allowed: lint, typecheck, build, emulator-tests.");
    const script = { lint: "lint", typecheck: "typecheck", build: "build", "emulator-tests": "test:emulator" }[args.check];
    const timeout = args.check === "build" || args.check === "emulator-tests" ? 10 * 60_000 : 3 * 60_000;
    const output = await run(root, "npm", ["run", script], timeout);
    return JSON.stringify({ check: args.check, exitCode: output.code, timedOut: output.timedOut, outputTruncated: output.overflow, stdout: output.stdout, stderr: output.stderr }, null, 2);
  }
  throw new Error("Unknown tool.");
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", async line => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") return;
  if (message.method === "notifications/initialized" || message.method === "notifications/cancelled") return;
  if (message.method === "initialize") {
    send({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: "crm-hoa-rovii-local", version: "1.0.0" }, instructions: "Read-only repository inspection plus four allowlisted quality checks. No arbitrary command execution or deployment." } });
    return;
  }
  if (message.method === "ping") { send({ jsonrpc: "2.0", id: message.id, result: {} }); return; }
  if (message.method === "tools/list") { send({ jsonrpc: "2.0", id: message.id, result: { tools: TOOLS } }); return; }
  if (message.method === "tools/call") {
    const name = message.params?.name, args = message.params?.arguments ?? {};
    try {
      const output = await handleTool(name, args);
      result(message.id, output);
    } catch (err) {
      result(message.id, String(err?.message || err), true);
    }
    return;
  }
  if (message.id !== undefined) error(message.id, -32601, "Method not found.");
});
