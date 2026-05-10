# Wix Stores Catalog V1 vs V3 SDK audit — 2026-05-10

**Bead:** cf-3pwy
**Auditor:** rennala
**Method:** Static read of every Wix Stores SDK import + dispatch site across `cfutons/src/backend/` (Wix Velo runtime) and `carolina-futons-web/src/lib/wix/` (Next.js Headless OAuth runtime). Mapped read vs write paths, flagged cases where a V1 write could diverge from a V3 read consumer.
**Pre-cutover scope:** the cfutons + cfw split must hold consistently when DNS flips at cf-3qt.8 — any V1/V3 schema drift becomes a customer-visible incident.

## TL;DR

cfutons is **solidly V1** (4 direct `wix-stores-backend` imports + ~15 `wixData.query('Stores/Products'|'Stores/Orders')` call sites). cfw is **solidly V3** (uses `@wix/auto_sdk_stores_products` and sub-package equivalents via `@wix/sdk` + Headless OAuth).

**No mixed V1/V3 inside a single runtime** — clean architectural boundary. Risk is at the **inter-runtime data surface**: V1 writes from cfutons land in Wix Stores' internal store; V3 reads from cfw consume the same store via the Headless REST API. Wix's internal V1↔V3 sync is generally synchronous within a single store, but four cfutons V1 mutator paths warrant explicit pre-cutover verification because they touch product fields cfw V3 readers depend on.

**One concrete P2 finding** (Finding A below) plus three lower-severity observations.

## V1 inventory (cfutons)

### Direct `wix-stores-backend` imports (4 files)

| File | Purpose | API surface used | Mutates? |
|------|---------|------------------|----------|
| `src/backend/batchAltText.web.js` | Bulk alt-text backfill on product images | `products.queryProducts()` + `products.updateProductFields(id, {…})` | yes — writes `media[].altText` |
| `src/backend/catalogPriceFix.web.js` | One-shot bug-fix to zero out a stale price | `products.queryProducts()` + `products.updateProductFields(id, {price: 0})` | yes — writes `price` |
| `src/backend/catalogNameUpdate.web.js` | Bulk rename of products | `products.queryProducts()` + `products.updateProductFields(id, {name})` | yes — writes `name` |
| `src/backend/inventorySync.web.js` | Inventory query / sync helper | `products.queryProducts()` only (paginated read) | no — read-only |

### `wixData.query('Stores/Products')` / `'Stores/Orders'` call sites (15+, V1-collection access)

Read-only in every case I inspected. Sites:
- `http-functions.js#fetchAllProducts` — paginates `'Stores/Products'`
- `orderTracking.web.js` — queries `'Stores/Orders'` for order lookup
- `imageAudit.web.js` — reads `'Stores/Products'` for media audit
- `catalogContent.web.js` — content-page lookups
- `seoAutoMeta.web.js` — meta-description seeding
- `searchService.web.js` (4 call sites) — catalog search, name + description query
- `events.js#wixStores_onInventoryVariantUpdated` — `wixData.get('Stores/Products', productId)` to fetch the parent product
- `futonSommelier.web.js` — recommendations engine
- `chatbotService.web.js` — catalog snapshot for chatbot context

These all use the V1 collection shape. cfw V3 readers don't go through `wixData` — they call `client.products.queryProducts()` against the Headless REST endpoint, which Wix internally maps to V3. So cfutons reads via wixData are V1; cfw reads via SDK are V3. No conflict at the read boundary, just two views of the same store.

### Wix Stores event handlers (in `events.js`)

| Handler | Source SDK | Notes |
|---------|------------|-------|
| `wixStores_onProductCreated` | V1 event bus | Fires for both V1 and V3 product creates; payload is V1 shape |
| `wixStores_onProductUpdated` | V1 event bus | Same |
| `wixStores_onInventoryVariantUpdated` | V1 event bus | Triggers restock notifications via `notificationService.web.js` |
| `wixEcom_onOrderCreated` / `Approved` / `Fulfilled` / `Delivered` / `Canceled` | V1 ecom event bus | Payload is V1 shape; cfw post-cutover orders flow through Wix Headless checkout but events still surface in V1 shape |

**No V3 event handlers.** Wix Velo's event bus is V1-only; V3 events would need polling or webhook-bridging from the Headless side. Not a gap — by-design — but worth documenting.

## V3 inventory (cfw)

### Sub-package SDK imports (`carolina-futons-web/src/lib/wix-client.ts`)

cfw deliberately imports the V3 sub-packages (`@wix/auto_sdk_stores_products`, `@wix/auto_sdk_stores_collections`, etc.) rather than the umbrella `@wix/stores` to keep tree-shaking working (per existing comment at line 2 of `wix-client.ts`). Same V3 surface, smaller bundle.

V3 reads (cfw):
- `src/lib/wix/products.ts#getCollectionBySlug` → `client.collections.getCollectionBySlug(slug)`
- `getProductsByIds`, `listProducts`, `listAllProducts` → V3 product query
- `src/lib/wix/cart.ts` → `@wix/ecom` checkout/cart APIs (V3-equivalent)
- `src/lib/wix/orders.ts` → V3 orders read
- `src/lib/wix/data.ts` → wixData via V3 surface

V3 writes (cfw):
- `src/lib/wix/product-image-write.ts` (cfw-ajk.7 pending — variant.media.items mutation via `@wix/sdk`)
- Otherwise cfw is read-mostly; writes happen via Velo HTTP wrappers (cf-vtx5 dispatchers) which run in cfutons V1 land

## Findings

### Finding A — `catalogPriceFix.web.js` writes `price` via V1; cfw V3 reads `actualPriceRange` (P2)
**Where:** `src/backend/catalogPriceFix.web.js:76` — `products.updateProductFields(product._id, { price: 0 })`.

**Why it's a risk:** V1's `Product.price` is a single number. V3's `productsV3` exposes pricing via `actualPriceRange.minValue.amount` / `compareAtPriceRange` and a separate `priceData` shape with currency + formatted strings. Wix's internal sync DOES update both surfaces when V1 mutates, BUT: (a) catalogPriceFix sets price to **0**, which V3 may surface as `unavailable` rather than as a `$0.00` display; (b) variants inherit pricing from the product unless overridden, and V1 `updateProductFields` does NOT propagate to per-variant prices.

**Concrete impact at cutover:** if catalogPriceFix runs near or after DNS flip, a product that V3 cfw expects to show as `$0` may render as "Out of stock" or "Unavailable" instead, AND any variant-level prices stay frozen at their pre-fix values.

**Recommended fix:** before next run, either (a) call `wixStores.products.bulkUpdateProductsByFilter` (V1 batch helper that internally syncs to V3 better) or (b) use the V3 endpoint directly via `@wix/sdk` from a one-shot script. For the existing one-shot file, add a comment block documenting the V1-write divergence so the next operator knows.

### Finding B — V1 event handlers consume V1-shape payloads; cfw post-cutover orders should still surface (informational)
**Where:** `src/backend/events.js` — `wixEcom_onOrderCreated` etc.

**Observation:** Wix Headless OAuth checkouts (cfw post-cutover order flow) still fire the V1 ecom event bus per Wix docs. Confirmed by inspection of `wixEcom_onOrderCreated` payload shape (`event.entity.buyerInfo.email` etc — V1 shape). No fix needed; cf-jmmk + cf-fovb already wired all the events.

**What to verify post-cutover:** that a real cfw checkout fires `wixEcom_onOrderCreated` with the expected payload. Cover via cf-w1u1 row #5 (already in the staging probe-runbook) and cf-jvut row "test order placement" once Stilgar publishes the staging backend.

### Finding C — `inventorySync.web.js` reads V1; if V3 inventory diverges from V1 the sync is wrong (P3)
**Where:** `src/backend/inventorySync.web.js:203` — `products.queryProducts().limit(PAGE_SIZE)`.

**Why it's a P3:** Wix's inventory storage is shared between V1 and V3. The risk is theoretical unless Wix introduces an inventory-only V3 endpoint that splits stock from product. As of the audit date (2026-05-10) no such split exists per the Wix docs. Document the assumption; reconsider if Wix announces inventory schema changes.

### Finding D — `wixStores_onInventoryVariantUpdated` reads parent product via V1 wixData (informational)
**Where:** `src/backend/events.js:581` — `wixData.get('Stores/Products', productId)`.

**Observation:** the variant-updated event delivers a partial payload; the handler reads the parent product through V1 wixData to enrich. Same shape as V3 would expose for the affected fields (name, slug, mainMedia). No fix needed.

## Out-of-scope (file separately if needed)

- **Catalog v1→v3 migration plan** — Wix has signalled v3 will eventually be the only surface, but no deprecation date for v1 yet. Out of scope for this audit; track separately when Wix publishes a sunset date.
- **cfw V3 → cfutons V1 sync via Velo callback** — currently no inverse: cfw can't push to cfutons-side wixData except through the cf-vtx5 dispatchers. By design.
- **Inventory atomicity audit** — `wixStores_onInventoryVariantUpdated` may fire after a V1 OR V3 inventory mutation. Concurrency / ordering audit is its own bead if PM observes drift in production.

## Pre-cutover acceptance

Before DNS flip (cf-3qt.8):
- [ ] Confirm `catalogPriceFix` is NOT scheduled to run in the cutover window (Finding A — would amplify any V1↔V3 sync lag at the worst time).
- [ ] Spot-check 5 products via both cfutons (`wixData.query('Stores/Products').eq('_id', X)`) AND cfw (`client.products.queryProducts().eq('_id', X)`) — confirm `name`, `price`, `mainMedia.url` match. If any field diverges, escalate before cutover.
- [ ] Verify all `wixStores_on*` event handlers fire correctly when cfw checkout completes a real order on staging — covered by cf-w1u1 row #5 once Stilgar publishes.

## Recommended fix order

1. **Document Finding A** with a code comment in `catalogPriceFix.web.js` so the next operator sees the V1-write divergence warning (1-line follow-up).
2. **Pre-cutover spot-check script** — write a small node script that pulls 5 product IDs and queries both cfutons (Velo wixData) and cfw (`@wix/auto_sdk_stores_products`) sides, prints a diff. Useful for ongoing parity monitoring; can be a polecat task.
3. **Findings B/C/D** are informational — no action needed unless triggered.

## References

- Wix Velo `wix-stores-backend` docs: https://dev.wix.com/docs/velo/api-reference/wix-stores-backend
- Wix Headless `@wix/stores` docs: https://dev.wix.com/docs/headless/coding/sdk/store-products
- cf-3qt.8 (DNS cutover, in_progress) — this audit feeds Phase-8 readiness checklist
- wix-stores-versioning skill (referenced in cfutons CLAUDE.md memory) — same V1/V3 boundary discussed there
- Companion audits: cf-icww (email touchpoints), cf-jqkg (cfw→Velo HTTP gaps), cf-mgnh (lying-status taxonomy)
