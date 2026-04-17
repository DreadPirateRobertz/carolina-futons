# URL → CMS / Backend Map (cf-3qt Phase 4 + 5)

**Owner:** blaidd
**Phase:** cf-3qt.4 (content) and cf-3qt.5 (marketing + utility)
**Status:** prep (Phase 1 still blocked) · decisions locked by melania 2026-04-17
**Scope:** Every production route the migration must keep live. Core commerce routes (Home, Category, Product, Cart, Checkout, Search) are called out for continuity but owned by Phase 2/3.
**Companion:** `CMS-COLLECTION-AUDIT.md` — what exists vs. what needs seeding.

**Legend:**
- **Render** = Next.js render strategy: `static`, `ISR(ttl)`, `SSR`, `dynamic`
- **Source** = where the page's data comes from. `@wix/stores`, `@wix/blog`, `@wix/data` (generic CMS), or a named webMethod we must port.
- **Owner phase** = which bead owns the migration.

---

## Phase 4 — Content pages (blaidd owns these)

| Route | Page file (Velo) | Render | Source | Notes |
|---|---|---|---|---|
| `/about` | `About.js` | `ISR(900)` tag=`pages` | `@wix/data` → **`AboutContent`** | Collection name corrected (was `About`). Fields: `sectionKey`, `title`, `content`, `sortOrder`. |
| `/faq` | `FAQ.js` | `ISR(900)` tag=`pages` | `@wix/data` → `FAQ` | Fields: `question`, `answer`, `category`, `sortOrder`. Collapsible UI client-side. |
| `/contact` | `Contact.js` | `static` + client form | `contactSubmissions.submitContactForm` + `emailService.sendEmail` webMethods | See `CONTACT-FORM-SPEC-NEXT.md`. |
| `/getting-it-home` | `Getting It Home.js` | `static` + client calc | `src/public/gettingItHomeHelpers.js` → `lib/delivery/zones.ts` | Keep `/getting-it-home` (SEO/inbound links/GSC). Add `/delivery` 301 if marketing needs a shorter URL. |
| `/compare` | `Compare Page.js` | `ISR(3600)` tag=`pages` | `@wix/stores` products + `@wix/data` → **`ComparisonFeatures`** (new) | Collection doesn't exist yet — blaidd seeds in Phase 4 impl. |
| `/videos` | `Product Videos.js` | `ISR(3600)` tag=`pages` | `@wix/data` → `ProductVideos` | Verify which of `ProductVideos` vs. legacy `Videos` collection the live site reads before seeding. |
| `/blog` | `Blog.js` | `ISR(300)` tag=`blog` | `@wix/blog` `posts.listPosts` | Paginated. See `WIX-BLOG-API-RESEARCH.md`. |
| `/blog/[slug]` | `Blog Post.js` | `ISR(600)` tag=`blog` + `generateStaticParams` | `@wix/blog` `posts.getPostBySlug` | 404 on missing slug. Render via `@wix/ricos-viewer`. |

### Phase 4 CMS collections required

| Collection | Read access | Write access | Used by |
|---|---|---|---|
| `AboutContent` | Anyone | Admin | `/about` — exists ✓ |
| `FAQ` | Anyone | Admin | `/faq`, blog FAQ blocks — exists ✓ |
| `ComparisonFeatures` | Anyone | Admin | `/compare` — **missing, blaidd seeds** |
| `ProductVideos` | Anyone | Admin | `/videos` — exists ✓ |
| `Blog/Posts` | Anyone (Wix app) | Wix Studio authors | `/blog`, `/blog/[slug]`, RSS |
| `Blog/Categories`, `Blog/Tags` | Anyone (Wix app) | Wix Studio | future category filters |
| `ContactSubmissions` | — | webMethod (server-side only) | contact form |
| `ContactRateLimits` | — | webMethod | contact form spam guard |

---

## Phase 5 — Marketing + utility (blaidd owns these)

| Route | Page file (Velo) | Render | Source | Notes |
|---|---|---|---|---|
| `/spring-sale` | `Sale.js` (variant) | `ISR(1800)` tag=`landings` | `@wix/data` → **`Landings`** (filter `slug="spring-sale"`) + `@wix/stores` sale collection | `Landings` collection missing — blaidd seeds. |
| `/newsletter` | `Newsletter.js` | `static` + client form | `newsletterService.subscribeToNewsletter` webMethod | Double opt-in already wired server-side. |
| `/press` | — (new) | `ISR(1800)` tag=`landings` | `@wix/data` → **`PressMentions`** + **`PressKitAssets`** + **`Landings`** (filter `slug="press"`) | All 3 collections missing. Launch with roadmap treatment (no placements yet). See `CMS-COLLECTION-AUDIT.md` §5. |
| `/winback` | — (new) | `ISR(1800)` tag=`landings` | `@wix/data` → **`Landings`** (filter `slug="winback"`); UTM passthrough to `analyticsHelpers.recordUtmTouch` | UTM params → fire `events.js` emit → automation engine picks up. |
| `/404` | `masterPage.js` error route | `static` | — | Brand shell + search widget. |
| `/search` | `Search Results.js` | `SSR` (reads `?q=`) | `@wix/stores` product search + `@wix/blog` `queryPosts().contains('title', q)` | Merge results client-side. |
| `/sitemap.xml` | — (generated) | route handler | Stores products + blog slugs + static routes list | Build at request time; cache 1h. |
| `/robots.txt` | — | `static` | constant | Allow all + sitemap pointer. |

### Phase 5 CMS collections required

| Collection | Read access | Write access | Used by |
|---|---|---|---|
| `Landings` | Anyone | Admin | `/spring-sale`, `/winback`, `/press`, any future campaign — **missing, blaidd seeds** |
| `PressMentions` | Anyone | Admin | `/press` — **missing, blaidd seeds** (empty on launch) |
| `PressKitAssets` | Anyone | Admin | `/press` downloads — **missing, blaidd seeds** (coord w/ godfrey for assets) |
| `NewsletterSubscribers` | — | webMethod | newsletter — exists ✓ |
| `NewsletterRateLimit` | — | webMethod | newsletter rate limit — exists ✓ |
| `Unsubscribes` | — | webMethod | newsletter + blog digest — exists ✓ |

---

## Commerce + account routes (NOT our phase — for completeness)

These are Phase 2/3 territory. Listed so the sitemap generator has the full route table.

| Route | Source | Phase |
|---|---|---|
| `/` | `@wix/stores` featured + `@wix/data` `HomepageBlocks` | 2 |
| `/product/[slug]` | `@wix/stores` `getProductBySlug` | 2 |
| `/category/[slug]` | `@wix/stores` `queryProducts` + `Categories` | 2 |
| `/cart`, `/checkout` | `@wix/stores` / `@wix/ecom` | 2 |
| `/account/*` | `@wix/members` | 3 |
| `/loyalty`, `/referral`, `/rewards` | `@wix/loyalty` + `loyaltyService` webMethods | 3 |
| `/style-quiz`, `/style-quiz/result` | `styleQuizService` webMethods | 3 |
| `/swatch-kit`, `/fabric-swatches` | `emailService.submitSwatchRequest` | 3 |
| `/virtual-consultation` | `consultationService` webMethods | 3 |
| `/wishlist`, `/wishlist-share/[id]` | `wishlistService` webMethods | 3 |
| `/gift-cards`, `/gift-registry` | `@wix/gift-cards` | 3 |
| `/store-locator`, `/local-seo/[city]` | `storeLocatorService`, `localSeoService` | 3 |
| `/admin/*` | membership-gated, backend-heavy | post-migration (keeps Wix Studio until cf-3qt.6 passes) |

---

## webMethod → Next.js route handler mapping

Every webMethod we call from the Next.js client goes through a thin `app/api/*` proxy (to keep secrets + OAuth server-side). Phase 4/5 needs:

| Next.js route handler | Proxies to webMethod | Method |
|---|---|---|
| `POST /api/contact` | `contactSubmissions.submitContactForm` | POST |
| `POST /api/newsletter/subscribe` | `newsletterService.subscribeToNewsletter` | POST |
| `POST /api/newsletter/unsubscribe` | `newsletterService.unsubscribeFromESP` | POST |
| `GET  /api/delivery-zone?zip=` | `storeLocatorService` distance calc (or inline `lib/delivery/zones.ts`) | GET |
| `GET  /api/search?q=` | fan-out to stores + blog | GET |

---

## Decisions (locked by melania 2026-04-17)

1. **Route casing** — keep `/getting-it-home`. `/delivery` may be added later as a 301 redirect if marketing asks.
2. **Winback landing** — blaidd seeds. Hero/UTM defaults pulled from `docs/strategy/klaviyo-migration-spike.md`.
3. **Press page** — soft-launch with roadmap treatment. `PressMentions` collection seeded empty; page renders "Want to feature us? Get in touch." CTA until outreach lands.
4. **Sitemap revalidate** — on-demand via webhook (millicent owns the `/api/revalidate` route handler in Phase 0 infra PR). Tags: `products`, `blog`, `pages`, `landings`. Static TTL falls back to 1h if webhook misses.
5. **Appointment booking** on `/contact` — **punted out of Phase 4**. Post-migration optimization if traffic justifies.

---

## Source of truth

- Velo pages: `src/pages/*.js`
- webMethods: `src/backend/*.web.js`
- Route casing comes from Wix Studio page settings — before Phase 6 parity audit, grab the live-site URL list and diff.
