// Backend web module for SEO utilities
// Generates structured data, alt text, and meta tags
import { Permissions, webMethod } from 'wix-web-module';
import { getBlogFaqs } from 'backend/blogContent';

const BUSINESS_INFO = {
  name: 'Carolina Futons',
  url: 'https://www.carolinafutons.com',
  logo: 'https://www.carolinafutons.com/logo.png', // Update with actual logo URL
  address: {
    '@type': 'PostalAddress',
    streetAddress: '824 Locust St, Ste 200',
    addressLocality: 'Hendersonville',
    addressRegion: 'NC',
    postalCode: '28792',
    addressCountry: 'US',
  },
  telephone: '+18282529449',
  openingHours: 'We-Sa 10:00-17:00',
  priceRange: '$$',
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 35.3187,
    longitude: -82.4612,
  },
  foundingDate: '1991',
  areaServed: [
    { '@type': 'State', name: 'North Carolina' },
    { '@type': 'State', name: 'South Carolina' },
    { '@type': 'Country', name: 'US' },
  ],
};

// Generate JSON-LD Product schema for a product page
export const getProductSchema = webMethod(
  Permissions.Anyone,
  (product) => {
    if (!product) return null;

    const productUrl = `${BUSINESS_INFO.url}/product-page/${product.slug}`;
    const brand = getBrandName(product);
    const category = getCategoryLabel(product);

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': productUrl,
      name: product.name,
      url: productUrl,
      description: stripHtml(product.description || ''),
      image: buildImageArray(product),
      sku: product.sku || '',
      category: category,
      brand: {
        '@type': 'Brand',
        name: brand,
      },
      offers: {
        '@type': 'Offer',
        '@id': `${productUrl}#offer`,
        url: productUrl,
        priceCurrency: 'USD',
        price: product.discountedPrice || product.price,
        availability: product.inStock !== false
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: {
          '@type': 'Organization',
          name: BUSINESS_INFO.name,
          url: BUSINESS_INFO.url,
        },
        shippingDetails: {
          '@type': 'OfferShippingDetails',
          shippingDestination: {
            '@type': 'DefinedRegion',
            addressCountry: 'US',
          },
          deliveryTime: {
            '@type': 'ShippingDeliveryTime',
            handlingTime: {
              '@type': 'QuantitativeValue',
              minValue: 3,
              maxValue: 5,
              unitCode: 'DAY',
            },
            transitTime: {
              '@type': 'QuantitativeValue',
              minValue: 5,
              maxValue: 14,
              unitCode: 'DAY',
            },
          },
          shippingRate: {
            '@type': 'MonetaryAmount',
            value: product.price >= 999 ? 0 : 49.99,
            currency: 'USD',
          },
        },
        hasMerchantReturnPolicy: {
          '@type': 'MerchantReturnPolicy',
          applicableCountry: 'US',
          returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
          merchantReturnDays: 30,
          returnMethod: 'https://schema.org/ReturnByMail',
        },
      },
    };

    // Add manufacturer part number and product identifiers
    if (product.sku) {
      schema.mpn = product.sku;
    }
    if (product._id) {
      schema.productID = product._id;
    }

    // Add priceValidUntil (required for Google price drop rich results)
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1);
    schema.offers.priceValidUntil = validUntil.toISOString().split('T')[0];

    // Add material if detectable from product data
    const material = detectMaterial(product);
    if (material) {
      schema.material = material;
    }

    // Add color/finish if available
    const finish = product.options?.finish || product.options?.color || '';
    if (finish) {
      schema.color = finish;
    }

    // Add size/dimensions as additional properties
    const size = product.options?.size || '';
    if (size) {
      schema.size = size;
      schema.additionalProperty = [
        {
          '@type': 'PropertyValue',
          name: 'Size',
          value: size,
        },
      ];
    }

    // Add weight if available
    if (product.weight) {
      schema.weight = {
        '@type': 'QuantitativeValue',
        value: product.weight,
        unitCode: 'LBR',
      };
    }

    // Add aggregate rating if available
    if (product.numericRating && product.numericRating > 0) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: product.numericRating,
        bestRating: 5,
        worstRating: 1,
        reviewCount: product.numReviews || 1,
      };
    }

    // Add individual reviews when review data is present
    if (product.reviews && Array.isArray(product.reviews) && product.reviews.length > 0) {
      schema.review = product.reviews.map(r => {
        const review = {
          '@type': 'Review',
          reviewRating: {
            '@type': 'Rating',
            ratingValue: r.rating,
            bestRating: 5,
          },
          author: {
            '@type': 'Person',
            name: r.author || 'Verified Customer',
          },
        };
        if (r.body) review.reviewBody = stripHtml(r.body);
        if (r.date) review.datePublished = r.date;
        return review;
      });
    }

    return JSON.stringify(schema);
  }
);

// Generate JSON-LD LocalBusiness schema for the business
export const getBusinessSchema = webMethod(
  Permissions.Anyone,
  () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FurnitureStore',
      '@id': `${BUSINESS_INFO.url}/#business`,
      name: BUSINESS_INFO.name,
      url: BUSINESS_INFO.url,
      logo: {
        '@type': 'ImageObject',
        url: BUSINESS_INFO.logo,
      },
      image: BUSINESS_INFO.logo,
      address: BUSINESS_INFO.address,
      telephone: BUSINESS_INFO.telephone,
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Wednesday', 'Thursday', 'Friday', 'Saturday'],
          opens: '10:00',
          closes: '17:00',
        },
      ],
      geo: BUSINESS_INFO.geo,
      priceRange: BUSINESS_INFO.priceRange,
      foundingDate: BUSINESS_INFO.foundingDate,
      description: 'The largest selection of quality futon furniture in the Carolinas. Futon frames, mattresses, Murphy cabinet beds, and platform beds. Family-owned in Hendersonville, NC since 1991.',
      areaServed: BUSINESS_INFO.areaServed,
      paymentAccepted: ['Cash', 'Credit Card', 'Debit Card'],
      currenciesAccepted: 'USD',
      hasMap: 'https://maps.google.com/?q=824+Locust+St+Ste+200+Hendersonville+NC+28792',
      sameAs: [
        'https://www.facebook.com/carolinafutons',
        'https://www.instagram.com/carolinafutons',
      ],
      knowsAbout: [
        'Futon Frames',
        'Futon Mattresses',
        'Murphy Cabinet Beds',
        'Platform Beds',
        'Convertible Furniture',
      ],
    };

    return JSON.stringify(schema);
  }
);

// Generate JSON-LD WebSite schema with SearchAction for sitelinks searchbox
export const getWebSiteSchema = webMethod(
  Permissions.Anyone,
  () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${BUSINESS_INFO.url}/#website`,
      name: BUSINESS_INFO.name,
      url: BUSINESS_INFO.url,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${BUSINESS_INFO.url}/search-results?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
      publisher: {
        '@id': `${BUSINESS_INFO.url}/#business`,
      },
    };

    return JSON.stringify(schema);
  }
);

// Generate JSON-LD CollectionPage + ItemList for category pages
export const getCollectionSchema = webMethod(
  Permissions.Anyone,
  (categoryInfo, products) => {
    if (!categoryInfo || !products || products.length === 0) return null;

    const categoryUrl = `${BUSINESS_INFO.url}/${categoryInfo.slug}`;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': categoryUrl,
      name: categoryInfo.title,
      url: categoryUrl,
      description: categoryInfo.description || `Shop ${categoryInfo.title} at Carolina Futons. The largest selection in the Carolinas. Family-owned in Hendersonville, NC since 1991.`,
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BUSINESS_INFO.url },
          { '@type': 'ListItem', position: 2, name: categoryInfo.title, item: categoryUrl },
        ],
      },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: products.length,
        itemListElement: products.slice(0, 30).map((product, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${BUSINESS_INFO.url}/product-page/${product.slug}`,
          name: product.name,
          image: product.mainMedia || '',
        })),
      },
    };

    return JSON.stringify(schema);
  }
);

// Generate JSON-LD BreadcrumbList for navigation
export const getBreadcrumbSchema = webMethod(
  Permissions.Anyone,
  (breadcrumbs) => {
    if (!breadcrumbs || breadcrumbs.length === 0) return null;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, index) => {
        const item = {
          '@type': 'ListItem',
          position: index + 1,
          name: crumb.name,
        };
        // Last breadcrumb item should not have a URL per Google guidelines
        if (crumb.url && index < breadcrumbs.length - 1) {
          item.item = `${BUSINESS_INFO.url}${crumb.url}`;
        }
        return item;
      }),
    };

    return JSON.stringify(schema);
  }
);

// Generate JSON-LD FAQPage schema
export const getFaqSchema = webMethod(
  Permissions.Anyone,
  (faqs) => {
    if (!faqs || faqs.length === 0) return null;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };

    return JSON.stringify(schema);
  }
);

// Generate product-specific FAQ schema for product pages
// Creates category-relevant Q&A pairs for SEO structured data
export const getProductFaqSchema = webMethod(
  Permissions.Anyone,
  (product) => {
    if (!product) return null;

    const category = getCategoryLabel(product);
    const brand = getBrandName(product);
    const faqs = [];

    // Return policy — universal
    faqs.push({
      question: `What is the return policy for the ${product.name}?`,
      answer: 'Carolina Futons offers a 30-day return policy on unused items in original packaging. Contact us at (828) 252-9449 for return authorization.',
    });

    // Free shipping — universal
    faqs.push({
      question: `Does the ${product.name} qualify for free shipping?`,
      answer: product.price >= 999
        ? `Yes! The ${product.name} qualifies for free standard shipping within the continental US.`
        : `Free standard shipping is available on orders $999+. The ${product.name} is priced at ${product.formattedPrice || '$' + product.price}.`,
    });

    // Category-specific questions
    if (category.includes('Futon Frame') || category.includes('Wall Hugger')) {
      faqs.push({
        question: `What mattress sizes fit the ${product.name}?`,
        answer: `The ${product.name} accommodates standard futon mattresses. Check the product dimensions for exact size compatibility. Most of our futon frames accept Full and Queen size mattresses.`,
      });
      faqs.push({
        question: `Is assembly required for the ${product.name}?`,
        answer: `Yes, some assembly is required. The ${product.name}${brand ? ` by ${brand}` : ''} comes with detailed assembly instructions. Most customers complete assembly in 30-60 minutes.`,
      });
    }

    if (category.includes('Murphy')) {
      faqs.push({
        question: `Does the ${product.name} need to be mounted to a wall?`,
        answer: 'No! Our Murphy cabinet beds are freestanding and do not require wall mounting. They can be placed anywhere in your room and set up in under 2 minutes.',
      });
      faqs.push({
        question: `What size mattress comes with the ${product.name}?`,
        answer: 'Our Murphy cabinet beds include a premium Queen-size gel memory foam mattress. No additional mattress purchase is needed.',
      });
    }

    if (category.includes('Mattress')) {
      faqs.push({
        question: `How long will the ${product.name} last?`,
        answer: 'Our futon mattresses are built to last 10-15 years with proper care. They feature no-turn design and high-density construction for lasting comfort.',
      });
      faqs.push({
        question: `Is the ${product.name} hypoallergenic?`,
        answer: 'Yes, our Otis Bed mattresses are hypoallergenic and made with CertiPUR-US certified foam, free from harmful chemicals.',
      });
    }

    if (category.includes('Platform')) {
      faqs.push({
        question: `Does the ${product.name} require a box spring?`,
        answer: 'No box spring needed! Platform beds provide full mattress support with built-in slats. They work great with memory foam, latex, and hybrid mattresses.',
      });
    }

    if (category.includes('Bedroom Furniture')) {
      faqs.push({
        question: `Does the ${product.name} match other Night & Day Furniture pieces?`,
        answer: 'Yes! Our casegoods and accessories are designed to coordinate with Night & Day Furniture bed frames in matching finishes.',
      });
    }

    // Delivery — universal
    faqs.push({
      question: `How long does delivery take for the ${product.name}?`,
      answer: 'Standard delivery takes 5-14 business days within the continental US. White-glove delivery is available for local ($149) and regional ($249) customers, or free on orders over $1,999.',
    });

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };

    return JSON.stringify(schema);
  }
);

// Generate smart, keyword-rich alt text for product images
export const generateAltText = webMethod(
  Permissions.Anyone,
  (product, imageType = 'main') => {
    if (!product) return '';

    const brand = getBrandName(product);
    const category = getCategoryLabel(product);
    const material = detectMaterial(product);
    const finish = product.options?.finish || product.options?.color || '';
    const size = product.options?.size || '';

    // Main product image - keyword-rich, descriptive
    if (imageType === 'main') {
      const parts = [product.name];
      if (brand && brand !== product.name) parts.push(`by ${brand}`);
      if (material) parts.push(`${material}`);
      if (finish) parts.push(`in ${finish}`);
      if (size) parts.push(`${size} size`);
      parts.push(category);
      parts.push('- Carolina Futons, Hendersonville NC');
      return truncateAlt(parts.join(' '));
    }

    // Lifestyle/room context image
    if (imageType === 'lifestyle') {
      return truncateAlt(`${product.name} ${category.toLowerCase()} styled in a living room setting - shop at Carolina Futons`);
    }

    // Detail/closeup image
    if (imageType === 'detail') {
      const finishText = finish ? `${finish} finish` : 'construction';
      return truncateAlt(`Close-up of ${product.name} ${finishText} detail${brand ? ` by ${brand}` : ''}`);
    }

    // Open/bed position (for futons and murphy beds)
    if (imageType === 'open') {
      return truncateAlt(`${product.name} in open bed position${size ? ` ${size}` : ''}${brand ? ` by ${brand}` : ''} - convertible furniture`);
    }

    // Folded/sofa position
    if (imageType === 'sofa') {
      return truncateAlt(`${product.name} in upright sofa position${finish ? ` ${finish}` : ''} - ${category}`);
    }

    // Gallery/additional angle
    if (imageType === 'gallery') {
      return truncateAlt(`${product.name} ${category.toLowerCase()} additional view - ${brand || 'Carolina Futons'}`);
    }

    // Thumbnail in product grid
    if (imageType === 'grid') {
      const parts = [product.name];
      if (brand) parts.push(brand);
      parts.push(category);
      parts.push('Carolina Futons');
      return truncateAlt(parts.join(' - '));
    }

    return truncateAlt(`${product.name} ${category.toLowerCase()} - Carolina Futons Hendersonville NC`);
  }
);

// Generate category-specific meta description
export const getCategoryMetaDescription = webMethod(
  Permissions.Anyone,
  (categorySlug) => {
    const descriptions = {
      'futon-frames': 'Shop quality futon frames from Night & Day Furniture, Strata wall huggers, and KD Frames. Full and Queen sizes with solid hardwood construction. Free shipping over $999. Visit our Hendersonville, NC showroom.',
      'mattresses': 'Premium futon mattresses by Otis Bed - hypoallergenic, CertiPUR-US certified foam. No turning required, 10-15 year lifespan. Free shipping over $999. Carolina Futons, Hendersonville NC.',
      'murphy-cabinet-beds': 'Freestanding Murphy cabinet beds by Night & Day Furniture. No wall mounting needed - sets up in under 2 minutes. Space-saving bedroom furniture. Free shipping over $999.',
      'platform-beds': 'Solid wood platform beds from Night & Day Furniture and KD Frames. Designed for memory foam and latex mattresses. American-made options available. Free shipping over $999.',
      'casegoods-accessories': 'Matching bedroom furniture and accessories by Night & Day Furniture. Nightstands, dressers, and storage to complete your bedroom set. Free shipping over $999.',
      'wall-huggers': 'Wall hugger futon frames by Strata Furniture. Patented space-saving design sits close to your wall. Perfect for small rooms and apartments. Free shipping over $999.',
      'unfinished-wood': 'Unfinished wood futon frames by KD Frames. Made in USA from Tulip Poplar hardwood. Ready for your personal stain or paint finish. Free shipping over $999.',
      'sales': 'Current deals and clearance on quality futon furniture. Save on frames, mattresses, Murphy beds, and more. Carolina Futons, Hendersonville NC.',
    };
    return descriptions[categorySlug] || 'The largest selection of quality futon furniture in the Carolinas. Futon frames, mattresses, Murphy cabinet beds, and platform beds. Family-owned in Hendersonville, NC since 1991.';
  }
);

// Helper: determine brand from product data
function getBrandName(product) {
  if (!product || !product.collections) return '';

  const collections = Array.isArray(product.collections)
    ? product.collections
    : [product.collections];

  if (collections.some(c => c.includes('wall-hugger'))) return 'Strata Furniture';
  if (collections.some(c => c.includes('unfinished'))) return 'KD Frames';
  if (collections.some(c => c.includes('otis') || c.includes('mattress'))) return 'Otis Bed';
  if (collections.some(c => c.includes('arizona'))) return 'Arizona';
  return 'Night & Day Furniture';
}

// Helper: get human-readable category label
function getCategoryLabel(product) {
  if (!product || !product.collections) return 'Furniture';

  const collections = Array.isArray(product.collections)
    ? product.collections
    : [product.collections];

  if (collections.some(c => c.includes('murphy'))) return 'Murphy Cabinet Bed';
  if (collections.some(c => c.includes('platform'))) return 'Platform Bed';
  if (collections.some(c => c.includes('mattress'))) return 'Futon Mattress';
  if (collections.some(c => c.includes('wall-hugger'))) return 'Wall Hugger Futon Frame';
  if (collections.some(c => c.includes('futon') || c.includes('frame'))) return 'Futon Frame';
  if (collections.some(c => c.includes('casegood') || c.includes('accessor'))) return 'Bedroom Furniture';
  return 'Furniture';
}

// Helper: detect material from product data or collections
function detectMaterial(product) {
  if (!product) return '';

  // Check product name or description for material keywords
  const text = `${product.name || ''} ${product.description || ''}`.toLowerCase();

  if (text.includes('solid wood') || text.includes('hardwood')) return 'solid hardwood';
  if (text.includes('tulip poplar') || text.includes('poplar')) return 'Tulip Poplar wood';
  if (text.includes('rubberwood')) return 'rubberwood';
  if (text.includes('parawood')) return 'parawood';
  if (text.includes('memory foam')) return 'memory foam';
  if (text.includes('latex')) return 'latex foam';
  if (text.includes('foam')) return 'high-density foam';
  if (text.includes('metal') || text.includes('steel')) return 'steel';
  if (text.includes('log') || text.includes('rustic')) return 'natural log wood';

  // Infer from brand/collection
  const collections = Array.isArray(product.collections) ? product.collections : [product.collections || ''];
  if (collections.some(c => c.includes('unfinished'))) return 'unfinished Tulip Poplar';
  if (collections.some(c => c.includes('otis'))) return 'CertiPUR-US certified foam';

  return '';
}

// Helper: build image array from product media
function buildImageArray(product) {
  if (!product) return [];

  const images = [];
  if (product.mainMedia) images.push(product.mainMedia);

  if (product.mediaItems && Array.isArray(product.mediaItems)) {
    product.mediaItems.forEach(item => {
      if (item.src && !images.includes(item.src)) {
        images.push(item.src);
      }
    });
  }

  return images.length > 0 ? images : (product.mainMedia ? [product.mainMedia] : []);
}

// Helper: strip HTML tags from text
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

// Helper: truncate alt text to 125 chars for accessibility
function truncateAlt(text) {
  if (text.length <= 125) return text;
  return text.substring(0, 122) + '...';
}

// ── Open Graph & Twitter Card Meta ──────────────────────────────────
// Returns JSON string of OG/Twitter meta tags for injection via head.js or HtmlComponent

/**
 * Generate Open Graph and Twitter Card meta tags for a product page.
 * @param {Object} product - Wix product object
 * @returns {string} HTML meta tag string for injection
 */
export const getProductOgTags = webMethod(
  Permissions.Anyone,
  (product) => {
    if (!product) return '';

    const title = `${product.name} | Carolina Futons`;
    const description = product.description
      ? stripHtml(product.description).substring(0, 200)
      : `Shop ${product.name} at Carolina Futons. Quality furniture since 1991.`;
    const image = product.mainMedia || '';
    const url = `https://www.carolinafutons.com/product-page/${product.slug || ''}`;
    const price = product.price || 0;

    return JSON.stringify({
      'og:type': 'product',
      'og:title': title,
      'og:description': description,
      'og:image': image,
      'og:url': url,
      'og:site_name': 'Carolina Futons',
      'og:locale': 'en_US',
      'product:price:amount': String(price),
      'product:price:currency': 'USD',
      'product:availability': product.inStock !== false ? 'in stock' : 'out of stock',
      'twitter:card': 'summary_large_image',
      'twitter:title': title,
      'twitter:description': description,
      'twitter:image': image,
    });
  }
);

/**
 * Generate Open Graph meta tags for a category page.
 * @param {string} categorySlug - Category URL slug
 * @returns {string} JSON string of OG meta tags
 */
export const getCategoryOgTags = webMethod(
  Permissions.Anyone,
  (categorySlug) => {
    const titles = {
      'futon-frames': 'Futon Frames',
      'mattresses': 'Futon Mattresses',
      'murphy-cabinet-beds': 'Murphy Cabinet Beds',
      'platform-beds': 'Platform Beds',
      'casegoods-accessories': 'Casegoods & Accessories',
      'wall-huggers': 'Wall Hugger Frames',
      'unfinished-wood': 'Unfinished Wood Furniture',
      'sales': 'Sale & Clearance',
    };

    const title = `${titles[categorySlug] || 'Shop'} | Carolina Futons`;
    const description = getCategoryMetaDescriptionSync(categorySlug);
    const url = `https://www.carolinafutons.com/${categorySlug}`;

    return JSON.stringify({
      'og:type': 'website',
      'og:title': title,
      'og:description': description,
      'og:url': url,
      'og:site_name': 'Carolina Futons',
      'og:locale': 'en_US',
      'twitter:card': 'summary',
      'twitter:title': title,
      'twitter:description': description,
    });
  }
);

// Sync version of getCategoryMetaDescription for internal use
function getCategoryMetaDescriptionSync(slug) {
  const descriptions = {
    'futon-frames': 'Shop quality futon frames from Night & Day Furniture, Strata wall huggers, and KD Frames. Free shipping over $999.',
    'mattresses': 'Premium futon mattresses by Otis Bed - hypoallergenic, CertiPUR-US certified foam. Free shipping over $999.',
    'murphy-cabinet-beds': 'Freestanding Murphy cabinet beds by Night & Day Furniture. No wall mounting needed. Free shipping over $999.',
    'platform-beds': 'Solid wood platform beds from Night & Day Furniture and KD Frames. Free shipping over $999.',
    'casegoods-accessories': 'Matching bedroom furniture and accessories by Night & Day Furniture. Free shipping over $999.',
    'wall-huggers': 'Wall hugger futon frames by Strata Furniture. Patented space-saving design. Free shipping over $999.',
    'unfinished-wood': 'Unfinished wood futon frames by KD Frames. Made in USA. Free shipping over $999.',
    'sales': 'Current deals and clearance on quality futon furniture at Carolina Futons.',
  };
  return descriptions[slug] || 'Quality futon furniture since 1991. Carolina Futons, Hendersonville NC.';
}

// ══════════════════════════════════════════════════════════════════════
// Open Graph, Pinterest Rich Pin, and Twitter Card Meta Tags
// Inject these via $w('#html1').postMessage() from page files
// ══════════════════════════════════════════════════════════════════════

/**
 * Generate Open Graph + Pinterest + Twitter meta tags for a product page.
 * Returns HTML string for injection into HtmlComponent on the page.
 *
 * @function getProductMetaTags
 * @param {Object} product - Wix product object
 * @returns {Promise<string>} HTML meta tags string
 * @permission Anyone
 */
export const getProductMetaTags = webMethod(
  Permissions.Anyone,
  async (product) => {
    if (!product) return '';

    const url = `${BUSINESS_INFO.url}/product-page/${product.slug || ''}`;
    const title = `${product.name || 'Product'} | Carolina Futons`;
    const description = (product.description || '').replace(/<[^>]*>/g, '').substring(0, 200);
    const image = product.mainMedia || BUSINESS_INFO.logo;
    const price = (product.price || 0).toFixed(2);
    const availability = product.inStock !== false ? 'instock' : 'oos';

    const tags = [
      // Open Graph (Facebook/Instagram)
      `<meta property="og:type" content="product" />`,
      `<meta property="og:title" content="${escapeAttr(title)}" />`,
      `<meta property="og:description" content="${escapeAttr(description)}" />`,
      `<meta property="og:url" content="${escapeAttr(url)}" />`,
      `<meta property="og:image" content="${escapeAttr(image)}" />`,
      `<meta property="og:site_name" content="Carolina Futons" />`,
      `<meta property="product:price:amount" content="${price}" />`,
      `<meta property="product:price:currency" content="USD" />`,
      `<meta property="product:availability" content="${availability}" />`,
      `<meta property="product:brand" content="Carolina Futons" />`,

      // Twitter Card
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
      `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
      `<meta name="twitter:image" content="${escapeAttr(image)}" />`,

      // Pinterest Rich Pin (uses product: namespace, same as OG product tags above)
    ];

    return tags.join('\n');
  }
);

/**
 * Generate Open Graph meta tags for a category/collection page.
 *
 * @function getCategoryMetaTags
 * @param {string} categorySlug - Category URL slug
 * @param {string} categoryName - Category display name
 * @param {string} [imageUrl] - Category hero image URL
 * @returns {Promise<string>} HTML meta tags string
 * @permission Anyone
 */
export const getCategoryMetaTags = webMethod(
  Permissions.Anyone,
  async (categorySlug, categoryName, imageUrl) => {
    const url = `${BUSINESS_INFO.url}/${categorySlug || ''}`;
    const title = `${categoryName || 'Shop'} | Carolina Futons`;
    const description = getCategoryMetaDescriptionSync(categorySlug);
    const image = imageUrl || BUSINESS_INFO.logo;

    const tags = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:title" content="${escapeAttr(title)}" />`,
      `<meta property="og:description" content="${escapeAttr(description)}" />`,
      `<meta property="og:url" content="${escapeAttr(url)}" />`,
      `<meta property="og:image" content="${escapeAttr(image)}" />`,
      `<meta property="og:site_name" content="Carolina Futons" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
      `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
      `<meta name="twitter:image" content="${escapeAttr(image)}" />`,
    ];

    return tags.join('\n');
  }
);

// Generate Article JSON-LD schema for blog posts
export const getBlogArticleSchema = webMethod(
  Permissions.Anyone,
  (post) => {
    if (!post || !post.title) return null;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.metaDescription || post.excerpt || '',
      author: {
        '@type': 'Organization',
        name: BUSINESS_INFO.name,
        url: BUSINESS_INFO.url,
      },
      publisher: {
        '@type': 'Organization',
        name: BUSINESS_INFO.name,
        logo: {
          '@type': 'ImageObject',
          url: BUSINESS_INFO.logo,
        },
      },
      datePublished: post.publishDate || new Date().toISOString().split('T')[0],
      dateModified: post.modifiedDate || post.publishDate || new Date().toISOString().split('T')[0],
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${BUSINESS_INFO.url}/blog/${post.slug}`,
      },
    };

    if (post.coverImage) {
      schema.image = post.coverImage;
    }

    if (post.keywords && post.keywords.length > 0) {
      schema.keywords = post.keywords.join(', ');
    }

    return JSON.stringify(schema);
  }
);

// Generate FAQ schema for a blog post using blogContent data
export const getBlogFaqSchema = webMethod(
  Permissions.Anyone,
  (slug) => {
    const faqs = getBlogFaqs(slug);
    if (!faqs || faqs.length === 0) return null;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };

    return JSON.stringify(schema);
  }
);

function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Page Title Generation ───────────────────────────────────────────

const SITE_NAME = 'Carolina Futons';
const BASE_URL = 'https://www.carolinafutons.com';

const CATEGORY_TITLES = {
  'futon-frames': 'Futon Frames — Night & Day, Strata, KD Frames',
  'mattresses': 'Futon Mattresses — Otis Bed CertiPUR-US Certified',
  'murphy-cabinet-beds': 'Murphy Cabinet Beds — No Wall Mount Needed',
  'platform-beds': 'Platform Beds — Solid Wood Bed Frames',
  'casegoods-accessories': 'Casegoods & Bedroom Accessories',
  'wall-huggers': 'Wall Hugger Futon Frames — Strata Furniture',
  'unfinished-wood': 'Unfinished Wood Furniture — Made in USA',
  'sales': 'Sale & Clearance — Furniture Deals',
};

/**
 * Generate an SEO page title for a given page type.
 * @param {string} pageType - 'product', 'category', 'home', 'blog', 'blogPost', 'faq', 'contact', 'about'
 * @param {Object} [data] - Page-specific data (product, category slug, post title, etc.)
 * @returns {string} Title tag content
 */
export const getPageTitle = webMethod(
  Permissions.Anyone,
  (pageType, data = {}) => {
    switch (pageType) {
      case 'product':
        return data.name ? `${data.name} | ${SITE_NAME}` : SITE_NAME;
      case 'category':
        return `${CATEGORY_TITLES[data.slug] || 'Shop'} | ${SITE_NAME}`;
      case 'home':
        return `${SITE_NAME} — Handcrafted Futons, Murphy Beds & Platform Beds | Hendersonville NC`;
      case 'blog':
        return `Blog — Furniture Tips & Style Inspiration | ${SITE_NAME}`;
      case 'blogPost':
        return data.title ? `${data.title} | ${SITE_NAME} Blog` : `Blog | ${SITE_NAME}`;
      case 'faq':
        return `Frequently Asked Questions | ${SITE_NAME}`;
      case 'contact':
        return `Contact Us — Visit Our Hendersonville NC Showroom | ${SITE_NAME}`;
      case 'about':
        return `About Us — Family-Owned Since 1991 | ${SITE_NAME}`;
      default:
        return SITE_NAME;
    }
  }
);

// ── Canonical URL Generation ────────────────────────────────────────

/**
 * Generate canonical URL for a page to prevent duplicate content.
 * @param {string} pageType - 'product', 'category', 'home', 'blog', 'blogPost', 'faq', 'contact', 'about'
 * @param {string} [slug] - URL slug for dynamic pages
 * @returns {string} Canonical URL
 */
export const getCanonicalUrl = webMethod(
  Permissions.Anyone,
  (pageType, slug = '') => {
    switch (pageType) {
      case 'product':
        return `${BASE_URL}/product-page/${slug}`;
      case 'category':
        return `${BASE_URL}/${slug}`;
      case 'home':
        return BASE_URL;
      case 'blog':
        return `${BASE_URL}/blog`;
      case 'blogPost':
        return `${BASE_URL}/post/${slug}`;
      case 'faq':
        return `${BASE_URL}/faq`;
      case 'contact':
        return `${BASE_URL}/contact`;
      case 'about':
        return `${BASE_URL}/about`;
      default:
        return BASE_URL;
    }
  }
);

// ── Meta Description Generation ─────────────────────────────────────

const PAGE_META_DESCRIPTIONS = {
  home: 'Carolina Futons — the largest selection of quality futon furniture in the Carolinas. Futon frames, mattresses, Murphy cabinet beds, and platform beds. Family-owned in Hendersonville, NC since 1991. Free shipping on orders over $999.',
  faq: 'Frequently asked questions about futons, Murphy beds, mattress care, shipping, and visiting our Hendersonville NC showroom. Get answers from Carolina Futons.',
  contact: 'Contact Carolina Futons in Hendersonville, NC. Visit our showroom Wednesday–Saturday 10 AM–5 PM. Call (828) 252-9449 or book an appointment online.',
  about: 'Carolina Futons has served Western NC since 1991. Family-owned furniture store specializing in quality futon frames, mattresses, Murphy beds, and platform beds in Hendersonville, NC.',
  blog: 'Furniture tips, style inspiration, and product guides from Carolina Futons. Learn about futon care, room design ideas, and choosing the perfect furniture.',
};

/**
 * Generate meta description for a page.
 * @param {string} pageType - Page type
 * @param {Object} [data] - Page-specific data
 * @returns {string} Meta description (max 160 chars for static, dynamic for products)
 */
export const getPageMetaDescription = webMethod(
  Permissions.Anyone,
  (pageType, data = {}) => {
    switch (pageType) {
      case 'product':
        if (data.description) {
          return stripHtml(data.description).substring(0, 155) + '...';
        }
        return `Shop ${data.name || 'quality furniture'} at Carolina Futons. Free shipping on orders over $999. Visit our Hendersonville, NC showroom.`;
      case 'category':
        return getCategoryMetaDescriptionSync(data.slug);
      case 'blogPost':
        return data.excerpt
          ? stripHtml(data.excerpt).substring(0, 155) + '...'
          : `Read ${data.title || 'this article'} on the Carolina Futons blog.`;
      default:
        return PAGE_META_DESCRIPTIONS[pageType] || PAGE_META_DESCRIPTIONS.home;
    }
  }
);
