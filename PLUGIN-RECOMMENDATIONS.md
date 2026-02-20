# Carolina Futons — Wix Plugin & Integration Recommendations

## MUST INSTALL (Free, High Impact)

| Plugin | Purpose | Cost | Integration Notes |
|--------|---------|------|-------------------|
| **Google Analytics 4** | Enhanced ecommerce tracking | Free | Dashboard > Marketing Integrations. Our `analyticsHelpers.web.js` already fires `wixWindow.trackEvent()` — GA4 picks these up automatically. |
| **Meta Pixel (Facebook)** | Facebook/Instagram ad tracking & retargeting | Free | Dashboard > Tracking & Analytics. Events from `trackEvent()` auto-forward. |
| **Pinterest Tag** | Pinterest conversion tracking | Free | Dashboard > Tracking & Analytics. Pairs with our Rich Pin meta tags. |
| **Google Merchant Center** | Shopping ads — feed already built! | Free | Connect our `/_functions/googleMerchantFeed` URL. Feed is live. |
| **Wix Chat** (built-in) | Live chat with customers | Free | Dashboard toggle. No code needed. |
| **Stamped.io** (or Judge.me) | Product reviews with photos | Free tier | App Market install. Can integrate with our `scheduleReviewRequest` flow. |
| **Klaviyo** | Email/SMS marketing, abandoned cart flows | Free up to 250 contacts | App Market install. Replaces basic Triggered Emails with advanced automations. Connects via Wix events. |

## SHOULD INSTALL (Free, Good Value)

| Plugin | Purpose | Cost | Integration Notes |
|--------|---------|------|-------------------|
| **Wix Loyalty** (built-in) | Points/rewards program | Free with Velo API | Pure code — our `loyaltyService.web.js` builds on `wix-loyalty.v2`. |
| **TikTok Pixel** | TikTok ad conversion tracking | Free | Custom embed via Velo `$w('#html1').postMessage()` or Dashboard tracking. |
| **Wix Bookings** (built-in) | Showroom appointment scheduling | Free w/ Premium | Dashboard toggle. Great for "Book a Visit" for Asheville showroom. |
| **Wix Automations** (built-in) | Email sequences, triggers | Free | Dashboard + Velo SPI. Powers our post-purchase care sequence. |

## NICE TO HAVE (Free)

| Plugin | Purpose | Cost | Integration Notes |
|--------|---------|------|-------------------|
| **Wix Forms** (built-in) | Additional form types | Free | Built-in. We already use custom forms via `contactSubmissions.web.js`. |
| **Wix Pricing Plans** | Membership tiers (trade/designer accounts) | Free tier | Could power wholesale pricing for interior designers. |
| **Aftership** | Shipment tracking page | Free tier | Embeddable tracking widget for Thank You page. |

## PURE VELO (No App Install Needed)

These are APIs we access directly from code — no marketplace install required:

| Velo API | What It Does | Our Module | Status |
|----------|-------------|------------|--------|
| `wix-marketing-backend` (Coupons) | Create/manage discount coupons | `couponsService.web.js` | Building |
| `wix-loyalty.v2` | Points, tiers, rewards program | `loyaltyService.web.js` | Building |
| `wix-ecom-backend` (Events) | Abandoned cart, checkout events | `cartRecovery.web.js` | Building |
| `wixWindow.trackEvent()` | Fire GA4 + Pixel events from code | `analyticsHelpers.web.js` | Building |
| `wix-crm-backend` | Contact management, triggered emails | `emailService.web.js` | Done |
| `wix-members-backend` | Auth, roles, profiles | Multiple files | Done |
| `wix-data` | CMS read/write | Multiple files | Done |
| `wix-stores-frontend` | Cart operations | `cartService.js` | Done |
| `wix-location-frontend` | Navigation, URL management | Multiple pages | Done |
| `wix-fetch` | External API calls (UPS, etc.) | `ups-shipping.web.js` | Done |

## Installation Priority Order

1. **GA4 + Meta Pixel + Pinterest Tag** — immediate, free, 5 minutes each in Dashboard
2. **Google Merchant Center** — connect our existing feed URL, free
3. **Wix Chat** — one toggle in Dashboard, instant customer communication
4. **Wix Loyalty** — dashboard enable, code already being built
5. **Wix Automations** — powers post-purchase sequences
6. **Wix Bookings** — showroom appointment scheduling
7. **Klaviyo** — when ready for advanced email marketing (replace basic CRM emails)
8. **Stamped.io** — when ready for visual product reviews

## Do NOT Install

| Plugin | Why Not |
|--------|---------|
| Wix Stores SEO apps | We handle SEO in code (`seoHelpers.web.js`) — schema injection, meta tags, sitemaps |
| Cookie consent plugins | Wix has built-in cookie consent banner |
| Image optimization plugins | Wix handles this natively |
| Shipping rate calculator apps | We built custom (`shipping-rates-plugin.js` + `ups-shipping.web.js`) |
| Product recommendation plugins | We built custom (`productRecommendations.web.js`) |

## CMS Collections Needed for New Features

These must be created in Wix Dashboard before the new backend modules work:

| Collection | Used By | Fields |
|------------|---------|--------|
| `DeliverySchedule` | `deliveryScheduling.web.js` | orderId, date, timeWindow, type, status |
| `AssemblyGuides` | `assemblyGuides.web.js` | sku, title, pdfUrl, videoUrl, estimatedTime |
| `GiftCards` | `giftCards.web.js` | code, balance, purchaserEmail, recipientEmail, status, createdDate |
| `ContactSubmissions` | `contactSubmissions.web.js` | name, email, phone, subject, message, submittedAt, status, source, productId |
| `ProductAnalytics` | `analyticsHelpers.web.js` | productId, productName, viewCount, addToCartCount, purchaseCount |
| `ReviewRequests` | `dataService.web.js` | orderId, buyerEmail, productId, sentAt, status |

---

*Generated by Mayor during 8-hour sprint — 2026-02-20*
