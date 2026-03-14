# Template Element Audit — Furniture Store (#3563 "tera")

**Audited:** 2026-03-09, session 7
**Template demo:** https://www.wix.com/demone2/tera
**Template ID:** 72b9cc18-4c5e-4c13-a938-45ce7ff80108

---

## Template Pages Discovered

From footer navigation and internal links:

| Page | URL Path | Confirmed |
|------|----------|-----------|
| Home | `/` | YES — audited |
| Shop (All Products) | `/category/all-products` | YES — audited |
| Category: Sofas | `/category/sofas` | YES (subpage of Shop) |
| Category: Lounge Chairs | `/category/lounge-chairs` | YES (subpage of Shop) |
| Category: Tables | `/category/tables` | YES (subpage of Shop) |
| Category: Chairs | `/category/chairs` | YES (subpage of Shop) |
| Product Page | `/product-page/{slug}` | YES — audited |
| Contact | `/contact` | YES (footer link) |
| Terms & Conditions | `/terms-and-conditions` | YES (footer link) |
| Privacy Policy | `/privacy-policy` | YES (footer link) |
| Refund Policy | `/refund-policy` | YES (footer link) |
| Shipping Policy | `/shipping-policy` | YES (footer link) |
| Accessibility Statement | `/accessibility-statement` | YES (footer link) |
| FAQ | `/faq` | YES (footer link) |
| About | `/about` | YES (homepage "Learn More" link) |
| Members Area / Wishlist | `/members-area/my/my-wishlist` | YES (header icon) |

**Total: 16 pages** (including 4 category subpages). Far more than the 7 initially advertised.

---

## Master Page (Header + Footer)

### Header Elements

| Template Element | Type | Notes | BUILD-SPEC Match |
|-----------------|------|-------|-----------------|
| Announcement bar | Strip | "Free Shipping on all intl. orders over $200" — neon green bg | → `#announcementBar` + `#announcementText` |
| Logo ("tera") | Image/Link | Links to home | → `#siteLogo` |
| Nav: Shop | Link | `/category/all-products` | → `#navShop` |
| Nav: Sofas | Link | Category nav | → map to category nav |
| Nav: Lounge Chairs | Link | Category nav | → map to category nav |
| Nav: Tables | Link | Category nav | → map to category nav |
| Nav: Chairs | Link | Category nav | → map to category nav |
| Nav: Contact | Link | `/contact` | → `#navContact` |
| Search button | Button | Opens search | → `#headerSearchInput` |
| Log In button | Button | Member login | → member area |
| Wishlist icon | Link | Heart icon → wishlist page | → wishlist feature |
| Cart icon | Button | Shopping bag with count | → `#cartIcon` + `#cartBadge` |

**Template has 12 header elements. BUILD-SPEC needs ~18. Gap: ~6 elements (navHome, navProductVideos, navSale, navGettingItHome, navFAQ, navAbout, navBlog, mobileMenuButton/Overlay/Close, businessSchemaHtml)**

### Footer Elements

| Template Element | Type | Notes | BUILD-SPEC Match |
|-----------------|------|-------|-----------------|
| Copyright | Text | "© 2035 by Business Name" | → update year/name |
| Brand name ("tera") | Text | | → `#footerLogo` |
| Nav links column | Links | Sofas, Lounge Chairs, Tables, Chairs, Contact | → Quick Links column |
| Legal links column | Links | Terms, Privacy, Refund, Shipping, Accessibility, FAQ | → Legal Links |
| Social: Facebook | Link | External | → `#socialFacebook` |
| Social: Instagram | Link | External | → `#socialInstagram` |
| Social: TikTok | Link | External | → map to social |
| Social: Pinterest | Link | External | → `#socialPinterest` |
| Newsletter section | Form | "Stay Inspired" — email input + checkbox + submit | → `#footerEmailInput` + `#footerEmailSubmit` |
| Contact info | Text | Email, phone, address, hours | → `#footerPhone` + `#footerAddress` + `#footerHours` |
| Send button | Link/Button | Chat/contact action | → repurpose |

**Template has ~11 footer elements. BUILD-SPEC needs ~14. Very close match.**

---

## Page: HOME

### Sections (top to bottom)

| Section | Template Elements | BUILD-SPEC Match |
|---------|------------------|-----------------|
| Hero | Brand name, H1 "UNIQUE DESIGNS FOR DISTINCTIVE SPACES", Shop CTA button, large furniture image bg | → `#heroTitle`, `#heroSubtitle`, `#heroCTA`, `#heroImage` |
| Shop by Collections | H2 + 4 collection cards (Sofas, Lounge Chairs, Chairs, Tables) each with image + heading + link | → `#categoryRepeater` with `#catImage`, `#catTitle`, `#catLink` |
| Featured Collection ("Handpicked Lounge Chairs") | H2 + subtitle + "Discover More" CTA + lifestyle image | → featured section |
| New In | H2 + 3 product cards (name, price, NEW badge) + lifestyle image | → `#featuredRepeater` |
| Brand Story ("The Tera World") | H2 + description text + "Learn More" link + image | → about/story section |
| Best Sellers | H2 + 4 product cards (name, price, BEST SELLER badge) + lifestyle image | → `#saleRepeater` or best sellers |
| Instagram Feed ("Follow Us #TERAHOME") | H2 + Instagram gallery widget | → social section |
| As Seen In | H2 + 7 press/brand logo images | → trust bar / press section |

**Template Home has 8 sections with ~40+ elements. BUILD-SPEC Home has ~109 elements across ~12 sections. Good foundation — we add our custom sections (Trust Bar, Swatch Promo, Newsletter, Style Quiz CTA, Recently Viewed, Video Showcase, Scroll Anchors, Schema).**

---

## Page: SHOP / CATEGORY (All Products)

| Template Element | Type | Notes | BUILD-SPEC Match |
|-----------------|------|-------|-----------------|
| Breadcrumbs | Nav | "Home > All Products" | → `#breadcrumbHome`, `#breadcrumbCurrent` |
| Page title | H1 | "All Products" | → category title |
| Category description | Text | Placeholder description | → category description |
| Browse by sidebar | Nav list | All Products, Sofas, Lounge Chairs, Tables, Chairs | → category filter sidebar |
| Filter by: Price | Slider | $130 - $1,200 range slider | → `#filterPrice` |
| Filter by: Color | Checkboxes | 14 color options | → `#filterColor` (BONUS — not in our basic BUILD-SPEC) |
| Product count | Text | "24 products" | → product count |
| Sort by dropdown | Button | "Sort by: Recommended" | → `#filterSort` |
| Product grid | Gallery | 24 products in grid, 3-col | → `#productRepeater` |
| Product cards | Group | Image + name + price + badge (NEW/BEST SELLER/SALE) + color variant swatches | → `#cardImage`, `#cardTitle`, `#cardPrice`, `#cardBadge` |
| Sale pricing | Text | Regular price strikethrough + sale price | → sale display |

**Template Category page is EXTREMELY rich. Has: breadcrumbs, sidebar category nav, price slider filter, color filter, sort dropdown, product count, badges, variant swatches on cards, sale pricing. This exceeds our Phase 1 BUILD-SPEC requirements.**

---

## Page: PRODUCT PAGE

| Template Element | Type | Notes | BUILD-SPEC Match |
|-----------------|------|-------|-----------------|
| Breadcrumbs | Nav | "Home > MODO" | → `#breadcrumbHome`, `#breadcrumbProduct` |
| Image gallery | Region | 3 thumbnail buttons + main image | → `#productGallery`, `#mainImage`, `#thumbnailRepeater` |
| Product title | H5 | "MODO" | → `#productTitle` |
| Price | H6 | "$1,200.00" | → `#productPrice` |
| Description | Paragraph | Product description text | → `#productDescription` |
| Color variant selector | List | 3 color radio buttons (Yellow, Purple, green) | → `#variantDropdown` / variant selector |
| Quantity selector | Spinbutton | Number input + "Add one" / "Remove one" buttons | → `#quantityInput`, `#quantityPlus`, `#quantityMinus` |
| Add to Cart | Button | Primary CTA | → `#addToCartButton` |
| Buy Now | Button | Secondary CTA — direct checkout | → buy now (BONUS) |
| Add to Wishlist | Button | Heart icon | → `#wishlistButton` (Phase 3 in our plan but FREE here) |
| Product Info accordion | Expandable | "PRODUCT INFO" — collapsible details | → `#productInfoAccordion` |
| Return & Refund accordion | Expandable | "RETURN & REFUND POLICY" | → refund accordion |
| Shipping Info accordion | Expandable | "SHIPPING INFO" | → shipping accordion |
| Social sharing | Nav | Facebook, WhatsApp, Twitter, Pinterest | → `#shareFacebook`, etc. |
| You Might Also Like | Carousel | 16 related products with Quick View buttons, Previous/Next navigation | → `#relatedRepeater` |

**Template Product Page is incredibly feature-rich. Already has: gallery, variants, quantity, add-to-cart, buy now, wishlist, 3 info accordions, social sharing, and a 16-product cross-sell carousel with Quick View. This covers ~70% of our Phase 1 Product Page BUILD-SPEC out of the box.**

---

## Template Summary — Coverage vs BUILD-SPEC

| Page | Template Elements | BUILD-SPEC Elements | Coverage |
|------|------------------|--------------------|---------|
| Master Page (Header) | ~12 | ~18 | ~67% |
| Master Page (Footer) | ~11 | ~14 | ~79% |
| Home | ~40+ | ~109 | ~37% (8 sections vs 12, but great foundation) |
| Category/Shop | ~11 types (rich) | ~86 | ~50% (but quality > quantity — filters, sort, badges all present) |
| Product Page | ~15 types (very rich) | ~176 | ~45% (but core commerce elements nearly 100%) |
| Contact | EXISTS | ~30 | TBD — not yet audited in detail |
| FAQ | EXISTS | ~8 | TBD |
| About | EXISTS | ~25 | TBD |
| Policy pages (5) | ALL EXIST | ~10 each | TBD |
| Members/Wishlist | EXISTS | ~30 | TBD |

### Key Findings

1. **Template has 16 pages** — more than the 7 advertised. Includes all policy pages, FAQ, About, Contact, Members area.
2. **Category page is exceptional** — price slider, color filters, sort, badges, variant swatches on cards, sale pricing.
3. **Product page is nearly complete** — gallery, variants, quantity, cart, wishlist, accordions, social share, cross-sell carousel with Quick View.
4. **Announcement bar already exists** — just need to rename ID and connect our rotation logic.
5. **Newsletter form already exists** in footer — email + checkbox + submit.
6. **Social links already exist** — Facebook, Instagram, TikTok, Pinterest.
7. **Wishlist infrastructure already exists** — heart icon in header, wishlist button on product page.
8. **24 demo products already loaded** with categories, variants, prices, badges.

### What Template LACKS (we add)

**Phase 1 gaps:**
- Mobile hamburger menu (template may have responsive mobile nav — needs mobile viewport check)
- Cart Page / Side Cart (uses Wix native cart — need to verify and potentially customize)
- Checkout customization (Wix handles natively)
- Thank You page customization

**Phase 2+ gaps:**
- Blog / Blog Post (not in template — need to add)
- Style Quiz, Room Planner, Compare Page
- Assembly Guides, UGC Gallery
- Gift Cards, Referral, Newsletter dedicated page
- Order Tracking, Admin Returns, Store Locator
- Promotional lightbox, exit-intent popup, PWA banner
- Mountain skyline illustrations, trust badges
