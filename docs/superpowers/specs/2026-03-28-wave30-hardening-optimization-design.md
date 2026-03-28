# Wave 30 — Hardening & Optimization Design

**Author:** melania (PM) | **Date:** 2026-03-28
**Status:** FINAL — all crew input collected
**Proposals from:** rennala (3), miquella (3), godfrey (3), radahn (3), dallas (3) — 15 total

---

## Problem Statement

v1.2.0 shipped a massive feature set (153 backend modules, 50 pages, 34K+ tests, full gamification platform). The site audit revealed:

- 48 mutation endpoints lacked rate limiting — **FIXED** (PR #868, 30 endpoints)
- 52 failing tests across 8 files — **FIXED** (radahn, direct push)
- Price display fragmentation (4+ locations render prices without call-for-price guard)
- No CMS garbage collection (unbounded data growth)
- No audit trail for anonymous writes — **FIXED** (PR #869, 24 modules)
- Ad-hoc input validation (inconsistent across endpoints)
- Category name drift (no CI catches it) — **FIXED** (rennala, cf-blft)
- Cross-rig API contracts undefined (mobile depends on cfutons data)
- Test mock maintenance burden (recurring breakage pattern every wave)
- Shipping cost surprise at checkout (cart abandonment driver)

Wave 30 hardens what we built, then optimizes for conversion and cross-rig coordination.

---

## Architecture: Five Tracks, Three Phases

### Track A — Security & Data Integrity

| # | Feature | Owner | Status | Bead |
|---|---------|-------|--------|------|
| A1 | Rate-limit 30 endpoints | godfrey | **DONE** | cf-39ct (PR #868) |
| A2 | Unified price rendering guard | miquella | **IN PROGRESS** | cf-qgg0 |
| A3 | Centralized audit logging | godfrey | **DONE** | cf-j43m (PR #869) |
| A4 | Schema validation layer (wave 1: 5 endpoints) | godfrey | **IN PROGRESS** | cf-5r7k (PR #870) |
| A5 | Fix 52 failing tests (+12 rate-limit regressions) | radahn | **DONE** | cf-5ps3 |

**A4 — Schema Validation (Finalized):**
- Gradual adoption — 5 highest-risk endpoints first, 4 waves to full coverage
- Wave 1 targets: submitContactForm, applyForTradeAccount, sendEmail, reserveDeliveryWindow, markItemPurchased
- Ship, monitor for false rejections 1 week, then roll out next 5
- Schema format: `{ fieldName: { type, required, maxLength, min, max, allowedValues, pattern } }`

### Track B — Performance & Data Quality

| # | Feature | Owner | Status | Bead |
|---|---------|-------|--------|------|
| B1 | Catalog data validation CI | rennala | **DONE** | cf-p4iy |
| B2 | CMS garbage collection cron | radahn | **IN PROGRESS** | cf-au1w |
| B3 | Photo gap automation | TBD | Phase 3 | — |
| B4 | Recently viewed staleness check | TBD | Phase 3 | — |

**B2 — GC Cron (Finalized):**
- New module: `src/backend/cmsGarbageCollector.web.js`
- Cron endpoint: `/_functions/cmsGarbageCollect` (daily at 3am)
- Purge targets:
  - Rate-limit records > 24h (all `*RateLimit` collections)
  - Browse session records > 30 days
  - Email queue entries (sent/cancelled) > 7 days
  - Orphan viewer count session records > 48h
- AuditLog retention: **90-day default, 365-day for financial/unsubscribe events** (via `retentionDays` field)
- Batch deletes (100/query) to avoid Wix timeout
- Log GC summary to AuditLog

### Track C — SEO & Conversion

| # | Feature | Owner | Status | Bead |
|---|---------|-------|--------|------|
| C1 | JSON-LD enrichment | rennala | **IN PROGRESS** | cf-8du3 |
| C2 | Native Wix gallery price audit | TBD | Phase 3 | — |
| C3 | Checkout shipping estimate on PDP | TBD | Phase 3 | — |

**C1 — JSON-LD Enrichment (Finalized):**
- File: `src/backend/seoHelpers.web.js` → `getProductSchema()`
- New fields:
  - `aggregateRating` from reviewsService (ratingValue, reviewCount)
  - `offers.availability` mapped from inventory (InStock/OutOfStock/PreOrder)
  - `brand.name` from manufacturer field
  - `offers.seller` with LocalBusiness reference
- Data already exists in backend — pure wiring exercise
- Validate against Google Rich Results Test

**C3 — Shipping Estimate on PDP (New — radahn proposal):**
- Show "Estimated delivery: $X / Free" badge on Product Page
- Uses stored ZIP from shippingPrefs module (getStoredZip)
- Fallback: IP geolocation or inline ZIP input
- Surfaces shipping cost early → reduces checkout surprise (top cart abandonment driver)
- 3 beads: backend estimate endpoint, PDP badge module, ZIP input component

### Track D — Cross-Rig API Contracts (with dallas/mobile)

| # | Feature | Owner | Status | Bead |
|---|---------|-------|--------|------|
| D1 | Visual Search embeddings API | TBD | Phase 3 | — |
| D2 | Order tracking webhook | TBD | Phase 3 | — |
| D3 | Bundle/coupon validation endpoint | TBD | Phase 3 | — |

**D1 — Visual Search API:**
- Endpoint: `/_functions/productImageEmbeddings`
- Returns: `{ products: [{ id, name, category, images: [{ url, width, height }] }] }`
- Source: catalog-MASTER.json CDN URLs
- Rate limit: 10/min per caller
- Mobile generates embeddings client-side from these URLs

**D2 — Order Tracking Webhook:**
- Wix eCommerce `onOrderUpdated` event handler
- Payload: `{ orderId, status, trackingNumber, carrier, estimatedDelivery }`
- HTTP POST to mobile push endpoint (URL from Wix Secrets Manager)
- Retry: 3 attempts, exponential backoff

**D3 — Bundle Coupon Validation:**
- Web method: `validateBundleCoupon(couponCode, cartItems)`
- Returns: `{ valid, discount, applicableItems, reason }`
- Wraps existing bundleService + couponsService logic

### Track E — Test Infrastructure (New — radahn proposals)

| # | Feature | Owner | Status | Bead |
|---|---------|-------|--------|------|
| E1 | Test mock health monitor | TBD | Phase 2 | — |
| E2 | Rate limit test harness | TBD | Phase 2 | — |

**E1 — Mock Health Monitor:**
- CI script that diffs each page module's imports against its test vi.mock() declarations
- Flags missing mocks at PR time, not after merge
- Prevents the recurring pattern: every wave produces 5-10 mock drift failures

**E2 — Rate Limit Test Harness:**
- Shared helper: `withRateLimit(collection)` in test utils
- Seeds passing rate limit record + adds query mock automatically
- Tests call once in beforeEach instead of manual rate limit mock threading

---

## Crew Assignment Plan

### Phase 1 — Security Hardening (NOW)

| Crew | Bead | Status |
|------|------|--------|
| godfrey | cf-5r7k — Schema validation (5 endpoints) | IN PROGRESS (PR #870, rebasing) |
| miquella | cf-qgg0 — Unified price guard | IN PROGRESS |
| radahn | cf-au1w — CMS garbage collection cron | IN PROGRESS |
| rennala | cf-8du3 — JSON-LD enrichment | IN PROGRESS |

### Phase 2 — Test Infra + Remaining Hardening (after Phase 1)

| Crew | Feature | Bead |
|------|---------|------|
| radahn | E1 — Test mock health monitor | TBD |
| godfrey | E2 — Rate limit test harness | TBD |
| miquella | C2 — Native Wix gallery price audit | TBD |
| rennala | B3 — Photo gap automation | TBD |

### Phase 3 — Cross-Rig + UX (after Phase 2)

| Crew | Feature | Bead |
|------|---------|------|
| godfrey | D1 — Visual Search API (with dallas) | TBD |
| radahn | D2 — Order tracking webhook (with dallas) + C3 — Shipping estimate PDP | TBD |
| rennala | D3 — Bundle/coupon validation (with dallas) | TBD |
| miquella | B4 — Recently viewed staleness | TBD |

---

## Success Criteria

- Zero unprotected mutation endpoints (**DONE**: A1 + A3)
- Zero failing tests (**DONE**: A5)
- Consistent price display across all pages (A2 in progress)
- Input validation consistent across 5 highest-risk endpoints (A4 in progress)
- CMS data growth bounded with tiered retention (B2 in progress)
- Category drift caught in CI (**DONE**: B1)
- Google rich results eligible with full Product schema (C1 in progress)
- Shipping cost visible on PDP before checkout (C3, Phase 3)
- Test mock drift caught at PR time, not post-merge (E1, Phase 2)
- Mobile can call cfutons APIs for visual search + tracking + coupons (D1-D3, Phase 3)

---

## Resolved Questions

| # | Question | Answer | Source |
|---|----------|--------|--------|
| 1 | Schema validation: gradual or big-bang? | **Gradual** — 5 endpoints per wave, 4 waves | godfrey |
| 2 | AuditLog retention? | **90-day default, 365-day for financial/unsubscribe** via retentionDays field | godfrey |
| 3 | GC cron frequency? | **Daily at 3am** sufficient — rate-limit records only useful within 1h window | godfrey |

## Open Questions (for dallas — Phase 3 blockers)

| # | Question | Needed for |
|---|----------|------------|
| 1 | Visual Search: real-time API or batch export? | D1 endpoint design |
| 2 | Mobile push endpoint URL format? | D2 webhook delivery |

---

## Session Scorecard (2026-03-28)

| Metric | Count |
|--------|-------|
| PRs merged | 2 (#868, #869) |
| Direct pushes | 2 (CI fix, justAddedHighlight) |
| Beads closed | 5 (cf-39ct, cf-j43m, cf-i8e5, cf-blft, cf-p4iy) |
| Beads filed | 10 |
| Crew dispatches | 8 (4 initial + 4 re-dispatches) |
| Feature proposals collected | 15 (from 5 sources) |
| Follow-up questions resolved | 3 of 6 |
