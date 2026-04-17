# Wix Blog API — Headless Research (cf-3qt Phase 4)

**Owner:** blaidd
**Phase:** cf-3qt.4 (content) — blog index + `/blog/[slug]`
**Status:** prep (Phase 1 still blocked)
**Decision summary:** Use the `@wix/blog` SDK via `@wix/sdk` client. Fall back to `@wix/data` queries on `Blog/Posts` only if a specific field (e.g. `richContent` rendering quirk) forces it.

---

## 1. Current Velo implementation (what we're replacing)

`src/backend/blogService.web.js` uses `wix-blog-backend` (Velo-only, cannot run in Next.js):

- `posts.listPosts({ paging: { limit, offset } })` — index listing, with `metaData.total`
- Fallback static content in `backend/blogContent` (`getAllBlogPosts`, `getBlogPost(slug)`, `getBlogSlugs`, `getBlogFaqs`)
- Normalizer flattens: `{ _id, title, slug, excerpt, publishedDate, coverImageUrl, category, authorName }`

The Next.js build must reproduce that normalizer verbatim so downstream page props stay stable.

---

## 2. Headless equivalent — `@wix/blog`

The Wix Headless SDK exposes the same Blog API surface as Velo's `wix-blog-backend`, but instantiated through a Wix client.

### Install
```
npm i @wix/sdk @wix/blog
```

### Client construction (Next.js server-side)
```js
import { createClient } from '@wix/sdk';
import { posts } from '@wix/blog';
import { OAuthStrategy } from '@wix/sdk';

export const wixBlog = createClient({
  modules: { posts },
  auth: OAuthStrategy({ clientId: process.env.WIX_CLIENT_ID }),
});
```

Auth strategy TBD by Phase 1 (likely anonymous OAuth visitor token — blog read is public). `WIX_CLIENT_ID` lives in Vercel env (already in scope for cf-3qt.1).

### Methods we need

| Our use case | SDK call | Notes |
|---|---|---|
| Blog index (paginated) | `posts.listPosts({ paging: { limit, offset } })` | Mirrors current Velo call. Returns `{ posts, metaData: { total } }`. |
| `/blog/[slug]` resolve | `posts.getPostBySlug(slug)` | Preferred over `getPost(id)` — avoids slug→id lookup. Returns 404-shaped error if missing. |
| `generateStaticParams` (ISR) | `posts.queryPosts().find()` | Pull all slugs at build; re-revalidate on demand. |
| Category filter (future) | `posts.queryPosts().eq('categoryIds', id)` | Not Phase 4 critical. |

### Field availability (SDK)

Confirmed available on the returned post (matches `Blog/Posts` collection):
`_id, title, slug, excerpt, publishedDate, firstPublishedDate, media.wixMedia.image.url, categories[], mainCategory, plainContent, richContent, hashtags, author.authorName, viewCount, likeCount, seoData, memberId`.

`richContent` is **Ricos JSON** (not HTML). Rendering options:
- **Preferred:** `@wix/ricos-viewer` (React component, SSR-safe).
- **Fallback:** `plainContent` wrapped in `<p>` if Ricos adds too much bundle weight — loses images/embeds, so only acceptable for excerpt cards.

---

## 3. Fallback: `@wix/data` on `Blog/Posts`

If the SDK path is blocked (auth, quota, rendering), Wix exposes the raw collection via the CMS REST:

```
POST https://www.wixapis.com/wix-data/v2/items/query
Body: { "dataCollectionId": "Blog/Posts", "query": {...} }
```

Same fields are readable. Trade-offs:
- Pros: one dependency (`@wix/data`) covers blog + FAQ + About + Videos (see URL→CMS map).
- Cons: must re-implement paging/sorting by hand; `richContent` still Ricos JSON.

**Recommendation:** default to `@wix/blog`; reserve `@wix/data` for the non-blog collections that don't have a dedicated SDK.

---

## 4. Normalization contract (ports the Velo normalizer)

Downstream pages expect this shape. Expose it from `lib/wix/blog.ts`:

```ts
export interface BlogPostCard {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  publishedDate: string;      // ISO
  coverImageUrl: string;      // '' if none
  category: string;           // '' if none (first label)
  authorName: string;         // 'Carolina Futons Team' fallback
}
```

Full post adds: `richContent: RicosDocument | null`, `plainContent: string`, `seoData`.

---

## 5. Decisions (locked by melania 2026-04-17)

1. **Auth** — anonymous OAuth visitor token (`WIX_CLIENT_ID`) for content reads. Admin API key reserved for build-time sitemap/seed only.
2. **ISR cadence** — `/blog` index = `revalidate: 300`, `/blog/[slug]` = `revalidate: 600`. Plus on-demand revalidation via webhook — see item 5.
3. **Ricos viewer** — adopt `@wix/ricos-viewer`. Bundle-size check still required in Phase 1 (budget: ≤50KB gzip added to `/blog/[slug]` route).
4. **Image domains** — `next.config.js` `images.remotePatterns` must include `static.wixstatic.com`.
5. **Revalidate webhook** — millicent owns the Phase 0 `/api/revalidate` route handler. Wix `onPublish` hook POSTs HMAC-signed payload → `revalidateTag('blog')`. Blog data fetches must use `fetch(..., { next: { tags: ['blog'] } })` so tag invalidation propagates.

---

## 6. References

- SDK: https://dev.wix.com/docs/api-reference/business-solutions/blog/posts-stats/list-posts
- `getPostBySlug`: https://dev.wix.com/docs/api-reference/business-solutions/blog/posts-stats/get-post-by-slug
- Collection fields (fallback path): https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/wix-app-collections/wix-blog-collections
- Current Velo wrapper: `src/backend/blogService.web.js`
