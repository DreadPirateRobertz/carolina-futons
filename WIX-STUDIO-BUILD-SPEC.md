# Carolina Futons - Wix Studio Build Specification

## How to Use This Document
This spec tells you exactly what elements to create in the Wix Studio visual
editor, what IDs to assign them, and how they connect to the Velo code in
`src/pages/`. Every `$w('#elementID')` reference in the code corresponds to
an element you'll create in the editor with that exact ID.

---

## Global: Design Tokens (Apply in Wix Studio Theme)

### Colors (Site Palette)
| Swatch | Hex | Usage |
|--------|-----|-------|
| Color 1 | `#E8D5B7` | Sand base - page backgrounds |
| Color 2 | `#3A2518` | Espresso - primary text |
| Color 3 | `#5B8FA8` | Mountain blue - links, secondary CTA |
| Color 4 | `#E8845C` | Sunset coral - primary CTA, sale badges |
| Color 5 | `#F2E8D5` | Light sand - card backgrounds |
| Color 6 | `#A8CCD8` | Sky blue - subtle accents, tags |
| Color 7 | `#C9A0A0` | Mauve - tertiary accent |
| Color 8 | `#5C4033` | Light espresso - secondary text |
| Color 9 | `#D4BC96` | Dark sand - borders |
| Color 10 | `#FFFFFF` | White - modal backgrounds |

### Typography (Site Fonts)
| Role | Font | Fallback |
|------|------|----------|
| Heading | Playfair Display (700) | Georgia, serif |
| Body | Source Sans 3 (400, 600) | Helvetica Neue, Arial, sans-serif |
| Nav | Source Sans 3 (600, uppercase) | — |

### Typography Scale
| Element | Desktop | Mobile |
|---------|---------|--------|
| Hero Title | 56px / 1.1 | 36px / 1.15 |
| H1 | 42px / 1.15 | 28px / 1.2 |
| H2 | 32px / 1.2 | 24px / 1.25 |
| H3 | 24px / 1.3 | 20px / 1.3 |
| H4 | 20px / 1.35 | 18px / 1.35 |
| Body | 16px / 1.6 | 16px / 1.6 |
| Caption | 12px / 1.4 | 12px / 1.4 |
| Nav Link | 14px / 1 (uppercase, 0.04em tracking) | 14px |
| Price | 20px / 1 (700) | 18px |
| Button | 15px / 1 (600, 0.04em tracking) | 14px |

---

## Master Page (Header + Footer)

### Header Elements
Every page gets this header. Create in Wix Studio as a fixed header section.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Logo | Image | `#siteLogo` | Mountain illustration logo |
| Announcement Bar | Strip | `#announcementBar` | Full-width, sand dark bg |
| Announcement Text | Text | `#announcementText` | Rotates messages (see masterPage.js) |
| Nav: Home | Text/Link | `#navHome` | |
| Nav: Shop | Text/Link | `#navShop` | Dropdown with subcategories |
| Nav: Product Videos | Text/Link | `#navProductVideos` | |
| Nav: Sale | Text/Link | `#navSale` | Coral text color for emphasis |
| Nav: Getting It Home | Text/Link | `#navGettingItHome` | |
| Nav: Contact | Text/Link | `#navContact` | |
| Nav: FAQ | Text/Link | `#navFAQ` | |
| Nav: About | Text/Link | `#navAbout` | |
| Nav: Blog | Text/Link | `#navBlog` | |
| Search Input | Input | `#headerSearchInput` | With search icon |
| Cart Icon | Button/Image | `#cartIcon` | Shows cart badge |
| Cart Badge | Text | `#cartBadge` | Item count circle |
| Mobile Menu Button | Button | `#mobileMenuButton` | Hamburger icon |
| Mobile Menu Overlay | Box | `#mobileMenuOverlay` | Full-screen overlay |
| Mobile Menu Close | Button | `#mobileMenuClose` | X button |
| Business Schema HTML | HtmlComponent | `#businessSchemaHtml` | Hidden, for JSON-LD |

### Footer Elements
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Footer Logo | Image | `#footerLogo` | Smaller logo version |
| Quick Links Column | Section | — | Home, Shop, Sale, About, Contact |
| Shop Column | Section | — | Futon Frames, Mattresses, Murphy Beds, Platform Beds |
| Newsletter Email | Input | `#footerEmail` | |
| Newsletter Button | Button | `#footerSubscribe` | |
| Phone Link | Text | `#footerPhone` | (828) 252-9449 |
| Address | Text | `#footerAddress` | Full address |
| Hours | Text | `#footerHours` | Wed-Sat 10am-5pm |
| Social: Facebook | Button/Icon | `#socialFacebook` | |
| Social: Instagram | Button/Icon | `#socialInstagram` | |
| Social: Pinterest | Button/Icon | `#socialPinterest` | |
| Copyright | Text | — | "© 2026 Carolina Futons" |
| Legal Links | Text/Links | — | Privacy, Terms, Accessibility, Refund, Shipping |

### Promotional Lightbox Elements
Full-screen overlay modal for holiday/event/seasonal campaigns.
Controlled by the Promotions CMS collection; auto-shows 3s after page load.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Overlay | Box | `#promoOverlay` | Semi-transparent bg, full-screen, hidden default |
| Lightbox Container | Box | `#promoLightbox` | Centered modal, white bg, hidden default |
| Hero Image | Image | `#promoHeroImage` | Top of modal, campaign artwork |
| Title | Text (H2) | `#promoTitle` | Playfair Display, seasonal theming |
| Subtitle | Text | `#promoSubtitle` | Offer details |
| Countdown | Text | `#promoCountdown` | dd:hh:mm:ss format, hidden if no endDate |
| Product Repeater | Repeater | `#promoRepeater` | 3-4 featured sale items |
| → Product Image | Image | `#promoImage` | Inside repeater |
| → Product Name | Text | `#promoName` | Inside repeater |
| → Product Price | Text | `#promoPrice` | Current/discounted price |
| → Original Price | Text | `#promoOrigPrice` | Strikethrough, hidden default |
| → Quick Add | Button | `#promoQuickAdd` | Links to product page |
| Discount Code | Text | `#promoCode` | The coupon code text |
| Copy Code Button | Button | `#promoCopyCode` | Copies code to clipboard |
| Email Input | Input | `#promoEmailInput` | "Get early access" capture |
| Email Submit | Button | `#promoEmailSubmit` | Subscribe button |
| CTA Button | Button | `#promoCTA` | Primary action, coral bg |
| Close Button | Button | `#promoClose` | X icon, top right |
| Dismiss Link | Text/Button | `#promoDismiss` | "Maybe later" text link |

### Illustrated Header Decoration
The mountain ridgeline illustration goes behind/above the nav bar.
- Create as a vector/SVG image element layered behind the header
- Use the Blue Ridge mountain silhouette style from the reference
- Colors: Mountain blue `#5B8FA8` ridges against sky gradient
- Sunrise motif with radiating lines in sunset coral `#E8845C`

---

## Page: HOME (c1dmp)

### Hero Section
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Hero Container | Section | `#heroSection` | Full-width, mountain cabin illustration frame |
| Hero Background | Image | `#heroBg` | Illustrated mountain/cabin scene |
| Hero Title | Text (H1) | `#heroTitle` | "Handcrafted Comfort, Mountain Inspired." |
| Hero Subtitle | Text | `#heroSubtitle` | Supporting tagline |
| Hero CTA Button | Button | `#heroCTA` | "Explore Our Collection" → /shop-main |

### Category Showcase
6 clickable category cards with illustration/photo backgrounds:

| Element | Type | ID | Links To |
|---------|------|----|----------|
| Futon Frames Card | Box | `#categoryFutonFrames` | /futon-frames |
| Mattresses Card | Box | `#categoryMattresses` | /mattresses |
| Murphy Beds Card | Box | `#categoryMurphy` | /murphy-cabinet-beds |
| Platform Beds Card | Box | `#categoryPlatformBeds` | /platform-beds |
| Casegoods Card | Box | `#categoryCasegoods` | /casegoods-accessories |
| Sale Card | Box | `#categorySale` | /sales |

### "Our Favorite Finds" - Featured Products
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section Title | Text (H2) | — | "Our Favorite Finds" |
| Product Repeater | Repeater | `#featuredRepeater` | 4-col grid desktop, 2-col tablet, 1-col mobile |
| → Product Image | Image | `#featuredImage` | Card image, 8px radius |
| → Product Name | Text | `#featuredName` | Product title |
| → Product Price | Text | `#featuredPrice` | Current price |
| → Original Price | Text | `#featuredOriginalPrice` | Strikethrough, hidden default |
| → Sale Badge | Text/Box | `#featuredSaleBadge` | Coral badge, hidden default |

### Sale Highlights Section
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section Container | Section | `#saleSection` | Collapsible if no sales |
| Section Title | Text (H2) | — | "Current Deals" |
| Sale Repeater | Repeater | `#saleRepeater` | Horizontal scroll |
| → Sale Image | Image | `#saleImage` | |
| → Sale Name | Text | `#saleName` | |
| → Sale Price | Text | `#salePrice` | Coral color |
| → Original Price | Text | `#saleOrigPrice` | Strikethrough |

### Trust Bar
Horizontal strip with key differentiators:
- "Largest Selection in the Carolinas"
- "Family Owned Since 1991"
- "700+ Fabric Swatches"
- "Free Shipping Over $999"

---

## Page: PRODUCT PAGE (ve2z7)

### Breadcrumbs
| Element | Type | ID |
|---------|------|----|
| Crumb 1 | Text/Link | `#breadcrumb1` |
| Crumb 2 | Text/Link | `#breadcrumb2` |
| Crumb 3 | Text | `#breadcrumb3` |
| Breadcrumb Schema | HtmlComponent | `#breadcrumbSchemaHtml` |

### Product Gallery (Left Side)
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Main Image | Image | `#productMainImage` | Large, zoomable |
| Gallery Thumbnails | Gallery | `#productGallery` | Thumbnail strip below |

### Product Details (Right Side)
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Product Dataset | Dataset | `#productDataset` | Connected to Stores/Products |
| Product Name | Text (H1) | — | Bound to dataset |
| Product Price | Text | `#productPrice` | Bold, 20px |
| Compare Price | Text | `#productComparePrice` | Strikethrough, hidden default |
| Stock Status | Text | `#stockStatus` | "In Stock" / "Special Order" |
| Size Dropdown | Dropdown | `#sizeDropdown` | Full, Queen, Twin |
| Finish Dropdown | Dropdown | `#finishDropdown` | Finish options |
| Quantity | NumberInput | — | Default 1 |
| Add to Cart | Button | `#addToCartButton` | Coral bg, "Add to Cart" |
| Add Success | Box | `#addToCartSuccess` | Toast notification, hidden |
| Description | RichText | — | Bound to dataset |
| Features List | Text | — | Bullet points |
| Product Schema | HtmlComponent | `#productSchemaHtml` | Hidden JSON-LD |

### "You Might Also Like" (Cross-Sell)
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section | Section | `#relatedSection` | Collapsible |
| Repeater | Repeater | `#relatedRepeater` | 4-col grid |
| → Image | Image | `#relatedImage` | |
| → Name | Text | `#relatedName` | |
| → Price | Text | `#relatedPrice` | |
| → Badge | Text | `#relatedBadge` | Hidden default |

### "More From This Collection"
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section | Section | `#collectionSection` | Collapsible |
| Repeater | Repeater | `#collectionRepeater` | 6-col carousel |
| → Image | Image | `#collectionImage` | |
| → Name | Text | `#collectionName` | |
| → Price | Text | `#collectionPrice` | |

---

## Page: CATEGORY PAGE (u0gn0)

### Filter Bar
| Element | Type | ID |
|---------|------|----|
| Brand Filter | Dropdown | `#filterBrand` |
| Price Filter | Dropdown | `#filterPrice` |
| Size Filter | Dropdown | `#filterSize` |
| Clear Filters | Button | `#clearFilters` |
| Sort Dropdown | Dropdown | `#sortDropdown` |
| Result Count | Text | `#resultCount` |

### Product Grid
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Dataset | Dataset | `#categoryDataset` | Connected to store collection |
| Repeater | Repeater | `#productGridRepeater` | 3-col desktop, 2-col tablet |
| → Image | Image | `#gridImage` | Card-style, 12px radius |
| → Name | Text | `#gridName` | |
| → Price | Text | `#gridPrice` | |
| → Original Price | Text | `#gridOrigPrice` | Hidden default, strikethrough |
| → Sale Badge | Box | `#gridSaleBadge` | Coral, hidden default |
| → Brand Label | Text | `#gridBrand` | Small, secondary text color |
| → Ribbon | Text/Box | `#gridRibbon` | "Featured", "New", etc. |
| → Quick View | Button | `#quickViewBtn` | Appears on hover |

### Quick View Modal
| Element | Type | ID |
|---------|------|----|
| Modal Container | Lightbox/Box | `#quickViewModal` |
| Product Image | Image | `#qvImage` |
| Product Name | Text (H3) | `#qvName` |
| Product Price | Text | `#qvPrice` |
| Description | Text | `#qvDescription` |
| View Full | Button | `#qvViewFull` |
| Add to Cart | Button | `#qvAddToCart` |
| Close | Button | `#qvClose` |

---

## Page: CART PAGE (mqi5m)

### Shipping Progress Bar
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Progress Bar | ProgressBar | `#shippingProgressBar` | 0-100 |
| Progress Text | Text | `#shippingProgressText` | "$X away from free shipping" |
| Progress Icon | Image | `#shippingProgressIcon` | Checkmark, hidden default |

### Cart Items
| Element | Type | ID |
|---------|------|----|
| Dataset | Dataset | `#cartDataset` |
| Items Repeater | Repeater | `#cartItemsRepeater` |
| → Minus Button | Button | `#qtyMinus` |
| → Quantity Input | Input | `#qtyInput` |
| → Plus Button | Button | `#qtyPlus` |
| → Remove Button | Button/Icon | `#removeItem` |

### Cart Summary
| Element | Type | ID |
|---------|------|----|
| Subtotal | Text | `#cartSubtotal` |
| Shipping | Text | `#cartShipping` |
| Total | Text | `#cartTotal` |
| Checkout Button | Button | — |

### Cross-Sell Suggestions
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section | Section | `#suggestionsSection` | Collapsible |
| Heading | Text (H3) | `#suggestionsHeading` | "Complete Your Futon" |
| Repeater | Repeater | `#suggestionsRepeater` | 3-col |
| → Image | Image | `#sugImage` | |
| → Name | Text | `#sugName` | |
| → Price | Text | `#sugPrice` | |
| → Add Button | Button | `#sugAddBtn` | "Quick Add" |

---

## Page: SIDE CART (ego5s)

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Panel | Box | `#sideCartPanel` | Slide from right, fixed position |
| Overlay | Box | `#sideCartOverlay` | Semi-transparent background |
| Close | Button | `#sideCartClose` | X icon |
| Empty State | Box | `#sideCartEmpty` | "Your cart is empty" |
| Items Container | Box | `#sideCartItems` | |
| Items Repeater | Repeater | `#sideCartRepeater` | |
| → Item Image | Image | `#sideItemImage` | Small thumbnail |
| → Item Name | Text | `#sideItemName` | |
| → Item Price | Text | `#sideItemPrice` | |
| → Item Qty | Text | `#sideItemQty` | |
| → Item Variant | Text | `#sideItemVariant` | Hidden default |
| → Remove | Button | `#sideItemRemove` | X icon |
| Footer | Box | `#sideCartFooter` | |
| Subtotal | Text | `#sideCartSubtotal` | |
| Shipping Bar | ProgressBar | `#sideShippingBar` | Mini version |
| Shipping Text | Text | `#sideShippingText` | |
| View Cart | Button | `#viewFullCart` | Secondary button |
| Checkout | Button | `#sideCartCheckout` | Primary coral button |
| Suggestion Box | Box | `#sideCartSuggestion` | Collapsible |
| → Label | Text | `#sideSugLabel` | |
| → Image | Image | `#sideSugImage` | |
| → Name | Text | `#sideSugName` | |
| → Price | Text | `#sideSugPrice` | |
| → Add | Button | `#sideSugAdd` | "Add" |

---

## Page: ABOUT (gar3e) — "Our Story"

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Hero Section | Section | — | Mountain illustration background |
| Page Title | Text (H1) | — | "Our Story" |
| Story Text | RichText | — | Business history narrative |
| Team Gallery | Gallery | `#teamGallery` | Polaroid-style frames |
| → Photo | Image | `#polaroidImage` | Tilted polaroid effect |
| → Caption | Text | `#polaroidCaption` | Under each photo |
| Timeline Repeater | Repeater | `#timelineRepeater` | Vertical timeline |
| → Year | Text | `#timelineYear` | Bold, large |
| → Title | Text (H3) | `#timelineTitle` | |
| → Description | Text | `#timelineDesc` | |
| Schema | HtmlComponent | `#aboutSchemaHtml` | |

---

## Page: CONTACT (k14wx)

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Map Section | Section | — | Illustrated map background |
| Contact Form Name | Input | `#contactName` | |
| Contact Form Email | Input | `#contactEmail` | |
| Contact Form Phone | Input | `#contactPhone` | Optional |
| Contact Subject | Input | `#contactSubject` | Optional |
| Contact Message | TextArea | `#contactMessage` | |
| Submit Button | Button | `#contactSubmit` | |
| Success Message | Box | `#contactSuccess` | Hidden default |
| Error Message | Text | `#contactError` | Hidden default |
| Name Error | Text | `#contactNameError` | Hidden default |
| Email Error | Text | `#contactEmailError` | Hidden default |
| Message Error | Text | `#contactMessageError` | Hidden default |
| Address | Text | `#infoAddress` | |
| Phone | Text | `#infoPhone` | |
| Phone Link | Button | `#infoPhoneLink` | Click-to-call |
| Hours | Text | `#infoHours` | |
| Directions | Button | `#directionsBtn` | → Google Maps |
| Schema | HtmlComponent | `#contactSchemaHtml` | |

---

## Page: FAQ (s2c5g)

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Page Title | Text (H1) | — | "Frequently Asked Questions" |
| FAQ Repeater | Repeater | `#faqRepeater` | Accordion style |
| → Question | Text (H3) | `#faqQuestion` | Clickable |
| → Answer | Text | `#faqAnswer` | Collapsible |
| → Toggle Icon | Text | `#faqToggle` | +/− |
| Schema | HtmlComponent | `#faqSchemaHtml` | |

---

## Page: SEARCH RESULTS (evr2j)

| Element | Type | ID |
|---------|------|----|
| Search Query Display | Text (H1) | `#searchQuery` |
| Result Count | Text | `#resultCount` |
| Results Repeater | Repeater | `#searchRepeater` |
| → Image | Image | `#searchImage` |
| → Name | Text | `#searchName` |
| → Price | Text | `#searchPrice` |
| → Description | Text | `#searchDesc` |
| No Results Box | Box | `#noResultsBox` |
| No Results Text | Text | `#noResultsText` |

---

## Page: SHIPPING / GETTING IT HOME (ype8c)

| Element | Type | ID |
|---------|------|----|
| ZIP Input | Input | `#shippingZipInput` |
| Calculate Button | Button | `#shippingCalcBtn` |
| Result Text | Text | `#shippingResult` |
| Delivery Repeater | Repeater | `#deliveryRepeater` |
| → Title | Text | `#deliveryTitle` |
| → Description | Text | `#deliveryDesc` |
| Assembly Tips | Text | `#assemblyTips` |

---

## Page: PRODUCT VIDEOS (vu50r)

| Element | Type | ID |
|---------|------|----|
| Video Player | VideoPlayer | `#videoPlayer` |
| Video Overlay | Box | `#videoOverlay` |
| Shop CTA | Button | `#videoShopCTA` |
| Product Link | Button | `#videoProductLink` |
| Videos Repeater | Repeater | `#videosRepeater` |
| → Thumbnail | Image | `#videoThumb` |
| → Title | Text | `#videoTitle` |
| → Duration | Text | `#videoDuration` |
| → Category Badge | Text | `#videoCategoryBadge` |
| Filter: All | Button | `#videoFilterAll` |
| Filter: Futons | Button | `#videoFilterFutons` |
| Filter: Murphy | Button | `#videoFilterMurphy` |
| Filter: Platform | Button | `#videoFilterPlatform` |

---

## Page: CHECKOUT (psuom)

| Element | Type | ID |
|---------|------|----|
| Trust Repeater | Repeater | `#trustRepeater` |
| → Trust Text | Text | `#trustText` |
| Order Notes Toggle | Button | `#orderNotesToggle` |
| Order Notes Field | TextArea | `#orderNotesField` |

---

## Page: THANK YOU (dk9x8)

| Element | Type | ID |
|---------|------|----|
| Title | Text (H1) | `#thankYouTitle` |
| Message | Text | `#thankYouMessage` |
| Share Text | Text | `#shareText` |
| Share Facebook | Button | `#shareFacebook` |
| Share Pinterest | Button | `#sharePinterest` |
| Newsletter Prompt | Text | `#newsletterPrompt` |
| Newsletter Email | Input | `#newsletterEmail` |
| Newsletter Signup | Button | `#newsletterSignup` |
| Newsletter Success | Text | `#newsletterSuccess` |
| Post-Purchase Heading | Text (H2) | `#postPurchaseHeading` |
| Post-Purchase Repeater | Repeater | `#postPurchaseRepeater` |
| → Image | Image | `#ppImage` |
| → Name | Text | `#ppName` |
| → Price | Text | `#ppPrice` |

---

## CMS Collections to Create

### 1. ProductAnalytics (for trending/popular products)
| Field | Type | Notes |
|-------|------|-------|
| productId | Text | Reference to Stores/Products |
| productName | Text | |
| category | Text | |
| viewCount | Number | |
| lastViewed | DateTime | |
| addToCartCount | Number | |
| purchaseCount | Number | |

### 2. ContactSubmissions (for contact form records)
| Field | Type |
|-------|------|
| name | Text |
| email | Text |
| phone | Text |
| subject | Text |
| message | Text |
| submittedAt | DateTime |
| status | Text |

### 3. Wishlist (for saved items)
| Field | Type |
|-------|------|
| memberId | Text |
| productId | Text |
| productName | Text |
| productSlug | Text |
| mainMedia | Image |
| formattedPrice | Text |
| addedAt | DateTime |

### 4. Promotions (for holiday/event promotional lightboxes)
| Field | Type | Notes |
|-------|------|-------|
| title | Text | Headline shown in lightbox |
| subtitle | Text | Offer details / subhead |
| theme | Text | holiday / sale / event / seasonal |
| heroImage | Image | Hero image at top of lightbox |
| startDate | DateTime | Campaign start (inclusive) |
| endDate | DateTime | Campaign end (inclusive) |
| discountCode | Text | Coupon code to display |
| discountPercent | Number | Discount percentage |
| ctaUrl | Text | Where "Shop the Sale" links to |
| ctaText | Text | CTA button label (default: "Shop the Sale") |
| productIds | Text | Comma-separated product IDs for carousel |
| isActive | Boolean | Master on/off switch |

---

## Triggered Email Templates to Create
(In Wix Dashboard → Marketing → Triggered Emails)

1. **contact_form_submission** - Variables: customerName, customerEmail, customerPhone, subject, message, submittedAt
2. **new_order_notification** - Variables: orderNumber, customerName, total, itemCount

---

## Illustration Assets Needed

1. **Mountain ridgeline header** - SVG, blue mountain silhouette for nav background
2. **Sunrise/sunset motif** - SVG, radiating lines with coral/orange gradient
3. **Cabin/A-frame hero frame** - SVG, illustrated wooden frame around hero content
4. **Illustrated map** - Contact page, hand-drawn style showing Hendersonville, NC
5. **Category card illustrations** - 6 unique illustrations for homepage category grid
6. **Footer mountain accent** - Smaller mountain silhouette for footer
