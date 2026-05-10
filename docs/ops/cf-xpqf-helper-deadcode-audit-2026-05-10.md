# cf-xpqf — Backend non-webMethod helpers dead-code audit

**Bead**: cf-xpqf · **Author**: cfutons/crew/morgott · **Date**: 2026-05-10

## Goal

Pass-4 follow-on to cf-4x7e Pass 2 (which retired 128 dead webMethods, −29,430 LOC across 16 chunks). cf-4x7e was scoped to `.web.js` files only — the 35 non-webMethod backend helpers under `src/backend/` had not been swept. This audit classifies all 35 and recommends actions.

## Methodology

For each `src/backend/**/*.js` file that is NOT a `*.web.js` webMethod container:

1. **Static-import grep** across cfutons monorepo + carolina-futons-stage3-velo + carolina-futons-web for `from '<path>'` and `require('<path>')`.
2. **Dynamic-import grep** for `await import('<path>')` (the bare-grep step missed these in the first pass — they're load-bearing for several files).
3. **Velo entry-point convention check** — Velo auto-discovers files at fixed backend paths regardless of imports:
   - `backend/http-functions.js` (single root file; sub-files like `backend/leaderboard-http.js` are reached only via re-export).
   - `backend/events.js` (Velo event handlers — `wixEcom_*`, `wixMembers_*`, etc.).
   - `backend/shipping-rates-plugin.js` (Velo shipping rates plugin).
4. **Cross-rig drift** — note files where cfutons has importers but stage3-velo does not (recent additions awaiting publish, NOT dead code).

## Classification table

| File | cf hits | s3 hits | cfw hits | Class | Action |
|---|---:|---:|---:|---|---|
| `src/backend/blogContent.js` | 5 | 6 | 0 | IMPORTED-LIBRARY | keep |
| `src/backend/cms/backfillChallengeLedger.js` | 0 | 0 | 0 | POST-MIGRATION | confirm-then-delete (Stilgar confirms migration ran) |
| `src/backend/cms/backfillPointsLedger.js` | 0 | 0 | 0 | POST-MIGRATION | confirm-then-delete |
| `src/backend/cms/ensureIndexes.js` | 0 | 0 | 0 | POST-MIGRATION | confirm-then-delete |
| `src/backend/events.js` | 1 | 1 | 10 | ENTRY-POINT (Velo events) | keep |
| `src/backend/http-functions.js` | 3 | 3 | 0 | ENTRY-POINT (Velo HTTP root) | keep |
| `src/backend/klarna-http.js` | 0 | 0 | 0 | **TRUE-DEAD** | delete |
| `src/backend/leaderboard-http.js` | 1 | 1 | 0 | IMPORTED-LIBRARY (re-exported by http-functions.js:30) | keep |
| `src/backend/lifecycleEmailTemplates.js` | 0 | 0 | 0 | **TRUE-DEAD** | delete |
| `src/backend/shipping-rates-plugin.js` | 0 | 0 | 0 | ENTRY-POINT (Velo shipping plugin) | keep |
| `src/backend/utils/analyticsEvents.js` | 6 | 6 | 0 | IMPORTED-LIBRARY | keep |
| `src/backend/utils/auditLog.js` | 41 | 42 | 0 | IMPORTED-LIBRARY (heavy) | keep |
| `src/backend/utils/catalogCategories.js` | 3 | 0 | 0 | IMPORTED-LIBRARY (cfutons-only — recent extraction; stage3 lags) | keep |
| `src/backend/utils/chatbotContext.js` | 1 | 0 | 0 | IMPORTED-LIBRARY (cfutons-only) | keep |
| `src/backend/utils/cors.js` | 1 | 1 | 0 | IMPORTED-LIBRARY | keep |
| `src/backend/utils/crossRigSyncUtils.js` | 1 | 0 | 0 | IMPORTED-LIBRARY (cfutons-only) | keep |
| `src/backend/utils/dateUtils.js` | 7 | 6 | 0 | IMPORTED-LIBRARY | keep |
| `src/backend/utils/errorHandler.js` | 56 | 45 | 0 | IMPORTED-LIBRARY (heavy) | keep |
| `src/backend/utils/eventBus.js` | 2 | 2 | 0 | IMPORTED-LIBRARY | keep |
| `src/backend/utils/eventBusDispatcher.js` | 1 | 1 | 0 | IMPORTED-LIBRARY | keep |
| `src/backend/utils/gamificationRateLimit.js` | 0 | 0 | 0 | **DYNAMIC-IMPORT-LIVE** (`await import('backend/utils/gamificationRateLimit')` in `http-functions.js`) | keep |
| `src/backend/utils/httpHelpers.js` | 1 | 2 | 0 | IMPORTED-LIBRARY | keep |
| `src/backend/utils/localSeoData.js` | 2 | 2 | 0 | IMPORTED-LIBRARY | keep |
| `src/backend/utils/loyaltyData.js` | 1 | 1 | 0 | IMPORTED-LIBRARY | keep |
| `src/backend/utils/mediaHelpers.js` | 6 | 4 | 0 | IMPORTED-LIBRARY | keep |
| `src/backend/utils/memberPointsLedger.js` | 4 | 3 | 0 | IMPORTED-LIBRARY | keep |
| `src/backend/utils/pendingNotifications.js` | 0 | 0 | 0 | **DYNAMIC-IMPORT-LIVE** (`await import('backend/utils/pendingNotifications')` in `notificationService.web.js` + `http-functions.js`) | keep |
| `src/backend/utils/queryAll.js` | 1 | 0 | 0 | IMPORTED-LIBRARY (cfutons-only) | keep |
| `src/backend/utils/rateLimit.js` | 44 | 43 | 0 | IMPORTED-LIBRARY (heavy) | keep |
| `src/backend/utils/safeParse.js` | 4 | 4 | 0 | IMPORTED-LIBRARY | keep |
| `src/backend/utils/sanitize.js` | 143 | 135 | 2 | IMPORTED-LIBRARY (very heavy; 2 cfw refs are `validateEmail` + similar shared utilities) | keep |
| `src/backend/utils/shippingZones.js` | 3 | 3 | 0 | IMPORTED-LIBRARY | keep |
| `src/backend/utils/topicClusterData.js` | 2 | 2 | 0 | IMPORTED-LIBRARY | keep |
| `src/backend/utils/unsubToken.js` | 2 | 1 | 0 | IMPORTED-LIBRARY | keep |
| `src/backend/utils/validateSchema.js` | 5 | 5 | 0 | IMPORTED-LIBRARY | keep |

## Summary

| Class | Count | Files |
|---|---:|---|
| ENTRY-POINT | 3 | `http-functions`, `events`, `shipping-rates-plugin` |
| IMPORTED-LIBRARY | 25 | (heavy: `sanitize` 143, `errorHandler` 56, `rateLimit` 44, `auditLog` 41) |
| DYNAMIC-IMPORT-LIVE | 2 | `gamificationRateLimit`, `pendingNotifications` |
| **TRUE-DEAD** | **2** | `klarna-http`, `lifecycleEmailTemplates` |
| POST-MIGRATION | 3 | `cms/backfillChallengeLedger`, `cms/backfillPointsLedger`, `cms/ensureIndexes` |
| **Total** | **35** | |

## Per-file findings: TRUE-DEAD

### `src/backend/klarna-http.js` (319 LOC)
Exports `post_klarna_checkout` + `post_klarna_confirm` — Velo HTTP function wrappers. The Velo HTTP discovery convention only auto-loads functions at `backend/http-functions.js`; sub-files like `klarna-http.js` are reachable only via re-export. **`http-functions.js` does not re-export the klarna routes.** Zero importers, zero dynamic imports, zero re-exports → unreachable from production. Klarna integration appears to have never been wired or was retired without removing the wrapper file.

**Recommended**: whole-file delete + any test file that targets it (none currently exist per `find tests -name "klarna*"`).

### `src/backend/lifecycleEmailTemplates.js` (~150 LOC)
HTML email template generators (`day7Care`, `month1CheckIn`, `year1Anniversary`). Per docstring: "Used by the lifecycle cron (CF-3izl.1) to send emails at scheduled intervals." The CF-3izl crons in `jobs.config` (lines 146 + 153) point to `lifecycleCron.web.js` and `lifecycleEmailSender.web.js` — but **neither imports lifecycleEmailTemplates.js**. The templates have been re-implemented inside the cron files or routed through TEMPLATE_ID_MAP / triggered emails. Original orchestration flow has decoupled.

**Recommended**: whole-file delete + any test file (none currently exist).

## Per-file findings: POST-MIGRATION (confirm-then-delete)

The 3 `cms/` files all carry self-describing "one-shot migration" docstrings:

- `backfillChallengeLedger.js`: populates `memberChallengeKey` on existing PointsLedger rows pre-cf-ipg unique-index work
- `backfillPointsLedger.js`: populates `memberMilestoneKey` pre-cf-7mr unique-index work
- `ensureIndexes.js`: creates the corresponding unique indexes; idempotent

Designed to run once. After running, they are conceptually dead — but verifying that they have run requires Stilgar / Wix Dashboard inspection (have the unique indexes been created? have the rows been backfilled?). **Not deletable on grep alone.**

**Recommended**: file follow-on bead requesting Stilgar confirmation that all 3 migrations have completed in production. Once confirmed, whole-file delete in a single PR.

## Implementation plan (child beads)

Two confirmed-dead deletions filed alongside this audit, plus one confirm-then-delete:

| Bead | Scope | LOC | Confidence |
|---|---|---:|---|
| cf-xpqf.1 | delete `src/backend/klarna-http.js` | ~320 | high |
| cf-xpqf.2 | delete `src/backend/lifecycleEmailTemplates.js` | ~150 | high |
| cf-xpqf.3 | confirm + delete the 3 `cms/` migration scripts | ~250 | requires Stilgar |

cf-xpqf.1 + .2 land in this same PR (this is the audit + first 2 deletions). cf-xpqf.3 is filed for follow-on once Stilgar confirms migration completion in production.

## Cross-rig publish note

stage3-velo also mirrors `klarna-http.js` and `lifecycleEmailTemplates.js`. The next monorepo→stage3 publish picks up the deletions automatically (no special action required, no jobs.config or http-functions wiring relies on these files in either rig).

## Methodology limitations (for future audits)

- **Bare-name false positives**: avoided here by grepping the basename inside `from '<...>'` quotes only. Confirmed clean by the v3.2 detector pattern (post-cf-sq0d.fu2 JSDoc-strip + same-name-collision filter).
- **Dynamic-import gap**: the first pass missed `await import(...)` because it grepped only `from '...'`. Two files (`gamificationRateLimit`, `pendingNotifications`) were initially mis-classified as DEAD; corrected after re-grep with both shapes. Future audits MUST grep both static `from` and dynamic `import()` syntax.
- **Velo filename conventions**: Velo discovers `http-functions.js`, `events.js`, `shipping-rates-plugin.js`, and `backend/cron/*` (if used) by filename, regardless of importers. These need an explicit ENTRY-POINT lane in any extension of cf-hpwy detector to avoid false-DEAD classifications.

## Refs
- Parent bead: cf-xpqf
- Predecessor: cf-4x7e Pass 2 (16 chunks, 128 webMethods, −29,430 LOC)
- Detector: cf-hpwy / cf-sq0d (audit.py v3.2 — webMethod-scoped, doesn't currently classify non-webMethod helpers)
