// videoPageHelpers.js — Product Videos page data
// Static catalog of CF product demo videos (Wix-hosted) and manufacturer videos
// (YouTube, self-hosted MP4) for the product videos gallery page.

// ── Wix-hosted Carolina Futons product demos ────────────────────────

const WIX_VIDEOS = [
  {
    _id: 'vid-intro',
    title: 'Intro',
    description: 'Welcome to Carolina Futons — see what makes our furniture special.',
    category: 'overview',
    videoUri: 'e04e89_ea16ef6edfe64c03a5bfdd0ee468ab7f',
    sortOrder: 0,
  },
  {
    _id: 'vid-asheville',
    title: 'Asheville',
    description: 'The Asheville futon frame — a Night & Day Furniture classic.',
    category: 'futon',
    videoUri: 'e04e89_c2e8bedf07c74b249894fffffc0564b7',
    productSlug: 'asheville-futon-frame',
    sortOrder: 1,
  },
  {
    _id: 'vid-sedona',
    title: 'Sedona',
    description: 'The Sedona futon frame with Southwest-inspired design.',
    category: 'futon',
    videoUri: 'e04e89_8483b56d2ef5417c95242c821934e2b2',
    productSlug: 'sedona-futon-frame',
    sortOrder: 2,
  },
  {
    _id: 'vid-alpine',
    title: 'Alpine',
    description: 'The Alpine futon frame — rustic meets modern.',
    category: 'futon',
    videoUri: 'e04e89_dba4fc2f08ee4a42906dcb76bcb9b31a',
    productSlug: 'alpine-futon-frame',
    sortOrder: 3,
  },
  {
    _id: 'vid-northampton',
    title: 'Northampton',
    description: 'The Northampton futon frame — clean lines and solid hardwood.',
    category: 'futon',
    videoUri: 'e04e89_c1969fc88dcb4c829f3840b250f19166',
    productSlug: 'northampton-futon-frame',
    sortOrder: 4,
  },
  {
    _id: 'vid-mountainnaire',
    title: 'Mountainnaire',
    description: 'The Mountainnaire futon frame — mountain-inspired elegance.',
    category: 'futon',
    videoUri: 'e04e89_b6c0b062855d432a91698f3460b74552',
    productSlug: 'mountainnaire-futon-frame',
    sortOrder: 5,
  },
  {
    _id: 'vid-maricopa',
    title: 'Maricopa',
    description: 'The Maricopa futon frame — versatile and built to last.',
    category: 'futon',
    videoUri: 'e04e89_b10b923982664fa39409244ac93dadcf',
    productSlug: 'maricopa-futon-frame',
    sortOrder: 6,
  },
  {
    _id: 'vid-flagstaff',
    title: 'Flagstaff',
    description: 'The Flagstaff futon frame — timeless style, durable construction.',
    category: 'futon',
    videoUri: 'e04e89_973ed5df7eb34c1d9ad7c1697e8d0f72',
    productSlug: 'flagstaff-futon-frame',
    sortOrder: 7,
  },
  {
    _id: 'vid-studio-conversion',
    title: 'Studio Conversion',
    description: 'See the Studio futon convert from sofa to bed in seconds.',
    category: 'conversion',
    videoUri: 'e04e89_d9ffa580eb5a4fa784bc6bb6a6105257',
    sortOrder: 8,
  },
  {
    _id: 'vid-wallhugger-conversion',
    title: 'WallHugger Conversion',
    description: 'The WallHugger frame converts without pulling away from the wall.',
    category: 'conversion',
    videoUri: 'e04e89_d49b6de8f0b4471bb132c612497fd53c',
    sortOrder: 9,
  },
  {
    _id: 'vid-moonglider-conversion',
    title: 'MoonGlider Conversion',
    description: 'Watch the MoonGlider glide smoothly from sofa to sleeper.',
    category: 'conversion',
    videoUri: 'e04e89_b8d2371453a0487abf8224d6256bdfe0',
    sortOrder: 10,
  },
];

// ── Manufacturer videos (YouTube, MP4) ──────────────────────────────

const MANUFACTURER_VIDEOS = [
  {
    _id: 'v-kd-001',
    title: 'Nomad Platform Bed Assembly',
    description: 'Step-by-step assembly guide for the KD Frames Nomad Platform Bed.',
    category: 'assembly',
    brand: 'KD Frames',
    youtubeId: 'EC1GCQ5CiSo',
    productSlug: 'nomad-platform-bed',
    sortOrder: 100,
  },
  {
    _id: 'v-kd-002',
    title: 'Charleston Platform Bed Assembly',
    description: 'Assembly instructions for the KD Frames Charleston Platform Bed.',
    category: 'assembly',
    brand: 'KD Frames',
    youtubeId: 'ouc5kWkEMfE',
    productSlug: 'charleston-platform-bed',
    sortOrder: 101,
  },
  {
    _id: 'v-kd-003',
    title: 'Fold Platform Bed Assembly',
    description: 'How to assemble the KD Frames Fold Platform Bed.',
    category: 'assembly',
    brand: 'KD Frames',
    youtubeId: 'Xi4Gddlhzd0',
    productSlug: 'fold-platform-bed',
    sortOrder: 102,
  },
  {
    _id: 'v-kd-004',
    title: 'Studio Bifold Futon Assembly',
    description: 'Assembly walkthrough for the KD Frames Studio Bifold Futon.',
    category: 'assembly',
    brand: 'KD Frames',
    youtubeId: 'lDnFOcn7qZ8',
    productSlug: 'studio-bifold-futon',
    sortOrder: 103,
  },
  {
    _id: 'v-kd-005',
    title: 'KD Lounger Assembly',
    description: 'Assembly guide for the KD Frames Lounger.',
    category: 'assembly',
    brand: 'KD Frames',
    youtubeId: 'RjBfOFzDxuo',
    productSlug: 'kd-lounger',
    sortOrder: 104,
  },
  {
    _id: 'v-strata-001',
    title: 'Dillon Wall Hugger Conversion',
    description: 'Watch the Strata Dillon wall hugger futon convert smoothly — no wall clearance needed.',
    category: 'conversion',
    brand: 'Strata Furniture',
    mp4Url: 'https://store.stratafurniture.com/wp-content/uploads/2022/01/Dillon_animation.mp4',
    productSlug: 'dillon-futon-frame',
    sortOrder: 11,
  },
];

// ── Data accessors ──────────────────────────────────────────────────

function buildVideoEntry(v) {
  if (v.videoUri) {
    return {
      ...v,
      source: 'wix',
      videoUrl: `https://video.wixstatic.com/video/${v.videoUri}/1080p/mp4/file.mp4`,
      posterUrl: `https://static.wixstatic.com/media/${v.videoUri}f000.jpg/v1/fill/w_640,h_360,q_80/file.jpg`,
    };
  }
  if (v.youtubeId) {
    return {
      ...v,
      source: 'youtube',
      videoUrl: `https://www.youtube.com/watch?v=${v.youtubeId}`,
      embedUrl: `https://www.youtube.com/embed/${v.youtubeId}`,
      posterUrl: `https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg`,
    };
  }
  if (v.mp4Url) {
    return {
      ...v,
      source: 'mp4',
      videoUrl: v.mp4Url,
      posterUrl: null,
    };
  }
  return { ...v, source: 'unknown', videoUrl: null, posterUrl: null };
}

export function getVideoData() {
  return [...WIX_VIDEOS, ...MANUFACTURER_VIDEOS]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(buildVideoEntry);
}

export function getVideoCategories() {
  return [
    { id: 'overview', label: 'Overview' },
    { id: 'futon', label: 'Futon Frames' },
    { id: 'conversion', label: 'Conversion Demos' },
    { id: 'assembly', label: 'Assembly Guides' },
  ];
}

export function filterVideosByCategory(videos, category) {
  if (!category) return videos;
  return videos.filter(v => v.category === category);
}
