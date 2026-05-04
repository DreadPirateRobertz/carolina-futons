# Pre-Cutover Redirect Map — cf-3qt.8.6

**Author:** morgott  
**Date:** 2026-05-04  
**Status:** Complete — PR open, awaiting merge before DNS cutover

---

## Methodology

Sources consulted:
1. **`EDITOR-HOOKUP-GUIDE.md` page table** (lines 379–408) — all Wix Studio page slugs
2. **`src/lib/shop/categories.ts`** — cfw `/shop/[category]` slug manifest
3. **`next.config.ts`** redirects already present (cf-3qt.7.1, cf-1te7, cf-e92v, cf-992s)
4. **`live-variant-matrix.md`** — 85 live Wix product slugs
5. Wix Stores URL conventions (product-page / `/product/` / `/store/` prefixes)

---

## Already Covered (no action needed)

These paths are already redirected in `next.config.ts`:

| Wix path | cfw destination | Added by |
|---|---|---|
| `/home` | `/` | cf-3qt.7.1 |
| `/product-page/:slug` | `/products/:slug` | cf-3qt.7.1 |
| `/product-page` | `/shop` | cf-3qt.7.1 |
| `/category-page/:slug` | `/shop/:slug` | cf-3qt.7.1 |
| `/category-page` | `/shop` | cf-3qt.7.1 |
| `/post/:slug` | `/blog/:slug` | cf-3qt.7.1 |
| `/post` | `/blog` | cf-3qt.7.1 |
| `/shipping-policy` | `/shipping` | cf-3qt.7.1 |
| `/privacy-policy` | `/privacy` | cf-3qt.7.1 |
| `/refund-policy` | `/returns` | cf-3qt.7.1 |
| `/terms-and-conditions` | `/terms` | cf-3qt.7.1 |
| `/accessibility-statement` | `/accessibility` | cf-3qt.7.1 |
| `/members-area` | `/account` | cf-3qt.7.1 |
| `/members` | `/account` | cf-3qt.7.1 |
| `/paywall` | `/account` | cf-3qt.7.1 |
| `/plans-pricing` | `/account` | cf-3qt.7.1 |
| `/thank-you` | `/order-confirmation` | cf-3qt.7.1 |
| `/thank-you-page` | `/order-confirmation` | cf-3qt.7.1 |
| `/book-online` | `/contact` | cf-3qt.7.1 |
| `/booking-form` | `/contact` | cf-3qt.7.1 |
| `/white-glove-delivery` | `/shipping` | cf-3qt.7.1 |
| `/room-planner` | `/design-a-room` | cf-3qt.7.1 |
| `/collections/:slug` | `/shop/:slug` | cf-1te7 |
| `/collections` | `/shop` | cf-1te7 |
| `/care` | `/warranty` | cf-e92v |
| `/care-warranty` | `/warranty` | cf-e92v |
| `/products/wilderness-log-futon-frame` | `/products/wilderness-log-futon` | cf-992s |

## Same path — no redirect needed

These Wix pages share the same URL path as cfw:

| Path | Wix page | cfw route |
|---|---|---|
| `/about` | About | `/about` |
| `/contact` | Contact | `/contact` |
| `/faq` | FAQ | `/faq` |
| `/search` | Search Results | `/search` |
| `/blog` | Blog | `/blog` |
| `/checkout` | Checkout | `/checkout` |

---

## New Redirects Added by cf-3qt.8.6

### 1. Cart page
Wix Stores uses `/cart-page` as its Cart page slug. cfw uses `/cart`.

| Source | Destination |
|---|---|
| `/cart-page` | `/cart` |

### 2. Wix Stores `/product/` (singular) URL pattern
Wix Stores generates two product URL forms:
- `/product-page/<slug>` — the Wix Studio page URL (already covered)
- `/product/<slug>` — the alternate canonical Wix Stores URL, commonly indexed by Google

Both must redirect to cfw `/products/<slug>`.

| Source | Destination |
|---|---|
| `/product/:slug` | `/products/:slug` |

### 3. Wix Stores Classic `/store/*` prefix
Old Wix Stores installations (pre-Studio) served the store at `/store`, products at
`/store/product/<slug>`, and categories at `/store/category/<slug>`. These paths may
appear in Google Search Console, backlinks, or email campaigns predating the Studio
migration.

| Source | Destination |
|---|---|
| `/store` | `/shop` |
| `/store/product/:slug` | `/products/:slug` |
| `/store/category/:slug` | `/shop/:slug` |

### 4. Style Quiz Wix blank page
The Wix Style Quiz page used a "blank" page template with slug `/blank-1`. Any links
to that URL should land on the cfw `/style-quiz` page.

| Source | Destination |
|---|---|
| `/blank-1` | `/style-quiz` |

---

## Collection slug comparison

Wix collection slugs (from `categories.ts` `collectionSlug` fields) exactly match
cfw `/shop/[category]` slugs. The existing `/collections/:slug` → `/shop/:slug`
redirect therefore passes through correctly with no manual overrides needed.

| Wix collection slug | cfw `/shop/` route |
|---|---|
| `futon-frames` | `/shop/futon-frames` |
| `murphy-cabinet-beds` | `/shop/murphy-cabinet-beds` |
| `platform-beds` | `/shop/platform-beds` |
| `mattresses` | `/shop/mattresses` |
| `sofa-beds` | `/shop/sofa-beds` |

Derived categories (`sale`, `mattresses-sale`) are not Wix collections; they are
cfw-only filtered views. No inbound Wix links point to these slugs.

---

## Pages not redirected (intentional)

| Wix path | Reason |
|---|---|
| `/blank` (Admin Returns) | Internal admin page; not indexed or linked publicly |
| `/admin-delivery-calendar` | Internal admin page |
| `/service-page` | Wix admin services page; no public traffic |

---

## Product slug coverage

All 85 Wix product slugs from `live-variant-matrix.md` are accessible at
`/products/<slug>` in cfw. The `/product/:slug` redirect added above covers
any inbound links that omit the `s`.

One known slug mismatch (`wilderness-log-futon-frame` → `wilderness-log-futon`) was
already fixed by cf-992s. No other mismatches found in the 85-product audit.

---

## Post-cutover validation

After DNS cutover, verify these redirects fire correctly:

```bash
curl -sI https://carolinafutons.com/cart-page | grep -i location
curl -sI https://carolinafutons.com/product/kingston | grep -i location
curl -sI https://carolinafutons.com/product-page/kingston | grep -i location
curl -sI https://carolinafutons.com/store | grep -i location
curl -sI https://carolinafutons.com/blank-1 | grep -i location
```

Expected: each returns `location: https://carolinafutons.com/<destination>` with
HTTP 308.
