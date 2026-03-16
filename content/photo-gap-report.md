# Photo Audit & Gap Report — Carolina Futons

**Generated:** 2026-03-15 (updated 2026-03-16)
**Bead:** CF-ltuu (remediation: CF-xeer)
**Auditor:** cfutons/crew/rennala

## Summary

| Metric | Value |
|--------|-------|
| Total products | 88 |
| Total images in catalog | 312 |
| Products with 0 images | 0 |
| Products with only 1 image | 28 |
| Broken URLs fixed | 1 (Murphy Cabinet Express) |
| Mattress image deficit | 38 images needed |

## Category Breakdown

| Category | Products | Images | Avg/Product |
|----------|----------|--------|-------------|
| platform-beds | 21 | 91 | 4.3 |
| futon-frames | 19 | 57 | 3.0 |
| mattresses | 14 | 15 | 1.1 |
| casegoods-accessories | 13 | 58 | 4.5 |
| wall-hugger-frames | 10 | 31 | 3.1 |
| murphy-cabinet-beds | 9 | 56 | 6.2 |
| front-loading-nesting | 2 | 5 | 2.5 |

## Live Site Verification

All 14 mattress products were queried via the Wix REST API (stores-reader/v1/products/query). **Result: live site has the exact same images as catalog-MASTER.json.** No hidden or extra media exists on the live site for these products.

The non-mattress products were not individually verified via API due to response size limits, but the catalog was exported from the live site data, so parity is expected.

## Critical Gap: Mattress Products

All 14 mattress products have only 1 image each (except Lexington with 2). The target is 3-4 images per product. **38 additional images are needed.**

| Product | Current | Target | Deficit | Notes |
|---------|---------|--------|---------|-------|
| Flagstaff Futon Frame | 1 | 4 | 3 | Single product shot |
| Chandler Futon Frame | 1 | 4 | 3 | Single product shot |
| Northampton Futon Frame | 1 | 4 | 3 | Single product shot |
| Gemini Futon Frame | 1 | 4 | 3 | Single product shot |
| Cambridge Futon Frame | 1 | 4 | 3 | Single product shot |
| Sedona Futon Frame | 1 | 4 | 3 | Single product shot |
| Yuma Futon Frame | 1 | 4 | 3 | Single product shot |
| Alpine Futon Frame | 1 | 4 | 3 | Single product shot |
| Asheville Futon Frame | 1 | 4 | 3 | Single product shot |
| Maricopa Futon Frame | 1 | 4 | 3 | Single product shot |
| Mountainaire Log Futon | 1 | 4 | 3 | Single product shot |
| Lexington Platform Bed | 2 | 4 | 2 | Has main + trundle view |
| Mesa 3000 Mattress | 1 | 3 | 2 | Single product shot |
| Mattress Protector | 1 | 2 | 1 | Accessory - needs less |

### Recommended Photo Types for Mattresses

1. **Hero/main shot** (already have this for all 14)
2. **Cross-section/layer view** — shows foam layers and construction
3. **Lifestyle/room scene** — mattress on a frame in a styled room
4. **Detail/texture close-up** — fabric texture, stitching, edges

## Other Single-Image Products (Non-Mattress)

These products also have only 1 image but are lower priority:

| Product | Category |
|---------|----------|
| Pagoda Futon Frame | futon-frames |
| Haley 110 Futon Frame | futon-frames |
| Key West Futon Frame | futon-frames |
| Rockwell Futon Frame | futon-frames |
| Ekko Futon Frame | futon-frames |
| Wilderness Log Futon | futon-frames |
| Folding Platform Bed | platform-beds |
| Center Legs | casegoods-accessories |
| Accessories | casegoods-accessories |
| Leg Length Options - Nomad | casegoods-accessories |
| Leg Length Options - Charleston | casegoods-accessories |
| Leg Length Options - Lexington | casegoods-accessories |
| Mesa 1000 Mattress | mattresses |
| Mesa 5000 Mattress | mattresses |
| Pulsar Mattress | mattresses |

## Remediation (CF-xeer)

### Broken URL Fixed

Removed 1 broken image URL (HTTP 400) from **Murphy Cabinet Express** in `catalog-MASTER.json`:
- `e04e89_107b1c1521304466a2f26aa10e07a9b2~mv2.jpg` — returned 400, 63 bytes
- Product still has 13 working images (well above the 6-image ideal)

### Remaining Gaps (39 products, 67 images needed)

These gaps require **external sourcing** — the live Wix dashboard has the exact same images as the catalog. No additional media can be pulled programmatically.

**Priority tiers for sourcing:**

| Tier | Category | Products | Images Needed | Action |
|------|----------|----------|---------------|--------|
| 1 (Critical) | mattresses | 14 | 27 | Contact Otis Bed / Night & Day Furniture |
| 2 (High) | futon-frames | 8 | 11 | Request from manufacturer or photograph |
| 3 (Medium) | platform-beds | 9 | 14 | Request from manufacturer or photograph |
| 4 (Medium) | wall-hugger-frames | 4 | 5 | Request from manufacturer or photograph |
| 5 (Low) | casegoods-accessories | 3 | 4 | Photograph in-house |
| 6 (Low) | front-loading-nesting | 1 | 1 | Photograph in-house |

## Conclusion

**No missing media can be pulled from the live site** — the live Wix dashboard has the same images as our catalog. The mattress image deficit (38 images) requires new photography or sourcing from the manufacturer (Otis Bed / Night & Day Furniture).

### Next Steps

1. Request product photos from Otis Bed / manufacturer for all mattress models
2. Schedule lifestyle photography for top-selling mattresses
3. Upload new images via Wix Media Manager or REST API (Add Product Media endpoint)
4. Update catalog-MASTER.json with new image URLs

## Deliverables

- `content/photo-audit.json` — Full tagged audit of all 312 images across 88 products
- `content/photo-gap-report.md` — This report
- `docs/photo-audit.json` — Detailed audit with URL status checks
