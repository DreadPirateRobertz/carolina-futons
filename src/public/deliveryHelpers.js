/**
 * deliveryHelpers.js — Content data for the Getting It Home page.
 * Service tiers, delivery rates, and assembly info for Carolina Futons.
 */

const SERVICE_TIERS = [
  {
    _id: 'diy',
    title: 'Do It Yourself',
    price: 'Free',
    description: 'Are you an "I can do it myself" kind of person? Then you\'ll save the most by taking your purchase home and assembling it yourself with included box instructions or viewing the instructional videos online, available on our FAQ page. Most futon frames are simple to build and will fit in a small SUV or truck. You can also pick up your mattress in its original box or we can unbox for you to carry out (tied up vertically and wrapped in plastic). We will help you carry out and load your purchases into your vehicle.',
    icon: 'wrench',
  },
  {
    _id: 'dropoff',
    title: 'Home Drop Off',
    price: 'Delivery rate',
    description: 'If you want to assemble your purchase yourself but don\'t have a suitable vehicle for transporting, we can deliver your items to your home. We can also deliver your mattress and take away your old mattress for a $10 landfill fee. Delivery rates are based on mileage from our store.',
    icon: 'truck',
  },
  {
    _id: 'instore',
    title: 'In-Store Assembly',
    price: '$40.00',
    description: 'Another option is to have us assemble your frame in our store for you to pick up and take home. You can also pick up your mattress in its original box or we can unbox for you to carry out (tied up vertically and wrapped in plastic). We will help you carry out and load your purchases into your vehicle. A full-sized pickup truck or van is recommended for transporting an assembled frame and/or mattress. Our fee for this service is $40.00, with a 24-hour notice required.',
    icon: 'build',
  },
  {
    _id: 'whiteglove',
    title: 'Premium White Glove Service',
    price: '$60.00 + delivery',
    description: 'A final option is to have us assemble/set up your frame in your home by our professional, courteous delivery personnel to your room of choice. This includes applying Grip Strips to your frame, putting your mattress protector and/or cover on your mattress, reviewing and demonstrating converting your frame or cabinet, final performance inspections, and removing all packaging and clean up area. Our fee for this service is $60.00, plus delivery rate based on the mileage from our store to your home.',
    icon: 'star',
  },
];

const INTRO_TEXT = 'At Carolina Futons, we don\'t add the cost of assembly and delivery into our prices, which means that you don\'t pay for services you don\'t need. Instead, we offer service levels to meet your individual needs. All of our frames come with a pack of Grip Strips to keep your mattress in place, at no additional charge. We\'ll also be here to answer any questions you might have after you take your purchase home regarding assembly and/or mechanics of your frame.';

const DELIVERY_RATES = {
  minimumCharge: '$25.00',
  minimumRadius: '10-mile',
  note: 'Contact us for rates or input your zip code when adding items to your cart for pricing.',
};

/**
 * Get the intro paragraph text for the Getting It Home page.
 * @returns {string}
 */
export function getIntroText() {
  return INTRO_TEXT;
}

/**
 * Get all service tiers with IDs, titles, prices, and descriptions.
 * @returns {Array<{_id: string, title: string, price: string, description: string, icon: string}>}
 */
export function getServiceTiers() {
  return SERVICE_TIERS;
}

/**
 * Get delivery rate information.
 * @returns {{minimumCharge: string, minimumRadius: string, note: string}}
 */
export function getDeliveryRates() {
  return DELIVERY_RATES;
}

// ── Assembly Guides ─────────────────────────────────────────────────

const ASSEMBLY_GUIDES = [
  {
    _id: 'futon-frame',
    title: 'Futon Frame Assembly',
    time: '20–30 min',
    tools: 'Allen wrench (included), rubber mallet',
    steps: '1. Lay out all parts and hardware. 2. Attach the side rails to the rear frame using the provided bolts. 3. Insert the deck slats across the frame. 4. Attach the arm covers and click them into place. 5. Test the bi-fold mechanism — it should fold and flatten smoothly.',
  },
  {
    _id: 'platform-bed',
    title: 'Platform Bed Assembly',
    time: '30–45 min',
    tools: 'Allen wrench (included), Phillips screwdriver',
    steps: '1. Attach the headboard brackets to the headboard. 2. Connect the side rails to the headboard and footboard. 3. Lay the center support slats across the rails. 4. Tighten all bolts — do not over-torque. 5. Place mattress and verify no rocking.',
  },
  {
    _id: 'bunk-loft',
    title: 'Bunk / Loft Bed Assembly',
    time: '45–60 min',
    tools: 'Allen wrench (included), Phillips screwdriver, level',
    steps: '1. Build the lower bunk first — connect rails, headboard, and footboard. 2. Attach the upper-bunk posts to the lower frame. 3. Install the upper guardrails before lifting the upper deck. 4. Install the ladder on the preferred side. 5. Check that all bolts are finger-tight before fully tightening.',
  },
];

/**
 * Get all assembly guides.
 * @returns {Array<{_id, title, time, tools, steps}>}
 */
export function getAssemblyGuides() {
  return ASSEMBLY_GUIDES;
}

// ── Care Tips ───────────────────────────────────────────────────────

const CARE_TIPS = [
  {
    _id: 'frame-bolts',
    category: 'frame',
    title: 'Tighten Hardware Periodically',
    content: 'Check and re-tighten all bolts and connections every 3–6 months. Normal use causes slight loosening over time. Use the included Allen wrench.',
  },
  {
    _id: 'frame-mechanism',
    category: 'frame',
    title: 'Lubricate the Mechanism',
    content: 'Apply a light spray of WD-40 or silicone lubricant to the bi-fold pivot points once a year — more often if the fold feels stiff or squeaky.',
  },
  {
    _id: 'mattress-rotate',
    category: 'mattress',
    title: 'Rotate Your Mattress',
    content: "Rotate your futon mattress 180° every 3 months to prevent body impressions and extend its life. Some mattresses can also be flipped — check your model's care tag.",
  },
  {
    _id: 'mattress-protector',
    category: 'mattress',
    title: 'Use a Mattress Protector',
    content: 'A washable mattress protector guards against spills, allergens, and skin oils that break down foam and fiber over time. Machine wash monthly.',
  },
  {
    _id: 'cover-washing',
    category: 'cover',
    title: 'Washing Your Cover',
    content: 'Most futon covers are machine-washable in cold water on a gentle cycle. Air-dry or tumble-dry on low. Never use bleach — it weakens the fabric weave.',
  },
  {
    _id: 'cover-sunfading',
    category: 'cover',
    title: 'Prevent Sun Fading',
    content: 'Direct sunlight fades fabric colors over time. Position your futon away from windows that get prolonged direct sun, or use UV-blocking window film.',
  },
];

const CARE_CATEGORIES = [
  { id: 'all', label: 'All Tips' },
  { id: 'frame', label: 'Frame' },
  { id: 'mattress', label: 'Mattress' },
  { id: 'cover', label: 'Cover' },
];

/**
 * Get all care tips, optionally filtered by category.
 * @param {string|null} category
 * @returns {Array<{_id, category, title, content}>}
 */
export function getCareTips(category) {
  if (!category || category === 'all') return CARE_TIPS;
  return CARE_TIPS.filter(t => t.category === category);
}

/**
 * Get care tip dropdown options.
 * @returns {Array<{id, label}>}
 */
export function getCareTipCategories() {
  return CARE_CATEGORIES;
}

// ── Delivery Prep Instructions ──────────────────────────────────────

const DELIVERY_PREP = {
  diy: 'Measure your doorways, hallways, and stairwells before pickup. Most futon frames ship flat-packed and fit through a standard 30" door when unassembled. Bring a friend — even flat-packed frames can be awkward solo. Check our FAQ for assembly video links.',
  dropoff: 'Clear a path from your front door to the room where the furniture will go — remove rugs, shoe racks, and fragile items from hallways. Let us know about any narrow doorways (under 32") or stairwells in advance so we can bring the right equipment.',
  instore: 'No prep needed at home — we\'ll assemble in the store. Once assembled, measure your vehicle or arrange a truck rental. A full-size assembled futon frame typically requires a 6-foot truck bed. Call us before pickup to confirm dimensions.',
  whiteglove: 'Clear the room where the furniture will go — move out smaller items and make 3–4 feet of working space. Identify any stair handrails that could block large pieces. Note any parking restrictions for our delivery van. We\'ll handle the rest.',
};

/**
 * Get delivery prep instructions for a service tier.
 * @param {string} tierId - 'diy' | 'dropoff' | 'instore' | 'whiteglove'
 * @returns {string}
 */
export function getDeliveryPrepInstructions(tierId) {
  return DELIVERY_PREP[tierId] ?? 'Select a service tier above to see your delivery preparation checklist.';
}

/**
 * Get dropdown options for the delivery tier selector.
 * @returns {Array<{id, label}>}
 */
export function getDeliveryTierOptions() {
  return [
    { id: 'diy', label: 'Do It Yourself (Pickup)' },
    { id: 'dropoff', label: 'Home Drop Off' },
    { id: 'instore', label: 'In-Store Assembly + Pickup' },
    { id: 'whiteglove', label: 'Premium White Glove Service' },
  ];
}

// ── Shipping Schema JSON-LD ─────────────────────────────────────────

/**
 * Build schema.org OfferShippingDetails JSON-LD for the page.
 * Returns a <script> tag string ready for injection into an HTML element.
 * @returns {string}
 */
export function buildShippingSchemaHtml() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'USD' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 5, maxValue: 7, unitCode: 'DAY' },
        },
        name: 'Standard Shipping — Free on orders $500+',
      },
      {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: '75', currency: 'USD' },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'US',
          addressRegion: 'NC',
          description: 'Local zone — within 25 miles of Hendersonville, NC',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
        },
        name: 'Local Delivery — In-home placement',
      },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}
