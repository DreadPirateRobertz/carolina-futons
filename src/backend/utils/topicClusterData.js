/**
 * Static topic cluster definitions for the Carolina Futons buying guide hub.
 * Shared between topicClusters.web.js (webMethod layer) and http-functions.js
 * (HTTP endpoint layer). http-functions.js cannot call webMethods at runtime,
 * so both layers import from this module as a single source of truth.
 *
 * Each key is a pillar slug. spokePages describe related sub-guide articles.
 * PILLAR_CONTENT provides rich page content for /guides/{slug} cluster pages.
 */

export const SITE_URL = 'https://www.carolinafutons.com';

/** URL prefix for /guides/{slug} cluster overview pages (distinct from /buying-guides/{slug} spoke pages). */
export const GUIDES_URL = `${SITE_URL}/guides`;

/**
 * Rich pillar page content for each topic cluster.
 * Used by getTopicClusterPage() to render /guides/{slug} pages.
 * Each entry: { metaDescription, intro, sections[{heading,body}], faqs[{question,answer}] }
 */
export const PILLAR_CONTENT = {
  'futon-frames': {
    metaDescription: 'Find the perfect futon frame for your home. Compare wood vs metal, wall-hugger vs standard, and every size from twin to king — with expert advice from Carolina Futons.',
    intro: 'Choosing a futon frame is the foundation of your futon purchase. The frame determines size, style, durability, and how easily it converts between sofa and bed. At Carolina Futons, we\'ve helped thousands of customers find the right frame since 1991.',
    sections: [
      { heading: 'Wood vs Metal Frames', body: 'Wood frames offer warmth and classic styling; metal frames are lighter and often more affordable. Both are durable when quality-built. The right choice depends on your décor and how often you\'ll convert between sofa and bed.' },
      { heading: 'Wall Hugger vs Standard', body: 'Wall-hugger futons pivot forward when opening, requiring only a few inches of wall clearance. Standard bi-fold frames swing back. If your futon will sit near a wall, a wall-hugger design saves significant floor space.' },
      { heading: 'Size Guide', body: 'Futon frames come in Twin, Full, Queen, and King sizes. Full is the most popular — wide enough for two adults to sleep comfortably, compact enough for most rooms. Always measure your space before choosing.' },
    ],
    faqs: [
      { question: 'How long do futon frames last?', answer: 'A quality futon frame lasts 10–20 years with normal use. Hardwood frames (oak, pine, maple) and heavy-gauge steel frames are the most durable.' },
      { question: 'Can I use a regular mattress on a futon frame?', answer: 'Most futon frames require a futon-specific mattress. Regular mattresses are too thick and rigid to fold with the frame. Always use a mattress rated for your frame model.' },
    ],
  },
  'mattresses': {
    metaDescription: 'Compare futon mattress fills, thicknesses, and firmness levels to find the right match for your frame. Expert advice from Carolina Futons, family-owned since 1991.',
    intro: 'The mattress is where comfort lives. Futon mattresses range from budget-friendly foam to premium innerspring and memory foam models. Thickness, fill material, and firmness all affect how well the mattress performs as both a sofa cushion and a sleeping surface.',
    sections: [
      { heading: 'Fill Types', body: 'Cotton batting is traditional and firm. Foam offers consistent support at lower cost. Innerspring mattresses sleep most like a traditional bed. Memory foam conforms to your body. Many premium mattresses combine layers for the best of each.' },
      { heading: 'Thickness', body: 'Thicker mattresses (6–8 inches) sleep better but fold less easily. Thinner mattresses (4–6 inches) are easier to convert and better for daily sofa use. Match thickness to how often you\'ll use the futon as a bed.' },
      { heading: 'Firmness', body: 'Futon mattresses run from plush to extra-firm. Back sleepers typically prefer medium-firm; side sleepers prefer medium. If the futon is primarily a sofa, firmer is better for posture.' },
    ],
    faqs: [
      { question: 'How often should I replace a futon mattress?', answer: 'Most futon mattresses last 5–10 years. Signs it\'s time to replace: sagging, loss of firmness, lumps, or persistent discomfort.' },
      { question: 'Can I put a futon mattress on a regular bed frame?', answer: 'Yes — a futon mattress can work on a platform bed frame. It won\'t fold like it would on a futon frame, but it makes a comfortable, low-profile sleeping surface.' },
    ],
  },
  'covers': {
    metaDescription: 'Find the right futon cover for your frame and mattress. Compare fabrics, measure for a perfect fit, and explore styles from classic to modern — Carolina Futons.',
    intro: 'A futon cover protects your mattress and defines the look of your futon. The right cover fits snugly, handles daily wear, and cleans easily. The wrong one bunches, slips, and wears out quickly.',
    sections: [
      { heading: 'Fabric Guide', body: 'Microfiber is soft, stain-resistant, and easy to clean — the most popular choice for families. Cotton is breathable and classic. Canvas and duck cloth are the most durable for heavy use. Velvet and chenille add luxury but require more care.' },
      { heading: 'Measuring for Fit', body: 'Measure your mattress width, length, and depth before ordering. Most covers are sized for standard futon mattress depths (4–6 inches). A cover that\'s too shallow will be difficult to put on; too deep and it will bunch.' },
    ],
    faqs: [
      { question: 'Can I put a futon cover in the washing machine?', answer: 'Most futon covers are machine washable. Check the care label — cold water and a gentle cycle protect the fabric. Tumble dry on low or air dry to prevent shrinkage.' },
      { question: 'Do futon covers work as slipcovers?', answer: 'Futon covers are designed specifically for futon mattresses, which are thinner and firmer than sofa cushions. A well-fitted futon cover will stay in place; a generic slipcover will not.' },
    ],
  },
  'pillows': {
    metaDescription: 'Complete your futon with the right pillows and bolsters. Learn about styles, placement, and how to choose pillows that work for both sofa and sleeping positions.',
    intro: 'Pillows and bolsters transform a futon from a bed into a proper sofa — and back again. The right pillows support your back when sitting and don\'t get in the way when sleeping.',
    sections: [
      { heading: 'Bolsters vs Throw Pillows', body: 'Bolsters are cylindrical and designed to rest along the back of a futon, supporting the lumbar spine in sofa position. Throw pillows add color and comfort but aren\'t specifically designed for futons. A combination of bolsters and throw pillows works best.' },
    ],
    faqs: [
      { question: 'How many pillows do I need for a full-size futon?', answer: 'Two bolsters (one per armrest end) plus two to four throw pillows is a good starting point. Adjust based on how you use the futon — more for a sofa-first setup, fewer if it\'s primarily a guest bed.' },
    ],
  },
  'storage': {
    metaDescription: 'Maximize your space with futon storage options — under-frame drawers, storage ottomans, and space-saving accessories from Carolina Futons.',
    intro: 'Futons are popular in small spaces precisely because they serve double duty. Adding storage to your futon setup multiplies the value further — extra bedding, seasonal items, and daily essentials can all live under or alongside the futon.',
    sections: [
      { heading: 'Under-Frame Drawers', body: 'Many futon frames offer optional drawer units that slide under the frame. These are ideal for storing extra bedding, pillows, and blankets. Measure the clearance under your frame before purchasing.' },
      { heading: 'Small-Space Strategies', body: 'In studio apartments, the futon is often the primary bed. Pair it with a storage ottoman, under-bed vacuum bags for seasonal items, and floating shelves above the futon to maximize vertical space.' },
    ],
    faqs: [
      { question: 'Do all futon frames have under-frame storage?', answer: 'No — storage drawers are an optional add-on for specific frame models. Check your frame\'s compatibility before ordering drawers. Wall-hugger frames often have less under-frame clearance.' },
    ],
  },
  'outdoor': {
    metaDescription: 'Shop outdoor futons built for sun, rain, and patio life. Compare weather-resistant materials and learn how to protect your outdoor futon for year-round use.',
    intro: 'Outdoor futons bring the versatility of the futon to your patio, deck, or porch. The key difference from indoor futons is weather resistance — materials must handle moisture, UV exposure, and temperature swings without degrading.',
    sections: [
      { heading: 'Weather-Resistant Materials', body: 'Look for frames made from eucalyptus, teak, or powder-coated steel — all resist moisture and UV better than untreated wood or bare metal. Covers should be made from solution-dyed acrylic (like Sunbrella) or marine-grade fabric.' },
      { heading: 'Seasonal Care', body: 'Even the most weather-resistant outdoor futon benefits from a cover when not in use. Store cushions indoors during heavy rain and over winter. Annual treatment of wood frames with teak oil or sealant extends lifespan significantly.' },
    ],
    faqs: [
      { question: 'Can outdoor futon cushions get wet?', answer: 'Weather-resistant outdoor cushions can handle rain and will dry quickly, but prolonged submersion or extended wet storage leads to mold and degradation. Bring cushions in during heavy storms when possible.' },
    ],
  },
  'accessories': {
    metaDescription: 'Complete your futon setup with the right accessories — grip strips, arm covers, hardware, and more. Shop Carolina Futons for everything your futon needs.',
    intro: 'The right accessories keep your futon looking good and functioning properly. Grip strips prevent mattress slipping; arm covers protect the frame; replacement hardware keeps everything tight. Small investments that extend the life of your futon significantly.',
    sections: [
      { heading: 'Essential Accessories', body: 'Grip strips (non-slip pads) are the single most useful futon accessory — they prevent the mattress from sliding when the futon is in sofa position. Arm covers protect wood from wear, spills, and scratches. A frame cover extends the upholstered appearance to the frame itself.' },
    ],
    faqs: [
      { question: 'How do I stop my futon mattress from sliding?', answer: 'Non-slip grip strips placed between the mattress and frame deck solve this problem completely. They\'re inexpensive and available in sizes to fit any futon frame.' },
    ],
  },
  'bundle-deals': {
    metaDescription: 'Save on complete futon packages — frame + mattress + cover bundles from Carolina Futons. Compare bundle value vs individual purchase and find the right complete futon set.',
    intro: 'Buying a futon as a bundle (frame + mattress + cover) is almost always better value than buying each piece separately. Bundles are pre-matched for compatibility, priced with a discount, and arrive together. The question is which bundle is right for you.',
    sections: [
      { heading: 'Bundle vs Individual Purchase', body: 'Individual purchase makes sense when you have a specific frame you love and want to customize the mattress and cover independently. For most shoppers — especially first-time futon buyers — a bundle is the smarter choice. Components are guaranteed compatible, and the total price is typically 15–25% lower than individual pricing.' },
      { heading: 'How to Choose a Bundle', body: 'Start with the frame size (Twin, Full, Queen). Then consider primary use: if sleeping is the priority, choose a thicker mattress (6–8 inch); if sofa use is primary, 4–6 inch is more comfortable. Finally, choose a cover that matches your décor.' },
    ],
    faqs: [
      { question: 'Can I mix and match bundle components?', answer: 'Yes — tell us what you want and we\'ll price it as a bundle. Our staff can confirm compatibility between any frame and mattress combination.' },
      { question: 'Do bundles include delivery and setup?', answer: 'Bundle pricing includes delivery to your door. White-glove setup (assembly in your room) is available for an additional charge. Ask about current setup specials when ordering.' },
    ],
  },
};

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
