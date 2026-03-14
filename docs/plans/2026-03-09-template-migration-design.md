# Carolina Futons — Template Migration Design

**Date:** 2026-03-09
**Author:** melania (PM)
**Status:** APPROVED by overseer
**Supersedes:** My Site 2 skeleton buildout approach

---

## Problem Statement

The blank-site skeleton approach (My Site 2) failed to deliver visual results. 39 pages with ~1,220 elements were placed but:
- Theme API rejected color changes programmatically
- Playwright couldn't reliably operate the Wix Studio editor
- Elements were dumped without visual intent — no design context
- The site looked like a default blue Wix shell, not a furniture store

The overseer needs a site that looks professional and connects to our backend code.

## Decision

**Migrate to a Wix Studio template-based site (My Site 3)** using the free Furniture Store template (#3563). Restyle to our Blue Ridge Mountain aesthetic. Connect our existing backend code through phased element hookup with real data verification at every step.

## Template Selection

### Evaluated Templates

| Template | Pages | Categories | Ecommerce Depth | Cost |
|----------|-------|-----------|-----------------|------|
| **Furniture Store (#3563)** | 7 | 15 furniture-specific | Wix Stores, categories, testimonials | FREE |
| Home Goods Store (#3408) | ~5 | General home goods | Wix Stores, gift cards, hover effects | FREE |
| Home Decor Store | ~5 | General decor | Wix Stores, filters, sorting | FREE |
| Furniture Store (Marketplace) | 7 | 15 furniture-specific | Same as #3563 + polish | $59 |

### Selected: Furniture Store (#3563 FREE)

**Reasons:**
1. Most pages out of the box (7 vs ~5) — Collections and Best Deals are bonus pages we need
2. 15 pre-built furniture categories map to our catalog (futons, mattresses, beds, sofas, dining)
3. Homepage has 10 sections — most visual foundation to work with
4. Testimonials built in — connects to our `StarRatingCard.js` and review infrastructure
5. Blog built in — connects to `Blog.js` and `Blog Post.js`
6. It's a FURNITURE store template — not generalized home decor

**Fallback:** If #3563 is too bare-bones once opened, pivot to $59 marketplace version. Single-site license acceptable.

## Architecture

### Infrastructure

| Component | Value |
|-----------|-------|
| Site name | My Site 3 |
| Template | Furniture Store (#3563) |
| Repo | `DreadPirateRobertz/carolina-futons-stage3` (private) |
| Source | Paranoid copy from `carolina-futons` dev repo via `git archive` |
| Velo | Enabled via Code Panel → Start Coding |
| GitHub integration | Connected to `carolina-futons-stage3` |
| New credentials | metaSiteId, headless client ID (web), headless client ID (mobile) |
| Secrets | Copy from `refinery/rig/scripts/secrets.env`, update client IDs |

### What Carries Over (Unchanged)

- 93 backend `.web.js` modules
- All `src/public/` helpers (designTokens, mobileHelpers, a11yHelpers, navigationHelpers, etc.)
- All 11,874+ tests
- `WIX-STUDIO-BUILD-SPEC.md` (element ID specification)
- All design docs, guides, social media strategy
- `sharedTokens.js` and `designTokens.js`

### What Changes

- `src/pages/*.js` — file names get new Wix page IDs (content unchanged)
- `secrets.env` — new metaSiteId, new headless client IDs
- New `PAGE_ID_MAP.md` for My Site 3
- New `TEMPLATE-ELEMENT-AUDIT.md` documenting what the template ships with

### Element Strategy

**Last time (WRONG):** Bulk-dumped 1,220 elements across 39 pages. No visual intent. No design context.

**This time (RIGHT):**

1. **Audit first** — Catalog every template element before touching anything
2. **Map to spec** — Match template elements to BUILD-SPEC `$w('#id')` references, rename IDs
3. **Identify gaps** — Template elements we don't need (repurpose/delete), our elements template lacks (add carefully)
4. **Add in design context** — New elements placed within template's existing layout grid, matching spacing, typography, and visual rhythm
5. **Phase by page** — One page at a time, verify connectivity before proceeding
6. **Real data always** — No placeholder content. Real products, real prices, real images.

## Phased Rollout

### Phase 1: Core Commerce (6 pages)

The critical path: Home → Category → Product → Cart → Checkout → Thank You.
If these 6 work with real data, we have a real store.

| Page | Template Has? | Key Work |
|------|--------------|----------|
| Home | YES | Remap IDs, restyle brand, connect masterPage.js + Home.js, real products |
| Category Page | YES (Shop) | Remap IDs, connect filters/sorting, real product grid |
| Product Page | YES (Stores) | Remap IDs, add swatches/reviews/gallery, real product data |
| Cart Page | Partial | Add Side Cart elements, connect cartRecovery |
| Checkout | YES (native) | Brand customization |
| Thank You | Partial | Add post-purchase elements, order confirmation |

**Phase 1 exit criteria:**
- Complete purchase flow works end-to-end with real data
- Every page screenshot approved by overseer
- Mobile responsive on all 6 pages
- Playwright smoke test green

### Phase 2: Content & Trust (7 pages)

| Page | Notes |
|------|-------|
| About | Template has this — remap + real content |
| Contact | Template has this — connect contactSubmissions.web.js, real business info |
| FAQ | Create page, connect FAQ data |
| Blog | Template has this — connect CMS, real posts |
| Blog Post | Template has this — social sharing, categories |
| Shipping Policy | Create page, real policy content |
| Returns | Create page, connect returns flow |

### Phase 3: Engagement & Features (8 pages)

| Page | Notes |
|------|-------|
| Member Page | Wishlist, loyalty, preferences |
| Newsletter | Email capture, subscription management |
| Referral Page | Referral program flow |
| Gift Cards | Gift card purchase + redemption |
| Style Quiz | Interactive quiz → product recommendations |
| Assembly Guides | Connect assemblyGuides.web.js |
| Search Results | Connect categorySearch.web.js |
| Compare Page | Product comparison tool |

### Phase 4: Remaining (18 pages)

Buying Guides, Financing, Room Planner, UGC Gallery, Privacy Policy, Terms & Conditions, Accessibility Statement, Price Match Guarantee, Order Tracking, Admin Returns, Store Locator, Sustainability, Side Cart, Search Suggestions Box, Fullscreen Page, Buying Guide (single).

## Quality Bar (Every Bead)

Every bead must satisfy ALL of these before closing:

1. **Element IDs mapped** — All `$w('#id')` references from BUILD-SPEC present in editor
2. **Real data flowing** — No placeholder/lorem ipsum. Real products, real prices, real images.
3. **Visual verification** — Screenshot with real data. Compare against design.jpeg aesthetic.
4. **Data flow tested** — Clicks navigate correctly, forms submit, API calls return real data
5. **Mobile responsive** — Tested at 320px, 768px, 1024px viewports
6. **Overseer checkpoint** — At phase boundaries, full visual walkthrough

## Bead Breakdown

### Pre-Phase: Infrastructure

| ID | Title | Owner | Dependencies | AC Summary |
|----|-------|-------|-------------|------------|
| TBD-1 | Template evaluation & site creation | melania | None | My Site 3 live, Velo enabled, GitHub connected, TEMPLATE-ELEMENT-AUDIT.md complete |
| TBD-2 | Paranoid repo copy | crew | TBD-1 | carolina-futons-stage3 repo, 11,874 tests green, secrets configured |
| TBD-3 | Theme restyle in editor | melania/crew | TBD-1 | Brand palette + typography applied via Theme Manager, before/after screenshots |

### Phase 1: Core Commerce

| ID | Title | Owner | Dependencies | AC Summary |
|----|-------|-------|-------------|------------|
| TBD-4 | Home Page hookup | crew | TBD-2, TBD-3 | Real products display, nav works, footer populated, screenshot approved |
| TBD-5 | Category Page hookup | crew | TBD-4 | Real product grid, filters work, sorting works, click → Product Page |
| TBD-6 | Product Page hookup | crew | TBD-4 | Real product with images/price/reviews, add-to-cart works |
| TBD-7 | Cart + Side Cart hookup | crew | TBD-6 | Cart with real items, quantity updates, totals correct |
| TBD-8 | Checkout + Thank You hookup | crew | TBD-7 | Test purchase end-to-end works |
| TBD-9 | Phase 1 integration test | crew | TBD-8 | Full flow smoke test, mobile check, overseer visual approval |

### Phase 2: Content & Trust

| ID | Title | Owner | Dependencies | AC Summary |
|----|-------|-------|-------------|------------|
| TBD-10 | About + Contact hookup | crew | TBD-9 | Real content, contact form works |
| TBD-11 | FAQ + Policies hookup | crew | TBD-9 | Content pages render, navigation works |
| TBD-12 | Blog hookup | crew | TBD-9 | Blog lists posts, social sharing works |

### Phase 3-4: Created as prior phases complete

Each follows the same pattern: map elements → add in design context → real data → visual verify → data flow verify.

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Free template too bare-bones | Pivot to $59 marketplace version — same 7 pages with more polish |
| Theme Manager fails like DS API did | Manual color/font application in editor element-by-element (slower but reliable) |
| Template element structure incompatible | We only need the visual shell — delete template elements and add ours from scratch within template's layout |
| Page ID assignment delays | Create pages in editor first, wait for Wix to assign IDs, then push code |
| wix dev sync issues | Proven workflow from My Site 2 — code syncs FROM site TO local work |

## Infrastructure & Integration Testing

Beyond page hookup, the following systems must be verified end-to-end on My Site 3:

### Payments
- Wix Payments or third-party payment provider configured
- Test mode transactions: credit card, PayPal, Apple Pay (if supported)
- Payment confirmation flows → Thank You page → order in dashboard
- Refund flow testing

### Shipping
- UPS REST API integration via `ups-shipping.web.js`
- `shipping-rates-plugin.js` (SPI) — real-time rate calculation
- White-glove delivery pricing: local $149, regional $249, free >$1,999
- `deliveryScheduling.web.js` — Wed-Sat delivery slot selection
- `fulfillment.web.js` — order fulfillment triggers
- Rate calculation with real addresses and real product weights

### Email & Notifications
- Order confirmation emails
- Shipping notification emails
- Cart abandonment recovery emails (`cartRecovery.web.js`)
- Newsletter subscription confirmation
- Contact form submission notifications

### CMS & Data
- 16 CMS collections per MASTER-HOOKUP.md
- Product catalog with real data (314 product photos when upload unblocked)
- Blog content management
- FAQ content management

### Analytics & Tracking
- GA4 integration (Measurement ID: G-7G7RMYDYKB)
- Meta Pixel (when configured)
- `analyticsHelpers.web.js` event tracking
- `engagementTracker.js` user behavior tracking

### Authentication & Members
- Member signup/login flow
- Member Page — wishlist, loyalty tier, preferences
- `loyaltyService` — Bronze/Silver/Gold tier calculation
- Order history display

### Performance & SEO
- Page load times < 3s on mobile
- `seoHelpers.web.js` — OG tags, Rich Pins, Twitter Cards
- `http-functions.js` — product feeds for Facebook/Pinterest/Google
- Lighthouse audit: 90+ performance, 90+ accessibility

**These are tested AFTER Phase 1 core commerce is working.** Shipping and payments are Phase 1 blockers — they must work before overseer sign-off on Phase 1. Analytics, CMS, email, and member features are Phase 2-3 integration items.

## Lessons Learned (From My Site 2)

1. **Spike before committing** — Verify end-to-end feasibility before multi-session build efforts
2. **Visual intent required** — Every element placed must have a visual purpose, not just an ID
3. **Real data from day one** — Placeholder content masks integration issues
4. **Phase delivery** — Ship 6 working pages, not 39 broken ones
5. **Theme Manager over API** — Use the editor UI for styling, not programmatic approaches that may fail
6. **Overseer checkpoints** — Visual approval at phase boundaries, not after everything is "done"
