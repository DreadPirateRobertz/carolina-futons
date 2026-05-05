# cfw vs Wix Editor Hookup Guide — Parity Audit v2.1 (cf-ah0m / cf-o2kq / cf-bdkq)

**Generated**: 2026-05-05 by morgott (cfutons crew)

**v2.1 corrections (cf-bdkq)** — addresses radahn's 5-agent refinery review on PR #1139:
- Fixed alias map: `Filters` → real components (`FilterFirst`, `PLPControls`, `ReviewFilter`, `MobileFilterDrawer`); `Cart Global` → real components (`CartTrigger` / `cart-trigger` testid + `CartDrawer`). Earlier mappings (`FacetPanel`, `FilterChips`, `CartIcon`, `site-header-cart`) were never present in cfw and produced zero inventory hits.
- Added aliases for `You Might Also Like`→`PdpAlsoBought`, `BNPL Widget` / `BNPL Calculator Widget`→`PdpFinancing`, `Notify Me` / `Price Drop Notify`→`PdpNotifyMe` — these were stuck at `partial` despite full cfw implementation.
- Added `unprobed` verdict tier for client-rendered / auth-walled pages (cart, checkout, dashboard, side-cart, style-quiz, blog, white-glove-delivery, etc.). Previously these silently biased toward `partial`/`missing` because curl-only DOM probe sees only the master shell.
- Forward-drift sweep now harvests bare backtick-quoted camelCase IDs from the raw guide markdown (e.g. `notifyMeSection`, `lowStockWarning`). `parse_guide.py` only catches `#elementId` patterns; `PdpNotifyMe`/`PdpStockBadge` were false-positive drift in v2 because of that gap.

**v2 baseline (kept unchanged from PR #1139)**:
- Curated alias map for hookup-guide labels with cfw naming-divergence.
- DOM probe: rendered HTML fetched from live cfw via `curl -L` for 33 page URLs; extracted `data-slot`, `id`, `class` tokens, and h1–h4 text.
- `data-testid` (106 values) added to cfw inventory; stemmed token containment with rare-token weighting.
- Forward-drift sweep — cfw artifacts with no guide token overlap.
- Tighter verdict ladder: DOM hit OR alias hit OR ≥half-token containment in a single cfw name with a rare token → `yes`.

**Sources**:
- `EDITOR-HOOKUP-GUIDE.md` (255 features extracted across 29 page sections)
- cfw `src/` static inventory: 193 `data-slot`, 106 `data-testid`, 529 component basenames
- Live HEAD + GET probes against `https://carolina-futons-web.vercel.app/`
- Curated alias map (`scripts/cf-ah0m/feature-aliases.json`)

**Caveats**:
- DOM probe uses `curl -L` only (NOT Playwright — the v2 PR description was incorrect on this point and is now corrected). Pages that rely on client-side hydration return only the master-shell slots. v2.1 marks these `unprobed` instead of forcing them through the same verdict ladder; treat that bucket as 'cfw evidence likely exists in source but cannot be observed at runtime without a hydrated probe.'
- A `yes` does not guarantee runtime correctness — it means cfw has a same-named or aliased component. Remaining false-positive risk lives in alias-only `yes` rows; spot-check before treating as sign-off.

## Summary

| Verdict | v1 | v2 | v2.1 |
| --- | --: | --: | --: |
| ✓ yes | 41 | 201 | 208 |
| ~ partial | 166 | 28 | 22 |
| ✗ missing | 41 | 25 | 5 |
| ? unknown | 7 | 1 | 1 |
| ▢ unprobed | — | — | 19 |
| **total** | 255 | 255 | 255 |

**Partial bucket**: 166 → 28 → 22.
**Unprobed bucket**: 0 → 0 → 19 (newly explicit; was previously folded into partial/missing).

## Per-page breakdown

| Page | cfw URL | DOM | ✓ | ~ | ✗ | ▢ | ? | total |
| --- | --- | :-: | --: | --: | --: | --: | --: | --: |
| ABOUT | `/about` | ssr | 2 | 0 | 0 | 0 | 1 | 3 |
| ADMIN A/B TESTS | `/admin/ab-tests (404)` | — | 2 | 0 | 0 | 1 | 0 | 3 |
| ADMIN DELIVERY CALENDAR | `/admin/delivery-calendar (404)` | — | 1 | 1 | 0 | 0 | 0 | 2 |
| BLOG | `/blog` | client | 11 | 0 | 0 | 1 | 0 | 12 |
| CART PAGE | `/cart` | client | 10 | 0 | 0 | 1 | 0 | 11 |
| CATEGORY PAGE | `/shop/<slug>` | ssr | 9 | 1 | 0 | 0 | 0 | 10 |
| CHECKOUT | `/checkout` | client | 10 | 1 | 0 | 2 | 0 | 13 |
| COMMUNITY GALLERY | `/community-gallery` | client | 4 | 0 | 0 | 0 | 0 | 4 |
| COMPARE PAGE | `/compare` | client | 4 | 1 | 0 | 0 | 0 | 5 |
| CONTACT | `/contact` | ssr | 5 | 0 | 1 | 0 | 0 | 6 |
| FABRIC SWATCHES | `/fabric-swatches (404)` | — | 5 | 0 | 0 | 0 | 0 | 5 |
| FAQ | `/faq` | ssr | 3 | 0 | 0 | 0 | 0 | 3 |
| FULLSCREEN / PRODUCT VIDEOS | `(modal)` | ssr | 2 | 0 | 0 | 0 | 0 | 2 |
| HOME PAGE | `/` | ssr | 17 | 0 | 0 | 0 | 0 | 17 |
| MASTER PAGE | `/ (global)` | ssr | 15 | 0 | 1 | 0 | 0 | 16 |
| MEMBER PAGE | `/dashboard` | client | 7 | 2 | 0 | 3 | 0 | 12 |
| PRICE MATCH GUARANTEE | `/price-match-guarantee (404)` | — | 5 | 0 | 1 | 0 | 0 | 6 |
| PRODUCT PAGE | `/products/<slug>` | ssr | 25 | 6 | 0 | 0 | 0 | 31 |
| REFERRAL PAGE | `/referral` | client | 4 | 1 | 0 | 1 | 0 | 6 |
| ROOM PLANNER | `/room-planner` | ssr | 8 | 0 | 0 | 0 | 0 | 8 |
| SEARCH RESULTS | `/search` | ssr | 5 | 0 | 0 | 0 | 0 | 5 |
| SHIPPING POLICY | `/shipping` | ssr | 6 | 0 | 1 | 0 | 0 | 7 |
| SIDE CART | `/ (drawer)` | client | 4 | 0 | 0 | 0 | 0 | 4 |
| STYLE QUIZ | `/style-quiz` | client | 6 | 4 | 0 | 4 | 0 | 14 |
| SUSTAINABILITY | `/sustainability` | ssr | 6 | 0 | 1 | 0 | 0 | 7 |
| THANK YOU PAGE | `/thank-you` | client | 8 | 1 | 0 | 0 | 0 | 9 |
| UGC GALLERY | `(component)` | client | 18 | 4 | 0 | 4 | 0 | 26 |
| WHITE GLOVE DELIVERY | `/white-glove-delivery` | client | 3 | 0 | 0 | 2 | 0 | 5 |
| WISHLIST SHARE | `/wishlist-share (404)` | — | 3 | 0 | 0 | 0 | 0 | 3 |

**DOM column legend**: `ssr` = page returns full hookup-relevant DOM via curl (server-rendered); `client` = page returns only the master-shell slots and is hydrated on the client (DOM evidence weaker — features without alias/static fallback land in `▢ unprobed`); `—` = page-level 404.

## Live URL probe

**OK (200):** `/`, `/about`, `/blog`, `/cart`, `/checkout`, `/community-gallery`, `/compare`, `/contact`, `/dashboard`, `/faq`, `/privacy`, `/products/canby`, `/products/cody-futon-frame`, `/referral`, `/returns`, `/reviews`, `/room-planner`, `/search`, `/shipping`, `/shop`, `/shop/all`, `/shop/futon-frames`, `/shop/mattresses`, `/style-quiz`, `/sustainability`, `/swatch-request`, `/terms`, `/thank-you`, `/warranty`, `/white-glove-delivery`

**Page-level 404 (cfw has no route):** `/admin/ab-tests`, `/admin/delivery-calendar`, `/fabric-swatches`, `/price-match-guarantee`, `/sign-in`, `/wishlist`, `/wishlist-share`

> The five non-admin 404s (`/wishlist`, `/wishlist-share`, `/price-match-guarantee`, `/fabric-swatches`, `/sign-in`) remain the most actionable items. /admin pages are expected to be auth-gated.

## P0/P1 missing — commerce-critical

1 feature(s) in CART/CHECKOUT/SIDE CART/PDP/HOME/MASTER/CATEGORY where v2 found no cfw evidence. **Verify each by hand** — these pages are largely client-rendered, so DOM probe coverage is partial.

| Page | Feature |
| --- | --- |
| MASTER PAGE | Accessibility |

## P2/P3 missing — non-commerce

4 feature(s):

| Page | Feature | feature tokens |
| --- | --- | --- |
| CONTACT | Hours ⚠️ REPEATER | `hour` |
| SHIPPING POLICY | Scheduling | `scheduling` |
| SUSTAINABILITY | Certifications ⚠️ REPEATER | `certification` |
| PRICE MATCH GUARANTEE | Policy Display ⚠️ REPEATERS | `policy, display` |

## Forward-drift — cfw-only features (absent from guide)

cfw artifacts with no token overlap with any hookup-guide feature. These are candidates for guide backfill before Wix Editor retirement.

### Drift `data-slot` values (8)

`character-ensemble`, `firefly`, `fog-scene`, `page-transition`, `separator`, `stargazing-bear`, `stargazing-fireflies-compact`, `stargazing-moon`

### Drift `data-testid` values (12)

`${testid}`, `animal-bear`, `animal-deer`, `animal-fox`, `animal-owl`, `bear`, `child`, `json-ld`, `motion-div`, `mr-pops-marquee`, `preferences-saved`, `word-span`

### Drift component basenames (28)

`EasterEggBear`, `FallsScene`, `FogScene`, `GA4Tag`, `JsonLd`, `MascotCharacters`, `MrPopsMarquee`, `PageTransition`, `ReadingScene`, `VintageSunRays`, `actions`, `catalog`, `env`, `instrumentation-client`, `json-ld`, `manifest`, `middleware`, `page-transition-config`, `plp`, `plp-observability`, `preferences`, `pricing`, `robots`, `route`, `separator`, `sitemap`, `velo-client`, `webmaster-verification`

## Full feature matrix

### ABOUT — `/about`

_2 present / 0 partial / 0 missing / 0 unprobed / 1 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ? | Repeaters | — |
| ✓ | Showroom Info | cfw-component:contact-info, cfw-slot:slot:product-info-modal-trigger, cfw-component:ProductInfoModal.test |
| ✓ | Visit CTA | cfw-component:cta-button, cfw-slot:testid:winback-shop-cta, cfw-component:VisitPage.test |

### ADMIN A/B TESTS — `/admin/ab-tests (404)`

_2 present / 0 partial / 0 missing / 1 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Detail Panel | cfw-component:GuideDetailPage.test, cfw-slot:slot:profile-details |
| ▢ | Experiments ⚠️ REPEATER | — |
| ✓ | Summary Stats | cfw-component:review-stats, cfw-slot:testid:stats-strip-list, cfw-component:StatsStrip.test |

### ADMIN DELIVERY CALENDAR — `/admin/delivery-calendar (404)`

_1 present / 1 partial / 0 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Appointment Calendar ⚠️ REPEATER | alias→component:AppointmentForm, cfw-component:appointment-state, cfw-slot:testid:appointment-success |
| ~ | Block Date Form | cfw-component:SwatchRequestForm, cfw-slot:testid:newsletter-form, cfw-component:SurveyForm.test |

### BLOG — `/blog`

_11 present / 0 partial / 0 missing / 1 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ▢ | Author Bio | — |
| ✓ | Content | cfw-slot:slot:care-guide-content |
| ✓ | Featured Post | cfw-component:static-posts, cfw-slot:testid:featured-products, cfw-component:static-blog-posts.test |
| ✓ | Filter Chips ⚠️ REPEATER | alias→component:FilterFirst, alias→component:PLPControls, alias→component:FilterFirst |
| ✓ | Header + Filter | alias→component:FilterFirst, alias→component:PLPControls, alias→component:ReviewFilter |
| ✓ | Newsletter Capture | alias→component:HomeNewsletterSection, alias→slot:site-footer-newsletter, alias→slot:home-newsletter-section |
| ✓ | Newsletter Capture | alias→component:HomeNewsletterSection, alias→slot:site-footer-newsletter, alias→slot:home-newsletter-section |
| ✓ | Post List ⚠️ REPEATER | dom-tokens:post,list, cfw-component:static-posts, cfw-slot:slot:blog-post-list |
| ✓ | Related Posts ⚠️ REPEATER | cfw-component:static-posts, cfw-slot:slot:blog-post-list, cfw-component:static-blog-posts.test |
| ✓ | Related Products ⚠️ REPEATER | cfw-component:products-sentry.test, cfw-slot:testid:product-spin-viewer, cfw-component:products-search.test |
| ✓ | SEO | alias→component:JsonLd, alias→component:og-metadata.test, alias→component:contact-schema |
| ✓ | Share Buttons | cfw-component:WishlistShareButton.test, cfw-slot:testid:wishlist-share-button, cfw-component:WishlistShareButton |

### CART PAGE — `/cart`

_10 present / 0 partial / 0 missing / 1 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Cart Data | cfw-component:mega-menu-data, cfw-slot:testid:cart-trigger-count, cfw-component:home-page-data.test |
| ✓ | Cart Items ⚠️ REPEATER | dom-tokens:cart,item, alias→slot:cart-lines, cfw-component:cart-state.test |
| ✓ | Cart Totals | cfw-component:cart-state.test, cfw-slot:testid:cart-trigger-count, cfw-component:cart-state |
| ✓ | Cross-Sell ⚠️ REPEATER | alias→component:PdpCrossSell, cfw-component:cross-sell.test, cfw-slot:slot:pdp-cross-sell |
| ✓ | Delivery | alias→component:api-delivery-zone.test, cfw-component:delivery-zone-types, cfw-slot:testid:delivery-timeline |
| ✓ | Empty Cart | cfw-component:EmptyCartIllustration.test, cfw-slot:testid:cart-empty, cfw-component:EmptyCartIllustration |
| ✓ | Financing | alias→component:PdpFinancing, cfw-component:PdpFinancing.test, cfw-slot:testid:pdp-financing |
| ✓ | Recently Viewed ⚠️ REPEATER | alias→component:PdpRecentlyViewed, alias→component:recently-viewed, cfw-component:recently-viewed.test |
| ✓ | Shipping Progress | cfw-component:shipping-estimate.test, cfw-slot:testid:pdp-shipping-result, cfw-component:shipping-estimate |
| ▢ | Tier Discount | — |
| ✓ | You Might Also Like ⚠️ REPEATER | alias→component:PdpAlsoBought, alias→slot:pdp-also-bought, alias→component:also-bought |

### CATEGORY PAGE — `/shop/<slug>`

_9 present / 1 partial / 0 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Comparison Tray (NEW v1.2.0+ — PR #667 / CF-r0dr) — REPLACES Compare Bar | cfw-component:compare.test, cfw-slot:testid:trust-bar-list, cfw-component:compare-state.test |
| ✓ | Empty States | cfw-component:review-stats, cfw-slot:testid:stats-strip-list, cfw-component:StatsStrip.test |
| ✓ | Filters | alias→component:FilterFirst, alias→component:PLPControls, alias→component:ReviewFilter |
| ✓ | Hero / Breadcrumb | dom-tokens:hero,breadcrumb, alias→component:LivingHero, alias→component:BearHero |
| ✓ | Mobile Filter Drawer | alias→component:FilterFirst, alias→component:PLPControls, alias→component:ReviewFilter |
| ✓ | Product Grid ⚠️ REPEATER | dom-tokens:product,grid, cfw-component:products-sentry.test, cfw-slot:testid:product-spin-viewer |
| ✓ | Quick View Modal | dom-tokens:quick,view, alias→component:QuickViewButton, alias→component:quick-view |
| ✓ | Recently Viewed | alias→component:PdpRecentlyViewed, alias→component:recently-viewed, cfw-component:recently-viewed.test |
| ✓ | SEO | alias→component:JsonLd, alias→component:og-metadata.test, alias→component:contact-schema |
| ✓ | Swatch Filter (NEW v1.2.0+ — PR #670 / CF-wigv) | alias→component:FilterFirst, alias→component:PLPControls, alias→component:HomeSwatchPromo |

### CHECKOUT — `/checkout`

_10 present / 1 partial / 0 missing / 2 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Address Validation | cfw-component:AddressCheckForm, cfw-slot:testid:address-check-form |
| ✓ | Afterpay / Financing | alias→component:PdpFinancing, cfw-component:PdpFinancing.test, cfw-slot:testid:pdp-financing |
| ✓ | Checkout Summary | cfw-component:checkout-route.test, cfw-slot:testid:proceed-to-checkout, cfw-component:checkout-action.test |
| ✓ | Delivery Estimate | cfw-component:shipping-estimate.test, cfw-slot:testid:delivery-timeline, cfw-component:shipping-estimate |
| ✓ | Express Checkout | cfw-component:checkout-route.test, cfw-slot:testid:proceed-to-checkout, cfw-component:checkout-action.test |
| ✓ | Order Notes | dom-tokens:order,not, cfw-component:orders.test, cfw-slot:testid:shared-wishlist-not-found |
| ~ | Order Summary Sidebar ⚠️ REPEATER | cfw-component:orders.test, cfw-slot:slot:order-total, cfw-component:orders-wrapper.test |
| ▢ | Payment Methods ⚠️ REPEATER | — |
| ✓ | Progress ⚠️ REPEATER | cfw-component:RouteProgressBar.test, cfw-slot:slot:route-progress-bar, cfw-component:RouteProgressBar |
| ▢ | Protection Plans ⚠️ NESTED REPEATER | — |
| ✓ | Shipping Options ⚠️ REPEATER | cfw-component:shipping-estimate.test, cfw-slot:testid:pdp-shipping-result, cfw-component:shipping-estimate |
| ✓ | Store Credit | cfw-component:newsletter-store.test, cfw-component:newsletter-store |
| ✓ | Trust Signals ⚠️ REPEATER | alias→component:TrustBar, alias→slot:trust-bar, cfw-component:TrustBar.test |

### COMMUNITY GALLERY — `/community-gallery`

_4 present / 0 partial / 0 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Filters ⚠️ REPEATER | alias→component:FilterFirst, alias→component:PLPControls, alias→component:ReviewFilter |
| ✓ | Gallery Grid ⚠️ REPEATER | cfw-component:community-gallery.test, cfw-slot:testid:community-gallery-grid, cfw-component:community-gallery-lib.test |
| ✓ | Lightbox | alias→component:GiftCardPromo, alias→component:HomeSwatchPromo, cfw-component:SaleLightbox.test |
| ✓ | State | alias→component:EmptyCartIllustration, alias→slot:empty-cart-illustration, cfw-component:swatch-request-state |

### COMPARE PAGE — `/compare`

_4 present / 1 partial / 0 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Attributes Table ⚠️ REPEATER | cfw-component:CompareTable, cfw-slot:slot:compare-table |
| ✓ | Column Rendering ⚠️ REPEATER | cfw-slot:slot:compare-column-head |
| ✓ | Mobile & Reset | cfw-component:HeaderMobileMenu.test, cfw-component:HeaderMobileMenu |
| ✓ | SEO | alias→component:JsonLd, alias→component:og-metadata.test, alias→component:contact-schema |
| ~ | URL Params / Fetch | cfw-component:buildPageUrl.test |

### CONTACT — `/contact`

_5 present / 0 partial / 1 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Appointment ⚠️ FORM | dom-phrase:appointment-form, dom-tokens:appointment,form, alias→component:AppointmentForm |
| ✓ | Business Info | cfw-component:contact-info, cfw-slot:slot:product-info-modal-trigger, cfw-component:ProductInfoModal.test |
| ✓ | Contact Form | dom-phrase:contact-form, dom-tokens:contact,form, cfw-component:ContactForm.test |
| ✗ | Hours ⚠️ REPEATER | — |
| ✓ | Schema | alias→component:JsonLd, alias→component:json-ld, alias→component:JsonLd |
| ✓ | Social Proof ⚠️ REPEATER | cfw-component:social-embeds, cfw-slot:testid:social-share, cfw-component:SocialFeeds |

### FABRIC SWATCHES — `/fabric-swatches (404)`

_5 present / 0 partial / 0 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Filter Controls | alias→component:FilterFirst, alias→component:PLPControls, alias→component:ReviewFilter |
| ✓ | Request Form | cfw-component:SwatchRequestForm, cfw-slot:testid:swatch-request-success, cfw-component:swatch-request.test |
| ✓ | SEO | alias→component:JsonLd, alias→component:og-metadata.test, alias→component:contact-schema |
| ✓ | Selection Tray ⚠️ REPEATER | cfw-component:variant-selection.test, cfw-component:variant-selection |
| ✓ | Swatch Grid ⚠️ REPEATER | cfw-component:VariantSwatchGrid.test, cfw-slot:slot:variant-swatch-grid, cfw-component:VariantSwatchGrid |

### FAQ — `/faq`

_3 present / 0 partial / 0 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Category Filters ⚠️ REPEATER | alias→component:FilterFirst, alias→component:PLPControls, alias→component:ReviewFilter |
| ✓ | Contact CTA | cfw-component:cta-button, cfw-slot:testid:winback-shop-cta, cfw-component:contact-state |
| ✓ | FAQ Accordion ⚠️ REPEATER | cfw-component:faq-schema.test, cfw-component:faq-page.test |

### FULLSCREEN / PRODUCT VIDEOS — `(modal)`

_2 present / 0 partial / 0 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Category Filters ⚠️ REPEATER | alias→component:FilterFirst, alias→component:PLPControls, alias→component:ReviewFilter |
| ✓ | Video Grid ⚠️ REPEATER | cfw-component:videos-page.test, cfw-slot:testid:video-gallery, cfw-component:videos-cms.test |

### HOME PAGE — `/`

_17 present / 0 partial / 0 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Blog Teasers (CF-iix7) | dom-phrase:blog-teasers, dom-tokens:blog,teaser, alias→component:BlogTeasers |
| ✓ | Category Cards ⚠️ REPEATER | dom-tokens:category,card, alias→component:CategoryCardImage, alias→component:CategoryCardImage |
| ✓ | Continue Shopping (NEW v1.2.0+ — PR #665 / CF-ku3x) ⚠️ REPEATER | alias→component:ContinueShoppingStrip, alias→slot:continue-shopping-row, cfw-component:ContinueShoppingStrip.test |
| ✓ | Featured Products ⚠️ REPEATER | cfw-component:featured-products-data.test, cfw-slot:testid:featured-products, cfw-component:FeaturedProducts.test |
| ✓ | Gift Card Section (PR #533 — CF-mwpw) | dom-tokens:gift,card, alias→component:GiftCardPicker, alias→component:GiftCardPromo |
| ✓ | Hero Section | alias→component:LivingHero, alias→component:BearHero, alias→component:MascotWorldHero |
| ✓ | Newsletter | dom-phrase:newsletter, alias→component:HomeNewsletterSection, alias→slot:site-footer-newsletter |
| ✓ | Quiz CTA | dom-phrase:quiz-cta, dom-tokens:quiz,cta, alias→component:HomeQuizCta |
| ✓ | Recently Viewed | alias→component:PdpRecentlyViewed, alias→component:recently-viewed, cfw-component:recently-viewed.test |
| ✓ | SEO / Decorative | alias→component:JsonLd, alias→component:og-metadata.test, alias→component:contact-schema |
| ✓ | Sale Products ⚠️ REPEATER | cfw-component:products-on-sale.test, cfw-slot:testid:product-spin-viewer, cfw-component:products-sentry.test |
| ✓ | Smooth Scroll Triggers | alias→component:ScrollStory, alias→slot:scroll-story, alias→component:RouteProgressBar |
| ✓ | Social Feeds (CF-iix7) | dom-phrase:social-feeds, dom-tokens:social,feed, alias→slot:social-feeds |
| ✓ | Swatch Promo | dom-phrase:swatch-promo, dom-tokens:swatch,promo, alias→component:HomeSwatchPromo |
| ✓ | Testimonials ⚠️ REPEATER | alias→component:TestimonialsStrip, cfw-component:TestimonialsStrip.test, cfw-slot:testid:testimonial |
| ✓ | Trust Bar ✅ SECTION RENAMED | dom-tokens:trust,bar, alias→component:TrustBar, alias→slot:trust-bar |
| ✓ | Video Showcase | dom-phrase:video-showcase, dom-tokens:video,showcase, alias→component:VideoShowcaseStrip |

### MASTER PAGE — `/ (global)`

_15 present / 0 partial / 1 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✗ | Accessibility | — |
| ✓ | Announcement Bar | dom-phrase:announcement-bar, dom-tokens:announcement,bar, alias→component:AnnouncementBar |
| ✓ | Breadcrumbs | alias→component:Breadcrumbs, cfw-component:Breadcrumbs.test, cfw-component:Breadcrumbs |
| ✓ | Cart (global) | alias→component:CartTrigger, alias→component:CartDrawer, alias→component:CartTrigger |
| ✓ | Exit Intent Popup | alias→component:EmailCapturePopup, cfw-component:EmailCapturePopup.test, cfw-component:EmailCapturePopup |
| ✓ | Footer Accordions (mobile) | alias→component:Footer, alias→component:Footer, alias→slot:site-footer |
| ✓ | Footer ⚠️ REPEATERS | alias→component:Footer, alias→slot:site-footer, cfw-component:MascotFooterDivider.test |
| ✓ | Header Shipping Progress | dom-tokens:header,progres, cfw-component:shipping-estimate.test, cfw-slot:testid:pdp-shipping-result |
| ✓ | Living Sky (Phase 7 + Phase 8 COMPLETE ✅) | dom-phrase:living-sky, dom-tokens:living,sky,frame, cfw-component:living-sky-svg |
| ✓ | Mobile Drawer | alias→component:HeaderMobileMenu, cfw-component:HeaderMobileMenu.test, cfw-slot:testid:cart-drawer |
| ✓ | Navigation | alias→slot:site-header |
| ✓ | Newsletter Modal | alias→component:EmailCapturePopup, alias→component:HomeNewsletterSection, alias→slot:site-footer-newsletter |
| ✓ | PWA Install Banner | alias→component:PwaInstallBanner, alias→component:AppDownloadBanner, cfw-component:PwaInstallBanner.test |
| ✓ | Promo Lightbox ⚠️ REPEATER | alias→component:GiftCardPromo, alias→component:HomeSwatchPromo, cfw-component:SwatchPromoSection |
| ✓ | Schema | alias→component:JsonLd, alias→component:json-ld, alias→component:JsonLd |
| ✓ | Sticky Nav / Back to Top | dom-tokens:sticky,nav,back,top, alias→component:BackToTop, alias→slot:site-header-sub |

### MEMBER PAGE — `/dashboard`

_7 present / 2 partial / 0 missing / 3 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ~ | Account / Address / Prefs | cfw-component:AddressCheckForm, cfw-slot:testid:address-check-form, cfw-component:AccountSignIn |
| ~ | CF+ Upgrade Prompt Modal (NEW v1.2.0+ — PR #666 / CF-llrd) | cfw-component:QuickViewModal.test, cfw-slot:slot:product-info-modal-trigger, cfw-component:QuickViewModal |
| ✓ | Daily Spin Wheel (NEW — CF-spin-wheel Phase 1) | cfw-component:SpinWheel, cfw-slot:slot:spin-wheel, cfw-component:spin-state |
| ✓ | Dashboard | cfw-component:RegistryDashboard, cfw-slot:slot:member-dashboard-tabs, cfw-component:ReferralDashboard |
| ✓ | Loyalty ⚠️ REPEATER | cfw-component:loyalty |
| ✓ | Order History ⚠️ REPEATER | cfw-component:OrderHistoryList.test, cfw-slot:slot:order-history-list, cfw-component:OrderHistoryList |
| ✓ | Quick Links | cfw-component:quick-view, cfw-slot:testid:product-link, cfw-component:cf-link |
| ✓ | Returns Portal (`ReturnsPortal.js`) | cfw-component:ReturnsPage.test |
| ▢ | Rewards ⚠️ REPEATER | — |
| ▢ | Streak Display (NEW — CF-64k) | — |
| ▢ | Streak Display (NEW — Phase 2 Streak Multipliers) | — |
| ✓ | Wishlist ⚠️ REPEATER | cfw-component:wishlist-types, cfw-slot:testid:wishlist-share-button, cfw-component:wishlist-share.test |

### PRICE MATCH GUARANTEE — `/price-match-guarantee (404)`

_5 present / 0 partial / 1 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | My Requests ⚠️ REPEATER | cfw-component:swatch-request.test, cfw-slot:testid:swatch-request-success, cfw-component:swatch-request-state |
| ✓ | Page Header | cfw-component:HeaderMobileMenu.test, cfw-slot:slot:site-header-sub, cfw-component:HeaderMobileMenu |
| ✗ | Policy Display ⚠️ REPEATERS | — |
| ✓ | Request Form | cfw-component:SwatchRequestForm, cfw-slot:testid:swatch-request-success, cfw-component:swatch-request.test |
| ✓ | Savings Preview | cfw-slot:slot:swatch-preview |
| ✓ | Success State | cfw-component:swatch-request-state, cfw-slot:testid:swatch-request-success, cfw-component:survey-state |

### PRODUCT PAGE — `/products/<slug>`

_25 present / 6 partial / 0 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | 360° Spin Viewer (`ProductSpinViewer.js`) | cfw-component:ProductSpinViewer.test, cfw-slot:testid:product-spin-viewer, cfw-component:ProductSpinViewer |
| ✓ | Also Bought ⚠️ REPEATER | alias→component:PdpAlsoBought, alias→slot:pdp-also-bought, cfw-component:also-bought |
| ✓ | BNPL Calculator Widget (CF-zpf — in progress) | alias→component:PdpFinancing, alias→component:PdpFinancing, alias→component:PdpFinancing |
| ✓ | BNPL Widget (CF-nqb5.1 — PR #936 ✅ MERGED 2026-03-29) | alias→component:PdpFinancing, alias→component:PdpFinancing, cfw-component:TurnstileWidget |
| ✓ | CF+ Upgrade Prompt Modal — Product Page Instance (NEW v1.2.0+ — PR #666 / CF-llrd) | cfw-component:ProductInfoModal.test, cfw-slot:slot:product-info-modal-trigger, cfw-component:ProductInfoModal |
| ✓ | Collection Card Builder (NEW v0.9.0+) | alias→component:CategoryCardImage, cfw-component:plp-card-images.test, cfw-slot:slot:skeleton-card-title |
| ✓ | Collection Products ⚠️ REPEATER | cfw-component:products-sentry.test, cfw-slot:testid:product-spin-viewer, cfw-component:products-search.test |
| ✓ | Delivery Estimator (NEW v1.1.0+ — PR #649) | alias→component:api-delivery-zone.test, cfw-component:delivery-zone-types, cfw-slot:testid:delivery-timeline |
| ✓ | Empty State Builder (NEW v0.9.0+) | alias→component:EmptyCartIllustration, alias→slot:empty-cart-illustration, cfw-component:swatch-request-state |
| ✓ | Financing (v0.9.0+ — `ProductFinancing.js`) | alias→component:PdpFinancing, cfw-component:PdpFinancing.test, cfw-slot:testid:pdp-financing |
| ~ | Gallery Zoom Lightbox (v1.2.0+ — `GalleryZoomLightbox.js`) | cfw-component:community-gallery.test, cfw-slot:testid:video-gallery, cfw-component:community-gallery-lib.test |
| ✓ | Gift as a Gift CTA (PR #529 — CF-9fv2) | cfw-component:cta-button, cfw-slot:testid:winback-shop-cta, cfw-component:QuizCtaSection |
| ✓ | Live Inventory + Low Stock (Sprint 5 — `LiveInventory.js`) | alias→component:PdpStockBadge, alias→component:stock-badge-state, cfw-component:stock-badge-state.test |
| ✓ | Live Inventory + Low Stock (Sprint 5 — `LiveInventory.js`) :: Product Page Elements (added alongside existing product page) | alias→component:PdpStockBadge, alias→component:stock-badge-state, cfw-component:stock-badge-state.test |
| ~ | Price Lock Widget (NEW — CF-tjf0, PR #935) | cfw-component:plp-price.test, cfw-slot:testid:variant-price, cfw-component:plp-price |
| ✓ | Product Badge (NEW v1.2.0+ — PR #657 / CF-p56i) | alias→component:PdpProductBadges, alias→component:PdpProductBadges, alias→component:product-badges |
| ✓ | Product Info | cfw-component:ProductInfoModal.test, cfw-slot:slot:product-info-modal-trigger, cfw-component:ProductInfoModal |
| ✓ | Product Info Modal — Care Guide + Dimensions (NEW v1.1.0+ — PR #651) | alias→component:ProductInfoModal, cfw-component:ProductInfoModal.test, cfw-slot:slot:product-info-modal-trigger |
| ✓ | Product Options / Variant Swatches (NEW v0.9.0+) | alias→component:PdpFabricSwatches, alias→component:PdpFabricSwatches, cfw-component:VariantSwatchGrid.test |
| ✓ | Product Q&A Widget (Sprint 5 — `ProductQnA.js`) ✅ MERGED PR #678 | cfw-component:products-sentry.test, cfw-slot:testid:product-spin-viewer, cfw-component:products-search.test |
| ~ | Promo Banner Carousel (NEW v0.9.0+) | cfw-component:SwatchPromoSection, cfw-slot:testid:promo-code, cfw-component:ReferralShareBanner |
| ✓ | Recently Viewed ⚠️ REPEATER | alias→component:PdpRecentlyViewed, alias→component:recently-viewed, cfw-component:recently-viewed.test |
| ✓ | Related Products ⚠️ REPEATER | cfw-component:products-sentry.test, cfw-slot:testid:product-spin-viewer, cfw-component:products-search.test |
| ✓ | Reviews & Ratings (NEW v0.9.0+) | alias→component:PdpReviews, cfw-component:reviews, cfw-slot:testid:review-badge |
| ~ | Share Your Room — UGC Photo Submit (CF-rw9i.1 — PR #938 ✅ MERGED 2026-03-29) | cfw-component:PhotoSubmitForm, cfw-slot:testid:wishlist-share-button, cfw-component:wishlist-share.test |
| ~ | Shipping Intelligence Layer (Sprint 5 — `ShippingIntelligence.js`) ✅ MERGED PR #674 | cfw-component:shipping-estimate.test, cfw-slot:testid:pdp-shipping-result, cfw-component:shipping-estimate |
| ✓ | Size Guide & Room Fit (NEW v0.9.0+) | alias→component:PdpSizeGuide, alias→component:PdpSizeGuide, alias→component:size-guide |
| ✓ | Social Story Helpers (NEW v0.9.0+) | alias→component:ScrollStory, cfw-component:social-embeds, cfw-slot:testid:social-share |
| ✓ | Stamped.io Reviews (NEW — CF-gxn1) | alias→component:PdpReviews, cfw-component:reviews, cfw-slot:testid:review-badge |
| ✓ | Sticky Add-to-Cart Bar (NEW v1.2.0+ — PR #664 / CF-gj26) | dom-tokens:sticky,add,bar, cfw-component:AddToCartButton.test, cfw-slot:testid:wishlist-share-button |
| ~ | Video Review Grid (CF-ou66.3 — PR #941 ✅ MERGED 2026-04-04) | cfw-component:videos-page.test, cfw-slot:testid:pdp-video-player, cfw-component:videos-cms.test |

### REFERRAL PAGE — `/referral`

_4 present / 1 partial / 0 missing / 1 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Auth State | cfw-component:swatch-request-state, cfw-component:survey-state |
| ✓ | History ⚠️ REPEATER | cfw-component:OrderHistoryList.test, cfw-slot:slot:order-history-list, cfw-component:OrderHistoryList |
| ▢ | How It Works ⚠️ REPEATER | — |
| ✓ | Share Buttons | cfw-component:WishlistShareButton.test, cfw-slot:testid:wishlist-share-button, cfw-component:WishlistShareButton |
| ✓ | Stats | cfw-component:review-stats, cfw-slot:testid:stats-strip-list, cfw-component:StatsStrip.test |
| ~ | Your Code/Link | cfw-component:cf-link, cfw-slot:testid:promo-code |

### ROOM PLANNER — `/room-planner`

_8 present / 0 partial / 0 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Canvas — CF-eqc5.3 (PR #948/949) | dom-tokens:planner,text, cfw-component:RoomPlannerCanvas.test, cfw-slot:slot:room-canvas |
| ✓ | Hero | alias→component:LivingHero, alias→component:BearHero, alias→component:MascotWorldHero |
| ✓ | How-To Steps ⚠️ REPEATER | cfw-component:steps, cfw-slot:slot:trade-in-steps |
| ✓ | Palette Category ⚠️ REPEATER | cfw-component:categories, cfw-slot:slot:product-palette, cfw-component:ProductPalette |
| ✓ | Product Palette ⚠️ REPEATER | cfw-component:ProductPalette, cfw-slot:slot:product-palette, cfw-component:products-sentry.test |
| ✓ | Room Presets ⚠️ REPEATER | cfw-component:room-scenes, cfw-slot:testid:room-fit-result, cfw-component:room-planner-logic.test |
| ✓ | Room Setup | cfw-component:room-scenes, cfw-slot:testid:room-fit-result, cfw-component:room-planner-logic.test |
| ✓ | Save/Share | cfw-component:wishlist-share.test, cfw-slot:testid:wishlist-share-button, cfw-component:share-token |

### SEARCH RESULTS — `/search`

_5 present / 0 partial / 0 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Filters | alias→component:FilterFirst, alias→component:PLPControls, alias→component:ReviewFilter |
| ✓ | No Results | cfw-component:result-token, cfw-slot:testid:room-fit-result, cfw-component:QuizResult |
| ✓ | Results Grid ⚠️ REPEATER | dom-tokens:result,grid, cfw-component:result-token, cfw-slot:testid:room-fit-result |
| ✓ | Search Controls | cfw-component:products-search.test, cfw-slot:slot:search-suggestions, cfw-component:api-search.test |
| ✓ | Suggestions ⚠️ REPEATER | cfw-slot:slot:search-suggestions |

### SHIPPING POLICY — `/shipping`

_6 present / 0 partial / 1 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Assembly Guides ⚠️ REPEATER | cfw-component:guides, cfw-component:GuidesIndexPage.test |
| ✓ | Calculator | alias→component:PdpFinancing, alias→component:PdpFinancing |
| ✓ | Care Tips ⚠️ REPEATER | cfw-slot:slot:generic-care-guide |
| ✓ | Delivery Methods ⚠️ REPEATER | cfw-component:delivery-zone-types, cfw-slot:testid:delivery-timeline, cfw-component:api-delivery-zone.test |
| ✓ | Delivery Prep | cfw-component:delivery-zone-types, cfw-slot:testid:delivery-timeline, cfw-component:api-delivery-zone.test |
| ✗ | Scheduling | — |
| ✓ | Schema | alias→component:JsonLd, alias→component:json-ld, alias→component:JsonLd |

### SIDE CART — `/ (drawer)`

_4 present / 0 partial / 0 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Cross-Sell ⚠️ REPEATER | alias→component:PdpCrossSell, cfw-component:cross-sell.test, cfw-slot:slot:pdp-cross-sell |
| ✓ | Items ⚠️ REPEATER | alias→slot:cart-lines, cfw-component:PdpViewItemTracker.test, cfw-slot:testid:trust-bar-item |
| ✓ | Panel | alias→component:CartDrawer, cfw-slot:slot:mega-menu-panel |
| ✓ | Progress Bars | dom-tokens:progres,bar, cfw-component:RouteProgressBar.test, cfw-slot:slot:route-progress-bar |

### STYLE QUIZ — `/style-quiz`

_6 present / 4 partial / 0 missing / 4 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | AI Style Consultant (Sprint 5 — `styleConsultant.web.js`) | cfw-component:style-quiz-page.test, cfw-slot:testid:style-quiz, cfw-component:style-quiz-lib.test |
| ~ | AI Style Consultant (Sprint 5 — `styleConsultant.web.js`) :: AI Results Section (added to existing Style Quiz results area) | cfw-component:style-quiz-page.test, cfw-slot:testid:style-quiz, cfw-component:style-quiz-lib.test |
| ~ | Futon Sommelier Elements (shown only if `'sommelierAnswers'` present in session storage) | cfw-component:futon-sommelier-data.test, cfw-slot:slot:futon-sommelier-results, cfw-component:futon-sommelier-data |
| ▢ | Future Wiring — Challenge of the Week (Homepage) | — |
| ~ | Future Wiring — Gamification Chips (inside `#collectionRepeater` item) | cfw-component:gamification |
| ▢ | Future Wiring — Leaderboard Page (`/leaderboard`) | — |
| ✓ | Options ⚠️ REPEATER | cfw-component:color-options.test, cfw-slot:slot:variant-option, cfw-component:color-options |
| ▢ | Phase 7 Shipped (2026-04-13) | — |
| ▢ | Phase 8 Shipped (2026-04-13) | — |
| ✓ | Quiz Result Elements | cfw-component:QuizResult, cfw-slot:testid:style-quiz, cfw-component:style-quiz-page.test |
| ✓ | Quiz Steps | cfw-component:style-quiz-page.test, cfw-slot:testid:style-quiz, cfw-component:style-quiz-lib.test |
| ✓ | Results | cfw-component:result-token, cfw-slot:testid:room-fit-result, cfw-component:QuizResult |
| ✓ | Results ⚠️ REPEATER | cfw-component:result-token, cfw-slot:testid:room-fit-result, cfw-component:QuizResult |
| ~ | ⚠️ New CMS Collections — Stilgar must create | cfw-component:videos-cms.test, cfw-slot:slot:create-registry-trigger, cfw-component:collections |

### SUSTAINABILITY — `/sustainability`

_6 present / 0 partial / 1 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Carbon Offset | dom-phrase:carbon-offset, dom-tokens:carbon,offset, cfw-slot:slot:carbon-offset-section |
| ✗ | Certifications ⚠️ REPEATER | — |
| ✓ | Commitment Badges ⚠️ REPEATER | cfw-component:product-badges, cfw-slot:slot:product-badges, cfw-component:PdpProductBadges |
| ✓ | Hero | alias→component:LivingHero, alias→component:BearHero, alias→component:MascotWorldHero |
| ✓ | Materials ⚠️ REPEATER | dom-phrase:materials-repeater, cfw-slot:slot:materials-repeater |
| ✓ | SEO Schema | alias→component:JsonLd, alias→component:json-ld, alias→component:JsonLd |
| ✓ | Trade-In Program ⚠️ REPEATER | dom-tokens:trade,program, cfw-slot:slot:trade-in-steps |

### THANK YOU PAGE — `/thank-you`

_8 present / 1 partial / 0 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Brenda's Message | cfw-slot:testid:brenda-message |
| ~ | Care / Assembly / Review | cfw-component:reviews, cfw-slot:testid:review-badge, cfw-component:review-stats |
| ✓ | Delivery Timeline | cfw-component:delivery-zone-types, cfw-slot:testid:delivery-timeline, cfw-component:api-delivery-zone.test |
| ✓ | Newsletter | dom-phrase:newsletter, alias→component:HomeNewsletterSection, alias→slot:site-footer-newsletter |
| ✓ | Order Summary | cfw-component:orders.test, cfw-slot:slot:order-total, cfw-component:orders-wrapper.test |
| ✓ | Post-Purchase ⚠️ REPEATER | cfw-component:static-posts, cfw-slot:slot:blog-post-list, cfw-component:static-blog-posts.test |
| ✓ | Referral | cfw-component:referral-actions.test, cfw-component:referral |
| ✓ | Social Sharing | cfw-component:social-embeds, cfw-slot:testid:social-share, cfw-component:SocialFeeds |
| ✓ | White Glove Prompt (NEW — CF-y7lp) | cfw-component:PdpWhiteGlove.test, cfw-slot:slot:pdp-white-glove, cfw-component:PdpWhiteGlove |

### UGC GALLERY — `(component)`

_18 present / 4 partial / 0 missing / 4 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Balance Check | cfw-component:AddressCheckForm, cfw-slot:testid:address-check-form |
| ✓ | Breadcrumb ⚠️ REPEATER | cfw-component:Breadcrumbs.test, cfw-component:Breadcrumbs |
| ✓ | Bundle Builder Shipping | cfw-component:shipping-estimate.test, cfw-slot:testid:pdp-shipping-result, cfw-component:shipping-estimate |
| ▢ | Commerce | — |
| ✓ | Content | cfw-slot:slot:care-guide-content |
| ✓ | Content & SEO | alias→component:JsonLd, alias→component:og-metadata.test, alias→component:contact-schema |
| ✓ | Content Sections ⚠️ REPEATER | cfw-component:SwatchPromoSection, cfw-slot:testid:newsletter-section, cfw-component:QuizCtaSection |
| ▢ | Denominations ⚠️ REPEATER | — |
| ✓ | Email Automation | cfw-component:EmailCapturePopup.test, cfw-slot:testid:email-capture, cfw-component:EmailCapturePopup |
| ✓ | FAQ ⚠️ REPEATER | cfw-component:faq-schema.test, cfw-component:faq-page.test |
| ✓ | Form | cfw-component:SwatchRequestForm, cfw-slot:testid:newsletter-form, cfw-component:SurveyForm.test |
| ✓ | Gallery Grid | cfw-component:community-gallery.test, cfw-slot:testid:community-gallery-grid, cfw-component:community-gallery-lib.test |
| ✓ | Internal Links ⚠️ REPEATER | cfw-component:cf-link, cfw-slot:testid:product-link |
| ▢ | Page-level Elements | — |
| ~ | ProductShippingProfiles CMS Fields (for reference — edited directly in Wix CMS) | cfw-component:videos-cms.test |
| ✓ | Purchase Form | cfw-component:SwatchRequestForm, cfw-slot:testid:newsletter-form, cfw-component:SurveyForm.test |
| ✓ | Registry List & Create Form | cfw-component:RegistryCreateForm, cfw-slot:slot:registry-list-empty, cfw-component:CreateRegistryForm |
| ▢ | Related Clusters ⚠️ REPEATER | — |
| ~ | Social Media Automation | cfw-component:social-embeds, cfw-slot:testid:social-share, cfw-component:SocialFeeds |
| ✓ | Spoke Cards ⚠️ REPEATER | cfw-component:plp-card-images.test, cfw-slot:slot:skeleton-card-title, cfw-component:plp-card-images |
| ✓ | State | alias→component:EmptyCartIllustration, alias→slot:empty-cart-illustration, cfw-component:swatch-request-state |
| ✓ | Stats | cfw-component:review-stats, cfw-slot:testid:stats-strip-list, cfw-component:StatsStrip.test |
| ~ | Submission Form | cfw-component:SurveyForm.test, cfw-slot:testid:survey-success, cfw-component:SurveyForm |
| ✓ | Submit | cfw-component:PhotoSubmitForm |
| ✓ | Success | cfw-slot:testid:swatch-request-success |
| ~ | Wix Dashboard Integrations (tracked 2026-03-21) | cfw-component:wix-visitor-client.test, cfw-slot:slot:member-dashboard-tabs, cfw-component:wix-visitor-client |

### WHITE GLOVE DELIVERY — `/white-glove-delivery`

_3 present / 0 partial / 0 missing / 2 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ▢ | Calendar (Date Picker) ⚠️ REPEATER | — |
| ✓ | Confirmation | cfw-component:order-confirmation-page.test |
| ✓ | Existing Appointment | alias→component:AppointmentForm, cfw-component:appointment-state, cfw-slot:testid:appointment-success |
| ✓ | State Sections (mutually exclusive — one shown at a time) | cfw-component:swatch-request-state, cfw-slot:testid:newsletter-section, cfw-component:survey-state |
| ▢ | Window Selector ⚠️ REPEATER | — |

### WISHLIST SHARE — `/wishlist-share (404)`

_3 present / 0 partial / 0 missing / 0 unprobed / 0 unknown_

| | feature | cfw evidence |
| - | --- | --- |
| ✓ | Product Cards ⚠️ REPEATER | cfw-component:ProductCardSwatchRow.test, cfw-slot:slot:product-card-swatch-row, cfw-component:ProductCardSwatchRow |
| ✓ | SEO | alias→component:JsonLd, alias→component:og-metadata.test, alias→component:contact-schema |
| ✓ | Token Resolution | cfw-component:wix-client-tokens.test, cfw-component:share-token |

## Acceptance status

**cf-o2kq (v2, PR #1139, merged):**
- [x] Curated alias map: `scripts/cf-ah0m/feature-aliases.json`
- [x] DOM probe script: `scripts/cf-ah0m/dom_probe.py`
- [x] partial bucket 22 (target ≤50)
- [x] Forward-drift table appended

**cf-bdkq (v2.1, this PR):**
- [x] 3 false-positive partials flipped to ✓: `You Might Also Like` → `PdpAlsoBought`; `BNPL Widget` + `BNPL Calculator Widget` → `PdpFinancing`
- [x] 2 broken alias-map entries fixed: `Filters` (FacetPanel→FilterFirst/PLPControls), `Cart Global` (CartIcon→CartTrigger)
- [x] `PdpNotifyMe` removed from forward-drift false-positive (forward-drift now harvests bare backtick IDs from raw markdown)
- [x] `unprobed` verdict tier added for client-rendered / auth-walled pages (was silently biasing toward partial/missing)
- [x] PR description corrected: probe is `curl -L`, NOT Playwright

## Next steps (for melania to schedule)

1. **Manual triage of P0/P1 missing** — `Tier Discount`, `Payment Methods`, `Protection Plans` may exist in cfw under different naming inside client-rendered cart/checkout components. Inspect `src/app/cart` and `src/app/checkout` directly.
2. **Page-level 404 decisions** — `/wishlist`, `/wishlist-share`, `/price-match-guarantee`, `/fabric-swatches`, `/sign-in`: deprecated, replaced, or actually missing? File individual beads as needed.
3. **UGC GALLERY** — 14 features missing or partial. Likely a different overall approach in cfw (e.g., embedded inside `/community-gallery` rather than a separate UGC page). Investigate as a single triage thread.
4. **Forward-drift backfill** — append guide entries for the ~60 cfw components and ~18 data-slots not currently documented (mascot scenes, analytics tags, page-transition, pdp-notify-me, etc.). Helps Stilgar's retirement plan.
5. **Auth-walled DOM probe** — for member dashboard / admin pages, run the probe with a logged-in session (Playwright + saved auth state) to disambiguate `Streak Display`, `Rewards`, `Experiments`, `Calendar`/`Window Selector`.
