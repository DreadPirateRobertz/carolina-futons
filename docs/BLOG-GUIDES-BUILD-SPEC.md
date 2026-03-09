# Blog + Buying Guides + Assembly Guides — Wix Studio Element Build Spec

> **For**: radahn (Playwright executor)
> **From**: godfrey (element architect)
> **Target**: My Site 2 (metaSiteId: `49cd75b0-92f1-4978-93e2-f5b5da531142`)
> **Source**: `Blog.js`, `Blog Post.js`, `Buying Guide.js`, `Buying Guides.js`, `Assembly Guides.js`
> **Bead**: CF-n220

---

## How to Use This Spec

Each element has: **Wix ID** (set in Properties panel), **Type** (Wix Studio element type), **Parent** (containing element), and **Notes** (styling/config).

In Wix Studio:
1. Navigate to the target page
2. Add each element using the type specified
3. Set the element ID in Properties panel (right-click → Properties → ID field)
4. Parent relationships indicate nesting — add child elements inside their parent container/repeater

---

## PAGE 1: Blog (`Blog.js`) — Page ID: q8wlq

### Page-Level Setup
- Route: `/blog`
- Page background: Off-White `#FAF7F2`
- Attach `Blog.js` as page code

### Section 1: Featured Post Hero

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `featuredHeroSection` | Container/Box | Page | Featured post hero. Initially collapsed (expands when featured post exists). |
| `featuredHeroLink` | Container/Box (clickable) | featuredHeroSection | Clickable wrapper — navigates to featured post. |
| `featuredTitle` | Text | featuredHeroSection | Post title. Font: Playfair Display, color: Espresso `#3A2518` |
| `featuredExcerpt` | Text | featuredHeroSection | Post excerpt. Font: Source Sans 3, color: Espresso Light `#5C4033` |
| `featuredCategory` | Text | featuredHeroSection | Category badge. Color: Mountain Blue `#5B8FA8` |
| `featuredDate` | Text | featuredHeroSection | Publish date |
| `featuredReadTime` | Text | featuredHeroSection | "X min read" badge |
| `featuredAuthor` | Text | featuredHeroSection | Author name |

### Section 2: Category Filters

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `categoryFilterRepeater` | Repeater | Page | Horizontal filter chips. "All" + each category. |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `filterChip` | Container/Box (clickable) | categoryFilterRepeater item | Filter chip wrapper. Active BG: Mountain Blue `#5B8FA8`, inactive BG: Sand Light `#F2E8D5` |
| `filterLabel` | Text | filterChip | Category name. Active color: White, inactive color: Espresso |

### Section 3: Blog Card Grid

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `blogGridRepeater` | Repeater | Page | Blog post card grid. Responsive: mobile 4, tablet 6, desktop 9. |
| `blogEmptyState` | Container/Box | Page | Empty state. Initially collapsed. Shows when no posts match filter. |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `blogCardLink` | Container/Box (clickable) | blogGridRepeater item | Clickable card wrapper — navigates to post |
| `cardTitle` | Text | blogGridRepeater item | Post title |
| `cardExcerpt` | Text | blogGridRepeater item | Post excerpt |
| `cardCategory` | Text | blogGridRepeater item | Category label |
| `cardDate` | Text | blogGridRepeater item | Publish date |
| `cardReadTime` | Text | blogGridRepeater item | "X min read" |

### Section 4: Related Products Sidebar

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `blogProductsSection` | Container/Box | Page | Products sidebar. Initially collapsed. |
| `blogProductsRepeater` | Repeater | blogProductsSection | Featured product cards. Responsive: mobile 2, tablet 3, desktop 4. |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `sidebarProductLink` | Container/Box (clickable) | blogProductsRepeater item | Clickable wrapper |
| `sidebarProductImage` | Image | blogProductsRepeater item | Product image |
| `sidebarProductName` | Text | blogProductsRepeater item | Product name |
| `sidebarProductPrice` | Text | blogProductsRepeater item | Product price |

### Section 5: Social Share Buttons

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `shareFacebook` | Button/Icon | Page | Facebook share. ARIA: "Share this article on Facebook (opens in new window)" |
| `sharePinterest` | Button/Icon | Page | Pinterest share. ARIA: "Share this article on Pinterest (opens in new window)" |
| `shareTwitter` | Button/Icon | Page | Twitter/X share. ARIA: "Share this article on Twitter (opens in new window)" |
| `shareEmail` | Button/Icon | Page | Email share. ARIA: "Share this article via email" |

### Section 6: Newsletter CTA

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `blogNewsletterEmail` | Text Input | Page | Email input. ARIA label: "Enter your email for newsletter" |
| `blogNewsletterSubmit` | Button | Page | "Subscribe" CTA. ARIA label: "Subscribe to newsletter". BG: Coral `#E8845C` |
| `blogNewsletterError` | Text | Page | Error message. Initially hidden. |
| `blogNewsletterSuccess` | Text | Page | Success message. Initially hidden. |

### Section 7: SEO (hidden)

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `blogSeoSchema` | HtmlComponent | Page | Hidden. Receives JSON-LD schema via postMessage. |

---

## PAGE 2: Blog Post (`Blog Post.js`) — Page ID: ftl7e

### Page-Level Setup
- Route: `/blog/<slug>` (dynamic)
- Page background: Off-White `#FAF7F2`
- Attach `Blog Post.js` as page code
- Wix Blog app renders post content — this code adds enhancements around it

### Section 1: Post Metadata

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `postReadTime` | Text | Page | "X min read" badge |
| `postDate` | Text | Page | Publish date |
| `postCategory` | Text | Page | Category label |

### Section 2: Author Bio

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `authorBioSection` | Container/Box | Page | Author bio card. Initially collapsed (expands after data loads). |
| `authorName` | Text | authorBioSection | Author name |
| `authorDescription` | Text | authorBioSection | Author description |
| `authorLocation` | Text | authorBioSection | Location text |
| `authorEstablished` | Text | authorBioSection | "Est. XXXX" |

### Section 3: Post Share Buttons

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `postShareFacebook` | Button/Icon | Page | Facebook share. ARIA: "Share on Facebook (opens in new window)" |
| `postSharePinterest` | Button/Icon | Page | Pinterest share. ARIA: "Share on Pinterest (opens in new window)" |
| `postShareTwitter` | Button/Icon | Page | Twitter share. ARIA: "Share on Twitter (opens in new window)" |
| `postShareEmail` | Button/Icon | Page | Email share. ARIA: "Share via email" |

### Section 4: Related Posts

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `relatedPostsSection` | Container/Box | Page | Related posts area. Initially collapsed. |
| `relatedPostsRepeater` | Repeater | relatedPostsSection | Related post cards |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `relatedPostLink` | Container/Box (clickable) | relatedPostsRepeater item | Clickable wrapper |
| `relatedTitle` | Text | relatedPostsRepeater item | Post title |
| `relatedCategory` | Text | relatedPostsRepeater item | Category label |
| `relatedReadTime` | Text | relatedPostsRepeater item | "X min read" |

### Section 5: SEO (hidden)

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `postSeoSchema` | HtmlComponent | Page | Hidden. JSON-LD article + FAQ schema. |
| `postMetaHtml` | HtmlComponent | Page | Hidden. Meta tags (title, description, canonical). |

---

## PAGE 3: Buying Guides Hub (`Buying Guides.js`) — Page ID: u2dwz

### Page-Level Setup
- Route: `/buying-guides`
- Page background: Off-White `#FAF7F2`
- Attach `Buying Guides.js` as page code

### Section 1: Breadcrumbs

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `breadcrumbRepeater` | Repeater | Page | Breadcrumb navigation (Home › Buying Guides) |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `breadcrumbLabel` | Text (clickable) | breadcrumbRepeater item | Crumb text. Clickable except last item. |
| `breadcrumbSeparator` | Text | breadcrumbRepeater item | "›" separator. Empty on last item. |

### Section 2: Category Filters

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `categoryFilterRepeater` | Repeater | Page | Category filter chips |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `filterLabel` | Text | categoryFilterRepeater item | Category name |
| `filterButton` | Button | categoryFilterRepeater item | Filter button. Clickable. |

### Section 3: Guide Grid

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `guidesRepeater` | Repeater | Page | Guide card grid |
| `emptyStateBox` | Container/Box | Page | "No guides" empty state. Initially hidden. |
| `guideCountText` | Text | Page | "X Expert Buying Guides" count |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `guideCardBox` | Container/Box (clickable) | guidesRepeater item | Clickable card wrapper |
| `guideTitle` | Text | guidesRepeater item | Guide title |
| `guideDescription` | Text | guidesRepeater item | Guide description |
| `guideCategoryLabel` | Text | guidesRepeater item | Category label |
| `guideDate` | Text | guidesRepeater item | Publish date |
| `guideReadTime` | Text | guidesRepeater item | "X min read" |
| `guideHeroImage` | Image | guidesRepeater item | Guide hero image |
| `readGuideButton` | Button | guidesRepeater item | "Read Guide" CTA. BG: Coral `#E8845C` |

### Section 4: SEO (hidden)

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `hubSeoSchema` | HtmlComponent | Page | Hidden. CollectionPage JSON-LD. |
| `hubMetaHtml` | HtmlComponent | Page | Hidden. Meta tags. |

---

## PAGE 4: Buying Guide Detail (`Buying Guide.js`) — Page ID: lvegj

### Page-Level Setup
- Route: `/buying-guides/<slug>` (dynamic)
- Page background: Off-White `#FAF7F2`
- Attach `Buying Guide.js` as page code
- Layout: Main content + optional sidebar (related products)

### Section 1: Error/Coming Soon States

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `guideContent` | Container/Box | Page | Main content wrapper. Hidden on error/coming-soon. |
| `notFoundBox` | Container/Box | Page | 404 state. Initially hidden. |
| `comingSoonBox` | Container/Box | Page | Coming soon state. Initially hidden. |
| `comingSoonTitle` | Text | comingSoonBox | Guide title |
| `comingSoonMessage` | Text | comingSoonBox | Coming soon message |

### Section 2: Breadcrumbs

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `breadcrumbRepeater` | Repeater | guideContent | Same structure as hub page breadcrumbs |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `breadcrumbLabel` | Text (clickable) | breadcrumbRepeater item | Crumb text |
| `breadcrumbSeparator` | Text | breadcrumbRepeater item | "›" separator |

### Section 3: Guide Header

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `guideTitle` | Text | guideContent | Guide title. Font: Playfair Display, large heading. |
| `guideCategoryLabel` | Text | guideContent | Category label |
| `guideDate` | Text | guideContent | "Updated March 8, 2026" |
| `guideReadTime` | Text | guideContent | "X min read" |
| `guideHeroImage` | Image | guideContent | Hero image with alt text |

### Section 4: Table of Contents

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `tocContainer` | Container/Box | guideContent | TOC wrapper. Collapsed on mobile by default. |
| `tocToggle` | Button/Link | guideContent | TOC toggle button (mobile only). |
| `tocRepeater` | Repeater | tocContainer | TOC links |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `tocLabel` | Text (clickable) | tocRepeater item | Section label. Clickable — scrolls to section. |

### Section 5: Guide Content Sections

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `sectionRepeater` | Repeater | guideContent | Guide body sections |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `sectionHeading` | Text | sectionRepeater item | Section heading. Font: Playfair Display. |
| `sectionBody` | Text | sectionRepeater item | Section body text. Font: Source Sans 3. |

### Section 6: Comparison Table

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `comparisonBox` | Container/Box | guideContent | Comparison table area. Initially collapsed. |
| `comparisonTitle` | Text | comparisonBox | Table title |
| `comparisonHeaderRepeater` | Repeater | comparisonBox | Table column headers |
| `comparisonRowRepeater` | Repeater | comparisonBox | Table rows |

**Header repeater children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `headerLabel` | Text | comparisonHeaderRepeater item | Column header text |

**Row repeater children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `featureLabel` | Text | comparisonRowRepeater item | Feature/row label |
| `valueCellRepeater` | Repeater | comparisonRowRepeater item | Nested repeater for value cells |

**Value cell children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `cellValue` | Text | valueCellRepeater item | Cell value text |

### Section 7: FAQ Accordion

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `faqBox` | Container/Box | guideContent | FAQ section. Initially collapsed. |
| `guideFaqRepeater` | Repeater | faqBox | FAQ items |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `faqQuestion` | Text (clickable) | guideFaqRepeater item | Question text. Clickable — toggles answer. |
| `faqAnswer` | Text | guideFaqRepeater item | Answer text. Initially collapsed (accordion). |

### Section 8: Share Buttons

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `shareFacebook` | Button/Icon | guideContent | Facebook share |
| `shareTwitter` | Button/Icon | guideContent | Twitter share |
| `sharePinterest` | Button/Icon | guideContent | Pinterest share |
| `shareEmail` | Button/Icon | guideContent | Email share |

### Section 9: Related Products

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `relatedProductsBox` | Container/Box | Page | Products sidebar. Initially collapsed. |
| `relatedProductRepeater` | Repeater | relatedProductsBox | Product cards |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `productCardBox` | Container/Box (clickable) | relatedProductRepeater item | Clickable card wrapper |
| `productImage` | Image | relatedProductRepeater item | Product image |
| `productName` | Text | relatedProductRepeater item | Product name |
| `productPrice` | Text | relatedProductRepeater item | Product price |
| `productRibbon` | Text/Badge | relatedProductRepeater item | Sale/New ribbon. Initially hidden. |

### Section 10: Related Guides

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `relatedGuidesBox` | Container/Box | Page | Related guides section. Initially collapsed. |
| `relatedGuideRepeater` | Repeater | relatedGuidesBox | Guide cards |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `relatedGuideBox` | Container/Box (clickable) | relatedGuideRepeater item | Clickable card wrapper |
| `relatedGuideTitle` | Text | relatedGuideRepeater item | Guide title |
| `relatedGuideDescription` | Text | relatedGuideRepeater item | Guide description |

### Section 11: SEO (hidden)

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `guideSeoSchema` | HtmlComponent | guideContent | Hidden. Article + FAQ JSON-LD. |
| `guideMetaHtml` | HtmlComponent | guideContent | Hidden. Meta tags. |

---

## PAGE 5: Assembly Guides (`Assembly Guides.js`) — Page ID: cskeg

### Page-Level Setup
- Route: `/assembly-guides`
- Page background: Off-White `#FAF7F2`
- Attach `Assembly Guides.js` as page code
- Layout: List view (left) + Detail view (right, toggles visibility)

### Section 1: Category Filters

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `guideCategoryRepeater` | Repeater | Page | Category filter chips. ARIA label: "Assembly guide category filters" |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `catLabel` | Text (clickable) | guideCategoryRepeater item | Category label with icon. ARIA label: "Filter: [category]". tabIndex=0. Keyboard: Enter/Space activates. |

### Section 2: Search

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `guideSearchInput` | Text Input | Page | Search input. ARIA label: "Search assembly guides". Debounced 300ms. |

### Section 3: Guide List

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `guideListSection` | Container/Box | Page | List view wrapper. Collapses when detail is shown. |
| `guideLoading` | Container/Box | guideListSection | Loading spinner. Initially expanded, collapses after load. |
| `guideNoResults` | Text | guideListSection | "No guides match..." Initially collapsed. |
| `guideListRepeater` | Repeater | guideListSection | Guide list items. ARIA label: "Assembly guides list" |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `guideTitle` | Text (clickable) | guideListRepeater item | Guide title. ARIA label: "View assembly guide: [title]". tabIndex=0. Keyboard: Enter/Space opens detail. |
| `guideCategory` | Text | guideListRepeater item | Category with icon |
| `guideTime` | Text | guideListRepeater item | Estimated time with clock icon |
| `guidePdfBadge` | Text | guideListRepeater item | "PDF" badge (if has PDF) |
| `guideVideoBadge` | Text | guideListRepeater item | "Video" badge (if has video) |
| `guideViewBtn` | Button | guideListRepeater item | "View Guide" button |

### Section 4: Guide Detail View

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `guideDetailSection` | Container/Box | Page | Detail view wrapper. Initially collapsed. Expands when guide selected. |
| `guideBackBtn` | Button | guideDetailSection | "← Back" button. ARIA label: "Back to guides list" |
| `detailLoading` | Container/Box | guideDetailSection | Loading state. |
| `detailContent` | Container/Box | guideDetailSection | Detail content wrapper. |
| `detailError` | Text | guideDetailSection | Error message. Initially collapsed. |

### Detail Content Elements

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `detailTitle` | Text | detailContent | Guide title. Font: Playfair Display. |
| `detailCategory` | Text | detailContent | Category with icon |
| `detailTime` | Text | detailContent | "Estimated time: X" |

### Detail Sections (collapsible)

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `detailStepsSection` | Container/Box | detailContent | Steps section. Initially collapsed. |
| `detailSteps` | Rich Text (HTML) | detailStepsSection | Assembly steps. Uses `.html` property. |
| `detailTipsSection` | Container/Box | detailContent | Tips section. Initially collapsed. |
| `detailTips` | Text | detailTipsSection | Assembly tips text |
| `detailVideoSection` | Container/Box | detailContent | Video section. Initially collapsed. |
| `detailVideo` | Video/IFrame | detailVideoSection | Embedded video. ARIA label: "Video tutorial: [title]" |
| `detailPdfSection` | Container/Box | detailContent | PDF section. Initially collapsed. |
| `detailPdfBtn` | Button/Link | detailPdfSection | "Download PDF" button. target=_blank. ARIA label: "Download PDF: [title]" |

### Section 5: Care Tips

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `careTipsSection` | Container/Box | Page | Care tips area. Initially collapsed. |
| `careTipsRepeater` | Repeater | careTipsSection | Care tip items. ARIA label: "Product care tips" |

**Repeater item children:**

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `careTipTitle` | Text | careTipsRepeater item | Tip title |
| `careTipText` | Text | careTipsRepeater item | Tip body text |

### Section 6: SEO (hidden)

| Wix ID | Type | Parent | Notes |
|--------|------|--------|-------|
| `guideSchemaHtml` | HtmlComponent | Page | Hidden. HowTo JSON-LD schema. |

---

## Element Count Summary

| Page | Elements | Repeaters | Nested Repeaters |
|------|----------|-----------|------------------|
| Blog | 34 | 3 (categoryFilterRepeater, blogGridRepeater, blogProductsRepeater) | 0 |
| Blog Post | 20 | 1 (relatedPostsRepeater) | 0 |
| Buying Guides Hub | 19 | 3 (breadcrumbRepeater, categoryFilterRepeater, guidesRepeater) | 0 |
| Buying Guide Detail | 50 | 8 (breadcrumbRepeater, tocRepeater, sectionsRepeater, comparisonHeaderRepeater, comparisonRowRepeater, faqRepeater, relatedProductRepeater, relatedGuideRepeater) | 1 (valueCellRepeater) |
| Assembly Guides | 34 | 3 (guideCategoryRepeater, guideListRepeater, careTipsRepeater) | 0 |
| **Total** | **157** | **18** | **1** |

---

## Shared Element IDs Across Pages

Some element IDs are reused across pages (same name, independent instances):

| Element ID | Used On | Notes |
|------------|---------|-------|
| `breadcrumbRepeater` | Buying Guides Hub, Buying Guide Detail | Same structure, different page instances |
| `breadcrumbLabel` | Buying Guides Hub, Buying Guide Detail | Repeater child |
| `breadcrumbSeparator` | Buying Guides Hub, Buying Guide Detail | Repeater child |
| `shareFacebook/Twitter/Pinterest/Email` | Blog, Buying Guide Detail | Same IDs, different pages |
| `categoryFilterRepeater` | Blog, Buying Guides Hub | Different children: Blog uses `filterChip`+`filterLabel`, Buying Guides uses `filterLabel`+`filterButton` |
| `filterLabel` | Blog (inside filterChip), Buying Guides Hub (direct child) | Different parent contexts |
| `guideTitle` | Buying Guides Hub, Buying Guide Detail, Assembly Guides | Repeater child in all three |
| `guideCategoryLabel` | Buying Guides Hub, Buying Guide Detail | Repeater child |
| `guideDate` | Buying Guides Hub, Buying Guide Detail | Repeater child |
| `guideReadTime` | Buying Guides Hub, Buying Guide Detail | Repeater child |
| `guideHeroImage` | Buying Guides Hub, Buying Guide Detail | Repeater child |

---

## Design Token Quick Reference

| Token | Hex | Usage |
|-------|-----|-------|
| Sand Light | `#F2E8D5` | Inactive filter chips, card backgrounds |
| Off-White | `#FAF7F2` | Page background |
| Espresso | `#3A2518` | Primary text, headings |
| Espresso Light | `#5C4033` | Secondary text, excerpts |
| Mountain Blue | `#5B8FA8` | Active filter chips, category labels, links |
| Coral | `#E8845C` | CTA buttons ("Read Guide", "Subscribe") |
| White | `#FFFFFF` | Active filter chip text |

---

## Build Order Recommendation

1. **Blog** (34 elements) — Start here, most commonly visited content page
   - Featured hero section
   - Category filter repeater
   - Blog card grid repeater
   - Social share + newsletter
   - Products sidebar

2. **Blog Post** (20 elements) — Simplest page, enhances existing Wix Blog app
   - Post metadata (read time, date, category)
   - Author bio section
   - Share buttons
   - Related posts repeater

3. **Buying Guides Hub** (19 elements) — Simple grid page
   - Breadcrumbs
   - Category filters
   - Guide grid repeater with cards

4. **Assembly Guides** (34 elements) — List/detail toggle pattern
   - Category filters + search
   - Guide list repeater
   - Detail view with steps, video, PDF, tips
   - Care tips section

5. **Buying Guide Detail** (50 elements) — Most complex, has nested repeater
   - Breadcrumbs + header
   - Table of contents (collapsible on mobile)
   - Content sections repeater
   - Comparison table (nested repeater for value cells)
   - FAQ accordion
   - Related products + guides sidebars
