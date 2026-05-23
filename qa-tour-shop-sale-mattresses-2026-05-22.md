# QA Tour: /shop + /shop/sale + /shop/mattresses — 2026-05-22

**Reviewer:** miquella
**Deployment:** `carolina-futons-l3lga935d-dreadpiraterobertzs-projects.vercel.app` (Production target per `vercel inspect`)
**Driver:** Playwright MCP

---

## TL;DR

| Surface | Status | Note |
|---|---|---|
| `/shop` (index hub) | ✅ OK | 5 category cards render with copy + valid `/shop/*` hrefs |
| `/shop/sale` | ⚠️ EMPTY | "0 products / No items are on sale right now" — but Spring Sale modal advertises 15–25% off products |
| `/shop/mattresses` | ❌ BUG | 3 of 6 products show NO price range (entire Mesa 1000/3000/5000 line); PDP confirms "Call for current pricing" instead of `$X – $Y` |

---

## /shop (index hub)

- `<h1>Shop</h1>`
- Intro: "Pick a category to browse."
- 5 category cards (eyebrow + name + "Shop now →" CTA):
  - SOLID HARDWOOD — Futon Frames → `/shop/futon-frames`
  - SPACE-SAVING — Murphy Cabinet Beds → `/shop/murphy-cabinet-beds`
  - LOW & MODERN — Platform Beds → `/shop/platform-beds`
  - MADE IN USA — Mattresses → `/shop/mattresses`
  - ON SALE NOW — Mattresses on Sale → `/shop/mattresses-sale`
- "SHOP THE ROOM" hotspot block + "Or jump straight in" secondary nav

**Status:** ✅ Clean. No console errors beyond the CSP report-only line that appears site-wide.

**Sub-observation:** "Mattresses on Sale" card links to `/shop/mattresses-sale` (the targeted sale PLP), separate from `/shop/sale` (the global Sale PLP).

---

## /shop/sale

- `<h1>Sale</h1>` + tagline: "Discounted futons, beds, and mattresses — while supplies last."
- Full sort+filter UI renders (Featured / Price asc/desc / Name A–Z/Z–A / Newest / Min/Max price / In stock only)
- Empty state: **"0 products" + "No items are on sale right now. Check back soon."**

**Status:** ⚠️ EMPTY — possibly intentional, possibly a bug.

**Why it's worth flagging:**
- The site-wide Spring Sale modal (auto-opens on visit) advertises:
  - "25% off Kingston Futon Frame · $299"
  - "20% off Mesa Foam Mattress · $89"
  - "15% off Sedona Futon Frame · $339"
- If those products exist on sale per the modal, they should appear on `/shop/sale`.
- Either the modal is showing stale promo content, OR the `/shop/sale` PLP isn't reading the `salePrice` / discount marker correctly, OR sale tags weren't applied to the underlying catalog rows.

**Recommended next:** Stilgar / Brenda confirm whether Spring Sale is active in the Wix admin (sale prices set on the 3 products in the modal). If yes → bug in PLP query. If no → modal needs to be silenced.

---

## /shop/mattresses

- `<h1>Mattresses</h1>`
- **Header count: "6 products"**
- Sort + filter UI renders

### Per-size price-range verification

The user-visible card text per product:

| Slug | Name on card | Price range on card | Verdict |
|---|---|---|---|
| `mattress-protector` | Mattress Protector | **$89 – $129** | ✅ OK |
| `mesa-5000-mattress` | Mesa 5000 Platform Bed Mattress Only | _(none)_ | ❌ MISSING |
| `mesa-3000-mattress` | Mesa 3000 Futon Mattress | _(none)_ | ❌ MISSING |
| `mesa-1000-mattress` | Mesa 1000 Futon Mattress | _(none)_ | ❌ MISSING |
| `haley-110` | Haley 110 | **$499 – $1,129** | ✅ OK |
| `pulsar` | Moonshadow | **$539 – $1,209** | ✅ OK + slug/name mismatch flag |

**Pattern:** The entire **Mesa 1000 / 3000 / 5000** mattress line is missing per-size price ranges on the PLP. The other 3 mattresses (Mattress Protector, Haley 110, Moonshadow) render the `$X – $Y` correctly.

### PDP cross-check (Mesa 3000)

Navigated to `/products/mesa-3000-mattress` to confirm whether the gap is PLP-only or upstream in the catalog:

- `<h1>Mesa 3000 Futon Mattress</h1>`
- No variant `<fieldset role="radiogroup">` for size detected
- Above the Add-to-cart button, where price normally renders, the page shows:
  > **"Call for current pricing"**
- Price-locked-for-14-days notice still renders (it's not gated on having a price)
- "Available fabrics (7)" picker IS present — so the PDP isn't broken structurally; only the price subtree is empty

**Diagnosis:** This is a CATALOG-level gap, not a PLP-only bug. The Mesa 1000/3000/5000 rows in Wix Stores likely have no price set (or no per-variant price set if these are variant-keyed by size). The PDP gracefully falls back to "Call for current pricing"; the PLP simply omits the price element.

The PLP fallback behavior (omitting the price string entirely) is mostly OK — a customer at least sees the product card. The "Call for current pricing" PDP state is the right copy for an unpriced product but it implies a phone-only purchase flow, which is a regression from a normal e-commerce surface.

### Sub-finding: slug/name mismatch on `/products/pulsar`

The card links to `/products/pulsar` but the displayed name is **"Moonshadow"**. Either the slug was renamed in the catalog without a redirect, or the product was renamed at the display layer but the slug column wasn't migrated. Not user-visible directly, but breaks deep links / SEO continuity for anyone who searches "Pulsar mattress carolinafutons".

---

## Recommendations

1. **`/shop/sale` empty vs modal sale items** — Stilgar/Brenda triage. If Spring Sale is supposed to be live: bug. If not: silence the modal. (P2)
2. **Mesa 1000/3000/5000 missing prices** — Brenda set prices in the Wix Stores admin OR confirm "Call for current pricing" is intentional for this line (e.g. wholesale-only). If intentional, the PDP copy is fine; if a config gap, file a backfill ticket. (P2)
3. **`/products/pulsar` slug vs "Moonshadow" name** — confirm intent. If Moonshadow is the new name and Pulsar is legacy, ship a `/products/pulsar` → `/products/moonshadow` redirect when the slug is migrated. (P3 follow-on)
4. **PLP price-range component fallback** — currently the price slot renders nothing when the product has no price. Consider rendering "Call for pricing" or similar so the customer doesn't see a price-less card with no explanation. (P3)

---

## Console state

CSP report-only directive warnings are global background noise on every page (Facebook Pixel + upgrade-insecure-requests directive in a report-only policy). Not a finding — ignore for this audit.

No JS errors, no 4xx/5xx for any of the 4 URLs visited.
