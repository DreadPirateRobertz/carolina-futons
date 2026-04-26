import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Tests for scripts/importBlogPosts.mjs
// Covers the pure helpers (parseBlogMarkdown, markdownToRicos, buildPostPayload)
// and the API wrapper logic (mocked fetch).

async function freshModule() {
  vi.resetModules();
  return import('../scripts/importBlogPosts.mjs');
}

// ── parseBlogMarkdown ────────────────────────────────────────────────────────

describe('parseBlogMarkdown', () => {
  it('extracts the title from the first # heading', async () => {
    const { parseBlogMarkdown } = await freshModule();
    const md = '# My Title\n\n**Meta description:** Short desc.\n\n---\n\nBody here.';
    const { title } = parseBlogMarkdown(md);
    expect(title).toBe('My Title');
  });

  it('extracts the meta description from **Meta description:** line', async () => {
    const { parseBlogMarkdown } = await freshModule();
    const md = '# T\n**Meta description:** This is the SEO blurb.\n---\nBody.';
    const { metaDescription } = parseBlogMarkdown(md);
    expect(metaDescription).toBe('This is the SEO blurb.');
  });

  it('returns body as text after the --- separator', async () => {
    const { parseBlogMarkdown } = await freshModule();
    const md = '# T\n**Meta description:** d.\n\n---\n\n## Section\n\nParagraph text.';
    const { body } = parseBlogMarkdown(md);
    expect(body).toContain('## Section');
    expect(body).toContain('Paragraph text.');
    expect(body).not.toContain('Meta description');
  });

  it('returns empty strings gracefully when fields are missing', async () => {
    const { parseBlogMarkdown } = await freshModule();
    const { title, metaDescription, body } = parseBlogMarkdown('No headings here.');
    expect(title).toBe('');
    expect(metaDescription).toBe('');
    expect(body).toBe('No headings here.');
  });
});

// ── markdownToRicos ───────────────────────────────────────────────────────────

describe('markdownToRicos', () => {
  it('returns a Ricos document with version 1 metadata', async () => {
    const { markdownToRicos } = await freshModule();
    const doc = markdownToRicos('Hello world.');
    expect(doc.metadata.version).toBe(1);
    expect(Array.isArray(doc.nodes)).toBe(true);
  });

  it('converts a plain paragraph into a PARAGRAPH node with TEXT child', async () => {
    const { markdownToRicos } = await freshModule();
    const doc = markdownToRicos('A simple paragraph.');
    const para = doc.nodes.find((n) => n.type === 'PARAGRAPH');
    expect(para).toBeDefined();
    const textNode = para.nodes[0];
    expect(textNode.type).toBe('TEXT');
    expect(textNode.textData.text).toContain('A simple paragraph.');
  });

  it('converts ## heading into a HEADING node at level 2', async () => {
    const { markdownToRicos } = await freshModule();
    const doc = markdownToRicos('## My Section');
    const heading = doc.nodes.find((n) => n.type === 'HEADING');
    expect(heading).toBeDefined();
    expect(heading.headingData.level).toBe(2);
    expect(heading.nodes[0].textData.text).toBe('My Section');
  });

  it('converts # heading into a HEADING node at level 1', async () => {
    const { markdownToRicos } = await freshModule();
    const doc = markdownToRicos('# Top Level');
    const heading = doc.nodes.find((n) => n.type === 'HEADING');
    expect(heading.headingData.level).toBe(1);
  });

  it('converts ### heading into a HEADING node at level 3', async () => {
    const { markdownToRicos } = await freshModule();
    const doc = markdownToRicos('### Sub Section');
    const heading = doc.nodes.find((n) => n.type === 'HEADING');
    expect(heading.headingData.level).toBe(3);
  });

  it('produces unique ids for each node', async () => {
    const { markdownToRicos } = await freshModule();
    const doc = markdownToRicos('## A\n\nPara one.\n\n## B\n\nPara two.');
    const ids = doc.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('skips blank lines without emitting empty nodes', async () => {
    const { markdownToRicos } = await freshModule();
    const doc = markdownToRicos('\n\n\nActual content.\n\n\n');
    const nonEmpty = doc.nodes.filter((n) => n.type !== undefined);
    expect(nonEmpty.length).toBe(1);
  });
});

// ── buildPostPayload ─────────────────────────────────────────────────────────

describe('buildPostPayload', () => {
  it('includes title, slug, excerpt, and richContent', async () => {
    const { buildPostPayload, markdownToRicos } = await freshModule();
    const meta = {
      slug: 'my-post',
      title: 'My Post',
      excerpt: 'Short blurb.',
      coverImage: 'https://cdn.example.com/img.jpg',
      publishDate: '2026-02-20',
      metaDescription: 'SEO desc',
    };
    const payload = buildPostPayload(meta, markdownToRicos('Body text.'));
    expect(payload.post.title).toBe('My Post');
    expect(payload.post.slug).toBe('my-post');
    expect(payload.post.excerpt).toBe('Short blurb.');
    expect(payload.post.richContent).toBeDefined();
  });

  it('sets a description seoData tag from metaDescription', async () => {
    const { buildPostPayload, markdownToRicos } = await freshModule();
    const meta = { slug: 's', title: 'T', excerpt: 'E', metaDescription: 'SEO text', coverImage: '', publishDate: '2026-01-01' };
    const payload = buildPostPayload(meta, markdownToRicos('Body.'));
    const descTag = payload.post.seoData?.tags?.find((t) => t.type === 'description');
    expect(descTag?.content).toBe('SEO text');
  });
});

// ── importBlogPosts API calls ────────────────────────────────────────────────

describe('importBlogPosts — API integration (mocked fetch)', () => {
  beforeEach(() => {
    process.env.WIX_API_KEY = 'test-key';
    process.env.WIX_SITE_ID = 'test-site-id';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    delete process.env.WIX_API_KEY;
    delete process.env.WIX_SITE_ID;
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  function mockQuery(posts = []) {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ posts, metaData: { total: posts.length } }), { status: 200 }),
    );
  }

  function mockCreate(id = 'new-post-id') {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ post: { id } }), { status: 200 }),
    );
  }

  function mockPublish() {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ post: { status: 'PUBLISHED' } }), { status: 200 }),
    );
  }

  it('queries Wix Blog to check for existing posts before creating', async () => {
    const { importPost } = await freshModule();
    mockQuery([]);     // no existing post
    mockCreate();      // create draft
    mockPublish();     // publish
    const meta = { slug: 'test-slug', title: 'T', excerpt: 'E', metaDescription: 'M', coverImage: '', publishDate: '2026-01-01' };
    await importPost(meta, '## Body');
    const [queryUrl] = vi.mocked(fetch).mock.calls[0];
    expect(String(queryUrl)).toContain('blog/v3/posts/query');
  });

  it('skips creation when a post with the same slug already exists', async () => {
    const { importPost } = await freshModule();
    mockQuery([{ id: 'existing-id', slug: 'test-slug' }]);
    const meta = { slug: 'test-slug', title: 'T', excerpt: 'E', metaDescription: 'M', coverImage: '', publishDate: '2026-01-01' };
    const result = await importPost(meta, '## Body');
    expect(result.skipped).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1); // only the query
  });

  it('creates a draft and publishes it for a new post', async () => {
    const { importPost } = await freshModule();
    mockQuery([]);
    mockCreate('brand-new-id');
    mockPublish();
    const meta = { slug: 'new-slug', title: 'T', excerpt: 'E', metaDescription: 'M', coverImage: '', publishDate: '2026-01-01' };
    const result = await importPost(meta, '## Body');
    expect(result.created).toBe(true);
    expect(result.id).toBe('brand-new-id');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
  });

  it('throws when WIX_API_KEY is missing', async () => {
    delete process.env.WIX_API_KEY;
    const { importPost } = await freshModule();
    const meta = { slug: 's', title: 'T', excerpt: 'E', metaDescription: 'M', coverImage: '', publishDate: '2026-01-01' };
    await expect(importPost(meta, 'Body')).rejects.toThrow(/WIX_API_KEY/);
  });
});
