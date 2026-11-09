// Runs the optional campaign report on Windows, macOS and Linux without shell-specific env syntax.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const set = process.argv[2] ?? "tuning";
if (!["tuning", "validation"].includes(set)) throw new Error("Use tuning or validation.");
const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/campaignBalance.test.ts"], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  env: { ...process.env, CAMPAIGN_BALANCE: set },
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
