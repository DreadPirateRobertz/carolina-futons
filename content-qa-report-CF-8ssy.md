# Content QA Report — CF-8ssy

**Date**: 2026-03-16
**Auditor**: cfutons/crew/miquella
**Scope**: All v0.10.0 campaign content vs catalog-MASTER.json and about.json

## Executive Summary

| Content Area | Files | Pass | Fail | Critical Issues |
|---|---|---|---|---|
| Newsletters | 12 | 3 | 9 | Fabricated products, wrong prices |
| Social Media | 10 | 7 | 3 | Wrong finish count on Monterey |
| Press Materials | 3 | 1 | 2 | Unsubstantiated claims, misleading pitch |
| Blog Content | 14 | 5 | 9 | Fabricated product, wrong finishes/warranty |
| **TOTAL** | **39** | **16** | **23** | |

---

## HIGH Severity Issues (must fix before publish)

### 1. Fabricated Product Names
Products referenced in content that DO NOT exist in catalog-MASTER.json:

| Fabricated Name | Files Affected | Notes |
|---|---|---|
| **"Seattle" frame** | welcome-02, education-01 | No such product exists |
| **"Moonshadow" mattress** | welcome-02, seasonal-01, seasonal-02 | No such Otis product |
| **"Portland" frame** | futon-frame-buying-guide.md, blogContent.js | No KD Frames product by this name |

### 2. Wrong Prices
| Claim | Actual | Files |
|---|---|---|
| Murphy beds "from $1,299" | Cheapest is Orion at **$1,399** | education-02, seasonal-01 |
| Otis mattresses "$250-500" | Actual range **$709-$859** | education-03 |

### 3. Wrong Manufacturer Attribution
| Claim | Actual | Files |
|---|---|---|
| "Otis Haley 8"" mattress | Haley 110 is **Night & Day Furniture**, not Otis | seasonal-02 |
| "Eureka Wall Hugger" | Eureka is **futon-frames** category, not wall-hugger | welcome-02 |

---

## MEDIUM Severity Issues (should fix)

### 4. Monterey Finish Count (propagated across 3 social media files)
- **Claimed**: 5 finishes (Cherry, Chocolate, Natural, Black Walnut, Dark Chocolate)
- **Actual catalog**: 3 finishes (Cherry, Chocolate, Dark Chocolate)
- **Files**: CONTENT-CALENDAR-30DAY.md, FACEBOOK-POSTS-AND-EVENTS.md, INSTAGRAM-POST-COPY.md

### 5. Fabricated Finish Names in Blog Content
- **"Honey oak"** and **"dark espresso"** do not exist in catalog
- **"Rosewood"** does not exist in catalog (newsletter)
- **Files**: futon-frame-buying-guide.md, futon-vs-sofa-bed.md, platform-bed-guide.md, education-04

### 6. Wrong Warranty Attribution (Blog)
- Blog says Night & Day has a "5-year structural warranty"
- Actual: Night & Day has **10-year cabinet / 3-year mattress** warranty; **KD Frames** has 5-year
- **Files**: futon-frame-buying-guide.md, blogContent.js

### 7. "Organic Cotton" Claims (Press)
- Press release template and media research reference "organic cotton covers"
- **Not supported** by about.json or catalog-MASTER.json
- **Files**: press-release-template.md, media-research.json

### 8. Press Template Omits Major Categories
- About boilerplate says "specializing in futon frames, mattresses, and covers"
- Omits murphy cabinet beds, platform beds, casegoods (all major categories)
- **Files**: press-release-template.md

### 9. "Made-in-USA Futon Frames" Pitch Angle (Press)
- KD Frames is USA-made but makes **platform beds**, not futon frames
- Night & Day makes futon frames but uses **Malaysian rubberwood** (not USA)
- **Files**: media-research.json

### 10. "Strata" Collection Reference (Newsletter)
- reengagement-02 references "Strata Wall Hugger Collection"
- No products in catalog have manufacturer "Strata Furniture" — all wall-huggers are listed as Night & Day
- **Files**: reengagement-02-whats-new.html

### 11. "Arason" Manufacturer (Blog)
- small-space-furniture-guide.md references "Arason" cabinet beds
- No "Arason" manufacturer in catalog
- **Files**: small-space-furniture-guide.md, blogContent.js

---

## LOW Severity Issues

### 12. Promo Code Typo
- "COMBACK10" should be "COMEBACK10" (missing 'E')
- **File**: reengagement-01-miss-you.html

### 13. Instagram Section Header Mislabel
- April 16 header says "Care Tip: Sunlight" but body is about vacuuming
- **File**: INSTAGRAM-POST-COPY.md

### 14. Template Placeholders (Expected)
- press-release-template.md has `[year]`, `[address]`, `[phone]` brackets — normal for templates

---

## Clean Areas (No Issues Found)

- **Newsletter**: welcome-01, welcome-03, campaign plan
- **Social Media**: Pinterest, TikTok, all 4 social stories files
- **Press**: media-contacts.json (real publications, no fabricated contacts)
- **Blog Code**: blogHelpers.js, blogService.web.js, HomeBlogTeasers.js, blog-posts-full.json
- **Company Details**: Name, location, tagline consistently correct across all files
- **URLs**: All carolinafutons.com references are correct

---

## Recommendations

1. **Immediate**: Replace all fabricated product names (Seattle, Moonshadow, Portland) with real catalog products
2. **Immediate**: Fix all incorrect prices (Murphy $1,299→$1,399, Otis range)
3. **Immediate**: Fix manufacturer attributions (Haley=N&D not Otis, Eureka=futon not wall-hugger)
4. **Before publish**: Correct Monterey finish count across social media files
5. **Before publish**: Replace fabricated finish names (honey oak, dark espresso, rosewood) with real catalog finishes
6. **Before publish**: Fix warranty attribution in blog (5-year = KD Frames, not N&D)
7. **Before publish**: Remove/verify organic cotton claims in press materials
8. **Before publish**: Update press template About section to include all product categories
9. **Minor**: Fix COMBACK10 typo, Instagram header mislabel
