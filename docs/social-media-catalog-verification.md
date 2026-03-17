# Social Media Content Calendar — Catalog Verification Report

**Bead:** CF-lf0d
**Auditor:** radahn (cfutons/crew/radahn)
**Date:** 2026-03-16
**Reference Data:** `content/catalog-MASTER.json` (88 products), `content/about.json`

---

## Files Audited

| File | Lines |
|------|-------|
| CONTENT-CALENDAR-30DAY.md | 664 |
| FACEBOOK-POSTS-AND-EVENTS.md | 156 |
| INSTAGRAM-POST-COPY.md | 355 |
| PINTEREST-BOARDS-AND-PINS.md | 142 |
| TIKTOK-VIDEO-SCRIPTS.md | 83 |

---

## Verification Criteria Summary

| # | Criterion | Result |
|---|-----------|--------|
| 1 | All product names are real catalog products | PASS |
| 2 | All prices are current | WARN — 1 unverifiable price claim |
| 3 | All finish names are real | PASS |
| 4 | All category references match | FAIL — 1 critical misattribution |
| 5 | All image references point to valid CDN URLs | N/A — no CDN URLs in content |
| 6 | No fabricated manufacturer attributions | FAIL — 1 non-catalog manufacturer |

---

## CRITICAL FINDINGS

### FINDING 1: Monterey Frame Falsely Described as "Wall Hugger" (CRITICAL)

**Severity:** CRITICAL — Factually incorrect product feature claim
**Locations:**
- CONTENT-CALENDAR-30DAY.md line 92: "Wall hugger design saves 12–18 inches"
- FACEBOOK-POSTS-AND-EVENTS.md line 50: "Wall hugger design that saves 12–18 inches of floor space"
- INSTAGRAM-POST-COPY.md line 36: "Wall hugger design saves 12–18 inches"

**Catalog Reality:**
- Monterey Futon Frame → category: `futon-frames` (NOT `wall-hugger-frames`)
- Monterey description: "mission-style arms, evoking a clean and contemporary look" — zero mention of wall hugger
- Monterey swatches: Cherry, Chocolate, Dark Chocolate

**Actual wall-hugger frames in catalog:** Dillon ($642), Lambton ($778), Galena ($722), Pagoda ($737), Tozi ($656), Tiro ($782), Rockwell ($743), Durango ($704), Denali Log ($737), Canby ($737)

**Fix:** Either:
- (a) Remove "wall hugger" from Monterey descriptions, OR
- (b) Replace Monterey with a real wall-hugger frame (e.g., Dillon at $642 with Cherry, Natural, Black Walnut finishes)

---

### FINDING 2: Strata Furniture Referenced but Not in Catalog (HIGH)

**Severity:** HIGH — Manufacturer attribution with no catalog products
**Locations:**
- FACEBOOK-POSTS-AND-EVENTS.md line 26: "Handcrafted by Night & Day Furniture, KD Frames, and Strata Furniture"
- PINTEREST-BOARDS-AND-PINS.md line 8: "Handcrafted by Night & Day Furniture, KD Frames, and Strata"

**Catalog Reality:**
- catalog-MASTER.json manufacturers: KD Frames, Night & Day Furniture, Otis Bed, Sealy
- **Strata Furniture has ZERO products in catalog-MASTER.json**
- about.json mentions Strata Furniture (wall-hugger frames, zero-tolerance mechanism) — but they may be discontinued or not yet added to the catalog

**Fix:** Either:
- (a) Remove Strata from manufacturer lists until products are in catalog, OR
- (b) Replace with actual catalog manufacturers: "Night & Day Furniture, KD Frames, and Otis Bed", OR
- (c) Add Strata products to catalog-MASTER.json if they are still carried

---

## MODERATE FINDINGS

### FINDING 3: "$60 Cover" Price Claim Unverifiable (MODERATE)

**Severity:** MODERATE — Price claim with no matching catalog product
**Locations:**
- CONTENT-CALENDAR-30DAY.md line 197 (Day 8, Story 3): "Invest in a washable cover — it's the smartest $60 you'll spend"
- CONTENT-CALENDAR-30DAY.md line 206 (caption): "Better yet: use a washable cover. Best $60 you'll spend."
- INSTAGRAM-POST-COPY.md line 106: "Best $60 you'll spend."
- FACEBOOK-POSTS-AND-EVENTS.md line 109: "it's the smartest $60 you'll spend on your futon."

**Catalog Reality:**
- Nearest product: "Mattress Protector" at $89 (manufacturer: Night & Day Furniture)
- No product named "cover" or "washable cover" at $60 found in catalog-MASTER.json

**Fix:** Either:
- (a) Update price to match Mattress Protector ($89) if that's the intended product, OR
- (b) Verify that a $60 cover product exists outside catalog-MASTER.json and add it, OR
- (c) Remove specific price and say "invest in a washable cover"

---

## VERIFIED CLAIMS (PASS)

### Product Names
All specifically named products exist in catalog-MASTER.json:
- Monterey Futon Frame — EXISTS (category: futon-frames, mfr: Night & Day Furniture, $549)
- Otis Bed — EXISTS as manufacturer with multiple mattress products
- Murphy cabinet beds — EXISTS (Daisy, Clover, Poppy, Ranchero, Sagebrush, Orion, Murphy Cube, Murphy Express, San Sebastian)
- Platform beds — EXISTS (Black Pepper, Rosemary, Tamarind, Haley 110, Ekko, Paprika, Tarragon, Thyme, Nomad, Charleston, Nutmeg, Basic, Folding, Solstice)

### Finish Names
All 5 finishes referenced in Day 17/April 19 content exist as catalog swatches:
- Cherry — 48+ products
- Chocolate — 30+ products
- Natural — 32 products
- Black Walnut — 18 products
- Dark Chocolate — 15+ products

Monterey's 3 finishes (Cherry, Chocolate, Dark Chocolate) match catalog exactly.

### Category References
All referenced categories exist in catalog:
- futon-frames ✓ (17 products)
- wall-hugger-frames ✓ (10 products) — category exists, just misattributed to Monterey
- murphy-cabinet-beds ✓ (9 products)
- platform-beds ✓ (15 products)
- mattresses ✓ (category exists)

### Manufacturer Attributions (partial)
- Night & Day Furniture — EXISTS, 75+ products ✓
- KD Frames — EXISTS, 3 products (KD Lounger, Basic Platform Bed, Folding Platform Bed) ✓
- Otis Bed — EXISTS, 7 products ✓
- Sealy — EXISTS, 1 product (San Sebastian Sealy Cabinet Bed) ✓

### Company Claims
- "Since 1991" — Confirmed by about.json ✓
- "Hendersonville, NC" — Confirmed by about.json ✓
- "CertiPUR-US" for Otis Bed — Confirmed by about.json ✓
- "Rubberwood" for Night & Day — Confirmed by about.json ✓
- "Tulip Poplar" / "Athens GA" / "600lb" for KD Frames — Confirmed by about.json ✓

### Image References
No social media files contain specific CDN URLs or image file references. All image descriptions are conceptual ("hero shot", "infographic", "product grid"), requiring original photography/design. Catalog images use `https://static.wixstatic.com/media/` CDN — no conflicts.

---

## Generic Claims (Not Directly Verifiable from Catalog)

These claims appear throughout the content and are marketing assertions rather than catalog-verifiable facts:

| Claim | Frequency | Notes |
|-------|-----------|-------|
| "20+ year frame" durability | 15+ times | Marketing claim, no catalog field for lifespan |
| "8-inch minimum for sleeping" | 5+ times | about.json confirms "TRUE 8" for Otis; no thickness in catalog |
| "Free shipping over $999" | 6+ times | Business policy, not in catalog |
| "0% APR financing" | 3 times | Business policy, not in catalog |
| "Free swatch kit" | 3 times | Not a catalog product |
| "Free white-glove delivery" | 1 time | Business policy, not in catalog |

---

## Recommendations

1. **IMMEDIATE** — Fix Monterey "wall hugger" claims across 3 files (Calendar, Facebook, Instagram). Replace with accurate description or substitute a real wall-hugger frame.
2. **IMMEDIATE** — Remove or correct Strata Furniture manufacturer references in Facebook and Pinterest until catalog has Strata products.
3. **MODERATE** — Verify $60 cover price or remove specific dollar amount from 4 locations.
4. **OPTIONAL** — Consider adding Strata Furniture products to catalog-MASTER.json if they are still in inventory.
