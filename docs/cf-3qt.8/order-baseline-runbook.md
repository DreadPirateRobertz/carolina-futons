# cf-3qt.8 — Order-Rate Baseline Runbook

**Bead:** cf-3qt.8 (acceptance item 5)
**Owner:** millicent (CI/devops) + Stilgar (runs the script with live creds) + melania (gate-keeps the cutover decision)
**Last updated:** 2026-05-10

The cf-3qt.8 acceptance criteria spell out a 24-hour post-cutover monitor with a hard rule: **if orders < 90% baseline at the 2-hour mark → roll back DNS**. This runbook describes how to capture the baseline before the cutover, where the captured artifacts live, and how the cutover-night dashboard consumes them.

---

## What gets captured

`scripts/cutover/capture-order-baseline.mjs` queries the Wix Stores REST API for the previous 7 calendar days of orders, anchored to TZ-local midnight (`America/Denver` by default — the cutover happens at 02:00 MT). It writes two files into `docs/cf-3qt.8/`:

- `order-baseline-<YYYYMMDD>.json` — machine-readable
  - `total` — orders over the window
  - `distinctDays` — number of distinct calendar days the window spans (≤ 7; lets `dayHourAvg` cope with partial windows)
  - `calendarDay` — `YYYY-MM-DD → count`
  - `dayHourCount` — `weekday → hour → count` (24 × 7 buckets)
  - `dayHourAvg` — `weekday → hour → orders/day` (count ÷ distinctDays)
- `order-baseline-<YYYYMMDD>.md` — human-readable summary table for review

Both files are committed alongside the rest of the cutover artifacts so the cutover-night on-call has everything offline.

---

## When to run

**At least 24 hours before the cutover.** Lowering the DNS TTL to 60 s as part of pre-cutover step #2 can shift traffic patterns slightly (more uncached resolves), so capturing the baseline before that change keeps the window clean.

If the cutover slips by more than 24 hours, **re-run** the script. A baseline older than the cutover by > 48 hours is no longer a fair comparison (weekly seasonality drift, weather, paid-ads cadence).

---

## How to run

```sh
# Required: Wix REST API key + site ID. Stilgar has these in the
# password manager; the API key needs `Stores Orders Read` scope.
export WIX_API_KEY=…
export WIX_SITE_ID=…

# Optional: change the window or TZ.
# export ORDER_BASELINE_DAYS=14
# export ORDER_BASELINE_TZ=America/Los_Angeles

node scripts/cutover/capture-order-baseline.mjs
```

The script emits per-page progress to stdout and exits with:

| Exit | Meaning |
| ---: | --- |
| 0 | baseline captured + both files written |
| 1 | `WIX_API_KEY` or `WIX_SITE_ID` missing |
| 2 | Wix API rejected the query (auth / scope / outage) — capture the stderr line and re-issue the API key with the correct scope |
| 3 | No orders returned over the window — refusing to write a vacuous baseline (suspicious; investigate before the cutover) |

---

## Cutover-night decision rule

At t+2h post-cutover, the on-call (mayor + melania per the bead's `## Comms` section) sums the actual orders received against the baseline cells covering the elapsed cutover hours, in TZ-local time:

```
expected_2h = sum( dayHourAvg[weekday][hour] for hour in [cutover_start_hour .. +2h] )
actual_2h   = COUNT(orders received in same wall-clock window)

if actual_2h < 0.9 * expected_2h:
  initiate rollback per docs/ops/rollback-runbook.md
```

For the cutover hours specifically (02:00 → 04:00 MT, low-traffic), the absolute counts are tiny — 0–2 orders/cell is normal. **Apply the 90% rule against the rolled-up 2-hour total**, not against any single low-traffic cell. A single missing order in a cell with avg=0.5 isn't signal.

After the 2-hour decision point, the same rule applies hour-over-hour through the 24-hour monitor window. By midday MT the absolute counts are large enough that single-cell comparisons start being meaningful again.

---

## Sanity checks before relying on the baseline

The `.md` summary table is the audit surface. Before the cutover, scan it for:

1. **Total orders over the 7-day window** — should be in the same ballpark as your monthly Wix dashboard order count divided by 4–5. Wildly low → API auth scope likely blocked some orders; wildly high → wrong filter shape.
2. **Calendar-day histogram** — should show 7 entries (one per day in the window). Missing days → API pagination cap was hit, OR there really were zero orders that day. The `total / distinctDays` denominator self-corrects for the latter; the former needs a `ORDER_BASELINE_DAYS=N` rerun.
3. **Hour-of-day distribution** — afternoon + evening MT should dominate; 02:00–05:00 MT should be near zero. If 02:00 MT shows much traffic, the TZ env var was wrong (re-run with `ORDER_BASELINE_TZ=America/Denver`).

---

## Future work

- Tie the 24-hour monitor to the captured baseline file directly — today the on-call eyeballs the dashboard against the `.md` table. A tighter integration would be a Vercel scheduled function that loads `order-baseline-<latest>.json`, compares against live orders pulled from the same API, and pages on a 90% breach. Out of scope for cf-3qt.8 itself — file as `cf-3qt.8.<n>` follow-up if the cutover surfaces enough manual toil to justify it.
- Consider extending the script to capture `revenue/day` alongside order count. Order count is the cleaner cutover signal (quicker to compute live), but revenue captures the size-of-cart shift that a misconfigured currency or product-feed bug might cause.

---

## Reference

- Parent: cf-3qt.8 (DNS cutover) acceptance item 5
- Sibling runbooks:
  - `docs/ops/rollback-runbook.md` (item 4 — DNS revert procedure)
  - `monitoring-setup.md` (item 3 — UptimeRobot synthetic monitoring)
- API: Wix Stores v2 orders/query <https://www.wixapis.com/stores/v2/orders/query>
- Pattern reference: `scripts/assign-skus.mjs` (Wix REST + REPO API key auth)
