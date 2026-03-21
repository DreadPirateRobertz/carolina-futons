/**
 * Static topic cluster definitions for the Carolina Futons buying guide hub.
 * Shared between topicClusters.web.js (webMethod layer) and http-functions.js
 * (HTTP endpoint layer). http-functions.js cannot call webMethods at runtime,
 * so both layers import from this module as a single source of truth.
 *
 * Each key is a pillar slug. spokePages describe related sub-guide articles.
 */

export const SITE_URL = 'https://www.carolinafutons.com';

export const CLUSTERS = {
  'futon-frames': {
    pillarSlug: 'futon-frames',
    pillarTitle: 'The Complete Futon Frame Buying Guide',
    topic: 'futon frames',
    keywords: ['futon frame', 'best futon frame', 'wood futon frame', 'metal futon frame', 'wall hugger futon', 'futon frame sizes', 'Night & Day futon'],
    pillarContent: 'Everything you need to choose the right futon frame — wood vs metal, wall-hugger styles, size guides, and assembly tips from Carolina Futons.',
    internalLinks: [
      { anchor: 'Futon Mattress Buying Guide', url: `${SITE_URL}/guides/mattresses`, targetSlug: 'mattresses' },
      { anchor: 'Futon Cover Guide', url: `${SITE_URL}/guides/covers`, targetSlug: 'covers' },
    ],
    spokePages: [
      { slug: 'wood-vs-metal-frames', title: 'Wood vs Metal Futon Frames', type: 'comparison' },
      { slug: 'wall-hugger-guide', title: 'Wall Hugger Futon Guide', type: 'guide' },
      { slug: 'futon-frame-assembly', title: 'How to Assemble a Futon Frame', type: 'howto' },
      { slug: 'futon-frame-sizes', title: 'Futon Frame Size Guide', type: 'reference' },
    ],
  },
  'mattresses': {
    pillarSlug: 'mattresses',
    pillarTitle: 'Futon Mattress Buying Guide',
    topic: 'futon mattresses',
    keywords: ['futon mattress', 'best futon mattress', 'innerspring futon mattress', 'memory foam futon', 'futon mattress thickness', 'Otis Bed mattress'],
    pillarContent: 'Compare fill types, thickness, and firmness to find the perfect futon mattress — innerspring, memory foam, cotton, and more from Carolina Futons.',
    internalLinks: [
      { anchor: 'Futon Frame Buying Guide', url: `${SITE_URL}/guides/futon-frames`, targetSlug: 'futon-frames' },
      { anchor: 'Futon Cover Guide', url: `${SITE_URL}/guides/covers`, targetSlug: 'covers' },
    ],
    spokePages: [
      { slug: 'mattress-fill-types', title: 'Futon Mattress Fill Types Compared', type: 'comparison' },
      { slug: 'mattress-thickness-guide', title: 'Futon Mattress Thickness Guide', type: 'guide' },
      { slug: 'mattress-care-tips', title: 'How to Care for Your Futon Mattress', type: 'howto' },
      { slug: 'mattress-firmness-guide', title: 'Futon Mattress Firmness Guide', type: 'reference' },
    ],
  },
  'covers': {
    pillarSlug: 'covers',
    pillarTitle: 'Futon Cover Guide: Fabrics, Fits & Style',
    topic: 'futon covers',
    keywords: ['futon cover', 'futon slipcover', 'futon cover fabric', 'microfiber futon cover', 'cotton futon cover', 'futon cover sizing'],
    pillarContent: 'Find the right futon cover for your style and lifestyle — compare fabrics, learn how to measure, and keep your cover looking great with proper care.',
    internalLinks: [
      { anchor: 'Futon Frame Buying Guide', url: `${SITE_URL}/guides/futon-frames`, targetSlug: 'futon-frames' },
      { anchor: 'Futon Mattress Buying Guide', url: `${SITE_URL}/guides/mattresses`, targetSlug: 'mattresses' },
    ],
    spokePages: [
      { slug: 'cover-fabric-comparison', title: 'Futon Cover Fabrics Compared', type: 'comparison' },
      { slug: 'cover-sizing-guide', title: 'How to Measure for a Futon Cover', type: 'howto' },
      { slug: 'cover-care-instructions', title: 'Futon Cover Care & Washing Guide', type: 'howto' },
    ],
  },
  'pillows': {
    pillarSlug: 'pillows',
    pillarTitle: 'Futon Pillow & Bolster Guide',
    topic: 'futon pillows',
    keywords: ['futon pillows', 'futon bolsters', 'decorative futon pillows', 'futon back pillows'],
    pillarContent: 'Dress up your futon with the right pillows and bolsters — decorative styles, practical back support, and arrangement tips for every setup.',
    internalLinks: [
      { anchor: 'Futon Cover Guide', url: `${SITE_URL}/guides/covers`, targetSlug: 'covers' },
      { anchor: 'Futon Accessories Guide', url: `${SITE_URL}/guides/accessories`, targetSlug: 'accessories' },
    ],
    spokePages: [
      { slug: 'pillow-styles-guide', title: 'Futon Pillow Styles & Uses', type: 'guide' },
      { slug: 'bolster-placement-tips', title: 'How to Arrange Futon Bolsters', type: 'howto' },
    ],
  },
  'storage': {
    pillarSlug: 'storage',
    pillarTitle: 'Futon Storage Solutions Guide',
    topic: 'futon storage',
    keywords: ['futon storage', 'under futon storage', 'futon drawers', 'storage ottoman futon'],
    pillarContent: 'Maximize your space with smart futon storage — drawer bases, under-frame organizers, and small-space solutions from Carolina Futons.',
    internalLinks: [
      { anchor: 'Futon Frame Buying Guide', url: `${SITE_URL}/guides/futon-frames`, targetSlug: 'futon-frames' },
      { anchor: 'Futon Accessories Guide', url: `${SITE_URL}/guides/accessories`, targetSlug: 'accessories' },
    ],
    spokePages: [
      { slug: 'drawer-options-guide', title: 'Futon Drawer Storage Options', type: 'guide' },
      { slug: 'small-space-storage', title: 'Storage Solutions for Small Spaces', type: 'guide' },
    ],
  },
  'outdoor': {
    pillarSlug: 'outdoor',
    pillarTitle: 'Outdoor Futon Guide',
    topic: 'outdoor futons',
    keywords: ['outdoor futon', 'patio futon', 'weather resistant futon', 'outdoor futon cover'],
    pillarContent: 'Shop outdoor-rated futons built for the elements — weather-resistant frames, durable covers, and care tips to protect your patio investment.',
    internalLinks: [
      { anchor: 'Futon Frame Buying Guide', url: `${SITE_URL}/guides/futon-frames`, targetSlug: 'futon-frames' },
      { anchor: 'Futon Cover Guide', url: `${SITE_URL}/guides/covers`, targetSlug: 'covers' },
    ],
    spokePages: [
      { slug: 'outdoor-material-guide', title: 'Weather-Resistant Futon Materials', type: 'guide' },
      { slug: 'outdoor-futon-care', title: 'How to Protect Your Outdoor Futon', type: 'howto' },
    ],
  },
  'accessories': {
    pillarSlug: 'accessories',
    pillarTitle: 'Futon Accessories Guide',
    topic: 'futon accessories',
    keywords: ['futon accessories', 'futon grip strips', 'futon arm covers', 'futon hardware'],
    pillarContent: 'Complete your futon setup with the right accessories — grip strips, arm covers, replacement hardware, and finishing touches from Carolina Futons.',
    internalLinks: [
      { anchor: 'Futon Frame Buying Guide', url: `${SITE_URL}/guides/futon-frames`, targetSlug: 'futon-frames' },
      { anchor: 'Futon Pillow & Bolster Guide', url: `${SITE_URL}/guides/pillows`, targetSlug: 'pillows' },
    ],
    spokePages: [
      { slug: 'essential-accessories', title: 'Essential Futon Accessories', type: 'guide' },
      { slug: 'grip-strip-installation', title: 'How to Install Futon Grip Strips', type: 'howto' },
    ],
  },
  'bundle-deals': {
    pillarSlug: 'bundle-deals',
    pillarTitle: 'Futon Bundle Deals Guide',
    topic: 'futon bundles',
    keywords: ['futon bundle', 'futon set deal', 'complete futon package', 'futon frame mattress bundle'],
    pillarContent: 'Save more with Carolina Futons bundle deals — compare complete sets vs individual pieces to find the best value for your budget.',
    internalLinks: [
      { anchor: 'Futon Frame Buying Guide', url: `${SITE_URL}/guides/futon-frames`, targetSlug: 'futon-frames' },
      { anchor: 'Futon Mattress Buying Guide', url: `${SITE_URL}/guides/mattresses`, targetSlug: 'mattresses' },
      { anchor: 'Futon Cover Guide', url: `${SITE_URL}/guides/covers`, targetSlug: 'covers' },
    ],
    spokePages: [
      { slug: 'bundle-value-comparison', title: 'Futon Bundle vs Individual Purchase', type: 'comparison' },
      { slug: 'how-to-choose-bundle', title: 'How to Choose the Right Futon Bundle', type: 'guide' },
    ],
  },
};
