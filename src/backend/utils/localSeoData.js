/**
 * Static local SEO data for /near/[city] city landing pages.
 * Shared source of truth for localSeoService.web.js (webMethod layer) and
 * localSeo.web.js (STORE_ADDRESS, STORE_GEO for JSON-LD schema generation).
 *
 * Each key is a URL slug. Hendersonville NC is the home/store city (distance = 0).
 * Nearby areas provide internal cross-linking between city pages.
 */

export const SITE_URL = 'https://www.carolinafutons.com';
export const STORE_CITY = 'hendersonville-nc';

export const STORE_PHONE = '+1-828-693-1935';
export const STORE_ADDRESS = {
  streetAddress: '824 Locust St',
  addressLocality: 'Hendersonville',
  addressRegion: 'NC',
  postalCode: '28792',
  addressCountry: 'US',
};
export const STORE_GEO = { latitude: 35.3162, longitude: -82.4609 };
export const STORE_HOURS = ['Mo-Fr 10:00-18:00', 'Sa 10:00-17:00'];

/**
 * Approximate city-center geo coordinates for each /near/[city] page.
 * Used in LocalBusiness JSON-LD `geo` to signal proximity to the city served.
 * Falls back to STORE_GEO for any slug not listed here.
 */
export const CITY_GEO = {
  'hendersonville-nc': STORE_GEO, // home city — same as store coordinates
  'asheville-nc':      { latitude: 35.5951, longitude: -82.5515 },
  'charlotte-nc':      { latitude: 35.2271, longitude: -80.8431 },
  'greenville-sc':     { latitude: 34.8526, longitude: -82.3940 },
  'spartanburg-sc':    { latitude: 34.9496, longitude: -81.9320 },
  'boone-nc':          { latitude: 36.2168, longitude: -81.6746 },
};
// Static Google Maps directions URL — store is always the destination.
export const STORE_DIRECTIONS_URL = 'https://maps.google.com/maps/dir//carolina+futons+hendersonville+nc';

/**
 * Approximate city-center geo coordinates for each /near/[city] page.
 * Used in LocalBusiness JSON-LD `geo` to signal proximity to the city served.
 * Falls back to STORE_GEO for any slug not listed here.
 */
export const CITY_GEO = {
  'hendersonville-nc': STORE_GEO, // home city — same as store coordinates
  'asheville-nc':      { latitude: 35.5951, longitude: -82.5515 },
  'charlotte-nc':      { latitude: 35.2271, longitude: -80.8431 },
  'greenville-sc':     { latitude: 34.8526, longitude: -82.3940 },
  'spartanburg-sc':    { latitude: 34.9496, longitude: -81.9320 },
  'boone-nc':          { latitude: 36.2168, longitude: -81.6746 },
};
// Static Google Maps directions URL — store is always the destination.
export const STORE_DIRECTIONS_URL = 'https://maps.google.com/maps/dir//carolina+futons+hendersonville+nc';


export const LOCAL_PAGES = {
  'hendersonville-nc': {
    slug: 'hendersonville-nc',
    city: 'Hendersonville',
    state: 'NC',
    isHomeCity: true,
    preferredCategories: ['futon-frames'],
    distance: null,
    headline: 'Carolina Futons — Your Local Futon Store in Hendersonville, NC',
    heroDescription: 'Carolina Futons has been Hendersonville\'s go-to futon and furniture store since 1991. Browse our full showroom on Main Street — hundreds of futon frames, mattresses, covers, and accessories in stock. Family-owned, locally focused, and ready to help you find the perfect fit for your space.',
    neighborhoodContext: 'Hendersonville is the heart of the Blue Ridge foothills — a short drive from Asheville, Flat Rock, and Brevard. Our showroom is right on Main Street, an easy stop whether you\'re shopping for a college apartment, guest room, or everyday sofa bed.',
    metaTitle: 'Futon Store in Hendersonville, NC | Carolina Futons',
    metaDescription: 'Shop futons, frames, and mattresses at Carolina Futons in Hendersonville, NC. Family-owned since 1991. Visit our showroom or order online.',
    featuredProducts: ['futon-frames', 'mattresses', 'covers'],
    categoryRecommendations: [
      { category: 'futon-frames', label: 'Futon Frames', reason: 'Our widest in-store selection — wood, metal, and wall-hugger styles' },
      { category: 'mattresses', label: 'Futon Mattresses', reason: 'Try before you buy: all mattress grades available in the showroom' },
      { category: 'covers', label: 'Futon Covers', reason: 'Hundreds of fabrics and colors — custom orders welcome' },
    ],
    faqs: [
      { question: 'Where is Carolina Futons located in Hendersonville?', answer: 'Our showroom is on Main Street in downtown Hendersonville, NC 28792. Open Wednesday–Friday 10am–5pm and Saturday 10am–4pm.' },
      { question: 'Do you offer delivery to Hendersonville addresses?', answer: 'Yes — we deliver within the Hendersonville area. Delivery fees vary by distance and item size. Call us to schedule.' },
      { question: 'Can I try futon mattresses before buying?', answer: 'Absolutely. All mattress grades are on the showroom floor. We encourage you to come in and test comfort levels in person.' },
      { question: 'Do you carry murphy beds and wall beds?', answer: 'Yes, we carry a selection of murphy beds alongside our futon frames. Visit the showroom or browse online for current inventory.' },
    ],
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3293!2d-82.461!3d35.316!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zHendersonville+NC!5e0!3m2!1sen!2sus!4v1',
    directions: 'Located in Hendersonville, NC. Call us for exact directions to our showroom.',
    nearbyAreas: ['asheville-nc', 'flat-rock-nc', 'brevard-nc'],
  },
  'asheville-nc': {
    slug: 'asheville-nc',
    city: 'Asheville',
    state: 'NC',
    isHomeCity: false,
    distance: '20 miles',
    headline: 'Futons Near Asheville, NC — Shop Carolina Futons',
    heroDescription: 'Just 20 miles from Asheville on I-26 South, Carolina Futons offers the region\'s largest futon selection. Whether you\'re furnishing a West Asheville bungalow, a River Arts District studio, or a short-term rental in the mountains, we have frames, mattresses, and covers to match your style and budget.',
    neighborhoodContext: 'Asheville\'s vibrant arts scene and booming rental market mean furniture needs that change fast. We work with Asheville residents, landlords, and Airbnb hosts who need quality pieces that hold up — and we stock bundle deals designed for exactly that.',
    metaTitle: 'Futon Store Near Asheville, NC | Carolina Futons',
    metaDescription: 'Looking for futons near Asheville, NC? Carolina Futons is just 20 miles away in Hendersonville. Shop frames, mattresses, and covers — family-owned since 1991.',
    featuredProducts: ['futon-frames', 'mattresses', 'bundle-deals'],
    categoryRecommendations: [
      { category: 'futon-frames', label: 'Futon Frames', reason: 'Popular with Asheville rental hosts — durable frames in wood and metal' },
      { category: 'mattresses', label: 'Futon Mattresses', reason: 'High-resilience foam and cotton options for everyday use' },
    ],
    faqs: [
      { question: 'How far is Carolina Futons from Asheville?', answer: 'We\'re about 20 miles south of Asheville on I-26 in Hendersonville, NC — roughly a 25-minute drive.' },
      { question: 'Do you deliver futons to Asheville?', answer: 'Yes, we deliver to Asheville. Delivery fees apply based on distance and item size. Contact us to schedule.' },
      { question: 'Do you have bundle deals for furnishing rental properties?', answer: 'Yes — we offer bundle deals combining frames, mattresses, and covers at a discount. Great for short-term rental setups.' },
      { question: 'What are your store hours?', answer: 'We\'re open Wednesday–Friday 10am–5pm and Saturday 10am–4pm. Closed Sunday–Tuesday.' },
    ],
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3293!2d-82.554!3d35.595!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zAsheville+NC!5e0!3m2!1sen!2sus!4v1',
    directions: 'From Asheville, take I-26 South to Hendersonville — about 20 miles.',
    nearbyAreas: ['hendersonville-nc', 'weaverville-nc', 'black-mountain-nc'],
  },
  'charlotte-nc': {
    slug: 'charlotte-nc',
    city: 'Charlotte',
    state: 'NC',
    isHomeCity: false,
    distance: '2 hours',
    headline: 'Futons Near Charlotte, NC — Order Online from Carolina Futons',
    heroDescription: 'Carolina Futons ships futon frames, mattresses, and covers across North Carolina — including the Charlotte metro area. Browse our full online catalog, place your order, and we\'ll handle delivery. Or make the scenic drive to our Hendersonville showroom to see everything in person.',
    neighborhoodContext: 'Charlotte is our most popular online delivery destination. From Uptown apartments to South Charlotte homes, our futons work in every space. Online ordering is easy, and we offer delivery scheduling to all Charlotte-area zip codes.',
    metaTitle: 'Futon Store Near Charlotte, NC | Carolina Futons',
    metaDescription: 'Shop Carolina Futons from Charlotte, NC. Wide selection of futon frames, mattresses, and covers — shop online or visit our Hendersonville showroom.',
    featuredProducts: ['futon-frames', 'mattresses', 'covers'],
    categoryRecommendations: [
      { category: 'futon-frames', label: 'Futon Frames', reason: 'Popular online orders from Charlotte — ships flat-packed for easy delivery' },
      { category: 'mattresses', label: 'Futon Mattresses', reason: 'Choose your comfort level online — all specs listed by category' },
    ],
    faqs: [
      { question: 'Do you ship futons to Charlotte, NC?', answer: 'Yes, we deliver to Charlotte. Delivery fees apply. Place your order online or call us to arrange a delivery date.' },
      { question: 'Can I order a futon online without visiting the store?', answer: 'Absolutely — our full catalog is available online with dimensions, materials, and pricing. We ship statewide.' },
      { question: 'How long does delivery to Charlotte take?', answer: 'Typically 3–7 business days from order. We\'ll confirm your delivery window when you schedule.' },
      { question: 'Is it worth driving to your Hendersonville showroom from Charlotte?', answer: 'Many Charlotte customers make the trip — it\'s a scenic 2-hour drive and you get to see the full selection. We\'re happy to set aside items for you to review when you arrive.' },
    ],
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3293!2d-80.843!3d35.227!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zCharlotte+NC!5e0!3m2!1sen!2sus!4v1',
    directions: 'From Charlotte, take I-85 North to I-26 West toward Hendersonville — about 2 hours.',
    nearbyAreas: ['gastonia-nc', 'concord-nc', 'rock-hill-sc'],
  },
  'greenville-sc': {
    slug: 'greenville-sc',
    city: 'Greenville',
    state: 'SC',
    isHomeCity: false,
    distance: '45 miles',
    headline: 'Futons Near Greenville, SC — Carolina Futons',
    heroDescription: 'Greenville, SC customers are among our most loyal — just 45 miles on I-26 and you\'re at our Hendersonville showroom. We carry the Upstate\'s widest futon selection: frames in every style, mattresses in every firmness, and hundreds of cover fabrics.',
    neighborhoodContext: 'The Greenville–Spartanburg corridor is growing fast, and so is demand for versatile furniture. Our futon frames double as guest beds, home office daybed seating, and apartment-friendly sofas. Great for Furman and Greenville Tech student moves.',
    metaTitle: 'Futon Store Near Greenville, SC | Carolina Futons',
    metaDescription: 'Shop futons near Greenville, SC. Carolina Futons carries frames, mattresses, and covers — just 45 miles from Greenville in Hendersonville, NC.',
    featuredProducts: ['futon-frames', 'mattresses', 'accessories'],
    categoryRecommendations: [
      { category: 'futon-frames', label: 'Futon Frames', reason: 'Popular with Greenville student and apartment moves' },
      { category: 'mattresses', label: 'Futon Mattresses', reason: 'Multiple comfort grades — from budget to premium' },
    ],
    faqs: [
      { question: 'How far is Carolina Futons from Greenville, SC?', answer: 'We\'re about 45 miles from Greenville on I-26 East in Hendersonville, NC — roughly a 50-minute drive.' },
      { question: 'Do you deliver futons to Greenville, SC?', answer: 'Yes, we deliver across the Upstate. Delivery fees vary. Call or order online to schedule.' },
      { question: 'Do you carry futon accessories like cup holders and armrests?', answer: 'Yes — we stock a full range of accessories including cup holders, tray tables, and armrests that fit most futon frame styles.' },
      { question: 'What payment methods do you accept?', answer: 'We accept all major credit cards, debit cards, and cash in-store. Financing options are available — ask us for details.' },
    ],
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3293!2d-82.394!3d34.852!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zGreenville+SC!5e0!3m2!1sen!2sus!4v1',
    directions: 'From Greenville SC, take I-26 East to Hendersonville NC — about 45 miles.',
    nearbyAreas: ['spartanburg-sc', 'anderson-sc', 'hendersonville-nc'],
  },
  'spartanburg-sc': {
    slug: 'spartanburg-sc',
    city: 'Spartanburg',
    state: 'SC',
    isHomeCity: false,
    distance: '55 miles',
    headline: 'Futons Near Spartanburg, SC — Carolina Futons',
    heroDescription: 'About 55 miles from Spartanburg, Carolina Futons in Hendersonville, NC carries the Southeast\'s best futon selection. Frame styles from mission oak to sleek metal, mattresses from economy to luxury, and cover fabrics for every décor.',
    neighborhoodContext: 'Spartanburg\'s growing university population — Converse, Wofford, USC Upstate — drives steady demand for affordable, convertible furniture. Our futons are built to move easily and last through multiple leases.',
    metaTitle: 'Futon Store Near Spartanburg, SC | Carolina Futons',
    metaDescription: 'Looking for futons near Spartanburg, SC? Carolina Futons has a full showroom in Hendersonville, NC — about an hour away. Shop futon frames, mattresses, and more.',
    featuredProducts: ['futon-frames', 'mattresses', 'covers'],
    categoryRecommendations: [
      { category: 'futon-frames', label: 'Futon Frames', reason: 'Great for Spartanburg college moves — lightweight and fold-flat options' },
      { category: 'mattresses', label: 'Futon Mattresses', reason: 'Economy to premium grades available — find your comfort level' },
    ],
    faqs: [
      { question: 'How far is Carolina Futons from Spartanburg, SC?', answer: 'We\'re about 55 miles from Spartanburg — take I-26 East toward Hendersonville, NC. About a 60-minute drive.' },
      { question: 'Do you deliver to Spartanburg?', answer: 'Yes, delivery to Spartanburg is available. Fees vary by item and distance. Contact us to schedule.' },
      { question: 'Do you have futons that are easy to move between apartments?', answer: 'Yes — many of our frames disassemble quickly for apartment moves. Ask us which styles are easiest to transport.' },
      { question: 'Can I return or exchange a futon mattress?', answer: 'We offer exchanges within 30 days if the mattress hasn\'t been used without a cover. Call us to discuss your options.' },
    ],
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3293!2d-81.934!3d34.949!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zSpartanburg+SC!5e0!3m2!1sen!2sus!4v1',
    directions: 'From Spartanburg SC, take I-26 East to Hendersonville NC — about 55 miles.',
    nearbyAreas: ['greenville-sc', 'gaffney-sc', 'hendersonville-nc'],
  },
  'boone-nc': {
    slug: 'boone-nc',
    city: 'Boone',
    state: 'NC',
    isHomeCity: false,
    distance: '1.5 hours',
    headline: 'Futons Near Boone, NC — Carolina Futons',
    heroDescription: 'Carolina Futons serves the High Country — including Boone, Blowing Rock, and Banner Elk. Whether you\'re furnishing an App State off-campus apartment or a mountain vacation rental, our futon frames, mattresses, and covers hold up to mountain life.',
    neighborhoodContext: 'Boone\'s altitude and Appalachian State University\'s student population make it a unique market. We see a lot of Boone customers outfitting ski cabin bedrooms and off-campus housing. Our wall-hugger frames are especially popular where space is tight.',
    metaTitle: 'Futon Store Near Boone, NC | Carolina Futons',
    metaDescription: 'Shop futons near Boone, NC. Carolina Futons in Hendersonville carries frames, mattresses, covers, and accessories — family-owned since 1991.',
    featuredProducts: ['futon-frames', 'mattresses', 'pillows'],
    categoryRecommendations: [
      { category: 'futon-frames', label: 'Futon Frames', reason: 'Wall-hugger frames popular for Boone\'s smaller student apartments' },
      { category: 'mattresses', label: 'Futon Mattresses', reason: 'Heavy-duty cotton and foam options for year-round mountain use' },
    ],
    faqs: [
      { question: 'How far is Carolina Futons from Boone, NC?', answer: 'We\'re about 1.5 hours from Boone — take US-321 South to I-40, then I-26 West to Hendersonville.' },
      { question: 'Do you deliver to Boone or the High Country?', answer: 'We can arrange delivery to the High Country for larger orders. Call us for a delivery quote to your specific address.' },
      { question: 'Do you have futons for small mountain cabins?', answer: 'Yes — our wall-hugger frames are designed for tight spaces. They fold back in a single rocking motion and need minimal clearance from the wall.' },
      { question: 'What futon mattress is best for a vacation rental?', answer: 'We recommend our medium-firm innerspring or high-density foam options for rental properties — they hold their shape well under heavy use.' },
    ],
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3293!2d-81.674!3d36.217!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zBoone+NC!5e0!3m2!1sen!2sus!4v1',
    directions: 'From Boone NC, take US-321 South to I-40, then I-26 West to Hendersonville — about 1.5 hours.',
    nearbyAreas: ['blowing-rock-nc', 'lenoir-nc', 'banner-elk-nc'],
  },
};
