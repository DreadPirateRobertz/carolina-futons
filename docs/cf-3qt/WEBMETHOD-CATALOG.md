---
epic: cf-3qt
phase: cf-3qt.2 (Next.js migration — commerce + account integration)
authors:
  - cfutons/crew/morgott (§ Stores · Cart · Checkout)
  - cfutons/crew/rennala (§ Member-scoped)
status: draft (morgott half TBD)
date: 2026-04-17
---

# cf-3qt WEBMETHOD CATALOG

Canonical list of Velo `webMethod` exports that the Next.js cf-3qt frontend
will call. Grouped by domain owner so we can parallelise Phase 2 wiring.

**Conventions**
- `S` = `Permissions.SiteMember` (requires OAuth member token)
- `A` = `Permissions.Anyone` (visitor or anonymous token OK)
- `X` = `Permissions.Admin` (excluded — Next.js won't call these)
- `file.web.js:NN` is the clickable source location.
- Identity notes flag whether the method reads `currentMember.getMember()`
  internally — these are the calls that need end-to-end validation once
  PKCE is wired (see cf-3qt.3 prep spec § 5).

## § Stores · Cart · Checkout — morgott

_(morgott to fill this section — Stores catalog, cart session, checkout,
orders, guest-checkout, shipping, tax, payments, coupons)_

## § Member-scoped — rennala

Total: **69 SiteMember + 23 Anyone** member-adjacent webMethods across
22 backend files. Highest-traffic calls for the member dashboard are
**bolded**.

### Wishlist (4 S + 1 A)

| Method | File | Perm | Signature | Identity |
|---|---|:-:|---|:-:|
| **`getWishlist`** | wishlistService.web.js:141 | S | `() → WishlistItem[]` | ✓ |
| `addToWishlist` | wishlistService.web.js:46 | S | `(productId) → {ok}` | ✓ |
| `removeFromWishlist` | wishlistService.web.js:106 | S | `(productId) → {ok}` | ✓ |
| `isOnWishlist` | wishlistService.web.js:174 | S | `(productId) → boolean` | ✓ |
| `resolveShareToken` | wishlistShare.web.js:115 | A | `(token) → {ownerName, items[]}` | — |

**Recommended as the first-slice OAuth proof** (simplest member-scoped read
with existing Playwright coverage — see cf-3qt.3 prep spec § 5).

### Wishlist Alerts (3 S + 1 A)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| `getAlertPrefs` | wishlistAlerts.web.js:414 | S | `() → {priceDropPct, backInStock, ...}` |
| `updateAlertPrefs` | wishlistAlerts.web.js:447 | S | `(prefs) → {ok}` |
| `getAlertHistory` | wishlistAlerts.web.js:491 | S | `() → AlertEvent[]` |
| `getPriceHistory` | wishlistAlerts.web.js:88 | A | `(productId) → {date, price}[]` |

### Loyalty — core (`loyaltyService`) (10 S + 1 A)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| **`getMyLoyaltyAccount`** | loyaltyService.web.js:53 | S | `() → {points, tier, nextTier, progress}` |
| **`getAvailableRewards`** | loyaltyService.web.js:92 | S | `() → Reward[]` |
| `redeemReward` | loyaltyService.web.js:123 | S | `(rewardId) → {ok, credit}` |
| `getLoyaltyTiers` | loyaltyService.web.js:174 | A | `() → Tier[]` |
| `getMyStreakData` | loyaltyService.web.js:205 | S | `() → {current, best, nextMilestone}` |
| `getLeaderboard` | loyaltyService.web.js:242 | S | `(scope) → LeaderboardEntry[]` |
| `getChallengeCatalog` | loyaltyService.web.js:310 | S | `() → Challenge[]` |
| `getMyDailyQuests` | loyaltyService.web.js:475 | S | `() → Quest[]` |
| `getMyAchievements` | loyaltyService.web.js:634 | S | `() → Achievement[]` |
| `getMyActivity` | loyaltyService.web.js:857 | S | `(limit?) → ActivityEntry[]` |
| `getMyBurnRate` | loyaltyService.web.js:929 | S | `() → {earnedPerMonth, redeemed, balance}` |
| `getChallengeLeaderboard` | loyaltyService.web.js:1040 | S | `(challengeId) → LeaderboardEntry[]` |

> **Collision note**: `redeemReward` also exported from `rewardsStore.web.js:134`.
> Next.js client should namespace imports to avoid ambiguity; confirm with
> morgott which one survives consolidation.

### Loyalty — marketing (`loyaltyMarketing`) (3 S + 5 A)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| `getTierExplainerData` | loyaltyMarketing.web.js:54 | A | `() → TierExplainer` |
| `getEnrollmentPrompt` | loyaltyMarketing.web.js:77 | A | `(context) → {variant, copy}` |
| `calculatePointsFromSpend` | loyaltyMarketing.web.js:395 | A | `(amount) → {base, bonus, total}` |
| `getLoyaltyFaq` | loyaltyMarketing.web.js:445 | A | `() → FaqEntry[]` |
| `enrollMember` | loyaltyMarketing.web.js:517 | S | `(payload) → {ok, memberId}` |
| `calculatePointsForOrder` | loyaltyMarketing.web.js:601 | A | `(orderPayload) → {points}` |
| `saveBirthday` | loyaltyMarketing.web.js:629 | S | `(date) → {ok}` |
| `getBirthdayStatus` | loyaltyMarketing.web.js:714 | S | `() → {hasSet, daysToNext}` |

### Loyalty — tiers + bonus

| Method | File | Perm | Signature |
|---|---|:-:|---|
| `getTier` | loyaltyTiers.web.js:82 | S | `() → Tier` |
| `calculateRewards` | loyaltyTiers.web.js:201 | S | `(orderTotal) → Reward[]` |
| `getAllTiers` | loyaltyTiers.web.js:258 | A | `() → Tier[]` |
| `getEarningConfig` | loyaltyBonusPoints.web.js:52 | A | `() → EarningConfig` |

### Store credit (5 S)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| **`getMyStoreCredit`** | storeCreditService.web.js:118 | S | `() → {balance, currency}` |
| `applyStoreCredit` | storeCreditService.web.js:185 | S | `(orderId, amount) → {ok, remaining}` |
| `getStoreCreditHistory` | storeCreditService.web.js:276 | S | `() → CreditEntry[]` |
| `giftStoreCredit` | storeCreditService.web.js:335 | S | `(toEmail, amount, note) → {ok}` |
| `getExpiringCredits` | storeCreditService.web.js:460 | S | `() → ExpiringEntry[]` |

### Points (history + expiry)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| `getRecentPointsHistory` | pointsHistoryService.web.js:41 | S | `(limit?) → PointsEntry[]` |
| `checkAndExpirePoints` | pointsExpiryService.web.js:78 | S | `() → {expired, remaining}` |
| `getExpiryWarning` | pointsExpiryService.web.js:156 | A | `(memberId?) → {daysToExpiry}` |

### Referrals (8 S + 1 A)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| `getReferralLink` | referralService.web.js:65 | S | `() → {url, code}` |
| `redeemReferralCode` | referralService.web.js:131 | S | `(code) → {ok, bonusPoints}` |
| `completeReferral` | referralService.web.js:186 | S | `(referralId) → {ok}` |
| `getMyReferrals` | referralService.web.js:300 | S | `() → ReferralEntry[]` |
| `getMyCredits` | referralService.web.js:337 | S | `() → {balance}` |
| `applyCredit` | referralService.web.js:373 | S | `(orderId, amount) → {ok, remaining}` |
| `getReferralStats` | referralService.web.js:432 | S | `() → {invited, accepted, rewarded}` |
| `getReferralLinkOwnerName` | referralService.web.js:492 | A | `(code) → {name}` |
| `getPostPurchaseRewardSummary` | referralService.web.js:651 | S | `() → Summary` |

### Gamification — core (`gamificationCore`)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| `getStreakData` | gamificationCore.web.js:1046 | S | `() → StreakData` |
| `getLeaderboard` | gamificationCore.web.js:1071 | A | `(scope) → LeaderboardEntry[]` |
| **`getMemberTier`** | gamificationCore.web.js:1158 | S | `() → Tier` |
| `getActivityFeed` | gamificationCore.web.js:1189 | S | `(limit?) → Event[]` |
| `getActiveChallengeOfWeek` | gamificationCore.web.js:1240 | A | `() → Challenge \| null` |

### Gamification — widgets (5 S + 2 A)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| `getGamificationStats` | gamificationWidgets.web.js:42 | S | `() → Stats` |
| `checkMilestoneProximity` | gamificationWidgets.web.js:98 | S | `() → {nearby: Milestone[]}` |
| `getRecentAchievements` | gamificationWidgets.web.js:157 | A | `(memberId?) → Achievement[]` |
| `getDailyQuests` | gamificationWidgets.web.js:205 | S | `() → Quest[]` |
| `getShareableProgress` | gamificationWidgets.web.js:251 | S | `() → ShareCard` |
| `getMilestones` | gamificationWidgets.web.js:305 | S | `() → Milestone[]` |
| `getWeeklyChallenge` | gamificationWidgets.web.js:362 | A | `() → Challenge` |

### Gamification — notifications + preferences

| Method | File | Perm | Signature |
|---|---|:-:|---|
| `getNotificationPrefs` | gamificationNotifs.web.js:45 | S | `() → Prefs` |
| `updateNotificationPrefs` | gamificationNotifs.web.js:100 | S | `(prefs) → {ok}` |
| `getMemberGamePreferences` | memberGamePreferences.web.js:62 | S | `() → GamePrefs` |
| `getChatGreeting` | gamificationChatbot.web.js:89 | A | `(context) → {text, ctas}` |

### Gamification — chips / badges / leaderboard

| Method | File | Perm | Signature |
|---|---|:-:|---|
| `getGamificationChipsForProducts` | gamificationChipService.web.js:50 | A | `(productIds[]) → {[id]: Chip[]}` |
| `getProductBadges` | badgeService.web.js:132 | A | `(productId) → Badge[]` |
| `getBatchProductBadges` | badgeService.web.js:175 | A | `(productIds[]) → {[id]: Badge[]}` |
| `getWhiteGloveBadge` | badgeService.web.js:245 | A | `(productId) → Badge \| null` |
| `awardBadge` | achievementBadgeService.web.js:50 | S | `(badgeId) → {ok}` |
| `getMemberBadges` | achievementBadgeService.web.js:102 | A | `(memberId?) → Badge[]` |
| `markBadgeNotified` | achievementBadgeService.web.js:131 | S | `(badgeId) → {ok}` |

### Leaderboards (4 A + 1 S)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| `getLeaderboard` | leaderboardService.web.js:57 | A | `(scope) → Entry[]` |
| `getTopEarners` | leaderboardService.web.js:112 | A | `(limit) → Entry[]` |
| `getLeaderboardByPeriod` | leaderboardService.web.js:214 | A | `(period) → Entry[]` |
| `getLeaderboardPreview` | leaderboardService.web.js:304 | A | `() → Entry[]` |
| **`getMyRank`** | leaderboardService.web.js:329 | S | `(scope?) → {rank, percentile}` |
| `getZipLeaderboard` | zipLeaderboard.web.js:49 | S | `(zip?) → Entry[]` |

> **Collision note**: `getLeaderboard` exists in 3 files
> (`loyaltyService`, `gamificationCore`, `leaderboardService`) with
> different scopes. Next.js import path must be explicit.

### Trails · Challenges · Quests

| Method | File | Perm | Signature |
|---|---|:-:|---|
| `getMyTrailProgress` | trailChallengeService.web.js:44 | S | `(trailId) → Progress` |
| `completeTrailChallenge` | trailChallengeService.web.js:74 | S | `(trailId, challengeId) → {ok, reward}` |
| `getTrailProgress` | challengeService.web.js:134 | S | `() → Progress` |
| `recordTrailChallengeCompletion` | challengeService.web.js:253 | S | `(trailId, challengeId) → {ok}` |
| `getAvailableTrailPerks` | trailPerkService.web.js:147 | A | `() → Perk[]` |
| `getPublicTrailPerkStatus` | trailPerkService.web.js:157 | A | `(perkId) → {claimed: n, total: m}` |
| `claimTrailPerk` | trailPerkService.web.js:190 | S | `(perkId) → {ok, perk}` |
| `getTrailPerkStatus` | trailPerkService.web.js:255 | S | `(perkId) → Status` |
| `saveQuestProgress` | questProgressService.web.js:42 | S | `(questId, delta) → {ok}` |
| `getQuestProgress` | questProgressService.web.js:103 | S | `(questId) → Progress` |
| `getActiveQuests` | questProgressService.web.js:145 | S | `() → Quest[]` |
| `getOnboardingProgress` | onboardingQuest.web.js:31 | S | `() → OnboardingState` |
| `completeOnboardingStep` | onboardingQuest.web.js:78 | S | `(stepId) → {ok, next}` |

### Rewards store (2 S + 1 A)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| `getRewardsCatalog` | rewardsStore.web.js:114 | A | `() → Reward[]` |
| `redeemReward` | rewardsStore.web.js:134 | S | `(rewardId) → {ok, fulfillment}` |
| `getRedemptionHistory` | rewardsStore.web.js:277 | S | `() → Redemption[]` |

### Perks — delivered

| Method | File | Perm | Signature |
|---|---|:-:|---|
| `getMemberDeliveredPerks` | rewardEngine.web.js:217 | S | `() → DeliveredPerk[]` |

## Member-scoped summary

| Domain | SiteMember | Anyone | Files |
|---|:-:|:-:|:-:|
| Wishlist | 4 | 1 | 2 |
| Wishlist Alerts | 3 | 1 | 1 |
| Loyalty (service + tiers + bonus) | 15 | 6 | 3 |
| Loyalty marketing | 3 | 5 | 1 |
| Store credit | 5 | 0 | 1 |
| Points | 2 | 1 | 2 |
| Referrals | 8 | 1 | 1 |
| Gamification core | 4 | 1 | 1 |
| Gamification widgets | 5 | 2 | 1 |
| Gamification notifs + prefs | 3 | 1 | 3 |
| Gamification badges + chips | 2 | 5 | 3 |
| Leaderboards | 2 | 4 | 2 |
| Trails · Challenges · Quests | 10 | 2 | 5 |
| Rewards store | 2 | 1 | 1 |
| Delivered perks | 1 | 0 | 1 |
| **Total (member-scoped slice)** | **69** | **31** | **28** |

## Cross-cutting concerns for the Next.js integration

1. **Method-name collisions** — `redeemReward` (2 files), `getLeaderboard`
   (3 files). Next.js must import from the specific Wix backend module
   path; consider a thin TypeScript wrapper that exposes the intended
   surface only.
2. **Pagination / cursor** — most `getMy*` methods return unbounded arrays
   today. Worth flagging to morgott whether Phase 2 wants to retrofit
   cursor pagination before Next.js wires them.
3. **`suppressAuth` footgun** — `gamificationCore` uses `suppressAuth: true`
   on wixData calls (cf-rzq 2026-03). When OAuth flows preserve member
   identity end-to-end, some of these can drop `suppressAuth`. Defer the
   cleanup but track it — low-priority tech debt row.
4. **Caching** — `Anyone` methods like `getRewardsCatalog`,
   `getAllTiers`, `getLoyaltyFaq` are read-mostly; Next.js should
   cache them server-side (revalidate on webhook or daily cron).
5. **`Admin`-scoped methods** are deliberately out of scope — Next.js
   dashboards live elsewhere (Wix Studio dashboard page or a separate
   admin SPA gated by a service account).

## Open questions

- Should Next.js speak to these via Wix's SDK (@wix/site-api) **or**
  a dedicated `/api/velo/*` proxy on the Next.js side that forwards
  bearer tokens? (Affects CORS + caching strategy.)
- Is there a single typed contract file we want to keep in sync (e.g.
  generate TS types from JSDoc), or accept drift + runtime validation?
- Rate-limit budget per access token — Wix docs don't publish explicit
  quotas; need Stilgar to confirm during OAuth App provisioning.
