# Carolina Futons — Test Strategy & Deployment Checklist

**Site**: Experiment_2 (NOT the live site)
**Login**: halworker85@gmail.com (Google login)
**Last updated**: 2026-02-20

---

## Part 1: Pre-Deployment Setup Checklist

### A. Wix Secrets Manager (MUST DO FIRST)

| # | Secret Key | Value Source | Status |
|---|-----------|-------------|--------|
| 1 | `UPS_CLIENT_ID` | `ups_shiiping_and_label_printing.conf` line 3 | [ ] Stored |
| 2 | `UPS_CLIENT_SECRET` | `ups_shiiping_and_label_printing.conf` line 4 | [ ] Stored |
| 3 | `UPS_ACCOUNT_NUMBER` | `R055G4` | [ ] Stored |
| 4 | `UPS_SANDBOX` | `true` (use sandbox until fully tested) | [ ] Stored |
| 5 | `SITE_OWNER_CONTACT_ID` | Find in Dashboard > Contacts > filter for owner | [ ] Found & Stored |

**After storing all secrets**: DELETE `ups_shiiping_and_label_printing.conf` from local machine.

**How to store**:
1. Wix Dashboard > Developer Tools > Secrets Manager
2. Click "+ New Secret"
3. Enter key name exactly as shown (case-sensitive)
4. Paste value, save

### B. CMS Collections (MUST EXIST BEFORE CODE WORKS)

Create these collections in Wix Dashboard > CMS:

#### 1. ProductAnalytics
| Field | Type | Notes |
|-------|------|-------|
| productId | Text | Product ID from Wix Stores |
| productName | Text | Display name |
| category | Text | Collection slug |
| viewCount | Number | Default: 0 |
| lastViewed | Date | Auto-updated |
| addToCartCount | Number | Default: 0 |
| purchaseCount | Number | Default: 0 |
| weekSales | Number | Default: 0 |

**Used by**: analyticsHelpers.web.js, Product Page (popularity badge), getBestsellers()

#### 2. ContactSubmissions
| Field | Type | Notes |
|-------|------|-------|
| name | Text | Customer name |
| email | Text | Required |
| phone | Text | Optional |
| subject | Text | Form source |
| message | Text | Content / notes |
| submittedAt | Date | Auto-set |
| status | Text | new, swatch_request, exit_intent_signup, back_in_stock_request |
| source | Text | exit_intent_popup, back_in_stock, contact_form |
| notes | Text | Additional context |
| productId | Text | For back-in-stock |
| productName | Text | For back-in-stock |

**Used by**: emailService.web.js, contactSubmissions.web.js, Contact page, exit-intent, back-in-stock

#### 3. Wishlist
| Field | Type | Notes |
|-------|------|-------|
| memberId | Text | Wix member ID |
| productId | Text | Product ID |
| productName | Text | Display name |
| productImage | Image | Main product image |
| addedDate | Date | When saved |

**Used by**: Product Page (heart button), Member Page (wishlist tab)

#### 4. FabricSwatches
| Field | Type | Notes |
|-------|------|-------|
| swatchId | Text | Unique swatch identifier |
| swatchName | Text | Display name (e.g., "Marine Blue") |
| swatchImage | Image | Swatch photo |
| colorFamily | Text | Category: red, blue, green, neutral, etc. |
| colorHex | Text | Hex color code |
| material | Text | Fabric type (cotton, polyester, etc.) |
| careInstructions | Text | Washing/care info |
| availableForProducts | Text | Comma-separated product IDs or "all" |
| sortOrder | Number | Display order |

**Used by**: swatchService.web.js, Product Page swatch selector, Category Page swatch dots

#### 5. Promotions
| Field | Type | Notes |
|-------|------|-------|
| title | Text | Campaign headline |
| subtitle | Text | Secondary text |
| theme | Text | Campaign theme ID |
| heroImage | Image | Campaign image |
| startDate | Date | Campaign start |
| endDate | Date | Campaign end |
| discountCode | Text | Discount code to display |
| discountPercent | Number | Discount percentage |
| ctaUrl | URL | CTA button destination |
| ctaText | Text | CTA button label |
| productIds | Text | Comma-separated featured product IDs |
| isActive | Boolean | Enable/disable |

**Used by**: promotions.web.js, masterPage.js promo lightbox

#### 6. MemberPreferences
| Field | Type | Notes |
|-------|------|-------|
| memberId | Text | Wix member ID |
| newsletter | Boolean | Subscribed to newsletter |
| saleAlerts | Boolean | Receive sale notifications |
| backInStock | Boolean | Back-in-stock notifications |

**Used by**: Member Page communication preferences

#### 7. Fulfillments
| Field | Type | Notes |
|-------|------|-------|
| orderId | Text | Wix order ID |
| orderNumber | Text | Display order number |
| trackingNumber | Text | UPS tracking number |
| carrier | Text | "UPS" |
| service | Text | Service level (Ground, etc.) |
| labelUrl | URL | UPS label download URL |
| status | Text | pending, shipped, delivered |
| createdAt | Date | Ship date |
| updatedAt | Date | Last status update |
| estimatedDelivery | Date | Estimated arrival |
| deliveredAt | Date | Actual delivery |

**Used by**: fulfillment.web.js, Member Page order tracking

### C. Triggered Email Templates

Create in Dashboard > Marketing > Triggered Emails:

#### 1. `contact_form_submission`
| Variable | Description |
|----------|-------------|
| customerName | Submitter's name |
| customerEmail | Submitter's email |
| customerPhone | Submitter's phone |
| subject | Message subject |
| message | Message body |
| submittedAt | Formatted date/time |

#### 2. `new_order_notification`
| Variable | Description |
|----------|-------------|
| orderNumber | Order number |
| customerName | Buyer's name |
| total | Formatted order total |
| itemCount | Number of items |

### D. Wix Editor Element IDs

**CRITICAL**: All Velo code references element IDs via `$w('#elementId')`. These elements MUST be created in the Wix Studio editor with matching IDs before the code will work.

Full element spec: See `WIX-STUDIO-BUILD-SPEC.md`

**Priority elements to create first** (needed for Layer 1 testing):
- Master Page: `#announcementText`, `#headerSearchInput`, `#navHome` through `#navBlog`, `#businessSchemaHtml`, `#sideCartPanel`
- Home: `#heroTitle`, `#heroSubtitle`, `#heroCTA`, `#categoryShowcase`, `#featuredRepeater`, `#saleRepeater`
- Category Page: `#categoryHeroTitle`, `#categoryHeroSubtitle`, `#productGrid`, `#sortDropdown`, `#filterPanel`, `#resultCount`
- Product Page: `#productDataset`, `#productMainImage`, `#productGallery`, `#productPrice`, `#sizeDropdown`, `#finishDropdown`, `#addToCartButton`

### E. Photo Gallery / Media Manager

Upload real product images to Wix Media Manager:
- [ ] Product photos (at least 3 per product, various angles)
- [ ] Category hero images (1920x600, one per category)
- [ ] Category card images (600x400, one per category)
- [ ] About page team photos (Brenda, staff)
- [ ] Store interior/exterior photos
- [ ] Mountain/cabin illustration assets (see ILLUSTRATION-ASSET-SPEC.md)
- [ ] Logo files (main + footer variant)

**After uploading**: Update `src/public/placeholderImages.js` with real `wix:image://` URIs from Media Manager. Currently uses Unsplash placeholders.

### F. UPS Developer Portal

- [ ] Verify UPS Developer account is active
- [ ] Confirm API credentials work in sandbox mode
- [ ] Test OAuth token generation
- [ ] Verify account number `R055G4` has API access
- [ ] Origin address configured: 824 Locust St, Ste 200, Hendersonville, NC 28792

---

## Part 2: Incremental Testing Strategy

### Layer 1: Core Pages (Test First)

**Goal**: Verify page loads, navigation works, basic content renders.

#### 1.1 Master Page (masterPage.js)
| Test | Expected Result | Pass? |
|------|----------------|-------|
| Page loads without console errors | No red errors in console | [ ] |
| Announcement bar shows first message | "Free Shipping on Orders Over $999!" | [ ] |
| Announcement bar rotates every 5s | Messages cycle through all 5 | [ ] |
| Nav links highlight active page | Current page link is bold | [ ] |
| Search input accepts text + Enter | Redirects to /search-results?q=... | [ ] |
| Mobile menu opens/closes | Hamburger shows overlay, X closes | [ ] |
| Business schema HTML injected | Check `#businessSchemaHtml` in inspector | [ ] |

#### 1.2 Home Page (Home.js)
| Test | Expected Result | Pass? |
|------|----------------|-------|
| Hero section loads | Title, subtitle, CTA button visible | [ ] |
| Category showcase shows 8 categories | All cards with images and product counts | [ ] |
| Featured products load | Product grid with images, names, prices | [ ] |
| Sale highlights load | Discounted products with original/sale prices | [ ] |
| Trust signals display | "Family Owned Since 1991", etc. | [ ] |
| Category cards link to category pages | Clicking navigates correctly | [ ] |

#### 1.3 Category Page (Category Page.js)
| Test | Expected Result | Pass? |
|------|----------------|-------|
| Visit /futon-frames | Hero shows "Futon Frames" + subtitle | [ ] |
| Visit /mattresses | Hero shows "Mattresses" + subtitle | [ ] |
| Visit all 8 categories | Each shows correct hero content | [ ] |
| Product grid loads with products | Images, names, prices visible | [ ] |
| Sort dropdown works | Name A-Z, Z-A, Price low-high, high-low | [ ] |
| Result count updates | "Showing X products" reflects actual count | [ ] |
| Product badges display | Sale/New/Featured badges on products | [ ] |
| Click product → Product Page | Navigation works | [ ] |

#### 1.4 Product Page (Product Page.js)
| Test | Expected Result | Pass? |
|------|----------------|-------|
| Product loads with image and price | Main image, name, price, description | [ ] |
| Size dropdown updates price | Different sizes show different prices | [ ] |
| Finish dropdown updates price | Different finishes show different prices | [ ] |
| Gallery thumbnails switch main image | Clicking thumb updates main | [ ] |
| Related products load | "You Might Also Like" section | [ ] |
| Same collection products load | "More From This Collection" section | [ ] |
| Breadcrumbs show correct path | Home > Category > Product Name | [ ] |
| Product schema HTML injected | Check in inspector | [ ] |
| Alt text is SEO-optimized | Not just "product image" | [ ] |

### Layer 2: Cart Flow

**Goal**: Full purchase flow from add-to-cart through checkout.

| Test | Expected Result | Pass? |
|------|----------------|-------|
| Add to Cart works | Item added, success feedback shown | [ ] |
| Side cart auto-opens on add | Slide-out panel appears | [ ] |
| Cart Page shows items | Products, quantities, subtotal | [ ] |
| Quantity controls work | +/- buttons update qty and total | [ ] |
| Shipping progress bar (Cart) | Shows progress toward $999 free shipping | [ ] |
| Tiered discount bar | Shows 5%/$500 and 10%/$1000 progress | [ ] |
| Cross-sell suggestions load | "Complete Your Futon" section | [ ] |
| Remove item from cart | Item removed, totals update | [ ] |
| Proceed to Checkout | Navigates to checkout page | [ ] |
| Checkout trust signals show | Secure checkout message, phone number | [ ] |
| Side Cart shows incentives | Tiered discount progress | [ ] |
| Side Cart multi-suggest | Multiple product suggestions | [ ] |

### Layer 3: Engagement Features

**Prerequisite**: CMS collections must exist.

| Test | Expected Result | Pass? |
|------|----------------|-------|
| Swatch selector shows (PDP) | Color family filter + swatch grid | [ ] |
| Swatch click applies to product | Tint overlay or variant switch | [ ] |
| View All Swatches opens gallery | Full swatch modal with search | [ ] |
| Bundle suggestion shows (PDP) | "Complete Your Futon — Save 5%" | [ ] |
| Stock urgency shows | "Only X left" for low-stock items | [ ] |
| Delivery estimate shows | Date range (5-10 business days) | [ ] |
| Wishlist heart works | Toggle add/remove (requires login) | [ ] |
| Back-in-stock form shows | For out-of-stock variants | [ ] |
| Compare bar works | Add products, compare side-by-side | [ ] |
| Promotional lightbox shows | Active campaign with countdown | [ ] |
| Search autocomplete works | Suggestions appear as you type | [ ] |
| Recently viewed section | Shows on PDP and category pages | [ ] |
| Product Videos page | Gallery loads with category filters | [ ] |

### Layer 4: Member Features

**Prerequisite**: Create a test member account.

| Test | Expected Result | Pass? |
|------|----------------|-------|
| Member login | Login prompt → dashboard | [ ] |
| Member dashboard loads | Welcome message, quick stats | [ ] |
| Order history shows | Past orders with details | [ ] |
| Track order works | Tracking info displayed | [ ] |
| Reorder button works | Adds past order items to cart | [ ] |
| Wishlist shows saved items | Products with remove/sort | [ ] |
| Address book works | Add/edit/delete addresses | [ ] |
| Communication preferences | Newsletter/sale/back-in-stock toggles | [ ] |
| Logout works | Logs out, redirects to home | [ ] |

### Layer 5: Post-Purchase

| Test | Expected Result | Pass? |
|------|----------------|-------|
| Thank You page loads | Order confirmation message | [ ] |
| Brenda's message shows | Personal thank-you from owner | [ ] |
| Delivery timeline shows | 4-step progress indicator | [ ] |
| Social sharing works | Facebook, Pinterest, Instagram links | [ ] |
| Newsletter signup works | Email capture with success message | [ ] |
| Referral section shows | Copy link + email share | [ ] |
| Product suggestions load | "You Might Also Love" section | [ ] |

### Layer 6: Shipping (Requires UPS Secrets)

| Test | Expected Result | Pass? |
|------|----------------|-------|
| Shipping calculator (policy page) | Enter ZIP, get rate estimate | [ ] |
| Checkout shipping options | UPS rates appear during checkout | [ ] |
| Free shipping at $999+ | $0 shipping for qualifying orders | [ ] |
| Flat-rate fallback | If UPS API fails, show estimated flat rate | [ ] |
| Local delivery option | Appears for 287-289 ZIP codes | [ ] |
| Regional delivery option | Appears for 270-399 ZIP codes | [ ] |

### Layer 7: SEO & Analytics

| Test | Expected Result | Pass? |
|------|----------------|-------|
| LocalBusiness schema (all pages) | Valid JSON-LD in page source | [ ] |
| Product schema (PDP) | Valid Product schema with price/availability | [ ] |
| BreadcrumbList schema (PDP) | Valid breadcrumb trail | [ ] |
| FAQPage schema (FAQ page) | Valid FAQ schema | [ ] |
| WebSite schema (homepage) | Valid website schema | [ ] |
| Google Merchant feed | GET /_functions/googleMerchantFeed returns XML | [ ] |
| Meta descriptions set | Category pages have keyword-rich descriptions | [ ] |
| Alt text on all images | SEO-friendly alt text, not empty | [ ] |

---

## Part 3: Static Pages Verification

| Page | Route | Test | Pass? |
|------|-------|------|-------|
| About | /about | Timeline, team photos, JSON-LD | [ ] |
| Contact | /contact | Form validates, submits, sends email | [ ] |
| FAQ | /faq | Accordion expands, FAQPage schema | [ ] |
| Shipping Policy | /getting-it-home | Calculator loads, zones display | [ ] |
| Privacy Policy | /privacy-policy | TOC navigation works | [ ] |
| Refund Policy | /refund-policy | Accordion sections expand | [ ] |
| Terms & Conditions | /terms-conditions | TOC navigation works | [ ] |
| Accessibility | /accessibility | Statement displays correctly | [ ] |

---

## Part 4: Known Issues to Watch For

1. **CMS collections not yet created** → swatches, promotions, analytics will silently fail (safe, by design)
2. **UPS secrets not stored** → shipping calculator uses flat-rate fallback (safe)
3. **Missing editor elements** → try/catch blocks suppress errors (safe, but features won't show)
4. **Placeholder images** → Unsplash URLs used until real product photos uploaded to Media Manager
5. **`wix-stores-frontend` API** → some cart operations may need migration to `wix-ecom` (bead cf-295)
6. **Mobile responsiveness** → not yet tuned (bead cf-mnh)
7. **Gallery compare list** → test has minor ID mismatch (bead cf-vuk)

---

## Part 5: Post-Launch Monitoring

After initial testing passes, monitor for:
- [ ] Console errors on each page (check browser DevTools)
- [ ] Broken image links (missing Media Manager uploads)
- [ ] Shipping rate calculation accuracy
- [ ] Email delivery (contact form, order notification)
- [ ] CMS data writing (analytics, wishlists, contact submissions)
- [ ] Mobile layout on real devices (iPhone, Android)
- [ ] Page load speed (target: < 3s first meaningful paint)
- [ ] Google Search Console for schema validation
- [ ] Google Merchant Center feed acceptance

---

## Part 6: Remaining Open Beads

| Bead | Priority | Title | Blocker |
|------|----------|-------|---------|
| cf-6ub | P0 | Store secrets in Wix Secrets Manager | Need dashboard access |
| cf-xv3 | P1 | Create CMS collections | Need dashboard access |
| cf-69b | P1 | Wix Editor visual layout buildout | Need editor access |
| cf-8gu | P1 | Set up UPS Developer Portal | Need UPS portal access |
| cf-e3o | P1 | Commission illustration assets | Need Wix AI tools |
| cf-mnh | P1 | Mobile-first responsive optimization | After editor buildout |
| cf-1ur | P2 | Create Triggered Email templates | Need dashboard access |
| cf-295 | P2 | Migrate wix-stores-frontend to wix-ecom | After initial testing |
| cf-6wc | P2 | Metric tracking strategy | After launch |
| cf-vuk | P1 | Fix gallery test failures | In progress (polecat) |
| cf-mdd | P2 | Style quiz backend | In progress (polecat) |
| cf-bl8 | P2 | Video embed support | In progress (polecat) |
| cf-b2i | P2 | Enhanced post-purchase | In progress (polecat) |
