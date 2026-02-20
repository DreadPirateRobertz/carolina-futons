// Backend web module for SEO utilities
// Generates structured data, alt text, and meta tags
import { Permissions, webMethod } from 'wix-web-module';

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
};

// Generate JSON-LD Product schema for a product page
export const getProductSchema = webMethod(
  Permissions.Anyone,
  (product) => {
    if (!product) return null;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description || '',
      image: product.mainMedia || '',
      sku: product.sku || '',
      brand: {
        '@type': 'Brand',
        name: getBrandName(product),
      },
      offers: {
        '@type': 'Offer',
        url: `${BUSINESS_INFO.url}/product-page/${product.slug}`,
        priceCurrency: 'USD',
        price: product.discountedPrice || product.price,
        availability: product.inStock !== false
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: {
          '@type': 'Organization',
          name: BUSINESS_INFO.name,
        },
      },
    };

    // Add aggregate rating if available
    if (product.numericRating && product.numericRating > 0) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: product.numericRating,
        reviewCount: product.numReviews || 1,
      };
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
      name: BUSINESS_INFO.name,
      url: BUSINESS_INFO.url,
      logo: BUSINESS_INFO.logo,
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
      description: 'The largest selection of quality futon furniture in the Carolinas. Futon frames, mattresses, Murphy cabinet beds, and platform beds. Family-owned in Hendersonville, NC since 1991.',
      sameAs: [
        // Add social media URLs when available
      ],
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
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url ? `${BUSINESS_INFO.url}${crumb.url}` : undefined,
      })),
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

// Generate smart alt text for product images
export const generateAltText = webMethod(
  Permissions.Anyone,
  (product, imageType = 'main') => {
    if (!product) return '';

    const brand = getBrandName(product);
    const category = getCategoryLabel(product);
    const finish = product.options?.finish || '';
    const size = product.options?.size || '';

    // Main product image
    if (imageType === 'main') {
      let alt = product.name;
      if (brand) alt += ` by ${brand}`;
      if (finish) alt += ` in ${finish} finish`;
      if (size) alt += `, ${size} size`;
      alt += ` - ${category}`;
      alt += ' | Carolina Futons, Hendersonville NC';
      return alt;
    }

    // Lifestyle/room context image
    if (imageType === 'lifestyle') {
      return `${product.name} ${category.toLowerCase()} styled in a modern living space - Carolina Futons`;
    }

    // Detail/closeup image
    if (imageType === 'detail') {
      return `Close-up detail of ${product.name} ${finish ? `${finish} finish` : ''} craftsmanship - ${brand}`;
    }

    // Open/bed position (for futons and murphy beds)
    if (imageType === 'open') {
      return `${product.name} shown in open bed position${size ? `, ${size} size` : ''} - ${brand}`;
    }

    return `${product.name} - Carolina Futons`;
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
