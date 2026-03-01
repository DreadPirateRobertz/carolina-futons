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
| Newsletter Email | Input | `#footerEmailInput` | |
| Newsletter Button | Button | `#footerEmailSubmit` | |
| Newsletter Error | Text | `#footerEmailError` | Hidden default |
| Newsletter Success | Text | `#footerEmailSuccess` | Hidden default |
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

### Accessibility & Skip Navigation
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Skip to Content | Button/Link | `#skipToContent` | Hidden until focused, jumps to main content |
| Main Content | Container | `#mainContent` | Target for skip link, `role="main"` |

### Exit-Intent Popup
Displays when user moves cursor toward browser close. Captures email + links to swatch service.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Popup Container | Box | `#exitIntentPopup` | Hidden default, centered modal |
| Overlay | Box | `#exitOverlay` | Semi-transparent backdrop |
| Title | Text (H2) | `#exitTitle` | "Before You Go..." |
| Subtitle | Text | `#exitSubtitle` | Offer text |
| Email Input | Input | `#exitEmailInput` | |
| Submit Button | Button | `#exitEmailSubmit` | |
| Success Message | Text | `#exitSuccess` | Hidden default |
| Swatch Link | Button | `#exitSwatchLink` | "Browse 700+ fabric swatches" |
| Close Button | Button | `#exitClose` | X icon |

### PWA Install Banner
Shown to mobile users who haven't installed the PWA.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Banner Container | Box | `#installBanner` | Hidden default, bottom strip |
| Banner Text | Text | `#installBannerText` | "Add to home screen" |
| Install Button | Button | `#installBannerBtn` | "Install" |
| Dismiss Button | Button | `#installBannerDismiss` | X icon |

### Side Cart "Just Added" Highlight
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Highlight Box | Box | `#justAddedHighlight` | Brief flash on newly added item |

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

### Category Repeater (Alternative to Static Cards)
Code uses a repeater for the 6 category cards:

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Category Repeater | Repeater | `#categoryRepeater` | 6 items, 3-col desktop, 2-col tablet |
| → Card Title | Text | `#categoryCardTitle` | Category name |
| → Card Tagline | Text | `#categoryCardTagline` | Subtitle/description |
| → Product Count | Text | `#categoryCardCount` | "X products" |

### Testimonials Section
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Testimonial Repeater | Repeater | `#testimonialRepeater` | Rotating customer quotes |
| → Quote Text | Text | `#testimonialQuote` | |
| → Customer Name | Text | `#testimonialName` | |

### Video Showcase Section
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section Container | Section | `#videoShowcaseSection` | Collapsible |
| Section Title | Text (H2) | `#videoShowcaseTitle` | |
| Section Subtitle | Text | `#videoShowcaseSubtitle` | |
| View All CTA | Button | `#viewAllVideosCTA` | → /product-videos |

### Style Quiz CTA Section
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section Container | Section | `#quizCTASection` | |
| Title | Text (H2) | `#quizCTATitle` | |
| Subtitle | Text | `#quizCTASubtitle` | |
| Start Quiz Button | Button | `#quizCTAButton` | → Style quiz page |

### Recently Viewed Section
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section Container | Section | `#recentSection` | Collapsible, hidden if empty |
| Repeater | Repeater | — | Reuses standard product card layout |
| → Image | Image | `#recentImage` | |
| → Name | Text | `#recentName` | |
| → Price | Text | `#recentPrice` | |

### Trust Bar
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Trust Bar Container | Strip | `#trustBar` | Horizontal strip |

Content: "Largest Selection in the Carolinas" · "Family Owned Since 1991" · "700+ Fabric Swatches" · "Free Shipping Over $999"

### Website Schema
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Website Schema | HtmlComponent | `#websiteSchemaHtml` | Hidden, WebSite JSON-LD |

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
| Product Name | Text (H1) | `#productName` | Product title (also bound to dataset) |
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

### Customer Reviews Section
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section | Section | `#reviewsSection` | Collapsible |
| Average Rating | Text | `#reviewsAverage` | "4.5" |
| Review Count | Text | `#reviewsCount` | "12 reviews" |
| Stars Display | Text | `#reviewsStars` | ★★★★½ |
| Rating Bar 5★ | ProgressBar | `#ratingBar5` | Breakdown bar |
| Rating Count 5★ | Text | `#ratingCount5` | Count label |
| Rating Bar 4★ | ProgressBar | `#ratingBar4` | |
| Rating Count 4★ | Text | `#ratingCount4` | |
| Rating Bar 3★ | ProgressBar | `#ratingBar3` | |
| Rating Count 3★ | Text | `#ratingCount3` | |
| Rating Bar 2★ | ProgressBar | `#ratingBar2` | |
| Rating Count 2★ | Text | `#ratingCount2` | |
| Rating Bar 1★ | ProgressBar | `#ratingBar1` | |
| Rating Count 1★ | Text | `#ratingCount1` | |
| Sort Dropdown | Dropdown | `#reviewsSortDropdown` | Newest, Highest, Lowest, Helpful |
| Reviews Repeater | Repeater | `#reviewsRepeater` | Review cards |
| → Author | Text | `#reviewAuthor` | "Jane S." |
| → Date | Text | `#reviewDate` | "January 15, 2026" |
| → Stars | Text | `#reviewStars` | ★★★★★ |
| → Title | Text | `#reviewTitle` | Bold |
| → Body | Text | `#reviewBody` | |
| → Verified Badge | Text/Box | `#reviewVerified` | "Verified Purchase", hidden default |
| → Photos | Gallery | `#reviewPhotos` | Up to 3 images, hidden default |
| → Helpful Button | Button | `#reviewHelpfulBtn` | "Helpful (3)" |
| → Helpful Count | Text | `#reviewHelpfulCount` | |
| Empty State | Text | `#reviewsEmptyState` | "Be the first to review", hidden default |
| Prev Page | Button | `#reviewsPrevBtn` | |
| Next Page | Button | `#reviewsNextBtn` | |
| Page Info | Text | `#reviewsPageInfo` | "Page 1 of 3" |

### Review Submission Form
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Form Container | Box | `#reviewForm` | Collapsible |
| Rating Input | Dropdown/Custom | `#reviewRatingInput` | Star selector 1-5 |
| Title Input | Input | `#reviewTitleInput` | Optional |
| Body Input | TextArea | `#reviewBodyInput` | Min 10 chars |
| Submit Button | Button | `#reviewSubmitBtn` | |
| Form Error | Text | `#reviewFormError` | Hidden default |
| Form Success | Text | `#reviewFormSuccess` | Hidden default |

### Financing Options Section
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section | Section | `#financingSection` | Collapsible, hidden if price < $50 |
| Teaser Text | Text | `#financingTeaser` | "As low as $50/mo" |
| Plan Repeater | Repeater | `#financingRepeater` | Payment plan cards |
| → Label | Text | `#planLabel` | "Pay in 4", "12 Months" |
| → Monthly | Text | `#planMonthly` | "$50/mo" |
| → Description | Text | `#planDescription` | "0% APR for 12 months" |
| → Interest Info | Text | `#planInterest` | "No interest" or "$663 total (9.99% APR)" |
| Learn More | Button | `#financingLearnMore` | Opens modal |
| Overlay | Box | `#financingOverlay` | Semi-transparent backdrop |
| Modal | Box | `#financingModal` | Centered lightbox |
| → Close Button | Button | `#financingClose` | X icon |
| → Detail Repeater | Repeater | `#financingDetailRepeater` | Full plan breakdown |
| →→ Label | Text | `#detailLabel` | Plan name |
| →→ Term | Text | `#detailTerm` | "12 payments" |
| →→ Monthly | Text | `#detailMonthly` | "$50/mo" |
| →→ Total | Text | `#detailTotal` | "Total: $600" |
| →→ APR | Text | `#detailApr` | "0% APR" or "9.99% APR" |
| →→ Interest | Text | `#detailInterest` | "No interest charges" or "Interest: $63.12" |

### Quantity Selector
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Quantity Input | Input | `#quantityInput` | Default "1", numeric only |
| Minus Button | Button | `#quantityMinus` | Decrease qty, min 1 |
| Plus Button | Button | `#quantityPlus` | Increase qty, max 99 |

### Fabric Swatch Selector
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Swatch Section | Section | `#swatchSection` | Collapsible, hidden if no swatches |
| Swatch Count | Text | `#swatchCount` | "Showing X of Y+ available fabrics" |
| Color Family Filter | Dropdown | `#swatchColorFilter` | Filter swatches by color family |
| Swatch Grid | Repeater | `#swatchGrid` | Grid of clickable swatch thumbnails |
| → Swatch Thumbnail | Image | `#swatchThumb` | 60x60 swatch image or color-filled box |
| → Swatch Label | Text | `#swatchLabel` | Swatch name tooltip |
| Tint Overlay | Box | `#swatchTintOverlay` | Semi-transparent color overlay on main image, hidden default |
| View All Button | Button | `#swatchViewAll` | Opens full swatch gallery lightbox |
| Request Swatches Link | Button | `#swatchRequestLink` | Links to /request-swatches |

### Full Swatch Gallery Lightbox
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Gallery Modal | Box | `#swatchGalleryModal` | Full-screen modal overlay, hidden default |
| Search Input | Input | `#swatchSearch` | Filter swatches by name/color/material |
| Gallery Grid | Repeater | `#swatchGalleryGrid` | Large grid of all swatches (120x120) |
| → Thumbnail | Image | `#sgThumb` | Larger swatch image inside repeater |
| → Name | Text | `#sgName` | Swatch name inside repeater |
| → Material | Text | `#sgMaterial` | Material type inside repeater |
| Close Button | Button | `#swatchGalleryClose` | X icon, closes modal |
| Detail Panel | Box | `#swatchDetail` | Collapsed by default, shows selected swatch info |
| → Detail Name | Text | `#swatchDetailName` | Selected swatch name |
| → Detail Material | Text | `#swatchDetailMaterial` | "Material: ..." |
| → Detail Care | Text | `#swatchDetailCare` | "Care: ..." |
| → Detail Family | Text | `#swatchDetailFamily` | "Color Family: ..." |
| → Detail Image | Image | `#swatchDetailImage` | Large swatch preview, hidden default |

### Swatch Request Modal
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Request Button | Button | `#swatchRequestBtn` | "Request Free Swatches", hidden if no fabric options |
| Modal Container | Box | `#swatchModal` | Centered lightbox, hidden default |
| Product Name | Text | `#swatchProductName` | Shows current product name |
| Options Repeater | Repeater | `#swatchOptions` | Fabric/finish checkbox list |
| → Checkbox | Checkbox | `#swatchCheckbox` | Inside repeater, selectable swatch option |
| Name Input | Input | `#swatchName` | Customer name |
| Email Input | Input | `#swatchEmail` | Customer email |
| Address Input | TextArea | `#swatchAddress` | Mailing address for swatches |
| Submit Button | Button | `#swatchSubmit` | Sends swatch request |
| Success Message | Text | `#swatchSuccess` | Hidden default, "Swatches on the way!" |
| Error Message | Text | `#swatchError` | Hidden default, error fallback |

### Product Video Section
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Video Section | Section | `#productVideoSection` | Collapsible, hidden if no video media |
| Section Title | Text (H3) | `#productVideoTitle` | "See It In Action" |
| Video Player | VideoPlayer | `#productVideo` | Auto-muted product demo video |
| View All Videos Link | Button | `#viewAllVideosLink` | Links to /product-videos |

### Product Info Accordion
Collapsible sections for Description, Dimensions, Care, and Shipping info.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Description Header | Button/Box | `#infoHeaderDescription` | Clickable accordion toggle |
| Description Content | Box | `#infoContentDescription` | Expanded by default |
| Description Arrow | Text | `#infoArrowDescription` | "−" when open, "+" when closed |
| Dimensions Header | Button/Box | `#infoHeaderDimensions` | Clickable accordion toggle |
| Dimensions Content | Box | `#infoContentDimensions` | Collapsed by default |
| Dimensions Arrow | Text | `#infoArrowDimensions` | "+" default |
| Care Header | Button/Box | `#infoHeaderCare` | Clickable accordion toggle |
| Care Content | Box | `#infoContentCare` | Collapsed by default |
| Care Arrow | Text | `#infoArrowCare` | "+" default |
| Shipping Header | Button/Box | `#infoHeaderShipping` | Clickable accordion toggle |
| Shipping Content | Box/Text | `#infoContentShipping` | Collapsed by default, auto-populated with shipping policy |
| Shipping Arrow | Text | `#infoArrowShipping` | "+" default |

### Wishlist / Save Button
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Wishlist Button | Button | `#wishlistBtn` | Heart icon toggle, hidden if Members API unavailable |
| Wishlist Icon | Image | `#wishlistIcon` | Swaps between outline and filled heart SVG |

### Stock Urgency & Popularity
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Stock Urgency | Text | `#stockUrgency` | "Only X left in stock", hidden default, shows when qty < 5 |
| Popularity Badge | Text | `#popularityBadge` | "Popular — X sold this week", hidden default |

### Delivery Estimate & White Glove
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Delivery Estimate | Text | `#deliveryEstimate` | "Estimated delivery: Mar 5 – Mar 12" |
| White-Glove Note | Text | `#whiteGloveNote` | "White-glove delivery available — call ...", hidden default |

### Sticky Add-to-Cart Bar
Fixed bottom bar that appears when the main Add to Cart button scrolls out of view.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Sticky Bar | Box | `#stickyCartBar` | Fixed bottom, hidden default, slides up on scroll |
| Product Name | Text | `#stickyProductName` | Mirrors current product name |
| Price | Text | `#stickyPrice` | Mirrors current variant price |
| Add to Cart | Button | `#stickyAddBtn` | Coral bg, respects quantity selection |

### Social Share Buttons
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Share Facebook | Button | `#shareFacebook` | Opens Facebook share dialog |
| Share Pinterest | Button | `#sharePinterest` | Opens Pinterest pin create |
| Share Email | Button | `#shareEmail` | Opens mailto: compose |
| Copy Link | Button | `#shareCopyLink` | Copies product URL to clipboard |

### Product Badge Overlay
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Badge Overlay | Text | `#productBadgeOverlay` | Sale/New/Featured badge on main image area, hidden default |

### Back-in-Stock Notification
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section | Box | `#backInStockSection` | Collapsed default, expands when variant is out of stock |
| Email Input | Input | `#backInStockEmail` | Guest email for restock notification |
| Submit Button | Button | `#backInStockBtn` | "Notify Me" |
| Success Message | Text | `#backInStockSuccess` | Hidden default, confirms signup |

### Frequently Bought Together Bundle
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section | Section | `#bundleSection` | Collapsible, hidden if no bundle suggestion |
| Bundle Image | Image | `#bundleImage` | Companion product image |
| Bundle Name | Text | `#bundleName` | Companion product name |
| Bundle Price | Text | `#bundlePrice` | Discounted bundle price |
| Bundle Savings | Text | `#bundleSavings` | "Save $X" |
| Add Both Button | Button | `#addBundleBtn` | "Add Both to Cart", adds current + companion |

### Open Graph Meta
| Element | Type | ID | Notes |
|---------|------|----|-------|
| OG Tags | HtmlComponent | `#productOgHtml` | Hidden, Open Graph meta tags for social sharing |

### Recently Viewed Products
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section | Section | `#recentlyViewedSection` | Collapsible, hidden if empty |
| Repeater | Repeater | `#recentlyViewedRepeater` | 4-col |
| → Image | Image | `#recentImage` | |
| → Name | Text | `#recentName` | |
| → Price | Text | `#recentPrice` | |

---

## Page: CATEGORY PAGE (u0gn0)

### Hero Section
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Hero Container | Section | `#categoryHeroSection` | Dynamic bg per category |
| Category Title | Text (H1) | `#categoryHeroTitle` | Dynamic from URL |
| Category Subtitle | Text | `#categoryHeroSubtitle` | |

### Breadcrumbs
| Element | Type | ID |
|---------|------|----|
| Home Link | Text/Link | `#breadcrumbHome` |
| Current Page | Text | `#breadcrumbCurrent` |

### Filter Bar (Basic)
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Brand Filter | Dropdown | `#filterBrand` | All Brands, Night & Day, Strata, etc. |
| Price Filter | Dropdown | `#filterPrice` | Predefined price ranges |
| Size Filter | Dropdown | `#filterSize` | Full, Queen, Twin |
| Clear Filters | Button | `#clearFilters` | Resets basic filters |
| Sort Dropdown | Dropdown | `#sortDropdown` | Best Selling, Name, Price, Newest |
| Result Count | Text | `#resultCount` | "X products" |

### Advanced Faceted Filters
Powered by `searchService.web.js` — dynamically populated from category product data.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Material Filter | CheckboxGroup/Dropdown | `#filterMaterial` | Dynamically populated with counts, e.g. "Wood (12)" |
| Color Filter | CheckboxGroup/Dropdown | `#filterColor` | Dynamically populated with counts |
| Features Filter | CheckboxGroup/Dropdown | `#filterFeatures` | Tag-based feature toggles, e.g. "Space Saving", "Storage" |
| Price Range Slider | Slider/Dropdown | `#filterPriceRange` | Enhanced price range control |
| Width Min | Input | `#filterWidthMin` | Minimum width in inches, placeholder from facet data |
| Width Max | Input | `#filterWidthMax` | Maximum width in inches, placeholder from facet data |
| Depth Min | Input | `#filterDepthMin` | Minimum depth in inches, placeholder from facet data |
| Depth Max | Input | `#filterDepthMax` | Maximum depth in inches, placeholder from facet data |
| Filter Result Count | Text | `#filterResultCount` | Live count, "X products" — updates on filter change |
| Clear All Filters | Button | `#clearAllFilters` | Resets all basic + advanced filters and URL params |
| Loading Indicator | Box/Image | `#filterLoadingIndicator` | Spinner shown during filter query, hidden default |

### Mobile Filter Drawer
Bottom sheet for filter controls on mobile devices.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Toggle Button | Button | `#filterToggleBtn` | "Filters" — opens drawer, shown only on mobile |
| Drawer | Box | `#filterDrawer` | Slide-up bottom sheet containing all filter controls, hidden default |
| Drawer Overlay | Box | `#filterDrawerOverlay` | Semi-transparent backdrop, hidden default |
| Apply Button | Button | `#filterDrawerApply` | "Apply" — closes drawer after selections |

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
| → Badge | Text/Box | `#gridBadge` | "New", "Featured", etc., hidden default |
| → Fabric Badge | Text | `#gridFabricBadge` | "700+ Fabric Options", hidden default |
| → Compare Button | Button | `#gridCompareBtn` | Add to compare bar |
| → Swatch Preview | Box | `#gridSwatchPreview` | Container for swatch color dots, collapsible |
| →→ Swatch Dot 1 | Box | `#swatchDot1` | Small color circle inside repeater, hidden default |
| →→ Swatch Dot 2 | Box | `#swatchDot2` | Small color circle inside repeater, hidden default |
| →→ Swatch Dot 3 | Box | `#swatchDot3` | Small color circle inside repeater, hidden default |
| →→ Swatch Dot 4 | Box | `#swatchDot4` | Small color circle inside repeater, hidden default |

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

### Empty State (No Products in Category)
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Empty Container | Section | `#emptyStateSection` | Shown when category has zero products |
| Empty Title | Text (H2) | `#emptyStateTitle` | "No products found" |
| Empty Message | Text | `#emptyStateMessage` | Suggestion text with category name |
| Empty Illustration | Image | `#emptyStateIllustration` | Mountain illustration |

### No-Matches State (Filters Returned Zero)
Shown when advanced filters produce no results. Different from empty state.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| No Matches Section | Section | `#noMatchesSection` | Hidden default, shown when filter result is 0 |
| No Matches Title | Text (H2) | `#noMatchesTitle` | "No products match" |
| No Matches Message | Text | `#noMatchesMessage` | "Try removing some filters..." with category name |
| No Matches Suggestion | Text | `#noMatchesSuggestion` | "Try adjusting your price range or removing material filters." |

### Recently Viewed Products
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section | Section | `#recentlyViewedSection` | Collapsible, hidden if empty |
| Section Title | Text (H2) | `#recentlyViewedTitle` | "Recently Viewed" |
| Repeater | Repeater | `#recentlyViewedRepeater` | Standard product card layout, 6 items max |
| → Image | Image | `#recentImage` | |
| → Name | Text | `#recentName` | |
| → Price | Text | `#recentPrice` | |

### Product Comparison Bar
Sticky bottom bar showing selected products for comparison.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Compare Bar | Box | `#compareBar` | Sticky bottom, hidden default |
| Compare Repeater | Repeater | `#compareRepeater` | 2-4 selected items |
| → Thumbnail | Image | `#compareThumb` | Small product image |
| → Name | Text | `#compareName` | |
| → Price | Text | `#comparePrice` | |
| → Remove | Button | `#compareRemove` | X icon |

### Schema Elements
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Category Schema | HtmlComponent | `#categorySchemaHtml` | Hidden, CollectionPage JSON-LD |
| Breadcrumb Schema | HtmlComponent | `#categoryBreadcrumbSchemaHtml` | Hidden |
| Open Graph | HtmlComponent | `#categoryOgHtml` | Hidden, OG meta tags |

---

## Page: CART PAGE (mqi5m)

### Empty Cart State
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Empty Container | Section | `#emptyCartSection` | Shown when cart is empty |
| Empty Title | Text (H2) | `#emptyCartTitle` | "Your cart is empty" |
| Empty Message | Text | `#emptyCartMessage` | Suggestion text |
| Continue Shopping | Button | `#continueShoppingBtn` | → /shop-main |

### Shipping Progress Bar
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Progress Bar | ProgressBar | `#shippingProgressBar` | 0-100 |
| Progress Text | Text | `#shippingProgressText` | "$X away from free shipping" |
| Progress Icon | Image | `#shippingProgressIcon` | Checkmark, hidden default |

### Loyalty Tier Progress
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Tier Progress Bar | ProgressBar | `#tierProgressBar` | Shows loyalty tier progress |
| Tier Progress Text | Text | `#tierProgressText` | "X points to next tier" |

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

### Recently Viewed (Cart)
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section | Section | `#cartRecentSection` | Collapsible, hidden if empty |
| Repeater | Repeater | `#cartRecentRepeater` | 3-col |
| → Image | Image | `#cartRecentImage` | |
| → Name | Text | `#cartRecentName` | |
| → Price | Text | `#cartRecentPrice` | |

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
| → Line Total | Text | `#sideItemLineTotal` | Price × qty |
| → Remove | Button | `#sideItemRemove` | X icon |
| Footer | Box | `#sideCartFooter` | |
| Subtotal | Text | `#sideCartSubtotal` | |
| Shipping Bar | ProgressBar | `#sideShippingBar` | Mini version |
| Shipping Text | Text | `#sideShippingText` | |
| Tier Progress Bar | ProgressBar | `#sideTierBar` | Loyalty tier in side cart |
| Tier Progress Text | Text | `#sideTierText` | |
| View Cart | Button | `#viewFullCart` | Secondary button |
| Checkout | Button | `#sideCartCheckout` | Primary coral button |
| Suggestion Box | Box | `#sideCartSuggestion` | Collapsible |
| → Label | Text | `#sideSugLabel` | "Complete Your Futon" |
| → Repeater | Repeater | `#sideSugRepeater` | 1-2 suggestion items |
| → → Image | Image | `#sideSugImage` | Inside repeater |
| → → Name | Text | `#sideSugName` | Inside repeater |
| → → Price | Text | `#sideSugPrice` | Inside repeater |
| → → Add | Button | `#sideSugAdd` | "Add" |

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
| Search Input | Input | `#faqSearchInput` | Filter FAQs by keyword |
| FAQ Repeater | Repeater | `#faqRepeater` | Accordion style |
| → Question | Text (H3) | `#faqQuestion` | Clickable |
| → Answer | Text | `#faqAnswer` | Collapsible |
| → Toggle Icon | Text | `#faqToggle` | +/− |
| No Results | Text | `#faqNoResults` | "No matching questions", hidden default |
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
| → Add to Cart | Button | `#searchAddBtn` | Quick add from search results |

---

## Page: SHIPPING / GETTING IT HOME (ype8c)

> **Code file:** `src/pages/Shipping Policy.js`

| Element | Type | ID |
|---------|------|----|
| ZIP Input | Input | `#shippingZipInput` |
| Calculate Button | Button | `#shippingCalcBtn` |
| Result Text | Text | `#shippingResult` |
| Delivery Repeater | Repeater | `#deliveryRepeater` |
| → Title | Text | `#deliveryTitle` |
| → Description | Text | `#deliveryDesc` |
| Assembly Tips | Text | `#assemblyTips` |
| Schema | HtmlComponent | `#shippingSchemaHtml` | Hidden, shipping info JSON-LD |

---

## Page: PRODUCT VIDEOS (vu50r)

> **Wix Page Layout:** Fullscreen Page (no header/footer). The code for this page lives in `src/pages/Fullscreen Page.js`.

| Element | Type | ID |
|---------|------|----|
| Videos Dataset | Dataset | `#videosDataset` | Connected to product videos |
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

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Trust Repeater | Repeater | `#trustRepeater` | Trust badges strip |
| → Trust Text | Text | `#trustText` | Badge label |
| Order Notes Toggle | Button | `#orderNotesToggle` | "Add order notes" |
| Order Notes Field | TextArea | `#orderNotesField` | Collapsible, hidden default |
| Free Shipping Message | Text | `#checkoutFreeShipping` | Hidden default, shows when qualifying |
| Item Count | Text | `#checkoutItemCount` | "X items in your order" |
| Delivery Estimate | Text | `#checkoutDeliveryEstimate` | "Estimated delivery: Mar 5 – Mar 12" |

### Checkout Progress Indicator
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Progress Nav | Box | `#checkoutProgressNav` | role="navigation", aria-label="Checkout progress" |
| Progress Repeater | Repeater | `#checkoutProgressRepeater` | 4 steps: Information, Shipping, Payment, Review |
| → Step Container | Box | `#progressStepContainer` | aria-current="step" on active |
| → Step Dot | Box | `#progressStepDot` | Circle — mountainBlue=active, success=done, sandDark=pending |
| → Step Number | Text | `#progressStepNumber` | "1", "2", etc. Hidden when completed |
| → Step Check | Text/Icon | `#progressStepCheck` | Checkmark, hidden default, shown when completed |
| → Step Label | Text | `#progressStepLabel` | "Information", "Shipping", "Payment", "Review" |

### Inline Address Validation Errors
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Name Error | Text | `#addressFullNameError` | Hidden default, role="alert" |
| Street Error | Text | `#addressLine1Error` | Hidden default, role="alert" |
| City Error | Text | `#addressCityError` | Hidden default, role="alert" |
| State Error | Text | `#addressStateError` | Hidden default, role="alert" |
| ZIP Error | Text | `#addressZipError` | Hidden default, role="alert" |

### Order Summary Sidebar
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Sidebar | Box | `#orderSummarySidebar` | Sticky sidebar, hidden default |
| Items Repeater | Repeater | `#orderSummaryItemsRepeater` | Line items list |
| → Item Name | Text | `#summaryItemName` | Product name |
| → Item Qty | Text | `#summaryItemQty` | "×2" |
| → Item Price | Text | `#summaryItemPrice` | "$299.00" |
| Subtotal | Text | `#orderSummarySubtotal` | |
| Shipping | Text | `#orderSummaryShipping` | "FREE" or "$49.99" |
| Tax | Text | `#orderSummaryTax` | |
| Total | Text | `#orderSummaryTotal` | Bold |
| Savings | Text | `#orderSummarySavings` | Hidden default, shows shipping savings |

### Express Checkout
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section | Box | `#expressCheckoutSection` | Hidden default |
| Button | Button | `#expressCheckoutBtn` | Disabled until address validated |
| Summary Section | Box | `#expressSummarySection` | Hidden default, shows after click |
| Summary Total | Text | `#expressSummaryTotal` | "Total: $1,067.50" |
| Summary Shipping | Text | `#expressSummaryShipping` | "Free Shipping" or cost |
| Summary Address | Text | `#expressSummaryAddress` | One-line formatted address |

---

## Page: THANK YOU (dk9x8)

### Order Confirmation
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Title | Text (H1) | `#thankYouTitle` | "Thank You!" |
| Order Number | Text | `#orderNumber` | "Order #12345" |
| Message | Text | `#thankYouMessage` | Personalized confirmation |
| Contact Info | Text | `#orderContactInfo` | Confirmation email note |

### Personal Touch (Owner Message)
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section | Section | `#brendaMessageSection` | Collapsible |
| Title | Text (H3) | `#brendaTitle` | "A Note From Brenda" |
| Message | Text | `#brendaMessage` | Personal message from owner |

### Delivery Timeline
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Timeline | Box | `#deliveryTimeline` | Visual delivery status steps |
| Estimate Text | Text | `#deliveryEstimateText` | "Expected delivery: Mar 5-12" |

### Social Sharing
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Share Text | Text | `#shareText` | "Share your purchase" |
| Share Facebook | Button | `#shareFacebook` | |
| Share Pinterest | Button | `#sharePinterest` | |
| Share Instagram | Button | `#shareInstagram` | |

### Newsletter Signup
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Newsletter Prompt | Text | `#newsletterPrompt` | |
| Newsletter Email | Input | `#newsletterEmail` | |
| Newsletter Signup | Button | `#newsletterSignup` | |
| Newsletter Success | Text | `#newsletterSuccess` | Hidden default |

### Referral Program
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section | Section | `#referralSection` | Collapsible |
| Title | Text (H3) | `#referralTitle` | "Share & Save" |
| Message | Text | `#referralMessage` | Referral program details |
| Copy Link | Button | `#referralCopyBtn` | Copy referral link to clipboard |
| Email Referral | Button | `#referralEmailBtn` | Send referral via email |

### Post-Purchase Recommendations
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Heading | Text (H2) | `#postPurchaseHeading` | "Complete Your Space" |
| Repeater | Repeater | `#postPurchaseRepeater` | 3-4 recommended products |
| → Image | Image | `#ppImage` | |
| → Name | Text | `#ppName` | |
| → Price | Text | `#ppPrice` | |

### Care & Assembly Info
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Care Section | Box | `#careSequenceInfo` | Collapsible |
| Care Text | Text | `#careSequenceText` | Care tips for purchased items |
| Assembly Section | Box | `#assemblyGuideSection` | Shown if ordered items need assembly |
| Assembly Title | Text (H3) | `#assemblyGuideTitle` | "Assembly Guide" |
| Assembly Text | Text | `#assemblyGuideText` | Instructions summary |
| Assembly Button | Button | `#assemblyGuideBtn` | Download PDF / view guide |

---

## Page: BLOG

Blog content is managed in Wix Blog dashboard. This code adds SEO, social sharing, product sidebar, and newsletter.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| SEO Schema | HtmlComponent | `#blogSeoSchema` | Hidden, Article/Business JSON-LD |

### Related Products Sidebar
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Section | Section | `#blogProductsSection` | Collapsible sidebar |
| Product Repeater | Repeater | `#blogProductsRepeater` | 2-4 featured products |
| → Image | Image | `#sidebarProductImage` | |
| → Name | Text | `#sidebarProductName` | |
| → Price | Text | `#sidebarProductPrice` | |
| → Link | Button | `#sidebarProductLink` | → Product page |

### Social Share Buttons
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Share Facebook | Button | `#shareFacebook` | Share article |
| Share Pinterest | Button | `#sharePinterest` | |
| Share Twitter | Button | `#shareTwitter` | |
| Share Email | Button | `#shareEmail` | mailto: link |

### Newsletter CTA
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Email Input | Input | `#blogNewsletterEmail` | |
| Submit Button | Button | `#blogNewsletterSubmit` | |
| Error Message | Text | `#blogNewsletterError` | Hidden default |
| Success Message | Text | `#blogNewsletterSuccess` | Hidden default |

---

## Page: BLOG POST

Individual blog post page. Wix Blog renders content; this adds Article + FAQ JSON-LD schema.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| SEO Schema | HtmlComponent | `#postSeoSchema` | Hidden, Article + FAQPage JSON-LD |

---

## Page: MEMBER PAGE (Account Dashboard)

Logged-in member account page with order history, wishlist, loyalty, address book, and settings.

### Dashboard Summary
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Welcome Text | Text (H1) | `#memberWelcome` | "Welcome back, [Name]!" |
| Order Count | Text | `#memberOrderCount` | Total orders number |
| Wishlist Count | Text | `#memberWishCount` | Saved items number |
| Loyalty Points | Text | `#memberPointsDisplay` | "X pts" |
| Loyalty Tier | Text | `#memberTierDisplay` | "Bronze" / "Silver" / "Gold" |
| Quick Link: Orders | Button | `#dashQuickOrders` | Scrolls to orders section |
| Quick Link: Wishlist | Button | `#dashQuickWishlist` | Scrolls to wishlist section |
| Quick Link: Settings | Button | `#dashQuickSettings` | Scrolls to settings section |

### Order History
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Orders Repeater | Repeater | `#ordersRepeater` | Order cards |
| → Order Number | Text | `#orderNumber` | "Order #12345" |
| → Date | Text | `#orderDate` | Formatted date |
| → Total | Text | `#orderTotal` | "$X.XX" |
| → Status Badge | Text/Box | `#orderStatusBadge` | Color-coded status |
| → Status Text | Text | `#orderStatus` | Fallback for status badge |
| → Track Button | Button | `#orderTrackBtn` | → Tracking page, hidden if no tracking |
| → Reorder Button | Button | `#orderReorderBtn` | Adds all items to cart |
| → Start Return | Button | `#orderStartReturnBtn` | Opens returns flow, hidden for cancelled orders |
| → Items Gallery | Gallery | `#orderItemsGallery` | Thumbnails of ordered items |

### Wishlist / Saved Items
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Wishlist Repeater | Repeater | `#wishlistRepeater` | Saved product cards |
| → Image | Image | `#wishImage` | |
| → Name | Text | `#wishName` | |
| → Price | Text | `#wishPrice` | Current price |
| → Sale Price | Text | `#wishSalePrice` | Strikethrough compare price, hidden default |
| → Stock Status | Text | `#wishStockStatus` | "In Stock" / "Special Order" |
| → Add to Cart | Button | `#wishAddToCartBtn` | |
| → View Product | Button | `#wishViewBtn` | → Product page |
| → Remove | Button | `#wishRemoveBtn` | Remove from wishlist |
| → Alert Toggle | Toggle | `#wishAlertToggle` | Per-product mute/unmute for price drop & back-in-stock alerts |
| → Card Container | Box | `#wishCard` | Collapses on removal |
| Sort Dropdown | Dropdown | `#wishSortDropdown` | Newest, price, name |
| Share Wishlist | Button | `#wishShareBtn` | Copy link to clipboard |
| Share Pinterest | Button | `#wishSharePinterest` | |
| Share Email | Button | `#wishShareEmail` | |
| Share Facebook | Button | `#wishShareFacebook` | |

### Address Book
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Address Section | Box | `#addressBook` | |
| Address Repeater | Repeater | `#addressRepeater` | Saved addresses |
| → Address Text | Text | `#addressText` | Formatted address lines |
| Empty State | Box | `#addressEmptyState` | "No addresses saved" |

### Communication Preferences
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Preferences Section | Box | `#commPrefs` | |
| Newsletter Toggle | Toggle | `#prefNewsletter` | Receive newsletter |
| Sale Alerts Toggle | Toggle | `#prefSaleAlerts` | Receive sale alerts |
| Back-in-Stock Toggle | Toggle | `#prefBackInStock` | Receive restock notifications |

### Account Settings
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Settings Section | Box | `#accountSettings` | |
| Logout Button | Button | `#logoutBtn` | |

### Error Fallback
| Element | Type | ID | Notes |
|---------|------|----|-------|
| Error Box | Box | `#memberErrorFallback` | Hidden default |
| Error Text | Text | `#memberErrorText` | Error message |

---

## Page: SEARCH SUGGESTIONS BOX

Autocomplete dropdown shown as user types in search input. Attaches to header search.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Search Input | Input | `#searchInput` | Connected to header search |
| Suggestions Box | Box | `#suggestionsBox` | Dropdown container, collapsed default |
| Suggestions Repeater | Repeater | `#suggestionsRepeater` | 5 results max |
| → Image | Image | `#sugImage` | Product thumbnail |
| → Name | Text | `#sugName` | Product name |
| → Price | Text | `#sugPrice` | Formatted price |

---

## Page: ACCESSIBILITY STATEMENT

Static page for WCAG compliance. Content managed entirely in Wix editor — no custom elements needed.
Uses standard Wix text/rich text elements. No custom IDs required.

---

## Page: PRIVACY POLICY

| Element | Type | ID | Notes |
|---------|------|----|-------|
| TOC Repeater | Repeater | `#policyTocRepeater` | Table of contents navigation |
| → TOC Link | Text/Link | `#tocLink` | Jump to section |

Policy sections use anchor IDs for TOC navigation:
`#policyCollect`, `#policyUse`, `#policySharing`, `#policyRights`, `#policyContact`

---

## Page: TERMS & CONDITIONS

| Element | Type | ID | Notes |
|---------|------|----|-------|
| TOC Repeater | Repeater | `#termsTocRepeater` | Table of contents navigation |
| → TOC Link | Text/Link | `#tocLink` | Jump to section |

Terms sections use anchor IDs for TOC navigation:
`#termsAcceptance`, `#termsProducts`, `#termsOrders`, `#termsShipping`, `#termsReturns`, `#termsWarranties`, `#termsLiability`, `#termsContact`

---

## Page: REFUND POLICY

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Policy Repeater | Repeater | `#policyRepeater` | Accordion sections |
| → Title | Text (H3) | `#policyTitle` | Clickable to expand |
| → Content | Text | `#policyContent` | Collapsible, hidden default |
| → Toggle Icon | Text | `#policyToggle` | +/− |

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

### 5. Reviews (for customer product reviews)
| Field | Type | Notes |
|-------|------|-------|
| productId | Text | Reference to Stores/Products |
| memberId | Text | Reference to Members |
| authorName | Text | "FirstName L." format |
| rating | Number | 1-5 stars |
| title | Text | Review title (optional) |
| body | Text | Review text (min 10 chars) |
| photos | MediaGallery | Up to 3 review photos |
| verifiedPurchase | Boolean | Checked against order history |
| helpful | Number | Helpful vote count |
| status | Text | "pending" / "approved" / "rejected" |

### 6. MemberPreferences (for communication opt-in/opt-out)
| Field | Type | Notes |
|-------|------|-------|
| memberId | Text | Reference to Members |
| newsletter | Boolean | Receive newsletter emails |
| saleAlerts | Boolean | Receive sale alert emails |
| backInStock | Boolean | Receive back-in-stock notifications |

---

## Triggered Email Templates to Create
(In Wix Dashboard → Marketing → Triggered Emails)

1. **contact_form_submission** - Variables: customerName, customerEmail, customerPhone, subject, message, submittedAt
2. **new_order_notification** - Variables: orderNumber, customerName, total, itemCount

---

## Page 10: Order Tracking (Route: `/tracking`)

**Purpose**: Customer self-service order tracking — lookup by order number + email, real-time UPS shipment status, delivery timeline, activity history, notification opt-in.

**Code file**: `src/pages/Order Tracking.js`
**Backend**: `src/backend/orderTracking.web.js` (lookupOrder, subscribeToNotifications, unsubscribeFromNotifications, getTrackingTimeline)

### Layout

| Section | Element | Selector | Notes |
|---------|---------|----------|-------|
| **Lookup Form** | | | |
| Title | Text | `#trackingTitle` | "Track Your Order" |
| Subtitle | Text | `#trackingSubtitle` | Instructions |
| Order Number | Input | `#orderNumberInput` | Text input, required |
| Email | Input | `#emailInput` | Text input, required |
| Submit | Button | `#trackOrderBtn` | Primary CTA |
| Error | Text | `#trackingError` | Hidden by default, coral color |
| Loader | Element | `#trackingLoader` | Spinner, hidden by default |
| **Results Section** | Container | `#trackingResultsSection` | Collapsed by default |
| Order Number | Text | `#resultOrderNumber` | "Order #10042" |
| Order Date | Text | `#resultOrderDate` | "Placed January 15, 2026" |
| Status Badge | Text | `#resultStatus` | Color-coded by fulfillment status |
| Status Desc | Text | `#resultStatusDescription` | e.g. "Your package is on its way" |
| New Search | Button | `#newSearchBtn` | "Track Another Order" |
| Refresh | Button | `#refreshTrackingBtn` | Refresh tracking data |
| **Timeline** | Container | `#trackingTimeline` | 5-step horizontal/vertical progress |
| Step 0 | Box | `#timelineStep0` | "Order Placed" |
| Step 0 Dot | Box | `#timelineDot0` | Circle indicator |
| Step 0 Label | Text | `#timelineLabel0` | |
| Step 1 | Box | `#timelineStep1` | "Shipped" |
| Step 1 Dot | Box | `#timelineDot1` | |
| Step 1 Label | Text | `#timelineLabel1` | |
| Step 2 | Box | `#timelineStep2` | "In Transit" |
| Step 2 Dot | Box | `#timelineDot2` | |
| Step 2 Label | Text | `#timelineLabel2` | |
| Step 3 | Box | `#timelineStep3` | "Out for Delivery" |
| Step 3 Dot | Box | `#timelineDot3` | |
| Step 3 Label | Text | `#timelineLabel3` | |
| Step 4 | Box | `#timelineStep4` | "Delivered" |
| Step 4 Dot | Box | `#timelineDot4` | |
| Step 4 Label | Text | `#timelineLabel4` | |
| **Shipping Details** | Container | `#shippingDetailsSection` | |
| Carrier | Text | `#carrierName` | "UPS" |
| Service | Text | `#serviceName` | "UPS Ground" |
| Tracking # | Text | `#trackingNumberText` | Full tracking number |
| Est. Delivery | Text | `#estimatedDelivery` | "Estimated delivery: Friday, March 5" |
| Destination | Text | `#shippingDestination` | "Delivering to Charlotte, NC 28202" |
| UPS Link | Button | `#upsTrackingBtn` | Opens UPS tracking in new tab |
| No Tracking | Text | `#noTrackingMessage` | Shown when order has no tracking yet |
| **Line Items** | Container | `#lineItemsSection` | |
| Items | Repeater | `#trackingItemsRepeater` | Order line items |
| → Image | Image | `#itemImage` | Product thumbnail |
| → Name | Text | `#itemName` | Product name |
| → Qty | Text | `#itemQty` | "Qty: 1" |
| → Price | Text | `#itemPrice` | "$599.00" |
| → SKU | Text | `#itemSku` | "SKU: FRAME-001" |
| **Totals** | | | |
| Subtotal | Text | `#totalSubtotal` | |
| Shipping | Text | `#totalShipping` | "Free" if $0 |
| Total | Text | `#totalAmount` | Bold |
| **Activity Log** | Container | `#activitySection` | UPS tracking activities |
| Activities | Repeater | `#activityRepeater` | Chronological list |
| → Status | Text | `#activityStatus` | "Departed Facility" |
| → Location | Text | `#activityLocation` | "Charlotte, NC" |
| → Date/Time | Text | `#activityDateTime` | "Jan 15 2:30 PM" |
| **Notifications** | Container | `#notificationSection` | |
| Toggle | Switch | `#notificationToggle` | Opt-in/out email updates |
| Label | Text | `#notificationLabel` | Toggle description |

### Design Notes
- **Color coding**: Green (delivered/success), Mountain Blue (in-transit/active), Coral (exception/error), Muted (pending)
- **Timeline**: Horizontal on desktop, vertical on mobile. Dots are circles with connecting line between them.
- **Auto-refresh**: Page refreshes tracking every 5 min for active shipments (not delivered/returned)
- **Accessibility**: All interactive elements have aria-labels, form validates on Enter key
- **Prefill**: Accepts `?order=XXXXX&email=x@x.com` query params from Member Page links

---

## Illustration Assets Needed

1. **Mountain ridgeline header** - SVG, blue mountain silhouette for nav background
2. **Sunrise/sunset motif** - SVG, radiating lines with coral/orange gradient
3. **Cabin/A-frame hero frame** - SVG, illustrated wooden frame around hero content
4. **Illustrated map** - Contact page, hand-drawn style showing Hendersonville, NC
5. **Category card illustrations** - 6 unique illustrations for homepage category grid
6. **Footer mountain accent** - Smaller mountain silhouette for footer
