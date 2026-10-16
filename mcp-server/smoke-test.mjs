import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const child = spawn(process.execPath, [path.join(here, "server.mjs")], {
  cwd: root,
  env: { ...process.env, CRM_HOA_ROVII_ROOT: root },
  stdio: ["pipe", "pipe", "pipe"]
});
let buffer = "";
const pending = new Map();
let nextId = 1;
child.stdout.setEncoding("utf8");
child.stdout.on("data", chunk => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message); pending.delete(message.id);
    }
  }
});
const stderr = [];
child.stderr.setEncoding("utf8");
child.stderr.on("data", chunk => stderr.push(chunk));
function request(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("Timed out waiting for " + method)); }, 5000);
    pending.set(id, message => { clearTimeout(timer); resolve(message); });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
try {
  const init = await request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke-test", version: "1.0" } });
  if (init.error || init.result?.serverInfo?.name !== "crm-hoa-rovii-local") throw new Error("MCP initialize failed: " + JSON.stringify(init));
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  const listed = await request("tools/list");
  const names = listed.result?.tools?.map(t => t.name) ?? [];
  for (const name of ["crm_repo_status", "crm_read_file", "crm_get_diff", "crm_run_check"]) if (!names.includes(name)) throw new Error("Missing MCP tool: " + name);
  const status = await request("tools/call", { name: "crm_repo_status", arguments: {} });
  if (status.result?.isError) throw new Error("Status tool failed: " + JSON.stringify(status));
  const parsed = JSON.parse(status.result.content[0].text);
  if (parsed.head.length !== 40 || !parsed.root.endsWith("CRM-Hoa-ROVII")) throw new Error("Status tool returned unexpected repository: " + JSON.stringify(parsed));
  const blocked = await request("tools/call", { name: "crm_read_file", arguments: { path: "../package.json" } });
  if (!blocked.result?.isError) throw new Error("Path traversal was not blocked.");
  const badCommand = await request("tools/call", { name: "crm_run_check", arguments: { check: "deploy" } });
  if (!badCommand.result?.isError) throw new Error("Non-allowlisted command was not blocked.");
  console.log("MCP smoke test PASS: initialize, tools/list, repo status, path traversal guard, command allowlist.");
} finally {
  child.kill("SIGTERM");
}
if (stderr.length) process.stderr.write(stderr.join(""));
