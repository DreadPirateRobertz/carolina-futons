/**
 * cf-9fqc (Phase 2 of cf-4tqw) — TDD test suite for scripts/ops/dashboard.sh
 *
 * Tests are written BEFORE the script body per the 2026-05-15 TDD discipline
 * standing order. Each test pins one of the 5 contracts from
 * docs/ops/observability-dashboard-spec.md § "Implementation contract".
 *
 * The script is invoked as a shell subprocess (it's a bash script that calls
 * curl + python3 helpers). We capture stdout, stderr, exit code, and the
 * generated Markdown file, and assert against the contract.
 *
 * Some tests are SKIPPED until Stilgar provisions the live credentials
 * (UPTIMEROBOT_API_KEY, SENTRY_AUTH_TOKEN). The skipped tests pin contracts
 * that depend on live API calls; they un-skip automatically once the env
 * vars exist (no further test edits needed when Stilgar's keys land).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SCRIPT = "scripts/ops/dashboard.sh";

// Test mode: when DASHBOARD_TEST_MODE=fixtures the script reads canned
// JSON responses from $DASHBOARD_TEST_FIXTURES_DIR instead of hitting the
// real APIs. Lets the test suite run deterministically in CI without
// network or live tokens.

let tmpDir;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "dashboard-test-"));
});

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

/**
 * Run the dashboard script with fixture-mode env and return
 * { stdout, stderr, exitCode, outputDocPath }.
 *
 * `fixtures` is an object mapping data-source name → JSON the script
 * should see. The helper writes each as a file under tmpDir and points
 * the script at the directory via DASHBOARD_TEST_FIXTURES_DIR.
 *
 * Exit code is captured even on non-zero (Contract 2 requires us to assert
 * across the 0/1/2/3 range), so we never throw on non-zero exit.
 */
async function runDashboard(fixtures = {}, extraEnv = {}) {
  const fixtureDir = join(tmpDir, "fixtures");
  await mkdir(fixtureDir, { recursive: true });
  for (const [key, body] of Object.entries(fixtures)) {
    await writeFile(join(fixtureDir, `${key}.json`), JSON.stringify(body));
  }
  const outFile = join(tmpDir, "snapshot.md");
  const env = {
    ...process.env,
    DASHBOARD_TEST_MODE: "fixtures",
    DASHBOARD_TEST_FIXTURES_DIR: fixtureDir,
    DASHBOARD_OUTPUT_FILE: outFile,
    ...extraEnv,
  };
  try {
    const { stdout, stderr } = await execFileAsync("bash", [SCRIPT], { env });
    return { stdout, stderr, exitCode: 0, outputDocPath: outFile };
  } catch (err) {
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.code ?? 1,
      outputDocPath: outFile,
    };
  }
}

// ─── Contract 1: stdout = YAML summary, file = full doc ─────────────────

describe("Contract 1 — output split", () => {
  it("writes the YAML summary block to stdout (machine-readable)", async () => {
    const { stdout } = await runDashboard(greenFixtures());
    expect(stdout).toContain("# OPS-DASHBOARD-V1");
    expect(stdout).toContain("overall:");
    expect(stdout).toContain("generated_at:");
  });

  it("writes the full Markdown doc to DASHBOARD_OUTPUT_FILE (human-readable)", async () => {
    const { outputDocPath } = await runDashboard(greenFixtures());
    const body = await readFile(outputDocPath, "utf8");
    expect(body).toMatch(/^# Production Dashboard/m);
    expect(body).toContain("## Headline scorecard");
    expect(body).toContain("## Full breakdown");
  });

  it("stdout does NOT contain the full Markdown body (avoids chat-paste-clobbering)", async () => {
    const { stdout } = await runDashboard(greenFixtures());
    expect(stdout).not.toContain("# Production Dashboard");
    expect(stdout).not.toContain("## Headline scorecard");
  });
});

// ─── Contract 2: exit codes 0 / 1 / 2 / 3 ────────────────────────────────

describe("Contract 2 — exit codes per overall verdict", () => {
  it("exits 0 when every cell is GREEN", async () => {
    const { exitCode } = await runDashboard(greenFixtures());
    expect(exitCode).toBe(0);
  });

  it("exits 1 when at least one cell is YELLOW and none are RED", async () => {
    const { exitCode } = await runDashboard(yellowFixtures());
    expect(exitCode).toBe(1);
  });

  it("exits 2 when at least one cell is RED", async () => {
    const { exitCode } = await runDashboard(redFixtures());
    expect(exitCode).toBe(2);
  });

  it("exits 3 when at least one data source is unreachable", async () => {
    // Omit a required fixture — script sees missing input → INCOMPLETE.
    const fixtures = greenFixtures();
    delete fixtures.health;
    const { exitCode } = await runDashboard(fixtures);
    expect(exitCode).toBe(3);
  });
});

// ─── Contract 3: degraded operation ─────────────────────────────────────

describe("Contract 3 — degraded operation when a source is unreachable", () => {
  it("renders the unreachable cell as ❔ with a reason and still emits the rest", async () => {
    const fixtures = greenFixtures();
    delete fixtures.sentry;
    const { outputDocPath } = await runDashboard(fixtures);
    const body = await readFile(outputDocPath, "utf8");
    expect(body).toContain("❔");
    expect(body).toMatch(/sentry.*unreachable/i);
    // Vercel + UptimeRobot + health cells must still render.
    expect(body).toMatch(/vercel/i);
    expect(body).toMatch(/uptimerobot/i);
    expect(body).toMatch(/api\/health/i);
  });

  it("downgrades OVERALL to YELLOW (not RED) when a source is merely unreachable", async () => {
    const fixtures = greenFixtures();
    delete fixtures.sentry;
    const { stdout } = await runDashboard(fixtures);
    expect(stdout).toMatch(/overall:\s*(YELLOW|INCOMPLETE)/);
    expect(stdout).not.toMatch(/overall:\s*RED/);
  });
});

// ─── Contract 4: no PII or secrets in output ────────────────────────────

describe("Contract 4 — no PII or secrets in output", () => {
  it("strips email-shaped strings from cell rendering", async () => {
    const fixtures = greenFixtures();
    fixtures.sentry.issues[0].culprit = "user@example.com triggered handler";
    const { outputDocPath } = await runDashboard(fixtures);
    const body = await readFile(outputDocPath, "utf8");
    expect(body).not.toContain("user@example.com");
  });

  it("never prints any *_API_KEY or *_TOKEN env value", async () => {
    const { outputDocPath, stdout } = await runDashboard(greenFixtures(), {
      UPTIMEROBOT_API_KEY: "fake-key-cf-9fqc-test-must-not-leak",
      SENTRY_AUTH_TOKEN: "fake-token-cf-9fqc-test-must-not-leak",
    });
    const body = await readFile(outputDocPath, "utf8");
    expect(body).not.toContain("fake-key-cf-9fqc-test-must-not-leak");
    expect(body).not.toContain("fake-token-cf-9fqc-test-must-not-leak");
    expect(stdout).not.toContain("fake-key-cf-9fqc-test-must-not-leak");
    expect(stdout).not.toContain("fake-token-cf-9fqc-test-must-not-leak");
  });
});

// ─── Contract 5: re-runnable without state ──────────────────────────────

describe("Contract 5 — re-runnable without local state", () => {
  it("produces identical output (modulo timestamp) on two back-to-back runs with the same fixtures", async () => {
    const fx = greenFixtures();
    const run1 = await runDashboard(fx);
    const run2 = await runDashboard(fx);
    const strip = (s) => s.replace(/generated_at: [^\s]+/g, "generated_at: <T>");
    expect(strip(run1.stdout)).toBe(strip(run2.stdout));
  });

  it("does NOT write any cache file outside DASHBOARD_OUTPUT_FILE", async () => {
    const before = (await readdir("scripts/ops/")).sort();
    await runDashboard(greenFixtures());
    const after = (await readdir("scripts/ops/")).sort();
    expect(after).toEqual(before);
  });
});

// ─── Live-API tests (SKIPPED until Stilgar provisions tokens) ───────────

describe("Live-API integration (auto-skips without Stilgar tokens)", () => {
  const hasUptimeRobot = !!process.env.UPTIMEROBOT_API_KEY;
  const hasSentry = !!process.env.SENTRY_AUTH_TOKEN;

  it.skipIf(!hasUptimeRobot)(
    "fetches at least one active monitor from UptimeRobot live API",
    async () => {
      const { stdout } = await runDashboard({}, { DASHBOARD_TEST_MODE: "live" });
      expect(stdout).toMatch(/monitors_active_count:\s*[1-9]/);
    },
  );

  it.skipIf(!hasSentry)(
    "fetches issues page from Sentry live API",
    async () => {
      const { stdout } = await runDashboard({}, { DASHBOARD_TEST_MODE: "live" });
      expect(stdout).toMatch(/error_rate_per_min:/);
    },
  );
});

// ─── cf-wv1s: realistic-API-shape fixture tests for UR + Sentry parse ─────
//
// The greenFixtures() shape was deliberately minimal. The real UR API
// response uses `custom_uptime_ratios` (with `s`, returning a string of
// comma-separated period uptimes). The real Sentry issues response is a
// flat array of issues with `count` (string) + `firstSeen` / `lastSeen`
// per issue + no top-level errorRatePerMin field. These cases pin the
// parse logic against the actual API shapes so the live-mode wire-up
// doesn't silently misclassify.

describe("cf-wv1s — realistic UR + Sentry API shapes parse correctly", () => {
  it("parses UptimeRobot custom_uptime_ratio (singular form) — current fixture path", async () => {
    const fx = greenFixtures();
    // Current parse code uses `custom_uptime_ratio` (singular). Live
    // API returns `custom_uptime_ratios` (plural, comma-list). Cell
    // must tolerate both — singular = single 24h ratio, plural =
    // first value in comma-list.
    fx.uptimeRobot.monitors = [
      { id: 1, status: 2, friendly_name: "/", custom_uptime_ratio: "99.95" },
    ];
    const { exitCode } = await runDashboard(fx);
    expect(exitCode).toBe(0);
  });

  it("parses UptimeRobot custom_uptime_ratios plural — live API shape", async () => {
    // Live response shape uses the plural field name + comma-separated
    // string of uptime ratios for the requested periods. With
    // ?custom_uptime_ratios=24 you get a single value but as a string.
    const fx = greenFixtures();
    fx.uptimeRobot.monitors = [
      {
        id: 1,
        status: 2,
        friendly_name: "/",
        custom_uptime_ratios: "99.95",  // single-period response
      },
      {
        id: 2,
        status: 2,
        friendly_name: "/api/health",
        custom_uptime_ratios: "99.99",
      },
    ];
    const { stdout, exitCode } = await runDashboard(fx);
    expect(exitCode).toBe(0);
    // Both ratios should be parsed; min should be 99.95
    expect(stdout).toMatch(/uptimeRobot_uptime_24h_min:\s*99\.95/);
  });

  it("computes Sentry error_rate_per_min from issues[].count when no top-level field", async () => {
    // Live Sentry response has no `errorRatePerMin` field; cell must
    // derive it from sum(issues[].count) / minutes-in-window. With a
    // 24h statsPeriod, minutes = 1440.
    //
    // Fixture uses level=warning to isolate the rate-calc contract
    // from the unresolved-P0/P1 verdict contract. The verdict path is
    // pinned separately by the next test.
    const fx = greenFixtures();
    fx.sentry = {
      issues: [
        { id: "s1", count: "120", level: "warning", firstSeen: "2026-05-15T00:00:00Z" },
        { id: "s2", count: "30", level: "warning", firstSeen: "2026-05-15T01:00:00Z" },
      ],
      // No top-level errorRatePerMin — cell must compute.
    };
    const { exitCode, stdout } = await runDashboard(fx);
    // 120+30 = 150 events / 1440 min = ~0.104/min → GREEN threshold (<0.5);
    // 0 unresolved error/fatal → unresolved=0 → GREEN
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/sentry_error_rate_per_min:\s*0\./);
  });

  it("Sentry unresolved P0/P1 count uses level field as primary signal", async () => {
    // Verify the bucketing logic — only level in {error, fatal} counts.
    const fx = greenFixtures();
    fx.sentry = {
      issues: [
        { id: "s1", count: "1", level: "error" },
        { id: "s2", count: "1", level: "fatal" },
        { id: "s3", count: "1", level: "warning" },
        { id: "s4", count: "1", level: "info" },
      ],
      errorRatePerMin: 0.1,  // explicit, override compute path
    };
    const { stdout } = await runDashboard(fx);
    // 2 error+fatal → unresolved_p0p1_count=2 → YELLOW per spec
    expect(stdout).toMatch(/sentry_unresolved_p0p1_count:\s*2/);
  });
});

// ─── Fixtures ───────────────────────────────────────────────────────────

function greenFixtures() {
  return {
    vercel: {
      deployments: [
        {
          uid: "dpl_green1",
          state: "READY",
          target: "production",
          created: Date.now() - 5 * 60 * 1000,
          meta: { githubCommitSha: "abc1234", githubCommitMessage: "feat: ok" },
        },
      ],
    },
    uptimeRobot: {
      monitors: [
        { id: 1, status: 2, friendly_name: "/", custom_uptime_ratio: "99.97" },
        { id: 2, status: 2, friendly_name: "/api/health", custom_uptime_ratio: "99.99" },
      ],
    },
    sentry: {
      issues: [{ id: "s1", count: "3", level: "warning", culprit: "ok" }],
      errorRatePerMin: 0.2,
    },
    health: { status: "ok", timestamp: new Date().toISOString(), version: "abc1234" },
  };
}

function yellowFixtures() {
  const fx = greenFixtures();
  fx.sentry.errorRatePerMin = 2; // 0.5 < x < 5 → YELLOW per spec
  return fx;
}

function redFixtures() {
  const fx = greenFixtures();
  fx.sentry.errorRatePerMin = 12; // ≥ 5 → RED per spec
  return fx;
}
