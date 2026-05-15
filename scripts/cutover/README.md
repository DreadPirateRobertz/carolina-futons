# scripts/cutover/

Cutover-night automation for cf-3qt.8 (DNS flip from Wix Studio → Vercel-hosted Next.js + Wix Headless).

This directory holds the four scripts Stilgar runs across the cutover lifecycle. Each is self-contained and has a header comment with its full contract. This README is the at-a-glance index — open it cutover-night and pick the right script for the current step.

## When to run what

| Step | Script | Why |
|---|---|---|
| **T-48 h** | `bash scripts/cutover/verify-dns-ttl.sh` | Confirm the TTL drop landed on all production DNS records. Probes 5 public resolvers (Google ×2, Cloudflare ×2, Quad9). Re-run periodically during the 48 h window to catch resolver caches that haven't yet expired. |
| **T-24 h** | `node scripts/cutover/snapshot-wix-data.mjs` | Capture JSON snapshot of every load-bearing Wix CMS collection — forensic + worst-case-restore artifact. |
| **T-24 h** | `node scripts/cutover/capture-order-baseline.mjs` | Capture 7-day order-rate baseline for the post-cutover drop-detection gate (T+4h / T+24h checks per `post-cutover-monitoring-24h.md`). |
| **T-2 h** | `bash scripts/cutover/check-cutover-readiness.sh` | Programmatic re-snapshot of the GO/NO-GO gate-status table. Re-run as PRs merge / blockers clear / morning progresses. **Exit 0 = GO** (gates and final go/no-go call), 1 = NO-GO (any hard blocker NOT STARTED), 2 = HOLD (no blockers but PRs still pending review). |
| **T-0** | (manual: Wix DNS dashboard + Vercel domains) | Per `cutover-verification-matrix.md` Step 2 + `vercel-pro-upgrade-checklist.md` |
| **post-flip** | `bash scripts/cutover/check-cutover-readiness.sh` | Sanity re-check that the post-flip gate state evolved as expected. |

## Per-script details

### `verify-dns-ttl.sh` — DNS TTL probe (T-48 h verifier)

Companion to `docs/cf-3qt.8/dns-ttl-drop-runbook.md`. After Stilgar drops TTL to 60 s in the Wix DNS dashboard, this script probes the 4 production records (`@` A, `www` CNAME, `_vercel` TXT — adjust as needed) across 5 public resolvers and reports `OK | STALE | MISSING` per resolver.

```sh
# Default 120 s grace
bash scripts/cutover/verify-dns-ttl.sh

# Strict 60 s grace
TTL_GRACE_SECONDS=60 bash scripts/cutover/verify-dns-ttl.sh
```

**Exit 0** when every probe TTL ≤ grace. **Exit non-zero** if any resolver still has a stale long TTL. Re-run periodically — the resolver cache propagation is the actual gating factor, not the dashboard change.

### `snapshot-wix-data.mjs` — Wix CMS snapshot (T-24 h forensics)

Companion to `docs/cf-3qt.8/wix-snapshot-runbook.md`. Walks 37 load-bearing CMS collections via the Wix Data v2 REST API and writes one JSON file per collection plus a manifest.

```sh
export WIX_API_KEY=…
export WIX_SITE_ID=…

# Preview only (no writes — confirms env + collection list)
node scripts/cutover/snapshot-wix-data.mjs --manifest

# Full snapshot
node scripts/cutover/snapshot-wix-data.mjs
```

Captures CMS row JSON only. **Does NOT** capture media binaries, member PII, or orders — those have separate paths (orders → `capture-order-baseline.mjs`; media → CDN URLs persist post-cutover).

### `capture-order-baseline.mjs` — order-rate baseline (T-24 h drop-detection input)

Companion to `docs/cf-3qt.8/order-baseline-runbook.md`. Pulls the previous 7 calendar days of orders from Wix Stores REST and writes:

- `docs/cf-3qt.8/order-baseline-<YYYYMMDD>.json` — machine-readable, with `dayHourCount` + `dayHourAvg` 24×7 buckets
- `docs/cf-3qt.8/order-baseline-<YYYYMMDD>.md` — human-readable summary table

```sh
export WIX_API_KEY=…
export WIX_SITE_ID=…
# Optional:
# export ORDER_BASELINE_DAYS=14
# export ORDER_BASELINE_TZ=America/Los_Angeles

node scripts/cutover/capture-order-baseline.mjs
```

**Exit codes**: `0` ok / `1` missing env / `2` Wix REST rejection / `3` vacuous baseline (zero orders in window — re-run after the next sale).

### `check-cutover-readiness.sh` — programmatic GO/NO-GO (T-2 h + cutover-morning re-runs)

Companion to `docs/cf-3qt.8/go-no-go-gate-status-2026-05-10.md` (the snapshot doc). Re-derives the gate-status table any time. **Use this throughout cutover-morning** as PRs merge and blockers clear.

```sh
bash scripts/cutover/check-cutover-readiness.sh
```

8 gates checked: DNS TTL (queries authoritative Wix NS to bypass cache decay), order-baseline file present, cfw PR #554 / #565 / #540 merge state, Vercel Pro plan still active, UptimeRobot bead status (cf-3qt.8.31), Sentry (always UNKNOWN — out-of-lane).

**Exit codes**: `0 = GO` (every gate ✅ or known-soft-pending), `1 = NO-GO` (any hard blocker NOT STARTED), `2 = HOLD` (no blockers but PRs still pending review).

The verdict on stdout is one line — pipe-friendly for chaining into other tooling. Full table on stderr is human-readable.

## Companion deep-dive runbooks

Open these in a second window during cutover; this README is the entry-point.

- `docs/cf-3qt.8/dns-ttl-drop-runbook.md` — T-48 h TTL drop procedure (Wix DNS dashboard)
- `docs/cf-3qt.8/wix-snapshot-runbook.md` — what `snapshot-wix-data.mjs` actually captures + how to consume
- `docs/cf-3qt.8/order-baseline-runbook.md` — what the baseline JSON shape means + the post-cutover drop-detection rule (< 50% of baseline at T+1h → escalate)
- `docs/cf-3qt.8/cutover-verification-matrix.md` — the manual page-by-page PRE-FLIP / POST-FLIP checklist
- `docs/cf-3qt-cutover-night-checklist.md` — the master single-page cutover-night flow (cf-0hzn, top-level)
- `docs/cf-3qt.8/post-cutover-monitoring-24h.md` — T+1h / T+4h / T+24h monitoring matrix
- `docs/cf-3qt.8/go-no-go-gate-status-2026-05-10.md` — point-in-time GO/NO-GO snapshot
- `docs/cf-3qt.8/vercel-pro-upgrade-checklist.md` — Pro Plus already active; remaining `vercel domains add` step

## Adding a new cutover script

If a new script joins this directory, add a row to "When to run what" above and a sub-section under "Per-script details". Keep this README the single index; future operators should never have to grep the directory to find what's there.

## Reference

- Bead: cf-8qh8
- Parent: cf-3qt.8 (DNS cutover, P1)
