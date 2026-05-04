# Redirect Map Verification — cf-3qt.8.16

**Date:** 2026-05-04  
**Preview URL:** `https://carolina-futons-web-git-cf-3qt86-dreadpiraterobertzs-projects.vercel.app`  
**PR:** #412 (branch: cf-3qt.8.6)  
**Method:** `curl -sI <preview-url><source>` — checked HTTP status + Location header  

---

## Results

| Source | Expected destination | HTTP status | Location header | Result |
|--------|---------------------|-------------|-----------------|--------|
| `/cart-page` | `/cart` | 308 | `/cart` | ✅ PASS |
| `/product/kingston-futon-frame` | `/products/kingston-futon-frame` | 308 | `/products/kingston-futon-frame` | ✅ PASS |
| `/store` | `/shop` | 308 | `/shop` | ✅ PASS |
| `/store/product/kingston-futon-frame` | `/products/kingston-futon-frame` | 308 | `/products/kingston-futon-frame` | ✅ PASS |
| `/store/category/futon-frames` | `/shop/futon-frames` | 308 | `/shop/futon-frames` | ✅ PASS |
| `/blank-1` | `/style-quiz` | 308 | `/style-quiz` | ✅ PASS |

**6/6 PASS**

## Notes

- All redirects return HTTP 308 (Permanent Redirect) — correct for SEO link-equity preservation.
- Location headers are relative paths (no host prefix) — standard Vercel Next.js behavior; browsers will resolve against the request host.
- No redirect chains observed (each source resolves in one hop).

## Verdict

✅ Redirect map is correct on Vercel preview. Safe to merge PR #412 and proceed to DNS cutover.
