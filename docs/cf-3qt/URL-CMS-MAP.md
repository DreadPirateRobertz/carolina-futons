# URL → CMS / Backend Map (cf-3qt Phase 4 + 5)

**Owner:** blaidd
**Phase:** cf-3qt.4 (content) and cf-3qt.5 (marketing + utility)
**Status:** prep (Phase 1 still blocked)
**Scope:** Every production route the migration must keep live. Core commerce routes (Home, Category, Product, Cart, Checkout, Search) are called out for continuity but owned by Phase 2/3.

**Legend:**
- **Render** = Next.js render strategy: `static`, `ISR(ttl)`, `SSR`, `dynamic`
- **Source** = where the page's data comes from. `@wix/stores`, `@wix/blog`, `@wix/data` (generic CMS), or a named webMethod we must port.
- **Owner phase** = which bead owns the migration.

---

## Phase 4 — Content pages (blaidd owns these)

| Route | Page file (Velo) | Render | Source | Notes |
|---|---|---|---|---|
| `/about` | `About.js` | `ISR(3600)` | `@wix/data` → `About` collection | Single-doc collection. Flat fields. |
| `/faq` | `FAQ.js` | `ISR(3600)` | `@wix/data` → `FAQ` collection | Fields: `question`, `answer` (rich), `category`, `order`. Collapsible UI client-side. |
| `/contact` | `Contact.js` | `static` + client form | `contactSubmissions.submitContactForm` webMethod | See `CONTACT-FORM-SPEC-NEXT.md`. Form POSTs to Next.js route handler → proxies to existing webMethod. |
| `/getting-it-home` | `Getting It Home.js` | `static` + client calc | `src/public/gettingItHomeHelpers.js` (port to `lib/delivery/zones.ts`) | Pure JS — zip→zone + distance. No Wix call needed; ship as client util. |
| `/compare` | `Compare Page.js` | `ISR(3600)` | `@wix/stores` products + `@wix/data` → `ComparisonFeatures` | Pulls matrix rows from collection; hydrates product cells from Stores SDK. |
| `/videos` | `Product Videos.js` | `ISR(3600)` | `@wix/data` → `ProductVideos` collection | Fields: `title`, `description`, `videoUrl` (YouTube), `thumbnailUrl`, `tags`, `order`. |
| `/blog` | `Blog.js` | `ISR(300)` | `@wix/blog` `posts.listPosts` | Paginated. See `WIX-BLOG-API-RESEARCH.md`. |
| `/blog/[slug]` | `Blog Post.js` | `ISR(600)` + `generateStaticParams` | `@wix/blog` `posts.getPostBySlug` | 404 on missing slug. Render via `@wix/ricos-viewer`. |

### Phase 4 CMS collections required

| Collection | Read access | Write access | Used by |
|---|---|---|---|
| `About` | Anyone | — | `/about` |
| `FAQ` | Anyone | — | `/faq`, blog FAQ blocks |
| `ComparisonFeatures` | Anyone | — | `/compare` |
| `ProductVideos` | Anyone | — | `/videos` |
| `Blog/Posts` | Anyone (Wix app) | Wix Studio authors | `/blog`, `/blog/[slug]`, RSS |
| `Blog/Categories`, `Blog/Tags` | Anyone (Wix app) | Wix Studio | future category filters |
| `ContactSubmissions` | — | webMethod (server-side only) | contact form |
| `ContactRateLimits` | — | webMethod | contact form spam guard |

---

## Phase 5 — Marketing + utility (blaidd owns these)

| Route | Page file (Velo) | Render | Source | Notes |
|---|---|---|---|---|
| `/spring-sale` | `Sale.js` (variant) | `ISR(1800)` | `@wix/data` → `Landings` (filter `slug="spring-sale"`) + `@wix/stores` sale collection | Hero + featured-products block. |
| `/newsletter` | `Newsletter.js` | `static` + client form | `newsletterService.subscribeToNewsletter` webMethod | Double opt-in already wired server-side. |
| `/press` | — (new Velo page TBD) | `static` | `@wix/data` → `PressMentions` + `PressKitAssets` | If `PressMentions` not seeded, Phase 5 creates seed script. |
| `/winback` | — (new) | `ISR(1800)` | `@wix/data` → `Landings` (filter `slug="winback"`); UTM passthrough to `analyticsHelpers.recordUtmTouch` | UTM params → fire `events.js` emit → automation engine picks up. |
| `/404` | `masterPage.js` error route | `static` | — | Brand shell + search widget. |
| `/search` | `Search Results.js` | `SSR` (reads `?q=`) | `@wix/stores` product search + `@wix/blog` `queryPosts().contains('title', q)` | Merge results client-side. |
| `/sitemap.xml` | — (generated) | route handler | Stores products + blog slugs + static routes list | Build at request time; cache 1h. |
| `/robots.txt` | — | `static` | constant | Allow all + sitemap pointer. |

### Phase 5 CMS collections required

| Collection | Read access | Write access | Used by |
|---|---|---|---|
| `Landings` | Anyone | Editors | `/spring-sale`, `/winback`, any future campaign URL |
| `PressMentions` | Anyone | Editors | `/press` |
| `PressKitAssets` | Anyone | Editors | `/press` downloads |
| `Subscribers` | — | webMethod | newsletter |
| `Unsubscribes` | — | webMethod | newsletter + blog digest |

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

## Open questions for Phase 1 / Melania

1. **Route casing** — keep `/getting-it-home` (current) or switch to `/delivery`? Current Velo URL is live; SEO says keep.
2. **Winback landing** — is the `Landings` collection already seeded with a `winback` row, or does Phase 5 own the seed?
3. **Press page** — if `PressMentions` is empty, do we soft-launch with a "coming soon" stub or block the route?
4. **Sitemap cache** — 1h ok, or do we need revalidate-on-publish? (Webhook from Wix → `revalidateTag('sitemap')`.)

---

## Source of truth

- Velo pages: `src/pages/*.js`
- webMethods: `src/backend/*.web.js`
- Route casing comes from Wix Studio page settings — before Phase 6 parity audit, grab the live-site URL list and diff.
