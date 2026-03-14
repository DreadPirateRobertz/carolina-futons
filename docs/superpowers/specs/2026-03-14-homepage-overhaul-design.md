# Homepage Overhaul & Full Site Integration — Design Spec

**Date:** 2026-03-14
**Author:** melania (PM)
**Status:** Draft
**Site:** https://halworker85.wixstudio.com/my-site (My Site, metaSiteId `3af610bf-06fb-410d-a406-c1258fa84372`)
**Parent Plan:** `docs/superpowers/plans/2026-03-13-stage3-frontend-integration.md`

---

## Problem Statement

The staging site looks like a furniture template with Carolina Futons text pasted on top. The header has an oversized H2 text block instead of a logo. The hero shows a template fireplace. Shop by Collections shows designer furniture CF doesn't sell. The footer has duplicate copyrights and text-only social links. Product pages have Velo console errors. "As Seen In" shows fake press logos. Instagram feed renders as blank dark boxes. CSS overrides aren't active so H2 headings render at 168px.

We have 93 backend modules, 109 public modules, 12,000+ tests, element ID maps, a remap script, custom Wix MCP tools, official Wix MCP, and Playwright — all ready. **We just need to hook it up.**

## Approach

**Option A first, Option C fallback.** We rename template elements in the editor to match our existing Velo code IDs (Option A) using documentServices `setNickname()`. This means our code works without modification for renamed elements. For any elements that cannot be renamed in the editor (structural mismatches, TPAWidgets, etc.), we fall back to Option C — remapping our code references to match the template IDs using `remap-element-ids.js`.

**Hybrid execution:** Editor visual blitz (Melania, Playwright + documentServices API) for immediate results + parallel PR merges (crew) + targeted code remap where needed. Each page follows: CSS activate → editor element renames (Option A) → visual image/content swaps → code remap for gaps (Option C) → MCP deploy → publish & verify.

## Risks & Gates

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Wix login blocker** — editor requires Google OAuth for halworker85@gmail.com | HIGH | Password reset link sent 2026-03-14. Check halworker85 Gmail first. Fallback: overseer does manual login. **Phase 1 gate: must resolve before any editor work.** |
| **Footer 1-to-3 element mismatch** — template has one `text18` but code expects `#footerPhone`, `#footerAddress`, `#footerHours` | HIGH | Rename `text18` → `footerContactInfo` (new consolidated ID). Rewrite `FooterSection.js` to use single element with multi-line content. Or: split `text18` into 3 elements in editor. |
| **Remap JSON format** — existing `masterpage-remap.json` has nested structure but script expects flat `{oldId: newId}` | MEDIUM | After editor renames, regenerate flat remap JSONs. Use only elements that still differ. |
| **Section removal layout gaps** — hiding "As Seen In" could leave vertical gap | MEDIUM | Use `collapse()` API (not `hide()`). Verify no gap in preview before publish. |
| **No rollback checkpoint** | MEDIUM | Before Phase 1: save editor revision. Document revision number. Wix Studio has revision history for undo. |
| **Gallery→Repeater swaps deferred** | LOW | Phase 1 uses template Pro Gallery widgets as-is. Image swaps via documentServices work without widget replacement. Gallery→Repeater swaps (parent plan Task 2) deferred to Phase 3+ when Velo code needs full product card control. |

## Tooling Inventory

| Tool | Purpose | Owner |
|------|---------|-------|
| **Playwright** (headless) | Editor automation — element renames, image swaps, section hide/show via documentServices API in iframe | Melania only |
| **`scripts/remap-element-ids.js`** | Batch remap `$w('#oldId')` references in Velo code to match template element IDs | Crew |
| **`scripts/home-page-template-ids.json`** | Extracted template element IDs for homepage | Reference |
| **`scripts/masterpage-home-id-mapping.json`** | Godfrey's mapping of our IDs → template IDs | Reference |
| **Custom Wix MCP** (`velo_sync`, `velo_preview`, `velo_publish`, `velo_catalog_import`, `velo_secrets_set`, `velo_email_template_*`, `velo_cms_*`) | Deploy code, preview, publish, manage catalog/CMS | Melania + crew |
| **Official Wix MCP** (`CallWixSiteAPI`, `ListWixSites`) | REST API calls for store management, site config | Crew |
| **Vitest** (12,000+ tests) | Validate all remaps don't break existing code | Crew |
| **documentServices API** | Direct element manipulation via editor iframe — `setNickname()`, image source swaps, section visibility | Melania (proven in session 10) |

## Existing Assets

- **314 CF product images** downloaded from original site CDN
- **88 CF products** imported to Wix Store with CDN images
- **PR #296** — template product cleanup script (godfrey)
- **PR #297** — `placeholderImages.js` with real CF CDN URLs replacing all Unsplash (radahn)
- **PR #298** — `carolinaFutonsLogo.js` SVG logo generation + masterPage integration (rennala)
- **PR #299** — security PII test fixes (miquella)
- **`global.css`** — pushed to stage3-velo repo, targets `.wixui-rich-text h2`, `h2.font_2` to fix 168px headings

---

## Phase 1: Homepage Visual Blitz + Element Hookup (This Session)

**Gate:** Wix Studio editor must be accessible (halworker85 login working). If blocked, check halworker85@gmail.com for password reset email first.

**Rollback checkpoint:** Before any editor changes, save current editor state. Note the revision in Wix Studio's revision history. All Phase 1 editor changes can be undone via revision restore if needed.

**Baseline:** Capture console error log before starting, so we can distinguish new errors from existing ones at verification (step 1.9).

### 1.0 — Activate global.css

**What:** The CSS file exists in the stage3-velo repo but isn't toggled active in the editor's Code Panel. It targets `.wixui-rich-text h2`, `h2.font_2`, and other heading selectors that the template renders at 168px.

**How:** In Wix Studio editor → Code Panel (bottom panel) → find `global.css` in file tree → toggle from inactive to active → save → publish.

**Acceptance:**
- [ ] H2 headings ("SHOP BY COLLECTIONS", "NEW IN", "BEST SELLERS MOST LOVED ITEMS") render at 24-36px, not 168px
- [ ] Verify on homepage, spot-check one category page and one product page
- [ ] No new layout breakage introduced by the CSS

### 1.1 — masterPage: Header Logo & Element Renames

**What:** The header shows "Carolina Futons" as an oversized H2 where the tera SVG wordmark was. Template element `vectorImage10` needs to become `siteLogo`. Nav items wrap to two lines at desktop. All header interactive elements need to be verified functional after renames.

**How:** Using documentServices API via Playwright (the same iframe method proven in session 10 for nav/footer branding):
1. Rename `vectorImage10` → `siteLogo` via `setNickname()`
2. Set logo image source to CF logo SVG data URI (from PR #298's `carolinaFutonsLogo.js` — stacked "Carolina"/"Futons", Playfair Display, espresso `#3A2518`, 180x60)
3. Rename remaining header elements per the integration plan:
   - `shoppingCartIcon1` → `cartIcon`
   - `searchButton2` → `headerSearchInput`
   - `text42` → `announcementText`
   - `box45` → `announcementBar`
   - `button7` → `navShop`
   - `hamburgerOpenButton1` → `mobileMenuButton`
4. Verify nav bar (Futon Frames | Murphy Cabinet Beds | Platform Beds | Mattresses | Contact) fits on one line at 1280px desktop
5. Verify search, login, wishlist, cart icons all visible and clickable
6. Verify mobile hamburger menu opens and functions

**Acceptance:**
- [ ] "Carolina Futons" renders as styled logo mark (Playfair Display, not raw H2)
- [ ] Nav fits single line at 1280px desktop
- [ ] All header controls (search, login, wishlist, cart) functional
- [ ] Mobile hamburger menu works
- [ ] All 7 element renames applied (verify via editor Properties panel or code inspection)

### 1.2 — masterPage: Footer Overhaul & Element Renames

**What:** Footer has CF content from session 10 API work but has duplicate copyright lines ("© 2026" and "© 2025"), social links render as plain text ("Facebook", "Instagram") not icons, and footer logo is unstyled text.

**How:** Via documentServices API:
1. Rename footer elements per integration plan:
   - `text25` → `footerNewsletterTitle`
   - `text24` → `footerNewsletterSubtitle`
   - `button4` → `footerEmailSubmit`
2. **Footer contact info structural fix:** Template has a single `text18` for all contact info, but `FooterSection.js` references `#footerPhone`, `#footerAddress`, `#footerHours` separately. Fix: add 2 new text elements in editor, rename `text18` → `footerAddress`, new elements → `footerPhone` and `footerHours`. Fallback: rename `text18` → `footerContactInfo` and create follow-up bead to consolidate `FooterSection.js`.
3. **Footer email input note:** Template uses `form2` (TPAWidget), not a separate `#footerEmailInput`. The Velo code reference will silently fail (try/catch). Acceptable for Phase 1 — template widget handles subscriptions. Document as known gap.
4. Remove duplicate "© 2025 by Carolina Futons. Built on Wix Studio" paragraph
5. Set footer logo to match header logo treatment (single-line "Carolina Futons", 160x30)
6. Verify social links — if text paragraphs, set them as clickable links to real CF social profiles:
   - Facebook → facebook.com/carolinafutons
   - Instagram → instagram.com/carolinafutons
   - TikTok → tiktok.com/@carolinafutons
   - Pinterest → pinterest.com/carolinafutons
7. Verify newsletter "Stay Inspired" form submits without error (via template `form2` widget)
8. Verify contact info accuracy: carolinafutons@gmail.com, (828) 327-8030, Hickory NC, Mon-Fri 9-5 EST

**Acceptance:**
- [ ] Single copyright line: "© 2026 Carolina Futons. All rights reserved."
- [ ] Social links clickable and go to real CF accounts
- [ ] Footer logo styled (Playfair Display, matching header)
- [ ] Footer columns legible and properly spaced
- [ ] Newsletter form submits without error
- [ ] Contact info renders correctly (3 elements or consolidated)
- [ ] All footer element renames applied
- [ ] Known gaps documented: `#footerEmailInput` not connected (template form handles it)

### 1.3 — Home Page: Hero Image Swap

**What:** Hero section shows a template fireplace/living room photo. Needs a CF product lifestyle shot that works with the "Handcrafted Comfort, Mountain Inspired" text overlay.

**How:** Via documentServices API:
1. Identify the hero image element (from `home-page-template-ids.json` — likely an image component inside `section1`)
2. Replace image source with best CF lifestyle photo from CDN — a warm room setting with a futon as focal point. Candidate: use one of the 314 downloaded images that shows a styled living room with CF furniture
3. Rename element: `section1` → `heroSection`, `text16` → `heroTitle`, `text17` → `heroSubtitle`, `button3` → `heroCTA` (per integration plan)
4. Verify text overlay legibility against new image
5. Verify mobile — image crops acceptably, text readable

**Acceptance:**
- [ ] Hero shows CF product/lifestyle image (not fireplace)
- [ ] Text overlay ("Handcrafted Comfort, Mountain Inspired") legible at desktop and mobile
- [ ] "Explore Our Collection" button links to /category/all-products and is clickable
- [ ] Hero element IDs renamed per integration plan

### 1.4 — Home Page: Shop by Collections Images (4 Swaps)

**What:** The 4 category boxes show template designer furniture — blue blob sofa, purple curved chair, wooden chair + glass table, wicker piece. Need real CF product photos matching each category.

**How:** Via documentServices API:
1. For each of the 4 collection boxes, identify the image element ID from `home-page-template-ids.json`
2. Replace image sources with real CF product photos from CDN:
   - **Futon Frames** → Monterey or Asheville futon frame (warm hardwood, clean product shot)
   - **Murphy Cabinet Beds** → Murphy Cube Cabinet Bed (cabinet open/closed view)
   - **Platform Beds** → best platform bed product photo from CDN
   - **Mattresses** → mattress product photo or styled bedroom with mattress
3. Rename collection section elements per integration plan
4. Verify each box links to correct category URL
5. Verify images fit containers without distortion

**Acceptance:**
- [ ] All 4 collection boxes show real CF products (zero template furniture visible)
- [ ] Category links work: /category/futon-frames, /murphy-cabinet-beds, /platform-beds, /mattresses
- [ ] Images not distorted, properly fill containers
- [ ] Category label text readable

### 1.5 — Home Page: Remove "As Seen In" Section

**What:** Fake press logos (Spazio, Corriere, Ocean, Hakvir, RVGAO) — CF has no press features.

**How:** Via documentServices API — use `collapse()` (NOT `hide()`) on the "AS SEEN IN" section container. `collapse()` removes the element from layout flow so no vertical gap remains. `hide()` would leave a blank space. Do NOT use `components.remove` — that's destructive and harder to undo.

**Rollback:** If collapse causes downstream layout issues, restore by `expand()`.

**Acceptance:**
- [ ] Section not visible on published site
- [ ] No blank gap or layout break where section was (verify in preview before publish)

### 1.6 — Home Page: Instagram Section Dummy

**What:** "FOLLOW US @CAROLINAFUTONS" heading links to real Instagram (good). Feed widget below shows 3 blank dark boxes (bad).

**How:** Via documentServices API:
1. Keep the heading and @carolinafutons link
2. Hide or remove the broken feed widget component
3. Optionally set a placeholder — simple "Visit us on Instagram →" call-to-action or a static placeholder

**Future bead:** Connect real Instagram Business feed via Wix dashboard authentication.

**Acceptance:**
- [ ] No blank dark boxes visible
- [ ] @carolinafutons heading/link preserved and functional
- [ ] Section looks intentional, not broken

### 1.7 — Home Page: "CF Story" Section Image

**What:** "THE CAROLINA FUTONS STORY" section has correct about text but background/side image is still the template fireplace.

**How:** Via documentServices API — replace the image source with a CF showroom photo or product lifestyle shot.

**Acceptance:**
- [ ] Story section shows CF-relevant imagery
- [ ] About text ("Since 1991...") remains legible
- [ ] "Learn More" links to /about

### 1.8 — Code Remap: masterPage + Home Page

**What:** After editor element renames (1.1-1.7), run the remap script to update Velo code references to match.

**How:**
Since Phase 1 uses Option A (rename template elements to match our code IDs), most Velo code references will already match — no remap needed for those. This step only handles elements that could NOT be renamed in the editor (TPAWidgets, structural mismatches, etc.).

1. **Inventory gaps:** After editor renames (1.1-1.7), list any elements where our code ID ≠ template ID. These are the Option C fallback cases.
2. **Regenerate flat remap JSONs:** The existing `scripts/masterpage-remap.json` has nested structure (`_meta`, `mapping`, `notes`). The `remap-element-ids.js` script expects flat `{oldId: newId}`. Create new flat files: `scripts/masterpage-remap-flat.json` and `scripts/home-remap-flat.json` containing ONLY the gap elements.
3. Run dry-run: `node scripts/remap-element-ids.js scripts/masterpage-remap-flat.json`
4. Run dry-run: `node scripts/remap-element-ids.js scripts/home-remap-flat.json`
5. If changes look correct: `--apply` flag on both
6. Run full test suite: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run`
7. Deploy via `velo_sync` to stage3-velo repo

**Note:** If all editor renames succeeded (all our code IDs now match template IDs), the flat remap JSONs will be empty `{}` and this step is a no-op. That's the ideal outcome.

**Acceptance:**
- [ ] Gap inventory complete — all unmatched element IDs documented
- [ ] Flat remap JSONs created (may be empty if Option A covered everything)
- [ ] Remap script runs without errors
- [ ] All 12,000+ tests pass after remap
- [ ] Code synced to stage3-velo repo
- [ ] No orphaned `$w('#oldId')` references in masterPage.js or Home.js

### 1.9 — Publish & Full Verification

**What:** Publish the site and verify all Phase 1 changes are live.

**How:**
1. Publish via editor (Publish button) or `velo_publish` MCP tool
2. Take full-page screenshots at desktop (1280px) + mobile (375px)
3. Compare before/after
4. Check browser console for new errors
5. Spot-check: click through to one category page, one product page — verify they still load

**Acceptance:**
- [ ] All items 1.0-1.7 visible on live published URL
- [ ] Before/after screenshot comparison shows clear improvement
- [ ] No new console errors introduced (existing Velo errors from unmapped pages OK)
- [ ] Category and product pages still functional
- [ ] Mobile rendering acceptable

---

## Phase 2: PR Merges & Template Cleanup (Crew — Parallel with Phase 1)

### 2.1 — Cross-Review & Merge PR #296: Template Product Cleanup

**What:** Godfrey's PR — script to delete 24 template products (MODO, NYX, RAVEN, LUNA, SILO, TALO, AERO, etc.) from Wix Store. These pollute category pages, inflate product counts, and confuse shoppers who see designer furniture mixed with CF products.

**How:**
1. Radahn reviews code, rennala reviews code. 30-min timeout per standing order.
2. Merge to main after approval.
3. Run cleanup script against staging site using Wix Store API (via `CallWixSiteAPI` or direct REST). The script queries all products, identifies template products by name pattern, and deletes them.
4. Verify: query store product count via API — should be exactly 88.
5. Verify: browse a category page — zero template products visible.

**Acceptance:**
- [ ] PR reviewed by 2 crew members, merged
- [ ] 24 template products deleted from Wix Store
- [ ] Store product count = 88
- [ ] Category page spot-check: only CF products visible

### 2.2 — Cross-Review & Merge PR #297: Collections Images Code

**What:** Radahn's PR — replaces all Unsplash URLs in `placeholderImages.js` with real CF CDN wixstatic.com URLs. Covers category heroes (7 categories × 1920x600), category cards (8 categories × 600x400), homepage hero (1920x800), and fallback images.

**How:**
1. Godfrey reviews, rennala reviews. 30-min timeout.
2. Merge to main.
3. Syncs to stage3-velo repo automatically via GitHub integration.
4. When Velo code eventually connects to elements, it'll set these same CF images — backing up the visual work in Phase 1.

**Acceptance:**
- [ ] PR reviewed by 2 crew members, merged
- [ ] Zero Unsplash references remain in `placeholderImages.js`
- [ ] All 96 placeholderImages tests pass
- [ ] CDN URLs resolve to real CF product photos (spot-check 3 URLs in browser)

### 2.3 — Cross-Review & Merge PR #298: Logo Replace Code

**What:** Rennala's PR — `carolinaFutonsLogo.js` generates SVG text logos: header (stacked "Carolina"/"Futons", 180x60) and footer (single-line, 160x30). Uses Playfair Display font + espresso `#3A2518` from `sharedTokens`. `masterPage.js` sets `$w('#siteLogo').src` on init.

**How:**
1. Godfrey reviews, radahn reviews. 30-min timeout.
2. Merge to main.
3. After Phase 1 element renames, `#siteLogo` will exist → Velo code auto-sets logo on page load.

**Acceptance:**
- [ ] PR reviewed by 2 crew members, merged
- [ ] Logo module exports valid SVG data URIs
- [ ] 27 logo tests pass
- [ ] Playfair Display font, espresso `#3A2518` color, WCAG `role="img"` + `aria-label`

### 2.4 — Cross-Review & Merge PR #299: Security PII Test Fixes

**What:** Miquella's PR — review feedback fixes on PII/GDPR security tests.

**How:** Quick review, merge if green.

---

## Phase 3: Product Page Integration (Next Session — P1 Priority)

### 3.1 — Product Page Visual Audit

**What:** Product pages are where revenue happens. They partially work — real CDN images show, Add to Cart functions — but have Velo console errors and missing features.

**How:**
1. Spot-check 5 products across categories:
   - Asheville Futon Frame (call-for-price product)
   - Murphy Cube Cabinet Bed ($1,898 — highest-price item)
   - Monterey Futon Frame ($549 — mid-range)
   - A mattress product
   - A platform bed product
2. For each: verify image gallery, name, price, description, Add to Cart, Buy Now, breadcrumbs, social sharing, related products
3. Screenshot desktop + mobile for each
4. Catalog all console errors with element IDs they reference

**Acceptance:**
- [ ] All 5 products render with images, correct prices, functional Add to Cart
- [ ] Buy Now initiates checkout flow
- [ ] Console error inventory documented with specific missing element IDs

### 3.2 — Product Page Element Remap

**What:** Map template product page element IDs to our `Product Page.u0gn0.js` expected IDs. Use the same pattern as masterPage/Home: extract template IDs → create remap JSON → run remap script.

**How:**
1. Extract product page template element IDs (via editor inspection or `getComponentNicknames()`)
2. Create `scripts/product-page-remap.json`
3. Editor renames for critical elements (Melania, Playwright)
4. Run remap script → test suite → deploy
5. Priority elements: product image gallery, price display, Add to Cart button, quantity selector, related products repeater, star ratings container

**Acceptance:**
- [ ] Star ratings render on product pages
- [ ] Related products show 4 real CF items (not template products — requires PR #296 merged)
- [ ] Zero critical console errors on product page
- [ ] Breadcrumbs navigate correctly (Home > Category > Product)
- [ ] Mobile product page renders without overflow

### 3.3 — "Call for Price" Products Fix

**What:** 14 products show "$1.00" with "Call for Price" label. The $1.00 is a placeholder because Wix Store requires a price. Need to either hide the price or display "Call for Price" prominently.

**How:** Velo code on product page — detect $1.00 products, replace price display with "Call for Price — (828) 327-8030" text.

**Acceptance:**
- [ ] "Call for Price" products show phone number instead of $1.00
- [ ] Add to Cart still works (or is hidden for call-for-price items)

---

## Phase 4: Category Page & Remaining Pages (Subsequent Sessions)

### 4.1 — Category Page Fix
- Rename "Browse by" sidebar from template categories (Sofas, Lounge Chairs, Tables, Chairs) to CF categories — Wix Store dashboard settings
- Fix "Error initializing product grid" — element ID mismatch in `Category Page.u0gn0.js`
- Verify sort/filter, pagination, product count
- **Acceptance:** Sidebar shows CF categories. Grid loads without errors. Sort by price works.

### 4.2 — Cart Page Integration
- Side cart + full cart page Velo hookup
- Verify: add, update quantity, remove, proceed to checkout
- **Acceptance:** Cart flow works end-to-end with correct prices.

### 4.3 — Contact Page
- CF showroom info: Hendersonville NC, Wed-Sat 10-5, phone, email, embedded Google Map
- **Acceptance:** Real CF contact info. Map shows correct location.

### 4.4 — About Page
- CF history since 1991, showroom photos, brand story
- **Acceptance:** Authentic CF content, no template text.

### 4.5 — Checkout & Thank You Pages
- Payment flow, shipping integration (UPS REST API already in backend)
- **Acceptance:** Complete checkout with test order.

### 4.6 — FAQ, Blog, Policies, Member Pages
- Content pages and member features — each gets its own bead

---

## Phase 5: Future Beads (Backlog)

| Bead | Description | Priority |
|------|-------------|----------|
| **Connect Instagram Feed** | Auth @carolinafutons Instagram Business in Wix dashboard. Connect native feed widget. Verify 6-9 recent posts render. | P3 |
| **Trust Bar Section** | Replace removed "As Seen In" with real certifications: Night & Day Authorized Dealer, CertiPUR-US, BBB. | P3 |
| **Premium Upgrade** | Remove "Built on Wix Studio" banner. Purchase Wix Business plan. | P2 |
| **SEO Pass** | Meta descriptions, OG tags, structured data (JSON-LD), sitemaps for all pages. Backend `seoHelpers.web.js` already exists. | P2 |
| **Blue Ridge Aesthetic** | Mountain skyline watercolor borders, custom illustrations per design.jpeg. | P4 |
| **Checkout UPS Integration** | Wire UPS REST API shipping calculator to checkout page. Backend `shippingService.web.js` exists. | P2 |
| **Member Features** | Wishlist, order history, loyalty program. Backend modules exist (`accountDashboard.web.js`, `loyaltyProgram.web.js`). | P3 |

---

## Execution Summary

| Phase | Owner | Method | Blocked On |
|-------|-------|--------|------------|
| 1.0 CSS Activation | Melania (editor) | Code Panel toggle | Nothing |
| 1.1 Header logo + renames | Melania (Playwright/API) | documentServices setNickname + image set | Nothing |
| 1.2 Footer overhaul + renames | Melania (Playwright/API) | documentServices | Nothing |
| 1.3 Hero image swap | Melania (Playwright/API) | documentServices | Best image ID'd |
| 1.4 Collections images (×4) | Melania (Playwright/API) | documentServices | Nothing |
| 1.5 Remove "As Seen In" | Melania (Playwright/API) | documentServices hide | Nothing |
| 1.6 Instagram dummy | Melania (Playwright/API) | documentServices hide | Nothing |
| 1.7 CF Story image | Melania (Playwright/API) | documentServices | Nothing |
| 1.8 Code remap | Crew (code) | `remap-element-ids.js` + vitest | 1.1-1.7 renames done |
| 1.9 Publish & verify | Melania (editor) | Publish + screenshots | 1.0-1.8 |
| 2.1-2.4 PR merges | Crew (parallel) | GitHub cross-review | Nothing — start immediately |
| 3.x Product pages | Melania + crew | Same pattern: editor + remap + deploy | Phase 1 + PRs merged |
| 4.x Remaining pages | Melania + crew | Same pattern | Phase 3 done |
