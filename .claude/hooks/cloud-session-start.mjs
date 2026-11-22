/**
 * SessionStart hook: installs the npm packages in a Claude Code cloud session
 * (claude.ai/code), where the repo is a fresh clone without `node_modules`.
 * Locally it does nothing. See "Cloud sessions" in docs/agents/workflow-notes.md.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

if (process.env.CLAUDE_CODE_REMOTE !== "true") process.exit(0);
if (fs.existsSync(path.join(root, "node_modules", ".package-lock.json"))) process.exit(0);

// npm's output goes to stderr: whatever this hook prints on stdout reaches the model.
const result = spawnSync("npm", ["ci", "--no-audit", "--no-fund"], {
  cwd: root,
  stdio: ["ignore", 2, 2],
});

if (result.status !== 0) {
  console.error("Cloud session: `npm ci` failed. Run it again before starting work.");
  process.exit(1);
}
console.log("Cloud session: npm packages installed with `npm ci`.");
