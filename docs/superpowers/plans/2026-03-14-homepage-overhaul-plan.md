# Homepage Overhaul & Site Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the staging site from a template with CF text overlays into a branded Carolina Futons store — fixing header, footer, hero, collections, and removing template artifacts — then roll out to product and category pages.

**Architecture:** Option A first (rename template elements via documentServices `setNickname()` to match our Velo code IDs), Option C fallback (remap code references for elements that can't be renamed). Visual fixes via editor API. Parallel PR merges for code layer.

**Tech Stack:** Wix Studio + Wix Velo (JS), Playwright (headless editor automation), documentServices API (via editor iframe), `scripts/remap-element-ids.js`, Custom Wix MCP (velo_sync, velo_publish), Vitest (12,000+ tests)

**Spec:** `docs/superpowers/specs/2026-03-14-homepage-overhaul-design.md`

**Key References:**
- Template element IDs: `scripts/home-page-template-ids.json` (in refinery/rig)
- masterPage ID mapping: `scripts/masterpage-remap.json` (in crew/melania)
- Integration plan: `docs/superpowers/plans/2026-03-13-stage3-frontend-integration.md`
- Stage3 Velo repo: `/Users/hal/gt/cfutons/carolina-futons-stage3-velo/`
- Dev repo (tests): `/Users/hal/gt/cfutons/refinery/rig/`

**Constraint:** Only Melania drives the browser. Crew does code-only work.

---

## Chunk 1: Gate Check & CSS Activation

### Task 1: Wix Login Gate & Rollback Checkpoint

**Owner:** Melania (browser)
**Files:** None — browser only

- [ ] **Step 1: Verify Wix Studio editor access**
  Navigate to `https://editor.wix.com/studio/47bd7d06-bee1-4723-8fe4-5508a0aed287?metaSiteId=3af610bf-06fb-410d-a406-c1258fa84372`
  If editor loads with canvas visible → proceed.
  If login prompt → check halworker85@gmail.com for Wix password reset email. Set password. Retry.
  If still blocked → escalate to overseer for manual login.

- [ ] **Step 2: Capture baseline**
  In the editor, save current state (Ctrl+S or auto-save should be on).
  Open browser console on the **live published site** (`https://halworker85.wixstudio.com/my-site`) in a separate tab.
  Count and log current console errors — this is the baseline for step 1.9 verification.

  ```
  Expected baseline errors (from live-site-full.jpeg capture):
  - [performanceHelpers] deferred init error
  - [Home] Testimonials section failed: TypeError
  - suspense rendered fallback (×3)
  - ReferenceError: document is not defined
  ```

- [ ] **Step 3: Take before screenshots**
  Take full-page screenshot of live site at desktop (1280px) — save as `before-overhaul-desktop.jpeg`
  Take viewport screenshot at mobile (375px) — save as `before-overhaul-mobile.jpeg`

### Task 2: Activate global.css

**Owner:** Melania (editor)
**Files:** `src/styles/global.css` (already in stage3-velo repo, just needs activation)

- [ ] **Step 1: Navigate to Code Panel**
  In editor, the Code Panel should be visible at the bottom. If not, click the `{ }` icon in the left sidebar to open it.

- [ ] **Step 2: Find global.css**
  In the Code Panel file tree, look under `styles/` or root level for `global.css`.
  If the file appears grayed out or has a toggle, it's inactive.

- [ ] **Step 3: Activate the CSS file**
  Click on `global.css` → if there's an "Enable" or toggle switch, turn it on.
  The file targets:
  ```css
  .wixui-rich-text h2, h2.font_2 { /* heading size override */ }
  ```

- [ ] **Step 4: Save and publish**
  Save editor (Ctrl+S). Click "Publish" button (top right).

- [ ] **Step 5: Verify on live site**
  Reload `https://halworker85.wixstudio.com/my-site`
  Check: "SHOP BY COLLECTIONS" heading — should be ~24-36px, NOT 168px.
  Check: "NEW IN", "BEST SELLERS" headings — same.
  Spot-check a category page — headings should also be fixed.

---

## Chunk 2: Header & Footer Element Renames (masterPage)

### Task 3: Header Element Renames via documentServices API

**Owner:** Melania (Playwright)
**Files:** None modified on disk — all changes via editor API

The documentServices API is accessed through the editor iframe. The proven recipe from session 10:
```javascript
// Get iframe references
const editorIframe = document.querySelectorAll('iframe')[0];
const previewIframe = document.querySelectorAll('iframe')[1];

// Access documentServices
const ds = editorIframe.contentWindow.documentServices;

// Get component ref by nickname
const compRef = ds.components.code.getByNickname('vectorImage10');

// Rename element
ds.components.code.setNickname(compRef, 'siteLogo');
```

- [ ] **Step 1: Rename `vectorImage10` → `siteLogo`**
  Via Playwright `browser_evaluate` on the editor page:
  ```javascript
  (() => {
    const ds = document.querySelectorAll('iframe')[0].contentWindow.documentServices;
    const ref = ds.components.code.getByNickname('vectorImage10');
    ds.components.code.setNickname(ref, 'siteLogo');
    return 'renamed vectorImage10 → siteLogo';
  })()
  ```

- [ ] **Step 2: Rename `shoppingCartIcon1` → `cartIcon`**
  ```javascript
  (() => {
    const ds = document.querySelectorAll('iframe')[0].contentWindow.documentServices;
    const ref = ds.components.code.getByNickname('shoppingCartIcon1');
    ds.components.code.setNickname(ref, 'cartIcon');
    return 'renamed shoppingCartIcon1 → cartIcon';
  })()
  ```

- [ ] **Step 3: Rename `searchButton2` → `headerSearchInput`**
  Same pattern — `getByNickname('searchButton2')` → `setNickname(ref, 'headerSearchInput')`

- [ ] **Step 4: Rename `text42` → `announcementText`**
  Same pattern — `getByNickname('text42')` → `setNickname(ref, 'announcementText')`

- [ ] **Step 5: Rename `box45` → `announcementBar`**
  Same pattern — `getByNickname('box45')` → `setNickname(ref, 'announcementBar')`

- [ ] **Step 6: Rename `button7` → `navShop`**
  Same pattern — `getByNickname('button7')` → `setNickname(ref, 'navShop')`

- [ ] **Step 7: Rename `hamburgerOpenButton1` → `mobileMenuButton`**
  Same pattern — `getByNickname('hamburgerOpenButton1')` → `setNickname(ref, 'mobileMenuButton')`

- [ ] **Step 8: Set logo image source**
  After renaming `siteLogo`, set its image to the CF logo. PR #298 generates an SVG data URI. For now, use a simple text-based approach via the documentServices API:
  ```javascript
  (() => {
    const ds = document.querySelectorAll('iframe')[0].contentWindow.documentServices;
    const ref = ds.components.code.getByNickname('siteLogo');
    // Get current component data to understand its type
    const data = ds.components.data.get(ref);
    return JSON.stringify({ type: data?.type, id: ref });
  })()
  ```
  Based on the component type (VectorImage), determine the correct API to set the SVG source. If VectorImage: use `ds.components.data.update(ref, { svgId: ... })`. If Image: use `ds.components.data.update(ref, { uri: ... })`.

- [ ] **Step 9: Verify header renames**
  ```javascript
  (() => {
    const ds = document.querySelectorAll('iframe')[0].contentWindow.documentServices;
    const expected = ['siteLogo', 'cartIcon', 'headerSearchInput', 'announcementText', 'announcementBar', 'navShop', 'mobileMenuButton'];
    const results = expected.map(name => {
      const ref = ds.components.code.getByNickname(name);
      return { name, found: !!ref };
    });
    return JSON.stringify(results);
  })()
  ```
  Expected: all 7 return `found: true`.

- [ ] **Step 10: Save editor**
  Ctrl+S or auto-save verification.

### Task 4: Footer Element Renames & Fixes

**Owner:** Melania (Playwright)
**Files:** None modified on disk — editor API

- [ ] **Step 1: Rename `text25` → `footerNewsletterTitle`**
  ```javascript
  (() => {
    const ds = document.querySelectorAll('iframe')[0].contentWindow.documentServices;
    const ref = ds.components.code.getByNickname('text25');
    ds.components.code.setNickname(ref, 'footerNewsletterTitle');
    return 'renamed text25 → footerNewsletterTitle';
  })()
  ```

- [ ] **Step 2: Rename `text24` → `footerNewsletterSubtitle`**
  Same pattern.

- [ ] **Step 3: Rename `button4` → `footerEmailSubmit`**
  Same pattern.

- [ ] **Step 4: Handle footer contact info (text18)**
  The template has one `text18` for all contact info. Our code expects `#footerPhone`, `#footerAddress`, `#footerHours` separately.

  **Option A (preferred — try first):** Rename `text18` → `footerAddress`. Then add 2 new text elements in editor for `footerPhone` and `footerHours`:
  ```javascript
  (() => {
    const ds = document.querySelectorAll('iframe')[0].contentWindow.documentServices;
    // Rename existing
    const ref = ds.components.code.getByNickname('text18');
    ds.components.code.setNickname(ref, 'footerAddress');
    // Check what parent container text18 lives in
    const parent = ds.components.layout.getParent(ref);
    return JSON.stringify({ renamed: true, parentId: parent });
  })()
  ```
  Then evaluate if we can add new text elements to that parent via `ds.components.add()`.

  **Option B (fallback):** Rename `text18` → `footerContactInfo` (consolidated). Document as follow-up bead to update `FooterSection.js`.

- [ ] **Step 5: Remove duplicate copyright**
  Find the "© 2025 by Carolina Futons. Built on Wix Studio" text element and either hide it or clear its text:
  ```javascript
  (() => {
    const ds = document.querySelectorAll('iframe')[0].contentWindow.documentServices;
    // List all text elements in footer section2 to find the duplicate
    const footerRef = ds.components.code.getByNickname('section2') || ds.components.code.getByNickname('SITE_FOOTER');
    const children = ds.components.getChildren(footerRef);
    // Find text elements containing "2025"
    const results = children.map(child => {
      const data = ds.components.data.get(child);
      return { id: child, text: data?.text?.substring(0, 50), nickname: ds.components.code.getNickname(child) };
    });
    return JSON.stringify(results);
  })()
  ```
  Once identified, clear or collapse the duplicate element.

- [ ] **Step 6: Set footer logo**
  Find the footer logo element (`text41` per remap JSON) and set it to styled "Carolina Futons" text matching the header.

- [ ] **Step 7: Verify footer renames**
  Same verification pattern as header — check all renamed elements exist.

- [ ] **Step 8: Save editor**

---

## Chunk 3: Homepage Visual Fixes

### Task 5: Hero Image Swap

**Owner:** Melania (Playwright)
**Files:** None on disk — editor API

The hero image is `imageX12` (nickname) inside `section1` (Welcome/Hero section).

- [ ] **Step 1: Rename hero section elements**
  ```javascript
  (() => {
    const ds = document.querySelectorAll('iframe')[0].contentWindow.documentServices;
    const renames = [
      ['section1', 'heroSection'],
      ['text16', 'heroTitle'],
      ['text17', 'heroSubtitle'],
      ['button3', 'heroCTA'],
      ['imageX12', 'heroImage']
    ];
    const results = renames.map(([old, new_]) => {
      const ref = ds.components.code.getByNickname(old);
      if (ref) {
        ds.components.code.setNickname(ref, new_);
        return { old, new: new_, success: true };
      }
      return { old, new: new_, success: false };
    });
    return JSON.stringify(results);
  })()
  ```

- [ ] **Step 2: Identify best hero image from CDN**
  Browse the CF product images to find a lifestyle/room-setting shot. Check what's in the downloaded images:
  ```bash
  ls /tmp/cf-photo-migration/downloads/ | head -20
  ```
  Or use a known good CDN URL from the existing catalog. The current `placeholderImages.js` has a homepage hero URL — check PR #297 for the updated CDN URL.

- [ ] **Step 3: Set hero image source**
  ```javascript
  (() => {
    const ds = document.querySelectorAll('iframe')[0].contentWindow.documentServices;
    const ref = ds.components.code.getByNickname('heroImage');
    const data = ds.components.data.get(ref);
    // ImageX component — update its image URI
    // The exact property depends on ImageX data structure
    return JSON.stringify({ type: data?.type, keys: Object.keys(data || {}) });
  })()
  ```
  Based on the data structure, set the image URI to the CF lifestyle photo CDN URL.

- [ ] **Step 4: Verify hero renders**
  Take screenshot of editor preview. Text overlay ("Handcrafted Comfort, Mountain Inspired") should be legible over the new image.

### Task 6: Shop by Collections Images (4 Swaps)

**Owner:** Melania (Playwright)
**Files:** None on disk — editor API

From `home-page-template-ids.json`, the category cards are in `section10` (Store Categories):
- Card 1: `box26` container with image element inside
- Card 2-4: similar containers

- [ ] **Step 1: Map category card image elements**
  ```javascript
  (() => {
    const ds = document.querySelectorAll('iframe')[0].contentWindow.documentServices;
    const section = ds.components.code.getByNickname('section10');
    // Get all ImageX components in this section
    const allComps = ds.components.getChildren(section, true); // recursive
    const images = allComps.filter(ref => {
      const data = ds.components.data.get(ref);
      return data?.type?.includes('Image') || ds.components.code.getNickname(ref)?.includes('image');
    }).map(ref => ({
      nickname: ds.components.code.getNickname(ref),
      type: ds.components.data.get(ref)?.type
    }));
    return JSON.stringify(images);
  })()
  ```

- [ ] **Step 2: Identify CF product images for each category**
  Select best product photo CDN URL for each:
  - **Futon Frames** → Monterey or Asheville frame (warm wood finish)
  - **Murphy Cabinet Beds** → Murphy Cube (cabinet view)
  - **Platform Beds** → best platform bed from catalog
  - **Mattresses** → mattress product shot

  Source URLs from the existing Wix Store product images (already on CDN at `static.wixstatic.com`).

- [ ] **Step 3: Set each category card image**
  For each of the 4 category image elements, update the image source via documentServices:
  ```javascript
  (() => {
    const ds = document.querySelectorAll('iframe')[0].contentWindow.documentServices;
    const ref = ds.components.code.getByNickname('IMAGE_NICKNAME_HERE');
    ds.components.data.update(ref, { uri: 'wix:image://v1/CDN_IMAGE_ID/filename.jpg/_.jpg' });
    return 'updated category image';
  })()
  ```
  Repeat for all 4 categories.

- [ ] **Step 4: Verify all 4 images**
  Take screenshot of the collections section. All 4 boxes should show CF products.

### Task 7: Remove "As Seen In" & Fix Instagram

**Owner:** Melania (Playwright)
**Files:** None on disk — editor API

- [ ] **Step 1: Collapse "As Seen In" section**
  ```javascript
  (() => {
    const ds = document.querySelectorAll('iframe')[0].contentWindow.documentServices;
    const ref = ds.components.code.getByNickname('section4'); // Press / As Seen In
    // Collapse the section so it takes no space
    ds.components.properties.update(ref, { isCollapsed: true });
    // Alternative: ds.components.properties.update(ref, { isVisible: false });
    return 'collapsed section4 (As Seen In)';
  })()
  ```
  If `isCollapsed` is not a valid property, try hiding and checking if the template handles layout reflow.

- [ ] **Step 2: Fix Instagram section**
  The Instagram section is `section5`. Keep the "FOLLOW US @CAROLINAFUTONS" heading. Hide the broken feed widget:
  ```javascript
  (() => {
    const ds = document.querySelectorAll('iframe')[0].contentWindow.documentServices;
    const section = ds.components.code.getByNickname('section5');
    const children = ds.components.getChildren(section, true);
    // Find the TPAWidget (Instagram feed) and hide it
    const widgets = children.filter(ref => {
      const data = ds.components.data.get(ref);
      return data?.type?.includes('TPA') || data?.type?.includes('Widget');
    });
    return JSON.stringify(widgets.map(ref => ({
      nickname: ds.components.code.getNickname(ref),
      type: ds.components.data.get(ref)?.type
    })));
  })()
  ```
  Then collapse the feed widget, keeping the heading.

- [ ] **Step 3: Fix "CF Story" section image**
  The about/story section is `section7`. Find the image element and replace with CF photo:
  ```javascript
  (() => {
    const ds = document.querySelectorAll('iframe')[0].contentWindow.documentServices;
    const section = ds.components.code.getByNickname('section7');
    const children = ds.components.getChildren(section, true);
    const images = children.filter(ref => {
      const nickname = ds.components.code.getNickname(ref);
      return nickname?.includes('image') || nickname?.includes('Image');
    }).map(ref => ({
      nickname: ds.components.code.getNickname(ref),
      type: ds.components.data.get(ref)?.type
    }));
    return JSON.stringify(images);
  })()
  ```
  Then set the image source to a CF showroom/lifestyle photo.

- [ ] **Step 4: Save editor**

---

## Chunk 4: Publish, Verify & Code Remap

### Task 8: Publish & Full Verification

**Owner:** Melania (browser)

- [ ] **Step 1: Publish the site**
  Click "Publish" in the editor top-right, or use Playwright to click the publish button.
  Wait for publish confirmation.

- [ ] **Step 2: Take after screenshots**
  Navigate to live site in separate tab: `https://halworker85.wixstudio.com/my-site`
  Full-page screenshot desktop (1280px) → `after-overhaul-desktop.jpeg`
  Full-page screenshot mobile (375px) → `after-overhaul-mobile.jpeg`

- [ ] **Step 3: Verify all acceptance criteria**
  Check each item:
  - [ ] H2 headings reasonable size (CSS active)
  - [ ] Header shows CF logo (not tera/oversized H2)
  - [ ] Nav on single line at desktop
  - [ ] Hero shows CF product image (not fireplace)
  - [ ] Collections show real CF products (4 boxes)
  - [ ] "As Seen In" section gone (no gap)
  - [ ] Instagram section — no blank dark boxes
  - [ ] CF Story section — CF-relevant image
  - [ ] Footer — single copyright, social links clickable
  - [ ] Console errors — compare against baseline (no NEW errors)

- [ ] **Step 4: Spot-check other pages**
  Click through to one category page (e.g., /category/futon-frames) — verify it loads.
  Click through to one product page (e.g., Monterey Futon Frame) — verify it loads.
  These pages won't be perfect yet but should still function.

### Task 9: Code Remap for Gaps (Option C Fallback)

**Owner:** Crew (code work — no browser)
**Files:**
- Create: `scripts/masterpage-remap-flat.json` (in refinery/rig)
- Create: `scripts/home-remap-flat.json` (in refinery/rig)
- Modify: `src/pages/masterPage.js` (if remap needed)
- Modify: `src/pages/Home.c1dmp.js` (if remap needed)
- Test: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run`

- [ ] **Step 1: Inventory remaining gaps**
  After editor renames (Task 3-4), check which of our code's `$w('#id')` references still don't match template elements. The renames in Tasks 3-4 should have covered:
  - `siteLogo` ✓, `cartIcon` ✓, `headerSearchInput` ✓, `announcementText` ✓, `announcementBar` ✓, `navShop` ✓, `mobileMenuButton` ✓
  - `footerNewsletterTitle` ✓, `footerNewsletterSubtitle` ✓, `footerEmailSubmit` ✓, `footerAddress` ✓
  - `heroSection` ✓, `heroTitle` ✓, `heroSubtitle` ✓, `heroCTA` ✓, `heroImage` ✓

  Remaining gaps (from `masterpage-remap.json` notes):
  - `cartBadge` — template cart is TPAWidget with built-in badge. Code references `#cartBadge` separately. **Gap.**
  - `footerEmailInput` — template uses `form2` TPAWidget. **Known gap, acceptable.**
  - `footerPhone`, `footerHours` — depends on Task 4 Step 4 outcome. **May be gap.**
  - Phase 2 overlays (exitIntentPopup, promoLightbox, etc.) — all GAP, deferred.

- [ ] **Step 2: Create flat remap JSON for gaps**
  If any gaps exist that need code-side remap:
  ```json
  {
    "cartBadge": "shoppingCartIcon1"
  }
  ```
  Save as `scripts/masterpage-remap-flat.json`.
  If no gaps (all covered by editor renames), create empty: `{}`

- [ ] **Step 3: Run remap script (dry-run)**
  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig
  node scripts/remap-element-ids.js scripts/masterpage-remap-flat.json
  ```
  Review output — which files would change, which IDs remapped.

- [ ] **Step 4: Apply remap (if changes look correct)**
  ```bash
  node scripts/remap-element-ids.js scripts/masterpage-remap-flat.json --apply
  ```

- [ ] **Step 5: Run full test suite**
  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run
  ```
  Expected: 12,000+ tests pass. Any failures → investigate and fix.

- [ ] **Step 6: Commit**
  ```bash
  git add scripts/masterpage-remap-flat.json src/
  git commit -m "feat: masterPage + home element remap — Option A renames applied, Option C gaps filled"
  ```

---

## Chunk 5: Parallel PR Merges (Crew)

### Task 10: Cross-Review & Merge PRs

**Owner:** Crew (godfrey, radahn, rennala)
**Files:** GitHub PRs on `DreadPirateRobertz/carolina-futons`

These run in parallel with Chunks 1-4. The crew should start immediately.

- [ ] **Step 1: PR #296 — Template Product Cleanup (godfrey's)**
  Radahn reviews, rennala reviews. 30-min timeout.
  ```bash
  gh pr review 296 --repo DreadPirateRobertz/carolina-futons --approve
  gh pr merge 296 --repo DreadPirateRobertz/carolina-futons --merge
  ```

- [ ] **Step 2: PR #297 — Collections Images (radahn's)**
  Godfrey reviews, rennala reviews. 30-min timeout.
  ```bash
  gh pr review 297 --repo DreadPirateRobertz/carolina-futons --approve
  gh pr merge 297 --repo DreadPirateRobertz/carolina-futons --merge
  ```

- [ ] **Step 3: PR #298 — Logo Replace (rennala's)**
  Godfrey reviews, radahn reviews. 30-min timeout.
  ```bash
  gh pr review 298 --repo DreadPirateRobertz/carolina-futons --approve
  gh pr merge 298 --repo DreadPirateRobertz/carolina-futons --merge
  ```

- [ ] **Step 4: PR #299 — Security PII Fixes (miquella's)**
  Quick review and merge.

- [ ] **Step 5: Run template product cleanup**
  After PR #296 merged, run the cleanup script against staging:
  ```bash
  # Via Wix Store API or CallWixSiteAPI MCP tool
  # Delete 24 template products (MODO, NYX, RAVEN, LUNA, etc.)
  ```
  Verify: store product count = 88.

- [ ] **Step 6: Sync code to stage3-velo**
  After PRs merged, GitHub integration should auto-sync to `carolina-futons-stage3-velo` repo.
  Verify: `cd /Users/hal/gt/cfutons/carolina-futons-stage3-velo && git pull`
  Check: `placeholderImages.js` has CDN URLs (no Unsplash), `carolinaFutonsLogo.js` exists.

---

## Chunk 6: Product Page Integration (Next Session)

### Task 11: Product Page Visual Audit

**Owner:** Melania (browser)

- [ ] **Step 1: Spot-check 5 products**
  Navigate to each on live site, screenshot desktop + mobile:
  1. `https://halworker85.wixstudio.com/my-site/product-page/asheville-futon-frame`
  2. `https://halworker85.wixstudio.com/my-site/product-page/murphy-cube-cabinet-bed`
  3. `https://halworker85.wixstudio.com/my-site/product-page/monterey-futon-frame`
  4. A mattress product URL
  5. A platform bed product URL

- [ ] **Step 2: For each product verify**
  - [ ] Image gallery loads (multiple photos if available)
  - [ ] Product name and price display correctly
  - [ ] "Add to Cart" button works (adds to cart)
  - [ ] "Buy Now" initiates checkout
  - [ ] Breadcrumbs show and link correctly
  - [ ] Social sharing has correct URLs

- [ ] **Step 3: Catalog console errors**
  For each product page, open console and record all errors with the specific `$w('#elementId')` they reference. This builds the remap list for Task 12.

### Task 12: Product Page Element Remap

**Owner:** Melania (editor renames) + crew (code remap)
**Files:**
- Create: `scripts/product-page-template-ids.json`
- Create: `scripts/product-page-remap-flat.json`
- Modify: `src/pages/Product Page.u0gn0.js` (if remap needed)

- [ ] **Step 1: Extract product page element IDs**
  In editor, navigate to a product page. Via documentServices:
  ```javascript
  (() => {
    const ds = document.querySelectorAll('iframe')[0].contentWindow.documentServices;
    const pages = ds.pages.getPagesList();
    // Find Product Page
    const productPage = pages.find(p => p.title?.includes('Product'));
    // Navigate to it and extract all component nicknames
    // ... (follow same pattern as home-page-template-ids.json extraction)
  })()
  ```

- [ ] **Step 2: Build remap mapping**
  Map our code's element IDs (from `Product Page.u0gn0.js`) to template element IDs.
  Priority elements: product image gallery, price, Add to Cart, quantity, related products, star ratings.

- [ ] **Step 3: Rename elements in editor (Option A)**
  Same `setNickname()` pattern as Tasks 3-4.

- [ ] **Step 4: Code remap for gaps (Option C)**
  Same `remap-element-ids.js` pattern as Task 9.

- [ ] **Step 5: Run test suite & deploy**
  ```bash
  cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run
  ```

- [ ] **Step 6: Publish & verify product pages**
  Publish. Re-check the 5 spot-check products. Console errors should be reduced.

---

## Chunk 7: Category Page & Future Beads

### Task 13: Category Page Fix

**Owner:** Melania (dashboard + editor) + crew (code)

- [ ] **Step 1: Rename sidebar categories in Wix Store dashboard**
  Navigate to Wix Dashboard → Store → Categories.
  Rename or hide template categories (Sofas, Lounge Chairs, Tables, Chairs).
  Ensure CF categories visible: Futon Frames, Murphy Cabinet Beds, Platform Beds, Mattresses.

- [ ] **Step 2: Extract category page element IDs**
  Same extraction pattern as Task 12.

- [ ] **Step 3: Rename + remap**
  Same Option A + Option C pattern.

- [ ] **Step 4: Verify category page**
  Navigate to `/category/futon-frames`. Verify: sidebar correct, product grid loads, sort/filter works.

### Task 14: Create Future Beads

**Owner:** Melania (PM)

- [ ] **Step 1: Create bead — Instagram Feed Connect**
  ```bash
  bd create --title "Connect Instagram feed to @carolinafutons" --priority P3 \
    --body "Auth @carolinafutons Instagram Business account in Wix dashboard. Connect native feed widget in section5 (Instagram section). Replace collapsed placeholder. Verify 6-9 recent posts render. Requires Instagram Business account auth — login via carolinafutons@gmail.com."
  ```

- [ ] **Step 2: Create bead — Footer ContactInfo Consolidation**
  ```bash
  bd create --title "Consolidate FooterSection.js contact info elements" --priority P3 \
    --body "Template has single text18 for contact info but code expects #footerPhone, #footerAddress, #footerHours. Either: (a) verify 3 editor elements work, or (b) rewrite FooterSection.js lines 106-120 to use single #footerContactInfo with multi-line content. Tests: update FooterSection tests."
  ```

- [ ] **Step 3: Create bead — Trust Bar Section**
  ```bash
  bd create --title "Add trust bar with real certifications" --priority P3 \
    --body "Replace removed 'As Seen In' section with real trust badges: Night & Day Furniture Authorized Dealer, CertiPUR-US Certified, BBB. Design as horizontal badge strip. Add via editor in section4's position (currently collapsed)."
  ```

- [ ] **Step 4: Create bead — Cart Page Integration**
  ```bash
  bd create --title "Cart page Velo integration" --priority P2 \
    --body "Wire up Cart Page and Side Cart Velo code to template elements. Extract cart page element IDs. Rename elements (Option A). Remap code gaps (Option C). Verify: add item, update quantity, remove, proceed to checkout. Backend: cart*.web.js modules already exist."
  ```

- [ ] **Step 5: Create bead — Checkout + UPS Integration**
  ```bash
  bd create --title "Checkout page + UPS shipping integration" --priority P2 \
    --body "Wire checkout flow: Cart → Checkout → Thank You pages. Connect UPS REST API shipping calculator (backend/shippingService.web.js). Test with real UPS credentials from secrets.env. Verify: complete test order end-to-end."
  ```
