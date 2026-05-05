# cfw-upa Sitemap Verification — 2026-05-05

**Bead:** cfw-upa (sitemap.ts listProducts 100-cap)
**Fix PR:** carolina-futons-web#465 (merged 07:59:00 UTC)
**Production deploy:** `352c385` → `carolina-futons-ilt23urve-dreadpiraterobertzs-projects.vercel.app` (Ready, ~08:01 UTC)

## Result: PASS — bug fixed

- `GET https://carolina-futons-web.vercel.app/sitemap.xml` → **HTTP 200**, 18,074 bytes
- **88 product URLs** present at `/products/{slug}` (matches expected SKU count); spot-check `GET /products/solstice-futon-frame` → 200
- Sitemap composition: 88 products, 9 blog posts, 8 categories, 8 `/near/{city}`, 21 static = **131 total**
- Build log diff (Vercel `inspect --logs`):
  - `[wix] listProducts failed … INVALID_ARGUMENT … 1000` — **gone** (was flooding pre-#465)
  - `[wix-data] listGuides failed … WDE0025: Guides collection does not exist` — **gone** (melania created Guides + CommunityPhotos collections via API)

## Residual to flag

- One remaining `WDE0025: The VideoGallery collection does not exist` line in the post-fix build log. Different collection from Guides/CommunityPhotos — Melania's collection-create pass didn't include it. Recommend filing a follow-up bead to either create the VideoGallery collection or guard the reader so the absence is silent.

## CODECOV_TOKEN status (per cf-s5cs owner-only TODO)

`gh secret list -R DreadPirateRobertz/carolina-futons-web` (audit time): SESSION_COOKIE_SECRET, WIX_BACKEND_KEY, WIX_CLIENT_ID_HEADLESS, WIX_VELO_SITE_URL, WIX_WEBHOOK_SECRET. **CODECOV_TOKEN not yet added.** PR #466 (`fix(cf-s5cs): codecov soft-fail until CODECOV_TOKEN is added`) makes the codecov upload step non-blocking until the secret is set, so main CI is not stuck.
