# Velo Dead-Route Detector — 2026-05-09 (cf-hpwy)

> Static-analysis sweep matching the cf-w1lg drift-discovery pattern: parse all `webMethod()` exports in `src/backend/**/*.web.js`, cross-reference against `src/backend/http-functions.js` HTTP wrappers AND `carolina-futons-web/src` consumer code, classify every webMethod into actionable buckets.
>
> Repo target: `cfutons` monorepo (Velo source-of-truth). No `carolina-futons-web` runtime impact (cfutons + stage3-velo don't deploy to Vercel).

## Headline

**23 webMethods are GAP-CFW-WANTS** — cfw calls them via `callVelo` or `/_functions/<name>` URL but no HTTP wrapper exists in `http-functions.js`. These calls 404 in production unless a generic Velo dispatcher exists (none found). All 23 cluster in **6 files**, all member-area features:

| File | Methods | Notes |
|---|---|---|
| `loyaltyService.web.js` | 10 | `getMyLoyaltyAccount`, `getAvailableRewards`, `getLoyaltyTiers`, `getMyStreakData`, `getChallengeCatalog`, `getMyDailyQuests`, `getMyAchievements`, `getMyActivity`, `getMyBurnRate`, `getChallengeLeaderboard` |
| `gamificationCore.web.js` | 4 | `recoverStreak`, `getStreakData`, `getMemberTier`, `getActivityFeed` |
| `wishlistService.web.js` | 3 | `addToWishlist`, `getWishlist`, `getWishlistByMemberId` |
| `styleQuiz.web.js` | 3 | `getQuizRecommendations`, `getPersonalizedCopy`, `captureQuizLead` |
| `pushNotificationService.web.js` | 2 | `managePushPreferences`, `getMyPushPreferences` |
| `rewardsStore.web.js` | 1 | `redeemReward` |

cfw call sites are concentrated in `src/app/actions/{loyalty,gamification,preferences,style-quiz}.ts` using the `callVelo({ method: g("name") })` helper from `src/lib/wix/velo-client.ts`. The helper builds `/_functions/<MODULE>/<METHOD>` URLs which cannot resolve to any handler in http-functions.js (no `post_loyaltyService`, etc., and no namespace dispatcher).

**Implication**: every member-area Velo call from cfw production currently 404s. This is exactly the cf-w1lg pattern at scale — fix once via a generic dispatcher OR per-method wrappers.

## Full classification

| Verdict | Count | Meaning |
|---|---:|---|
| 🚨 **GAP-CFW-WANTS** | **23** | cfw calls via `/_functions/*` or `callVelo` but no HTTP wrapper exists |
| 🔴 UNUSED-CAN-DELETE | 518 | No caller anywhere in cfutons or cfw |
| ⚪ VELO-INTERNAL | 383 | Used by Wix Studio pages (`src/pages/*`), `src/public/*`, events handlers, or other webModules |
| 🟡 WRAPPED-NO-CONSUMER | 35 | HTTP wrapper exists but cfw doesn't call it |
| 🟠 MAYBE-CFW-NAME-COLLISION | 28 | Bare `\bNAME\b` match in cfw, no URL or callVelo signal — possible name collision |
| 🟢 OK-WIRED | 5 | HTTP wrapper exists AND cfw calls it via URL/callVelo |

Total: 992 webMethods across 222 `.web.js` files; 54 HTTP wrappers in `http-functions.js`; 658 cfw source files scanned.

## Detailed GAP-CFW-WANTS table

| webMethod | File:Line | Permission | cfw call site (sample) |
|---|---|---|---|
| `getQuizRecommendations` | `styleQuiz.web.js:59` | Anyone | `src/lib/wix/style-quiz.ts` |
| `getPersonalizedCopy` | `styleQuiz.web.js:285` | Anyone | `src/lib/wix/style-quiz.ts` |
| `captureQuizLead` | `styleQuiz.web.js:310` | Anyone | `src/lib/wix/style-quiz.ts` |
| `recoverStreak` | `gamificationCore.web.js:989` | SiteMember | `src/app/actions/gamification.ts` |
| `getStreakData` | `gamificationCore.web.js:1063` | SiteMember | `src/app/actions/gamification.ts` |
| `getMemberTier` | `gamificationCore.web.js:1182` | SiteMember | `src/app/actions/gamification.ts` |
| `getActivityFeed` | `gamificationCore.web.js:1220` | SiteMember | `src/app/actions/gamification.ts` |
| `getMyLoyaltyAccount` | `loyaltyService.web.js:53` | SiteMember | `src/app/actions/loyalty.ts` |
| `getAvailableRewards` | `loyaltyService.web.js:92` | SiteMember | `src/app/actions/loyalty.ts` |
| `getLoyaltyTiers` | `loyaltyService.web.js:174` | Anyone | `src/app/actions/loyalty.ts` |
| `getMyStreakData` | `loyaltyService.web.js:205` | SiteMember | `src/app/actions/loyalty.ts` |
| `getChallengeCatalog` | `loyaltyService.web.js:310` | SiteMember | `src/app/actions/loyalty.ts` |
| `getMyDailyQuests` | `loyaltyService.web.js:475` | SiteMember | `src/app/actions/loyalty.ts` |
| `getMyAchievements` | `loyaltyService.web.js:634` | SiteMember | `src/app/actions/loyalty.ts` |
| `getMyActivity` | `loyaltyService.web.js:857` | SiteMember | `src/app/actions/loyalty.ts` |
| `getMyBurnRate` | `loyaltyService.web.js:929` | SiteMember | `src/app/actions/loyalty.ts` |
| `getChallengeLeaderboard` | `loyaltyService.web.js:1040` | SiteMember | `src/app/actions/loyalty.ts` |
| `redeemReward` | `rewardsStore.web.js:134` | SiteMember | `src/app/actions/loyalty.ts` |
| `managePushPreferences` | `pushNotificationService.web.js:154` | SiteMember | `src/app/actions/preferences.ts` |
| `getMyPushPreferences` | `pushNotificationService.web.js:209` | SiteMember | `src/app/actions/preferences.ts` |
| `addToWishlist` | `wishlistService.web.js:47` | SiteMember | `src/app/actions/wishlist.ts` |
| `getWishlist` | `wishlistService.web.js:142` | SiteMember | `src/app/actions/wishlist.ts` |
| `getWishlistByMemberId` | `wishlistService.web.js:178` | Anyone | `src/app/wishlist-share/page.tsx` |

### Suggested fix paths (in order of effort)

**Option A — Generic namespaced dispatcher (lowest effort, highest blast radius)**

Add `post_dispatch` to `http-functions.js` that takes `request.path` and dispatches to the named webMethod. Pseudocode:

```js
import * as gamificationCore from 'backend/gamificationCore.web';
import * as loyaltyService from 'backend/loyaltyService.web';
// ... etc.

const MODULES = { gamificationCore, loyaltyService, /* ... */ };

export async function post_dispatch(request) {
  const [moduleName, methodName] = request.path;
  const mod = MODULES[moduleName];
  if (!mod || typeof mod[methodName] !== 'function') return notFound({ ... });
  const { args } = JSON.parse(await request.body.text());
  const result = await mod[methodName](...(args ?? []));
  return ok({ body: JSON.stringify(result), headers: corsHeaders(request, ...) });
}
```

Then update `velo-client.ts` to call `/_functions/dispatch/<module>/<method>` instead of `/_functions/<module>/<method>`. Closes 23 gaps in one PR. Caveat: every webMethod's `Permissions.X` is bypassed by HTTP — the dispatcher must enforce auth itself. Use the bearer-token Authorization the client already sends.

**Option B — Per-method wrappers (cf-w1lg pattern)**

Add 23 `post_<methodName>` exports to `http-functions.js`, one per gap. More verbose, more boilerplate, but mirrors the existing pattern for `contactSubmissions` / `sampleRequests` / `mailingListSignups` exactly. Each wrapper validates body, checks rate limit if Anyone-permissioned, calls the underlying webMethod, maps return-value to status. Estimated 200–300 LOC.

**Option C — Drop the cfw-side calls**

If member-area Velo calls are not actually used in production (e.g., the dashboard pages render but never fetch live data, or member features are gated behind unset env flags), rip out the call sites. `git log` on the call sites should reveal which.

Recommended: **Option A** as a single follow-up PR. Wire all 23 with one dispatcher + auth check. cf-3qt Phase 9 retirement plan can then assume cfw → Velo member calls are infrastructure, not per-PR-effort.

## WRAPPED-NO-CONSUMER (35) — possibly orphaned wrappers

HTTP wrappers exist in `http-functions.js` but no cfw URL/callVelo reference. Some are intentionally Wix Studio-callable only (e.g., `runGarbageCollection`, `triggerAbandonedCartRecovery`); others may be orphans from cfw migration partial-rip-out:

`sendWeeklyBlogDigest`, `triggerBrowseRecovery`, `addBundleToCart`, `listBundles`, `getBundleBySlug`, `runGarbageCollection`, `processContentSchedule`, `getDeliveryZone`, `triggerAbandonedCartRecovery`, `triggerReengagement`, `processEmailQueue`, `unsubscribeContact`, `getCampaignAnalytics`, `submitSwatchRequest`, `sendEmail`, `exportCustomerAudienceData`, `generateFeed`, `sendMonthlyLoyaltyStatements`, `triggerPostPurchaseSequence`, `runReviewRequestEmails`, `scanAndTriggerWinback`, `getImageUrl`, `subscribeToNewsletter`, `recordPriceSnapshots`, `checkWishlistAlerts`, `getAssemblyFollowUpData`, `subscribe`, `unsubscribe`, `submitQuestion`, `answerQuestion`, `getProductQuestions`, `insertGuestQuestion`, `buildSitemapXml`, `getRobotsTxtContent`, `getSitemapData`.

Triage: cron/admin endpoints (`runGarbageCollection`, `processEmailQueue`, etc.) are legit. cfw-replaced ones (`buildSitemapXml`, `getSitemapData` — cfw has its own sitemap; `getProductQuestions` — cfw has PdpQA via `productQAService`) are deletion candidates after stage3-velo retires (cf-3qt Phase 9). Defer triage until then.

## UNUSED-CAN-DELETE (518) — no caller anywhere

53% of webMethods. **Top files concentrating dead code** (file:method-count):

| Methods | File |
|---:|---|
| 18 | `emailTemplates.web.js` |
| 13 | `tradeProgram.web.js` |
| 9 | `bundleBuilder.web.js` |
| 9 | `affiliateProgram.web.js` |
| 8 | `subscriptionService.web.js` |
| 8 | `emailAutomation.web.js` |
| 8 | `errorMonitoring.web.js` |
| 8 | `pinterestCatalogSync.web.js` |
| 7 | `wishlistAlerts.web.js`, `dataService.web.js`, `socialStoryScheduler.web.js`, `coreWebVitals.web.js`, `warrantyService.web.js`, `mediaGallery.web.js`, `liveShopping.web.js` |

Permission breakdown of dead methods: 202 Admin / 193 Anyone / 133 SiteMember.

Deletion is safe **only after** confirming via dynamic-import / `wixWebMethods.invoke` grep — those patterns string-key webMethods and would not be caught by static grep. Most cfutons code uses static imports, so the false-positive risk is low; spot-check before each deletion.

## SUSPICIOUS — Permissions.Anyone + public-verb name + no HTTP wrapper

11 truly-dead-and-public-named webMethods are deletion-or-wire candidates:

`submitFabricSampleRequest` (likely supplanted by cf-w1lg's `post_sampleRequests`), `sendSwatchConfirmationEmail` (dead — should fire after swatch request), `trackVideoView`, `trackBundleImpression`, `trackComparison`, `trackAffiliateClick`, `trackEngagement`, `generateBlogRssFeed`, `generateInternalLinks`, `generateRoomPrepChecklist`, `generatePinContent`.

Plus 3 Permissions.Anyone webMethods that are actually internal-only — overly broad permission, should drop to caller's permission level: `cartSessionService.createSession`, `cartSessionService.updateCartItems`, `ups-shipping.trackShipment`.

## Method (audit script)

```
scripts/cf-dead-routes/audit.py:
  1. Walk src/backend/**/*.web.js → collect every `export const NAME = webMethod(Permissions.X, ...)`
  2. Scan src/backend/http-functions.js for `post_NAME` / `get_NAME` exports
  3. Scan src/backend/events.js + *.events.js for NAME references
  4. Scan all .js/.ts/.jsx/.tsx in src/ for NAME references (FRONTEND vs INTERNAL classification)
  5. Cross-rig: scan /Users/hal/gt/carolina-futons-web/src for:
     - HIGH confidence: `/_functions/<NAME>` URL OR `method: "<...>/<NAME>"` OR `g("<NAME>")` patterns
     - LOW confidence: bare `\bNAME\b` references (name-collision risk)
  6. Classify into HTTP-EXPOSED / EVENT-WIRED / FRONTEND / INTERNAL / DEAD
  7. Cross with cfw to assign GAP-CFW-WANTS / OK-WIRED / WRAPPED-NO-CONSUMER /
     UNUSED-CAN-DELETE / VELO-INTERNAL / MAYBE-CFW-NAME-COLLISION
```

Re-runs cleanly from a fresh worktree of cfutons + cfw checked out alongside. Update `CFW_SRC` constant if cfw lives elsewhere.

## Recommended polecat sweeps

1. **🚨 Wire the 23 GAP-CFW-WANTS** (one bead, P0 if member-area features are user-facing in prod): pick Option A (generic dispatcher) for blast-radius efficiency. Estimated 1–2 hour PR including auth-pass-through + tests.

2. **Delete 11 SUSPICIOUS webMethods + tighten 3 INTERNAL-Anyone perms** (one bead, ~30 min).

3. **Triage 6 entirely-dead service files** (per-file decision beads): `tradeProgram`, `affiliateProgram`, `pinterestCatalogSync`, `socialStoryScheduler`, `liveShopping`, `warrantyService`. Keep / supersede / delete?

4. **`emailTemplates.web.js` — 18 dead methods**: confirm whether superseded by `templateRegistry.web.js` (cf-c6g5 era) before action.

5. **Defer WRAPPED-NO-CONSUMER triage** until after cf-3qt Phase 9 (Wix Studio retirement) — many wrappers are intentional Wix-Studio-callable cron/admin endpoints that retire with stage3.

## Source artifacts

- `scripts/cf-dead-routes/audit.py` — runnable detector. Re-run after any `*.web.js`, `http-functions.js`, or cfw `actions/*.ts` change.
- `docs/velo-dead-routes-2026-05-09.md` — this report.
- Full per-method classification (992 rows): regenerable; not committed.

Refs cf-hpwy, cf-w1lg, cf-c6g5, cf-3qt Phase 9.
