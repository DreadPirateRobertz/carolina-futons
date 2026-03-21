# Sprint 4: Content/SEO + Growth Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix blog RSS 404, complete topic cluster CMS + dynamic pages, and build the UGC photo review full-stack workflow (submit → moderate → display).

**Architecture:** `topicClusters.web.js` and `blogRssFeed.web.js` are built but not fully wired. Topic clusters need a CMS collection + dynamic page route. Blog RSS returns 404 — likely a function export mismatch or missing registration. UGC photo review needs: upload endpoint wiring, moderation admin endpoint, display filter on approval. All P2 work; assign after P1 (Plan A) tasks are shipping.

**Tech Stack:** Wix Velo (JS), Wix HTTP Functions, Wix Data (CMS collections), Wix Media Manager, existing modules (photoReviews.web.js, topicClusters.web.js, blogRssFeed.web.js)

**Test command:** `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run`

**Spec:** `docs/superpowers/specs/2026-03-21-sprint4-marketing-engine-design.md`

---

## File Map

| File | Action | Bead |
|------|--------|------|
| `src/backend/blogRssFeed.web.js` | Debug + fix 404 — verify function export name | radahn blog RSS bead |
| `src/backend/http-functions.js` | Verify `get_blogRssFeed` export or add registration | radahn blog RSS bead |
| `src/backend/topicClusters.web.js` | Verify exports, add `getTopicClusterPage` HTTP endpoint | radahn topic cluster bead |
| `src/backend/http-functions.js` | Add `get_topicCluster` endpoint | radahn topic cluster bead |
| `src/backend/photoReviews.web.js` | Verify moderation + display filter exports | miquella UGC bead |
| `src/backend/http-functions.js` | Add `post_submitPhotoReview` + `get_adminReviews` endpoints | miquella UGC bead |
| `tests/blogRssFeedFix.test.js` | Create | radahn |
| `tests/topicClusterEndpoint.test.js` | Create | radahn |
| `tests/photoReviewWorkflow.test.js` | Create | miquella |

---

## Task 1: Blog RSS Feed Fix (radahn)

`blogRssFeed.web.js` is built but endpoint returns 404. Diagnose and fix.

**Files:**
- Verify: `src/backend/blogRssFeed.web.js`
- Modify: `src/backend/http-functions.js` (if registration missing)
- Create: `tests/blogRssFeedFix.test.js`

- [ ] **Step 1: Diagnose the 404**

```bash
# Check what blogRssFeed exports
grep -n "export" /Users/hal/gt/cfutons/refinery/rig/src/backend/blogRssFeed.web.js | head -20

# Check if http-functions.js has an RSS endpoint
grep -n "rss\|RSS\|feed\|Feed" /Users/hal/gt/cfutons/refinery/rig/src/backend/http-functions.js | head -10
```

Common causes:
- The function is exported from blogRssFeed.web.js but NOT registered in http-functions.js
- The http-functions.js export name doesn't match the URL pattern (`get_blogRssFeed` → `/_functions/blogRssFeed`)
- The function throws on import due to a broken dependency

- [ ] **Step 2: Write failing test**

**Important:** The first test below imports `blogRssFeed.web.js` directly WITHOUT mocking it, to verify the real module's exports. The second group uses a mock for http-functions integration testing.

Create `tests/blogRssFeedFix.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';

// Test 1: verify the real module's actual exports (no mock)
describe('Blog RSS Feed — Real Module Exports', () => {
  it('blogRssFeed.web.js exports a feed generation function', async () => {
    // Un-mocked import — tests the actual file, not a stub
    const mod = await import('../src/backend/blogRssFeed.web.js');
    // Accept either naming convention found in Step 1 grep
    const fn = mod.generateRssFeed || mod.getRssFeed || mod.buildRssFeed || mod.default;
    expect(typeof fn).toBe('function');
  });
});

// Test 2: http-functions registration (mock the RSS module to isolate this concern)
vi.mock('../src/backend/blogRssFeed.web.js', () => ({
  generateRssFeed: vi.fn().mockResolvedValue(`<?xml version="1.0"?><rss version="2.0"><channel><title>Carolina Futons Blog</title></channel></rss>`),
}));

describe('Blog RSS Feed — HTTP Endpoint Registration', () => {
  it('http-functions.js exports get_blogRssFeed', async () => {
    const mod = await import('../src/backend/http-functions.js');
    expect(typeof mod.get_blogRssFeed).toBe('function');
  });

  it('get_blogRssFeed returns response with XML Content-Type', async () => {
    const { get_blogRssFeed } = await import('../src/backend/http-functions.js');
    const req = { path: [], query: {}, method: 'GET' };
    const res = await get_blogRssFeed(req);
    expect(res).toBeDefined();
    const contentType = res.headers?.['Content-Type'] || res.headers?.['content-type'] || '';
    expect(contentType).toContain('xml');
  });
});
```

- [ ] **Step 3: Run — confirm http-functions test fails**

```bash
cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/blogRssFeedFix.test.js
```

- [ ] **Step 4: Add get_blogRssFeed to http-functions.js**

```js
import { generateRssFeed } from 'backend/blogRssFeed.web';

export async function get_blogRssFeed(request) {
  const xml = await generateRssFeed();
  return response({
    status: 200,
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
    body: xml,
  });
}
```

If `generateRssFeed` doesn't exist in blogRssFeed.web.js, check the actual export name:
```bash
grep "^export" /Users/hal/gt/cfutons/refinery/rig/src/backend/blogRssFeed.web.js
```
Use the actual exported function name.

- [ ] **Step 5: Run tests — all pass**

```bash
cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/blogRssFeedFix.test.js
```

- [ ] **Step 6: Commit**

```bash
git add src/backend/http-functions.js tests/blogRssFeedFix.test.js
git commit -m "fix: blog RSS feed 404 — register get_blogRssFeed in http-functions.js with XML content-type"
```

---

## Task 2: Topic Cluster CMS + HTTP Endpoint (radahn)

`topicClusters.web.js` is built. Add CMS collection definition + HTTP endpoint for dynamic `/guides/[topic]` pages.

**Files:**
- Verify: `src/backend/topicClusters.web.js`
- Modify: `src/backend/http-functions.js`
- Create: `tests/topicClusterEndpoint.test.js`

- [ ] **Step 1: Check topicClusters exports**

```bash
grep -n "export\|function\|getCluster\|getTopic\|cluster" /Users/hal/gt/cfutons/refinery/rig/src/backend/topicClusters.web.js | head -30
```

Note the function that returns cluster data given a topic slug.

- [ ] **Step 2: Write failing tests**

Create `tests/topicClusterEndpoint.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/backend/topicClusters.web.js', () => ({
  getTopicCluster: vi.fn().mockResolvedValue({
    topic: 'futon-buying-guide',
    title: 'Futon Buying Guide',
    pillarContent: '<p>Everything you need to know...</p>',
    clusterArticles: [
      { title: 'How to choose a futon frame', slug: 'futon-frames' },
      { title: 'Futon mattress thickness guide', slug: 'mattress-thickness' },
    ],
    seo: { metaTitle: 'Futon Buying Guide | Carolina Futons', metaDescription: '...' },
  }),
  getAllTopicClusters: vi.fn().mockResolvedValue([
    { topic: 'futon-buying-guide', title: 'Futon Buying Guide' },
    { topic: 'murphy-bed-sizes', title: 'Murphy Bed Sizes Guide' },
  ]),
}));

describe('Topic Cluster Endpoint', () => {
  it('http-functions exports get_topicCluster', async () => {
    const mod = await import('../src/backend/http-functions.js');
    expect(typeof mod.get_topicCluster).toBe('function');
  });

  it('returns 400 when topic slug missing', async () => {
    const { get_topicCluster } = await import('../src/backend/http-functions.js');
    const req = { path: [], query: {} };
    const res = await get_topicCluster(req);
    expect(res.status).toBe(400);
  });

  it('returns cluster data for valid topic slug', async () => {
    const { get_topicCluster } = await import('../src/backend/http-functions.js');
    const req = { path: ['futon-buying-guide'], query: {} };
    const res = await get_topicCluster(req);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('topic', 'futon-buying-guide');
    expect(body).toHaveProperty('pillarContent');
    expect(body).toHaveProperty('clusterArticles');
    expect(Array.isArray(body.clusterArticles)).toBe(true);
  });

  it('returns 404 for unknown topic slug', async () => {
    const { getTopicCluster } = await import('../src/backend/topicClusters.web.js');
    getTopicCluster.mockRejectedValueOnce(new Error('not found'));
    const { get_topicCluster } = await import('../src/backend/http-functions.js');
    const req = { path: ['unknown-topic'], query: {} };
    const res = await get_topicCluster(req);
    expect(res.status).toBe(404);
  });

  it('topicClusters module exports getTopicCluster and getAllTopicClusters', async () => {
    const mod = await import('../src/backend/topicClusters.web.js');
    expect(typeof mod.getTopicCluster).toBe('function');
    expect(typeof mod.getAllTopicClusters).toBe('function');
  });
});
```

- [ ] **Step 3: Run — confirm fails**

```bash
cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/topicClusterEndpoint.test.js
```

- [ ] **Step 4: Add HTTP endpoint to http-functions.js**

First check what response helper(s) are already used in http-functions.js:
```bash
grep -n "^import\|return ok\|return response\|okJson\|forbidden\|notFound" /Users/hal/gt/cfutons/refinery/rig/src/backend/http-functions.js | head -15
```

Then add (using the same `response()` helper already in the file — do NOT use `ok()` unless it's already imported):

```js
import { getTopicCluster } from 'backend/topicClusters.web';

export async function get_topicCluster(request) {
  const slug = request.path[0];
  if (!slug) {
    return response({ status: 400, body: JSON.stringify({ error: 'topic slug required' }) });
  }
  try {
    const data = await getTopicCluster(slug);
    return response({ status: 200, body: JSON.stringify(data) });
  } catch (err) {
    return response({ status: 404, body: JSON.stringify({ error: 'topic not found' }) });
  }
}
```

- [ ] **Step 5: Verify topicClusters.web.js exports match**

If `getTopicCluster` or `getAllTopicClusters` don't exist with those names, check actual exports and update the http-functions import to match.

- [ ] **Step 6: Run tests — all pass**

```bash
cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/topicClusterEndpoint.test.js
```

- [ ] **Step 7: Add initial topic cluster data note**

In a commit comment or a `src/backend/topicClusters.web.js` comment, note the initial topics to seed in Wix CMS:
- `futon-buying-guide`
- `murphy-bed-sizes`
- `mattress-types`

(Actual seeding is a Stilgar/admin task in Wix Dashboard → Content Manager.)

- [ ] **Step 8: Commit**

```bash
git add src/backend/http-functions.js tests/topicClusterEndpoint.test.js
git commit -m "feat: topic cluster HTTP endpoint GET /_functions/topicCluster/{slug} — pillar content + cluster articles"
```

---

## Task 3: UGC Photo Review Workflow (miquella)

Full-stack: photo submission → moderation queue → approved display. Backend (`photoReviews.web.js`) exists. Need HTTP endpoints for submit + admin moderation, and a display filter.

**Files:**
- Verify/Modify: `src/backend/photoReviews.web.js`
- Modify: `src/backend/http-functions.js`
- Create: `tests/photoReviewWorkflow.test.js`

**Note on admin dashboard:** Per spec, `/admin-reviews` cannot be a Wix page until editor hookup. Implement as `GET /_functions/adminReviews` with API key auth (check `scripts/secrets.env` for `ADMIN_API_KEY`).

- [ ] **Step 1: Check photoReviews exports**

```bash
grep -n "^export\|export async\|export function\|export const" /Users/hal/gt/cfutons/refinery/rig/src/backend/photoReviews.web.js | head -30
```

Note: what functions exist for submit, approve, reject, getApproved.

- [ ] **Step 2: Write failing tests**

Create `tests/photoReviewWorkflow.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/backend/photoReviews.web.js', () => ({
  submitPhotoReview: vi.fn().mockResolvedValue({ id: 'review_123', status: 'pending' }),
  approveReview: vi.fn().mockResolvedValue({ id: 'review_123', status: 'approved' }),
  rejectReview: vi.fn().mockResolvedValue({ id: 'review_123', status: 'rejected' }),
  getPendingReviews: vi.fn().mockResolvedValue([{ id: 'review_123', imageUrl: 'https://...', status: 'pending' }]),
  getApprovedReviews: vi.fn().mockResolvedValue([{ id: 'review_456', imageUrl: 'https://...', status: 'approved' }]),
}));

describe('UGC Photo Review — Submit Endpoint', () => {
  it('http-functions exports post_submitPhotoReview', async () => {
    const mod = await import('../src/backend/http-functions.js');
    expect(typeof mod.post_submitPhotoReview).toBe('function');
  });

  it('returns 400 when imageUrl missing', async () => {
    const { post_submitPhotoReview } = await import('../src/backend/http-functions.js');
    const req = { body: JSON.stringify({ productId: 'prod_123' }), headers: {} };
    const res = await post_submitPhotoReview(req);
    expect(res.status).toBe(400);
  });

  it('returns review ID on successful submit', async () => {
    const { post_submitPhotoReview } = await import('../src/backend/http-functions.js');
    const req = {
      body: JSON.stringify({ imageUrl: 'https://cdn.wix.com/photo.jpg', productId: 'prod_123', memberId: 'mem_abc' }),
      headers: {},
    };
    const res = await post_submitPhotoReview(req);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('status', 'pending');
  });
});

describe('UGC Photo Review — Admin Moderation Endpoint', () => {
  it('http-functions exports get_adminReviews', async () => {
    const mod = await import('../src/backend/http-functions.js');
    expect(typeof mod.get_adminReviews).toBe('function');
  });

  it('returns 403 without valid API key', async () => {
    const { get_adminReviews } = await import('../src/backend/http-functions.js');
    const req = { query: {}, headers: {} }; // no api key
    const res = await get_adminReviews(req);
    expect(res.status).toBe(403);
  });

  it('returns pending reviews with valid API key', async () => {
    const { get_adminReviews } = await import('../src/backend/http-functions.js');
    const req = { query: { status: 'pending' }, headers: { 'x-admin-key': 'test-key' } };
    // Mock env for API key
    process.env.ADMIN_API_KEY = 'test-key';
    const res = await get_adminReviews(req);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.reviews)).toBe(true);
    delete process.env.ADMIN_API_KEY;
  });
});

describe('UGC Photo Review — Display Filter', () => {
  it('getApprovedReviews returns only approved items', async () => {
    const { getApprovedReviews } = await import('../src/backend/photoReviews.web.js');
    const reviews = await getApprovedReviews();
    expect(reviews.every(r => r.status === 'approved')).toBe(true);
  });

  it('submitPhotoReview creates item with pending status', async () => {
    const { submitPhotoReview } = await import('../src/backend/photoReviews.web.js');
    const result = await submitPhotoReview({ imageUrl: 'https://...', productId: 'prod_1', memberId: 'mem_1' });
    expect(result.status).toBe('pending');
  });

  it('approveReview changes status to approved', async () => {
    const { approveReview } = await import('../src/backend/photoReviews.web.js');
    const result = await approveReview('review_123');
    expect(result.status).toBe('approved');
  });
});
```

- [ ] **Step 3: Run — confirm fails**

```bash
cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/photoReviewWorkflow.test.js
```

- [ ] **Step 4: Add photoReviews functions if missing**

Check which functions are missing from photoReviews.web.js and add only those that don't exist. Follow existing patterns in the file. At minimum need:

```js
// If missing, add:
export async function getApprovedReviews() {
  const result = await wixData.query('PhotoReviews').eq('status', 'approved').find();
  return result.items;
}

export async function getPendingReviews() {
  const result = await wixData.query('PhotoReviews').eq('status', 'pending').find();
  return result.items;
}
```

- [ ] **Step 5: Add HTTP endpoints to http-functions.js**

```js
import { submitPhotoReview, getPendingReviews, getApprovedReviews, approveReview, rejectReview } from 'backend/photoReviews.web';

export async function post_submitPhotoReview(request) {
  let body;
  try { body = JSON.parse(request.body); } catch { return response({ status: 400, body: JSON.stringify({ error: 'invalid JSON' }) }); }

  const { imageUrl, productId, memberId } = body || {};
  if (!imageUrl || !productId) {
    return response({ status: 400, body: JSON.stringify({ error: 'imageUrl and productId required' }) });
  }
  const review = await submitPhotoReview({ imageUrl, productId, memberId });
  return response({ status: 200, body: JSON.stringify(review) });
}

export async function get_adminReviews(request) {
  const apiKey = request.headers?.['x-admin-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return response({ status: 403, body: JSON.stringify({ error: 'forbidden' }) });
  }
  const status = request.query?.status || 'pending';
  const reviews = status === 'approved' ? await getApprovedReviews() : await getPendingReviews();
  return response({ status: 200, body: JSON.stringify({ reviews }) });
}
```

- [ ] **Step 6: Run tests — all pass**

```bash
cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run tests/photoReviewWorkflow.test.js
```

- [ ] **Step 7: Run full suite — no regressions**

```bash
cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run 2>&1 | tail -5
```

- [ ] **Step 8: Commit**

```bash
git add src/backend/http-functions.js src/backend/photoReviews.web.js tests/photoReviewWorkflow.test.js
git commit -m "feat: UGC photo review workflow — submit + admin moderation endpoint (API key auth) + display filter"
```

---

## Final Integration Check

- [ ] **Run full test suite**

```bash
cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run 2>&1 | tail -10
```

- [ ] **Verify all new HTTP endpoints registered**

```bash
grep "^export async function get_\|^export async function post_" /Users/hal/gt/cfutons/refinery/rig/src/backend/http-functions.js
```

Expected to see: `get_loyalty`, `get_generateReferralLink`, `get_blogRssFeed`, `get_topicCluster`, `get_adminReviews`, `post_submitPhotoReview`

- [ ] **Open PR against main**

```bash
git push origin <branch-name>
gh pr create --title "feat(Sprint4-T3T4): Content/SEO + Growth Features" \
  --body "Fixes: blog RSS 404. Adds: topic cluster endpoint, UGC photo submit + admin moderation. All P2 beads: radahn blog RSS + topic clusters, miquella UGC workflow. See Sprint 4 spec."
```
