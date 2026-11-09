// The world report (docs/measurements/README.md): 24 worlds × 1,000 years, split into shards
// that run side by side. Usage:
//   npm run report -- tuning                 measure the tuning set, save it, print a summary
//   npm run report -- validation             the same for the validation set (never tuned on)
//   npm run report -- tuning --shards 4      fewer shards on a smaller computer
//   npm run report -- show <file> [<before>]  print a saved report, or compare it with an earlier one
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);

if (args[0] === "show") {
  const after = JSON.parse(readFileSync(args[1], "utf8"));
  const before = args[2] ? JSON.parse(readFileSync(args[2], "utf8")) : null;
  printSummary(after, before);
} else {
  const set = args[0] ?? "tuning";
  if (!["tuning", "validation"].includes(set)) throw new Error("Use tuning, validation or show.");
  const shardsAt = args.indexOf("--shards");
  const shards = shardsAt >= 0 ? Number(args[shardsAt + 1]) : 6;
  const started = Date.now();
  const rows = (await Promise.all(Array.from({ length: shards }, (_, i) => runShard(set, i, shards)))).flat();
  rows.sort((a, b) => a.seed.localeCompare(b.seed, "en", { numeric: true }));
  const date = new Date().toISOString().slice(0, 10);
  const report = { set, date, years: 1000, minutes: Math.round((Date.now() - started) / 60000), rows };
  const file = `docs/measurements/world-${set}-${date}.json`;
  writeFileSync(new URL(`../${file}`, import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(`Saved ${file} (${rows.length} worlds, ${report.minutes} min).`);
  printSummary(report, null);
}

/** Runs one shard of the set's worlds and returns its rows. */
function runShard(set, shard, shards) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/worldReport.test.ts"], {
      cwd: root,
      env: { ...process.env, WORLD_REPORT: set, WORLD_SHARD: `${shard}/${shards}` },
    });
    let out = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (out += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const rows = out.split("\n").filter((line) => line.includes("WORLD_ROW ")).map((line) => JSON.parse(line.slice(line.indexOf("{"))));
      if (code !== 0) reject(new Error(`Shard ${shard} failed:\n${out.slice(-2000)}`));
      else resolve(rows);
    });
  });
}

/** Mean and range of each measure, for each kind of world (and all of them). */
function printSummary(report, before) {
  const groups = { all: () => true, small: (r) => r.kind === "small", full: (r) => r.kind === "full", open: (r) => r.kind === "open" };
  const keys = Object.keys(report.rows[0]).filter((k) => typeof report.rows[0][k] === "number");
  const mean = (rows, key) => rows.reduce((a, r) => a + r[key], 0) / Math.max(1, rows.length);
  const fmt = (x) => (Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2));
  console.log(`\n${report.set} set, ${report.rows.length} worlds × ${report.years} years (${report.date})`);
  console.log(["measure".padEnd(28), ...Object.keys(groups).map((g) => g.padStart(before ? 18 : 10))].join(""));
  for (const key of keys) {
    const cells = Object.values(groups).map((keep) => {
      const now = mean(report.rows.filter(keep), key);
      if (!before) return fmt(now).padStart(10);
      const was = mean(before.rows.filter(keep), key);
      return `${fmt(was)} → ${fmt(now)}`.padStart(18);
    });
    console.log([key.padEnd(28), ...cells].join(""));
  }
}
