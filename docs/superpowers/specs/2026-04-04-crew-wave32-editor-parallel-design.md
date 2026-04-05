# Wave 32: Crew Feature Work — Parallel to Editor Hookup

**Date**: 2026-04-04
**Author**: melania (PM)
**Status**: APPROVED — Stilgar authorized autonomous dispatch
**Context**: Stilgar is wiring masterPage, Home, and Product Page in the Wix Studio editor. 6 crew on Linux (pop-os) need productive work that does NOT require editor hookup.

---

## Constraint

All work in this wave MUST be:
- Pure backend/public module code (no `$w('#element')` wiring needed)
- Testable via `npx vitest run` (TDD required)
- Non-blocking to editor hookup
- Mergeable to main independently

## Crew Assignments

### PAIR 1: radahn + rennala — Cross-Rig Dallas Unblocks

**Goal**: Unblock dallas (cfutons_mobile) Phase 2 ports per the finalized cross-platform spec.

**radahn — VideoReviews upload endpoint + subscriberDeviceToken**

| Task | Details |
|---|---|
| Add `subscriberDeviceToken` field to PriceAlerts collection | Text field, indexed. Used by mobile push notifications for price drop alerts. Bishop (dallas crew) already built the push handler (PR #424). |
| Document VideoReviews upload API contract | `videoReviewService.web.js` accepts mediaUrl (Wix Media Manager URI). Document the exact call sequence: mobile uploads to Wix Media → gets URI → calls submitVideoReview. Add input validation for mediaUrl format. |
| Add integration test coverage | Test subscriberDeviceToken persistence, validate mediaUrl format rejection for non-wix URIs. |

**Bead**: Create new bead for dallas unblock work.
**Review pair**: rennala reviews radahn, radahn reviews rennala.

**rennala — Portable loyaltyTiers config + loyalty API hardening**

| Task | Details |
|---|---|
| Write `src/public/loyaltyTiers.ts` | Pure TypeScript port of tier/points/badge config from `gamificationTokens.js`. Zero Wix imports, zero RN imports. Dallas crew imports this directly. Must match gamificationTokens.js values exactly. |
| Harden loyalty API endpoints for mobile consumption | Review `loyaltyService.web.js`, `rewardEngine.web.js` for mobile edge cases: null deviceToken, missing memberId, concurrent point writes. Add guards + tests. |
| Send completed loyaltyTiers.ts to dallas | Via gt mail when merged. |

**Bead**: Create new bead for loyalty portability work.

---

### PAIR 2: blaidd + millicent — Revenue Prep (Wave 31 Epic 2+3)

**Goal**: Backend infrastructure for conversion intelligence and marketing automation. Ready to wire when editor hookup completes.

**blaidd — Conversion Funnel Analytics Backend**

| Task | Details |
|---|---|
| `src/backend/conversionFunnel.web.js` | Track funnel stages: page_view → product_view → add_to_cart → checkout_start → purchase. Store in `FunnelEvents` CMS collection. |
| `src/backend/abTestResults.web.js` | Aggregate A/B test results: variant impressions, conversions, revenue per variant. Statistical significance calculation (chi-squared). |
| `src/public/funnelTracker.js` | Client-side funnel event emitter. Calls backend on each stage transition. Debounced, session-aware. |
| CMS collection: `FunnelEvents` | memberId, sessionId, stage, productId, timestamp, experimentId, variantId |
| Tests | Full coverage: funnel stage transitions, duplicate prevention, A/B result aggregation, significance edge cases. |

**Bead**: Create from Wave 31 Epic 2.

**millicent — Email Marketing Automation**

| Task | Details |
|---|---|
| `src/backend/marketingSequences.web.js` | Lifecycle email sequences: welcome (day 0), cart abandon (1hr), post-purchase (day 3), review request (day 7), winback (day 30). CMS-driven templates. |
| `src/backend/emailQueueService.web.js` | Queue-based email sender with dedup, rate limiting (reuse existing `checkRateLimit`), and send window (9am-8pm ET). |
| CMS collections: `EmailSequences`, `EmailQueue` | Sequence definitions + queued sends with status tracking. |
| Tests | Sequence trigger logic, dedup across sessions, rate limit integration, time window enforcement. |

**Bead**: Create from Wave 31 Epic 3.

---

### SOLO: morgott — SEO Content Optimization

**Goal**: Improve organic search readiness for launch.

| Task | Details |
|---|---|
| `src/backend/seoAutoMeta.web.js` | Auto-generate meta descriptions for products missing custom descriptions. Use product name + category + key specs. |
| Enhance `src/backend/googleMerchantFeed.web.js` | Add missing fields: GTIN (if available), product_type hierarchy, shipping weight, sale_price_effective_date. |
| `src/backend/sitemapEnhancer.web.js` | Add lastmod dates from CMS, priority hints (home=1.0, products=0.8, guides=0.6), image sitemap entries. |
| Tests | Meta generation edge cases (missing fields, XSS in product names), feed validation, sitemap XML structure. |

**Bead**: Create new bead.

---

### SOLO: godfrey — Test Hardening

**Goal**: Reduce mock coverage gap baseline and raise branch coverage on critical paths.

| Task | Details |
|---|---|
| Run `node scripts/check-mock-coverage.mjs --verbose` | Identify top 10 files with most missing mocks. Add mocks to reduce baseline from 370 toward 350. |
| Branch coverage audit | Find files below 80% branch coverage in critical paths (checkout, cart, loyalty, referral). Write missing branch tests. |
| Fix any flaky tests | Date-sensitive tests, timezone issues, race conditions. |

**Bead**: Create new bead for test hardening.

---

## Cross-Rig Coordination

- **dallas notified** via mail: radahn adding subscriberDeviceToken, rennala writing loyaltyTiers.ts. Dallas will be nudged when PRs land.
- **No convoy with dallas crew** — different stack (RN vs Wix Velo), same GitHub account blocks cross-PR review.
- **Coordination is spec/schema level only** — shared CMS collections, shared API contracts.

## Success Criteria

- [ ] subscriberDeviceToken field added to PriceAlerts, tested, merged
- [ ] VideoReviews upload API documented with validation tests
- [ ] loyaltyTiers.ts passes type-check, values match gamificationTokens.js exactly
- [ ] FunnelEvents collection + backend pipeline merged with full test coverage
- [ ] EmailSequences + EmailQueue collections + queue service merged with tests
- [ ] SEO meta generation + merchant feed enhancements merged
- [ ] Mock coverage baseline reduced by ≥20 (370 → ≤350)
- [ ] All PRs pass CI before merge

## Timeline

All work is independent and can start immediately. Expected: 1-2 PRs per dev within this session or next. melania reviews all PRs (5-agent review protocol).
