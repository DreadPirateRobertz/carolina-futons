import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import {
  getProductVideos,
  getCategoryVideos,
  getBrandVideos,
  getAssemblyVideo,
  saveVideo,
  getAllVideos,
} from 'backend/productVideos.web';

// ── Test Data ────────────────────────────────────────────────────────

const KD_NOMAD_VIDEO = {
  _id: 'vid-001',
  videoId: 'v-kd-001',
  title: 'Nomad Platform Bed Assembly',
  brand: 'KD Frames',
  type: 'assembly',
  category: 'platform-beds',
  youtubeUrl: 'https://www.youtube.com/watch?v=EC1GCQ5CiSo',
  mp4Url: null,
  thumbnailUrl: null,
  productSlugs: '["nomad-platform-bed","nomad-plus-platform-bed"]',
  duration: 480,
  sortOrder: 0,
};

const KD_CHARLESTON_VIDEO = {
  _id: 'vid-002',
  videoId: 'v-kd-002',
  title: 'Charleston Platform Bed Assembly',
  brand: 'KD Frames',
  type: 'assembly',
  category: 'platform-beds',
  youtubeUrl: 'https://www.youtube.com/watch?v=ouc5kWkEMfE',
  mp4Url: null,
  thumbnailUrl: null,
  productSlugs: '["charleston-platform-bed","charleston-plus-platform-bed"]',
  duration: 540,
  sortOrder: 1,
};

const STRATA_DILLON_VIDEO = {
  _id: 'vid-003',
  videoId: 'v-strata-001',
  title: 'Dillon Wall Hugger Futon Conversion Animation',
  brand: 'Strata Furniture',
  type: 'animation',
  category: 'wall-huggers',
  youtubeUrl: null,
  mp4Url: 'https://store.stratafurniture.com/wp-content/uploads/2022/01/Dillon_animation.mp4',
  thumbnailUrl: null,
  productSlugs: '["dillon-futon-frame"]',
  duration: 30,
  sortOrder: 0,
};

const ND_MURPHY_VIDEO = {
  _id: 'vid-004',
  videoId: 'v-nd-001',
  title: 'Murphy Cabinet Bed Conversion Instruction',
  brand: 'Night & Day Furniture',
  type: 'demo',
  category: 'murphy-cabinet-beds',
  youtubeUrl: 'https://www.youtube.com/watch?v=XYZ123abcde',
  mp4Url: null,
  thumbnailUrl: null,
  productSlugs: '["murphy-cabinet-bed"]',
  duration: 300,
  sortOrder: 0,
};

const KD_OVERVIEW_VIDEO = {
  _id: 'vid-005',
  videoId: 'v-kd-overview',
  title: 'KD Frames Product Overview',
  brand: 'KD Frames',
  type: 'overview',
  category: 'platform-beds',
  youtubeUrl: 'https://www.youtube.com/watch?v=OVERVIEW11',
  mp4Url: null,
  thumbnailUrl: null,
  productSlugs: '["nomad-platform-bed","charleston-platform-bed","fold-platform-bed"]',
  duration: 600,
  sortOrder: 2,
};

const ALL_VIDEOS = [KD_NOMAD_VIDEO, KD_CHARLESTON_VIDEO, STRATA_DILLON_VIDEO, ND_MURPHY_VIDEO, KD_OVERVIEW_VIDEO];

// ── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  resetData();
});

// ── getProductVideos ─────────────────────────────────────────────────

describe('getProductVideos', () => {
  it('returns videos matching a product slug', async () => {
    __seed('ProductVideos', ALL_VIDEOS);

    const result = await getProductVideos('nomad-platform-bed');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2); // assembly + overview
    expect(result.data[0].title).toBe('Nomad Platform Bed Assembly');
    expect(result.data[1].title).toBe('KD Frames Product Overview');
  });

  it('returns formatted video with embed URL', async () => {
    __seed('ProductVideos', [KD_NOMAD_VIDEO]);

    const result = await getProductVideos('nomad-platform-bed');
    expect(result.data[0].youtubeId).toBe('EC1GCQ5CiSo');
    expect(result.data[0].embedUrl).toBe('https://www.youtube.com/embed/EC1GCQ5CiSo');
    expect(result.data[0].thumbnailUrl).toBe('https://img.youtube.com/vi/EC1GCQ5CiSo/hqdefault.jpg');
  });

  it('returns MP4 video without YouTube fields', async () => {
    __seed('ProductVideos', [STRATA_DILLON_VIDEO]);

    const result = await getProductVideos('dillon-futon-frame');
    expect(result.data[0].youtubeUrl).toBeNull();
    expect(result.data[0].youtubeId).toBeNull();
    expect(result.data[0].embedUrl).toBeNull();
    expect(result.data[0].mp4Url).toContain('Dillon_animation.mp4');
  });

  it('returns empty array for product with no videos', async () => {
    __seed('ProductVideos', ALL_VIDEOS);

    const result = await getProductVideos('some-random-product');
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('returns error for empty slug', async () => {
    const result = await getProductVideos('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid product slug');
  });

  it('returns error for null slug', async () => {
    const result = await getProductVideos(null);
    expect(result.success).toBe(false);
  });

  it('includes productSlugs as parsed array', async () => {
    __seed('ProductVideos', [KD_NOMAD_VIDEO]);

    const result = await getProductVideos('nomad-platform-bed');
    expect(result.data[0].productSlugs).toEqual(['nomad-platform-bed', 'nomad-plus-platform-bed']);
  });

  it('includes duration', async () => {
    __seed('ProductVideos', [KD_NOMAD_VIDEO]);

    const result = await getProductVideos('nomad-platform-bed');
    expect(result.data[0].duration).toBe(480);
  });
});

// ── getCategoryVideos ────────────────────────────────────────────────

describe('getCategoryVideos', () => {
  it('returns all videos for a category', async () => {
    __seed('ProductVideos', ALL_VIDEOS);

    const result = await getCategoryVideos('platform-beds');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(3); // nomad + charleston + overview
  });

  it('returns wall-hugger videos', async () => {
    __seed('ProductVideos', ALL_VIDEOS);

    const result = await getCategoryVideos('wall-huggers');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].brand).toBe('Strata Furniture');
  });

  it('returns empty array for category with no videos', async () => {
    __seed('ProductVideos', ALL_VIDEOS);

    const result = await getCategoryVideos('mattresses');
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('rejects invalid category', async () => {
    const result = await getCategoryVideos('fake-category');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown category');
  });

  it('rejects null category', async () => {
    const result = await getCategoryVideos(null);
    expect(result.success).toBe(false);
  });
});

// ── getBrandVideos ───────────────────────────────────────────────────

describe('getBrandVideos', () => {
  it('returns all videos for KD Frames', async () => {
    __seed('ProductVideos', ALL_VIDEOS);

    const result = await getBrandVideos('KD Frames');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(3); // nomad + charleston + overview
    expect(result.data.every(v => v.brand === 'KD Frames')).toBe(true);
  });

  it('returns videos for Night & Day Furniture', async () => {
    __seed('ProductVideos', ALL_VIDEOS);

    const result = await getBrandVideos('Night & Day Furniture');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('returns empty for unknown brand', async () => {
    __seed('ProductVideos', ALL_VIDEOS);

    const result = await getBrandVideos('Unknown Brand');
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('rejects null brand', async () => {
    const result = await getBrandVideos(null);
    expect(result.success).toBe(false);
  });
});

// ── getAssemblyVideo ─────────────────────────────────────────────────

describe('getAssemblyVideo', () => {
  it('returns the assembly video for a product', async () => {
    __seed('ProductVideos', ALL_VIDEOS);

    const result = await getAssemblyVideo('nomad-platform-bed');
    expect(result.success).toBe(true);
    expect(result.data).not.toBeNull();
    expect(result.data.type).toBe('assembly');
    expect(result.data.title).toBe('Nomad Platform Bed Assembly');
  });

  it('returns null when no assembly video exists', async () => {
    __seed('ProductVideos', [ND_MURPHY_VIDEO]); // type is 'demo', not 'assembly'

    const result = await getAssemblyVideo('murphy-cabinet-bed');
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('returns null for product with no videos at all', async () => {
    const result = await getAssemblyVideo('no-videos-product');
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('returns error for invalid slug', async () => {
    const result = await getAssemblyVideo('');
    expect(result.success).toBe(false);
  });
});

// ── saveVideo ────────────────────────────────────────────────────────

describe('saveVideo', () => {
  it('creates a new video entry', async () => {
    let inserted;
    __onInsert((collection, item) => { inserted = item; });

    const result = await saveVideo({
      title: 'New Assembly Video',
      brand: 'KD Frames',
      type: 'assembly',
      category: 'platform-beds',
      youtubeUrl: 'https://www.youtube.com/watch?v=NEWVIDEO_11',
      productSlugs: ['new-product'],
      duration: 360,
    });

    expect(result.success).toBe(true);
    expect(result.data.title).toBe('New Assembly Video');
    expect(result.data.youtubeId).toBe('NEWVIDEO_11');
    expect(inserted).toBeDefined();
  });

  it('updates an existing video', async () => {
    __seed('ProductVideos', [KD_NOMAD_VIDEO]);
    let updated;
    __onUpdate((collection, item) => { updated = item; });

    const result = await saveVideo({
      _id: 'vid-001',
      title: 'Updated Title',
      brand: 'KD Frames',
      type: 'assembly',
      youtubeUrl: 'https://www.youtube.com/watch?v=EC1GCQ5CiSo',
    });

    expect(result.success).toBe(true);
    expect(updated).toBeDefined();
    expect(updated._id).toBe('vid-001');
  });

  it('rejects video without title', async () => {
    const result = await saveVideo({
      brand: 'KD Frames',
      type: 'assembly',
      youtubeUrl: 'https://www.youtube.com/watch?v=test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('title');
  });

  it('rejects video without brand', async () => {
    const result = await saveVideo({
      title: 'Test',
      type: 'assembly',
      youtubeUrl: 'https://www.youtube.com/watch?v=test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Brand');
  });

  it('rejects invalid video type', async () => {
    const result = await saveVideo({
      title: 'Test',
      brand: 'KD Frames',
      type: 'invalid-type',
      youtubeUrl: 'https://www.youtube.com/watch?v=test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('type');
  });

  it('rejects video without any URL', async () => {
    const result = await saveVideo({
      title: 'Test',
      brand: 'KD Frames',
      type: 'assembly',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('youtubeUrl or mp4Url');
  });

  it('accepts MP4-only video', async () => {
    const result = await saveVideo({
      title: 'Dillon Animation',
      brand: 'Strata Furniture',
      type: 'animation',
      mp4Url: 'https://store.stratafurniture.com/video.mp4',
    });

    expect(result.success).toBe(true);
    expect(result.data.mp4Url).toContain('video.mp4');
    expect(result.data.youtubeUrl).toBeNull();
  });

  it('rejects null input', async () => {
    const result = await saveVideo(null);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid video data');
  });

  it('generates videoId when not provided', async () => {
    const result = await saveVideo({
      title: 'Auto ID Video',
      brand: 'Test',
      type: 'demo',
      youtubeUrl: 'https://www.youtube.com/watch?v=test12345',
    });

    expect(result.success).toBe(true);
    expect(result.data.videoId).toMatch(/^v-\d+$/);
  });

  it('serializes productSlugs array to JSON', async () => {
    let inserted;
    __onInsert((collection, item) => { inserted = item; });

    await saveVideo({
      title: 'Multi Product',
      brand: 'Test',
      type: 'overview',
      youtubeUrl: 'https://www.youtube.com/watch?v=test12345',
      productSlugs: ['product-a', 'product-b'],
    });

    expect(inserted.productSlugs).toBe('["product-a","product-b"]');
  });
});

// ── getAllVideos ──────────────────────────────────────────────────────

describe('getAllVideos', () => {
  it('returns paginated video list', async () => {
    __seed('ProductVideos', ALL_VIDEOS);

    const result = await getAllVideos(0, 50);
    expect(result.success).toBe(true);
    expect(result.data.videos).toHaveLength(5);
    expect(result.data.page).toBe(0);
    expect(result.data.pageSize).toBe(50);
  });

  it('respects page size limit', async () => {
    __seed('ProductVideos', ALL_VIDEOS);

    const result = await getAllVideos(0, 2);
    expect(result.success).toBe(true);
    expect(result.data.pageSize).toBe(2);
  });

  it('caps page size at 100', async () => {
    __seed('ProductVideos', ALL_VIDEOS);

    const result = await getAllVideos(0, 500);
    expect(result.data.pageSize).toBe(100);
  });

  it('returns empty when no videos exist', async () => {
    const result = await getAllVideos();
    expect(result.success).toBe(true);
    expect(result.data.videos).toEqual([]);
  });
});

// ── YouTube ID extraction ────────────────────────────────────────────

describe('YouTube ID extraction', () => {
  it('extracts ID from standard watch URL', async () => {
    __seed('ProductVideos', [{
      ...KD_NOMAD_VIDEO,
      youtubeUrl: 'https://www.youtube.com/watch?v=EC1GCQ5CiSo',
    }]);

    const result = await getProductVideos('nomad-platform-bed');
    expect(result.data[0].youtubeId).toBe('EC1GCQ5CiSo');
  });

  it('extracts ID from youtu.be short URL', async () => {
    __seed('ProductVideos', [{
      ...KD_NOMAD_VIDEO,
      youtubeUrl: 'https://youtu.be/EC1GCQ5CiSo',
    }]);

    const result = await getProductVideos('nomad-platform-bed');
    expect(result.data[0].youtubeId).toBe('EC1GCQ5CiSo');
  });

  it('extracts ID from embed URL', async () => {
    __seed('ProductVideos', [{
      ...KD_NOMAD_VIDEO,
      youtubeUrl: 'https://www.youtube.com/embed/EC1GCQ5CiSo',
    }]);

    const result = await getProductVideos('nomad-platform-bed');
    expect(result.data[0].youtubeId).toBe('EC1GCQ5CiSo');
  });

  it('returns null for non-YouTube URL', async () => {
    __seed('ProductVideos', [STRATA_DILLON_VIDEO]);

    const result = await getProductVideos('dillon-futon-frame');
    expect(result.data[0].youtubeId).toBeNull();
  });
});
