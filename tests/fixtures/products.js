// Mock product data for tests
// Mirrors the Wix Stores/Products collection schema

export const futonFrame = {
  _id: 'prod-frame-001',
  name: 'Eureka Futon Frame',
  slug: 'eureka-futon-frame',
  price: 499,
  formattedPrice: '$499.00',
  discountedPrice: null,
  formattedDiscountedPrice: null,
  mainMedia: 'https://example.com/eureka.jpg',
  sku: 'EUR-FRM-001',
  ribbon: '',
  collections: ['futon-frames'],
  description: 'Solid hardwood futon frame with clean modern lines.',
  inStock: true,
  _createdDate: new Date('2025-01-15'),
  discount: 0,
  options: { finish: 'Natural', size: 'Full' },
  numericRating: 4.5,
  numReviews: 12,
};

export const wallHuggerFrame = {
  _id: 'prod-frame-002',
  name: 'Dillon Wall Hugger Frame',
  slug: 'dillon-wall-hugger-frame',
  price: 699,
  formattedPrice: '$699.00',
  discountedPrice: null,
  formattedDiscountedPrice: null,
  mainMedia: 'https://example.com/dillon.jpg',
  sku: 'DIL-WH-001',
  ribbon: 'Featured',
  collections: ['futon-frames', 'wall-huggers'],
  description: 'Space-saving wall hugger futon frame by Strata Furniture.',
  inStock: true,
  _createdDate: new Date('2025-02-01'),
  discount: 0,
  options: { finish: 'Black Walnut' },
};

export const futonMattress = {
  _id: 'prod-matt-001',
  name: 'Moonshadow Futon Mattress',
  slug: 'moonshadow-futon-mattress',
  price: 349,
  formattedPrice: '$349.00',
  discountedPrice: 299,
  formattedDiscountedPrice: '$299.00',
  mainMedia: 'https://example.com/moonshadow.jpg',
  sku: 'MOON-MAT-001',
  ribbon: 'Sale',
  collections: ['mattresses'],
  description: 'Premium innerspring futon mattress with pillow-top comfort.',
  inStock: true,
  _createdDate: new Date('2025-03-01'),
  discount: 50,
  options: { size: 'Full' },
};

export const murphyBed = {
  _id: 'prod-murphy-001',
  name: 'Sagebrush Murphy Cabinet Bed',
  slug: 'sagebrush-murphy-cabinet-bed',
  price: 1899,
  formattedPrice: '$1,899.00',
  discountedPrice: null,
  formattedDiscountedPrice: null,
  mainMedia: 'https://example.com/sagebrush.jpg',
  sku: 'SAGE-MUR-001',
  ribbon: '',
  collections: ['murphy-cabinet-beds'],
  description: 'Queen Murphy cabinet bed with USB charging and built-in mattress.',
  inStock: true,
  _createdDate: new Date('2025-04-01'),
  discount: 0,
};

export const platformBed = {
  _id: 'prod-plat-001',
  name: 'Lexington Platform Bed',
  slug: 'lexington-platform-bed',
  price: 599,
  formattedPrice: '$599.00',
  discountedPrice: null,
  formattedDiscountedPrice: null,
  mainMedia: 'https://example.com/lexington.jpg',
  sku: 'LEX-PLT-001',
  ribbon: '',
  collections: ['platform-beds'],
  description: 'Low-profile platform bed frame in solid hardwood.',
  inStock: true,
  _createdDate: new Date('2025-05-01'),
  discount: 0,
};

export const casegoodsItem = {
  _id: 'prod-case-001',
  name: 'Clove Nightstand',
  slug: 'clove-nightstand',
  price: 199,
  formattedPrice: '$199.00',
  discountedPrice: null,
  formattedDiscountedPrice: null,
  mainMedia: 'https://example.com/clove.jpg',
  sku: 'CLV-NS-001',
  ribbon: '',
  collections: ['casegoods-accessories'],
  description: 'Matching nightstand with drawer.',
  inStock: true,
  _createdDate: new Date('2025-06-01'),
  discount: 0,
};

export const saleProduct = {
  _id: 'prod-sale-001',
  name: 'Floor Model Eureka Frame',
  slug: 'floor-model-eureka',
  price: 499,
  formattedPrice: '$499.00',
  discountedPrice: 349,
  formattedDiscountedPrice: '$349.00',
  mainMedia: 'https://example.com/floor-eureka.jpg',
  sku: 'EUR-FLR-001',
  ribbon: 'Clearance',
  collections: ['futon-frames'],
  description: 'Floor model in excellent condition.',
  inStock: true,
  _createdDate: new Date('2024-12-01'),
  discount: 150,
};

// All products for seeding collections
export const allProducts = [
  futonFrame,
  wallHuggerFrame,
  futonMattress,
  murphyBed,
  platformBed,
  casegoodsItem,
  saleProduct,
];

// Sample analytics records
export const analyticsRecords = [
  { _id: 'ana-001', productId: 'prod-frame-001', productName: 'Eureka Futon Frame', category: 'futon-frames', viewCount: 150, addToCartCount: 30, purchaseCount: 12, lastViewed: new Date() },
  { _id: 'ana-002', productId: 'prod-matt-001', productName: 'Moonshadow Futon Mattress', category: 'mattresses', viewCount: 120, addToCartCount: 25, purchaseCount: 10, lastViewed: new Date() },
  { _id: 'ana-003', productId: 'prod-murphy-001', productName: 'Sagebrush Murphy Cabinet Bed', category: 'murphy-cabinet-beds', viewCount: 80, addToCartCount: 8, purchaseCount: 3, lastViewed: new Date(Date.now() - 14 * 86400000) }, // 2 weeks old
];

// Sample order data
export const sampleOrder = {
  _id: 'order-001',
  number: '10042',
  _createdDate: new Date('2025-06-15'),
  paymentStatus: 'PAID',
  fulfillmentStatus: 'NOT_FULFILLED',
  billingInfo: {
    firstName: 'Jane',
    lastName: 'Smith',
    phone: '8285551234',
  },
  buyerInfo: {
    email: 'jane@example.com',
  },
  shippingInfo: {
    title: 'UPS Ground',
    shipmentDetails: {
      address: {
        addressLine: '123 Main St',
        addressLine2: 'Apt 4',
        city: 'Asheville',
        subdivision: 'NC',
        postalCode: '28801',
        country: 'US',
      },
    },
  },
  lineItems: [
    { name: 'Eureka Futon Frame', quantity: 1, sku: 'EUR-FRM-001', price: 499, weight: 85 },
    { name: 'Moonshadow Futon Mattress', quantity: 1, sku: 'MOON-MAT-001', price: 349, weight: 55 },
  ],
  totals: { subtotal: 848, shipping: 29.99, total: 877.99 },
  buyerNote: 'Please leave at back door',
};
