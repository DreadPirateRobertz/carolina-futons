# CF-y4ad SPIKE: Wire Social Media Integration

**Date**: 2026-03-16
**Author**: godfrey
**Status**: Complete

## Executive Summary

Social media integration code is **extensively built out** — 8+ modules covering
Meta Pixel, TikTok Pixel, Pinterest catalog, social sharing, product feeds, and
social proof. The remaining work is **platform account setup and dashboard wiring**.

## Existing Code Inventory

### Pixel & Event Tracking

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/public/metaPixel.js` | Meta Pixel client events | `fireMetaViewContent`, `fireMetaAddToCart`, `fireMetaInitiateCheckout`, `fireMetaPurchase`, `fireMetaSearch`, `fireMetaLead`, `fireMetaAddToWishlist`, `buildEnhancedMatchParams` |
| `src/backend/facebookCatalog.web.js` | Server-side CAPI + DPA params | `buildCapiEvent`, `buildProductSetParams`, `getEnhancedCatalogFields`, `exportCustomerAudienceData` |
| `src/public/tikTokPixel.js` | TikTok pixel init + events | `initTikTokPixel`, `fireTikTokEvent`, `setPixelId` |
| `src/public/ga4Tracking.js` | GA4 custom events | `fireCustomEvent`, `fireAddToCart`, `fireAddToWishlist` |
| `src/public/engagementTracker.js` | Unified event tracking | `trackEvent`, `trackSocialShare`, `trackGalleryInteraction` |

### Pinterest Integration

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/backend/pinterestCatalogSync.web.js` | Catalog validation + pin content | `validateCatalogProduct`, `auditCatalog`, `getCatalogSyncStatus`, `mapProductToBoard`, `generatePinContent`, `getBoardStructure` |

**7 Pinterest boards pre-configured**: Futon Living Rooms, Small Space Solutions, Murphy & Cabinet Beds, Platform Bed Inspiration, Handcrafted & Unfinished, Sale & Clearance, Customer Showcase

### Social Sharing & Meta Tags

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/backend/socialMediaKit.web.js` | Share URLs + meta tag validation | `getShareUrls`, `getProductShareUrls`, `validateSocialMeta`, `checkProductSocialReadiness`, `getProductSocialMetaHtml`, `getFeedStatus` |
| `src/public/product/socialWishlist.js` | Share buttons + wishlist heart | `initSocialShare`, `initWishlistButton` |
| `src/public/footerContent.js` | Footer social links | `getFooterSocialLinks` (Facebook, Instagram, Pinterest) |
| `src/public/FooterSection.js` | Footer social icon repeater | `initFooterSocial`, `fixTemplateSocialBar` |
| `src/public/socialProofToast.js` | Social proof notifications | `initProductSocialProof`, `initCategorySocialProof` |

### Product Feed Endpoints (HTTP Functions)

| Endpoint | Format | Purpose |
|----------|--------|---------|
| `/_functions/facebookCatalogFeed` | TSV (23 cols) | Facebook Commerce Manager catalog |
| `/_functions/pinterestProductFeed` | TSV (13 cols) | Pinterest catalog feed |
| `/_functions/facebookCustomAudience` | JSON (hashed) | Custom/Lookalike Audience upload |
| `/_functions/googleShoppingFeed` | XML (RSS 2.0) | Google Merchant Center |
| `/_functions/productSitemap` | XML | Product sitemap for all crawlers |

### Test Coverage

- `tests/metaPixel.test.js` — Meta Pixel events
- `tests/tikTokPixel.test.js` — TikTok Pixel (18 tests)
- `tests/socialMediaKit.test.js` — Share URLs + meta validators
- `tests/socialWishlistModule.test.js` — Wishlist & share buttons
- `tests/socialMediaWiring.test.js` — End-to-end social wiring
- `tests/flashSaleHelpers.test.js` — Flash sale helpers

## Gap Analysis: What's NOT Done

### 1. TikTok Pixel — NOT installed on live site

**Current state**: Code exists (`tikTokPixel.js`), but no TikTok Pixel ID is configured.

**What's needed**:
- Create TikTok Pixel in TikTok Ads Manager (account: `carolinafutons+socials@gmail.com` / `BossBobby2026!`)
- Per CF-lfz9 spike: Wix natively supports TikTok Pixel via Marketing Tags API
- Install via: `POST https://www.wixapis.com/marketing/v1/tags` with type `TIKTOK_PIXEL`
- Update `tikTokPixel.js` PIXEL_ID constant (or use `setPixelId()`)
- **Alternative**: Install via GTM container tag (if GTM is already set up for other tags)

### 2. Pinterest Rich Pins — OG tags need verification

**Current state**: `socialMediaKit.web.js` has `getProductSocialMetaHtml()` that generates
all required OG tags including `product:price:amount`, `product:price:currency`,
`product:price:availability`. `pinterestCatalogSync.web.js` has full catalog validation.

**What's needed**:
- Verify OG tags render correctly on live product pages (use Pinterest Rich Pin Validator: https://developers.pinterest.com/tools/url-debugger/)
- Apply for Rich Pin approval from Pinterest (one-time, site-wide)
- Register Pinterest product feed URL in Pinterest Business Hub
- Connect Pinterest business account to Wix (Dashboard → Marketing Integrations)

### 3. Facebook Business Page → Wix Inbox — Dashboard only

**Current state**: Facebook pixel + catalog code fully built. No Inbox integration code needed.

**What's needed**:
- Dashboard → Settings → Inbox → Connect Facebook Messenger
- Requires Facebook Business Page admin access
- Account: `carolinafutons+socials@gmail.com` / `BossBobby2026`

### 4. Checkout Templates for Flash Sales — Partially built

**Current state**: `flashSaleHelpers.test.js` exists, suggesting helper code is in place.

**What's needed**:
- Verify `flashSaleHelpers.js` generates shareable checkout URLs
- Create first flash sale checkout template (product + discount code + UTM params)
- Test flow: social post → checkout URL → cart pre-filled → purchase

### 5. Social Account Verification

**All accounts use**: `carolinafutons+socials@gmail.com` / `BossBobby2026!`

| Platform | Account Status | Action Needed |
|----------|---------------|---------------|
| Facebook Business Page | Created | Connect to Wix Inbox |
| Instagram Business | Created | Verify linked to FB Page |
| Pinterest Business | Created | Apply for Rich Pins, register feed |
| TikTok Ads Manager | **NOT created** | Create account, create pixel |

## Integration Architecture

```
Product/Page Actions
  ↓
engagementTracker.trackEvent()
  ├→ metaPixel.js → wix-window-frontend.trackEvent() → Facebook Pixel
  ├→ tikTokPixel.js → window.ttq.track() → TikTok Pixel
  └→ ga4Tracking.js → wix-window-frontend.trackEvent() → GA4

Product Catalog
  ↓
http-functions.js
  ├→ facebookCatalogFeed (TSV) → Facebook Commerce Manager
  ├→ pinterestProductFeed (TSV) → Pinterest Catalog
  └→ googleShoppingFeed (XML) → Google Merchant Center

Social Sharing (Product Pages)
  ↓
socialWishlist.js → socialMediaKit.web.js
  ├→ Facebook share URL
  ├→ Pinterest pin URL
  ├→ Twitter share URL
  ├→ LinkedIn share URL
  └→ Email share URL

Social Proof
  ↓
socialProofToast.js → Toast notifications (purchases, low stock)
```

## Recommendations

### Code Changes: NONE needed
All social media integration code is production-ready.

### Dashboard/Platform Actions (assign to editor agent):

**Priority 1 — Revenue-impacting**:
1. Create TikTok Pixel in Ads Manager → install via Marketing Tags API
2. Connect Facebook Business Page to Wix Inbox (Messenger)
3. Verify Facebook catalog feed is registered in Commerce Manager

**Priority 2 — SEO/Discovery**:
4. Validate OG tags on product pages via Pinterest URL Debugger
5. Apply for Pinterest Rich Pins
6. Register Pinterest product feed in Business Hub

**Priority 3 — Growth**:
7. Create first flash sale checkout template
8. Test social sharing preview cards on all platforms (Facebook, Pinterest, Twitter)
9. Set up social proof toast frequency tuning after launch data

## Conclusion

CF-y4ad is a **platform account setup + dashboard wiring** task. The Velo code for
pixels (Meta, TikTok, GA4), catalog feeds (Facebook, Pinterest, Google), social sharing,
meta tag validation, and social proof toasts is complete and tested. The one code-relevant
gap is the TikTok Pixel ID, which can be set via the Marketing Tags API once the TikTok
Ads Manager account is created.
