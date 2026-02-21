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
