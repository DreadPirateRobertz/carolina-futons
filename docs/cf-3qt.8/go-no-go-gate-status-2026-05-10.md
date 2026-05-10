# cf-3qt.8.34 — Cutover GO/NO-GO Gate Status

**Bead:** cf-3qt.8.34
**Generated:** 2026-05-10 by millicent
**For:** Stilgar (final go/no-go call) — melania (sign-off)
**Format:** Single-page printable. Print this morning of cutover; tick rows off; calling order is GO only after every BLOCKER clears.

## Verdict

🟡 **NO-GO at this moment.** Of 12 tracked gates, 4 are CLEAR, 6 are PENDING/IN-PROGRESS, and **2 are NOT STARTED — both block cutover** (DNS TTL drop, order baseline capture). Earliest viable cutover window is **48 h after the TTL drop completes**.

| Class | Count |
|---|---|
| ✅ CLEAR | 4 |
| ⚠️ PENDING | 4 |
| 🔄 IN PROGRESS | 2 |
| ❌ NOT STARTED | 2 (both blockers) |

## Gate matrix

Live verification from my lane (CI/devops). Each row's "Verified by" column shows what I actually checked — not what I'm trusting from melania's bead description.

| # | Gate | Status | Owner | Verified by | ETA / Action needed |
|--:|---|---|---|---|---|
| 1 | **DNS TTL 60s for ≥ 48h** | ❌ **NOT STARTED** | Stilgar (Wix DNS) | `dig +noall +answer carolinafutons.com www.carolinafutons.com` returns **TTL=3600**, no `docs/cf-3qt.8/ttl-drop-log.md` | **CUTOVER BLOCKER.** Needs 48 h lead time. Run `dns-ttl-drop-runbook.md` immediately. Earliest cutover window: 2026-05-12 + 48 h after the drop. |
| 2 | **Order-rate baseline captured** | ❌ **NOT STARTED** | (assignable) | No `docs/cf-3qt.8/order-baseline-*.json` files in repo (only the runbook) | **CUTOVER BLOCKER.** Needs to run `node scripts/cutover/capture-order-baseline.mjs` against current Wix Stores. Output: `order-baseline-<DATE>.json` + `.md`. Required for post-flip drop-detection at T+4h and T+24h. |
| 3 | **Vercel Pro plan active** | ✅ CLEAR | Stilgar (account) | `/v2/teams` API: `billing.plan=pro, planIteration=plus, status=active` | Confirmed via `vercel-pro-upgrade-checklist.md` (cfutons PR #1282) |
| 4 | **PRE-FLIP smoke 20/20** | ✅ CLEAR | miquella | `pre-flip-smoke-results-2026-05-10.md` — 20 PASS / 0 FAIL / 1 SKIP (`/spring-sale` per bead instructions) | Done |
| 5 | **PRE-FLIP curl checks** | ✅ CLEAR | millicent | `pre-cutover-curl-results-2026-05-10.md` (cfutons PR #1269) — 6 of 7 PASS, `/api/health` was the 1 hard FAIL → see gate 6 | Done |
| 6 | **`/api/health` route deployed** | ⚠️ PENDING | godfrey (impl), Stilgar (review) | cfw **PR #554 OPEN** (`feat(cf-x6ph): /api/health liveness endpoint + monitoring runbook`) — not yet merged | Needs Stilgar review on cfw PR #554. Required for UptimeRobot + cutover-night dashboard polling per `post-cutover-monitoring-24h.md` rows. |
| 7 | **UptimeRobot monitors active** | ⚠️ PENDING | godfrey | bd `cf-3qt.8.31` IN_PROGRESS, hooked to godfrey, awaiting Stilgar API key | Stilgar adds UptimeRobot API key to godfrey's environment so `setup-monitors` script can run. Required for T+1h / T+4h / T+24h checklist rows. |
| 8 | **Sentry connected to production** | ⚠️ UNKNOWN | Stilgar | (out of my lane to verify — no Sentry credentials in this clone) | Stilgar confirms Sentry project linked to `carolinafutons.com` production env. Required for error-rate gating in `post-cutover-monitoring-24h.md`. |
| 9 | **`cfw/vercel.json` ratchet exclusion** | ⚠️ PENDING | millicent (impl), Stilgar (review per `enforce_admins=true`) | cfw **PR #565 OPEN** (`feat(cf-ukc6.1): exclude chore/coverage-ratchet-bump from Vercel preview deploys`) | Needs Stilgar review on cfw PR #565. Not a hard cutover blocker but currently burning 39% of daily Vercel preview credits — worth landing before cutover-night so build-credit headroom is maximized for fast iteration. |
| 10 | **cf-dbw9 Track 3 (security audit)** | ✅ CLEAR | millicent | `docs/security-audit-2026-05-10.md` (cfutons PR #1252) — 40 raw gitleaks hits all triaged | Done |
| 11 | **cfw PR #540 visual confirm (logo)** | ⚠️ PENDING | Stilgar | cfw PR #540 OPEN (`feat(cf-jo07): restore CF logo in header (full + shrunken)`) | Stilgar visual review against the preview link. Brand fidelity at cutover-night = needs the logo visible. |
| 12 | **cf-ox0h.F4 cron dedup** | 🔄 IN PROGRESS | blaidd | (per melania's bead description; bd ID resolution failed locally — different label format) | blaidd to confirm completion. Cron-dedup hardening is required for the post-cutover scheduled-email batch. |
| 13 | **cf-3ldu.1 wixData rate limit** | ✅ CLEAR | rennala | cfutons PR #1288 — **MERGED** 2026-05-10 09:25 UTC | Done |
| 14 | **cf-3ldu.F2 fail-open** | 🔄 IN PROGRESS | rennala | (per melania's bead; bd ID resolution failed locally) | rennala to confirm completion. F2 is the failure-mode gate companion to F1 (cf-3ldu.1). |

## Calling order

For Stilgar to call **GO**, all of the following must be true:

1. **Both NOT-STARTED gates (rows 1–2) shipped** → run TTL drop today; run order baseline capture today
2. **All PENDING gates (rows 6, 7, 8, 9, 11) closed** → reviews + API keys + Sentry connection
3. **All IN-PROGRESS gates (rows 12, 14) closed** → blaidd + rennala report done
4. **+ 48 h after TTL drop** → respect the cache-TTL invariant for the rollback SLO

Earliest viable cutover window given today is 2026-05-10:

- Best case: TTL drop today → cutover earliest 2026-05-12 evening (48 h)
- More likely: TTL drop tomorrow → cutover 2026-05-13 evening
- Add per-PR landing time for rows 6, 7, 9, 11 before the 48h window expires

## Hard "DO NOT GO" conditions

If any of these is true at the calling-order time, **abort** — do not flip DNS:

- DNS TTL not yet 60 s on all 4 production records
- Order baseline JSON file not in `docs/cf-3qt.8/`
- `/api/health` returns ≠ 200 against the Vercel preview
- UptimeRobot has any monitor red OR not yet configured
- Sentry not connected to production env
- Any P0 incident open in the last 4 h on cfw or cfutons
- Pager / on-call coverage not acknowledged in cutover-window channel

Each is a known reversibility-risk that can't be fixed mid-flip.

## Stilgar's morning checklist (this doc collapsed)

```
[ ] Read this doc top-to-bottom
[ ] Run TTL drop (60 s on @ A, www CNAME, _vercel TXT, …) — 5 min in Wix DNS dashboard
[ ] Append timestamped entry to docs/cf-3qt.8/ttl-drop-log.md
[ ] Run `node scripts/cutover/capture-order-baseline.mjs` — produces order-baseline-<DATE>.json
[ ] Review + merge cfw PR #554 (/api/health) — 5 lines, low risk
[ ] Review + merge cfw PR #565 (vercel.json ratchet exclusion) — 9 lines, low risk
[ ] Review + merge cfw PR #540 (logo) — visual diff against preview
[ ] Add UptimeRobot API key to godfrey's env so cf-3qt.8.31 can finish
[ ] Confirm Sentry project linked to production (out-of-band check)
[ ] Set 48 h timer; cutover window opens after timer expires AND all rows above are ✅
```

If today is 2026-05-10 and Stilgar starts the morning checklist now, **earliest GO call is 2026-05-12 ~mid-day UTC** — assuming all PR reviews + key-add tasks complete same-day and TTL has been 60 s for ≥ 48 h.

## References

- Parent: cf-3qt.8 (DNS cutover P1)
- Master checklist: `docs/cf-3qt-cutover-night-checklist.md` (cutover-night execution playbook, cf-0hzn)
- Verification matrix: `docs/cf-3qt.8/cutover-verification-matrix.md` (page-by-page PRE-FLIP / POST-FLIP)
- Pre-flip smoke (page tests): `docs/cf-3qt.8/pre-flip-smoke-results-2026-05-10.md` (20/0/1 PASS, miquella)
- Pre-flip curl: `docs/cf-3qt.8/pre-cutover-curl-results-2026-05-10.md` (6 of 7 PASS, millicent)
- Plan confirmation: `docs/cf-3qt.8/vercel-pro-upgrade-checklist.md` (Pro Plus active)
- Post-cutover monitoring: `docs/cf-3qt.8/post-cutover-monitoring-24h.md` (T+1h/T+4h/T+24h)
- Rollback playbook: `cutover-verification-matrix.md` ROLLBACK PROCEDURE (15-min SLO)
