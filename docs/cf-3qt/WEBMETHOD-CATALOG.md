---
epic: cf-3qt
phase: cf-3qt.2 (Next.js migration — commerce + account integration)
authors:
  - cfutons/crew/morgott (§ Stores · Cart · Checkout)
  - cfutons/crew/rennala (§ Member-scoped)
status: draft
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

Total: **~72 Anyone + 7 SiteMember + ~20 Admin** commerce webMethods across
25 backend files. Highest-traffic calls for Phase 2 pages (Home, Shop, 5 PLPs,
PDP, Cart, Checkout, Order Confirmation) are **bolded**.

All methods in this half wrap one of three Wix SDK backend modules — see
§ *Underlying Wix SDK backend surfaces* below for the direct SDK entry points
Next.js may also call from Server Actions / Route Handlers.

### Catalog — content (2 A, 2 Admin)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| **`getProductContent`** | catalogContent.web.js:81 | A | `(slug) → {copy, faqs, specs, videos, ...}` — CMS-backed overlay on Stores/Products |
| **`getProductSpecs`** | catalogContent.web.js:157 | A | `(slug) → Spec[]` |
| **`getCategoryContent`** | catalogContent.web.js:202 | A | `(category) → {hero, seo, copy, faqs}` |
| **`getAllCategories`** | catalogContent.web.js:265 | A | `() → CategorySlug[]` — nav + Shop router |
| `saveFAQ` | catalogContent.web.js:311 | X | Admin, out of scope |
| `saveProductSpecs` | catalogContent.web.js:381 | X | Admin, out of scope |

### Catalog — search + facets (9 A)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| **`searchProducts`** | categorySearch.web.js:84 | A | `(params) → {items, total, facets}` — main PLP query, `Stores/Products` + CF fields |
| **`getFilteredProductCount`** | categorySearch.web.js:240 | A | `(params) → {count}` — debounced chip counts |
| **`getFacetMetadata`** | categorySearch.web.js:310 | A | `(category) → {materials, colors, brands, priceBuckets, sizeBuckets, ...}` — 5-min TTL cache |
| `suggestFilterRelaxation` | categorySearch.web.js:430 | A | `(params) → {relaxed: Filter[], reason}` — zero-result recovery |
| `searchProducts` | searchService.web.js:156 | A | `(params) → {items, total}` — **collision** with `categorySearch.searchProducts` |
| `getFilterValues` | searchService.web.js:303 | A | `(category) → {facet: value[]}` |
| `fullTextSearch` | searchService.web.js:469 | A | `(query) → Product[]` — Stores name + description text match |
| **`getAutocompleteSuggestions`** | searchService.web.js:639 | A | `(prefix) → Suggestion[]` — header search box |
| `getPopularSearches` | searchService.web.js:723 | A | `() → string[]` |
| `recordSearchQuery` | searchService.web.js:745 | A | `(q) → {ok}` — fire-and-forget analytics |

> **Collision note**: `searchProducts` exists in `categorySearch` AND
> `searchService` with different param shapes and different facet semantics.
> Rename one during port (proposal: `categorySearch.searchProducts` →
> `searchByCategory`, keep `searchService.searchProducts` for header search).

### Catalog — recommendations (12 A + 2 S)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| `getRelatedProducts` | productRecommendations.web.js:35 | A | `(productId) → Product[]` |
| `getCompletionSuggestions` | productRecommendations.web.js:88 | A | `(cartItemIds[]) → Product[]` — Cart upsell |
| `getSameCollection` | productRecommendations.web.js:202 | A | `(productId) → Product[]` |
| **`getFeaturedProducts`** | productRecommendations.web.js:230 | A | `(limit?) → Product[]` — Home hero |
| `getSaleProducts` | productRecommendations.web.js:265 | A | `(limit?) → Product[]` — Home, PLP Sale |
| `getBundleSuggestion` | productRecommendations.web.js:298 | A | `(cartItemIds[]) → Bundle` |
| **`getBestsellers`** | productRecommendations.web.js:375 | A | `(limit?) → Product[]` |
| `trackRecentlyViewed` | productRecommendations.web.js:439 | S | `(productId) → {ok}` — server-side echo |
| `getRecentlyViewed` | productRecommendations.web.js:496 | S | `() → Product[]` — REWRITE: use localStorage in Next.js; keep server only for cross-device member sync |
| `getSimilarProducts` | productRecommendations.web.js:543 | A | `(productId) → Product[]` |
| `getCustomersAlsoBought` | productRecommendations.web.js:598 | A | `(productId) → Product[]` |
| `getBatchCurrentPrices` | productRecommendations.web.js:686 | A | `(ids[]) → {[id]: price}` — Cart reconciliation |
| `getRecommendations` | productRecommendations.web.js:752 | A | `({slot, context, limit}) → Product[]` — generic slot |
| `getFreightComplementProducts` | productRecommendations.web.js:830 | A | `(ids[]) → Product[]` — freight threshold upsell |

### Catalog — media + resources (6 A, 2 Admin)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| `getProductVideos` | productVideos.web.js:91 | A | `(slug) → Video[]` |
| `getCategoryVideos` | productVideos.web.js:125 | A | `(category) → Video[]` |
| `getBrandVideos` | productVideos.web.js:157 | A | `(brand) → Video[]` |
| `getAssemblyVideo` | productVideos.web.js:187 | A | `(slug) → Video \| null` |
| `saveVideo` | productVideos.web.js:225 | X | Admin |
| `getAllVideos` | productVideos.web.js:282 | X | Admin |
| **`getProductResources`** | productResources.web.js:32 | A | `(slug) → {manuals, care, warranty, ...}` |
| `getProductStructuredData` | productResources.web.js:68 | A | `(slug) → JsonLd` — PDP `<Metadata>` |

### Catalog — reviews + Q&A (5 A + 3 S, 2 Admin)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| **`getReviewSummary`** | productReviews.web.js:31 | A | `(productId) → {avg, count, distribution}` |
| `getUnifiedReviews` | productReviews.web.js:132 | A | `(productId, opts) → Review[]` |
| `getReviewHighlights` | productReviews.web.js:243 | A | `(productId) → {pros, cons, mentions}` |
| **`getBatchReviewSummaries`** | productReviews.web.js:310 | A | `(productIds[]) → {[id]: Summary}` — PLP cards |
| `getModerationQueue` | productReviews.web.js:379 | X | Admin |
| `submitQuestion` | productQA.web.js:70 | S | `(productId, questionText) → {ok, id}` |
| `answerQuestion` | productQA.web.js:154 | X | Admin |
| **`getProductQuestions`** | productQA.web.js:188 | A | `(productId, opts?) → Question[]` |
| `voteHelpful` | productQA.web.js:252 | S | `(questionId) → {ok, count}` |
| `flagQuestion` | productQA.web.js:287 | S | `(questionId) → {ok}` |
| `getUnanswered` | productQA.web.js:325 | X | Admin |
| `getQASchema` | productQA.web.js:364 | A | `(productId) → JsonLd` |
| `insertGuestQuestion` | productQA.web.js:412 | A | `({productId, question, memberName, email}) → {ok}` |

### Catalog — swatches + compare (8 A)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| **`getProductSwatches`** | swatchService.web.js:7 | A | `(productId) → Swatch[]` |
| `getAllSwatchFamilies` | swatchService.web.js:45 | A | `() → Family[]` |
| `getSwatchCount` | swatchService.web.js:61 | A | `() → {count}` |
| `getSwatchPreviewColors` | swatchService.web.js:81 | A | `(category) → Color[]` — PLP card preview |
| `getComparisonData` | comparisonService.web.js:70 | A | `(ids[]) → {matrix, diff}` |
| `buildShareableUrl` | comparisonService.web.js:313 | A | `(ids[]) → {url}` — REWRITE as url util |
| `trackComparison` | comparisonService.web.js:336 | A | `(ids[]) → {ok}` |
| `getPopularComparisons` | comparisonService.web.js:392 | A | `() → Pair[]` |

### Catalog — promotions (2 A)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| **`getActivePromotion`** | promotions.web.js:25 | A | `() → Promotion \| null` — global announcement bar |
| **`getFlashSales`** | promotions.web.js:94 | A | `() → FlashSale[]` — Home, PLP, PDP badges |

### Cart — session bridge (4 A)

`cartSessionService` is a mobile/web crossover. The Dallas mobile rig reads
`CartSessions` CMS directly by `memberId`. Breaking this breaks the mobile
app — Phase 2 dual-writes to both Headless `currentCart` AND this service
until Dallas migrates off.

| Method | File | Perm | Signature |
|---|---|:-:|---|
| **`createSession`** | cartSessionService.web.js:41 | A | `(token, data) → {ok, sessionId}` — first cart add |
| **`getSession`** | cartSessionService.web.js:77 | A | `(token) → CartSession \| null` — return-visit hydration |
| **`updateCartItems`** | cartSessionService.web.js:109 | A | `(token, items) → {ok}` — every mutation |
| **`mergeGuestCart`** | cartSessionService.web.js:155 | A | `(token, memberId) → {ok, merged: n}` — post-login |

### Cart — coupons + financing (2 A + 1 S, 5 Admin)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| `createWelcomeCoupon` | couponsService.web.js:25 | X | Admin (loyalty cron) |
| **`getActiveCoupons`** | couponsService.web.js:95 | S | `() → Coupon[]` — member-scoped autocomplete |
| `createBirthdayCoupon` | couponsService.web.js:142 | X | Admin |
| `createTierUpgradeCoupon` | couponsService.web.js:211 | X | Admin |
| `generateRecoveryCoupon` | couponsService.web.js:282 | X | Admin |
| `createCartRecoveryCoupon` | couponsService.web.js:384 | X | Admin |
| **`validateBundleCoupon`** | couponValidation.web.js:58 | S | `(code, items) → {ok, discount, reason?}` |
| `getFinancingWidget` | financingCalc.web.js:48 | A | `(price, productId) → {installments, terms, msg}` — PDP |
| `calculateForTerm` | financingCalc.web.js:89 | A | `(principal, term) → {monthly, total, apr}` — REWRITE: pure math, client |
| `getAfterpayBreakdown` | financingCalc.web.js:132 | A | `(price) → {installments: 4, amount}` — REWRITE: pure math |
| **`getCartFinancing`** | financingCalc.web.js:157 | A | `(subtotal) → {monthly, term, apr}` — Cart line |

### Checkout — optimization + summary (6 A, 1 Admin)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| **`calculateOrderSummary`** | checkoutOptimization.web.js:54 | A | `(items, opts) → {subtotal, discounts, shipping, tax, total}` — complex stitch over Headless totals |
| **`validateShippingAddress`** | checkoutOptimization.web.js:116 | A | `(addr) → {valid, suggestions?, errors}` |
| **`getShippingOptions`** | checkoutOptimization.web.js:155 | A | `(cart, address) → Option[]` — carrier + eta + cost |
| **`getDeliveryEstimate`** | checkoutOptimization.web.js:199 | A | `(zip, items) → {min, max, serviceLevel}` |
| `trackCheckoutStep` | checkoutOptimization.web.js:240 | A | `(step, data) → {ok}` — fire-and-forget |
| `getAbandonmentRate` | checkoutOptimization.web.js:284 | X | Admin |
| `getExpressCheckoutSummary` | checkoutOptimization.web.js:328 | A | `(cart) → Summary` — PDP "Buy now" |

### Checkout — guest flow (2 A + 2 S)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| **`saveGuestSession`** | guestCheckout.web.js:52 | A | `(email, data) → {ok, token}` |
| `linkGuestOrdersToMember` | guestCheckout.web.js:113 | S | `(email) → {linked: n}` — post-signup |
| `getGuestOrdersByEmail` | guestCheckout.web.js:179 | S | `(email) → Order[]` — Order Tracking |
| `getSoftPromptConfig` | guestCheckout.web.js:224 | A | `() → {copy, variant}` — Thank You nudge |

### Checkout — payment options (5 A)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| **`getPaymentOptions`** | paymentOptions.web.js:53 | A | `(cart) → Option[]` — cards, Afterpay, financing |
| `getAfterpayMessage` | paymentOptions.web.js:79 | A | `(price) → {copy, enabled}` — PDP/PLP cards |
| **`getBatchPaymentBadges`** | paymentOptions.web.js:99 | A | `(productIds[]) → {[id]: Badge[]}` — PLP |
| **`getCheckoutPaymentSummary`** | paymentOptions.web.js:154 | A | `(cart) → {total, breakdown}` |
| `getInstallmentCalculation` | paymentOptions.web.js:213 | A | `(price, term) → {monthly, total}` — REWRITE: pure math |

### Shipping — domestic + UPS + intl (9 A, 2 Admin)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| **`getShippingEstimate`** | shippingIntelligence.web.js:103 | A | `(zip, items) → {low, high, serviceLevel}` |
| `calculateBundleQuote` | shippingIntelligence.web.js:167 | A | `(items) → {quote}` |
| **`getUPSRates`** | ups-shipping.web.js:168 | A | `(cart, address) → Rate[]` |
| `createShipment` | ups-shipping.web.js:345 | X | Admin |
| `trackShipment` | ups-shipping.web.js:520 | A | `(trackingNo) → TrackingEvent[]` — Phase 3 (Order Tracking) |
| `validateAddress` | ups-shipping.web.js:613 | A | `(addr) → {valid, corrected?}` |
| `getPackageDimensions` | ups-shipping.web.js:689 | A | `(items) → {packages: Box[]}` |
| `getShippingZone` | internationalShipping.web.js:29 | A | `(country) → Zone` |
| `isShippableCountry` | internationalShipping.web.js:66 | A | `(code) → boolean` |
| `getInternationalShippingEstimate` | internationalShipping.web.js:91 | A | `(cart, country) → {estimate}` |
| `getInternationalShippingRates` | internationalShipping.web.js:166 | A | `(cart, country) → Rate[]` |

### Inventory (4 A + 6 S, 6 Admin)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| **`getStockStatus`** | inventoryService.web.js:43 | A | `(productId) → {inStock, qty, threshold}` |
| `getInventoryDashboard` | inventoryService.web.js:96 | X | Admin |
| `updateStockLevel` | inventoryService.web.js:144 | X | Admin |
| `getRestockSuggestions` | inventoryService.web.js:226 | X | Admin |
| **`signUpBackInStock`** | inventoryService.web.js:292 | A | `(productId, email) → {ok}` — PDP OOS form |
| `getBackInStockSignups` | inventoryService.web.js:341 | X | Admin |
| `getLowStockAlerts` | inventoryService.web.js:374 | X | Admin |
| `getBackInStockDashboard` | inventoryService.web.js:416 | X | Admin |
| `markSignupsNotified` | inventoryService.web.js:469 | X | Admin |
| **`getInventoryUrgency`** | inventoryService.web.js:520 | A | `(productId) → {level, copy}` — PDP urgency badge |
| `getStockStatus` | inventoryAlerts.web.js:73 | A | `(productId) → StockStatus` — **collision** with `inventoryService.getStockStatus` |
| **`getBatchStockStatus`** | inventoryAlerts.web.js:148 | A | `(ids[]) → {[id]: StockStatus}` — PLP cards, Cart |
| `syncInventory` | inventoryAlerts.web.js:225 | S | `() → {synced}` |
| `getLowStockAlerts` | inventoryAlerts.web.js:342 | S | `() → Alert[]` |
| `acknowledgeAlert` | inventoryAlerts.web.js:402 | S | `(alertId) → {ok}` |
| `resolveAlert` | inventoryAlerts.web.js:445 | S | `(alertId) → {ok}` |
| `updateThreshold` | inventoryAlerts.web.js:491 | S | `(productId, n) → {ok}` |
| `getLowStockSummary` | inventoryAlerts.web.js:546 | S | `() → Summary` |
| `getProductInventory` | liveInventory.web.js:22 | A | `(productId) → Inventory` |
| `registerStockNotification` | liveInventory.web.js:56 | A | `(productId, email) → {ok}` — **dedupe** with `signUpBackInStock` |

> **Collision note**: `getStockStatus` lives in both `inventoryService` and
> `inventoryAlerts`. Pick one during Phase 2 port; the other becomes an
> alias. Same for `signUpBackInStock` / `registerStockNotification`.

### Orders — tracking (4 A)

| Method | File | Perm | Signature |
|---|---|:-:|---|
| **`lookupOrder`** | orderTracking.web.js:53 | A | `(orderNo, email) → Order \| null` — Order Confirmation + standalone tracking |
| `subscribeToNotifications` | orderTracking.web.js:180 | A | `(orderId, email, channels[]) → {ok}` |
| `unsubscribeFromNotifications` | orderTracking.web.js:254 | A | `(orderId, token) → {ok}` |
| **`getTrackingTimeline`** | orderTracking.web.js:293 | A | `(orderId) → Event[]` |

## Stores · Cart · Checkout summary

| Domain | Anyone | SiteMember | Admin | Files |
|---|:-:|:-:|:-:|:-:|
| Catalog content | 4 | 0 | 2 | 1 |
| Catalog search + facets | 10 | 0 | 0 | 2 |
| Catalog recommendations | 12 | 2 | 0 | 1 |
| Catalog media + resources | 6 | 0 | 2 | 2 |
| Catalog reviews + Q&A | 8 | 3 | 2 | 2 |
| Catalog swatches + compare | 8 | 0 | 0 | 2 |
| Catalog promotions | 2 | 0 | 0 | 1 |
| Cart session bridge | 4 | 0 | 0 | 1 |
| Cart coupons + financing | 5 | 2 | 5 | 3 |
| Checkout optimization | 6 | 0 | 1 | 1 |
| Checkout guest flow | 2 | 2 | 0 | 1 |
| Checkout payment options | 5 | 0 | 0 | 1 |
| Shipping (domestic + UPS + intl) | 9 | 0 | 1 | 3 |
| Inventory | 4 | 6 | 6 | 3 |
| Orders tracking | 4 | 0 | 0 | 1 |
| **Total (Stores/Cart/Checkout slice)** | **89** | **15** | **19** | **25** |

## § Underlying Wix SDK backend surfaces

The Velo methods above ultimately call one of three Wix SDK backend modules.
Next.js (cf-3qt) can import some of these directly via the `@wix/sdk` +
`@wix/stores` + `@wix/ecom` headless SDK, skipping the Velo round-trip.
Decision rule: Headless first; fall back to the CF wrapper above when the
call depends on a CF CMS collection, cross-Wix aggregation, or a Headless
gap is confirmed by Phase 0 smoke.

### `wix-stores-backend` / `@wix/stores` · products + inventory + collections

| SDK call | Perm | Used by (Velo) | Phase 2 direct call? |
|---|:-:|---|:-:|
| `products.queryProducts({filter, sort, paging})` | A | searchService, categorySearch, catalogPriceFix, catalogNameUpdate | ✓ — PLP base list, PDP by slug |
| `products.getProduct(id)` | A | productResources, productReviews | ✓ — PDP |
| `products.getProductBySlug(slug)` | A | (via `queryProducts` filter `slug:$eq`) | ✓ — PDP |
| `products.updateProduct(id, patch)` | X | batchAltText, catalogPriceFix | ✗ Admin |
| `products.getProductVariants(productId)` | A | (variants read via product.variants array) | ✓ — PDP variant picker |
| `collections.queryCollections({filter, paging})` | A | catalogContent (slug→id resolution) | ✓ — Shop router, PLP header |
| `collections.getCollection(id)` | A | catalogContent | ✓ |
| `inventoryItems.queryInventoryItems({filter})` | A | inventoryService, inventoryAlerts, liveInventory | ✓ — PDP + PLP batch in-stock |
| `inventoryItems.updateInventoryVariants(id, variants)` | X | inventorySync | ✗ Admin |

> The Velo wrapper adds CF-specific overlays (`categoryContent`, featureTags,
> comfortLevel, brand, material). If Headless `queryProducts` returns CF
> custom fields (**Phase 0 Q3**), many PORT entries collapse to HEADLESS.

### `wix-stores-backend-v2` · advanced catalog (if enabled)

Not imported anywhere in the current Velo codebase. Listed here so Phase 2
knows the v2 surface exists — it adds category-based hierarchies, bulk
operations, and richer variant queries. **Candidate for direct Next.js use**
if Phase 2 finds v1 `queryProducts` gaps (e.g., multi-collection filter,
variant-level facets). Confirm v2 availability on our Wix plan during Phase 0.

| SDK call | Notes |
|---|---|
| `categoriesV3.queryCategories` | hierarchical category tree — replaces `Stores/Collections` flat queries if we adopt it |
| `productsV3.queryProducts` | richer filter grammar incl. variant-level |
| `productsV3.bulkUpdate` | admin only |

### `wix-ecom-backend` / `@wix/ecom` · cart + checkout + orders

| SDK call | Perm | Used by (Velo) | Phase 2 direct call? |
|---|:-:|---|:-:|
| `currentCart.getCurrentCart()` | A | (Next.js wires directly) | ✓ — Cart hydration |
| `currentCart.addToCurrentCart({lineItems})` | A | bundleService, bundleBuilder, bundleDeals | ✓ — PDP + Cart add |
| `currentCart.updateCurrentCart({lineItems})` | A | bundleService | ✓ — Cart mutate |
| `currentCart.removeLineItemsFromCurrentCart([ids])` | A | bundleService | ✓ — Cart remove |
| `currentCart.estimateCurrentCartTotals({selectedShippingOption})` | A | (Next.js wires directly) | ✓ — Cart totals, Checkout preview |
| `currentCart.createCheckoutFromCurrentCart({channelType})` | A | (Next.js wires directly) | ✓ — Checkout init |
| `checkout.getCheckout(id)` | A | — | ✓ — Checkout step hydration |
| `checkout.updateCheckout(id, patch)` | A | — | ✓ — address/shipping/coupon apply |
| `redirects.createRedirectSession({ecomCheckout, callbacks})` | A | — | ✓ — Wix-hosted payment handoff |
| `orders.queryOrders({filter})` | X | affiliateProgram, fulfillment, facebookCatalog | ✗ Admin (server-only reads) |
| `orders.getOrder(id)` | A-ish (member or guest+email) | orderTracking | ✓ — Order Confirmation |

> **Phase 2 cart flow proposal**: Client → Next.js Server Action →
> `@wix/ecom` `currentCart.*` (primary) + dual-write to CF
> `cartSessionService.updateCartItems` (mobile bridge) until Dallas
> migrates off `CartSessions` CMS.
> **Checkout**: Server Action creates checkout from current cart, returns a
> `redirects.createRedirectSession` URL, Next.js redirects browser to the
> Wix-hosted payment page, Wix redirects back to `/order-confirmation?orderId=...`.

## Stores · Cart · Checkout — cross-cutting concerns

1. **Method-name collisions** — `searchProducts` (2 files),
   `getStockStatus` (2 files), `getLowStockAlerts` (2 files),
   `signUpBackInStock` ↔ `registerStockNotification` (dedupe target).
   Rename or namespace during port.
2. **Dual-source risk** — the CF-specific product overlay lives partly
   on `Stores/Products` CF columns (`material`, `color`, `featureTags`,
   `comfortLevel`, `dimensions.*`, `numericRating`) AND partly in a
   separate `Products` CMS collection populated by `loadCatalogMaster`.
   Phase 0 must confirm which is canonical before Next.js binds.
3. **`CartSessions` mobile bridge** — dual-write from Next.js until
   Dallas migrates mobile off direct `CartSessions` queries. Do not
   retire `cartSessionService` web methods before that migration.
4. **Facet cache** — `categorySearch.getFacetMetadata` caches 5 min in
   Velo memory. Replicate as `revalidate: 300` on the Next.js Server
   Component fetch, OR move cache to Redis / `unstable_cache` with
   `revalidateTag('facets')` triggered by product-update webhooks.
5. **Pure-math REWRITEs** — `financingCalc.calculateForTerm`,
   `financingCalc.getAfterpayBreakdown`, `paymentOptions.getInstallmentCalculation`,
   `comparisonService.buildShareableUrl` are trivial client-side util;
   don't round-trip to Velo.
6. **`getRecentlyViewed` / `trackRecentlyViewed`** — move to
   client-side `localStorage` in Next.js; keep server only for
   cross-device member sync (Phase 3).
7. **Admin-scoped methods (19)** — deliberately out of scope. Wix
   Studio dashboard (or a separate admin SPA) keeps using them.

## Open questions for Phase 0 (morgott half)

Q1. Does Wix Headless auth (OAuth client token) grant enough to call
    `Permissions.SiteMember` Velo web methods end-to-end, or do we need
    a separate `WIX_BACKEND_KEY` shared-secret layer? (Affects cart +
    checkout member paths and all 15 SiteMember methods above.)

Q2. Can Headless `currentCart` coexist with dual-writes to `CartSessions`
    CMS without race conditions when the same member has concurrent
    mobile + web sessions?

Q3. Does Headless `@wix/stores` `products.queryProducts` return our CF
    custom fields (`material`, `color`, `featureTags`, `comfortLevel`,
    `dimensions.*`, `numericRating`)? If NO, every PDP/PLP must still
    hit Velo `searchProducts` for facets.

Q4. Can Headless `orders.getOrder` read a guest order using just email
    + order number, or do we always need Velo `orderTracking.lookupOrder`?

Q5. Is `wix-stores-backend-v2` available on our Wix plan, and does
    its richer filter grammar close any current Velo-only gaps?

Q6. Single RPC router vs. per-module HTTP wrapper — Phase 0 spike to
    compare latency + auth surface. Default recommendation:
    `POST /_functions/rpc` with `{module, method, args}` and a single
    auth guard.



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
