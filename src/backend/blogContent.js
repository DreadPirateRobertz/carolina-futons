// Blog Content Data Module
// Structured data for 8 SEO pillar blog posts targeting long-tail futon keywords
// Used by seoHelpers for FAQ/Article schema injection on Blog Post pages
// Human imports the matching content files from content/blog/ into Wix Blog Dashboard

const BLOG_POSTS = {
  'best-futons-for-everyday-sleeping': {
    slug: 'best-futons-for-everyday-sleeping',
    title: 'Best Futons for Everyday Sleeping: A Complete Guide',
    metaDescription: 'Discover the best futons for everyday sleeping. Learn what makes a futon comfortable for nightly use, mattress thickness, and frame types.',
    keywords: ['best futon for sleeping', 'futon as a bed', 'everyday sleeping futon', 'futon for nightly use', 'can you sleep on a futon every night'],
    excerpt: 'Yes, you can sleep on a futon every night — if you choose the right one. Here\'s everything you need to know about futons built for everyday sleeping comfort.',
    category: 'Buying Guides',
    tags: ['futon frames', 'futon mattresses', 'sleeping', 'buying guide'],
    publishDate: '2026-02-20',
    faqs: [
      {
        question: 'Can you sleep on a futon every night?',
        answer: 'Yes. Modern futon mattresses from brands like Otis Bed use high-density foam and innerspring construction designed for nightly use. The key is choosing a mattress at least 8 inches thick and a sturdy hardwood frame that keeps the mattress properly supported.',
      },
      {
        question: 'What is the best futon mattress thickness for sleeping?',
        answer: 'For everyday sleeping, choose a futon mattress that is 8 to 10 inches thick. Thinner mattresses (6 inches) work for occasional use, but nightly sleepers need the extra support and cushioning that comes with 8+ inches of high-density foam or innerspring construction.',
      },
      {
        question: 'Are futons bad for your back?',
        answer: 'No — quality futons with proper mattresses can be excellent for back support. Look for mattresses with firm innerspring cores or high-density foam. Brands like Otis Bed are CertiPUR-US certified and designed by sleep engineers. Many customers report better back support than traditional mattresses.',
      },
      {
        question: 'How long does a futon mattress last with daily use?',
        answer: 'A quality futon mattress lasts 10-15 years with daily use. Rotate the mattress every 3-6 months and use a washable cover to extend its life. Our Otis Bed mattresses feature no-turn design and high-density construction for lasting comfort.',
      },
      {
        question: 'What futon frame is best for everyday sleeping?',
        answer: 'Solid hardwood frames from Night & Day Furniture are best for everyday sleeping. They provide stable, flat sleeping surfaces and withstand daily conversion between sofa and bed positions. Avoid lightweight metal frames for nightly use.',
      },
    ],
  },

  'futon-frame-buying-guide': {
    slug: 'futon-frame-buying-guide',
    title: 'Futon Frame Buying Guide: Wood vs Metal, Sizes & Styles',
    metaDescription: 'Compare wood vs metal futon frames, understand sizes, and find the perfect style. Expert guide covers Night & Day, KD Frames, and Strata.',
    keywords: ['futon frame buying guide', 'wood futon frame', 'futon frame sizes', 'best futon frame', 'futon frame styles'],
    excerpt: 'Choosing the right futon frame is the foundation of comfort. This guide compares materials, sizes, and styles to help you find the perfect frame.',
    category: 'Buying Guides',
    tags: ['futon frames', 'buying guide', 'Night & Day', 'KD Frames'],
    publishDate: '2026-02-20',
    faqs: [
      {
        question: 'Is a wood or metal futon frame better?',
        answer: 'Solid hardwood frames are more durable, stable, and aesthetically pleasing than metal frames. Hardwood frames from Night & Day Furniture last 15-20 years and provide a flat, supportive sleeping surface. Metal frames are lighter and cheaper but may squeak and flex over time.',
      },
      {
        question: 'What sizes do futon frames come in?',
        answer: 'Futon frames come in Twin, Full, and Queen sizes. Full (54" x 75") is the most common and fits standard futon mattresses. Queen frames (60" x 80") offer more sleeping space and are ideal for couples or everyday sleepers.',
      },
      {
        question: 'What is a wall hugger futon frame?',
        answer: 'A wall hugger frame slides forward as it reclines, so it can sit flush against the wall in both sofa and bed positions. This design saves 12-18 inches of floor space compared to standard frames, making it perfect for apartments and smaller rooms.',
      },
      {
        question: 'How much weight can a futon frame hold?',
        answer: 'Quality hardwood futon frames hold 500-750 lbs depending on the model. Night & Day Furniture frames are rated for 500+ lbs. Always check the manufacturer weight rating and choose solid hardwood over particleboard for maximum capacity.',
      },
      {
        question: 'Do futon frames require assembly?',
        answer: 'Yes, most futon frames require assembly. Solid wood frames from Night & Day typically take 30-60 minutes with basic tools. KD Frames (knock-down) are designed for easy assembly and disassembly, perfect for moves or tight spaces.',
      },
    ],
  },

  'how-to-choose-futon-mattress': {
    slug: 'how-to-choose-futon-mattress',
    title: 'How to Choose the Right Futon Mattress: Thickness, Fill & Firmness',
    metaDescription: 'Learn how to choose the right futon mattress. Compare innerspring vs foam, understand thickness options, and find the perfect firmness for sitting and sleeping.',
    keywords: ['futon mattress guide', 'best futon mattress', 'futon mattress thickness', 'innerspring futon mattress', 'foam futon mattress'],
    excerpt: 'The mattress makes or breaks your futon experience. Here\'s how to choose the right thickness, fill type, and firmness for your needs.',
    category: 'Buying Guides',
    tags: ['futon mattresses', 'Otis Bed', 'buying guide', 'mattress comparison'],
    publishDate: '2026-02-20',
    faqs: [
      {
        question: 'What is the best fill type for a futon mattress?',
        answer: 'For everyday sleeping, innerspring or high-density foam mattresses are best. Innerspring mattresses (like Otis Bed models) offer the most support and breathability. Memory foam provides pressure relief. Cotton-fill mattresses are traditional but flatten faster and are better for occasional use.',
      },
      {
        question: 'How thick should a futon mattress be?',
        answer: 'For daily sleeping, choose 8-10 inches. For occasional use or guest rooms, 6-8 inches works well. Mattresses under 6 inches are best for decorative or light sitting use only. Thicker mattresses provide better comfort but may not fold as easily on some frames.',
      },
      {
        question: 'Can you use a regular mattress on a futon frame?',
        answer: 'No. Regular mattresses are not designed to fold and will be damaged by futon frame mechanisms. Futon mattresses are specifically engineered to flex between flat and folded positions while maintaining their structure and comfort.',
      },
      {
        question: 'How often should you replace a futon mattress?',
        answer: 'Quality futon mattresses last 10-15 years with proper care. Signs it is time to replace: visible sagging, lumps, reduced comfort, or if you wake up with aches. Rotating the mattress every 3-6 months extends its life significantly.',
      },
      {
        question: 'Are futon mattresses good for people with allergies?',
        answer: 'Yes. Otis Bed futon mattresses are hypoallergenic and made with CertiPUR-US certified foam, free from harmful chemicals, ozone depleters, and heavy metals. Pair with a washable allergen-proof cover for maximum protection.',
      },
    ],
  },

  'murphy-bed-vs-futon': {
    slug: 'murphy-bed-vs-futon',
    title: 'Murphy Cabinet Bed vs Futon: Which Saves More Space?',
    metaDescription: 'Compare Murphy cabinet beds and futons for small spaces. Pros, cons, and costs of each space-saving bed for apartments and guest rooms.',
    keywords: ['murphy bed vs futon', 'best bed for small space', 'space saving bed', 'murphy cabinet bed', 'futon or murphy bed'],
    excerpt: 'Two great space-saving beds, one room. Here\'s how to decide between a Murphy cabinet bed and a futon for your small space.',
    category: 'Comparisons',
    tags: ['murphy beds', 'futon frames', 'small spaces', 'comparison'],
    publishDate: '2026-02-20',
    faqs: [
      {
        question: 'Is a Murphy bed or futon better for a small apartment?',
        answer: 'It depends on your priorities. Futons are more affordable ($500-$1,500 for frame + mattress) and provide seating during the day. Murphy cabinet beds ($2,000-$3,500) completely hide the bed, freeing up more floor space, and include a built-in Queen mattress.',
      },
      {
        question: 'Do Murphy cabinet beds need to be mounted to the wall?',
        answer: 'No. Our Murphy cabinet beds from Arason and Night & Day Furniture are completely freestanding. They look like elegant cabinets when closed and open to reveal a Queen-size gel memory foam mattress. No wall mounting, no installation, no tools required.',
      },
      {
        question: 'Which is more comfortable for sleeping — a Murphy bed or a futon?',
        answer: 'Murphy cabinet beds typically provide a more traditional sleeping experience with their included Queen gel memory foam mattress. High-quality futons with 8-10 inch innerspring mattresses come very close in comfort. Both are suitable for everyday sleeping when you choose quality products.',
      },
      {
        question: 'How much space does a Murphy cabinet bed save?',
        answer: 'A closed Murphy cabinet bed takes up about 10 square feet (roughly 24" deep x 64" wide). When closed, it functions as a cabinet or desk surface. A futon in sofa position takes about 20-24 square feet but provides seating. Murphy beds save more floor space overall.',
      },
    ],
  },

  'futon-care-guide': {
    slug: 'futon-care-guide',
    title: 'How to Care for Your Futon: Maintenance & Longevity Tips',
    metaDescription: 'Keep your futon looking and feeling new. Learn mattress maintenance, frame care, cover cleaning, and tips to extend your futon\'s life.',
    keywords: ['futon care', 'how to maintain futon', 'futon mattress cleaning', 'futon cover care', 'futon maintenance tips'],
    excerpt: 'A well-maintained futon lasts over a decade. Follow these care tips to keep your futon mattress comfortable and your frame in great shape.',
    category: 'Care & Maintenance',
    tags: ['futon care', 'maintenance', 'cleaning', 'tips'],
    publishDate: '2026-02-20',
    faqs: [
      {
        question: 'How do you clean a futon mattress?',
        answer: 'Vacuum the mattress monthly with an upholstery attachment. Spot-clean stains with a mild detergent and damp cloth — never soak the mattress. Use a washable futon cover for daily protection. Air the mattress in sunlight quarterly to eliminate moisture and odors.',
      },
      {
        question: 'How often should you flip a futon mattress?',
        answer: 'Rotate your futon mattress head-to-foot every 3-6 months to distribute wear evenly. Our Otis Bed mattresses feature no-turn design, so rotation is sufficient — no flipping needed. If your mattress has a distinct top and bottom, only rotate, do not flip.',
      },
      {
        question: 'How do you keep a futon from sagging?',
        answer: 'Use a solid platform or slatted base (not just bars), rotate the mattress regularly, avoid sitting in the same spot daily, and choose a high-density mattress (8+ inches). Replacing worn slats on the frame also helps prevent sagging.',
      },
      {
        question: 'Can you wash a futon cover in the washing machine?',
        answer: 'Most removable futon covers are machine washable on a gentle cycle with cold water. Check the care label first. Tumble dry on low or air dry to prevent shrinkage. We recommend washing covers every 1-2 months for freshness.',
      },
      {
        question: 'How do you maintain a wood futon frame?',
        answer: 'Dust regularly with a soft cloth. Tighten bolts and screws every 6 months — daily use loosens hardware over time. For solid wood frames, apply furniture polish or wood conditioner annually. Keep frames away from direct sunlight to prevent fading.',
      },
    ],
  },

  'futon-vs-sofa-bed': {
    slug: 'futon-vs-sofa-bed',
    title: 'Futon vs Sofa Bed: The Complete Comparison for 2026',
    metaDescription: 'Futon vs sofa bed — which is right for you? Compare comfort, price, space, durability, and style in our honest head-to-head comparison guide.',
    keywords: ['futon vs sofa bed', 'futon or sofa bed', 'sleeper sofa vs futon', 'sofa bed comparison', 'futon vs couch'],
    excerpt: 'Futons and sofa beds both convert from seating to sleeping, but the similarities end there. Here\'s an honest comparison to help you choose.',
    category: 'Comparisons',
    tags: ['futon frames', 'comparison', 'sofa beds', 'buying guide'],
    publishDate: '2026-02-20',
    faqs: [
      {
        question: 'Is a futon or sofa bed more comfortable for sleeping?',
        answer: 'Quality futons with thick innerspring mattresses (8-10 inches) are generally more comfortable for sleeping than sofa beds. Sofa bed mattresses are thin (4-5 inches) and have a metal bar beneath. Futon mattresses sit on flat wood slats, providing even, bar-free support.',
      },
      {
        question: 'Which is cheaper — a futon or a sofa bed?',
        answer: 'Futons are typically more affordable. A quality futon frame and mattress costs $500-$1,500, while comparable sofa beds range from $800-$3,000+. Futon mattresses are also cheaper to replace ($200-$600) than sofa bed mattresses.',
      },
      {
        question: 'Do futons take up less space than sofa beds?',
        answer: 'Yes. Futons are generally slimmer in profile and lighter than sofa beds. A wall-hugger futon can sit flush against the wall in both positions. Sofa beds are deeper and heavier due to the fold-out mechanism hidden inside the couch frame.',
      },
      {
        question: 'Which lasts longer — a futon or a sofa bed?',
        answer: 'With quality components, both last 10-15 years. Solid hardwood futon frames often outlast sofa bed mechanisms, which can break or jam. Futon mattresses are simpler to replace independently, while sofa bed mattresses require specific thin sizes.',
      },
    ],
  },

  'small-space-furniture-guide': {
    slug: 'small-space-furniture-guide',
    title: 'Small Space Furniture Solutions: Best Beds for Apartments & Studios',
    metaDescription: 'Maximize your small space with the right furniture. Compare futons, Murphy beds, and platform beds for apartments, studios, and guest rooms.',
    keywords: ['small space furniture', 'apartment furniture ideas', 'studio apartment bed', 'best furniture for small rooms', 'space saving furniture'],
    excerpt: 'Living small doesn\'t mean sacrificing comfort. These furniture solutions make the most of every square foot in apartments, studios, and compact homes.',
    category: 'Lifestyle',
    tags: ['small spaces', 'apartments', 'murphy beds', 'futon frames', 'platform beds'],
    publishDate: '2026-02-20',
    faqs: [
      {
        question: 'What is the best bed for a studio apartment?',
        answer: 'A futon or Murphy cabinet bed is ideal for studios. Futons serve as both sofa and bed, costing $500-$1,500. Murphy cabinet beds completely hide the bed when not in use, freeing up floor space for a home office or living area during the day.',
      },
      {
        question: 'How do you make a small room look bigger with furniture?',
        answer: 'Choose multi-functional furniture (futons, storage beds), keep pieces low-profile, use light-colored frames, and leave walking paths clear. Platform beds with built-in storage eliminate the need for dressers. Wall hugger futons save 12-18 inches by sitting flush against the wall.',
      },
      {
        question: 'What furniture doubles as storage in small spaces?',
        answer: 'Platform beds with drawers, Murphy cabinet beds with shelving, and futon frames with built-in storage compartments all serve double duty. Ottoman coffee tables with interior storage and nightstands with drawers also maximize limited square footage.',
      },
      {
        question: 'Is a futon good for a guest room?',
        answer: 'Futons are perfect for guest rooms. They provide comfortable seating when guests are not visiting and convert to a full or queen bed when needed. A mid-range futon with a 6-8 inch mattress offers excellent guest comfort without dedicating the room solely to a bed.',
      },
    ],
  },

  'platform-bed-guide': {
    slug: 'platform-bed-guide',
    title: 'Platform Beds: Why You Don\'t Need a Box Spring Anymore',
    metaDescription: 'Learn why platform beds have replaced box springs. Compare styles, materials, and features. Discover how platform beds save money and improve sleep quality.',
    keywords: ['platform bed guide', 'platform bed vs box spring', 'best platform bed', 'do you need a box spring', 'platform bed benefits'],
    excerpt: 'Platform beds provide full mattress support with built-in slats — no box spring needed. Here\'s why they\'re the modern standard for better sleep.',
    category: 'Buying Guides',
    tags: ['platform beds', 'buying guide', 'bedroom furniture', 'Night & Day'],
    publishDate: '2026-02-20',
    faqs: [
      {
        question: 'Do you need a box spring with a platform bed?',
        answer: 'No. Platform beds have built-in slats or a solid platform that provides complete mattress support. Adding a box spring is unnecessary and can actually raise the bed too high. This saves you $100-$300 on a box spring purchase.',
      },
      {
        question: 'What type of mattress works best on a platform bed?',
        answer: 'Memory foam, latex, hybrid, and innerspring mattresses all work on platform beds. The flat, even support of slats is especially good for foam mattresses, which need a solid surface. Avoid very thin mattresses (under 6 inches) as you may feel the slats.',
      },
      {
        question: 'Are platform beds good for back support?',
        answer: 'Yes. Platform beds provide firm, even support across the entire mattress surface. The consistent support prevents sagging and maintains proper spinal alignment. Adjustable slat tension on some models lets you customize firmness zones.',
      },
      {
        question: 'How much weight can a platform bed hold?',
        answer: 'Quality solid wood platform beds hold 500-1,000 lbs depending on construction. Night & Day Furniture platform beds are rated for 500+ lbs. Metal platform beds typically hold 300-500 lbs. Always check manufacturer specifications.',
      },
      {
        question: 'Do platform beds squeak?',
        answer: 'Solid wood platform beds rarely squeak because wood joints absorb movement. Metal platform beds are more prone to squeaking at connection points. If squeaking occurs, tighten all bolts and apply felt pads between metal contact points.',
      },
    ],
  },
};

// Get all blog post slugs
export function getBlogSlugs() {
  return Object.keys(BLOG_POSTS);
}

// Get blog post data by slug
export function getBlogPost(slug) {
  return BLOG_POSTS[slug] || null;
}

// Get FAQ array for a specific blog post
export function getBlogFaqs(slug) {
  const post = BLOG_POSTS[slug];
  return post ? post.faqs : null;
}

// Get all blog posts (for sitemap, feeds, etc.)
export function getAllBlogPosts() {
  return Object.values(BLOG_POSTS);
}
