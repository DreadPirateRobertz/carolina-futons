# Product Image Audit — Carolina Futons

> Generated: 2026-03-09 by rennala
> Source: `content/catalog-MASTER.json` (88 products, 313 images)
> Target: `src/backend/mediaGallery.web.js` CATEGORY_FOLDERS

---

## Summary

| Metric | Value |
|--------|-------|
| Total products | 88 |
| Total images | 313 |
| Products with no images | 0 |
| All URLs on wixstatic.com | Yes |
| Duplicate image URLs | 2 |
| Avg images per product | 3.6 |

---

## Coverage by Category

| Category | Products | Images | Avg/Product | Media Folder |
|----------|----------|--------|-------------|-------------|
| futon-frames | 19 | 57 | 3.0 | `/products/futon-frames` |
| wall-hugger-frames | 10 | 31 | 3.1 | **MISSING** — needs `/products/wall-hugger-frames` |
| platform-beds | 21 | 91 | 4.3 | `/products/platform-beds` |
| casegoods-accessories | 13 | 58 | 4.5 | `/products/casegoods-accessories` |
| front-loading-nesting | 2 | 5 | 2.5 | **MISSING** — needs `/products/front-loading-nesting` |
| mattresses | 14 | 15 | 1.1 | `/products/mattresses` |
| murphy-cabinet-beds | 9 | 56 | 6.2 | `/products/murphy-cabinet-beds` |

---

## Issues Found

### 1. Missing CATEGORY_FOLDERS entries in mediaGallery.web.js

`CATEGORY_FOLDERS` (line 47) is missing two categories present in the catalog:

```
'wall-hugger-frames': '/products/wall-hugger-frames',
'front-loading-nesting': '/products/front-loading-nesting',
```

**Impact**: Products in these categories won't resolve media folder paths. `getProductMedia()` and `getCategoryThumbnails()` will skip them.

### 2. Empty folder mappings (no products in catalog)

These folders are mapped in `mediaGallery.web.js` but have 0 products in `catalog-MASTER.json`:

| Folder | Mapped Category |
|--------|----------------|
| `/products/outdoor-furniture` | outdoor-furniture |
| `/products/covers` | covers |
| `/products/pillows` | pillows-702 |
| `/products/log-frames` | log-frames (not mapped) |

These may be future categories or legacy. No action needed unless cleanup desired.

### 3. Category name inconsistency: wall-huggers vs wall-hugger-frames

- `catalogContent.web.js` VALID_CATEGORIES: uses `wall-huggers`
- `catalogImport.web.js` VALID_CATEGORIES: uses both `wall-huggers` AND `wall-hugger-frames`
- `catalog-MASTER.json` products: uses `wall-hugger-frames`
- `mediaGallery.web.js` CATEGORY_FOLDERS: has NEITHER

**Recommendation**: Standardize on `wall-hugger-frames` (matches catalog data) and add to all VALID_CATEGORIES lists + CATEGORY_FOLDERS.

### 4. Duplicate images (shared across products)

| Image URL (truncated) | Products |
|----------------------|----------|
| `e04e89_9a63b94b19a2...` | rosemary, solstice-1 |
| `e04e89_6f77fe2498b3...` | lexington-1, twin-trundle-bed |

These may be intentional (same photo used for similar products) or data errors. Low priority.

### 5. Low image count: mattresses (1.1 avg)

Mattresses average only 1.1 images per product vs 4.3-6.2 for other categories. May need additional photography.

---

## CATEGORY_FOLDERS vs VALID_CATEGORIES Cross-Reference

| Category Slug | catalog-MASTER | mediaGallery FOLDERS | catalogImport VALID | catalogContent VALID |
|--------------|:-:|:-:|:-:|:-:|
| futon-frames | 19 | Yes | Yes | Yes |
| wall-hugger-frames | 10 | **No** | Yes | **No** (uses wall-huggers) |
| platform-beds | 21 | Yes | Yes | Yes |
| casegoods-accessories | 13 | Yes | Yes | Yes |
| front-loading-nesting | 2 | **No** | Yes | Yes |
| mattresses | 14 | Yes | Yes | Yes |
| murphy-cabinet-beds | 9 | Yes | Yes | Yes |
| outdoor-furniture | 0 | Yes | Yes | Yes |
| covers | 0 | Yes | Yes | Yes |
| pillows-702 | 0 | Yes (as pillows) | Yes | Yes (as pillows) |
| log-frames | 0 | **No** | Yes | Yes |
| unfinished-wood | 0 | **No** | Yes | Yes |
| wall-huggers | 0 | **No** | Yes | Yes |

---

## Required Fixes

### Fix 1: Add missing CATEGORY_FOLDERS to mediaGallery.web.js (line 47)

```js
const CATEGORY_FOLDERS = {
  'futon-frames': '/products/futon-frames',
  'mattresses': '/products/mattresses',
  'murphy-cabinet-beds': '/products/murphy-cabinet-beds',
  'platform-beds': '/products/platform-beds',
  'outdoor-furniture': '/products/outdoor-furniture',
  'casegoods-accessories': '/products/casegoods-accessories',
  'covers': '/products/covers',
  'pillows-702': '/products/pillows',
  // ADD THESE:
  'wall-hugger-frames': '/products/wall-hugger-frames',
  'front-loading-nesting': '/products/front-loading-nesting',
  'log-frames': '/products/log-frames',
  'unfinished-wood': '/products/unfinished-wood',
};
```

### Fix 2: Standardize wall-hugger category name

In `catalogContent.web.js` and `productVideos.web.js`, add `wall-hugger-frames` to VALID_CATEGORIES alongside existing `wall-huggers`.

### Fix 3: Create Media Manager folders

In Wix Media Manager, create these folders:
- `/products/wall-hugger-frames/`
- `/products/front-loading-nesting/`
- `/products/log-frames/`
- `/products/unfinished-wood/`

---

## Full manifest

See `docs/product-image-manifest.json` for the complete per-product image inventory.
