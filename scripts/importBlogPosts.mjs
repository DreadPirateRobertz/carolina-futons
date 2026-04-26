/**
 * importBlogPosts.mjs — Pushes 15 blog markdown files into Wix Blog CMS
 * via the Wix Blog Management REST API v3.
 *
 * Reads: content/blog/*.md  (markdown body)
 *        src/backend/blogContent.js (slug, title, excerpt, category, coverImage, publishDate)
 *
 * Requires env: WIX_API_KEY, WIX_SITE_ID
 * Usage:
 *   node scripts/importBlogPosts.mjs --status        check which slugs exist in Wix Blog
 *   node scripts/importBlogPosts.mjs --dry-run       print payloads without posting
 *   node scripts/importBlogPosts.mjs                 import all missing posts
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_API = 'https://www.wixapis.com/blog/v3/posts';

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Parse a blog markdown file into { title, metaDescription, body }.
 * Files use: `# Title` first line, `**Meta description:** ...` line, `---` separator.
 */
export function parseBlogMarkdown(text) {
  const lines = text.split('\n');
  let title = '';
  let metaDescription = '';
  let separatorIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!title && line.startsWith('# ')) {
      title = line.slice(2).trim();
    }
    if (!metaDescription && line.startsWith('**Meta description:**')) {
      metaDescription = line.replace(/^\*\*Meta description:\*\*\s*/, '').trim();
    }
    if (line.trim() === '---' && separatorIdx === -1) {
      separatorIdx = i;
    }
  }

  const body = separatorIdx >= 0
    ? lines.slice(separatorIdx + 1).join('\n').trim()
    : text.trim();

  return { title, metaDescription, body };
}

/**
 * Convert a markdown string into a minimal Ricos v1 document.
 * Handles: # headings, ## headings, ### headings, paragraph blocks.
 */
export function markdownToRicos(markdown) {
  const lines = markdown.split('\n');
  const nodes = [];

  let paraLines = [];

  function flushParagraph() {
    const text = paraLines.join(' ').trim();
    paraLines = [];
    if (!text) return;
    // Strip inline **bold** markers for clean text (Wix renders the text as-is)
    const clean = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
    nodes.push({
      type: 'PARAGRAPH',
      id: randomUUID(),
      nodes: [{
        type: 'TEXT',
        id: randomUUID(),
        nodes: [],
        textData: { text: clean, decorations: [] },
      }],
      paragraphData: { textStyle: { textAlignment: 'AUTO' } },
    });
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      nodes.push({
        type: 'HEADING',
        id: randomUUID(),
        nodes: [{
          type: 'TEXT',
          id: randomUUID(),
          nodes: [],
          textData: { text: headingMatch[2].trim(), decorations: [] },
        }],
        headingData: { level, textStyle: { textAlignment: 'AUTO' } },
      });
      continue;
    }

    if (line.trim() === '' || line.trim() === '---') {
      flushParagraph();
      continue;
    }

    // Skip metadata lines (Target keywords, Meta description)
    if (line.startsWith('**Target keywords:**') || line.startsWith('**Meta description:**')) {
      continue;
    }

    paraLines.push(line.trim());
  }
  flushParagraph();

  const now = new Date().toISOString();
  return {
    nodes,
    metadata: { version: 1, createdTimestamp: now, updatedTimestamp: now },
    documentStyle: {},
  };
}

/**
 * Build the Wix Blog v3 draft post payload.
 */
export function buildPostPayload(meta, richContent) {
  return {
    post: {
      title: meta.title,
      slug: meta.slug,
      excerpt: meta.excerpt,
      richContent,
      ...(meta.coverImage ? {
        media: {
          wixMedia: { image: { url: meta.coverImage } },
        },
      } : {}),
      seoData: {
        tags: [
          { type: 'og:description', content: meta.metaDescription },
          { type: 'description', content: meta.metaDescription },
        ],
        description: meta.metaDescription,
      },
      language: 'en',
    },
  };
}

// ── API helpers ───────────────────────────────────────────────────────────────

function buildHeaders() {
  const apiKey = process.env.WIX_API_KEY;
  const siteId = process.env.WIX_SITE_ID;
  if (!apiKey) throw new Error('WIX_API_KEY is not set');
  if (!siteId) throw new Error('WIX_SITE_ID is not set');
  return {
    Authorization: apiKey,
    'wix-site-id': siteId,
    'Content-Type': 'application/json',
  };
}

async function queryPostBySlug(slug, headers) {
  const res = await fetch(`${BLOG_API}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      filter: { slug: { $eq: slug } },
      paging: { limit: 1 },
      fieldsets: ['URL'],
    }),
  });
  if (!res.ok) throw new Error(`Blog query failed: HTTP ${res.status}`);
  const data = await res.json();
  return (data.posts ?? []);
}

/**
 * Import a single blog post: check slug, create draft, publish.
 * Returns { created, skipped, id }.
 */
export async function importPost(meta, markdownBody) {
  const headers = buildHeaders();

  const existing = await queryPostBySlug(meta.slug, headers);
  if (existing.length > 0) {
    return { created: false, skipped: true, id: existing[0].id, slug: meta.slug };
  }

  const richContent = markdownToRicos(markdownBody);
  const payload = buildPostPayload(meta, richContent);

  const createRes = await fetch(BLOG_API, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!createRes.ok) {
    const body = await createRes.text().catch(() => '');
    throw new Error(`Blog create failed for "${meta.slug}": HTTP ${createRes.status} — ${body}`);
  }
  const created = await createRes.json();
  const postId = created.post?.id;

  const pubRes = await fetch(`${BLOG_API}/${postId}/publish`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  if (!pubRes.ok) {
    const body = await pubRes.text().catch(() => '');
    throw new Error(`Blog publish failed for "${meta.slug}": HTTP ${pubRes.status} — ${body}`);
  }

  return { created: true, skipped: false, id: postId, slug: meta.slug };
}

// ── CLI entry point ───────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const statusOnly = args.includes('--status');

  const contentDir = join(__dirname, '..', 'content', 'blog');
  const mdFiles = readdirSync(contentDir).filter((f) => f.endsWith('.md'));

  // Load metadata from blogContent.js (slug → meta object)
  const { getAllBlogPosts } = await import('../src/backend/blogContent.js');
  const metaBySlug = Object.fromEntries(getAllBlogPosts().map((p) => [p.slug, p]));

  console.log(`Found ${mdFiles.length} markdown files.\n`);

  const results = { created: 0, skipped: 0, errors: [] };

  for (const file of mdFiles) {
    const slug = file.replace('.md', '');
    const meta = metaBySlug[slug];
    if (!meta) {
      console.warn(`  ⚠ No metadata for ${slug} — skipping`);
      continue;
    }

    const mdContent = readFileSync(join(contentDir, file), 'utf8');
    const { body, metaDescription } = parseBlogMarkdown(mdContent);
    const fullMeta = { ...meta, metaDescription: metaDescription || meta.metaDescription };

    if (dryRun) {
      const payload = buildPostPayload(fullMeta, markdownToRicos(body));
      console.log(`[dry-run] Would create: ${slug}`);
      console.log(JSON.stringify(payload, null, 2).slice(0, 300) + '…\n');
      continue;
    }

    if (statusOnly) {
      const headers = buildHeaders();
      const existing = await queryPostBySlug(slug, headers).catch(() => []);
      console.log(`  ${existing.length > 0 ? '✓' : '✗'} ${slug}`);
      continue;
    }

    process.stdout.write(`  Importing ${slug}… `);
    try {
      const result = await importPost(fullMeta, body);
      if (result.skipped) {
        console.log('skipped (already exists)');
        results.skipped++;
      } else {
        console.log(`created (id: ${result.id})`);
        results.created++;
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      results.errors.push({ slug, error: err.message });
    }
  }

  if (!dryRun && !statusOnly) {
    console.log(`\nDone. Created: ${results.created}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`);
    if (results.errors.length > 0) {
      console.error('Errors:', results.errors);
      process.exit(1);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
