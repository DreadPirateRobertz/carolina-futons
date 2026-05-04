# noindex Removal Checklist — cf-3qt.8.23

**Date:** 2026-05-04  
**Bead:** cf-3qt.8.23  
**Purpose:** Document every change needed to flip cfW from noindex → indexed at DNS cutover.

---

## The One Required Change

**File:** `src/app/layout.tsx`  
**Line:** 64  
**Change:**

```diff
-  // Pre-launch: keep noindex until canonical domain + redirects are wired up.
-  robots: { index: false, follow: false },
+  robots: { index: true, follow: true },
```

This is the global default that gates every page. Removing or flipping this is the entire pre-launch blocker for indexing.

**When to make it:** In the DNS cutover PR (or a PR merged immediately before DNS flips). Do NOT flip before DNS is pointed — doing so would tell Google to crawl `carolina-futons-web.vercel.app` rather than `carolinafutons.com`.

---

## Page-Level Overrides — Review Before Launch

These pages have their own `robots` exports. All are **intentional and should stay noindex**:

| File | Setting | Reason — keep? |
|------|---------|----------------|
| `src/app/theme-a/page.tsx` | `index:false, follow:false` | Internal design preview — **keep noindex** |
| `src/app/theme-b/page.tsx` | `index:false, follow:false` | Internal design preview — **keep noindex** |
| `src/app/theme-c/page.tsx` | `index:false, follow:false` | Internal design preview — **keep noindex** |
| `src/app/theme-d/page.tsx` | `index:false, follow:false` | Internal design preview — **keep noindex** |
| `src/app/winback/page.tsx` | `index:false, follow:true` | UTM re-engagement page — **keep noindex** |
| `src/app/search/page.tsx` | `index:false, follow:true` | Search results are not indexable — **keep noindex** |
| `src/app/order-confirmation/page.tsx` | `index:false, follow:false` | Private post-purchase page — **keep noindex** |
| `src/app/compare/page.tsx` | `index:false, follow:true` | Utility/tool page — **keep noindex** |
| `src/app/registry/page.tsx` | `index:false` | Private wishlist registry — **keep noindex** |
| `src/app/registry/[slug]/page.tsx` | `index:false` | Private registry share — **keep noindex** |
| `src/app/near/[city-slug]/page.tsx` | `index:false` on 404/fallback | Dynamic geo page; only noindexes on error path — **keep as-is** |
| `src/app/wishlist/[token]/page.tsx` | `index:false` | Private shared wishlist — **keep noindex** |

**No page-level override needs to change.** All are legitimately private or internal.

---

## robots.ts — No Change Needed

`src/app/robots.ts` already generates a correct `robots.txt`:

```
User-agent: *
Allow: /
Sitemap: https://carolinafutons.com/sitemap.xml
```

This file is already correct and does not need modification.

---

## Verification Steps (Run After Deploy)

```bash
# 1. No X-Robots-Tag: noindex on the home page
curl -sI https://carolinafutons.com | grep -i x-robots-tag
# Expected: no output (or "index, follow")

# 2. robots.txt is valid
curl -s https://carolinafutons.com/robots.txt
# Expected: User-agent: *, Allow: /, Sitemap: ...

# 3. sitemap is reachable
curl -sI https://carolinafutons.com/sitemap.xml | grep "^HTTP"
# Expected: HTTP/2 200

# 4. Spot-check a page-level override is still noindex
curl -sI https://carolinafutons.com/search | grep -i x-robots-tag
# Expected: x-robots-tag: noindex, follow
```

---

## Cutover Sequence

1. Merge DNS cutover PR (includes `robots: { index: true, follow: true }` change in layout.tsx)
2. Point `carolinafutons.com` DNS to Vercel
3. Wait for SSL provisioning (~5 min)
4. Run verification curl commands above
5. Submit sitemap in GSC (see `gsc-sitemap-runbook.md`)

---

*Checklist by miquella · cf-3qt.8.23 · 2026-05-04*
