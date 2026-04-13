# Cross-Platform Feature Plan — Web + Mobile Alignment

**Date**: 2026-04-04
**PMs**: melania (cfutons web), dallas (cfutons_mobile)
**Status**: FINALIZED — both PMs agreed via mail thread

---

## Context

Carolina Futons operates two platforms: web (Wix Studio + Velo) and mobile (React Native). Both share the same brand, product catalog, and CMS backend. This spec defines the joint roadmap to achieve feature parity and unified customer experience.

## Phase 1: Cross-Platform Parity (Joint Work)

### 1.1 Loyalty Unification (cm-elo)

**Goal**: Single loyalty system across web and mobile with shared points ledger.

**Agreed Config** (source of truth: `src/public/gamificationTokens.js`):

| Tier | Threshold | Perks |
|---|---|---|
| Trail Blazer | 0 pts | Birthday discount coupon |
| Mountain Guide | 500 pts | +accessory discount, +free swatch kit |
| Summit Master | 2,000 pts | +free local delivery, +early access |
| Blue Ridge Legend | 5,000 pts | (exclusive perks TBD) |

**Point Values**:
- PURCHASE_PER_DOLLAR: 2, REVIEW: 100, PHOTO_REVIEW_BONUS: 50
- REFERRAL_ACCEPTED: 500, VIDEO_REVIEW: 500, AR_TRY_ON: 25
- STREAK_7_DAY: 100, WISHLIST_ADD: 25 (1/month cap)
- Mobile-unique: VISUAL_SEARCH_USE: 15, SHARE_PRODUCT: 10, PUSH_NOTIFICATION_ENABLED: 50 (one-time)

**Streak Sync**: Local tracking for responsiveness, server sync on foreground resume. LoyaltyAccounts collection has `streakDays` + `lastStreakDate`. Last-write-wins (monotonic).

**Shared CMS Collections**: LoyaltyAccounts, PointsHistory, TierPerkDeliveries

**Portable Config**: `gamificationTokens.js` (web, no Wix imports) / `loyaltyTiers.ts` (mobile, no RN imports)

### 1.2 UGC Photo Sharing (cm-nw8)

**Goal**: Shared UGC photo collection consumed by both platforms.

**Schema** (UGCPhotos collection):
```
roomType: living-room|bedroom|office|dorm|porch|other
productId: Text (indexed)
photoUrl: Text (CDN URL)
caption: Text (max 80 chars)
submittedAt: Date (indexed)
status: pending|approved|featured|rejected
voteCount: Number
memberId: Text (indexed)
```

**Web**: Already built — Share Your Room CTA on PDP (CF-rw9i.1), PDP UGC gallery (CF-rw9i.2), Community Gallery page.
**Mobile**: Dallas assigning crew to build photo submit in Room Gallery screen.

### 1.3 BNPL Parity (cm-1s7)

**Decision**: GO. Affirm recommended (PR #947 evaluation).
**Web**: BNPLWidget.js on PDPs, `financingCalc.web.js` backend.
**Mobile**: Already has Affirm+Afterpay calculator. Will align behavior with web widget.

## Phase 2: Web-to-Mobile Ports (Dallas Crew)

Mobile will consume existing web CMS collections and backends:

| Feature | Web Source | CMS Collection | Mobile Screen |
|---|---|---|---|
| Virtual consultation | virtualConsultation.web.js | ConsultationBookings | Booking flow |
| Warranty registration | warrantyService.web.js | WarrantyRegistrations | Registration form |
| NPS/CSAT survey | surveyService.web.js | SurveyResponses | Post-purchase survey |
| Price drop push | priceAlertService.web.js | PriceAlerts (+deviceToken) | Push notification |
| Product Q&A | productQA.web.js | ProductQuestions | PDP Q&A section |
| Bundle deals | bundleService.web.js | BundleDefinitions | Cart bundle picker |
| Video reviews | videoReviewService.web.js | VideoReviews | PDP video grid |

**Webhook Format** (price drop): `{productId, productName, oldPrice, newPrice, percentDrop, subscriberEmail, subscriberDeviceToken}`

**Web action needed**: Add `subscriberDeviceToken` field to PriceAlerts collection for mobile push support.

## Phase 3: Mobile-Unique Features (Dallas Crew, In Progress)

- Product ratings & reviews (bishop)
- Promo banner carousel (ripley)
- Share via native sheet (hicks)
- Visual search camera (nux)
- Test coverage (burke)

## Feature Parity Gaps (Documented, Not Yet Planned)

**Web has, mobile missing** (beyond Phase 2):
- Room Planner 2D canvas, Trade-in program, Pre-sale chatbot, Swatch kit ordering, 8 buying guides, Gift registry, White-glove scheduling+SMS

**Mobile has, web missing**:
- AR camera integration (web has stub only), Visual search frontend, Push notifications (web uses email), Native app download prompts

## Design Tokens

Both platforms use shared palette (no changes):
- Sand #E8D5B7, Espresso #3A2518, Mountain Blue #5B8FA8, Coral #E8845C
- Off White #FAF7F2, Sand Light #F2E8D5
- Extended: Espresso Light #6B4D3A, Mountain Blue Light #8BB5C9, Coral Light #F0A882

Web-specific: Sky gradient tokens (#B8D4E3 to #F0C87A) for LivingSky animation.

## Implementation Notes

- All write endpoints use shared `checkRateLimit` utility (3/hr per email default)
- Clock injection via `opts.now` for tests, NEVER exposed on `Permissions.Anyone` methods
- Mobile consumes Wix CMS via `/_functions/` HTTP endpoints or direct Wix SDK
- gamificationTokens.js is the single source of truth for points/tiers — both platforms import it
