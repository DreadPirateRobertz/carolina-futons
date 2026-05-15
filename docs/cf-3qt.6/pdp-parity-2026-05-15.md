# PDP parity — variant selection + add-to-cart — 2026-05-15

**Bead:** cf-lc1c (parent cf-3qt.6 — Phase 6 parity testing)
**Auditor:** rennala
**Method:** Static read of both PDP implementations side-by-side.
- **Wix (current production):** `src/pages/Product Page.js` orchestrator + `src/public/ProductOptions.js`, `src/public/AddToCart.js`, `src/public/cartService.js`, `src/public/product/swatchSelector.js`, `src/public/product/variantSelector.js`
- **cfw (cutover target):** `src/app/products/[slug]/page.tsx` server component + `src/components/product/PdpInteractive.tsx` client island + `src/components/product/VariantPicker.tsx` + `src/components/cart/AddToCartButton.tsx` + `src/lib/product/variant-selection.ts`

**Scope:** variant selection (option dropdowns + swatch grid) and add-to-cart flow only. Out-of-scope for this audit: gallery zoom/lightbox, mattress-bundle upsell, financing widget, customer-video grid, reviews — those land in sibling cf-3qt.6 sub-beads (see [cf-3qt.6.1](../audits/) screenshot matrix).

**Go/no-go input:** Phase 8 cutover gate. Critical gap → abort. Cosmetic gap → file follow-up.

## TL;DR

cfw PDP variant + cart flow is functionally close to Wix but **two critical gaps** block parity:

- **G-1 (P1)** — No quantity selector on cfw PDP. Wix has +/– buttons clamped to MIN_QUANTITY/MAX_QUANTITY from `cartService`; cfw `AddToCartButton` accepts a `quantity` prop but `PdpInteractive` never passes one, so every cfw PDP click adds qty=1.
- **G-2 (P1)** — No gallery sync on variant change. Wix `swatchSelector` swaps the main gallery to the variant's `imageSrc`; cfw passes only `activeUrl={imageUrl}` (the product's static main image) to `PdpGallery`, with no reactivity to `selectedVariant.media`.

Three lower findings (G-3 P2 URL-state hydration; G-4 P2 call-for-price handling; G-5 P3 swatch-modal feature gap).

## Side-by-side matrix

| Feature | Wix (production) | cfw (cutover) | Verdict |
|---|---|---|---|
| Variant option types | size dropdown + finish dropdown + fabric swatch grid + full-screen swatch modal | per-option `VariantPicker` (auto-renders swatches/buttons) | ✅ functionally equivalent for size/finish; ⚠ swatch modal absent (G-5) |
| Variant → price reactivity | `updateStickyPrice(variant)` on dropdown change (`AddToCart.js`) | `getSelectedPrice(variants, selection, fallbackPrice)` derived in render (`PdpInteractive:162`) | ✅ behaviorally equivalent |
| Variant → stock UI | `outOfStock` flag dims/disables swatch tile; OOS dropdown options still selectable but cart blocks (`ProductOptions:143-180`) | `available` boolean disables choice button (`VariantPicker:209`); `isVariantInStock(selectedVariant)` gates `inStock` flag → disables `AddToCartButton` | ✅ functionally equivalent; cfw is stricter (button explicitly disabled vs Wix silent reject) |
| Variant → gallery sync | `swatchSelector.js:111` swaps to `variant.imageSrc` on swatch click | none — `activeUrl={imageUrl}` is the product's static main image | ❌ **G-2** |
| Quantity selector | `initQuantitySelector` wires `#quantityInput` + `#quantityMinus`/`#quantityPlus`; `clampQuantity` enforces MIN/MAX | `AddToCartButton.quantity` prop defaults to 1; never set from PDP | ❌ **G-1** |
| Add-to-cart button | `addToCart(variantId, qty)` via `cartService` + `trackCartAdd` + `fireAddToCart` GA4 + bundle-upsell `getBundleSuggestion` | `useCart().addLine()` optimistic + `addItemAction` server action + `trackAddToCart` GA4 + `fireMetaEvent` | ✅ functionally equivalent; cfw also fires Meta Pixel which Wix did not (improvement, not gap) |
| Post-add feedback | sticky cart bar + bundle upsell prompt | `onAdded` callback dismisses sticky-CTA bottom sheet on cf-pdp-sticky-cta path; otherwise inline button state | ⚠ minor difference in surface but both confirm success |
| Variant URL hydration | dataset-driven; `productDataset.onCurrentIndexChanged` (`ProductOptions:31-34`) — selection survives only same-session navigation | `VariantPicker:30` uses `initialSelection(productOptions, variants)` from saved state; **no URL query-param hydration** | ⚠ **G-3** — Wix's stateful dataset persists across SPA navigation; cfw has no equivalent so deep-linked share URLs ("buy this in walnut") can't pre-select |
| Call-for-price handling | `isCallForPrice(price)` shows "Call for Pricing" + suppresses sticky bar | needs verification — `selectedPrice` may surface `$0.00` or empty | ⚠ **G-4** |
| Wishlist toggle | `initWishlistToggle` — heart icon + `fireAddToWishlist` GA4 | out of scope for cf-lc1c (sibling bead) | n/a |

## Findings

### G-1 (P1) — Quantity selector missing on cfw PDP
**Where:** `src/components/product/PdpInteractive.tsx:187-199` (the `addToCartProps` builder) and `src/components/cart/AddToCartButton.tsx:47` (default `quantity = 1`).

**Behavior:** Wix PDP has +/– buttons and a numeric input wired to `clampQuantity(MIN_QUANTITY, MAX_QUANTITY)` in `AddToCart.js`. cfw `PdpInteractive` builds `addToCartProps` without a `quantity` field, so every cfw add lands as qty=1 regardless of what the customer wanted.

**Impact:** A customer who wants 2 mattresses on a $1,200 SKU must click "Add to cart" twice + navigate to cart. Friction on multi-unit orders. Reorder-from-history flows that pass quantity into the cart URL still work; only the PDP-side selector is missing.

**Fix:** add a `QuantitySelector` component (or thread `useState<number>` into `PdpInteractive`) + pass through to `AddToCartButton.quantity`. ~30 LOC + 1 component file. Consider mirroring the Wix MIN/MAX constants to keep the cart-side `clampQuantity` boundaries consistent.

**Why P1:** customer-visible commerce regression. Holds against go/no-go.

### G-2 (P1) — Gallery does not sync with variant selection on cfw
**Where:** `src/components/product/PdpInteractive.tsx:204-209` — `PdpGallery` receives a static `activeUrl={imageUrl}` (product main image) with no derivation from `selectedVariant.media`.

**Behavior:** Wix `swatchSelector.js:111` reads `variant.imageSrc` on swatch click and swaps the gallery's main image. cfw renders the same gallery regardless of which variant is selected.

**Impact:** if a fabric-frame product has per-color photography (e.g., Maple frame vs Walnut frame photographed in the same room), customers selecting Walnut see the Maple photo. Erodes confidence in the variant they're about to buy. Especially bad for upholstery / fabric-led products where the photo IS the differentiator.

**Fix:** in `PdpInteractive`, derive `activeUrl` (or pass a new `variantGalleryImages` prop) from `selectedVariant?.media?.mainMedia` when present, falling back to product-level. Need to confirm the V3 Headless `Variant.media` shape is populated for current catalog. ~10 LOC + 1 prop addition; coordinate with `PdpGallery` to accept a controlled `activeUrl` that re-renders.

**Why P1:** the gap actively misleads customers about what they're buying. Goes against the "what you see is what you get" honesty principle of the brand. Cutover blocker.

### G-3 (P2) — No URL-state hydration of variant selection on cfw
**Where:** `src/components/product/VariantPicker.tsx:30` — `initialSelection(productOptions, variants)` reads only from in-memory defaults; no `useSearchParams` integration.

**Behavior:** Wix `productDataset` retains the selected variant across same-session SPA navigation (e.g., user picks Walnut, browses elsewhere, returns — Walnut stays selected). It also offers no deep-link URL (variant choice is dataset-internal, invisible). cfw has neither in-session retention nor URL-param hydration. Sharing a URL pre-selecting a variant is impossible.

**Impact:** marketing emails / blog posts that link to a specific variant ("see our Walnut frame here") land on the default-selected variant and the customer has to re-pick. Modest friction; mostly affects content marketing.

**Fix:** add `?size=...&color=...` URL query handling to `VariantPicker.initialSelection`. ~20 LOC + a `useSearchParams` hook + URL-update side effect on selection change (via `router.replace` with `scroll: false`). Likely deferred post-cutover unless mayor calls it out.

**Why P2:** missing-feature, not a regression — Wix didn't have URL hydration either. New capability, not parity blocker.

### G-4 (P2) — Call-for-price ($0 or $1) handling unverified on cfw
**Where:** `getSelectedPrice` derivation in `PdpInteractive.tsx:162` — produces a `selectedPriceCents` + `selectedPrice` (formatted). Needs verification of behavior when underlying variant price is 0 or 1.

**Behavior (Wix):** `isCallForPrice(price)` (`public/productPageUtils.js`) treats `price <= 1` as call-for-price → shows "Call for Pricing" text + suppresses the sticky cart bar.

**Behavior (cfw):** unclear from grep — may surface "$0.00" / "$1.00" as a real price or may have its own call-for-price branch I didn't find. Catalog has products that intentionally use this placeholder (cf-3pwy F1 caveat: catalogPriceFix sets price=0 to trigger "Price unavailable" in native widgets).

**Fix:** runtime smoke test on a call-for-price SKU in cfw (`/products/eureka-frame-callable` or whichever is set to $0). If cfw renders "$0.00" + an enabled "Add to cart" button, that's a customer-facing bug. Either re-introduce `isCallForPrice` in `getSelectedPrice` or branch in `PdpInteractive` to disable cart + swap copy.

**Why P2:** affects a known subset of products. Verify before declaring parity-pass.

### G-5 (P3) — Full-screen swatch gallery modal absent on cfw
**Where:** Wix `src/public/ProductOptions.js:223` — "fabric swatch gallery modal with search and detail view".

**Behavior (Wix):** for products with many fabric options (e.g., upholstery futons with 30+ fabric choices), Wix offers a "see all fabrics" modal with search + per-swatch detail. cfw `VariantPicker` renders inline tiles only; no modal escape hatch for high-option-count products.

**Impact:** a futon with 30 fabric choices renders 30 inline tiles, which works on desktop but is unergonomic on mobile. Wix's modal collapses the inline strip to ~6 + "see all" → modal.

**Fix:** post-cutover. Either build a `<SwatchModal>` component or accept the inline-only UX for V1 of cfw and ship the modal as a polish bead.

**Why P3:** affects high-option-count products only. The inline list works; just less ergonomic. Not a cutover blocker.

## Pre-cutover acceptance (cf-3qt.8)

- [ ] **G-1 fix** — add QuantitySelector to cfw PDP, pass through to AddToCartButton. **REQUIRED.**
- [ ] **G-2 fix** — wire `selectedVariant?.media` into `PdpGallery.activeUrl` (with product-level fallback). **REQUIRED.**
- [ ] **G-4 verification** — smoke test cfw PDP on a call-for-price SKU; either confirm correct handling or add the branch. **REQUIRED.**
- [ ] (optional) **G-3** — URL hydration of variant selection. Defer post-cutover.
- [ ] (optional) **G-5** — full-screen swatch modal. Defer post-cutover.

## Out of scope (sibling beads expected)

- **PDP gallery internals** — zoom, lightbox, image-comparison slider, 360° spin, AR model viewer. Sibling cf-3qt.6.x.
- **Mattress bundle upsell** — cross-sell prompt below add-to-cart. Sibling cf-3qt.6.x.
- **Financing widget** — Klarna / BNPL pricing display. Sibling.
- **Reviews + customer video grid** — sibling.
- **Wishlist toggle parity** — sibling.
- **Bundle suggestion popup** — Wix shows a suggestion after add; cfw's `onAdded` path differs. Sibling.

## References

- Wix source: `src/pages/Product Page.js`, `src/public/ProductOptions.js`, `src/public/AddToCart.js`, `src/public/cartService.js`, `src/public/product/swatchSelector.js`, `src/public/product/variantSelector.js`, `src/public/productPageUtils.js`
- cfw source: `src/app/products/[slug]/page.tsx`, `src/components/product/PdpInteractive.tsx`, `src/components/product/VariantPicker.tsx`, `src/components/cart/AddToCartButton.tsx`, `src/lib/product/variant-selection.ts`
- Companion audit: `docs/audits/wix-stores-catalog-v1v3-audit-2026-05-10.md` (cf-3pwy) for the V1↔V3 SDK boundary that drives both PDPs' product data
- Parent: cf-3qt.6 (Phase 6 parity testing)
- Cutover gate: cf-3qt.8 (DNS flip)
