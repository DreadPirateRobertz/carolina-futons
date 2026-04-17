# CMS Collection Audit — Phase 4 & 5 Content Gap Analysis

**Owner:** blaidd
**For:** melania (reply to PR #1078 review)
**Date:** 2026-04-17
**Method:** grep of `wixData.(query|insert|update|remove|get)('...')` calls across `src/backend/`, `src/pages/`, `src/public/`.

---

## TL;DR

**Phase 4 (content pages) — all collections exist. No blockers.**

**Phase 5 (marketing + utility) — 4 collections missing. Blaidd owns seeding them.**

Missing:
1. `PressMentions` — needed for `/press` landing
2. `PressKitAssets` — press kit downloads
3. `Landings` — needed for `/spring-sale`, `/winback`, `/press` hero content
4. `ComparisonFeatures` — needed for `/compare` matrix (Phase 4, not Phase 5 — correction below)

---

## 1. Phase 4 — content pages

| Page | Collection(s) | Exists? | Schema source | Notes |
|---|---|---|---|---|
| `/about` | `AboutContent` | ✅ | `src/backend/contentImport.web.js:27-33` | Fields: `sectionKey` (Text, indexed), `title`, `content`, `sortOrder`. Correction: our doc called it `About` — real name is **`AboutContent`**. |
| `/faq` | `FAQ` | ✅ | `src/backend/contentImport.web.js:16-22` | Fields: `question`, `answer`, `category`, `sortOrder`. |
| `/contact` | `ContactSubmissions`, `ContactRateLimits` | ✅ | `src/backend/contactSubmissions.web.js` | Write-only from forms. |
| `/getting-it-home` | (none — pure util) | n/a | `src/public/gettingItHomeHelpers.js` | Zip→zone logic is in code, not CMS. |
| `/compare` | **`ComparisonFeatures`** | ❌ | — | **GAP.** I'll seed during Phase 4 implementation. |
| `/videos` | `ProductVideos` | ✅ | `src/backend/productVideos.web.js` | Fields include `slug`, `title`, `videoUrl`, `thumbnailUrl`, `tags`. Also separate legacy `Videos` collection — verify which one carolinafutons.com's videos page reads. |
| `/blog` | Wix Blog app (`Blog/Posts`, `Blog/Categories`, `Blog/Tags`) | ✅ | `src/backend/blogService.web.js` | Managed by Wix Blog app — don't touch schema. |
| `/blog/[slug]` | Wix Blog app | ✅ | same | same |

Ancillary used by `/contact` page layout:
- `Testimonials` — ✅ `src/backend/testimonialService.web.js`

---

## 2. Phase 5 — marketing + utility

| Page | Collection(s) | Exists? | Owner to seed |
|---|---|---|---|
| `/spring-sale` | **`Landings`** + `Stores/Products` | ❌ Landings / ✅ Products | blaidd |
| `/newsletter` | `NewsletterSubscribers`, `NewsletterRateLimit`, `Unsubscribes` | ✅ | — |
| `/press` | **`PressMentions`**, **`PressKitAssets`**, **`Landings`** | ❌ all | blaidd |
| `/winback` | **`Landings`** | ❌ | blaidd |
| `/404` | (static) | n/a | — |
| `/search` | `Stores/Products`, Wix Blog | ✅ | — |
| `/sitemap.xml` | `Stores/Products` + Wix Blog + route list | ✅ | — |

---

## 3. Missing collections — proposed schemas

### 3a. `Landings`

Purpose: hero content + CTA blocks for marketing landing routes. Editor-managed (melania).

```
slug (Text, indexed, unique)           // 'spring-sale' | 'winback' | 'press' | etc.
title (Text)                            // SEO title
headline (Text)                         // Hero H1
subheadline (Text)                      // Hero subhead
heroImageUrl (URL)                      // Wix media asset
ctaPrimaryLabel (Text)
ctaPrimaryHref (Text)
ctaSecondaryLabel (Text, optional)
ctaSecondaryHref (Text, optional)
bodyMdx (Text, 20000)                   // Long copy, rendered as markdown
utmDefaults (Object JSON)               // { campaign, content } applied to outbound links
activeFrom (Date, optional)             // Visibility window
activeUntil (Date, optional)
seoDescription (Text)
ogImageUrl (URL)
```

Permissions: Read = Anyone. Write = Admin.

### 3b. `PressMentions`

Purpose: "As seen in" list for `/press`. Populated by outreach as placements land.

```
outlet (Text, indexed)                  // 'Hendersonville Times-News'
outletLogoUrl (URL)                     // grayscale logo asset
articleTitle (Text)
articleUrl (URL)
publishedDate (Date, indexed)
excerpt (Text, 500)                     // pull quote
category (Text, indexed)                // 'local-press' | 'national' | 'podcast' | 'blog'
featured (Boolean)                      // pin to top
sortOrder (Number)
```

Permissions: Read = Anyone. Write = Admin.

**Seed data source:** currently zero confirmed placements. `content/press/media-research.json` is outreach research, not placements. Until outreach lands, `/press` should show a roadmap/coming-soon treatment (see Phase 5 implementation note below).

### 3c. `PressKitAssets`

Purpose: downloadable assets (logos, product images, bios) for journalists.

```
name (Text)                             // 'Primary logo — SVG'
description (Text)
fileUrl (URL)                           // Wix media
fileType (Text)                         // 'svg' | 'png' | 'pdf' | 'zip'
fileSizeBytes (Number)
category (Text, indexed)                // 'logo' | 'product-photo' | 'team-photo' | 'bio' | 'fact-sheet'
sortOrder (Number)
```

Permissions: Read = Anyone. Write = Admin.

### 3d. `ComparisonFeatures` (Phase 4 correction)

Purpose: feature-matrix rows for `/compare`. Each row is one spec dimension (e.g. "Frame material") with per-product cell values.

```
featureKey (Text, indexed, unique)      // 'frame-material'
label (Text)                            // 'Frame material'
description (Text)                      // hover/help text
category (Text, indexed)                // 'construction' | 'comfort' | 'price' | 'warranty'
sortOrder (Number)
values (Object JSON)                    // { '<productSlug>': '<cell value or icon key>' }
```

Alternative: normalize into two collections — `ComparisonRows` + `ComparisonCells` — but the denormalized-values map is simpler and `/compare` renders ≤20 rows × ≤5 products, so JSON blob is fine.

Permissions: Read = Anyone. Write = Admin.

---

## 4. Seeding plan

| Collection | Blocker? | Seed approach | When |
|---|---|---|---|
| `Landings` (`spring-sale` row) | blocks `/spring-sale` | Pull hero copy + image from current Wix Studio Sale page (radahn has it) → seed script | Phase 5 impl |
| `Landings` (`winback` row) | blocks `/winback` | Copy from `docs/strategy/klaviyo-migration-spike.md` winback section + UTM defaults | Phase 5 impl |
| `Landings` (`press` row) | blocks `/press` | Write fresh hero copy — "Carolina Futons in the News" + coming-soon treatment | Phase 5 impl |
| `PressMentions` | blocks populated `/press` | Empty on launch. Roadmap treatment (see below). | Ongoing — melania's outreach populates |
| `PressKitAssets` | nice-to-have | godfrey provides logo SVG + product shots. Seed 6-8 assets. | Phase 5 impl (coordinate w/ godfrey) |
| `ComparisonFeatures` | blocks `/compare` | Port from current Wix Studio Compare page (if live) or from existing product spec data in `Products` | Phase 4 impl |

---

## 5. `/press` launch treatment (since `PressMentions` is empty)

Proposed for Phase 5:

1. Hero from `Landings` row — "Carolina Futons in the News"
2. `PressMentions` list: if empty, render "Want to feature us? Get in touch." + link to media-contacts form
3. Press kit downloads from `PressKitAssets` — ships populated (logos, fact sheet)
4. When first placement lands (outreach from `content/press/media-research.json`), melania adds via Wix Studio CMS UI — page auto-hydrates, no code change.

---

## 6. Environment + OAuth confirmation (Q1 locked-in)

Per melania's decision:
- **Content reads** (Phase 4 all, Phase 5 all) → anonymous OAuth visitor token (`WIX_CLIENT_ID` only).
- **Sitemap / seed scripts** (build-time) → admin API key (`WIX_ADMIN_API_KEY`).
- **Form submits** (contact, newsletter) → anonymous token is enough; webMethods are `Permissions.Anyone` and handle their own rate-limiting.

---

## 7. Action items (tracked)

- [ ] **blaidd:** when Phase 1 ships, include seed script `scripts/seed-cf-3qt-collections.ts` that provisions the 4 missing collections and seeds `Landings` rows.
- [ ] **blaidd:** file a bead (or sub-task on cf-3qt.5) for `PressMentions` outreach loop — melania owns outreach, this just tracks when the first placement lands so we can flip `/press` from roadmap → populated.
- [ ] **millicent (per Q5):** Phase 0 infra PR — `/api/revalidate` route handler + Wix onPublish webhook (HMAC-signed). Collections that need tags: `products`, `blog`, `pages`, `landings`.
- [ ] **godfrey:** press-kit visual assets (logo SVG + product photos + fact-sheet PDF) for `PressKitAssets` seed.
- [ ] **melania:** confirm `Landings` schema before I code the seed script.

---

## 8. What I checked

```
grep -rhoE "wixData\.(query|insert|update|remove|get)\(['\"][A-Za-z0-9_/]+['\"]" src/backend src/pages src/public
```

Full collection list (130 collections currently in use across the codebase) available in the grep output. None of `PressMentions`, `PressKitAssets`, `Landings`, `ComparisonFeatures` appear.
