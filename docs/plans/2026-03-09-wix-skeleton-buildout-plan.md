# Wix Studio Skeleton Buildout — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Place all UI elements with correct IDs in Wix Studio editor for My Site 2, enabling Velo code to wire to them.

**Architecture:** Use Playwright MCP (headless) to automate the Wix Studio editor. Login → navigate to page → add elements → set IDs via Properties panel. Work page-by-page, starting with master page (header/footer), then Product Page (gallery), then Home, then remaining pages in priority order. Each page is a commit checkpoint.

**Tech Stack:** Playwright MCP (headless), Wix Studio editor, Wix CLI (`wix dev`)

**Constraint:** Only ONE builder session on the Wix Studio site at a time.

---

## Known Blockers & Mitigations

Rennala's attempt (2026-03-09) found:
1. Properties panel ID input is intercepted by canvas overlay — **Mitigation:** Use `browser_run_code` to inject JS directly into editor DOM, bypass canvas overlay
2. React state reverts programmatic fill() — **Mitigation:** Dispatch React synthetic events (`new Event('input', {bubbles: true})`) or use Editor SDK `document.getChildren()` / `document.setItemProperties()` if available
3. Tab/Enter after ID change causes deselection — **Mitigation:** Use Playwright `browser_press_key` with proper focus management, or inject via console

## Alternative Approaches (try in order)

1. **Editor Console API**: Wix Studio editor exposes `documentServices` or `editorAPI` on window. Check `window.editorModel`, `window.documentServices`, `window.editorAPI`. If found, use `browser_run_code` to add elements and set IDs programmatically.
2. **Page JSON files**: Check if `.wix/` directory in stage2 repo contains page structure JSON that can be edited directly (add elements with IDs in JSON, push, let Wix sync).
3. **wix dev Local Editor**: The local editor launched by `wix dev` may have fewer guards than Studio cloud editor.
4. **Playwright with React event simulation**: Dispatch synthetic React events to the ID input field.
5. **Manual fallback**: If all automation fails, document exact click sequences for human.

---

## Phase 1: Reconnaissance — Discover Editor API

### Task 1: Login to Wix Studio and probe editor APIs

**Files:** None (browser automation only)

**Step 1: Navigate to Wix Studio and login**

Use Playwright MCP headless:
- Navigate to `https://manage.wix.com`
- Login with halworker85@gmail.com credentials
- Navigate to My Site 2 editor

**Step 2: Probe for editor APIs via browser_run_code**

```javascript
async (page) => {
  // Check what APIs are available on window
  const apis = {};
  for (const key of ['documentServices', 'editorAPI', 'editorModel',
                       'platformEvents', 'wixCodeApi', 'editorSDK']) {
    apis[key] = typeof window[key] !== 'undefined';
  }
  // Check for React devtools or component tree
  apis.reactFiber = !!document.querySelector('[data-mesh-id]');
  apis.stageElement = !!document.querySelector('[data-comp-id]');
  return JSON.stringify(apis, null, 2);
}
```

**Step 3: If documentServices exists, test element creation**

```javascript
async (page) => {
  // Try to use Document Services to add a text element
  if (window.documentServices) {
    const ds = window.documentServices;
    // List available methods
    return Object.keys(ds).filter(k => typeof ds[k] === 'function').join(', ');
  }
  return 'documentServices not found';
}
```

**Step 4: Check .wix/ directory for page JSON**

```bash
ls -la /tmp/carolina-futons-stage2/.wix/
find /tmp/carolina-futons-stage2/.wix/ -name "*.json" | head -20
```

**Step 5: Document findings and choose approach**

Based on results, proceed with the most viable approach.

**Step 6: Commit reconnaissance notes**

---

## Phase 2: Master Page Elements (Header + Footer)

### Task 2: Place header elements

**Target:** 19 header elements from WIX-STUDIO-BUILD-SPEC.md

Using the approach identified in Task 1, add these elements to the master page header:

| ID | Type | Priority |
|----|------|----------|
| `siteLogo` | Image | Critical |
| `announcementBar` | Strip | Critical |
| `announcementText` | Text | Critical |
| `navHome` | Text/Link | Critical |
| `navShop` | Text/Link | Critical |
| `navSale` | Text/Link | Critical |
| `navContact` | Text/Link | High |
| `navFAQ` | Text/Link | High |
| `navAbout` | Text/Link | High |
| `navBlog` | Text/Link | High |
| `navProductVideos` | Text/Link | Medium |
| `navGettingItHome` | Text/Link | Medium |
| `headerSearchInput` | Input | High |
| `cartIcon` | Button | Critical |
| `cartBadge` | Text | Critical |
| `mobileMenuButton` | Button | High |
| `mobileMenuOverlay` | Box | High |
| `mobileMenuClose` | Button | High |
| `businessSchemaHtml` | HtmlComponent | Medium |

**Step 1: Open master page in editor**
**Step 2: Add elements one at a time using discovered API**
**Step 3: Verify element IDs with snapshot**
**Step 4: Save in editor**

### Task 3: Place footer elements

**Target:** 13 footer elements

| ID | Type | Priority |
|----|------|----------|
| `footerLogo` | Image | High |
| `footerEmailInput` | Input | High |
| `footerEmailSubmit` | Button | High |
| `footerEmailError` | Text | Medium |
| `footerEmailSuccess` | Text | Medium |
| `footerPhone` | Text | High |
| `footerAddress` | Text | High |
| `footerHours` | Text | High |
| `socialFacebook` | Button | Medium |
| `socialInstagram` | Button | Medium |
| `socialPinterest` | Button | Medium |
| `skipToContent` | Button | High |
| `mainContent` | Container | High |

**Step 1-4: Same pattern as Task 2**
**Step 5: Commit — "feat: master page header + footer elements"**

---

## Phase 3: Product Page Gallery Elements

### Task 4: Place Product Page gallery and core elements

**Target:** ~30 critical Product Page elements

Gallery (critical path):
| ID | Type |
|----|------|
| `productMainImage` | Image |
| `productGallery` | Gallery |
| `productDataset` | Dataset |
| `productName` | Text (H1) |
| `productPrice` | Text |
| `productComparePrice` | Text |
| `stockStatus` | Text |
| `sizeDropdown` | Dropdown |
| `finishDropdown` | Dropdown |
| `addToCartButton` | Button |
| `addToCartSuccess` | Box |
| `productSchemaHtml` | HtmlComponent |

Lightbox elements:
| ID | Type |
|----|------|
| `lightboxOverlay` | Box |
| `lightboxImage` | Image |
| `lightboxClose` | Button |
| `lightboxPrev` | Button |
| `lightboxNext` | Button |
| `lightboxCounter` | Text |
| `imageZoomOverlay` | Box |
| `imageZoomImage` | Image |

Breadcrumbs:
| ID | Type |
|----|------|
| `breadcrumb1` | Text/Link |
| `breadcrumb2` | Text/Link |
| `breadcrumb3` | Text |
| `breadcrumbSchemaHtml` | HtmlComponent |

Quantity:
| ID | Type |
|----|------|
| `quantityInput` | Input |
| `quantityMinus` | Button |
| `quantityPlus` | Button |

**Step 1-4: Add elements using discovered API**
**Step 5: Commit — "feat: Product Page gallery + core elements"**

---

## Phase 4: Home Page Elements

### Task 5: Place Home page hero + category elements

**Target:** ~40 Home page elements (hero, categories, featured, testimonials, trust bar)

Priority order:
1. Hero section (6 elements)
2. Category repeater (6 elements)
3. Featured products repeater (12 elements)
4. Trust bar (15 elements)
5. Newsletter section (6 elements)

**Step 1-4: Add elements**
**Step 5: Commit — "feat: Home page elements"**

---

## Phase 5: Remaining Pages (batch)

### Task 6-15: One task per page group

Priority order:
1. Category Page (filters, grid, sorting)
2. Cart Page + Side Cart + Checkout
3. Contact + About + FAQ
4. Member Page
5. Blog + Blog Post
6. Store Locator + Financing + Sustainability
7. All remaining pages

Each task follows same pattern: add elements, set IDs, verify, commit.

---

## Phase 6: Verify + Wire

### Task 16: Run wix dev and verify element connectivity

**Step 1:** `cd /tmp/carolina-futons-stage2 && wix dev`
**Step 2:** Check that Velo code can find elements via `$w('#elementId')`
**Step 3:** Fix any ID mismatches
**Step 4:** Commit fixes

### Task 17: Upload product images

**Step 1:** Use Wix Media API or CLI to upload photos from /tmp/cf-photo-migration/downloads/
**Step 2:** Map uploaded media URLs to product catalog
**Step 3:** Verify images display in gallery elements

---

## Success Criteria

- [ ] Master page: all 32 header/footer elements with correct IDs
- [ ] Product Page: gallery, lightbox, zoom, breadcrumbs, quantity, core details
- [ ] Home Page: hero, categories, featured, trust bar, newsletter
- [ ] wix dev confirms element connectivity
- [ ] Product images display in gallery
