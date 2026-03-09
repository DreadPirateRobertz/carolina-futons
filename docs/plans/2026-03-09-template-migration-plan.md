# Template Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Carolina Futons from blank My Site 2 skeleton to a template-based My Site 3 using Wix Studio Furniture Store template, with phased backend hookup and real data verification.

**Architecture:** Create new Wix site from template → paranoid repo copy → restyle brand → phase-by-phase page hookup with real data verification. Template elements get renamed to match our existing Velo code IDs. New elements added within the template's design language.

**Tech Stack:** Wix Studio, Wix Velo (JS), Wix Stores, UPS REST API, GitHub integration, Playwright (testing)

**Reference docs:**
- `WIX-STUDIO-BUILD-SPEC.md` — element ID specification (2,033 lines, every `$w('#id')` documented)
- `docs/plans/2026-03-09-template-migration-design.md` — approved design document
- `src/pages/*.js` — 39 page modules, 16,318 lines
- `src/public/*.js` — shared helpers (designTokens, mobileHelpers, a11yHelpers, etc.)
- `src/backend/*.web.js` — 93 backend modules
- `scripts/secrets.env` — credentials and API keys

---

## Pre-Phase: Infrastructure

### Bead 1: Template Evaluation & My Site 3 Creation

**Owner:** melania (PM) — requires Wix Studio editor access
**Dependencies:** None
**Priority:** P0

**Description:**
Create a new Wix Studio site from the free Furniture Store template (#3563). This is the foundation for everything else. Before ANY customization, thoroughly audit what the template gives us.

**Step 1: Create My Site 3**
- Go to wix.com → Create New Site → Wix Studio → Templates → eCommerce → Furniture Store (#3563)
- Name it "My Site 3" (or "Carolina Futons Staging 3")
- Record the new `metaSiteId` from the dashboard URL

**Step 2: Enable Velo**
- In editor: click the Code icon → "Start Coding"
- Verify the Code Panel opens with page code tabs

**Step 3: Generate headless credentials**
- Dashboard → Developer Tools → OAuth Apps → Create new app
- Record: `WIX_CLIENT_ID_HEADLESS_S3` (web)
- If mobile SDK needed: create second OAuth app for mobile

**Step 4: Audit every template page**
For EACH page the template ships with, document:

```markdown
## [Page Name]
- **Wix Page ID:** (from URL or page settings)
- **Sections:** (list every visual section top-to-bottom)
- **Elements:** (list every element with its default ID, type, and purpose)
- **Screenshot:** (take desktop + mobile screenshot)
```

Save as `TEMPLATE-ELEMENT-AUDIT.md` in repo root.

**Step 5: Connect GitHub**
- Dashboard → Developer Tools → GitHub → Connect
- Create new repo: `DreadPirateRobertz/carolina-futons-stage3` (private)
- Verify initial sync pulls template code to repo

**Step 6: Screenshot baseline**
- Screenshot every page (desktop + mobile) BEFORE any changes
- Save to `docs/template-baseline/` as `{pagename}-desktop.png` and `{pagename}-mobile.png`

**Acceptance Criteria:**
- [ ] My Site 3 exists and loads from template
- [ ] Velo enabled, Code Panel accessible
- [ ] New metaSiteId recorded
- [ ] New headless client ID(s) generated
- [ ] `TEMPLATE-ELEMENT-AUDIT.md` complete with every element on every page
- [ ] Baseline screenshots saved (desktop + mobile for each page)
- [ ] GitHub repo `carolina-futons-stage3` connected and syncing
- [ ] Overseer can view the template site at its public URL

---

### Bead 2: Paranoid Repo Copy

**Owner:** crew member (code work, no editor needed)
**Dependencies:** Bead 1 (need repo to exist + page IDs from audit)
**Priority:** P0

**Description:**
Copy all backend code, public helpers, tests, and config from the dev repo (`carolina-futons`) to the new `carolina-futons-stage3` repo. This is a paranoid copy — verify everything works before touching the live site.

**Step 1: Archive from dev repo**
```bash
cd /Users/hal/gt/cfutons/refinery/rig
git archive HEAD --format=tar | tar -x -C /tmp/stage3-staging/
```

**Step 2: Verify archive contents**
```bash
ls /tmp/stage3-staging/src/backend/*.web.js | wc -l  # expect: 93
ls /tmp/stage3-staging/src/public/*.js | wc -l        # expect: ~40+
ls /tmp/stage3-staging/tests/**/*.test.js | wc -l     # expect: 305
```

**Step 3: Clone stage3 repo and copy code**
```bash
cd /tmp
git clone git@github.com:DreadPirateRobertz/carolina-futons-stage3.git
# Copy backend, public, tests — NOT pages (those come from Wix)
cp -r /tmp/stage3-staging/src/backend/* /tmp/carolina-futons-stage3/src/backend/
cp -r /tmp/stage3-staging/src/public/* /tmp/carolina-futons-stage3/src/public/
cp -r /tmp/stage3-staging/tests/* /tmp/carolina-futons-stage3/tests/
# Copy config files
cp /tmp/stage3-staging/package.json /tmp/carolina-futons-stage3/
cp /tmp/stage3-staging/vitest.config.* /tmp/carolina-futons-stage3/
cp /tmp/stage3-staging/WIX-STUDIO-BUILD-SPEC.md /tmp/carolina-futons-stage3/
cp -r /tmp/stage3-staging/docs/ /tmp/carolina-futons-stage3/docs/
```

**Step 4: Update secrets**
```bash
cp /Users/hal/gt/cfutons/refinery/rig/scripts/secrets.env /tmp/carolina-futons-stage3/scripts/secrets.env
# Edit secrets.env:
# - Update WIX_SITE_ID to new My Site 3 metaSiteId
# - Update WIX_CLIENT_ID_HEADLESS to new client ID from Bead 1
# - Keep all other secrets (UPS, GA4, etc.) as-is
```

**Step 5: Install dependencies and run tests**
```bash
cd /tmp/carolina-futons-stage3
npm install
npx vitest run
# Expected: 11,874 tests passing (305 test files)
```

**Step 6: Create PAGE_ID_MAP.md**
Using page IDs from Bead 1's `TEMPLATE-ELEMENT-AUDIT.md`, create the mapping:

```markdown
# My Site 3 — Page ID Map

| Page Name | Wix Page ID | Code File |
|-----------|-------------|-----------|
| Home | (from audit) | Home.{pageId}.js |
| Shop | (from audit) | Category Page.{pageId}.js |
| ... | ... | ... |
```

**Step 7: Do NOT push page files yet**
Template pages come FROM the Wix site via GitHub sync. We only push backend/public/tests/config. Page files get created as we hook up each page.

**Step 8: Commit and push**
```bash
git add -A
git commit -m "feat: paranoid copy from carolina-futons dev repo — backend, public, tests"
git push origin main
```

**Acceptance Criteria:**
- [ ] `carolina-futons-stage3` repo has all 93 backend modules
- [ ] All `src/public/` helpers present
- [ ] All 305 test files present
- [ ] `npm install` succeeds
- [ ] `npx vitest run` — 11,874+ tests green
- [ ] `secrets.env` updated with new My Site 3 credentials
- [ ] `PAGE_ID_MAP.md` created with all template page IDs
- [ ] No `src/pages/` files pushed (those come from Wix sync)
- [ ] Git log clean, pushed to remote

---

### Bead 3: Theme Restyle in Editor

**Owner:** melania or crew member with editor access
**Dependencies:** Bead 1 (site must exist)
**Priority:** P0

**Description:**
Apply our Blue Ridge Mountain brand palette and typography to the template using Wix Studio's Theme Manager UI. NOT via API — learned from My Site 2 that the DS API rejects color changes.

**Step 1: Open Theme Manager**
- In Wix Studio editor → Site Design (paintbrush icon) → Theme
- Or: top menu → Design → Theme Manager

**Step 2: Apply color palette**
Set the site palette swatches to match `WIX-STUDIO-BUILD-SPEC.md` Global section:

| Swatch | Hex | Usage |
|--------|-----|-------|
| Color 1 | `#E8D5B7` | Sand base — page backgrounds |
| Color 2 | `#3A2518` | Espresso — primary text |
| Color 3 | `#5B8FA8` | Mountain blue — links, secondary CTA |
| Color 4 | `#E8845C` | Sunset coral — primary CTA, sale badges |
| Color 5 | `#F2E8D5` | Light sand — card backgrounds |
| Color 6 | `#A8CCD8` | Sky blue — subtle accents, tags |
| Color 7 | `#C9A0A0` | Mauve — tertiary accent |
| Color 8 | `#5C4033` | Light espresso — secondary text |
| Color 9 | `#D4BC96` | Dark sand — borders |
| Color 10 | `#FFFFFF` | White — modal backgrounds |

**Step 3: Apply typography**
- Heading font: Playfair Display (weight 700)
- Body font: Source Sans 3 (weights 400, 600)
- Nav font: Source Sans 3 (600, uppercase)

Set the typography scale per BUILD-SPEC:
- Hero Title: 56px desktop / 36px mobile
- H1: 42px / 28px
- H2: 32px / 24px
- Body: 16px / 16px

**Step 4: Screenshot after restyle**
- Screenshot every page again (desktop + mobile)
- Save to `docs/template-restyled/` as `{pagename}-desktop.png` and `{pagename}-mobile.png`
- Side-by-side comparison with baseline screenshots from Bead 1

**Step 5: Publish**
- Publish the restyled site
- Share live URL with overseer for visual checkpoint

**Acceptance Criteria:**
- [ ] All 10 color swatches match BUILD-SPEC palette
- [ ] Heading font is Playfair Display 700
- [ ] Body font is Source Sans 3 400/600
- [ ] Typography scale matches spec (spot-check hero title + body)
- [ ] Before/after screenshots saved
- [ ] Site published and accessible
- [ ] Overseer visual checkpoint: "Does this look like our brand?" — APPROVED

---

## Phase 1: Core Commerce (6 pages)

### Bead 4: Home Page Hookup

**Owner:** crew member with editor + code access
**Dependencies:** Bead 2 (repo ready), Bead 3 (theme applied)
**Priority:** P1

**Description:**
Connect `masterPage.js` and `Home.js` to the template's Home page. This is the most complex hookup — masterPage has ~66 elements (header, footer, nav, popups) and Home has ~109 elements (hero, categories, products, testimonials, etc.).

**Key files:**
- Read: `WIX-STUDIO-BUILD-SPEC.md` lines 50-166 (Master Page) and 167-341 (Home)
- Read: `src/pages/masterPage.js` — header, footer, nav, announcements, exit-intent, promo lightbox
- Read: `src/pages/Home.js` — hero, categories, featured products, sale highlights, testimonials, etc.
- Read: `TEMPLATE-ELEMENT-AUDIT.md` — what the template Home page already has
- Read: `src/public/navigationHelpers.js` — mobile drawer, nav links
- Read: `src/public/productCardHelpers.js` — product card rendering

**Step 1: Map template elements to BUILD-SPEC**
Create a mapping table in the bead notes:

```markdown
| Template Element | Template ID | Our BUILD-SPEC ID | Action |
|-----------------|-------------|-------------------|--------|
| Logo | image1 | #siteLogo | RENAME |
| Nav link 1 | text1 | #navHome | RENAME |
| Hero image | image2 | #heroImage | RENAME |
| (no match) | — | #announcementBar | ADD |
| (template extra) | gallery3 | — | KEEP or REMOVE |
```

**Step 2: Rename template element IDs in editor**
For each RENAME row: select element → Properties & Events panel → change ID field.
Element IDs are case-sensitive. Match exactly: `siteLogo` not `SiteLogo`.

**Step 3: Add missing masterPage elements**
Refer to BUILD-SPEC Master Page section (lines 50-166). Missing elements likely include:
- `#announcementBar` + `#announcementText` (if template doesn't have one)
- `#headerSearchInput`
- `#cartBadge` (item count on cart icon)
- `#mobileMenuOverlay` + `#mobileMenuClose`
- `#businessSchemaHtml` (hidden HtmlComponent for JSON-LD)
- Footer elements: `#footerEmailInput`, `#footerEmailSubmit`, `#footerPhone`, `#footerAddress`, `#footerHours`
- Social icons: `#socialFacebook`, `#socialInstagram`, `#socialPinterest`
- Exit-intent popup elements (hidden by default)
- Promo lightbox elements (hidden by default)

**CRITICAL: Add elements WITHIN the template's existing design grid.** Match the template's spacing, alignment, and visual rhythm. Do not dump elements outside the layout.

**Step 4: Add missing Home page elements**
Refer to BUILD-SPEC Home section (lines 167-341). Key elements:
- Hero section: `#heroTitle`, `#heroSubtitle`, `#heroCTA`, `#heroImage`
- Category cards: `#categoryRepeater` with `#catImage`, `#catTitle`, `#catLink`
- Featured products: `#featuredRepeater` with product card elements
- Sale highlights: `#saleRepeater`
- Testimonials: `#testimonialRepeater`
- Trust bar: `#trustShipping`, `#trustWarranty`, `#trustSupport`, `#trustSatisfaction`
- Newsletter: `#newsletterInput`, `#newsletterSubmit`

**Step 5: Import real product data**
- Use `catalogImport.web.js` to load real products into Wix Stores
- Or manually add 10-15 real products in Wix dashboard with real images from our photo archive
- Products MUST have: real names, real prices, real descriptions, real images

**Step 6: Verify masterPage.js connectivity**
Run `wix dev` to sync code. In the local editor or preview:
- Announcement bar rotates messages
- Nav links navigate to correct pages
- Search input accepts text
- Cart icon shows badge
- Mobile menu opens/closes
- Footer displays real business info

**Step 7: Verify Home.js connectivity**
In preview:
- Hero displays real content
- Category cards show real categories with images
- Featured products show real products with prices
- Testimonials display (may need CMS data)
- Newsletter form captures email

**Step 8: Visual verification**
- Screenshot desktop (1280px) + mobile (375px)
- Compare against `design.jpeg` — does the overall aesthetic match? Warm tones, furniture imagery, inviting feel?
- Note any visual issues for follow-up

**Step 9: Data flow verification**
- Click a category card → navigates to Category Page (may be template Shop page)
- Click a product → navigates to Product Page
- Cart badge updates when items added
- Search input → navigates to Search Results (may not be connected yet — OK for Phase 1)
- Newsletter submit → stores email (verify in backend)
- Mobile: hamburger menu → drawer opens → nav links work → drawer closes

**Acceptance Criteria:**
- [ ] All masterPage element IDs from BUILD-SPEC present and mapped
- [ ] All Home page element IDs from BUILD-SPEC present and mapped
- [ ] Real products display (not placeholder)
- [ ] Navigation works: header links, category clicks, product clicks
- [ ] Cart badge updates on add-to-cart
- [ ] Mobile menu works (open, navigate, close)
- [ ] Footer displays real business info (phone, address, hours)
- [ ] Newsletter form submits and stores data
- [ ] Desktop + mobile screenshots saved
- [ ] Overseer visual checkpoint PASSED

---

### Bead 5: Category Page Hookup

**Owner:** crew member with editor + code access
**Dependencies:** Bead 4 (Home working, masterPage connected)
**Priority:** P1

**Description:**
Connect `Category Page.js` to the template's Shop page. The Category Page has ~86 element IDs: filters, sorting, product grid, quick view modal, comparison bar, empty states.

**Key files:**
- Read: `WIX-STUDIO-BUILD-SPEC.md` lines 634-785 (Category Page)
- Read: `src/pages/Category Page.js` — filters, sorting, product grid, pagination
- Read: `TEMPLATE-ELEMENT-AUDIT.md` — what template Shop page already has
- Read: `src/public/productCardHelpers.js` — card rendering
- Read: `src/backend/categorySearch.web.js` — search/filter backend

**Step 1: Map template Shop elements → BUILD-SPEC Category Page IDs**
Template Shop likely has: product grid, category navigation, some filtering.
Our spec adds: advanced faceted filters, mobile filter drawer, quick view modal, comparison bar, empty/no-match states, active filter chips, schema elements.

**Step 2: Rename existing template elements**
Match template product grid elements to our IDs: `#productGrid`, `#productRepeater`, etc.

**Step 3: Add missing elements**
Priority order (most important first):
1. Filter bar: `#filterBar`, `#filterCategory`, `#filterPrice`, `#filterSort`
2. Product grid elements: `#productRepeater` items with `#cardImage`, `#cardTitle`, `#cardPrice`, `#cardBadge`
3. Pagination: `#paginationContainer`, `#prevPage`, `#nextPage`, `#pageNumbers`
4. Empty state: `#emptyState`, `#emptyTitle`, `#emptySubtitle`
5. Breadcrumbs: `#breadcrumbHome`, `#breadcrumbSeparator`, `#breadcrumbCurrent`

Lower priority (Phase 1 can skip, add in Phase 3):
- Advanced faceted filters (`#advancedFilters*`)
- Mobile filter drawer (`#mobileFilterDrawer*`)
- Quick view modal (`#quickViewModal*`)
- Comparison bar (`#compareBar*`)

**Step 4: Load real category data**
- Ensure Wix Stores has real products in real categories
- Categories should map to CF catalog: Futon Frames, Mattresses, Platform Beds, Murphy Beds, etc.

**Step 5: Verify data flow**
- Page loads with real product grid
- Filter by category → grid updates
- Sort by price/name → order changes
- Click product card → navigates to Product Page with correct product
- Pagination works if >12 products
- Empty state shows when filtering returns zero results
- Breadcrumbs show correct path

**Step 6: Visual + mobile verification**
- Desktop: 3-column grid, filters on left or top
- Tablet: 2-column grid
- Mobile: 1-column grid, filters in collapsible section
- Screenshot all three viewports

**Acceptance Criteria:**
- [ ] Product grid displays real products with real images/prices
- [ ] Category filtering works
- [ ] Sorting works (price low→high, high→low, name)
- [ ] Click product → correct Product Page
- [ ] Breadcrumbs accurate
- [ ] Empty state displays when appropriate
- [ ] Mobile responsive: grid adapts, filters accessible
- [ ] Screenshots saved (desktop, tablet, mobile)

---

### Bead 6: Product Page Hookup

**Owner:** crew member with editor + code access
**Dependencies:** Bead 4 (masterPage connected)
**Priority:** P1

**Description:**
Connect `Product Page.js` to the template's product detail page. This is our most complex page — ~176 element IDs covering gallery, details, variants, reviews, cross-sell, financing, wishlists, and more.

**Key files:**
- Read: `WIX-STUDIO-BUILD-SPEC.md` lines 343-633 (Product Page — all subsections)
- Read: `src/pages/Product Page.js` — product display, cart integration, reviews
- Read: `TEMPLATE-ELEMENT-AUDIT.md` — what template product page has
- Read: `src/public/galleryHelpers.js` — image gallery logic
- Read: `src/backend/comfortService.web.js` — comfort ratings

**Phase 1 element priority (MUST have):**
1. Product gallery: `#productGallery`, `#mainImage`, `#thumbnailRepeater`
2. Product details: `#productTitle`, `#productPrice`, `#productDescription`, `#productSku`
3. Add to cart: `#addToCartButton`, `#quantityInput`, `#quantityMinus`, `#quantityPlus`
4. Variant selection: `#variantDropdown` or `#variantRepeater`
5. Breadcrumbs: `#breadcrumbHome`, `#breadcrumbCategory`, `#breadcrumbProduct`
6. Cross-sell: `#relatedRepeater` with product cards

**Phase 1 can SKIP (add in Phase 3):**
- Fabric swatch selector (`#swatchGrid*`, `#swatchLightbox*`)
- Full review submission form (`#reviewForm*`)
- Financing options section
- Wishlist/save button
- Social share buttons
- Back-in-stock notification
- Frequently bought together bundle
- Browse abandonment popup
- Sticky add-to-cart bar

**Step 1: Map template product elements → BUILD-SPEC IDs**
Template product page likely has: image gallery, title, price, description, add-to-cart button, variant selector.

**Step 2: Rename + add elements**
Focus on the MUST-have list above. Each element placed within the template's existing layout sections.

**Step 3: Load a real product**
- Ensure at least one product has: multiple images, real price, real description, variants (e.g., frame color, mattress size)
- Product images from our 314-photo archive (or Wix stock if upload still blocked)

**Step 4: Verify data flow**
- Product loads with correct data (title, price, images, description)
- Gallery: click thumbnail → main image changes
- Variant selection: change variant → price/image updates
- Quantity selector: +/- buttons work, respects stock limits
- Add to cart: button adds product → cart badge increments → side cart opens (if connected)
- Cross-sell: "You Might Also Like" shows real related products

**Step 5: Visual + mobile verification**
- Desktop: gallery left, details right (standard product page layout)
- Mobile: gallery stacks above details
- All text readable, buttons tappable (44px minimum touch target)

**Acceptance Criteria:**
- [ ] Real product displays with real images, price, description
- [ ] Image gallery works (thumbnail navigation)
- [ ] Variant selection updates price/image
- [ ] Add to cart works → cart updates
- [ ] Quantity selector works
- [ ] Cross-sell shows real related products
- [ ] Mobile responsive
- [ ] Screenshots saved

---

### Bead 7: Cart + Side Cart Hookup

**Owner:** crew member with editor + code access
**Dependencies:** Bead 6 (Product Page add-to-cart working)
**Priority:** P1

**Description:**
Connect `Cart Page.js` and `Side Cart.js`. Cart Page has ~34 element IDs, Side Cart has ~30. Together they handle: item display, quantity updates, removal, subtotal/shipping/total calculation, cross-sell suggestions, and checkout navigation.

**Key files:**
- Read: `WIX-STUDIO-BUILD-SPEC.md` lines 786-893 (Cart Page + Side Cart)
- Read: `src/pages/Cart Page.js`
- Read: `src/pages/Side Cart.js`
- Read: `src/backend/cartRecovery.web.js`

**Step 1: Check if template has cart page**
The Furniture Store template may use Wix's native cart. If so:
- Option A: Customize native cart (add our element IDs to Wix's cart components)
- Option B: Create a custom Cart Page and override Wix's default

**Step 2: Cart Page elements (priority order)**
1. Cart items: `#cartItemRepeater` with `#cartItemImage`, `#cartItemTitle`, `#cartItemPrice`, `#cartItemQuantity`, `#cartItemRemove`
2. Cart summary: `#cartSubtotal`, `#cartShipping`, `#cartTotal`, `#checkoutButton`
3. Empty cart state: `#emptyCartContainer`, `#emptyCartTitle`, `#continueShoppingBtn`
4. Shipping progress: `#shippingProgressBar`, `#shippingProgressText` (free shipping threshold)

**Step 3: Side Cart elements**
1. Side cart container: `#sideCartContainer`, `#sideCartOverlay`
2. Item list: `#sideCartRepeater` with item elements
3. Summary: `#sideCartSubtotal`, `#sideCartCheckout`, `#sideCartContinue`
4. Close button: `#sideCartClose`

**Step 4: Verify data flow**
- Add product from Product Page → side cart slides open with correct item
- Side cart: update quantity → subtotal recalculates
- Side cart: remove item → item disappears, totals update
- Side cart: "View Cart" → navigates to full Cart Page
- Cart Page: all items display with correct data
- Cart Page: update quantity → totals recalculate
- Cart Page: remove item → updates
- Cart Page: empty state shows when cart empty
- Cart Page: "Proceed to Checkout" → navigates to Checkout
- Shipping progress bar updates based on cart total vs threshold

**Acceptance Criteria:**
- [ ] Side cart opens on add-to-cart with correct product
- [ ] Quantity updates work (side cart + full cart)
- [ ] Item removal works
- [ ] Totals calculate correctly (subtotal + shipping estimate)
- [ ] Empty cart state displays
- [ ] Navigation: side cart → cart page → checkout
- [ ] Mobile responsive
- [ ] Screenshots saved

---

### Bead 8: Checkout + Thank You Hookup

**Owner:** crew member with editor + code access
**Dependencies:** Bead 7 (Cart working)
**Priority:** P1

**Description:**
Connect `Checkout.js` and `Thank You Page.js`. Checkout has ~60 element IDs, Thank You has ~46. This bead also requires payment provider configuration and shipping rate integration.

**Key files:**
- Read: `WIX-STUDIO-BUILD-SPEC.md` lines 1153-1255 (Checkout) and 1256-1341 (Thank You)
- Read: `src/pages/Checkout.js`
- Read: `src/pages/Thank You Page.js`
- Read: `src/backend/ups-shipping.web.js` — shipping rate calculation
- Read: `shipping-rates-plugin.js` — SPI for Wix checkout

**Step 1: Configure Wix Payments**
- Dashboard → Accept Payments → Set up Wix Payments (or PayPal, Stripe)
- Enable TEST MODE — no real charges
- Verify test credit card numbers work

**Step 2: Configure shipping rates**
- Dashboard → Shipping & Delivery → Add shipping regions
- Connect our `shipping-rates-plugin.js` SPI if possible
- Or set manual rates matching our spec: local $149, regional $249, free >$1,999
- White-glove delivery as an option

**Step 3: Checkout page elements**
Wix controls most of the checkout flow natively. Our customizations add:
- `#checkoutProgress` — step indicator
- Address validation elements
- Order summary sidebar elements
- Express checkout buttons
- Financing/Afterpay section (can defer to Phase 3)

**Step 4: Thank You page elements**
1. Order confirmation: `#orderNumber`, `#orderDate`, `#orderTotal`, `#orderItems`
2. Delivery timeline: `#deliveryEstimate`, `#deliverySteps`
3. Social sharing: `#shareButtons`
4. Post-purchase recommendations: `#recommendRepeater`
5. Care/assembly info: `#careInfo`, `#assemblyLink`

**Step 5: End-to-end purchase test**
This is the critical test. Walk through the COMPLETE flow:
1. Home → browse products
2. Category → filter → select product
3. Product Page → add to cart
4. Cart → proceed to checkout
5. Checkout → enter test address, test payment
6. Submit order → verify Thank You page shows order details
7. Check Wix dashboard → order appears in Orders

**Step 6: Shipping rate verification**
- Enter a local NC address → verify local rate ($149 or free if >$1,999)
- Enter a regional address (e.g., VA) → verify regional rate ($249)
- Enter cart total >$1,999 → verify free shipping applied

**Acceptance Criteria:**
- [ ] Wix Payments configured in test mode
- [ ] Shipping rates configured (manual or SPI)
- [ ] Checkout flow completes with test payment
- [ ] Thank You page displays real order data
- [ ] Order appears in Wix dashboard
- [ ] Shipping rates calculate correctly for test addresses
- [ ] Mobile checkout flow works
- [ ] Screenshots of each checkout step saved

---

### Bead 9: Phase 1 Integration Test + Overseer Checkpoint

**Owner:** crew member (testing) + melania (PM review) + overseer (visual approval)
**Dependencies:** Beads 4-8 all complete
**Priority:** P1

**Description:**
Full end-to-end verification of the core commerce path. This is the gate before Phase 2. Every page must work with real data, look good, and pass overseer visual inspection.

**Step 1: Full commerce flow test**
Walk through as a real customer would:
1. Land on Home page — products visible, navigation works
2. Click a category → Category Page loads with filtered products
3. Browse, sort, filter → all work
4. Click a product → Product Page loads with full details
5. Select variant, set quantity, add to cart → side cart opens
6. View full cart → items correct, totals correct
7. Proceed to checkout → enter address, select shipping, enter test payment
8. Complete purchase → Thank You page with order confirmation
9. Check order in Wix dashboard → order recorded

**Step 2: Playwright smoke test**
Write a Playwright test that automates the above flow:

```javascript
// tests/e2e/phase1-smoke.test.js
test('complete purchase flow', async ({ page }) => {
  await page.goto(SITE_URL);
  // Verify Home page loads with products
  // Navigate to category
  // Click a product
  // Add to cart
  // Complete checkout (test mode)
  // Verify Thank You page
});
```

**Step 3: Mobile responsive audit**
For EACH Phase 1 page, test at:
- 320px (mobile small)
- 375px (mobile standard)
- 768px (tablet)
- 1024px (desktop)
- 1280px (wide)

Check: no overflow, no unreadable text, all buttons tappable, navigation works.

**Step 4: Performance check**
- Load each page, note load time
- Target: < 3 seconds on simulated 3G
- Flag any pages > 5 seconds

**Step 5: Compile Phase 1 report**
Create a report with:
- Screenshot of each page (desktop + mobile) with real data
- Data flow verification checklist (all checks above)
- Performance metrics
- Known issues / technical debt for Phase 2

**Step 6: Overseer visual walkthrough**
- Share report + live site URL with overseer
- Overseer views each page
- Overseer approves or requests changes
- If changes requested → fix before proceeding to Phase 2

**Acceptance Criteria:**
- [ ] Complete purchase flow works end-to-end
- [ ] All 6 pages display real data
- [ ] Mobile responsive on all viewports
- [ ] Playwright smoke test passes
- [ ] Page load < 3 seconds (desktop)
- [ ] Phase 1 report compiled with screenshots
- [ ] **Overseer APPROVES Phase 1 visual quality**

---

## Phase 2: Content & Trust (7 pages)

### Bead 10: About + Contact Hookup

**Owner:** crew member
**Dependencies:** Bead 9 (Phase 1 approved)
**Priority:** P2

**Description:**
Connect `About.js` and `Contact.js` to template pages. About has elements for brand story, team, showroom info. Contact has form, map, hours, appointment booking.

**Key files:**
- Read: `WIX-STUDIO-BUILD-SPEC.md` lines 894-1020 (About + Contact)
- Read: `src/pages/About.js`, `src/pages/Contact.js`
- Read: `src/backend/contactSubmissions.web.js`

**Real content required:**
- About: Carolina Futons story, team photos (or placeholder with real names), showroom address
- Contact: Real phone (828) 252-9449, real address, real hours (Wed-Sat 10am-5pm), working form

**Acceptance Criteria:**
- [ ] About page tells real brand story with real imagery
- [ ] Contact form submits and stores in backend
- [ ] Phone, address, hours display correctly
- [ ] Map shows correct location
- [ ] Mobile responsive
- [ ] Screenshots saved

---

### Bead 11: FAQ + Policies Hookup

**Owner:** crew member
**Dependencies:** Bead 9
**Priority:** P2

**Description:**
Create FAQ, Shipping Policy, and Returns pages. These may not exist in template — create new pages in editor.

**Key files:**
- Read: `WIX-STUDIO-BUILD-SPEC.md` lines 1021-1038 (FAQ), 1113-1129 (Shipping), 1826-1919 (Returns)
- Read: `src/pages/FAQ.js`, `src/pages/Shipping Policy.js`, `src/pages/Returns.js`

**Real content required:**
- FAQ: Real questions and answers about futons, shipping, returns, assembly
- Shipping: Real shipping policy (local delivery, regional, white-glove details)
- Returns: Real return policy, self-service returns flow

**Acceptance Criteria:**
- [ ] FAQ page with real Q&A content, expandable accordion
- [ ] Shipping Policy with real rates and delivery info
- [ ] Returns page with self-service flow connected
- [ ] All three pages accessible from navigation
- [ ] Mobile responsive
- [ ] Screenshots saved

---

### Bead 12: Blog Hookup

**Owner:** crew member
**Dependencies:** Bead 9
**Priority:** P2

**Description:**
Connect `Blog.js` and `Blog Post.js` to template's blog. Template should have blog infrastructure. Add real blog posts (or quality sample posts about furniture/home decor).

**Key files:**
- Read: `WIX-STUDIO-BUILD-SPEC.md` lines 1342-1388 (Blog + Blog Post)
- Read: `src/pages/Blog.js`, `src/pages/Blog Post.js`

**Real content required:**
- At least 3 real blog posts: e.g., "How to Choose the Perfect Futon Frame", "Styling Your Murphy Bed Space", "Our Top Mattresses for 2026"
- Each with real imagery (from our photo archive or quality stock)
- Social sharing buttons connected

**Acceptance Criteria:**
- [ ] Blog listing page shows real posts with images and excerpts
- [ ] Click post → full post renders with real content
- [ ] Social sharing buttons work
- [ ] Related products sidebar shows real products
- [ ] Newsletter CTA on blog works
- [ ] Mobile responsive
- [ ] Screenshots saved

---

### Bead 13: Phase 2 Integration Test + Overseer Checkpoint

**Owner:** crew + melania + overseer
**Dependencies:** Beads 10-12
**Priority:** P2

**Same pattern as Bead 9:** Full test of all Phase 2 pages, screenshots, mobile audit, overseer approval.

Additional checks:
- All Phase 1 pages still working (regression test)
- Navigation between all pages works (header + footer links)
- SEO basics: page titles, meta descriptions on all pages

**Acceptance Criteria:**
- [ ] All Phase 1 + Phase 2 pages working with real data
- [ ] No Phase 1 regressions
- [ ] Navigation complete between all live pages
- [ ] **Overseer APPROVES Phase 2**

---

## Phase 3-4: Beads Created After Phase 2 Approval

Phase 3 (Engagement: Member, Newsletter, Referral, Gift Cards, Style Quiz, Assembly, Search, Compare) and Phase 4 (Remaining 18 pages) beads will be created with the same level of detail once Phase 2 is approved. Each bead follows the established pattern:

1. Map template/new elements → BUILD-SPEC IDs
2. Real data loaded
3. Visual verification with screenshots
4. Data flow verification
5. Mobile responsive check
6. Overseer checkpoint at phase boundary

---

## Execution Notes

**Branch strategy:** Each bead gets its own branch: `cf-{bead-id}-{short-desc}`. PR process: open PR → melania reviews → merge.

**Editor access:** Only ONE person in the Wix Studio editor at a time. Coordinate via mail.

**Testing:** Run `npx vitest run` after every code change. 11,874+ tests must stay green.

**Commits:** Frequent, small commits. One logical change per commit. TDD where applicable.

**Communication:** Update bead status (`bd update <id> --status=in_progress` → `bd close <id>`). Mail melania on completion.
