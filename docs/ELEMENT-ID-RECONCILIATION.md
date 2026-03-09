# Element ID Reconciliation Report

**Bead:** CF-nl57
**Date:** 2026-03-08
**Author:** rennala (code analysis only — no browser)
**Branch:** `cf-nl57-element-id-audit`

---

## Summary

| Metric | Count |
|--------|-------|
| Unique IDs in code (`src/pages/*.js` + `src/public/*.js`) | 1,572 |
| Unique IDs in BUILD-SPECs (8 files) | 1,026 |
| Matched (in both code and spec) | 865 |
| Code-only (no spec coverage) | 707 |
| Spec-only (not yet in code) | 161 |
| Spec IDs covered by dynamic templates | ~51 |
| **Truly missing from code** | **~110** |

**Coverage:** 84% of spec IDs are implemented in code (865 + 51 dynamic = 916 of 1,026).

---

## BUILD-SPEC Files Analyzed

1. `WIX-STUDIO-BUILD-SPEC.md` — Master page, Home, Product Page, Category, Cart, Side Cart, Checkout, Thank You, Member Page, Privacy/Terms, Product Videos, Search Results (~576 IDs)
2. `docs/CATEGORY-PAGE-BUILD-SPEC.md` (~60 IDs)
3. `docs/CART-CHECKOUT-BUILD-SPEC.md` (~80 IDs)
4. `ABOUT-PAGE-BUILD-SPEC.md` (~35 IDs)
5. `CONTACT-PAGE-BUILD-SPEC.md` (~47 IDs)
6. `FAQ-PAGE-BUILD-SPEC.md` (~11 IDs)
7. `docs/BLOG-GUIDES-BUILD-SPEC.md` (~34 IDs)
8. `docs/PAGES-BUILD-SPEC-BATCH2.md` (~20 IDs)

## Code Files Analyzed

- 39 page files in `src/pages/*.js`
- 75 public helper files in `src/public/*.js`
- ID extraction via `$w('#id')` and `$item('#id')` patterns
- Dynamic template literals (e.g., `$w(\`#ratingBar${star}\`)`) expanded to concrete IDs

---

## Spec IDs Missing from Code (~110)

These spec IDs have no corresponding `$w()` or `$item()` reference in any code file. Grouped by functional area.

### Navigation & Skip Links
| ID | Spec File |
|----|-----------|
| `#navHome` | WIX-STUDIO-BUILD-SPEC.md |
| `#navAbout` | WIX-STUDIO-BUILD-SPEC.md |
| `#navBlog` | WIX-STUDIO-BUILD-SPEC.md |
| `#navContact` | WIX-STUDIO-BUILD-SPEC.md |
| `#navFAQ` | WIX-STUDIO-BUILD-SPEC.md |
| `#navGettingItHome` | WIX-STUDIO-BUILD-SPEC.md |
| `#navProductVideos` | WIX-STUDIO-BUILD-SPEC.md |
| `#navSale` | WIX-STUDIO-BUILD-SPEC.md |
| `#skipToContent` | WIX-STUDIO-BUILD-SPEC.md |
| `#mainContent` | WIX-STUDIO-BUILD-SPEC.md |

### Home Page — Category Showcase
| ID | Spec File |
|----|-----------|
| `#categoryCasegoods` | WIX-STUDIO-BUILD-SPEC.md |
| `#categoryFutonFrames` | WIX-STUDIO-BUILD-SPEC.md |
| `#categoryMattresses` | WIX-STUDIO-BUILD-SPEC.md |
| `#categoryMurphy` | WIX-STUDIO-BUILD-SPEC.md |
| `#categoryPlatformBeds` | WIX-STUDIO-BUILD-SPEC.md |
| `#categorySale` | WIX-STUDIO-BUILD-SPEC.md |
| `#categoryUnfinished` | WIX-STUDIO-BUILD-SPEC.md |
| `#categoryWallHuggers` | WIX-STUDIO-BUILD-SPEC.md |
| `#scrollToCategories` | WIX-STUDIO-BUILD-SPEC.md |
| `#scrollToFeatured` | WIX-STUDIO-BUILD-SPEC.md |
| `#scrollToReviews` | WIX-STUDIO-BUILD-SPEC.md |
| `#scrollToSale` | WIX-STUDIO-BUILD-SPEC.md |

### Home Page — Trust Bar
| ID | Spec File |
|----|-----------|
| `#trustItem1`–`#trustItem5` | WIX-STUDIO-BUILD-SPEC.md |
| `#trustIcon1`–`#trustIcon5` | WIX-STUDIO-BUILD-SPEC.md |
| `#trustText1`–`#trustText5` | WIX-STUDIO-BUILD-SPEC.md |

### Product Page — Info Accordion Arrows
| ID | Spec File |
|----|-----------|
| `#infoArrowCare` | WIX-STUDIO-BUILD-SPEC.md |
| `#infoArrowDescription` | WIX-STUDIO-BUILD-SPEC.md |
| `#infoArrowDimensions` | WIX-STUDIO-BUILD-SPEC.md |
| `#infoArrowShipping` | WIX-STUDIO-BUILD-SPEC.md |
| `#infoContentCare` | WIX-STUDIO-BUILD-SPEC.md |
| `#infoContentDescription` | WIX-STUDIO-BUILD-SPEC.md |
| `#infoContentDimensions` | WIX-STUDIO-BUILD-SPEC.md |
| `#infoHeaderCare` | WIX-STUDIO-BUILD-SPEC.md |
| `#infoHeaderDescription` | WIX-STUDIO-BUILD-SPEC.md |
| `#infoHeaderDimensions` | WIX-STUDIO-BUILD-SPEC.md |
| `#infoHeaderShipping` | WIX-STUDIO-BUILD-SPEC.md |

### Product Page — Swatches & Search Swatches
| ID | Spec File |
|----|-----------|
| `#swatchDot1`–`#swatchDot4` | WIX-STUDIO-BUILD-SPEC.md |
| `#searchSwatchDot1`–`#searchSwatchDot4` | WIX-STUDIO-BUILD-SPEC.md |

### Product Page — Compare (Columns 1 & 4)
| ID | Spec File |
|----|-----------|
| `#compareCol1`, `#compareCol4` | WIX-STUDIO-BUILD-SPEC.md |
| `#compareImage1`, `#compareImage4` | WIX-STUDIO-BUILD-SPEC.md |
| `#compareName1`, `#compareName4` | WIX-STUDIO-BUILD-SPEC.md |
| `#comparePrice1`, `#comparePrice4` | WIX-STUDIO-BUILD-SPEC.md |
| `#compareBadge1`, `#compareBadge4` | WIX-STUDIO-BUILD-SPEC.md |
| `#removeProduct1`, `#removeProduct4` | WIX-STUDIO-BUILD-SPEC.md |
| `#rowCell1`, `#rowCell4` | WIX-STUDIO-BUILD-SPEC.md |
| `#winnerBadge1`, `#winnerBadge4` | WIX-STUDIO-BUILD-SPEC.md |

### Product Page — Video Filters & Thumbs
| ID | Spec File |
|----|-----------|
| `#videoFilterAll` | WIX-STUDIO-BUILD-SPEC.md |
| `#videoFilterFutons` | WIX-STUDIO-BUILD-SPEC.md |
| `#videoFilterMurphy` | WIX-STUDIO-BUILD-SPEC.md |
| `#videoFilterPlatform` | WIX-STUDIO-BUILD-SPEC.md |
| `#videoThumb1`–`#videoThumb3` | WIX-STUDIO-BUILD-SPEC.md |

### Product Page — Reviews (Stars)
| ID | Spec File |
|----|-----------|
| `#reviewStars` | WIX-STUDIO-BUILD-SPEC.md |
| `#reviewsStars` | WIX-STUDIO-BUILD-SPEC.md |
| `#recentRepeater` | WIX-STUDIO-BUILD-SPEC.md |

### Side Cart — Suggestions
| ID | Spec File |
|----|-----------|
| `#sideSugRepeater` | WIX-STUDIO-BUILD-SPEC.md |
| `#sideSugImage` | WIX-STUDIO-BUILD-SPEC.md |
| `#sideSugName` | WIX-STUDIO-BUILD-SPEC.md |
| `#sideSugPrice` | WIX-STUDIO-BUILD-SPEC.md |
| `#sideSugLabel` | WIX-STUDIO-BUILD-SPEC.md |
| `#sideSugAdd` | WIX-STUDIO-BUILD-SPEC.md |
| `#suggestionsHeading` | WIX-STUDIO-BUILD-SPEC.md |
| `#sugAddBtn` | WIX-STUDIO-BUILD-SPEC.md |

### Checkout — Address Errors
| ID | Spec File |
|----|-----------|
| `#addressFullNameError` | WIX-STUDIO-BUILD-SPEC.md |
| `#addressLine1Error` | WIX-STUDIO-BUILD-SPEC.md |
| `#addressCityError` | WIX-STUDIO-BUILD-SPEC.md |
| `#addressStateError` | WIX-STUDIO-BUILD-SPEC.md |
| `#addressZipError` | WIX-STUDIO-BUILD-SPEC.md |

### Checkout — Financing Details
| ID | Spec File |
|----|-----------|
| `#detailTerm` | WIX-STUDIO-BUILD-SPEC.md |
| `#detailTotal` | WIX-STUDIO-BUILD-SPEC.md |

### Checkout — Steps & Timeline
| ID | Spec File |
|----|-----------|
| `#step1`–`#step4` | WIX-STUDIO-BUILD-SPEC.md |
| `#timelineDot0`–`#timelineDot4` | WIX-STUDIO-BUILD-SPEC.md |
| `#timelineLabel0`–`#timelineLabel4` | WIX-STUDIO-BUILD-SPEC.md |
| `#timelineStep0`–`#timelineStep4` | WIX-STUDIO-BUILD-SPEC.md |

### Member Page
| ID | Spec File |
|----|-----------|
| `#accountSettings` | WIX-STUDIO-BUILD-SPEC.md |
| `#dashQuickOrders` | WIX-STUDIO-BUILD-SPEC.md |
| `#dashQuickSettings` | WIX-STUDIO-BUILD-SPEC.md |
| `#dashQuickWishlist` | WIX-STUDIO-BUILD-SPEC.md |
| `#prefBackInStock` | WIX-STUDIO-BUILD-SPEC.md |
| `#prefNewsletter` | WIX-STUDIO-BUILD-SPEC.md |
| `#prefSaleAlerts` | WIX-STUDIO-BUILD-SPEC.md |

### Footer — Social Links
| ID | Spec File |
|----|-----------|
| `#socialFacebook` | WIX-STUDIO-BUILD-SPEC.md |
| `#socialInstagram` | WIX-STUDIO-BUILD-SPEC.md |
| `#socialPinterest` | WIX-STUDIO-BUILD-SPEC.md |
| `#nlFacebookBtn` | WIX-STUDIO-BUILD-SPEC.md |
| `#nlInstagramBtn` | WIX-STUDIO-BUILD-SPEC.md |
| `#nlPinterestBtn` | WIX-STUDIO-BUILD-SPEC.md |

### Exit Intent Popup
| ID | Spec File |
|----|-----------|
| `#exitClose` | WIX-STUDIO-BUILD-SPEC.md |

### Privacy & Terms Sections
| ID | Spec File |
|----|-----------|
| `#policyCollect`, `#policyContact`, `#policyRights`, `#policySharing`, `#policyUse` | WIX-STUDIO-BUILD-SPEC.md |
| `#termsAcceptance`, `#termsContact`, `#termsLiability`, `#termsOrders`, `#termsProducts`, `#termsReturns`, `#termsShipping`, `#termsWarranties` | WIX-STUDIO-BUILD-SPEC.md |

### FAQ Page
| ID | Spec File |
|----|-----------|
| `#faqMetaHtml` | WIX-STUDIO-BUILD-SPEC.md |
| `#faqSchemaHtml` | WIX-STUDIO-BUILD-SPEC.md |

### Contact Page
| ID | Spec File |
|----|-----------|
| `#contactEmailError` | WIX-STUDIO-BUILD-SPEC.md, CONTACT-PAGE-BUILD-SPEC.md |
| `#contactMessageError` | WIX-STUDIO-BUILD-SPEC.md, CONTACT-PAGE-BUILD-SPEC.md |
| `#contactNameError` | WIX-STUDIO-BUILD-SPEC.md, CONTACT-PAGE-BUILD-SPEC.md |
| `#contactPhoneError` | WIX-STUDIO-BUILD-SPEC.md, CONTACT-PAGE-BUILD-SPEC.md |
| `#contactHeroSkyline` | CONTACT-PAGE-BUILD-SPEC.md |
| `#contactShowroomScene` | CONTACT-PAGE-BUILD-SPEC.md |

---

## Dynamic Template Literal Patterns

These 18 code patterns generate IDs dynamically, covering ~51 spec IDs that appear "missing" in a static grep:

| Pattern | Expands To | File |
|---------|-----------|------|
| `` `#ratingBar${star}` `` | `#ratingBar1`–`#ratingBar5` | ProductReviews.js |
| `` `#ratingCount${star}` `` | `#ratingCount1`–`#ratingCount5` | ProductReviews.js |
| `` `#compareCol${i}` `` | `#compareCol2`–`#compareCol3` | Category Page.js |
| `` `#compareImage${i}` `` | `#compareImage2`–`#compareImage3` | Category Page.js |
| `` `#compareName${i}` `` | `#compareName2`–`#compareName3` | Category Page.js |
| `` `#comparePrice${i}` `` | `#comparePrice2`–`#comparePrice3` | Category Page.js |
| `` `#compareBadge${i}` `` | `#compareBadge2`–`#compareBadge3` | Category Page.js |
| `` `#removeProduct${i}` `` | `#removeProduct2`–`#removeProduct3` | Category Page.js |
| `` `#rowCell${i}` `` | `#rowCell2`–`#rowCell3` | Category Page.js |
| `` `#winnerBadge${i}` `` | `#winnerBadge2`–`#winnerBadge3` | Category Page.js |
| `` `#swatchDot${i}` `` | (product page swatches) | Product Page.js |
| `` `#searchSwatchDot${i}` `` | (search result swatches) | Search Results page |
| `` `#videoThumb${i}` `` | (video thumbnails) | Product Videos page |
| `` `#step${i}` `` | (checkout steps) | Checkout.js |
| `` `#timelineDot${i}` `` | (checkout timeline) | Checkout.js |
| `` `#timelineLabel${i}` `` | (checkout timeline) | Checkout.js |
| `` `#timelineStep${i}` `` | (checkout timeline) | Checkout.js |
| `` `#galleryThumb${i}` `` | (product gallery thumbnails) | ProductGallery.js |

**Note:** Dynamic templates cover indices 2–3 for compare columns but spec defines 1–4. Indices 1 and 4 are truly missing from code.

---

## Code-Only IDs (707 — No Spec Coverage)

These IDs exist in code but have no corresponding BUILD-SPEC entry. Top contributors by page/module:

| Page/Module | Count | Examples |
|-------------|-------|---------|
| Buying Guide | ~40 | `#tocContainer`, `#sectionRepeater`, `#breadcrumbRepeater` |
| ProductSizeGuide | ~38 | `#dimensionGrid`, `#roomFitTitle`, `#sizeCompareSection` |
| Assembly Guides | ~34 | `#detailSteps`, `#careTipsRepeater`, `#detailVideo` |
| Price Match Guarantee | ~32 | `#pmFormSection`, `#pmSubmitBtn`, `#pmRequestsRepeater` |
| Financing | ~30 | `#providerRepeater`, `#calculateBtn`, `#resultsSection` |
| Store Locator | ~30 | `#storeMapHtml`, `#amenitiesRepeater`, `#cityDirections` |
| CustomizationBuilder | ~30 | `#custSwatchGrid`, `#custPreviewImage`, `#custSaveBtn` |
| Member Page | ~29 | `#ordersRepeater`, `#rewardsSection`, `#tierComparisonRepeater` |
| Referral Page | ~29 | `#referralCodeText`, `#referralHistoryRepeater`, `#statTotalEarned` |
| Sustainability | ~27 | `#carbonOffsetSection`, `#badgesRepeater`, `#tradeInHeading` |
| LiveChat | ~20 | `#chatWidget`, `#chatMessageInput`, `#chatStatusIndicator` |
| ProductReviews | ~18 | `#reviewCard`, `#reviewPhotoUpload`, `#reviewSchemaMarkup` |
| Blog/Blog Post | ~18 | `#blogGridRepeater`, `#authorBioSection`, `#relatedPostsRepeater` |
| Room Planner | ~15 | `#plannerCanvas`, `#roomPresetsRepeater`, `#saveLayoutBtn` |
| UGC Gallery | ~15 | `#ugcSection`, `#ugcSortDropdown`, `#ugcVoteButton` |
| ReturnsPortal | ~15 | `#returnItemsRepeater`, `#returnOrderDropdown`, `#submitReturnBtn` |
| FooterSection | ~10 | `#siteFooter`, `#badgeIcon`, `#socialIcon` |
| Other modules | ~100+ | Various smaller modules |

### Recommendation

These 707 code-only IDs represent pages/features that have been built ahead of their BUILD-SPECs. New BUILD-SPEC files should be created for:
- Buying Guide / Buying Guides
- Assembly Guides
- Price Match Guarantee
- Financing
- Store Locator
- Customization Builder
- Member Page (expansion beyond current spec)
- Referral Page
- Sustainability
- Room Planner
- UGC Gallery
- Returns Portal
- Blog / Blog Post (expansion beyond current spec)
- Live Chat

---

## Recommendations

1. **Priority: Wire the 110 truly missing spec IDs.** These are specified but not yet referenced in code. Most critical: navigation links, trust bar, skip-to-content (a11y), and address validation errors (checkout).

2. **Expand dynamic templates for compare columns.** Code generates indices 2–3 but spec defines 1–4. Either extend the loop range or add explicit references for indices 1 and 4.

3. **Create BUILD-SPECs for code-only pages.** 14+ pages/modules have significant element IDs with no spec coverage. This creates a documentation gap for the Wix Studio builder.

4. **FAQ page is almost complete.** Only `#faqMetaHtml` and `#faqSchemaHtml` are missing — these are SEO/schema injection elements.

5. **Contact page error states need wiring.** Four error IDs (`#contactEmailError`, `#contactNameError`, `#contactPhoneError`, `#contactMessageError`) plus two illustration IDs are unimplemented.
