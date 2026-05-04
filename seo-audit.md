# SEO Metadata Audit — Carolina Futons Web

**Prepared by:** blaidd  
**Bead:** cf-3qt.8.8  
**Date:** 2026-05-04  
**Scope:** All `page.tsx` files under `src/app/`. Dynamic routes (generateMetadata) noted but not enumerated per-instance.

---

## Legend

- **desc-len**: character count of the resolved `description` string
- **OG**: `✓` = `openGraph` block present, `✗` = absent
- **OG img**: `✓` = `openGraph.images` present, `✗` = absent, `—` = no OG block
- **Blocker**: `[B]` = action required before launch, `[W]` = watch/low-priority

Short description threshold: **< 120 chars** (Google truncates below this in many layouts).

---

## Static Routes

| Route | Title | desc-len | OG | OG img | Notes |
|---|---|---|---|---|---|
| `/` | Carolina Futons — Hardwood Frames & Mattresses \| Hendersonville, NC | 159 | ✗ | — | **[B]** homepage missing openGraph block entirely |
| `/about` | About — Carolina Futons | 132 | ✗ | — | **[W]** no OG block |
| `/accessibility` | Accessibility — Carolina Futons | 117 | ✗ | — | **[W]** desc short, no OG |
| `/account` | Sign In — Carolina Futons | 89 | ✗ | — | **[B]** desc short (89), no OG |
| `/blog` | Journal — Carolina Futons | 136 | ✗ | — | **[W]** no OG; blog index is SEO-relevant |
| `/cart` | *(no metadata)* | — | — | — | **[B]** missing metadata entirely — should add `robots: noindex` |
| `/community-gallery` | Community Gallery — Carolina Futons | 98 | ✗ | — | **[W]** desc short, no OG |
| `/community-gallery/submit` | Share Your Photo — Community Gallery \| Carolina Futons | 98 | ✗ | — | **[W]** desc short, no OG |
| `/contact` | Contact — Carolina Futons | 141 | ✗ | — | **[W]** no OG |
| `/design-a-room` | Design a Room — Carolina Futons | 179 | ✗ | — | **[W]** no OG |
| `/faq` | FAQ — Carolina Futons | 132 | ✗ | — | **[W]** no OG |
| `/getting-it-home` | Getting It Home — Carolina Futons | 141 | ✗ | — | **[W]** no OG |
| `/gift-cards` | Gift Cards — Carolina Futons | 117 | ✓ | ✓ | OK |
| `/guides` | Buying Guides — Carolina Futons | 137 | ✗ | — | **[W]** no OG; guides are SEO-relevant |
| `/order-confirmation` | Order Confirmation — Carolina Futons | — | ✗ | — | noindex — OK, no desc needed |
| `/our-story` | *(no metadata)* | — | — | — | redirect → `/about` — no metadata needed |
| `/press` | Press & Media — Carolina Futons | 179 | ✗ | — | **[W]** no OG |
| `/privacy` | Privacy Policy — Carolina Futons | 103 | ✗ | — | legal — low priority |
| `/registry` | Gift Registry — Carolina Futons | 135 | ✓ | ✓ | noindex — OK |
| `/returns` | Returns — Carolina Futons | 116 | ✗ | — | **[W]** desc short, no OG |
| `/reviews` | Customer Reviews — Carolina Futons | 107 | ✗ | — | **[W]** desc short, no OG |
| `/search` | Search — Carolina Futons | 121 | ✗ | — | noindex — OK |
| `/shipping` | Shipping — Carolina Futons | 115 | ✗ | — | **[W]** desc short, no OG |
| `/shop` | Shop — Carolina Futons | 65 | ✓ | ✓ | **[B]** desc very short (65 chars) |
| `/signup` | Create Account — Carolina Futons | 93 | ✗ | — | **[W]** desc short (93), no OG |
| `/smoke` | *(no metadata)* | — | — | — | **[W]** internal smoke page — add `robots: noindex` |
| `/spring-sale` | Spring Sale — Carolina Futons | 140 | ✓ | ✗ | **[W]** OG block missing `images` |
| `/style-quiz` | Find Your Perfect Futon — Style Quiz \| Carolina Futons | 152 | ✗ | — | **[W]** no OG |
| `/sustainability` | Sustainability — Carolina Futons | 147 | ✗ | — | **[W]** no OG |
| `/swatch-request` | Request Fabric Swatches — Carolina Futons | 138 | ✗ | — | **[W]** no OG |
| `/terms` | Terms of Service — Carolina Futons | 115 | ✗ | — | legal — low priority |
| `/videos` | Product Videos — Carolina Futons | 157 | ✓ | ✗ | **[W]** OG block missing `images` |
| `/visit` | Visit Us — Carolina Futons | 115 | ✗ | — | **[W]** desc short, no OG; visit page is local-SEO-relevant |
| `/warranty` | Warranty — Carolina Futons | 100 | ✗ | — | **[W]** desc short (100), no OG |
| `/winback` | We miss you — come back to Carolina Futons | 121 | ✓ | ✗ | noindex — OG img low priority |
| `/wishlist/[token]` | Shared Wishlist — Carolina Futons | 52 | ✗ | — | noindex — low priority |

---

## Dynamic Routes (generateMetadata)

| Route | Pattern | OG | OG img | Notes |
|---|---|---|---|---|
| `/blog/[slug]` | `{post.title} — Carolina Futons` | ✓ | ✓ | OK — uses post cover image |
| `/guides/[slug]` | `{guide.title} — Buying Guides \| Carolina Futons` | ✓ | ✓ | OK |
| `/products/[slug]` | `{product.name} — Carolina Futons` | ✓ | ✓ | OK — uses product image |
| `/shop/[category]` | `{category.name} — Carolina Futons` | ✓ | ✓ | OK — uses category image or DEFAULT_OG_IMAGE |
| `/near/[city-slug]` | `Futons & Murphy Beds Near {city}, {state} \| Carolina Futons` | ✗ | — | noindex — local SEO pages, no OG needed yet |
| `/compare` | dynamic by products | ✗ | — | noindex — OK |
| `/registry/[slug]` | *(shared registry view)* | ✗ | — | noindex — OK |

---

## Member Dashboard (all missing metadata)

| Route | Notes |
|---|---|
| `/(member)/dashboard` | **[B]** Add `robots: { index: false }` — authenticated only |
| `/(member)/dashboard/orders` | **[B]** Same |
| `/(member)/dashboard/profile` | **[B]** Same |
| `/(member)/dashboard/preferences` | **[B]** Same |
| `/(member)/dashboard/wishlist` | **[B]** Same |
| `/(member)/dashboard/[...slug]` | **[B]** Same — catch-all |

---

## Theme Preview Pages (intentional noindex)

| Route | Title | Notes |
|---|---|---|
| `/theme-a` | Theme A — Mascot World (preview) | noindex — OK, internal |
| `/theme-b` | Theme B — Marugame Grid (preview) | noindex — OK, internal |
| `/theme-c` | Theme C — Stargazing (preview) \| Carolina Futons | noindex — OK, internal |
| `/theme-d` | Theme D — Fontshare Minimal (preview) | noindex — OK, internal |

---

## Prioritised Issue List

### Blockers [B] — fix before go-live

1. **`/`** — homepage has no `openGraph` block. Highest-traffic page; missing OG means no social card.
2. **`/shop`** — description is 65 chars ("Futon frames, Murphy cabinet beds, platform beds, and mattresses."). Needs expansion to ≥ 120 chars + an `images` entry on the OG block.
3. **`/account`** — description is 89 chars; no OG.
4. **`/cart`** — no metadata at all. Add `robots: { index: false }` to prevent cart indexing.
5. **`/smoke`** — no metadata. Add `robots: { index: false }` to prevent indexing of internal smoke page.
6. **`/(member)/dashboard/*`** — 6 routes with no metadata. All should have `robots: { index: false }` (authenticated walls should never be indexed).

### Watch items [W] — post-launch improvements

- **OG image gaps on marketing pages**: `/spring-sale`, `/videos` have `openGraph` blocks but no `images` array — social cards will fall back to the root layout default (if set) or render blank. Add `DEFAULT_OG_IMAGE` to each.
- **Short descriptions (< 120 chars)**: `/accessibility` (117), `/community-gallery` (98), `/community-gallery/submit` (98), `/returns` (116), `/reviews` (107), `/shipping` (115), `/signup` (93), `/visit` (115), `/warranty` (100). These won't cause indexing problems but may reduce SERP click-through.
- **SEO-relevant pages without OG**: `/blog`, `/guides`, `/reviews`, `/visit` have real organic search value and no OG block. Worth adding before any social/content marketing push.

---

*Audit owner: blaidd | Reviewed routes: 54 page.tsx files*
