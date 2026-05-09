#!/usr/bin/env node
/**
 * ratchet-coverage.mjs — raise vitest coverage thresholds to current floor.
 *
 * Reads coverage/coverage-summary.json (produced by vitest v8 with the
 * `json-summary` reporter — already enabled in vitest.config.js), compares
 * each metric against the corresponding threshold in vitest.config.js, and
 * if the measured value's integer floor is higher than the configured
 * threshold, rewrites the threshold to the new floor. Never lowers a
 * threshold.
 *
 * Mirrors carolina-futons-web/scripts/ratchet-coverage.mjs (PR #470). The
 * only meaningful difference is the config filename — vitest.config.js
 * here vs vitest.config.ts on cfutons-web — which we resolve at runtime.
 *
 * Exit codes:
 *   0 — script ran successfully (vitest.config updated or up-to-date)
 *   2 — coverage summary missing or unparseable
 *   3 — vitest.config thresholds block missing or unparseable
 *
 * Side outputs:
 *   - vitest.config.* modified in place when ratchet applies
 *   - JSON summary on stdout: {changed, before, after, actual}
 *   - GITHUB_OUTPUT (when set): `changed=true|false` for workflow gating
 *
 * Run manually:
 *   npx vitest run --coverage
 *   node scripts/ratchet-coverage.mjs
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const summaryPath = resolve(repoRoot, "coverage/coverage-summary.json");

const CONFIG_CANDIDATES = ["vitest.config.js", "vitest.config.ts", "vitest.config.mjs"];
const configPath = CONFIG_CANDIDATES.map((f) => resolve(repoRoot, f)).find(existsSync);

const METRICS = ["statements", "branches", "functions", "lines"];

function die(code, msg) {
  console.error(`ratchet-coverage: ${msg}`);
  process.exit(code);
}

if (!configPath) {
  die(3, `no vitest.config.{js,ts,mjs} found in ${repoRoot}`);
}

if (!existsSync(summaryPath)) {
  die(
    2,
    `${summaryPath} missing — run vitest with --coverage first (json-summary reporter must be enabled in vitest.config)`,
  );
}

const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
const total = summary.total;
if (!total) die(2, "coverage-summary.json has no .total");

const actual = Object.fromEntries(
  METRICS.map((m) => [m, total[m]?.pct]).filter(([, v]) => typeof v === "number"),
);
if (Object.keys(actual).length !== METRICS.length) {
  die(2, `coverage-summary.json missing pct for one of: ${METRICS.join(", ")}`);
}

let configSrc = readFileSync(configPath, "utf8");

// Match the thresholds object literal inside vitest.config. Uses non-greedy
// match so we stop at the inner closing brace, not the outer `coverage: { … }`
// closer. Single-line and multi-line bodies both work.
const thresholdsMatch = configSrc.match(/thresholds:\s*\{([\s\S]*?)\}/);
if (!thresholdsMatch) {
  die(3, `${configPath} has no thresholds: { ... } block`);
}
const thresholdsBlock = thresholdsMatch[1];

const before = {};
for (const m of METRICS) {
  const re = new RegExp(`${m}:\\s*(\\d+)`);
  const found = thresholdsBlock.match(re);
  if (!found) die(3, `thresholds block missing ${m}: <number>`);
  before[m] = Number(found[1]);
}

// Floor of measured % — never overshoot. e.g. 91.42% → 91. If new floor is
// strictly greater than current threshold, ratchet to new floor.
const after = { ...before };
for (const m of METRICS) {
  const newFloor = Math.floor(actual[m]);
  if (newFloor > before[m]) after[m] = newFloor;
}

const changed = METRICS.some((m) => after[m] !== before[m]);

if (changed) {
  let newBlock = thresholdsBlock;
  for (const m of METRICS) {
    if (after[m] !== before[m]) {
      newBlock = newBlock.replace(
        new RegExp(`(${m}:\\s*)(\\d+)`),
        `$1${after[m]}`,
      );
    }
  }
  const newConfig = configSrc.replace(thresholdsBlock, newBlock);
  writeFileSync(configPath, newConfig);
}

const result = { changed, before, after, actual, configPath: configPath.replace(repoRoot + "/", "") };
console.log(JSON.stringify(result, null, 2));

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `summary=${Buffer.from(JSON.stringify(result)).toString("base64")}\n`,
  );
}
