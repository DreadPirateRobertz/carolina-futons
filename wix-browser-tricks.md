# Wix Dashboard Browser Tricks

## Angular Scope Manipulation for Category Images

The Wix Dashboard categories page is an Angular app. In headless mode, the Media Manager iframe doesn't render thumbnails (no actual image data in DOM — thumbnails use a rendering pipeline that requires a visible viewport).

### The Trick: Bypass Media Manager entirely

Instead of using the Media Manager UI, modify the Angular scope directly:

```javascript
// 1. Find the media button element
const mediaEl = document.querySelector('.media-button');

// 2. Get the Angular scope
const scope = angular.element(mediaEl).scope();
const ctrl = scope.$ctrl || scope;

// 3. Set the media item directly (Wix media URL format: {hash}~mv2.{ext})
ctrl.mediaItem = {
  url: 'e04e89_9234577e395e4eb180cb2c9bc936d65f~mv2.jpg',
  height: 600,
  width: 600,
  mediaType: 'PHOTO'
};

// 4. Trigger Angular digest cycle
scope.$apply();

// 5. Click Save button (use header-actions Save, not footer)
```

### Key Details
- **Media URL format**: Just the filename part, NOT the full CDN URL. E.g., `e04e89_9234577e395e4eb180cb2c9bc936d65f~mv2.jpg` (not `https://static.wixstatic.com/media/...`)
- **mediaType**: Always `'PHOTO'` for images
- **The form controller** has `category` and `originalCategory` objects. The two-way binding propagates changes from the media button scope to the form's category data automatically.
- **Save navigates back** to the categories list automatically after successful save
- **Toast confirmation**: Look for `status` element with text like `"Futon Frames" was saved.`

### Category IDs (My Site)
- Futon Frames: `d71befd2-1eb5-4130-9ff5-1df4aeb24dc0`
- Mattresses: `f86231e3-0c51-4369-80f7-76e23c79caf3`
- Murphy Cabinet Beds: `7a0dab34-4bcf-4f80-8ef6-0847bea76906`
- Platform Beds: `1a30c315-56d5-4ca8-8569-adaf12805f9f`
- All Products: `00000000-000000-000000-000000000001`
- Best Sellers: `f3256c75-74d4-0d5f-96b6-d7e07c1f2f94`
- Casegoods & Accessories: `32766f5c-a7b9-4b0c-9906-b5aaba212e48`
- Front Loading Nesting: `6dbe158f-0a69-47f2-8a68-8ed23dec5dee`
- New In: `e593256d-d861-f1ee-1ed7-5c3adb35fd0d`
- Wall Hugger Frames: `6d17b1b6-ea2c-4cfd-8b11-7c499da475e3`

### CF Product Image Hashes (from placeholderImages.js)
- futon-frames: `e04e89_9234577e395e4eb180cb2c9bc936d65f~mv2.jpg`
- mattresses: `e04e89_6f77fe2498b34c4295b48e0677300a19~mv2.jpg`
- murphy-cabinet-beds: `e04e89_229fba0bcb404fda873a0552e7e39089~mv2.png`
- platform-beds: `e04e89_8bb00365ccdc4f33b899c2832e00832d~mv2.jpg`

### What DOESN'T Work in Headless
- Media Manager search box only searches stock photos, not site files by hash
- Media Manager thumbnails don't render (no img src or background-image in DOM)
- Only 217 elements in the iframe, all JS/CSS resources — no actual image data
- Screenshots timeout when Media Manager iframe is open
- Clicking the category image directly times out (overlay div intercepts)

### What DOES Work
- `angular.element(el).scope()` — full access to Angular controllers
- `scope.$apply()` — triggers digest cycle, propagates changes
- Direct click via `element.click()` in evaluate (bypasses Playwright's intercept detection)
- Save button works normally after scope modification

---

## CSS via GitHub Integration

### How It Works
1. Push CSS to `carolina-futons-stage3-velo` repo (`src/styles/global.css`)
2. Wix GitHub integration syncs the file
3. Publish from editor to deploy
4. **CDN CACHE**: Changes may not appear for minutes. Use private/incognito browser to verify.

### Critical CSS Rules
- **NO pseudo-elements** (::before, ::after) — Wix strips them
- **NO ::placeholder** — also stripped
- Wix auto-prefixes "wixui-" to class names: use `.section` not `.wixui-section`
- Must use `!important` to override Wix defaults
- Target colorUnderlay via `[data-testid="colorUnderlay"]` for section backgrounds
- Use `nth-of-type` positional selectors to avoid Wix attribute value mangling
- `box-shadow: inset` works as alternative to pseudo-element borders

### Homepage Section Order (as of 2026-03-14)
1. **Hero** — CF product image, h1, Shop CTA
2. **Shop By Collections** — 4 category cards (CF product images — FIXED 2026-03-14 via documentServices API)
3. **New In** — Product gallery, pulls from Wix Store "New In" collection
4. **The Carolina Futons Story** — (was "THE TERA WORLD", repurposed with CF content)
5. **Best Sellers** — Product gallery (WAS HIDDEN by wrong nth-of-type — FIXED)
6. **Follow Us @CarolinaFutons** — Instagram feed (was "#TERAHOME", repurposed)
7. **AS SEEN IN** — Fake template press logos → HIDDEN via CSS

### Collection Card Images — FIXED via documentServices API (2026-03-14)
The homepage "Shop By Collections" cards use hardcoded editor images, NOT the Wix Store category images. Setting category images via Dashboard only affects the store category pages, NOT the homepage cards.

**Template image prefix**: `c837a6_` (Furniture Store #3563 template)
**CF image prefix**: `e04e89_` (our uploaded product photos)

#### The Trick: documentServices API for Editor Image Replacement
Instead of clicking images in the editor UI (unreliable in headless — overlay intercepts clicks), use the documentServices API directly:

```javascript
// 1. Access documentServices from the preview-frame iframe
const previewFrame = document.querySelector('iframe[name="preview-frame"]');
const ds = previewFrame.contentWindow.documentServices;

// 2. Component refs use {id, type} format
const compRef = { id: 'comp-lybflhtt', type: 'DESKTOP' };

// 3. Get current data to see structure
const data = ds.components.data.get(compRef);
// Returns: { type: "ImageX", image: { uri, width, height, alt, name }, ... }

// 4. Update the image
ds.components.data.update(compRef, {
  image: {
    uri: 'e04e89_9234577e395e4eb180cb2c9bc936d65f~mv2.jpg',
    width: 600, height: 600,
    alt: 'Futon Frames',
    name: 'Futon Frames.jpg'
  }
});

// 5. Autosave picks up changes. Then click Publish.
```

#### Collection Card Component IDs (Homepage)
Each card has 2 image components (background + foreground):
- **FUTON FRAMES**: `comp-lybflhtt`, `comp-lybkelkb`
- **MURPHY CABINET BEDS**: `comp-lybfq8r6`, `comp-lybl1j9c`
- **PLATFORM BEDS**: `comp-lybfyt6e`, `comp-lybl3lqi`
- **MATTRESSES**: `comp-lybfyv4x`, `comp-lybl4sem`

#### Key documentServices Notes
- Available on `iframe[name="preview-frame"]` (index 1) and `iframe[name="preset-preview-frame"]` (index 0)
- Component types: `wixui.ImageX` for images
- Data structure: `{ type, id, metaData, image: { uri, width, height, alt, name }, scopedData, hasAnimation }`
- URI format: just the filename hash, e.g., `e04e89_xxx~mv2.jpg` (NOT full CDN URL)
- Also available: `ds.components.getType(ref)`, `ds.components.getChildren(ref)`, `ds.save`, `ds.publish`

### Editor Navigation
- Dashboard → "Edit Site" button → opens editor in new tab
- Editor URL: `editor.wix.com/studio/{documentId}?metaSiteId={metaSiteId}`
- Publish button is in top-right of editor toolbar
- After publish, "Congratulations" modal appears → click "Done"

### Screenshot Timeouts
- Full-page screenshots timeout on font loading (Wix loads many fonts)
- Workaround: Use `page.evaluate()` to audit DOM properties instead
- Viewport-only screenshots also sometimes timeout — retry or use evaluate
