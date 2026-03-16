# Carolina Futons — Staging Site Vision Document

**Date:** 2026-03-13
**Site:** https://halworker85.wixstudio.com/my-site
**Template:** Wix Studio Furniture Store #3563 ("tera")
**Status:** LIVE & PUBLISHED — Real products, real images, real branding

---

## What's Working Now (Published & Live)

### Homepage
- **Screenshot:** `staging-homepage-desktop-published.jpeg`
- **Hero:** "Handcrafted Comfort, Mountain Inspired" — Velo code overrides template with CF branding
- **Announcement bar:** "Visit Our Showroom: Wed-Sat 10-5, Hendersonville NC" (Velo-driven)
- **Nav bar:** Futon Frames | Murphy Cabinet Beds | Platform Beds | Mattresses | Contact
- **Shop by Collections:** 4 category boxes with CF labels and correct links
  - FUTON FRAMES → /category/futon-frames
  - MURPHY CABINET BEDS → /category/murphy-cabinet-beds
  - PLATFORM BEDS → /category/platform-beds
  - MATTRESSES → /category/mattresses
- **New In gallery:** Asheville Futon Frame, Sunrise Futon Frame, Dillon Futon Frame, Monterey Futon Frame — all real CF products with CDN images
- **Best Sellers gallery:** Murphy Cube Cabinet Bed ($1,898), Studio Futon Frame ($229), Monterey Futon Frame ($549), Lambton Futon Frame ($778)
- **About section:** "Since 1991, Carolina Futons has been Hendersonville's trusted source..."
- **Instagram:** FOLLOW US @CAROLINAFUTONS (links to real Instagram)
- **Footer:** CF categories, contact info (carolinafutons@gmail.com, (828) 327-8030, Hickory NC), social links (Facebook, Instagram, TikTok, Pinterest — all pointing to Carolina Futons accounts)
- **Newsletter signup:** "Stay Inspired" with email form

### Product Pages
- **Screenshot:** `staging-product-page-asheville.jpeg`
- **Real CDN images** from original Carolina Futons site — NO "Media Placeholder" issues
- **Product info:** Name, price, description, manufacturer (Night & Day Furniture), quantity selector
- **Actions:** Add to Cart, Buy Now, Add to Wishlist
- **Social sharing:** Facebook, WhatsApp, Twitter, Pinterest (with product URL)
- **Related products:** "You Might Also Like" carousel with other CF products
- **Breadcrumbs:** Home > Product Name

### Category Pages
- **Screenshot:** `staging-category-futon-frames.jpeg`
- **19 Futon Frames** with real product photos and prices ($199-$1,031)
- **Sort & Filter:** Sort by Recommended, Price slider filter
- **Browse by sidebar** (still shows template categories — needs update)
- **Product grid:** Large product images, clean layout

### Product Catalog (88 products imported)
- 74 regular-priced products with CDN images
- 14 "call for price" products ($1.00 placeholder)
- Categories: Futon Frames, Murphy Cabinet Beds, Platform Beds, Mattresses
- Images sourced from original Carolina Futons CDN (314 images downloaded)

---

## What Still Needs Work

### High Priority (Visual Branding)
1. **Logo:** "tera" wordmark still shows in header — needs CF logo image
2. **Shop by Collections images:** 4 category boxes still show template furniture photos — need CF product images
3. **Category sidebar:** "Browse by" widget shows Sofas, Lounge Chairs, Tables, Chairs — need to rename/hide template categories in Wix Store settings
4. **Template products:** 24 template products (MODO, NYX, RAVEN, etc.) still in store — need deletion

### Medium Priority (Content & Polish)
5. **"As Seen In" section:** Template press logos — replace with CF press/partners or remove
6. **Instagram feed widget:** Shows generic images — connect to real @carolinafutons feed
7. **Hero image:** Currently shows template fireplace photo — replace with CF showroom/product lifestyle photo
8. **Shop by Collections images:** Replace template furniture photos with CF category hero images
9. **"Built on Wix Studio" banner:** Top of page — will be removed with paid plan upgrade

### Lower Priority (Velo Code Integration)
10. **Velo runtime errors:** Several `TypeError` errors in console (testimonials, schema injection, product page init, performanceHelpers) — element IDs not yet mapped
11. **Category page code:** "Error initializing product grid" — element references need remapping
12. **Full element ID remap:** Option C (remap-element-ids.js) for all pages — Home, Product, Category, Cart, etc.

### Future Phases
13. **Additional pages:** About, Blog, FAQ, Contact — content needs CF-specific copy
14. **Checkout flow:** Cart → Side Cart → Checkout → Thank You — Velo code integration
15. **Member features:** Wishlist, loyalty program, order history
16. **SEO:** Meta descriptions, Open Graph tags, structured data
17. **Blue Ridge aesthetic:** Mountain skyline borders, warm color overrides, custom illustrations per design.jpeg

---

## Architecture Summary

| Layer | Status | Notes |
|-------|--------|-------|
| Template (Furniture Store #3563) | Active | Provides layout, responsive design, e-commerce widgets |
| Wix Store (products) | 88 CF products imported | CDN images working, categories set up |
| Editor content (text/links) | Updated via documentServices API | Nav, footer, headings, about, social links |
| Velo code (src/) | Running, partially connected | Hero, announcement bar override working; product page/category page have unmapped elements |
| Theme (colors/fonts) | Applied | Blue Ridge palette + Playfair Display/Open Sans |

---

## How It Will Look Fully Live

When all phases complete:
- **CF logo** replaces "tera" wordmark
- **Mountain skyline** watercolor border across page headers (per design.jpeg)
- **All 88 products** with full CDN photos, real pricing, and complete descriptions
- **Category pages** with CF category names in sidebar filter
- **Product pages** with Velo-driven features: star ratings, related products, size guides, delivery scheduling
- **Checkout** with white-glove delivery options, loyalty discounts, gift cards
- **Member area** with wishlist, order history, loyalty tier (Bronze/Silver/Gold)
- **Blog** with buying guides, care tips, and social integration
- **Full SEO** with structured data, OG tags, and sitemaps

The template provides a professional, responsive foundation. Our Velo code layer adds the Carolina Futons personality, business logic, and interactive features. The Blue Ridge aesthetic (design.jpeg) will be applied progressively through custom illustrations and styling.
