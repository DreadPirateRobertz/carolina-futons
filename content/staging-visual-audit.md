# Staging Site Visual Audit — CF-r6h2

**Date**: 2026-03-16
**Auditor**: melania (Playwright browser snapshots)
**URL**: https://chrisdealglass.wixstudio.com/my-site

## Summary

| Metric | Status |
|--------|--------|
| Pages audited | 5 (Home, About, Contact, FAQ, Product Page) |
| Critical bugs | 3 |
| Medium bugs | 4 |
| Low/cosmetic | 2 |
| Pages passing | About, FAQ |

## Global Elements (All Pages)

### Header/Nav — PASS
- Announcement bar: "Visit Our Showroom: Wed–Sat 10–5 | 824 Locust St, Hendersonville NC | (828) 252-9449"
- Nav links: Home, Sale, Getting it Home, Contact, FAQ, About, Shop — all functional
- Search, Wishlist, Cart, Login, Shop button — all present
- Logo area present (Carolina Futons branding)

### Footer — PASS
- Copyright: © 2026 Carolina Futons. All rights reserved.
- Category links: Futon Frames, Murphy Cabinet Beds, Platform Beds, Mattresses, Contact
- Policy links: Terms, Privacy, Refund, Shipping, Accessibility, FAQ — all linked
- Social: Facebook, Instagram, TikTok, Pinterest — all correct CF URLs
- Newsletter signup with email + checkbox
- Contact block: carolinafutons@gmail.com, (828) 252-9449, 824 Locust St, Wed–Sat 10–5

---

## Page-by-Page Results

### Homepage — 3 ISSUES

**Working:**
- Hero: "Handcrafted Comfort, Mountain Inspired." + subheading about Hendersonville since 1991
- "Explore Our Collection" CTA button
- "THE CAROLINA FUTONS STORY" section with About text + "Learn More" link
- "NEW IN" product gallery (4 products)
- "BEST SELLERS" gallery (4 products) — Murphy Cube $1,898, Studio $229, Monterey $549, Lambton $778
- Full footer with all elements

**Issues:**

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 1 | CRITICAL | Template placeholder sections | Two "Add a Title" sections with "Add paragraph text. Click Edit Text..." and "Start Now" buttons still visible |
| 2 | HIGH | Asheville $1.00 price | Asheville Futon Frame shows $1.00 in "NEW IN" gallery (placeholder price for Call-for-Price products) |
| 3 | LOW | "Call for Price" label inconsistency | Some products show "Call for Price" overlay AND $1.00 — should show only the overlay |

### About — PASS

- Heading: "ABOUT CAROLINA FUTONS" + "HANDCRAFTED COMFORT SINCE 1991"
- Three content sections: Our Showroom, Premium Materials, Quality Craftsmanship
- Company description paragraph
- All CF-specific content, no template text remaining

### Contact — 2 ISSUES

**Working:**
- "CONTACT US" heading with chair image
- "GET IN TOUCH" form with First name, Last name, Email, Phone, Message fields
- Business hours: Wednesday–Saturday 10:00am–5:00pm EST
- Descriptive paragraph about contacting the store

**Issues:**

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 4 | CRITICAL | Wrong address | Shows "329 N Main St" — should be "824 Locust St Suite 200" (329 N Main was the OLD location) |
| 5 | HIGH | Broken mailto link | Email renders as `carolinafutons@gmail.comTel` — "Tel" concatenated into the href |

### FAQ — PASS

- Heading: "Frequently asked questions"
- Search box: "Looking for something?"
- Tabbed interface: General | Products & Shopping
- Q&A accordion with: "Do you offer free shipping?", "What is the return policy?", "How long does delivery take?"
- All answers contain CF-specific content
- Share/reaction buttons on each answer

### Product Page (Murphy Cube Cabinet Bed) — 2 ISSUES

**Working:**
- Breadcrumbs: Home > Murphy Cube Cabinet Bed
- 3 product images
- Product title, price ($1,898.00), full description
- Quantity selector, Add to Cart, Buy Now, Add to Wishlist
- Manufacturer: Night & Day Furniture (expandable)
- Social sharing: Facebook, WhatsApp, Twitter, Pinterest
- "YOU MIGHT ALSO LIKE" carousel with related products
- March Sale discount visible (Lambton $778→$700.20)

**Issues:**

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| 6 | HIGH | $1.00 prices in recommendations | Mesa 3000, Gemini, Chandler, Flagstaff, Yuma all show $1.00 in "You Might Also Like" |
| 7 | MEDIUM | Console errors (4) | DatasetAPI onReady errors, BusinessSchema injection fail — related to CF-w2bz (product page dataset hookup) |

---

## Issue Summary by Severity

### CRITICAL (2) — Must fix before any demo
1. **Template placeholder sections on homepage** — "Add a Title" x2 with template instructions visible
2. **Wrong address on Contact page** — Shows old location (329 N Main St)

### HIGH (3) — Fix before launch
3. **$1.00 placeholder prices** — Multiple "Call for Price" products displaying $1.00 (Asheville, Mesa 3000, Gemini, Chandler, Flagstaff, Yuma)
4. **Broken mailto on Contact** — `carolinafutons@gmail.comTel`
5. **Console errors on Product Page** — Dataset API failures

### MEDIUM (1)
6. **"Call for Price" display inconsistency** — Some products show both the "Call for Price" overlay AND $1.00 price

### LOW (2)
7. **Announcement bar text differs** — Homepage shows full address+phone, About page shows shorter version
8. **4 console warnings** — Non-critical (font loading, react-i18next, meshProps)

---

## Existing Beads Covering These Issues

| Issue | Bead | Status |
|-------|------|--------|
| Template placeholders | CF-ozp8 | OPEN (melania, editor task) |
| $1.00 prices | Need new bead or product data fix | — |
| Wrong address | Need editor fix or API update | — |
| Broken mailto | Need editor fix | — |
| Dataset API errors | CF-w2bz | FROZEN (needs editor login) |
| Element hookup | CF-7w4b | FROZEN (needs editor login) |

## Recommendations

1. **Immediate**: Fix contact page address + mailto via Wix REST API or editor
2. **Immediate**: Hide or delete template placeholder sections (CF-ozp8)
3. **Price fix**: Products with no real price should either hide the price field or show "Contact for pricing" — requires product data update via Stores API
4. **Dataset hookup**: CF-w2bz needs editor access to wire productDataset to page elements
