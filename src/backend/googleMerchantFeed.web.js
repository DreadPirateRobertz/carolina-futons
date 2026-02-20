// Backend web module for Google Merchant Center product feed generation
// Queries Wix Stores products and formats them for GMC XML/RSS feed
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { getImageUrl } from 'backend/utils/mediaHelpers';

const SITE_URL = 'https://www.carolinafutons.com';
const STORE_NAME = 'Carolina Futons';

// Google product category mappings for furniture types
const GOOGLE_CATEGORY_MAP = {
  'futon-frames': 'Furniture > Beds & Accessories > Beds > Futons',
  'front-loading-nesting': 'Furniture > Beds & Accessories > Beds > Futons',
  'wall-huggers': 'Furniture > Beds & Accessories > Beds > Futons',
  'unfinished-wood': 'Furniture > Beds & Accessories > Beds > Futons',
  'mattresses': 'Furniture > Beds & Accessories > Mattresses',
  'murphy-cabinet-beds': 'Furniture > Beds & Accessories > Beds > Murphy Beds',
  'platform-beds': 'Furniture > Beds & Accessories > Beds > Platform Beds',
  'casegoods-accessories': 'Furniture > Bedroom Furniture',
};

// Google product category IDs (numeric taxonomy)
const GOOGLE_CATEGORY_ID_MAP = {
  'futon-frames': '2720',
  'front-loading-nesting': '2720',
  'wall-huggers': '2720',
  'unfinished-wood': '2720',
  'mattresses': '2611',
  'murphy-cabinet-beds': '451',
  'platform-beds': '451',
  'casegoods-accessories': '436',
};

// Brand detection matching seoHelpers logic
function getBrand(product) {
  if (!product || !product.collections) return STORE_NAME;

  const collections = Array.isArray(product.collections)
    ? product.collections
    : [product.collections];

  if (collections.some(c => c.includes('wall-hugger'))) return 'Strata Furniture';
  if (collections.some(c => c.includes('unfinished'))) return 'KD Frames';
  if (collections.some(c => c.includes('otis') || c.includes('mattress'))) return 'Otis Bed';
  if (collections.some(c => c.includes('arizona'))) return 'Arizona';
  return 'Night & Day Furniture';
}

// Get Google product category from collections
function getGoogleCategory(collections) {
  if (!collections) return 'Furniture';
  const collArr = Array.isArray(collections) ? collections : [collections];

  for (const col of collArr) {
    for (const [key, value] of Object.entries(GOOGLE_CATEGORY_MAP)) {
      if (col.includes(key)) return value;
    }
  }
  return 'Furniture';
}

// Get Google product category ID from collections
function getGoogleCategoryId(collections) {
  if (!collections) return '436';
  const collArr = Array.isArray(collections) ? collections : [collections];

  for (const col of collArr) {
    for (const [key, value] of Object.entries(GOOGLE_CATEGORY_ID_MAP)) {
      if (col.includes(key)) return value;
    }
  }
  return '436';
}

// Get custom product type from collections
function getProductType(collections) {
  if (!collections) return 'Furniture';
  const collArr = Array.isArray(collections) ? collections : [collections];

  if (collArr.some(c => c.includes('murphy'))) return 'Beds > Murphy Cabinet Beds';
  if (collArr.some(c => c.includes('platform'))) return 'Beds > Platform Beds';
  if (collArr.some(c => c.includes('mattress'))) return 'Futon Mattresses';
  if (collArr.some(c => c.includes('wall-hugger'))) return 'Futon Frames > Wall Hugger';
  if (collArr.some(c => c.includes('unfinished'))) return 'Futon Frames > Unfinished Wood';
  if (collArr.some(c => c.includes('futon') || c.includes('frame'))) return 'Futon Frames';
  if (collArr.some(c => c.includes('casegood') || c.includes('accessor'))) return 'Bedroom Furniture';
  return 'Furniture';
}

// Escape XML special characters
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Strip HTML tags from description
function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Format price for GMC (e.g. "299.99 USD")
function formatPrice(price) {
  if (!price && price !== 0) return '';
  return `${Number(price).toFixed(2)} USD`;
}

// getImageUrl imported from backend/utils/mediaHelpers

// Format a single product as XML item for the feed
function formatProductItem(product) {
  const id = product._id;
  const title = escapeXml(product.name || '');
  const description = escapeXml(stripHtml(product.description || product.name || ''));
  const link = `${SITE_URL}/product-page/${product.slug}`;
  const imageLink = getImageUrl(product.mainMedia);
  const brand = escapeXml(getBrand(product));
  const price = formatPrice(product.price);
  const availability = product.inStock !== false ? 'in_stock' : 'out_of_stock';
  const condition = 'new';
  const googleCategory = escapeXml(getGoogleCategory(product.collections));
  const googleCategoryId = getGoogleCategoryId(product.collections);
  const productType = escapeXml(getProductType(product.collections));
  const sku = product.sku || '';

  let item = `    <item>
      <g:id>${escapeXml(id)}</g:id>
      <g:title>${title}</g:title>
      <g:description>${description}</g:description>
      <g:link>${escapeXml(link)}</g:link>
      <g:image_link>${escapeXml(imageLink)}</g:image_link>
      <g:availability>${availability}</g:availability>
      <g:price>${price}</g:price>
      <g:brand>${brand}</g:brand>
      <g:condition>${condition}</g:condition>
      <g:google_product_category>${googleCategoryId}</g:google_product_category>
      <g:product_type>${productType}</g:product_type>`;

  // Add sale price if discounted
  if (product.discountedPrice && product.discountedPrice < product.price) {
    item += `\n      <g:sale_price>${formatPrice(product.discountedPrice)}</g:sale_price>`;
  }

  // Add MPN (use SKU as MPN since furniture typically lacks GTINs)
  if (sku) {
    item += `\n      <g:mpn>${escapeXml(sku)}</g:mpn>`;
  }

  // Most furniture items won't have GTINs
  item += `\n      <g:identifier_exists>false</g:identifier_exists>`;

  // Add additional images if available
  if (product.mediaItems && Array.isArray(product.mediaItems)) {
    const additionalImages = product.mediaItems.slice(1, 11); // GMC allows up to 10 additional
    for (const img of additionalImages) {
      const imgUrl = getImageUrl(img);
      if (imgUrl) {
        item += `\n      <g:additional_image_link>${escapeXml(imgUrl)}</g:additional_image_link>`;
      }
    }
  }

  // Shipping: free over $999, otherwise flat rate estimate
  if (product.price >= 999) {
    item += `\n      <g:shipping>
        <g:country>US</g:country>
        <g:service>Free Shipping</g:service>
        <g:price>0.00 USD</g:price>
      </g:shipping>`;
  }

  item += '\n    </item>';
  return item;
}

// Generate the complete Google Merchant Center XML feed
export const generateFeed = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      // Query all visible products from Wix Stores
      let allProducts = [];
      let skip = 0;
      const pageSize = 100;

      while (true) {
        const results = await wixData.query('Stores/Products')
          .eq('visible', true)
          .skip(skip)
          .limit(pageSize)
          .find();

        allProducts = allProducts.concat(results.items);

        if (results.items.length < pageSize) break;
        skip += pageSize;
      }

      const items = allProducts.map(formatProductItem).join('\n');
      const now = new Date().toISOString();

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(STORE_NAME)} - Google Shopping Feed</title>
    <link>${SITE_URL}</link>
    <description>Product feed for ${escapeXml(STORE_NAME)} - Futon frames, mattresses, Murphy beds, and platform beds</description>
    <lastBuildDate>${now}</lastBuildDate>
${items}
  </channel>
</rss>`;

      return xml;
    } catch (err) {
      console.error('Error generating Google Merchant feed:', err);
      return null;
    }
  }
);

// Get feed data as JSON (for debugging or alternative feed formats)
export const getFeedData = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      let allProducts = [];
      let skip = 0;
      const pageSize = 100;

      while (true) {
        const results = await wixData.query('Stores/Products')
          .eq('visible', true)
          .skip(skip)
          .limit(pageSize)
          .find();

        allProducts = allProducts.concat(results.items);

        if (results.items.length < pageSize) break;
        skip += pageSize;
      }

      return allProducts.map(product => ({
        id: product._id,
        title: product.name,
        description: stripHtml(product.description || ''),
        link: `${SITE_URL}/product-page/${product.slug}`,
        imageLink: getImageUrl(product.mainMedia),
        price: product.price,
        salePrice: product.discountedPrice || null,
        availability: product.inStock !== false ? 'in_stock' : 'out_of_stock',
        brand: getBrand(product),
        condition: 'new',
        googleProductCategory: getGoogleCategory(product.collections),
        productType: getProductType(product.collections),
        sku: product.sku || '',
        mpn: product.sku || '',
        identifierExists: false,
      }));
    } catch (err) {
      console.error('Error generating feed data:', err);
      return [];
    }
  }
);
