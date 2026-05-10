# cf-3qt.8 — Cron canonical-source decision (pre-cutover vs post-cutover)

**Bead:** cf-ox0h.fu1 (cron-schedule-audit F4 + F5 follow-up)
**Author:** godfrey · 2026-05-10
**Audit reference:** `docs/audits/cron-schedule-audit-2026-05-10.md` §F4 (P1) + §F5 (P3)

The cron-schedule audit flagged two unresolved questions:

- **F4 (P1)** — 5 HTTP cron endpoints that mirror Wix Jobs Scheduler entries. Risk: double-execution if both schedulers fire simultaneously. **Until now we didn't know which scheduler is canonical.**
- **F5 (P3)** — 5 HTTP cron endpoints with no Wix-job mirror and no known external trigger. Risk: dead code that ships but never runs.

This doc resolves both via a cfw-side trace + the explicit cf-3qt.8 cutover plan.

---

## Trace results

`carolina-futons-web` repo audit, 2026-05-10:

| Searched for | Result |
|---|---|
| `vercel.json` (Vercel cron config) | ❌ Not present |
| `.github/workflows/*.yml` cron pointing at any of the 10 endpoints | ❌ None — only the nightly CI lint/typecheck/E2E job |
| Reference to any of the 10 endpoint names anywhere in cfw `src/` | ❌ Zero matches |
| Reference to any of the 10 endpoint names in cfutons docs/scripts | Only audit docs + the **`vercel-pro-upgrade-checklist.md`** mentioning `runReviewRequestEmailsCron` + `scanAndTriggerWinbackCron` as future cron-driven endpoints |

**Conclusion: no external scheduler is currently wired to ANY of the 10 HTTP cron endpoints.**

That collapses the audit's F4 risk:

| Pre-cutover | Post-cutover |
|---|---|
| Wix Jobs Scheduler is canonical for all 5 mirrored entries (`triggerAbandonedCartRecovery`, `processEmailQueue`, `triggerReengagement`, `scanAndTriggerWinback`, `runReviewRequestEmails`). HTTP endpoints exist but nothing fires them → no double-execution risk **today**. | Wix Jobs Scheduler retires with cf-3qt.9. The 5 HTTP `*Cron` endpoints become the canonical surface — driven by Vercel cron (`vercel.json`) or the planned Vercel Pro upgrade per `vercel-pro-upgrade-checklist.md`. |

---

## Action items — cf-3qt.8 cutover gate

### Pre-cutover (Wix is still canonical)

No code changes required. Document the current state in jobs.config + each HTTP-cron endpoint header so the next reader doesn't re-discover this:

```js
// CRON-CANONICAL: Wix Jobs Scheduler (pre-cutover). The
// `triggerAbandonedCartRecovery` job in jobs.config is the live driver.
// This HTTP endpoint exists for the post-cutover transition (cf-3qt.9)
// when Wix is retired and Vercel cron takes over.
```

Same comment block on each of the 5 mirrored endpoints.

### Cutover transition (cf-3qt.9 / when Wix is unpublished)

**Critical** — this is the moment double-execution risk materializes if not handled in the right order:

1. **Disable the Wix-job duplicate** by removing the entry from `jobs.config` (or pausing it in Wix Dashboard).
2. **Wire the HTTP endpoint** in cfw — either via `vercel.json` cron syntax (preferred — co-located with the deploy) or via UptimeRobot's HTTPS-keyword monitor in "fire-on-schedule" mode (less standard).
3. Verify exactly one path fires by checking the Wix Site Monitoring logs + Vercel function logs over a 24h window.

If the Wix-disable lands BEFORE the cfw-wire, the cron is silently dark for the gap window. If the cfw-wire lands BEFORE the Wix-disable, both fire → double-execution → doubled customer emails. **The two changes must land in the same maintenance window** with a verified handoff.

### F5 endpoints (5 with no current scheduler)

| Endpoint | Wix-job mirror? | Plan |
|---|---|---|
| `get_processPostPurchaseCareCron` | None | Wire via Vercel cron post-cutover |
| `get_processContentScheduleCron` | None | Wire via Vercel cron post-cutover |
| `get_cleanupRateLimitCron` | None | Wire via Vercel cron post-cutover (or delete — see note) |
| `get_processNotificationQueueCron` | None | Wire via Vercel cron post-cutover |
| `get_weeklyBlogDigestCron` | None | Wire via Vercel cron weekly post-cutover |

**Note on `get_cleanupRateLimitCron`:** the cron-canonical post-cutover answer for rate-limit cleanup may now be redundant given cf-8p52's fail-closed change to the canonical helper (`docs/audits/rate-limit-audit-2026-05-10.md` F2 fix landed via PR #1297). Since rate-limit rows expire naturally per the sliding window, an explicit cleanup cron may no longer be necessary. Decision: include in the post-cutover audit, default to wire-it-anyway unless storage cost concerns surface.

---

## Pre-cutover canonical mapping

For the cutover-checklist, here's the authoritative pre-cutover scheduler map:

| Function | Pre-cutover scheduler (canonical) | Post-cutover scheduler (target) |
|---|---|---|
| processEmailQueue | Wix Job (every 15 min) | Vercel cron via `processEmailQueueCron` |
| triggerAbandonedCartRecovery | Wix Job (hourly) | Vercel cron via `triggerCartRecoveryCron` |
| triggerReengagement | Wix Job (Mon 14:00 UTC) | Vercel cron via `triggerReengagementCron` |
| scanAndTriggerWinback | Wix Job (Mon 15:00 UTC) | Vercel cron via `scanAndTriggerWinbackCron` |
| runReviewRequestEmails | Wix Job (15:00 UTC daily) | Vercel cron via `runReviewRequestEmailsCron` |
| processPostPurchaseCare | None | Vercel cron via `get_processPostPurchaseCareCron` |
| processContentSchedule | None | Vercel cron via `get_processContentScheduleCron` |
| cleanupRateLimit | None | TBD (see F5 note above) |
| processNotificationQueue | None | Vercel cron via `get_processNotificationQueueCron` |
| weeklyBlogDigest | None | Vercel cron via `get_weeklyBlogDigestCron` |

---

## Linked beads + audits

- **Parent:** cf-ox0h (cron-schedule audit, in progress with rennala)
- **Audit:** `docs/audits/cron-schedule-audit-2026-05-10.md` §F4 + §F5
- **Adjacent:** cf-8p52 (rate-limit fail-closed, merged via PR #1297) — affects the `cleanupRateLimitCron` decision
- **Adjacent:** cf-3qt.8 (DNS cutover) — gates the canonical-source flip
- **Adjacent:** cf-3qt.9 (Wix retirement) — completes the transition
- **Adjacent:** `docs/cf-3qt.8/vercel-pro-upgrade-checklist.md` — funding for the Vercel cron path

---

## Recommended follow-up bead

`cf-cron-canonical-flip` (P1, post-cutover) — execute the 3-step transition above for all 10 endpoints in a single maintenance window. Owner: TBD (probably mayor + ops together since it touches both Wix dashboard + Vercel config).
