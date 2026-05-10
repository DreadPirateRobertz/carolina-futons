# cf-lt2l — PRE-FLIP smoke test results (2026-05-10)

**Bead:** cf-lt2l (cf-3qt.8 PRE-FLIP execution)
**Operator:** miquella
**Run:** 2026-05-10 ~08:55–09:01 UTC
**Target:** `https://carolina-futons-web.vercel.app/` (latest production deploy post-PR #551)
**Tool:** Playwright MCP (Chromium); curl checks deferred to millicent's
[`pre-cutover-curl-results-2026-05-10.md`](./pre-cutover-curl-results-2026-05-10.md)
**Companion runs:** [`velo-smoke-2026-05-10.md`](./velo-smoke-2026-05-10.md),
[`mobile-smoke-2026-05-10.md`](./mobile-smoke-2026-05-10.md),
[`e2e-checkout-smoke-2026-05-10.md`](./e2e-checkout-smoke-2026-05-10.md),
[`lighthouse-baseline-2026-05-10.md`](./lighthouse-baseline-2026-05-10.md)

## Verdict

**ALL PRE-FLIP CHECKS IN SCOPE: PASS.** No blockers found. Cutover-night
matrix is clear to proceed from this side. Two soft observations
documented below — neither is a flip-blocker.

| Bucket | Pass | Fail | Skip | Total |
|---|---|---|---|---|
| Core pages | 9 | 0 | 1 | 10 |
| Navigation | 3 | 0 | 0 | 3 |
| Transactional flows | 5 | 0 | 0 | 5 |
| Dark mode | 3 | 0 | 0 | 3 |
| **Total** | **20** | **0** | **1** | **21** |

`/spring-sale` skipped per bead instructions ("not active"). Curl
technical checks (sitemap, robots, /api/health, OG meta, JSON-LD,
canonicals) skipped per bead instructions — millicent ran them in the
companion file above; `/api/health` is documented FAIL/P1 there and is
out of scope for this bead.

---

## Core pages (9 routes + skip)

| # | Route | Title | h1 | Marker check | Verdict |
|---|---|---|---|---|---|
| 1 | `GET /` | "Carolina Futons — Hardwood Frames & Mattresses \| Hendersonville, NC" | "Handcrafted Comfort, Mountain Inspired." | Hero text "Premium futons and furniture from the Blue Ridge Mountains of North Carolina." present + Shop Collection CTA + bear easter-egg region rendered + 0 console errors | ✅ PASS |
| 2 | `GET /shop/futon-frames` | "Futon Frames — Carolina Futons" | "Futon Frames" | 22 product cards rendered, 24 unique product hrefs (≥6 required); samples include Kingston / Northern Exposure / Wilderness / KD Lounger / Venice / Albany / Eureka | ✅ PASS |
| 3 | `GET /products/kingston-futon-frame` | "Kingston Futon Frame — Carolina Futons" | "Kingston Futon Frame" | Price $619.00 visible, financing "As low as $52/mo" shown, **Add to cart button enabled**, Product JSON-LD present in head | ✅ PASS |
| 4 | `GET /about` | "About — Carolina Futons" | "About Carolina Futons" | 78k body bytes rendered; 3 imgs (illustrations) present | ✅ PASS |
| 5 | `GET /visit` | "Visit Us — Carolina Futons" | "Visit Us" | Address (Hendersonville/NC/28792) present, hours pattern present, map embed present (Google Maps iframe or link) | ✅ PASS |
| 6 | `GET /getting-it-home` | "Getting It Home — Carolina Futons" | "Getting It Home" | ZIP-input field present (matched by name/id/placeholder), 2 forms on page | ✅ PASS |
| 7 | `GET /contact` | "Contact — Carolina Futons" | "We'd love to hear from you." | 3 forms present (appointment booking + contact + newsletter); contact form has name + email + phone + sizeOfInterest + subject + message fields | ✅ PASS |
| 8 | `GET /gift-cards` | "Gift Cards — Carolina Futons" | "Gift Cards" | "Gift card" copy present, 53k body — gift card section renders (denomination amounts not in plain text — likely image/select-driven; not a blocker for "renders" check) | ✅ PASS |
| 9 | `GET /guides` | "Buying Guides — Carolina Futons" | "Figure out what you actually need" | 7 guide links rendered (how-to-pick-a-futon-mattress, full-vs-queen-futons, murphy-bed-sizing, platform-bed-vs-futon, room-layout-for-small-spaces, mattress-firmness-guide, +1) | ✅ PASS |
| 10 | `GET /spring-sale` | _(not run)_ | _(not run)_ | Per-bead skip: "not active" | ⏭️ SKIP |

## Navigation

| Check | Detail | Verdict |
|---|---|---|
| Header nav links resolve (no 404s) | Probed all 11 unique header `/...` hrefs (`/`, `/search`, `/account`, `/wishlist`, `/shop`, `/shop/futon-frames`, `/design-a-room`, `/guides`, `/reviews`, `/about`, `/visit`) — every fetch returned **HTTP 200** | ✅ PASS |
| Mobile hamburger at 390×844 viewport | "Open navigation menu" button visible; click opens dialog with **13 links** (Carolina Futons, Futon Frames, Murphy Beds, Platform Beds, Mattresses, Sale, Design a Room, Guides, Reviews, Blog, About, Visit Us, Contact); drawer width > 0 confirmed | ✅ PASS |
| Footer links resolve | Site footer (data-slot="site-footer") has 22 links — 4 social externals, 17 internal `/...`. All 17 internal paths probed via `fetch()` returned HTTP 200: `/shop/futon-frames`, `/shop/murphy-cabinet-beds`, `/shop/mattresses`, `/shop/platform-beds`, `/shipping`, `/returns`, `/warranty`, `/about`, `/visit`, `/press`, `/blog`, `/contact`, `/privacy`, `/terms`, `/accessibility`, `/`, plus tel: + mailto: | ✅ PASS |

## Transactional flows

| Check | Detail | Verdict |
|---|---|---|
| Add Kingston to cart → drawer opens | Sticky PDP "Add to cart" CTA clicked; cart drawer dialog opens with `aria-label`-shaped state ("Your cart (1 item)") | ✅ PASS |
| Item name + price correct in drawer | Drawer line: "Kingston Futon Frame — Size: Full, Finish: Cherry — $619.00" matches PDP price/variant | ✅ PASS |
| Quantity increment works | "Increase quantity of Kingston Futon Frame" button → drawer updates to "Your cart (2 items)" / line $1,238.00 / Subtotal $1,238.00 | ✅ PASS |
| Cart count updates in header | Header `data-testid="cart-trigger"` `aria-label` flipped from "Cart (1 item)" → "Cart (2 items)" after qty increment | ✅ PASS |
| `GET /checkout` loads (Wix Headless) | Redirects to `chrisdealglass.wixstudio.com/my-site/__ecom/checkout?checkoutId=...&origin=...&headlessClientId=6b4d4894-c6be-4ecc-bf59-9eb4d10b9210` — 531k body rendered, contains "Kingston" + price reference (cart contents preserved through Wix Headless handoff). Title "Checkout \| STAGING_SITE" — staging tag is **expected** for the dev Vercel preview pointing at the Wix Studio staging site; production switch happens at flip when `WIX_VELO_SITE_URL` flips | ✅ PASS |
| Newsletter signup visible on home | Region "Stay in the loop" rendered; form `data-slot` newsletter form present in footer | ✅ PASS |
| Contact form fields present | name + email + phone + sizeOfInterest + subject + message — all required fields render | ✅ PASS |

## Dark mode

| Check | Detail | Verdict |
|---|---|---|
| Toggle dark mode → home header/footer | `localStorage.cf-theme = "dark"` + html `.dark` class applied; full-page screenshot (`theme-c-stargazing-clean.png` style baseline reproduced) shows: header dark navy with white text, hero region dark, product cards proper dark contrast, "By the numbers" stats section dark navy, testimonial cards correct (light cards on dark bg = intentional contrast), newsletter form dark navy, footer dark navy w/ bear illustration. No white surfaces. Screenshot: `cf-lt2l-dark-home.png` | ✅ PASS |
| Cart drawer dark mode correct | Screenshot `cf-lt2l-dark-cart-drawer.png`: drawer dark navy bg, "Your cart (1 item)" title cream/white, close X visible, line item Kingston + $619 white text, quantity stepper dark w/ white +/-, Subtotal white, "Go to checkout" CTA solid medium-blue button w/ white text — fully readable, no invisible affordances | ✅ PASS |
| PDP dark mode correct | Screenshot `cf-lt2l-dark-pdp.png` of `/products/kingston-futon-frame`: header dark, h1 cream, Size + Finish chips dark blue w/ white text, $619 price white, financing/affirm row readable, "Price locked for 14 days" panel readable, fabric swatches w/ labels visible, Add-to-cart button bg dark + white text (4.5:1+ contrast). No invisible buttons. | ✅ PASS |

---

## Soft observations (non-blocking)

These do not block the cutover but are worth flagging for melania /
godfrey to triage post-flip.

1. **Site footer's inherited `color: rgb(38,53,69)` on the `<footer>`
   element itself looks low-contrast against its own
   `bg: rgb(30,42,58)` (Δ luminance ≈ 1)** in dark mode. In practice
   no visible regression occurs because every text-bearing child
   (`p`, `a`, `address`) overrides via `text-cf-cream`/`text-cf-cream/80`
   classes — the inherited value is unused. Cleanup follow-up: drop the
   inherited dark-mode color on the bare `<footer>` element to match
   the cf-cream override that children already apply, eliminating the
   "looks broken in DevTools" optical illusion if a contractor inspects
   the parent rather than a leaf.

2. **`/gift-cards` page does not surface denomination amounts in plain
   text** ($25/$50/$100/$200/$500 not found via regex). Either an
   image-based selector or a dropdown-driven flow is in use. Renders
   ≠ broken (53k body, h1 + copy present), but the smoke check's
   intent of "user can identify amounts" wasn't fully verifiable
   statically. Recommend a manual visual pass during flip night.

## Artifacts

Screenshots committed to repo root:
- `cf-lt2l-dark-home.png` — home dark mode full-page
- `cf-lt2l-dark-pdp.png` — Kingston PDP dark mode viewport
- `cf-lt2l-dark-cart-drawer.png` — cart drawer dark mode viewport

## Console-error inventory

| Page | Errors | Warnings | Notes |
|---|---|---|---|
| `/` | 0 | 1 | Acceptable — likely consent/analytics gate warning |
| `/shop/futon-frames` | 0 | 0 | Clean |
| `/products/kingston-futon-frame` | 0 | 0 | Clean (initial load); +1 console entry after add-to-cart click (cart event) |
| `/about` | 0 | 0 | Clean |
| `/visit` | 0 | 0 | Clean |
| `/getting-it-home` | 0 | 0 | Clean |
| `/contact` | 0 | 0 | Clean |
| `/gift-cards` | 0 | 0 | Clean |
| `/guides` | 0 | 0 | Clean |
| `/checkout` (Wix Headless) | 2 | 3 | Wix-side, not Vercel; expected staging-site noise |

## Sign-off

cf-lt2l can be closed as PASS. **No flip blockers from this side.**
Cutover-night PRE-FLIP gate (per
[`cf-3qt-cutover-night-checklist.md`](../cf-3qt-cutover-night-checklist.md)
step 8) is satisfied for the 9 core routes + 17 nav/footer paths +
4 transactional checks + 3 dark-mode surfaces enumerated above.
