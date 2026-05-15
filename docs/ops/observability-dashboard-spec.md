# Observability Dashboard — Spec

**Bead:** cf-4tqw (Phase 1 — spec)
**Author:** millicent (cfutons/crew, CI/devops lane)
**Roadmap context:** Week 1-2 of the 6-week observability + email + security plan (Stilgar directive 2026-05-15)
**Metric target:** Time-to-detect (TTD) for production outages — < 5 min for 5xx spikes, < 2 min for full outage

## Purpose

A **single-page production status doc**, regenerable on demand, that replaces "where do we look right now?" Slack-style chats. Any agent runs one command and gets a fresh snapshot: deploys, uptime, errors, health-check pulse, alarms worth chasing.

Replaces the **manual** flow we run today:

1. open Vercel dashboard
2. open UptimeRobot dashboard
3. open Sentry
4. `curl /api/health`
5. mentally reconcile

…with the **scripted** flow:

```sh
bash scripts/ops/dashboard.sh > docs/ops/dashboard-$(date -u +%Y%m%d-%H%M).md
```

…producing a deterministic snapshot file the operator pastes into chat / files away as an incident artifact.

## Scope

**In scope (Phase 1, this PR):** the spec contract — what the data sources are, what each cell of the dashboard shows, what thresholds turn cells red, and how the script will assemble the doc.

**Out of scope (Phase 2, follow-up bead):** the actual script. Blocked on Stilgar gates (UptimeRobot API key, Sentry production connection). When those land, Phase 2 implements per this spec; tests are written against the spec contracts here.

**Permanently out of scope:** real-time push monitoring (UptimeRobot + Sentry already do that; this dashboard is the **pull** consolidation layer for human-readable spot-checks and incident write-ups).

## Data sources

### 1. Vercel deployments

**Endpoint:** `GET https://api.vercel.com/v6/deployments?projectId=prj_ED7giE4Ez7dKAgZjfMKze90M612R&teamId=team_WYNf264wCFjPfeUdTpci07wO&limit=10`

**Auth:** Vercel CLI token at `~/Library/Application Support/com.vercel.cli/auth.json` (already present per cf-3qt.8.32 audit). Header: `Authorization: Bearer $TOKEN`.

**Used for:**
- Last 5 **production** deploys (filter `target=production`) with `state`, `meta.githubCommitSha`, `meta.githubCommitMessage`
- Last 5 **preview** deploys (cf-ukc6 build-burn snapshot for the same window)
- **Failed deploys in last 24 h** (filter `state=ERROR`): red flag if non-zero

**Cells produced:**

| Cell | Source | Threshold |
|---|---|---|
| `latest_production_state` | last `target=production` entry | `READY` = ✅; `ERROR` / `CANCELED` = 🔴 |
| `latest_production_age_min` | `now() - latest.created` | < 60 min = green; 1-24 h = yellow; > 24 h = informational |
| `production_deploys_24h_count` | count of production deploys in window | ≥ 1 = normal; 0 + business hours = ⚠️ stale |
| `failed_deploys_24h_count` | filter `state=ERROR` | 0 = ✅; 1-2 = ⚠️; 3+ = 🔴 |
| `preview_deploys_24h_count` | filter `target=preview` | informational; cf-ukc6 build-conservation signal |

### 2. UptimeRobot

**Endpoint:** `POST https://api.uptimerobot.com/v2/getMonitors` (form-encoded, `api_key=$UPTIMEROBOT_API_KEY&format=json&response_times=1&response_times_average=60`)

**Auth:** `UPTIMEROBOT_API_KEY` env var. **Blocks on Stilgar** (cf-3qt.8.31 — godfrey hooked, waiting on key delivery).

**Used for:**
- Per-monitor 24 h uptime % (the headline numbers Stilgar reads at T+24h cutover-verdict)
- Per-monitor mean response time (60-min rolling avg)
- Recent-incident list (most recent down-events per monitor)

**Monitor inventory** (per the cf-3qt.8.31 setup script): `/`, `/shop/futon-frames`, `/products/kingston-futon-frame`, `/contact`, `/api/health`, plus reserved slots for cart + checkout once Wix Headless API endpoints are public.

**Cells produced:**

| Cell | Source | Threshold |
|---|---|---|
| `uptime_24h_min` | min(monitor.uptime_24h) | ≥ 99.9 % = ✅; 99 – 99.9 % = ⚠️; < 99 % = 🔴 |
| `incidents_24h_count` | sum(monitor.recent_incidents in 24h) | 0 = ✅; 1-2 = ⚠️; 3+ = 🔴 |
| `mean_response_ms` | avg(monitor.response_time) | < 800 ms = ✅; 800-2000 ms = ⚠️; > 2000 ms = 🔴 |
| `monitors_active_count` | count(monitor.status == 2) | ≥ 5 = ✅; < 5 = 🔴 (setup drift) |

### 3. Sentry

**Endpoint:** `GET https://sentry.io/api/0/projects/{org}/{project}/issues/?statsPeriod=24h&query=is:unresolved level:error`

**Auth:** `SENTRY_AUTH_TOKEN` env var. **Blocks on Stilgar** (production Sentry connection unverified per cf-3qt.8.34 go/no-go gate).

**Used for:**
- Unresolved error-level + fatal-level events in last 24 h
- Top 5 issues by event count
- New issues (first seen < 24 h ago)

**Cells produced:**

| Cell | Source | Threshold |
|---|---|---|
| `error_rate_per_min` | events/min, last 24 h | < 0.5/min = ✅; 0.5-5/min = ⚠️; ≥ 5/min = 🔴 (matches `cutover-verification-matrix.md` table) |
| `unresolved_p0p1_count` | count(issues with level ∈ {fatal, error}) | 0 = ✅; 1-3 = ⚠️; 4+ = 🔴 |
| `new_issues_24h` | issues with `firstSeen` < 24 h | 0-1 = normal; 2+ = ⚠️ regression-hunt |

### 4. `/api/health`

**Endpoint:** `GET https://www.carolinafutons.com/api/health`

**Auth:** none. Public liveness endpoint shipped in PR #554 (cf-x6ph). Currently returning `{"status":"ok","timestamp":"...","version":"<sha>"}`.

**Used for:**
- Cold-cycle response time (single curl from the operator's machine — different signal than UptimeRobot's polled-from-region timings)
- Build SHA vs latest production deploy from §1 (drift indicator)
- Status text echo

**Cells produced:**

| Cell | Source | Threshold |
|---|---|---|
| `health_status` | response body `.status` | `ok` = ✅; anything else = 🔴 |
| `health_response_ms` | `curl -w "%{time_total}"` | < 500 ms = ✅; 500-2000 ms = ⚠️; > 2000 ms = 🔴 |
| `health_version_matches_deploy` | response body `.version` vs §1 `latest_production_sha` | match = ✅; mismatch = ⚠️ (skew protection event) |

## Dashboard rendering — output shape

The dashboard script emits a **Markdown doc** like:

```markdown
# Production Dashboard — 2026-05-15 21:30 UTC

🟢 OVERALL: GREEN. All 4 data sources nominal.

## Headline scorecard

| Source | Status | Notes |
|---|---|---|
| Vercel deploys | 🟢 READY | last prod: cff9a00 20m ago |
| UptimeRobot | 🟢 99.97% | 0 incidents 24h, mean 412 ms |
| Sentry | 🟢 0.2/min | 0 unresolved P0/P1 |
| /api/health | 🟢 200 / 187 ms | version cff9a00 matches deploy |

## Full breakdown

### Vercel (last 5 production deploys)
… (table from §1) …

### UptimeRobot (5 monitors)
… (table from §2) …

### Sentry (top 5 issues last 24h)
… (table from §3) …

### /api/health (live curl)
… (response body + timing) …
```

A trailing **machine-readable summary** at the bottom for chaining:

```yaml
# OPS-DASHBOARD-V1
overall: GREEN
vercel_state: READY
uptime_24h_min: 99.97
error_rate_per_min: 0.2
health_status: ok
generated_at: 2026-05-15T21:30:00Z
```

## Failure-mode mapping (what each red cell means + what to do)

This is the heart of the spec — Phase 2 implementation must wire each cell to one of these failure modes.

| Red cell | Implication | Immediate action |
|---|---|---|
| `latest_production_state ≠ READY` | Most recent prod deploy failed | Check Vercel build log; if recent merge, consider revert |
| `failed_deploys_24h_count ≥ 3` | Sustained deploy failure pattern | Pause the merge wave; investigate first failure |
| `uptime_24h_min < 99%` | Customer-visible outage in last 24 h | Open Sentry / Vercel logs for the down-window; consider DNS rollback (`cutover-verification-matrix.md` ROLLBACK PROCEDURE) |
| `error_rate_per_min ≥ 5` | Spike per `cutover-verification-matrix.md` threshold | Sentry → group by top issue → identify culprit deploy |
| `health_status ≠ ok` | `/api/health` endpoint itself is sick | Production process / routing problem, not just a downstream API |
| `health_version_matches_deploy = false` | Skew protection event | Wait 5 min + recheck; if persistent, redeploy production |
| `monitors_active_count < 5` | UptimeRobot setup drift | Re-run `setup-monitors.sh` (cf-3qt.8.31) |

`OVERALL` cell: 🟢 GREEN if every individual cell ✅ • 🟡 YELLOW if ≥ 1 ⚠️ but no 🔴 • 🔴 RED if any 🔴

## Implementation contract (TDD inputs for Phase 2)

Phase 2 — the script + tests — must satisfy these contracts. Tests should be written **before** the script body.

### Contract 1: script returns the YAML summary on stdout, full doc on file

```sh
$ bash scripts/ops/dashboard.sh > /tmp/snapshot.md
# stdout: the YAML summary block only
# /tmp/snapshot.md: the full Markdown doc
```

### Contract 2: exit code per overall verdict

| Exit | Meaning |
|---|---|
| 0 | GREEN — every cell ✅ |
| 1 | YELLOW — ≥ 1 ⚠️ cell, no 🔴 |
| 2 | RED — ≥ 1 🔴 cell |
| 3 | INCOMPLETE — at least one data source unreachable (auth missing, endpoint down) |

### Contract 3: degraded operation

If a data source is unreachable (UptimeRobot API down, Sentry token expired), the cell renders as `❔ unreachable: <reason>` and the **rest of the dashboard still produces**. Overall verdict downgrades to YELLOW at worst (we don't go RED on infra-of-infra failure).

### Contract 4: no PII or secrets in the output

Output file is committed alongside cf-3qt.8 artifacts during incidents. No env-var dumps, no API tokens, no customer emails in any cell.

### Contract 5: re-runnable without state

The script reads from APIs every run. No local state, no cache file (operator can compare two snapshots manually). Idempotent.

## Auth surface — secrets needed

| Secret | Where read | Source-of-truth | Block status |
|---|---|---|---|
| Vercel token | `~/Library/Application Support/com.vercel.cli/auth.json` | Already present (cf-3qt.8.32) | ✅ unblocked |
| `UPTIMEROBOT_API_KEY` | env var | **Stilgar provisioning** | 🔴 blocked (cf-3qt.8.31 prereq) |
| `SENTRY_AUTH_TOKEN` | env var | **Stilgar provisioning** | 🔴 blocked (cf-3qt.8.34 go/no-go gate item) |

When Phase 2 ships, **both Sentry + UptimeRobot tokens MUST also be set as GitHub Actions secrets** if the dashboard is wired into a cron workflow.

## Cron cadence (Phase 2 follow-on, not this PR)

Initial: **manual on-demand** (operator runs the command). No cron workflow yet — observability dashboards run nightly tend to grow ignored.

After 4 weeks of manual use: revisit + decide if a cron makes sense. Likely shape: GitHub Actions on `schedule: "0 */6 * * *"` that runs the dashboard, commits the snapshot to `docs/ops/dashboard-history/` only if `OVERALL` flipped from the previous snapshot. Avoids spam-commits, preserves the actual interesting transitions.

## Phase 2 follow-up bead (to file after this PR lands)

`feat(observability): implement dashboard.sh — Phase 2 of cf-4tqw`

Acceptance:
- Tests-first: 5 test cases pinning the contracts above (one per Contract 1-5)
- Implementation reads from the 4 data sources per §1-4
- Output matches §"Dashboard rendering — output shape" exactly
- Failure-mode mapping per §"Failure-mode mapping" wired

Estimate: 200-300 lines (mostly the curl + jq + python3 wrappers). Half a day's work post-Stilgar-gate-clear.

## Cross-crew dependencies

| Crew | What they need to do | Blocks |
|---|---|---|
| Stilgar | Provide UptimeRobot API key, confirm Sentry project linked to production | Phase 2 implementation |
| godfrey | Finish cf-3qt.8.31 (UptimeRobot setup) | Dashboard data source #2 |
| (none) | Phase 1 spec (this PR) is unblocked | — |

## TDD discipline note

Per the 2026-05-15 standing order, Phase 2 will write tests FIRST against Contracts 1-5 above before the script body. The contracts in this spec are the test inputs.

Phase 1 (this PR) is a doc; the "test" is the 5-agent review establishing that the spec accurately maps the failure-mode landscape and is implementable from the contracts as written.

## References

- Roadmap mail (2026-05-15 to melania, post-Stilgar directive)
- cf-3qt.8.31 (UptimeRobot setup, godfrey)
- cf-3qt.8.32 (Vercel Pro Plus confirmed, PR #1282)
- cf-3qt.8.33 (post-cutover monitoring T+1h/T+4h/T+24h checklist, PR #1289)
- cf-3qt.8.34 (go/no-go gate status snapshot, PR #1295)
- cf-jzux (re-runnable cutover-readiness checker — the immediate sibling of this dashboard, focused on PRE-flip gates; PR #1298)
- cf-x6ph (`/api/health` endpoint, cfw PR #554)
- Mayor 5-agent review standing order, 2026-05-15
