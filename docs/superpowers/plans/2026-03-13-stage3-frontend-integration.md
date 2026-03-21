# Stage 3 Frontend Integration Plan — Option C (Code Remap + Editor Swaps)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect our existing Velo code to My Site 3's Furniture Store template by remapping element IDs in code to match template nicknames, swapping Pro Galleries for Repeaters in editor, and adding missing elements in editor — page by page, verified with real product data at each step.

**Architecture:** Option C — we remap our *code* to reference the template's existing element IDs (via `scripts/remap-element-ids.js`). Where the template lacks elements we need (gaps), Melania adds them in the Wix Studio editor. Where the template uses Pro Gallery but our code needs Repeater, Melania swaps the widget type in editor. Custom Wix Velo MCP tools (`velo_sync`, `velo_preview`, `velo_publish`, `velo_catalog_import`, `velo_secrets_set`, `velo_email_template_*`, `velo_cms_*`) handle deployment and data pipeline. Official Wix MCP (`CallWixSiteAPI`, `ListWixSites`, doc search tools) supplements for REST API calls.

**Tech Stack:** Wix Studio + Wix Velo (JS), Custom wix-velo-mcp (17 tools), Official Wix MCP, Playwright (headless, Melania-only for editor), Vitest (12,000+ tests)

**Key Constraint:** Only Melania drives the browser (Wix Studio editor). Crew does code-only work (mapping JSONs, remap scripts, test updates). One person in editor at a time.

**Dependency Chain:** Task 1 (masterPage) → Task 2 (Home) → Task 3 (Category) + Task 4 (Product) → Task 5 (Cart + Side Cart) → Task 6 (Checkout + Thank You) → Task 7 (Phase 1 Integration Test)

---

## Chunk 1: Infrastructure + masterPage

### Task 1: masterPage — Header + Footer + Global Elements

**Owner:** Melania (editor) + miquella (code remap)
**Bead:** test-dld (shared with Task 2 — Home depends on masterPage)
**Files:**
- Modify: `src/pages/masterPage.js` (remap element IDs)
- Modify: `src/public/navigationHelpers.js` (if nav IDs change)
- Modify: `src/public/FooterSection.js` (if footer IDs change)
- Reference: `scripts/home-page-template-ids.json` (template nicknames extracted)
- Reference: `scripts/masterpage-home-id-mapping.json` (godfrey's mapping)
- Create: `scripts/masterpage-remap.json` (flat oldId→newId for remap script)
- Test: existing tests in `tests/` (must stay green after remap)

**Phase 1 scope (this task):** Header nav, logo, cart icon, search, announcement bar, footer (newsletter, contact info, social links), a11y live region. Phase 2 defers: exit-intent popup, promo lightbox, newsletter modal, install banner, side cart panel overlay elements.

#### Editor Work (Melania only)

- [ ] **Step 1: Open My Site 3 in Wix Studio editor, navigate to masterPage**
  - URL: `https://editor.wix.com/` → My Site 3
  - Toggle "Display IDs" in Layers panel to see current nicknames

- [ ] **Step 2: Verify template header nicknames against extracted IDs**
  Template has these nicknames (from `home-page-template-ids.json`):
  - `header1` (HeaderContainer) — maps to our global header
  - `section3` (HeaderSection) — the header section
  - `vectorImage10` — logo → rename to `siteLogo`
  - `horizontalMenu1` — nav menu (keep as-is, template handles nav)
  - `shoppingCartIcon1` — cart icon → rename to `cartIcon`
  - `vectorImage9` — wishlist icon (keep template name)
  - `accountNavBar1` — login bar (keep template name)
  - `searchButton2` — search → rename to `headerSearchInput`
  - `button7` — Shop button (keep or rename to `navShop`)
  - `text42` — "Free Shipping" promo text → rename to `announcementText`
  - `box45` — promo banner container → rename to `announcementBar`
  - `hamburgerOpenButton1` — mobile menu (keep, maps to our `mobileMenuButton`)

- [ ] **Step 3: Rename header elements in Properties panel**
  For each element: click element → Properties → change ID field
  Priority renames:
  - `vectorImage10` → `siteLogo`
  - `shoppingCartIcon1` → `cartIcon`
  - `searchButton2` → `headerSearchInput`
  - `text42` → `announcementText`
  - `box45` → `announcementBar`
  - `button7` → `navShop`

- [ ] **Step 4: Verify template footer nicknames and rename**
  Template footer (from extracted IDs):
  - `text25` ("Stay Inspired") → `footerNewsletterTitle`
  - `text24` (newsletter subtext) → `footerNewsletterSubtitle`
  - `form2` (newsletter form TPAWidget) — keep as-is (Wix form widget)
  - `text18` (contact details) → `footerAddress`
  - `button4` (Send button) → `footerEmailSubmit`
  - `text2` (copyright) — keep as-is

- [ ] **Step 5: Add missing Phase 1 elements in editor**
  - Add hidden Text element → ID: `a11yLiveRegion`, set `aria-live="polite"`, collapse on load
  - Add hidden HtmlComponent → ID: `businessSchemaHtml`, for JSON-LD injection
  - Add hidden HtmlComponent → ID: `websiteSchemaHtml`, for WebSite schema

- [ ] **Step 6: Save and publish editor changes**

#### Code Remap Work (miquella)

- [ ] **Step 7: Create `scripts/masterpage-remap.json`**
  Flat mapping of our code's element IDs → template's nicknames (after editor renames):
  ```json
  {
    "announcementBar": "announcementBar",
    "announcementText": "announcementText",
    "siteLogo": "siteLogo",
    "cartIcon": "cartIcon",
    "headerSearchInput": "headerSearchInput",
    "navShop": "navShop"
  }
  ```
  Note: After editor renames, many IDs will match 1:1. This mapping captures any remaining differences. If editor renames make all IDs match, this file can be empty `{}`.

- [ ] **Step 8: Run remap script in dry-run mode**
  ```bash
  node scripts/remap-element-ids.js scripts/masterpage-remap.json
  ```
  Review output: which files changed, which IDs remapped.

- [ ] **Step 9: Run remap script with --apply**
  ```bash
  node scripts/remap-element-ids.js scripts/masterpage-remap.json --apply
  ```

- [ ] **Step 10: Run full test suite**
  ```bash
  cd <repo-root> && npx vitest run
  ```
  Expected: 12,000+ tests green. Any failures → fix before proceeding.

- [ ] **Step 11: Deploy to staging via custom MCP**
  Use `velo_sync` to push code to stage3-velo repo.
  Use `velo_preview` to start dev server and verify masterPage renders.

- [ ] **Step 12: Visual verification**
  - Open preview URL: `https://halworker85.wixstudio.com/my-site`
  - Verify: header renders (logo, nav, cart icon, search), footer renders (newsletter form, contact info, social links)
  - Check mobile: hamburger menu works, footer stacks properly
  - Screenshot for PR evidence

- [ ] **Step 13: Commit and open PR**
  ```bash
  git checkout -b cf-test-dld-masterpage-hookup
  git add scripts/masterpage-remap.json src/pages/masterPage.js src/public/navigationHelpers.js src/public/FooterSection.js
  git commit -m "feat(test-dld): masterPage hookup — header/footer/a11y elements remapped to template"
  ```

---

### Task 2: Home Page — Hero, Categories, Featured Products, Testimonials

**Owner:** Melania (editor swaps) + miquella (code remap)
**Bead:** test-dld
**Files:**
- Modify: `src/pages/Home.js` (remap element IDs + Gallery→Repeater adaptation)
- Modify: `src/public/productCardHelpers.js` (if card container IDs change)
- Create: `scripts/home-remap.json`
- Test: existing Home page tests

**CRITICAL: Gallery → Repeater swap (Stilgar decision: Option A)**

#### Editor Work (Melania only)

- [ ] **Step 1: Swap `gridGallery2` (New In section) from Pro Gallery to Repeater**
  - Select `gridGallery2` in section8 ("Products - New In")
  - Delete the TPAWidget (Pro Gallery)
  - Add a Repeater element in the same container (`box15`)
  - Set Repeater ID to `featuredRepeater`
  - Add child elements inside repeater item:
    - Image → `featuredImage`
    - Text → `featuredName`
    - Text → `featuredPrice`
    - Text (hidden) → `featuredOriginalPrice`
    - Text (hidden) → `featuredSaleBadge`
    - Text (hidden) → `featuredRibbon`
    - Text → `featuredColorText`
    - Box → `featuredSwatchContainer`
    - Button (hidden on mobile) → `featuredQuickViewBtn`

- [ ] **Step 2: Swap `gridGallery1` (Best Sellers section) from Pro Gallery to Repeater**
  - Select `gridGallery1` in section6 ("Products Gallery / Best Sellers")
  - Delete the TPAWidget
  - Add Repeater → ID: `saleRepeater`
  - Add child elements:
    - Image → `saleImage`
    - Text → `saleName`
    - Text → `salePrice`
    - Text (hidden) → `saleOrigPrice`
    - Text (hidden) → `gridSaleBadge`

- [ ] **Step 3: Rename existing Home page elements**
  From `home-page-template-ids.json`:
  - `section1` → `heroSection`
  - `text16` (hero heading) → `heroTitle`
  - `text17` (hero subtitle) → `heroSubtitle`
  - `button3` (Shop CTA) → `heroCTA`
  - `imageX12` (hero bg) → `heroBg`
  - `text15` ("SHOP BY COLLECTIONS") → `categoriesTitle`
  - `text8` ("NEW IN") → `featuredTitle`
  - `text5` ("BEST SELLERS") → keep or rename to `saleTitle`
  - `text10` (promo heading) → rename contextually
  - `text6` (about text) → keep
  - `text3` ("AS SEEN IN") → keep
  - `repeater1` (press logos) → keep as-is (already a Repeater)

- [ ] **Step 4: Add category Repeater**
  - In section10 ("Store Categories"), add new Repeater
  - ID: `categoryRepeater`
  - Child elements: `categoryCard`, `categoryCardImage`, `categoryCardTitle`, `categoryCardTagline`, `categoryCardCount`
  - Hide or collapse the 4 static category cards (box26, box24, box22, box20) — keep as fallback

- [ ] **Step 5: Add testimonials section**
  - Add new Section below Best Sellers (section6)
  - ID: `testimonialSection`
  - Add Box → `testimonialSlideshow`
  - Add Repeater → `testimonialRepeater`
  - Child elements: `testimonialQuote`, `testimonialName`, `testimonialRating`
  - Add Button → `testimonialPauseBtn`

- [ ] **Step 6: Add trust bar section**
  - Add Strip/Section between Hero and Categories
  - ID: `trustBar`
  - 5 child boxes: `trustItem1`–`trustItem5` each with `trustText1`–`trustText5` and `trustIcon1`–`trustIcon5`

- [ ] **Step 7: Save and publish editor changes**

#### Code Remap + Data Verification (miquella)

- [ ] **Step 8: Create `scripts/home-remap.json`**
  Map our code's element IDs to the template nicknames (post-editor-rename).

- [ ] **Step 9: Run remap script**
  ```bash
  node scripts/remap-element-ids.js scripts/home-remap.json --apply
  ```

- [ ] **Step 10: Load real product data via MCP**
  Use `velo_catalog_import` to import real CF products to staging.
  Verify: products appear in Wix Stores dashboard for My Site 3.

- [ ] **Step 11: Run tests**
  ```bash
  cd <repo-root> && npx vitest run
  ```

- [ ] **Step 12: Deploy and verify with real data**
  - `velo_sync` → `velo_preview`
  - Open preview: verify hero loads, category repeater populates with 8 categories, featured products show real product cards (image, name, price, badge), best sellers show real sale items, testimonials rotate
  - Mobile check: sections stack, repeaters go single-column
  - Screenshot all viewports (320, 768, 1024, 1440)

- [ ] **Step 13: Commit and push to test-dld branch**

---

## Chunk 2: Commerce Pages (Category, Product, Cart)

### Task 3: Category Page — Filters, Product Grid, Sorting

**Owner:** Melania (editor) + godfrey (code remap)
**Bead:** test-zou
**Blocked by:** test-dld (masterPage + Home must land first)
**Files:**
- Modify: `src/pages/Category Page.js`
- Reference: `scripts/category-page-mapping.json` (godfrey's mapping)
- Create: `scripts/category-remap.json`
- Test: Category Page tests

#### Editor Work (Melania)

- [ ] **Step 1: Extract template element IDs for Category Page (u0gn0)**
  Navigate to Category Page in editor. Use documentServices API:
  ```js
  const ds = document.querySelectorAll('iframe')[1].contentWindow.documentServices;
  const comps = ds.components.getAllComponentsFromFull('u0gn0');
  ```
  Save extracted IDs to `scripts/category-page-template-ids.json`.

- [ ] **Step 2: Identify and swap any Pro Gallery → Repeater**
  Category page likely has a product grid gallery. If TPAWidget → swap to Repeater.
  Set Repeater ID: `productGridRepeater`
  Add child elements per godfrey's mapping: `gridImage`, `gridName`, `gridPrice`, `gridOrigPrice`, `gridSaleBadge`, `gridBadge`, `gridSwatchPreview`

- [ ] **Step 3: Rename existing elements per mapping**
  - Breadcrumbs, title, subtitle, filters, sort dropdown, result count

- [ ] **Step 4: Add gap elements**
  - `filterBrand`, `filterSize`, `clearFilters` dropdowns
  - `mobileSortBar`, `filterToggleBtn`, `filterDrawer` (mobile filter UX)
  - `categoryHeroSection` (dynamic bg)

- [ ] **Step 5: Save and publish**

#### Code Work (godfrey)

- [ ] **Step 6: Create `scripts/category-remap.json` from extracted template IDs + mapping**
- [ ] **Step 7: Run remap, tests, verify**
- [ ] **Step 8: Deploy, load real products, verify grid populates with filters working**
- [ ] **Step 9: Commit, open PR on `cf-test-zou-category-hookup`**

---

### Task 4: Product Page — Gallery, Details, Add-to-Cart

**Owner:** Melania (editor) + rennala (code remap)
**Bead:** test-7kc
**Blocked by:** test-dld + test-5mw
**Files:**
- Modify: `src/pages/Product Page.js`
- Reference: rennala's product page mapping (pending)
- Create: `scripts/product-page-remap.json`

#### Editor Work (Melania)

- [ ] **Step 1: Extract template element IDs for Product Page (ve2z7)**
- [ ] **Step 2: Identify gallery widget — likely Pro Gallery for product images**
  This gallery is for the *product image viewer* (not a grid). Pro Gallery may be appropriate here — check if our code uses Gallery API or custom elements. If custom → swap to Repeater or individual Image elements.
- [ ] **Step 3: Rename elements — product title, price, description, add-to-cart button, qty controls**
- [ ] **Step 4: Add gap elements — variant selectors, color swatches, stock status, shipping estimate, reviews section, breadcrumbs**
- [ ] **Step 5: Save and publish**

#### Code Work (rennala)

- [ ] **Step 6: Create remap JSON, run remap, tests**
- [ ] **Step 7: Deploy, open a real product page, verify all fields populate**
  - Product images load from Wix media
  - Price shows correctly (sale vs regular)
  - Add to cart works (item appears in cart)
  - Variant selection changes price/image
- [ ] **Step 8: Commit, open PR on `cf-test-7kc-product-hookup`**

---

### Task 5: Cart Page + Side Cart

**Owner:** Melania (editor) + radahn (code remap)
**Bead:** test-5mw
**Blocked by:** test-dai (Checkout)
**Files:**
- Modify: `src/pages/Cart Page.js`, `src/pages/Side Cart.js`
- Reference: `scripts/cart-page-mapping.json`, `scripts/side-cart-mapping.json` (PR #274 merged)
- Create: `scripts/cart-remap.json`, `scripts/sidecart-remap.json`

#### Editor Work (Melania)

- [ ] **Step 1: Extract template IDs for Cart Page (mqi5m) and Side Cart (ego5s)**
- [ ] **Step 2: Verify cart uses native Wix cart widget vs custom elements**
  Template likely uses Wix Stores native cart. Our code may wrap or extend it.
- [ ] **Step 3: Rename elements per radahn's mapping**
- [ ] **Step 4: Add gap elements — shipping progress bar, loyalty tier bar, cross-sell suggestions, recently viewed, financing options, empty cart state**
- [ ] **Step 5: Save and publish**

#### Code Work (radahn)

- [ ] **Step 6: Create remap JSONs, run remap, tests**
- [ ] **Step 7: End-to-end test: add product from Home/Category → verify it appears in cart with correct price, qty controls work, total updates**
- [ ] **Step 8: Test side cart: add product → side cart slides in, shows item, checkout button works**
- [ ] **Step 9: Commit, open PR on `cf-test-5mw-cart-hookup`**

---

## Chunk 3: Checkout + Integration Test

### Task 6: Checkout + Thank You Page

**Owner:** Melania (editor) + TBD crew (code)
**Bead:** test-dai
**Blocked by:** test-aok
**Files:**
- Modify: `src/pages/Checkout.js`, `src/pages/Thank You Page.js`

- [ ] **Step 1: Extract template IDs for Checkout (psuom) and Thank You (dk9x8)**
- [ ] **Step 2: Checkout is largely native Wix Stores — verify our code additions (shipping rate integration, coupon field, loyalty display) can attach to template elements**
- [ ] **Step 3: Thank You page — rename confirmation elements, add social sharing, post-purchase survey**
- [ ] **Step 4: Full end-to-end purchase test (test mode): browse → add to cart → checkout → confirm → thank you**
- [ ] **Step 5: Commit, open PR**

---

### Task 7: Phase 1 Integration Test + Visual Checkpoint

**Owner:** Melania
**Bead:** test-aok
**Blocked by:** test-9gw, test-glw, test-qce (Phase 2 pages)

- [ ] **Step 1: Full smoke test of all 6 commerce pages**
  - Home: hero, categories, featured products, testimonials, trust bar
  - Category: filters, grid, sorting, pagination
  - Product: images, details, add-to-cart, variants
  - Cart: items, qty, totals, shipping progress
  - Side Cart: slide-in, items, checkout CTA
  - Checkout: shipping, payment (test mode), order summary
  - Thank You: confirmation, social sharing

- [ ] **Step 2: Mobile smoke test (320px, 480px viewports)**
- [ ] **Step 3: Accessibility audit — keyboard navigation through full purchase flow**
- [ ] **Step 4: Screenshot all pages at desktop + mobile for overseer review**
- [ ] **Step 5: Report to Stilgar with screenshots and test results**

---

## MCP Usage Reference

### Custom wix-velo-mcp Tools
| Tool | When to Use |
|------|-------------|
| `velo_status` | Check auth + deployed tag before any deploy |
| `velo_sync` | Push code from dev repo to stage3-velo prod repo |
| `velo_diff` | Preview changes before sync (safety check) |
| `velo_preview` | Start `wix dev` server for local preview |
| `velo_publish` | Run tests + publish to live site |
| `velo_catalog_import` | Import real CF products to staging |
| `velo_secrets_set` | Set UPS creds, API keys on staging |
| `velo_email_template_*` | List/create triggered email templates |
| `velo_cms_*` | CRUD operations on CMS collections |
| `velo_page_list` | Verify page IDs match PAGE_ID_MAP |

### Official Wix MCP Tools
| Tool | When to Use |
|------|-------------|
| `CallWixSiteAPI` | REST API calls not covered by custom MCP |
| `SearchWixRESTDocumentation` | Look up API endpoints for unfamiliar Wix modules |
| `SearchWixSDKDocumentation` | Check Velo SDK methods |
| `ListWixSites` | Verify site metadata |
| `GenerateVisitorToken` | Create auth tokens for API testing |

### Existing Scripts
| Script | Purpose |
|--------|---------|
| `scripts/remap-element-ids.js` | Bulk rename `$w('#id')` refs in src/ and tests/ |
| `scripts/home-page-template-ids.json` | Extracted template IDs (164 components, Home+masterPage) |

---

## Crew Assignment Summary

| Task | Editor (Melania) | Code (Crew) | Bead |
|------|-----------------|-------------|------|
| 1. masterPage | Rename 6+ elements, add 3 hidden | miquella: remap + verify | test-dld |
| 2. Home | Swap 2 galleries→repeaters, add categories/testimonials/trust | miquella: remap + data load | test-dld |
| 3. Category | Extract IDs, swap gallery→repeater, add filters | godfrey: remap + verify | test-zou |
| 4. Product | Extract IDs, handle product gallery, add variants | rennala: remap + verify | test-7kc |
| 5. Cart+Side Cart | Extract IDs, add progress bars + cross-sell | radahn: remap + verify | test-5mw |
| 6. Checkout+Thank You | Extract IDs, verify native cart integration | TBD | test-dai |
| 7. Integration Test | Full smoke test all 6 pages | — | test-aok |

---

## Risk Register

1. **Editor rename may not persist** — Wix Studio sometimes reverts programmatic changes. Verify each rename sticks after save+publish.
2. **Gallery→Repeater swap may break template layout** — The Repeater won't inherit Pro Gallery's grid styling. Will need CSS adjustment in editor.
3. **Native Wix cart vs custom cart code** — Cart Page and Checkout may conflict between our custom code and Wix Stores native behavior. Test carefully.
4. **Product images** — 314 images downloaded but not yet uploaded to My Site 3 media board. Use `velo_catalog_import` to push products (which includes image URLs from original site).
5. **CMS collections** — Our code references wix-data collections. These must exist on My Site 3. Use `velo_cms_create` to set up collections before page hookup.
