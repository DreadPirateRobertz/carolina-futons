# Carolina Futons — Media Manifest

Every non-product image slot in the site. Product images (from Wix Stores
`product.mainMedia`) are already in `wix:image://` format and don't need
manual management.

**How to populate**: Upload the image to Wix Media Manager, copy the
`wix:image://v1/<fileId>/<filename>#originWidth=<w>&originHeight=<h>` URI,
and replace the matching constant in `src/public/placeholderImages.js`.

**Status key**: placeholder = needs real image | uploaded = live in Media Manager

---

## Hero Images

| Slot | Constant | Dimensions | Where Used | Status |
|------|----------|-----------|------------|--------|
| Homepage hero — mountain cabin scene | `HERO_CABIN_SCENE` | 1440x600 | Home page `#heroBg` | placeholder |
| Header ridgeline decoration | `HEADER_RIDGELINE` | 1440x120 | Every page (header background) | placeholder |

## Category Hero Images

Used as the background/hero image on each category page (`#categoryHeroImage`).
Falls back to CSS gradient if the image element doesn't exist.

| Slot | Constant | Dimensions | Category Page | Status |
|------|----------|-----------|---------------|--------|
| Futon Frames hero | `HERO_FUTON_FRAMES` | 1440x400 | /futon-frames | placeholder |
| Mattresses hero | `HERO_MATTRESSES` | 1440x400 | /mattresses | placeholder |
| Murphy Cabinet Beds hero | `HERO_MURPHY_BEDS` | 1440x400 | /murphy-cabinet-beds | placeholder |
| Platform Beds hero | `HERO_PLATFORM_BEDS` | 1440x400 | /platform-beds | placeholder |
| Casegoods & Accessories hero | `HERO_CASEGOODS` | 1440x400 | /casegoods-accessories | placeholder |
| Wall Hugger Frames hero | `HERO_WALL_HUGGERS` | 1440x400 | /wall-huggers | placeholder |
| Unfinished Wood hero | `HERO_UNFINISHED_WOOD` | 1440x400 | /unfinished-wood | placeholder |
| Sale & Clearance hero | `HERO_SALE` | 1440x400 | /sales | placeholder |

## Category Card Images (Homepage Showcase)

Displayed on the homepage category showcase grid. Each card shows a category
illustration/photo with the category name and tagline overlaid.

| Slot | Constant | Dimensions | Category | Status |
|------|----------|-----------|----------|--------|
| Futon Frames card | `CARD_FUTON_FRAMES` | 400x300 | futon-frames | placeholder |
| Mattresses card | `CARD_MATTRESSES` | 400x300 | mattresses | placeholder |
| Murphy Cabinet Beds card | `CARD_MURPHY_BEDS` | 400x300 | murphy-cabinet-beds | placeholder |
| Platform Beds card | `CARD_PLATFORM_BEDS` | 400x300 | platform-beds | placeholder |
| Casegoods & Accessories card | `CARD_CASEGOODS` | 400x300 | casegoods-accessories | placeholder |
| Sale & Clearance card | `CARD_SALE` | 400x300 | sales | placeholder |
| Wall Hugger Frames card | `CARD_WALL_HUGGERS` | 400x300 | wall-huggers | placeholder |
| Unfinished Wood card | `CARD_UNFINISHED_WOOD` | 400x300 | unfinished-wood | placeholder |

## About Page

| Slot | Constant | Dimensions | Where Used | Status |
|------|----------|-----------|------------|--------|
| Showroom photo | `ABOUT_SHOWROOM` | 800x600 | About page gallery | placeholder |
| Team photo | `ABOUT_TEAM` | 800x600 | About page gallery | placeholder |

## Contact Page

| Slot | Constant | Dimensions | Where Used | Status |
|------|----------|-----------|------------|--------|
| Illustrated map | `CONTACT_MAP_ILLUSTRATION` | 800x600 | Contact page map section | placeholder |

## Site-Wide / Decorative

| Slot | Constant | Dimensions | Where Used | Status |
|------|----------|-----------|------------|--------|
| Footer mountain accent | `FOOTER_MOUNTAIN_ACCENT` | 1440x80 | Footer decoration | placeholder |
| OG sharing image | `OG_DEFAULT_IMAGE` | 1200x630 | Open Graph default | placeholder |

---

## Wix Media API Image Transforms

When you need a resized/cropped variant of any image, use `getTransformedImageUrl()`
from `placeholderImages.js` or apply Wix Media transforms directly:

| Transform | URL Pattern | Example |
|-----------|------------|---------|
| Fill (crop to fit) | `/v1/fill/w_{w},h_{h},al_c,q_{q}/{filename}` | `w_400,h_400,al_c,q_80` |
| Fit (contain) | `/v1/fit/w_{w},h_{h}/{filename}` | `w_800,h_600` |
| Crop | `/v1/crop/w_{w},h_{h},x_{x},y_{y}/{filename}` | `w_300,h_300,x_50,y_0` |

**Parameters**:
- `w_` — width in pixels
- `h_` — height in pixels
- `al_c` — align center
- `q_` — JPEG quality (1-100, default 80)

## Illustration Asset Cross-Reference

Maps these slots to the assets in `ILLUSTRATION-ASSET-SPEC.md`:

| Asset # | Description | Maps To |
|---------|-------------|---------|
| Asset 1 | Mountain Ridgeline Header | `HEADER_RIDGELINE` |
| Asset 2 | Hero Cabin Scene | `HERO_CABIN_SCENE` |
| Asset 3 | Illustrated Map | `CONTACT_MAP_ILLUSTRATION` |
| Asset 4a | Category: Futon Frames | `CARD_FUTON_FRAMES` |
| Asset 4b | Category: Mattresses | `CARD_MATTRESSES` |
| Asset 4c | Category: Murphy Beds | `CARD_MURPHY_BEDS` |
| Asset 4d | Category: Platform Beds | `CARD_PLATFORM_BEDS` |
| Asset 4e | Category: Casegoods | `CARD_CASEGOODS` |
| Asset 4f | Category: Sale | `CARD_SALE` |
| — | Category: Wall Huggers | `CARD_WALL_HUGGERS` |
| — | Category: Unfinished Wood | `CARD_UNFINISHED_WOOD` |
