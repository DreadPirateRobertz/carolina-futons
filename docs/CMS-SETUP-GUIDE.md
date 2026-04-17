# CMS Collections Setup Guide

This guide defines every CMS collection required by the Carolina Futons backend.
Create these collections in **Wix Dashboard > CMS > Content Collections**.

> **Field type key:** Text = short string, Rich Text = long/HTML, Number, Boolean, Date, URL, Image, Tags = array of strings

---

## Priority Order

Create in this order (dependencies flow downward):

1. **ContactSubmissions** — used by contact form, newsletter, swatch requests
2. **ProductAnalytics** — used by analytics tracking and product recommendations
3. **Promotions** — used by homepage banner and product pages
4. **EmailQueue** — used by email automation sequences
5. **Unsubscribes** — used by email automation opt-out
6. **AbandonedCarts** — used by cart recovery automation
7. **Fulfillments** — used by shipping label creation and order tracking
8. **GiftCards** — used by gift card purchase and redemption
9. **DeliverySchedule** — used by white-glove delivery scheduling
10. **AssemblyGuides** — used by assembly guide lookup on product pages
11. **FabricSwatches** — used by swatch service on product pages
12. **ProductBundles** — used by bundle pricing on product pages
13. **CustomerEngagement** — used by engagement event tracking
14. **ReviewRequests** — used by post-purchase review solicitation
15. **ReferralCodes** — used by referral program
16. **Videos** — used by product video display
17. **PushTokens** — used by push notification dispatch to member devices
18. **SpinGrants** — used by bonus spin grant and redemption flow
19. **MobileChallengeCompletions** — used by mobile app challenge tracking
20. **CrossRigSyncLog** — used by cross-rig gamification sync audit trail
21. **Landings** — used by `/spring-sale`, `/winback`, `/press` marketing pages (cf-3qt Phase 5)
22. **PressMentions** — used by `/press` mentions list (cf-3qt Phase 5)
23. **PressKitAssets** — used by `/press` downloadable assets (cf-3qt Phase 5)
24. **ComparisonFeatures** — used by `/compare` product matrix (cf-3qt Phase 4)

---

## 1. ContactSubmissions

**Used by:** contactSubmissions.web.js, emailService.web.js
**Permissions:** Site member read, Anyone insert (backend suppressed elevate)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| email | Text | Yes | Index this field |
| name | Text | No | |
| phone | Text | No | |
| subject | Text | No | |
| message | Rich Text | No | Max 2000 chars |
| submittedAt | Date | Yes | Index — used for rate limiting |
| status | Text | No | Values: new, swatch_request, newsletter_signup |
| source | Text | No | Values: contact_form, blog_newsletter |
| notes | Text | No | |
| productId | Text | No | For swatch requests |
| productName | Text | No | For swatch requests |

---

## 2. ProductAnalytics

**Used by:** analyticsHelpers.web.js, productRecommendations.web.js
**Permissions:** Backend only (elevated)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| productId | Text | Yes | **Index** — primary lookup |
| productName | Text | Yes | |
| category | Text | Yes | |
| viewCount | Number | Yes | Default 0. **Index** — sorted desc |
| lastViewed | Date | Yes | **Index** — time-range filter |
| addToCartCount | Number | Yes | Default 0 |
| purchaseCount | Number | No | Default 0 |
| weekSales | Number | No | Default 0. **Index** — sorted desc |

---

## 3. Promotions

**Used by:** promotions.web.js, dataService.web.js
**Permissions:** Anyone read (public), Admin write

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | Text | Yes | |
| subtitle | Text | No | |
| theme | Text | No | |
| heroImage | Image | No | |
| isActive | Boolean | Yes | **Index** — required filter |
| startDate | Date | Yes | **Index** — range filter |
| endDate | Date | Yes | **Index** — range filter |
| discountCode | Text | No | |
| discountPercent | Number | No | |
| ctaUrl | URL | No | |
| ctaText | Text | No | |
| productIds | Text | No | Comma-separated product IDs |

---

## 4. EmailQueue

**Used by:** emailAutomation.web.js
**Permissions:** Backend only (elevated)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| templateId | Text | Yes | e.g. welcome_series_1 |
| recipientEmail | Text | Yes | **Index** — dedup lookups |
| recipientContactId | Text | Yes | Wix contact ID |
| variables | Text | No | JSON-stringified object |
| sequenceType | Text | Yes | **Index** — welcome, cart_recovery, post_purchase, reengagement |
| sequenceStep | Number | Yes | **Index** — step number |
| status | Text | Yes | **Index** — Values: scheduled, sent, failed, cancelled |
| scheduledFor | Text | Yes | **Index** — ISO date string for time-based queries |
| sentAt | Text | No | ISO date string |
| attempt | Number | No | Default 0 |
| lastError | Text | No | |
| abVariant | Text | No | A or B |
| createdAt | Text | Yes | ISO date string |

---

## 5. Unsubscribes

**Used by:** emailAutomation.web.js
**Permissions:** Backend only (elevated)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| email | Text | Yes | **Index** — primary lookup |
| sequenceType | Text | Yes | Which sequence they unsubbed from |
| unsubscribedAt | Text | Yes | ISO date string |

---

## 6. AbandonedCarts

**Used by:** emailAutomation.web.js, cartRecovery.web.js
**Permissions:** Backend only (elevated)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| checkoutId | Text | Yes | **Index** — dedup primary key |
| buyerEmail | Text | Yes | **Index** — validation filter |
| buyerName | Text | No | |
| cartTotal | Number | Yes | |
| lineItems | Text | Yes | JSON-stringified array |
| abandonedAt | Text | Yes | **Index** — time filter (ISO string) |
| status | Text | Yes | **Index** — Values: abandoned, recovering, recovered, expired |
| recoveryEmailSent | Boolean | Yes | **Index** — status filter. Default false |
| recoveryEmailSentAt | Text | No | ISO date string |
| recoveredAt | Text | No | ISO date string |

---

## 7. Fulfillments

**Used by:** fulfillment.web.js
**Permissions:** SiteMember read, Backend write

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| orderId | Text | Yes | |
| orderNumber | Text | Yes | |
| trackingNumber | Text | Yes | **Index** — primary lookup |
| carrier | Text | Yes | e.g. UPS |
| serviceCode | Text | Yes | e.g. 03 |
| serviceName | Text | Yes | e.g. UPS Ground |
| labelBase64 | Rich Text | No | Base64-encoded shipping label |
| shippingCost | Number | Yes | |
| status | Text | Yes | **Index** — Values: created, in_transit, delivered, exception |
| createdDate | Date | Yes | **Index** — sorted desc |
| recipientName | Text | Yes | |
| recipientCity | Text | No | |
| recipientState | Text | No | |
| lastTrackingUpdate | Date | No | |
| estimatedDelivery | Date | No | |
| lastActivity | Text | No | |

---

## 8. GiftCards

**Used by:** giftCards.web.js
**Permissions:** Backend only (elevated)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| code | Text | Yes | **Index** — unique, primary lookup |
| balance | Number | Yes | Current balance in cents or dollars |
| initialAmount | Number | Yes | Original purchase amount |
| purchaserEmail | Text | Yes | |
| recipientEmail | Text | Yes | |
| recipientName | Text | No | |
| message | Text | No | Gift message |
| status | Text | Yes | **Index** — Values: active, redeemed, expired, cancelled |
| createdDate | Date | Yes | |
| expirationDate | Date | Yes | **Index** — expiry check |
| lastUsedDate | Date | No | |

---

## 9. DeliverySchedule

**Used by:** deliveryScheduling.web.js
**Permissions:** Backend only (elevated)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| orderId | Text | Yes | **Index** — dedup check |
| date | Text | Yes | **Index** — YYYY-MM-DD format, slot counting |
| timeWindow | Text | Yes | **Index** — Values: morning, afternoon |
| type | Text | Yes | **Index** — Values: standard, white_glove |
| status | Text | Yes | **Index** — Values: scheduled, completed, cancelled |
| customerEmail | Text | No | |
| customerPhone | Text | No | |
| address | Text | No | |
| notes | Text | No | |
| createdAt | Date | Yes | |

---

## 10. AssemblyGuides

**Used by:** assemblyGuides.web.js
**Permissions:** Anyone read, Admin write

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| sku | Text | Yes | **Index** — primary lookup |
| title | Text | Yes | |
| pdfUrl | URL | No | |
| videoUrl | URL | No | |
| estimatedTime | Text | No | e.g. "30-60 minutes" |
| category | Text | No | **Index** — sorted |
| steps | Rich Text | No | Assembly step-by-step |
| tips | Rich Text | No | Pro tips and warnings |

---

## 11. FabricSwatches

**Used by:** swatchService.web.js
**Permissions:** Anyone read, Admin write

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| swatchId | Text | Yes | |
| swatchName | Text | Yes | |
| swatchImage | Image | Yes | |
| colorFamily | Text | Yes | **Index** — filter (e.g. Blue, Brown, Neutral) |
| colorHex | Text | Yes | e.g. #5B8FA8 |
| material | Text | Yes | e.g. Microfiber, Cotton |
| careInstructions | Text | No | |
| availableForProducts | Tags | Yes | **Index** — product ID array |
| sortOrder | Number | Yes | **Index** — ascending sort |

---

## 12. ProductBundles

**Used by:** dataService.web.js
**Permissions:** Anyone read, Admin write

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| primaryProductId | Text | Yes | **Index** — primary lookup |
| bundledProductIds | Text | Yes | Comma-separated product IDs |
| bundleName | Text | Yes | |
| bundleId | Text | Yes | |
| isActive | Boolean | Yes | **Index** — active filter |
| discountPercent | Number | No | |

---

## 13. CustomerEngagement

**Used by:** dataService.web.js
**Permissions:** Site member read/write, Backend elevated

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| memberId | Text | Yes | **Index** — owner lookup |
| eventType | Text | Yes | **Index** — e.g. view, add_to_cart, purchase |
| productId | Text | No | |
| metadata | Text | No | JSON-stringified |
| sessionId | Text | No | |
| timestamp | Date | Yes | **Index** — sorted desc |

---

## 14. ReviewRequests

**Used by:** dataService.web.js
**Permissions:** Backend only (elevated)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| orderId | Text | Yes | |
| customerEmail | Text | Yes | |
| productIds | Text | Yes | Comma-separated |
| scheduledDate | Date | Yes | **Index** — time-based |
| status | Text | Yes | **Index** — Values: pending, sent, completed |
| rating | Number | No | |
| reviewText | Text | No | |

---

## 15. ReferralCodes

**Used by:** dataService.web.js
**Permissions:** Backend only (elevated)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| code | Text | Yes | **Index** — primary lookup |
| memberId | Text | Yes | **Index** — ownership check |
| discountPercent | Number | Yes | |
| usedBy | Text | No | **Index** — redemption check |
| usedAt | Date | No | |
| creditAmount | Number | Yes | |

---

## 16. Videos

**Used by:** dataService.web.js
**Permissions:** Anyone read, Admin write

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | Text | Yes | |
| videoUrl | URL | Yes | |
| thumbnail | Image | No | |
| productId | Text | No | **Index** — optional filter |
| category | Text | No | **Index** — optional filter |
| duration | Text | No | e.g. "2:30" |
| viewCount | Number | Yes | **Index** — sorted desc. Default 0 |
| isFeatured | Boolean | No | **Index** — optional filter |

---

## ProductShippingProfiles

**Module:** `shippingIntelligence.web.js` — per-product shipping dimensions and routing overrides.
Queried on every call to `getShippingEstimate` and `calculateBundleQuote`. Products without a profile fall back to category defaults in `ups-shipping.web.js`.

**Permissions:** Admin read/write. Backend reads with `suppressAuth: true`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| productId | Text | Yes | **Index** (unique) — Wix catalog `_id` |
| weight_lbs | Number | Yes | Packed weight including packaging |
| length_in | Number | Yes | Longest dimension |
| width_in | Number | Yes | |
| height_in | Number | Yes | |
| freightClass | Text | No | NMFC class — "100", "150", "200", "250". If absent: category default (futon-frame=150, futon-mattress=200, murphy-bed=150, accessory=250) |
| requiresPallet | Boolean | No | Forces LTL routing regardless of weight. Default false. |
| requiresFreight | Boolean | No | Always route to freight, never UPS parcel. Default false. |
| customItemFlag | Boolean | No | Triggers manual pricing review path. Default false. |
| handlingFee_usd | Number | No | Flat per-order surcharge added to shipping cost. Default 0. |
| packagingNotes | Text | No | e.g. "Ships in 2 boxes", "mattress compressed in roll" |

**Routing rules** (applied by `_routeToCarrier`):
- `requiresPallet === true` OR `requiresFreight === true` → **WWEX LTL**
- `totalWeight > 150 lbs` → **WWEX LTL**
- Otherwise → **UPS parcel**

**Seed data:** Top 20 products should have profiles. Run `scripts/seed-shipping-profiles.mjs` or add via CMS dashboard. Example record:
```json
{
  "productId": "<wix-product-id>",
  "weight_lbs": 45,
  "length_in": 72,
  "width_in": 24,
  "height_in": 6,
  "freightClass": "150",
  "requiresPallet": false,
  "requiresFreight": false,
  "handlingFee_usd": 0
}
```

---

## 17. PushTokens

**Used by:** pushTokenRegistry.web.js, pushNotificationService.web.js
**Permissions:** Site member insert, Admin read/update/remove (backend suppressAuth)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| memberId | Text | Yes | **Index** — primary lookup |
| token | Text | Yes | FCM/APNs device token |
| platform | Text | Yes | Values: ios, android, web |
| active | Boolean | Yes | Default true. **Index** — filter active tokens |

---

## 18. SpinGrants

**Used by:** spinRedemptionService.web.js, rewardEngine
**Permissions:** Backend only (elevated)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| memberId | Text | Yes | **Index** — primary lookup |
| grantedAt | Date | Yes | |
| expiresAt | Date | Yes | **Index** — 30-day expiry filter |
| redeemedAt | Date | No | Null until redeemed |
| reward | Text | No | Reward description |
| rewardValue | Number | No | Monetary or point value |
| status | Text | Yes | Values: pending, redeemed, expired. **Index** |

---

## 19. MobileChallengeCompletions

**Used by:** mobileChallengeService.web.js, crossRigEventReceiver
**Permissions:** Backend only (elevated)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| memberId | Text | Yes | **Index** — primary lookup |
| challengeType | Text | Yes | Values: ar_discovery, quiz_completion, social_share. **Index** |
| completedAt | Date | Yes | **Index** — idempotency check (same type+product per day) |
| pointsAwarded | Number | Yes | AR=75, Quiz=50, Social=100 |
| productId | Text | No | For AR discovery challenges |
| score | Number | No | Quiz score |
| platform | Text | No | Device platform |

---

## 20. CrossRigSyncLog

**Used by:** crossRigSyncUtils.js (backend-only helper)
**Permissions:** Backend only (elevated)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| memberId | Text | Yes | **Index** — primary lookup |
| points | Number | Yes | Points synced (>= 0) |
| eventType | Text | Yes | e.g. quiz_completed, ar_discovery_completed |
| sourceRig | Text | Yes | Values: cfutons_mobile. **Index** |
| syncedAt | Date | Yes | **Index** — time-range filter |
| direction | Text | Yes | Values: mobile_to_web |

---

## 21. Landings

**Used by:** cf-3qt Phase 5 marketing routes (`/spring-sale`, `/winback`, `/press`)
**Permissions:** Anyone read, Admin write

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| slug | Text | Yes | **Index — unique.** Examples: `spring-sale`, `winback`, `press` |
| title | Text | Yes | SEO `<title>` |
| headline | Text | Yes | Hero H1 |
| subheadline | Text | No | Hero subhead |
| heroImageUrl | URL | No | Wix media asset URL |
| ctaPrimaryLabel | Text | No | |
| ctaPrimaryHref | Text | No | |
| ctaSecondaryLabel | Text | No | |
| ctaSecondaryHref | Text | No | |
| bodyMdx | Rich Text | No | Long-form copy, rendered as markdown (max ~20000 chars) |
| utmDefaults | Rich Text | No | JSON blob: `{ campaign, content }` applied to outbound links |
| activeFrom | Date | No | Visibility window start |
| activeUntil | Date | No | Visibility window end |
| seoDescription | Text | No | Meta description |
| ogImageUrl | URL | No | OpenGraph image |

---

## 22. PressMentions

**Used by:** `/press` (cf-3qt Phase 5)
**Permissions:** Anyone read, Admin write

Empty on launch — roadmap/"coming soon" treatment applies until first placement. Melania populates via Wix CMS UI as outreach lands.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| outlet | Text | Yes | **Index.** Outlet name (e.g. `Hendersonville Times-News`) |
| outletLogoUrl | URL | No | Grayscale logo asset |
| articleTitle | Text | Yes | |
| articleUrl | URL | Yes | |
| publishedDate | Date | Yes | **Index** — recency sort |
| excerpt | Text | No | Pull quote (max ~500 chars) |
| category | Text | No | **Index.** Values: `local-press`, `national`, `podcast`, `blog` |
| featured | Boolean | No | Pin to top |
| sortOrder | Number | No | Manual ordering override |

---

## 23. PressKitAssets

**Used by:** `/press` downloads (cf-3qt Phase 5)
**Permissions:** Anyone read, Admin write

Seeds from godfrey (logo SVG, product photos, fact-sheet PDF).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | Text | Yes | Human-readable asset name |
| description | Text | No | |
| fileUrl | URL | Yes | Wix media URL |
| fileType | Text | Yes | Values: `svg`, `png`, `pdf`, `zip` |
| fileSizeBytes | Number | No | |
| category | Text | Yes | **Index.** Values: `logo`, `product-photo`, `team-photo`, `bio`, `fact-sheet` |
| sortOrder | Number | No | |

---

## 24. ComparisonFeatures

**Used by:** `/compare` product matrix (cf-3qt Phase 4)
**Permissions:** Anyone read, Admin write

Each row represents one spec dimension. `values` is a denormalized JSON map keyed by product slug — sufficient for ≤20 rows × ≤5 products.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| featureKey | Text | Yes | **Index — unique.** e.g. `frame-material` |
| label | Text | Yes | Display label for the row |
| description | Text | No | Hover/help text |
| category | Text | No | **Index.** Values: `construction`, `comfort`, `price`, `warranty` |
| sortOrder | Number | No | Display order |
| values | Rich Text | Yes | JSON blob: `{ "<productSlug>": "<cell value or icon key>" }` |

---

## Index Summary

These fields should be indexed in Wix CMS for query performance:

| Collection | Indexed Fields |
|------------|---------------|
| ContactSubmissions | email, submittedAt |
| ProductAnalytics | productId, viewCount, lastViewed, weekSales |
| Promotions | isActive, startDate, endDate |
| EmailQueue | recipientEmail, sequenceType, sequenceStep, status, scheduledFor |
| Unsubscribes | email |
| AbandonedCarts | checkoutId, buyerEmail, abandonedAt, status, recoveryEmailSent |
| Fulfillments | trackingNumber, status, createdDate |
| GiftCards | code, status, expirationDate |
| DeliverySchedule | orderId, date, timeWindow, type, status |
| AssemblyGuides | sku, category |
| FabricSwatches | colorFamily, availableForProducts, sortOrder |
| ProductBundles | primaryProductId, isActive |
| CustomerEngagement | memberId, eventType, timestamp |
| ReviewRequests | scheduledDate, status |
| ReferralCodes | code, memberId, usedBy |
| Videos | productId, category, viewCount, isFeatured |
| PushTokens | memberId, active |
| SpinGrants | memberId, expiresAt, status |
| MobileChallengeCompletions | memberId, challengeType, completedAt |
| CrossRigSyncLog | memberId, sourceRig, syncedAt |
| Landings | slug (unique) |
| PressMentions | outlet, publishedDate, category |
| PressKitAssets | category |
| ComparisonFeatures | featureKey (unique), category |
