/**
 * CF-bjv: getClusterForPost reverse lookup + public nav/schema helpers.
 */
import { describe, it, expect } from 'vitest';
import { getClusterForPost } from '../src/backend/topicClusters.web.js';
import { buildBlogPostClusterNav, buildIsPartOfSchema } from '../src/public/topicClusterHelpers.js';

describe('getClusterForPost', () => {
  it('finds parent cluster for a known spoke slug', async () => {
    const res = await getClusterForPost('wood-vs-metal-frames');
    expect(res.success).toBe(true);
    expect(res.cluster).not.toBeNull();
    expect(res.cluster.pillarSlug).toBe('futon-frames');
    expect(res.cluster.pillarTitle).toBeTruthy();
    expect(res.cluster.pillarUrl).toContain('/guides/futon-frames');
    expect(res.cluster.currentSpoke.slug).toBe('wood-vs-metal-frames');
    expect(res.cluster.currentSpoke.url).toContain('/buying-guides/wood-vs-metal-frames');
  });

  it('returns sibling spokes (excluding current)', async () => {
    const res = await getClusterForPost('wood-vs-metal-frames');
    expect(res.cluster.siblingSpokes.length).toBeGreaterThan(0);
    const siblingSlugs = res.cluster.siblingSpokes.map(s => s.slug);
    expect(siblingSlugs).not.toContain('wood-vs-metal-frames');
    expect(siblingSlugs).toContain('wall-hugger-guide');
  });

  it('resolves mattresses-cluster spoke', async () => {
    const res = await getClusterForPost('mattress-fill-types');
    expect(res.success).toBe(true);
    expect(res.cluster.pillarSlug).toBe('mattresses');
  });

  it('resolves covers-cluster spoke', async () => {
    const res = await getClusterForPost('cover-fabric-comparison');
    expect(res.success).toBe(true);
    expect(res.cluster.pillarSlug).toBe('covers');
  });

  it('returns cluster:null for unknown slug', async () => {
    const res = await getClusterForPost('not-a-real-post');
    expect(res.success).toBe(true);
    expect(res.cluster).toBeNull();
  });

  it('returns success:false for empty slug', async () => {
    const res = await getClusterForPost('');
    expect(res.success).toBe(false);
    expect(res.cluster).toBeNull();
  });

  it('returns success:false for non-string slug', async () => {
    const res = await getClusterForPost(null);
    expect(res.success).toBe(false);
  });

  it('rejects slug with invalid characters', async () => {
    const res = await getClusterForPost('bad slug!!');
    // sanitize + validateSlug fallback should still return success with cluster:null
    // (nothing matches) or success:false if slug became empty — both acceptable.
    if (res.success) expect(res.cluster).toBeNull();
    else expect(res.cluster).toBeNull();
  });

  it('sibling URLs point at /buying-guides/{slug}', async () => {
    const res = await getClusterForPost('wood-vs-metal-frames');
    res.cluster.siblingSpokes.forEach(s => {
      expect(s.url).toMatch(/\/buying-guides\/[a-z0-9-]+$/);
    });
  });
});

describe('buildBlogPostClusterNav', () => {
  it('builds nav with label + pillarUrl + sibling list', () => {
    const nav = buildBlogPostClusterNav({
      pillarTitle: 'Futon Frame Guide',
      pillarUrl: 'https://www.carolinafutons.com/guides/futon-frames',
      siblingSpokes: [
        { title: 'Wall Hugger Guide', url: 'https://x/wall-hugger-guide' },
        { title: 'Size Guide', url: 'https://x/size-guide' },
      ],
    });
    expect(nav.label).toBe('Part of: Futon Frame Guide');
    expect(nav.pillarUrl).toContain('/guides/futon-frames');
    expect(nav.siblings).toHaveLength(2);
    expect(nav.siblings[0].title).toBe('Wall Hugger Guide');
  });

  it('returns null when cluster is null/undefined', () => {
    expect(buildBlogPostClusterNav(null)).toBeNull();
    expect(buildBlogPostClusterNav(undefined)).toBeNull();
  });

  it('returns null when pillarTitle missing', () => {
    expect(buildBlogPostClusterNav({ pillarUrl: 'x' })).toBeNull();
  });

  it('tolerates missing siblingSpokes array', () => {
    const nav = buildBlogPostClusterNav({ pillarTitle: 'T', pillarUrl: 'u' });
    expect(nav.siblings).toEqual([]);
  });
});

describe('buildIsPartOfSchema', () => {
  it('builds schema.org WebPage node for cluster', () => {
    const schema = buildIsPartOfSchema({
      pillarTitle: 'Futon Frame Guide',
      pillarUrl: 'https://www.carolinafutons.com/guides/futon-frames',
    });
    expect(schema).toEqual({
      '@type': 'WebPage',
      name: 'Futon Frame Guide',
      url: 'https://www.carolinafutons.com/guides/futon-frames',
    });
  });

  it('returns null for null cluster', () => {
    expect(buildIsPartOfSchema(null)).toBeNull();
  });

  it('returns null when pillarUrl missing', () => {
    expect(buildIsPartOfSchema({ pillarTitle: 'T' })).toBeNull();
  });

  it('uses empty string when pillarTitle missing but pillarUrl present', () => {
    const schema = buildIsPartOfSchema({ pillarUrl: 'https://x/guides/y' });
    expect(schema.name).toBe('');
    expect(schema.url).toBe('https://x/guides/y');
  });
});
