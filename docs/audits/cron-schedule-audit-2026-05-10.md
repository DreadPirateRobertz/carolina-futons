# Cron schedule audit — 2026-05-10

**Bead:** cf-ox0h
**Auditor:** rennala
**Method:** Static read of `src/backend/jobs.config` (Wix Jobs Scheduler) + `src/backend/http-functions.js` (HTTP cron endpoints). Verified every job's `functionLocation` file + named-export resolution, mapped fire times, cross-referenced with HTTP cron endpoints for duplicates, audited the X-Cron-Secret auth pattern.
**Pre-cutover scope:** cf-3qt.8 cutover risk: jobs that fail-on-missing-export silently, schedule collisions that overload Wix's job-runner concurrency, and HTTP cron endpoints duplicating Wix-scheduler triggers.

## TL;DR

**21 active Wix jobs, 11 HTTP cron endpoints.** Every Wix-job `functionLocation` resolves to a real exported function (verified post-cf-4x7e.fu1 cleanup — that bead removed 2 dead jobs whose target files had been retired). X-Cron-Secret auth uses `timingSafeEqual` consistently across all HTTP crons.

**Findings:**
- **F1 (P2)** — schedule collision: **6 Wix jobs fire at 15:00 UTC on Mondays**. Wix Velo's job-runner concurrency limit isn't strictly documented but real-world reports cluster around ~5 concurrent functions. Mondays at 10am ET will likely queue at least one job.
- **F2 (P2)** — schedule collision: **4 jobs at 13:00 UTC daily** (price drops, delivery day-of, white-glove ×2). Same risk class.
- **F3 (P2)** — schedule collision: **4 jobs at 15:00 UTC daily** (streak milestones, delivery 48h, daily challenge reminders, review request).
- **F4 (P1)** — duplicate triggers: 5 HTTP cron endpoints mirror Wix-scheduler jobs without documented routing. Both surfaces firing the same logic = double-execution risk: queue items processed twice, customer emails sent twice, etc.
- **F5 (P3)** — orphan endpoints: 4 HTTP crons have no Wix-job mirror AND no documented external scheduler — dormant or scheduled by an undocumented Vercel/external cron we can't verify from source.

## Wix Jobs Scheduler inventory (`src/backend/jobs.config`)

All 21 active jobs verified against their `functionLocation` exports. ✓ in "Export resolves" means the named function is exported from the listed file.

| Job name | Cron (UTC) | Function file | Export resolves | HTTP mirror? |
|---|---|---|---|---|
| `processEmailQueue` | `*/15 * * * *` | emailAutomation.web.js | ✓ | **`get_processEmailQueueCron`** (F4) |
| `processChallengeNotifSMSQueue` | `*/15 * * * *` | gamificationNotifs.web.js | ✓ | — |
| `triggerAbandonedCartRecovery` | `0 * * * *` | emailAutomation.web.js | ✓ | **`get_triggerCartRecoveryCron`** (F4) |
| `triggerReengagement` | `0 14 * * 1` (Mon 9am EST) | emailAutomation.web.js | ✓ | **`get_triggerReengagementCron`** (F4) |
| `checkBrowseAbandonment` | `0 */2 * * *` | browseAbandonment.web.js | ✓ | `get_triggerBrowseRecoveryCron` — different fn but same module |
| `refreshFacebookCatalog` | `0 */6 * * *` | facebookCatalog.web.js | ✓ | — |
| `checkStreakMilestoneNotifications` | `0 15 * * *` (10am EST) | gamificationNotifs.web.js | ✓ | — |
| `syncInventoryFromStore` | `*/30 * * * *` | inventorySync.web.js | ✓ | — |
| `detectPriceDrops` | `0 13 * * *` (8am EST) | priceDropCron.web.js | ✓ | — |
| `processDeliveryDayOfReminders` | `0 13 * * *` (8am EST) | deliveryNotifications.web.js | ✓ | — |
| `processDelivery48hReminders` | `0 15 * * *` (10am EST) | deliveryNotifications.web.js | ✓ | — |
| `sendWeeklyDigestEmail` | `0 15 * * 1` (Mon 8am MT) | analyticsDigest.web.js | ✓ | — |
| `scanLifecycleMilestones` | `0 9 * * *` (4am EST) | lifecycleCron.web.js | ✓ | — |
| `sendLifecycleEmails` | `5 9 * * *` (4:05am EST) | lifecycleEmailSender.web.js | ✓ | — |
| `runWhiteGlove48hReminders` | `0 13 * * *` (8am EST) | whiteGloveScheduling.web.js | ✓ | — |
| `runWhiteGloveDayOfReminders` | `0 13 * * *` (8am EST) | whiteGloveScheduling.web.js | ✓ | — |
| `autoStopSignificantExperiments` | `0 14 * * *` (9am EST) | abTestDashboard.web.js | ✓ | — |
| `runDailyChallengeReminders` | `0 15 * * *` (10am EST) | lifecycleCron.web.js | ✓ | — |
| `scanAndTriggerWinback` | `0 15 * * 1` (Mon 10am EST) | marketingSequences.web.js | ✓ | **`get_scanAndTriggerWinbackCron`** (F4) |
| `runReviewRequestEmails` | `0 15 * * *` (10am EST) | marketingSequences.web.js | ✓ | **`get_runReviewRequestEmailsCron`** (F4) |
| `runStreakAtRiskPushNotifications` | `0 14 * * *` (9am EST) | gamificationNotifs.web.js | ✓ | — |

## HTTP cron endpoint inventory (`src/backend/http-functions.js`)

All 11 endpoints verified to use the standard auth shape (`getSecret(...)` + `timingSafeEqual(requestKey, cronKey)` + `forbidden({...})` on mismatch). 14 of 15 cron-key fetches use `ALERT_CRON_KEY`; one uses `CONTENT_CRON_KEY`.

| Endpoint | Secret | Wix job mirror? | External trigger known? | Class |
|---|---|---|---|---|
| `get_triggerBrowseRecoveryCron` | ALERT_CRON_KEY | distinct (`checkBrowseAbandonment` is a different function in the same module) | unknown | F5 candidate (orphan or undocumented external) |
| `get_triggerCartRecoveryCron` | ALERT_CRON_KEY | YES (`triggerAbandonedCartRecovery`) | unknown | **F4** duplicate |
| `get_processEmailQueueCron` | ALERT_CRON_KEY | YES (`processEmailQueue`) | unknown | **F4** duplicate |
| `get_triggerReengagementCron` | ALERT_CRON_KEY | YES (`triggerReengagement`) | unknown | **F4** duplicate |
| `get_scanAndTriggerWinbackCron` | ALERT_CRON_KEY | YES (`scanAndTriggerWinback`) | unknown | **F4** duplicate |
| `get_runReviewRequestEmailsCron` | ALERT_CRON_KEY | YES (`runReviewRequestEmails`) | unknown | **F4** duplicate |
| `get_processPostPurchaseCareCron` | ALERT_CRON_KEY | no | unknown | F5 candidate |
| `get_processContentScheduleCron` | CONTENT_CRON_KEY | no | unknown | F5 candidate |
| `get_cleanupRateLimitCron` | ALERT_CRON_KEY | no | unknown | F5 candidate |
| `get_processNotificationQueueCron` | ALERT_CRON_KEY | no | unknown | F5 candidate |
| `get_weeklyBlogDigestCron` | ALERT_CRON_KEY | no (`sendWeeklyDigestEmail` is a different module) | unknown | F5 candidate |

## Schedule-collision matrix (UTC fire times)

Sorted by fire time, daily + Monday combined.

| UTC fire time | Day | Job count | Jobs |
|---|---|---|---|
| `0 9 * * *` | daily 09:00 | 1 | scanLifecycleMilestones |
| `5 9 * * *` | daily 09:05 | 1 | sendLifecycleEmails (intentionally staggered +5min from above) |
| `0 13 * * *` | daily 13:00 | **4** | detectPriceDrops, processDeliveryDayOfReminders, runWhiteGlove48hReminders, runWhiteGloveDayOfReminders |
| `0 14 * * *` | daily 14:00 | 2 | autoStopSignificantExperiments, runStreakAtRiskPushNotifications |
| `0 14 * * 1` | Mon 14:00 | +1 | + triggerReengagement |
| `0 15 * * *` | daily 15:00 | **4** | checkStreakMilestoneNotifications, processDelivery48hReminders, runDailyChallengeReminders, runReviewRequestEmails |
| `0 15 * * 1` | Mon 15:00 | **+2 → 6 total** | + sendWeeklyDigestEmail + scanAndTriggerWinback |
| `0 */2 * * *` | every 2h on the hour | 1 | checkBrowseAbandonment (collides with hourly + 13:00/14:00/15:00 above on alignment) |
| `0 * * * *` | hourly | 1 | triggerAbandonedCartRecovery (collides with checkBrowseAbandonment every 2h, daily-time crons every day) |
| `*/15 * * * *` | every 15 min | 2 | processEmailQueue + processChallengeNotifSMSQueue (always co-fire) |
| `*/30 * * * *` | every 30 min | 1 | syncInventoryFromStore (collides with the */15 jobs every 30 min) |
| `0 */6 * * *` | every 6h | 1 | refreshFacebookCatalog |

**Worst-case minute** = Monday 15:00 UTC: 6 weekly jobs + checkBrowseAbandonment (every 2h hits 14:00 and 16:00, NOT 15:00 — confirmed via `0 */2`) + triggerAbandonedCartRecovery (every hour, hits 15:00) + processEmailQueue + processChallengeNotifSMSQueue (every 15 min, hits :00) + syncInventoryFromStore (every 30 min, hits :00) → **9 simultaneous jobs**.

## Findings

### F1 (P2) — Monday 15:00 UTC concurrency cluster
**9 jobs fire simultaneously** (6 Monday-only + 3 always-on-hour). Wix Velo's documented job concurrency varies but real-world soft-cap is ~5. Likely failure: 4 jobs queued, processed minutes-late, possibly dropped if the runner times out.

**Fix:** Stagger the Monday jobs by ±1 min each. `triggerReengagement` to `0 14 * * 1` (already), `sendWeeklyDigestEmail` to `2 15 * * 1`, `scanAndTriggerWinback` to `4 15 * * 1`, `runReviewRequestEmails` to `6 15 * * *` (push the daily one off the cluster too). Same logical fire window, no thundering herd.

### F2 (P2) — Daily 13:00 UTC concurrency cluster
**4 jobs fire simultaneously** (price drops + delivery day-of + 2 white-glove). Two of those (`runWhiteGlove48hReminders` + `runWhiteGloveDayOfReminders`) live in the same module — they could be merged into one cron-fan-out function, halving the count.

**Fix:** Either (a) stagger by 1-2 min each, or (b) consolidate the two whiteGlove jobs into a single `runWhiteGloveReminders` that handles both 48h and day-of internally. (b) is cleaner code-wise.

### F3 (P2) — Daily 15:00 UTC concurrency cluster
**4 jobs fire simultaneously** (streak milestones + delivery 48h + daily challenge reminders + review request). On Mondays this becomes the F1 cluster of 6.

**Fix:** Stagger by 1 min each. They're all email/notification fan-outs; running 4 minutes earlier or later is invisible to customers.

### F4 (P1) — HTTP cron endpoints duplicate Wix-scheduler jobs
5 HTTP endpoints mirror Wix jobs:
- `triggerCartRecoveryCron` ↔ `triggerAbandonedCartRecovery`
- `processEmailQueueCron` ↔ `processEmailQueue`
- `triggerReengagementCron` ↔ `triggerReengagement`
- `scanAndTriggerWinbackCron` ↔ `scanAndTriggerWinback`
- `runReviewRequestEmailsCron` ↔ `runReviewRequestEmails`

Whether **both** schedulers fire the same function depends on whether anyone (Vercel cron, external curl, manual) invokes the HTTP endpoints. If yes: double-execution → doubled emails, double-queue-drain, etc. If no: HTTP endpoints are dormant fallback.

This is a P1 because: (a) double-execution of `processEmailQueue` could double-send queued emails to customers, and (b) we genuinely don't know which scheduler is canonical.

**Fix:**
1. Audit external schedulers (UptimeRobot? Vercel cron? a manual curl from someone's laptop?). The Vercel cron config in `vercel.json` would be the obvious place — confirm whether it points at any of these endpoints.
2. Pick one canonical scheduler per duplicate; delete the other side OR add a no-op guard to one based on a feature flag.
3. Document the canonical surface in `jobs.config` header comments AND each HTTP-cron endpoint's docstring.

Recommendation: **Wix-scheduler as canonical for queue-drain operations** (processEmailQueue, triggerAbandonedCartRecovery) since Wix runs them in the same data plane as the queue rows. **HTTP endpoint as canonical for marketing operations that benefit from external timezone control** (winback, review-request) — but this is a PM call, not a code-only decision.

### F5 (P3) — HTTP cron endpoints with no Wix-job mirror and no known external trigger
4 endpoints I couldn't trace to any scheduler:
- `get_processPostPurchaseCareCron`
- `get_processContentScheduleCron`
- `get_cleanupRateLimitCron`
- `get_processNotificationQueueCron`
- `get_weeklyBlogDigestCron`

These have X-Cron-Secret guards (so they're auth-gated) and live cron-shaped code, but I didn't find a `vercel.json` cron entry, a UptimeRobot config in this repo, or a Wix Automation that targets them. Could be:
- (a) Scheduled by an external Vercel cron config in `carolina-futons-web` repo I haven't grepped
- (b) Manual invocations only (operator runs them ad-hoc)
- (c) Truly dormant — feature shipped but never wired to a schedule

**Fix:** Audit + classify. Each falls into the "alive (and where)" / "dormant — wire it" / "dead — delete it" categories. Concrete next step: grep `carolina-futons-web/vercel.json` and `.github/workflows/*.yml` for these endpoint names.

## Out of scope (file separately if needed)

- **Vercel cron config audit** — touches the cfw repo, separate scope. Quick complement to F4/F5.
- **Wix Automations dashboard audit** — Stilgar-only inspection (Wix dashboard). The cf-c6g5 / cf-w1u1 / cf-jvut staging probes can hit this incidentally if Stilgar checks "Triggered Emails → Sent History" for double-fires.
- **Per-job concurrency safety** — even within a single job, if it processes a queue, a slow run + next fire could overlap. Out of scope; would need per-job audit + locking analysis.

## Pre-cutover acceptance

Before DNS flip (cf-3qt.8):
- [ ] **F4** resolved — pick canonical scheduler per duplicate, document, delete or guard the other
- [ ] **F1/F2/F3** mitigated — stagger collisions or consolidate (whiteGlove merger is a clean low-risk fix)
- [ ] **F5** classified — every HTTP cron is alive-and-scheduled OR explicitly dormant-with-doc OR dead-and-deleted

If the cutover ships with F4 unresolved, double-fire risk lands the moment Vercel cron credentials roll over to production.

## References

- `src/backend/jobs.config` — Wix Jobs Scheduler config
- `src/backend/http-functions.js` — HTTP cron endpoints (search `[Cc]ron`)
- cf-4x7e.fu1 (already merged) — earlier sweep that removed 2 dead jobs (`dailySocialStories`, `dailyContentRotation`) pointing at retired `socialStoryScheduler.web.js`
- cf-3qt.8 — DNS cutover bead this audit feeds into
- Companion audits: cf-icww (email touchpoints), cf-jqkg (cfw→Velo HTTP gaps), cf-mgnh (lying-status), cf-3pwy (V1/V3 SDK split)
