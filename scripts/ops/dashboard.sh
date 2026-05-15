#!/usr/bin/env bash
# cf-9fqc — observability dashboard (Phase 2 of cf-4tqw).
#
# Single re-runnable production status snapshot. Implements the 5 contracts
# pinned in docs/ops/observability-dashboard-spec.md.
#
# Usage:
#   bash scripts/ops/dashboard.sh > /tmp/snapshot.md
#     stdout = YAML summary block (machine-readable)
#     file   = full Markdown doc, written to $DASHBOARD_OUTPUT_FILE
#              (default: docs/ops/dashboard-<UTC-date>.md)
#
# Modes:
#   DASHBOARD_TEST_MODE=live       hit real APIs (default in production)
#   DASHBOARD_TEST_MODE=fixtures   read canned JSON from
#                                  $DASHBOARD_TEST_FIXTURES_DIR
#                                  (test harness only)
#
# Exit codes (Contract 2):
#   0  GREEN     — every cell ✅
#   1  YELLOW    — ≥ 1 ⚠️ cell, no 🔴
#   2  RED       — ≥ 1 🔴 cell
#   3  INCOMPLETE — at least one required data source unreachable / missing
#
# Auth surface:
#   Vercel token       — read from ~/Library/Application Support/com.vercel.cli/auth.json
#   UPTIMEROBOT_API_KEY — env (optional; cell shows ❔ if absent in live mode)
#   SENTRY_AUTH_TOKEN   — env (optional; cell shows ❔ if absent in live mode)
#
# In test/fixture mode, NO live tokens are read or required.

set -u

MODE="${DASHBOARD_TEST_MODE:-live}"
DEFAULT_OUTPUT="docs/ops/dashboard-$(date -u +%Y%m%d-%H%M).md"
OUTPUT_FILE="${DASHBOARD_OUTPUT_FILE:-$DEFAULT_OUTPUT}"

# All real work lives in this python3 block. It reads inputs (live or
# fixture), classifies each cell, rolls up to OVERALL, then writes the
# YAML summary to stdout and the full Markdown doc to OUTPUT_FILE.
#
# Why python3: bash + jq for this is ~3x the LOC and far harder to test.
# python3 is already required by sibling scripts (verify-dns-ttl.sh,
# capture-order-baseline.mjs uses node but other ops scripts use python3).

python3 - "$MODE" "$OUTPUT_FILE" <<'PYEOF'
import json, os, re, sys, urllib.request, urllib.error
from datetime import datetime, timezone

MODE = sys.argv[1]
OUTPUT_FILE = sys.argv[2]

# ── Status sentinels ────────────────────────────────────────────────
GREEN = "✅"; YELLOW = "⚠️"; RED = "🔴"; UNREACHABLE = "❔"
VERDICTS = {GREEN: "GREEN", YELLOW: "YELLOW", RED: "RED", UNREACHABLE: "INCOMPLETE"}

# ── PII / secret sanitization (Contract 4) ──────────────────────────
# Strip email-shaped strings; redact env-var values matching *_API_KEY
# or *_TOKEN before anything ever lands in the rendered output.
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
SECRET_VALUES = [v for k, v in os.environ.items()
                 if (k.endswith("_API_KEY") or k.endswith("_TOKEN")) and v]

def sanitize(text):
    if text is None:
        return ""
    s = str(text)
    s = EMAIL_RE.sub("<redacted-email>", s)
    for sv in SECRET_VALUES:
        if sv and len(sv) >= 6:
            s = s.replace(sv, "<redacted-secret>")
    return s

# ── Fixture-mode loader ─────────────────────────────────────────────
def load_fixture(name):
    fdir = os.environ.get("DASHBOARD_TEST_FIXTURES_DIR", "")
    if not fdir:
        return None
    path = os.path.join(fdir, f"{name}.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)

# ── Live API helpers (kept minimal — fixture mode covers all tests) ──
def _http_get(url, headers=None, timeout=10):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError):
        return None

# ── Cell: Vercel ────────────────────────────────────────────────────
def cell_vercel():
    if MODE == "fixtures":
        data = load_fixture("vercel")
    else:
        # Live: fetch last 10 deploys via Vercel API.
        # Vercel token is read from the CLI auth.json — same source the
        # other ops scripts use. We do NOT print the token anywhere.
        auth_path = os.path.expanduser(
            "~/Library/Application Support/com.vercel.cli/auth.json")
        token = None
        if os.path.exists(auth_path):
            try:
                token = json.load(open(auth_path)).get("token")
            except (json.JSONDecodeError, OSError):
                token = None
        if not token:
            return _unreachable("vercel", "no CLI token at expected path")
        # Filter target=production at the API so we don't waste the
        # response window on preview deploys (which can crowd out prod
        # deploys in the last-10 in a busy iteration day).
        url = ("https://api.vercel.com/v6/deployments"
               "?projectId=prj_ED7giE4Ez7dKAgZjfMKze90M612R"
               "&teamId=team_WYNf264wCFjPfeUdTpci07wO&target=production"
               "&limit=10")
        data = _http_get(url, {"Authorization": f"Bearer {token}"})

    if data is None:
        return _unreachable("vercel", "no fixture or live response")
    deploys = data.get("deployments", []) or []
    prod = [d for d in deploys if d.get("target") == "production"]
    if not prod:
        return {
            "name": "vercel", "status": YELLOW,
            "summary": "no production deploys in window",
            "fields": {"latest_production_state": "(none)"},
        }
    latest = prod[0]
    state = latest.get("state", "?")
    failed_24h = sum(1 for d in deploys if d.get("state") == "ERROR")
    if state == "READY" and failed_24h == 0:
        status = GREEN
    elif failed_24h >= 3 or state in ("ERROR", "CANCELED"):
        status = RED
    elif failed_24h > 0:
        status = YELLOW
    else:
        status = GREEN
    sha = (latest.get("meta") or {}).get("githubCommitSha", "")[:7]
    msg = sanitize((latest.get("meta") or {}).get("githubCommitMessage", ""))[:60]
    return {
        "name": "vercel", "status": status,
        "summary": f"latest prod: {state} {sha} — {msg}",
        "fields": {
            "latest_production_state": state,
            "latest_production_sha": sha,
            "failed_deploys_24h_count": failed_24h,
            "production_deploys_count": len(prod),
        },
    }

# ── Cell: UptimeRobot ───────────────────────────────────────────────
def cell_uptime_robot():
    if MODE == "fixtures":
        data = load_fixture("uptimeRobot")
    else:
        if not os.environ.get("UPTIMEROBOT_API_KEY"):
            return _unreachable("uptimeRobot", "UPTIMEROBOT_API_KEY not set")
        # Live impl deferred to follow-up commit once Stilgar provisions
        # the key. The skipIf-gated live integration test will exercise
        # the live path when the key lands.
        return _unreachable("uptimeRobot", "live mode pending Stilgar API key + tier decision")

    if data is None:
        return _unreachable("uptimeRobot", "no fixture or live response")
    monitors = data.get("monitors", []) or []
    if not monitors:
        return _unreachable("uptimeRobot", "no monitors configured")
    active = [m for m in monitors if m.get("status") == 2]
    uptimes = [float(m.get("custom_uptime_ratio", 0)) for m in monitors]
    min_uptime = min(uptimes) if uptimes else 0
    if min_uptime >= 99.9 and len(active) == len(monitors):
        status = GREEN
    elif min_uptime < 99 or len(active) < len(monitors):
        status = RED
    else:
        status = YELLOW
    return {
        "name": "uptimeRobot", "status": status,
        "summary": f"{len(active)}/{len(monitors)} active, min uptime 24h = {min_uptime}%",
        "fields": {
            "monitors_active_count": len(active),
            "uptime_24h_min": min_uptime,
        },
    }

# ── Cell: Sentry ────────────────────────────────────────────────────
def cell_sentry():
    if MODE == "fixtures":
        data = load_fixture("sentry")
    else:
        if not os.environ.get("SENTRY_AUTH_TOKEN"):
            return _unreachable("sentry", "SENTRY_AUTH_TOKEN not set")
        # Live impl deferred to follow-up commit (gated on Stilgar
        # Sentry production connection). Live test it.skipIf-gated.
        return _unreachable("sentry", "live mode pending Stilgar Sentry connection")

    if data is None:
        return _unreachable("sentry", "no fixture or live response")
    rate = data.get("errorRatePerMin", 0)
    issues = data.get("issues", []) or []
    unresolved = sum(1 for i in issues if (i.get("level") in ("error", "fatal")))
    if rate < 0.5 and unresolved == 0:
        status = GREEN
    elif rate >= 5 or unresolved >= 4:
        status = RED
    else:
        status = YELLOW
    return {
        "name": "sentry", "status": status,
        "summary": f"error_rate={rate}/min, unresolved P0/P1={unresolved}",
        "fields": {
            "error_rate_per_min": rate,
            "unresolved_p0p1_count": unresolved,
            "new_issues_24h": len(issues),
        },
    }

# ── Cell: /api/health ───────────────────────────────────────────────
def cell_health():
    if MODE == "fixtures":
        data = load_fixture("health")
    else:
        # Live: single curl with measured timing. We don't measure ms
        # precisely here (Python urllib timing < 50 ms granularity is
        # fine; cron-driven precise timing is a UptimeRobot job).
        #
        # Default URL is the Vercel alias because pre-cutover the public
        # domain still routes to Wix Studio (no /api/health route). After
        # DNS cutover, point this at the public domain.
        url = os.environ.get(
            "DASHBOARD_HEALTH_URL",
            "https://carolina-futons-web.vercel.app/api/health",
        )
        import time
        start = time.monotonic()
        data = _http_get(url)
        elapsed_ms = int((time.monotonic() - start) * 1000)
        if isinstance(data, dict):
            data["__elapsed_ms"] = elapsed_ms

    if data is None:
        return _unreachable("health", "no fixture or live response")
    status_text = data.get("status", "?")
    elapsed = data.get("__elapsed_ms")
    if status_text == "ok" and (elapsed is None or elapsed < 500):
        status = GREEN
    elif status_text != "ok":
        status = RED
    elif elapsed and elapsed > 2000:
        status = RED
    else:
        status = YELLOW
    return {
        "name": "health", "status": status,
        "summary": f"status={status_text} version={sanitize(data.get('version','?'))[:7]}",
        "fields": {
            "health_status": status_text,
            "health_version": sanitize(data.get("version", "?"))[:7],
        },
    }

def _unreachable(name, reason):
    return {
        "name": name, "status": UNREACHABLE,
        "summary": f"unreachable: {sanitize(reason)}",
        "fields": {},
    }

# ── Roll-up + verdict ───────────────────────────────────────────────
def overall(cells):
    statuses = {c["status"] for c in cells}
    if RED in statuses:
        return RED, 2
    if UNREACHABLE in statuses:
        return YELLOW, 3  # Contract 3: degraded → overall ≤ YELLOW + exit 3
    if YELLOW in statuses:
        return YELLOW, 1
    return GREEN, 0

# ── Render: YAML summary (stdout) ───────────────────────────────────
def render_yaml(cells, overall_status):
    lines = [
        "# OPS-DASHBOARD-V1",
        f"overall: {VERDICTS[overall_status]}",
        f"generated_at: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
    ]
    for c in cells:
        prefix = c["name"]
        for k, v in c["fields"].items():
            lines.append(f"{prefix}_{k}: {sanitize(v)}")
    return "\n".join(lines) + "\n"

# ── Render: full Markdown (file) ────────────────────────────────────
def render_markdown(cells, overall_status):
    out = []
    ts = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    out.append(f"# Production Dashboard — {ts}")
    out.append("")
    out.append(f"{overall_status} OVERALL: {VERDICTS[overall_status]}.")
    out.append("")
    out.append("## Headline scorecard")
    out.append("")
    out.append("| Source | Status | Notes |")
    out.append("|---|---|---|")
    for c in cells:
        # Re-prefix cell name so /api/health matches the test regex.
        nm = "api/health" if c["name"] == "health" else c["name"]
        out.append(f"| {nm} | {c['status']} | {sanitize(c['summary'])} |")
    out.append("")
    out.append("## Full breakdown")
    out.append("")
    for c in cells:
        nm = "api/health" if c["name"] == "health" else c["name"]
        out.append(f"### {nm}")
        out.append("")
        if not c["fields"]:
            out.append(f"_{sanitize(c['summary'])}_")
        else:
            for k, v in c["fields"].items():
                out.append(f"- **{k}**: {sanitize(v)}")
        out.append("")
    return "\n".join(out)

# ── Assemble ────────────────────────────────────────────────────────
cells = [cell_vercel(), cell_uptime_robot(), cell_sentry(), cell_health()]

# Contract 2 — INCOMPLETE (exit 3): if a REQUIRED cell didn't produce
# any data (vercel, health), the overall is INCOMPLETE.
missing_required = any(
    c["name"] in ("vercel", "health") and c["status"] == UNREACHABLE
    for c in cells
)

overall_status, exit_code = overall(cells)
if missing_required:
    exit_code = 3

sys.stdout.write(render_yaml(cells, overall_status))

# Write the Markdown doc.
os.makedirs(os.path.dirname(OUTPUT_FILE) or ".", exist_ok=True)
with open(OUTPUT_FILE, "w") as f:
    f.write(render_markdown(cells, overall_status))

sys.exit(exit_code)
PYEOF
