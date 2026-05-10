# cf-3qt.8.33 — Post-Cutover Monitoring (24h)

**Bead:** cf-3qt.8.33
**Owner:** Stilgar (the runtime watcher) — millicent on call for tooling questions
**Companion docs:** `cutover-verification-matrix.md` (POST-FLIP section + 24h thresholds table), `cf-v8jj` day-1 stability report template (filled in at T+24h)

## Purpose

Hands-on checklist for the 24-hour window after the DNS flip. Three timed checkpoints — T+1h, T+4h, T+24h — each a printable rows-and-columns block Stilgar can tick off during the cutover-night watch and the morning coffee check.

## How to use

1. **Print or copy this doc to a fresh `docs/cf-3qt.8/post-cutover-monitoring-<DATE>.md`** at start of the watch so the filled-in copy is preserved as an artifact.
2. **Set three alarms**: cutover-flip + 1h, +4h, +24h (Stilgar's phone or whatever).
3. At each alarm, walk the matching block top to bottom. Tick PASS / FAIL / N/A in the right-hand columns.
4. **Anything FAIL → escalate** per the playbook in cf-3qt.8 (15-min rollback SLO). The `cutover-verification-matrix.md` ROLLBACK PROCEDURE section has the exact DNS-revert steps.
5. **All-clear at T+24h** → fill in `cf-v8jj` day-1 stability report template; melania's call on whether to proceed to Phase 9 (Wix Studio retirement).

## T+1h Check — critical window

Cutover flip happened roughly an hour ago. DNS has propagated to most resolvers. SSL is provisioned. This check confirms the site survived the first traffic wave.

| # | Check | How | Pass criteria | Status | Notes |
|--:|---|---|---|---|---|
| 1 | UptimeRobot all monitors green | UptimeRobot dashboard | All 10 monitors green; ≤ 1 transient blip per monitor in the hour | ☐ | |
| 2 | UptimeRobot incident count | UptimeRobot dashboard → Incidents tab | 0 sustained outages (defined: ≥ 2 consecutive failures) | ☐ | |
| 3 | Vercel 5xx rate | Vercel dashboard → Analytics → Errors | 0 sustained 5xx; tolerate ≤ 3 transient 5xx in the hour | ☐ | |
| 4 | Vercel function error rate | Vercel dashboard → Functions tab | < 1% of invocations error out | ☐ | |
| 5 | Sentry error rate | Sentry → Issues → last 1h | < 5 errors/min sustained (matches `cutover-verification-matrix.md` threshold) | ☐ | |
| 6 | `/api/health` response time | `time curl -s https://www.carolinafutons.com/api/health` (×3, take median) | < 500 ms | ☐ | requires cf-x0ks `/api/health` route shipped |
| 7 | Add-to-cart flow | Browser: home → Kingston PDP → Add to cart → cart drawer | drawer opens, item + price correct, quantity step works | ☐ | |
| 8 | Wix Headless checkout reachable | Browser: cart → Checkout button | checkout page loads, no 404, no blank | ☐ | |
| 9 | Newsletter signup form visible | Browser: home page footer | input + submit button render | ☐ | (do not submit) |
| 10 | DNS propagation breadth | `dig @8.8.8.8 +short www.carolinafutons.com` and `@1.1.1.1` and `@9.9.9.9` | all three return Vercel IPs | ☐ | use `scripts/cutover/verify-dns-ttl.sh` if convenient |

**Anything FAIL above → escalate immediately.** Stilgar judgment call on rollback per the SLO.

## T+4h Check

Site has survived the first traffic peak. This check confirms steady-state behaviour and the first batch of analytics data is starting to show up.

| # | Check | How | Pass criteria | Status | Notes |
|--:|---|---|---|---|---|
| 1 | UptimeRobot 4h cumulative uptime | UptimeRobot dashboard → 4h window | ≥ 99.9% per monitor | ☐ | |
| 2 | Google Analytics live sessions | GA4 → Realtime report | session count within 50% of the previous same-day same-hour baseline | ☐ | baseline = matching hour from `docs/vercel-build-conservation-audit-2026-05-10.md` traffic refs OR last-week's GA snapshot |
| 3 | Order count > 0 (if store hours active) | Wix Headless orders dashboard | ≥ 1 order in the 4h window — confirms checkout pipeline functional | ☐ | only meaningful if cutover happened during business hours |
| 4 | Order baseline comparison | `node scripts/cutover/capture-order-baseline.mjs` (post-cutover delta) | < 50% drop vs `docs/cf-3qt.8/order-baseline-<DATE>.json` | ☐ | per `order-baseline-runbook.md` |
| 5 | 404 rate | Vercel → Analytics → 404s | < 5% of requests (matches verification-matrix threshold) | ☐ | |
| 6 | Top 404 paths sane | Vercel → Analytics → 404s tab | known-removed-path 404s only (e.g. legacy Wix paths); no broken `/products/<slug>` links | ☐ | flag any new product-page 404s |
| 7 | Wix Studio fallback still alive | `curl -s -o /dev/null -w "%{http_code}" https://chrisdealglass.wixstudio.com/my-site` | 200 | ☐ | Wix kept as read-only emergency fallback |
| 8 | Vercel function p95 latency | Vercel → Functions → latency | p95 < 1500 ms; p99 < 3000 ms | ☐ | warn if any single function > 5 s |
| 9 | Wix Headless API error rate | Vercel → Analytics → external-API error rate | < 1% | ☐ | hits to `/v1/products`, `/v1/cart`, `/v1/checkout` |
| 10 | Customer support inbox | `carolinafutons@gmail.com` | no panicked customer emails about site-broken | ☐ | one or two normal-tone questions are fine |

**Anything FAIL → judgment call.** Some failures (e.g. order count = 0 outside business hours) are expected and not actionable. Annotate the cell rather than rollback.

## T+24h Check

Full day-1 window complete. This check feeds the `cf-v8jj` day-1 stability report and the Phase-9 readiness decision.

| # | Check | How | Pass criteria | Status | Notes |
|--:|---|---|---|---|---|
| 1 | UptimeRobot 24h cumulative uptime | UptimeRobot dashboard → 24h window | ≥ 99.9% per monitor | ☐ | this is the headline number for the day-1 report |
| 2 | Sentry P0/P1 incident count | Sentry → 24h Issues filter on `level >= error` | ≤ 0 P0; ≤ 2 P1 | ☐ | each P0/P1 needs a chronological entry in cf-v8jj |
| 3 | Order count vs 7-day pre-cutover baseline | `node scripts/cutover/capture-order-baseline.mjs` (full 24h delta) | within 30% of baseline; no time-of-day cliff | ☐ | smaller-than-30% drop is normal new-domain SEO settling |
| 4 | Lighthouse RUM deltas | Vercel Speed Insights | LCP/INP/CLS p75 each within 20% of pre-cutover Lighthouse baseline (`docs/cf-3qt.8/lighthouse-baseline-2026-05-10.md`) | ☐ | needs Speed Insights enabled (cf-3qt.8.32 confirms `speedInsights.enabled` not yet) |
| 5 | Google Search Console index coverage | GSC → Coverage report | 0 cliff-drop in indexed-page count vs pre-cutover snapshot | ☐ | new domain takes 7-14 days to fully re-index, expect some shuffle |
| 6 | Organic search impressions | GSC → Performance | within 30% of pre-cutover same-day-of-week baseline | ☐ | day-1 dip is normal for a new origin |
| 7 | Vercel function error rate (24h cum) | Vercel dashboard → Functions tab → 24h | < 0.5% errors | ☐ | tighter threshold than T+1h |
| 8 | Customer support inbox 24h cum | `carolinafutons@gmail.com` | 0 site-broken complaints; site-related tickets fall in normal volume | ☐ | log any anomaly in the cf-v8jj report |
| 9 | Cart-session dual-write health (if applicable) | Vercel logs → grep `cart-dual-write` | 0 mismatches Wix vs Vercel | ☐ | only relevant if dual-write is active during transition |
| 10 | All UptimeRobot monitors still configured | UptimeRobot dashboard | 10 monitors active and matching `monitoring-setup.md` | ☐ | confirms cf-3qt.8.31 setup hasn't drifted |
| 11 | All cf-3qt.8 cutover artifacts archived | grep `docs/cf-3qt.8/` for `<DATE>` placeholders | 0 unfilled placeholders in shipped artifacts | ☐ | ensures the post-mortem has clean inputs |

After this block, Stilgar:

1. Copies the filled-in checklist to `docs/cf-3qt.8/post-cutover-monitoring-<DATE>.md`.
2. Opens `cf-v8jj` day-1 stability report template, fills in.
3. Posts a `gt mail send melania -s "cutover day-1: GREEN/YELLOW/RED — <one-line>"` with the verdict.

## Verdict matrix at T+24h

| Outcome | Action |
|---|---|
| **GREEN**: ≥ 99.9% uptime, 0 P0, ≤ 2 P1, no order-rate cliff, no support-inbox complaints | proceed to Phase 9 — Wix Studio retirement queued by melania |
| **YELLOW**: 1-2 thresholds crossed but no customer-impact, root-cause known | extend monitor window 7 days; defer Phase 9; file recovery beads as cf-3qt.8.X |
| **RED**: customer-impacting incident, sustained downtime, or order rate < 50% baseline | invoke rollback procedure (`cutover-verification-matrix.md` ROLLBACK PROCEDURE), file incident bead, postmortem before retry |

## Quick links

- **Companion**: `cutover-verification-matrix.md` (the POST-FLIP page-and-flow checks; this doc = the 24h monitoring overlay on top)
- **Plan confirmation**: `vercel-pro-upgrade-checklist.md` (Pro Plus active, function timeouts unlocked)
- **Day-1 report template**: `cf-v8jj` (filled in at T+24h)
- **Day-30 report template**: `cf-tqwn` (gates Phase 9)
- **Rollback playbook**: `cutover-verification-matrix.md` ROLLBACK PROCEDURE
- **Order baseline**: `order-baseline-runbook.md` + `scripts/cutover/capture-order-baseline.mjs`
- **DNS verifier**: `scripts/cutover/verify-dns-ttl.sh`

## Open dependencies for this checklist to fully apply

| Dep | What | Status |
|---|---|---|
| cf-x0ks | `/api/health` route exists at `https://www.carolinafutons.com/api/health` | hooked to godfrey, awaiting cfw merge window |
| cf-3qt.8.31 | UptimeRobot monitors active with API key | hooked to godfrey |
| cf-x6ph | `/api/health` schema documented + smoke confirmed | hooked to godfrey |
| Speed Insights | enabled at the project level | currently `enabled: false` per cf-3qt.8.32 audit |
| Sentry | connected to production environment | per parent cf-3qt.8 prerequisites |

If any of these are not yet shipped at cutover-flip time, the corresponding rows in the checklist become **N/A**, not **FAIL** — annotate accordingly.
