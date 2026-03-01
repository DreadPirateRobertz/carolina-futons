// 3D model asset catalog for AR "View in Your Room" feature.
// Ported from cfutons_mobile models3d.ts — shared catalog across web+mobile.

/** CDN base URL for 3D model assets */
export const MODEL_CDN_BASE = 'https://cdn.carolinafutons.com/models';

/** Convert inches to meters */
function inToM(inches) {
  return Math.round(inches * 0.0254 * 1000) / 1000;
}

/** 3D model catalog — futons, frames, murphy-beds only */
export const MODELS_3D = [
  {
    productId: 'prod-murphy-queen-vertical',
    glbUrl: `${MODEL_CDN_BASE}/glb/murphy-queen-vertical-q1r2s3.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/murphy-queen-vertical-q1r2s3.usdz`,
    dimensions: { width: inToM(64), depth: inToM(24), height: inToM(42) },
    fileSizeBytes: 7_200_000,
    contentHash: 'q1r2s3',
    hasFabricVariants: false,
  },
  {
    productId: 'prod-murphy-full-horizontal',
    glbUrl: `${MODEL_CDN_BASE}/glb/murphy-full-horizontal-t4u5v6.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/murphy-full-horizontal-t4u5v6.usdz`,
    dimensions: { width: inToM(78), depth: inToM(20), height: inToM(44) },
    fileSizeBytes: 6_500_000,
    contentHash: 't4u5v6',
    hasFabricVariants: false,
  },
  {
    productId: 'prod-murphy-queen-bookcase',
    glbUrl: `${MODEL_CDN_BASE}/glb/murphy-queen-bookcase-w7x8y9.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/murphy-queen-bookcase-w7x8y9.usdz`,
    dimensions: { width: inToM(100), depth: inToM(24), height: inToM(84) },
    fileSizeBytes: 8_400_000,
    contentHash: 'w7x8y9',
    hasFabricVariants: false,
  },
  {
    productId: 'prod-murphy-twin-cabinet',
    glbUrl: `${MODEL_CDN_BASE}/glb/murphy-twin-cabinet-z0a1b2.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/murphy-twin-cabinet-z0a1b2.usdz`,
    dimensions: { width: inToM(44), depth: inToM(24), height: inToM(38) },
    fileSizeBytes: 4_800_000,
    contentHash: 'z0a1b2',
    hasFabricVariants: false,
  },
  {
    productId: 'prod-murphy-queen-desk',
    glbUrl: `${MODEL_CDN_BASE}/glb/murphy-queen-desk-c3d4e5.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/murphy-queen-desk-c3d4e5.usdz`,
    dimensions: { width: inToM(66), depth: inToM(26), height: inToM(84) },
    fileSizeBytes: 8_100_000,
    contentHash: 'c3d4e5',
    hasFabricVariants: false,
  },
  {
    productId: 'prod-murphy-full-storage',
    glbUrl: `${MODEL_CDN_BASE}/glb/murphy-full-storage-f6g7h8.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/murphy-full-storage-f6g7h8.usdz`,
    dimensions: { width: inToM(60), depth: inToM(24), height: inToM(82) },
    fileSizeBytes: 7_000_000,
    contentHash: 'f6g7h8',
    hasFabricVariants: false,
  },
  {
    productId: 'prod-asheville-full',
    glbUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
    usdzUrl: `${MODEL_CDN_BASE}/usdz/asheville-full-14c9a033.usdz`,
    dimensions: { width: inToM(54), depth: inToM(34), height: inToM(33) },
    fileSizeBytes: 4_125_648,
    contentHash: '14c9a033',
    hasFabricVariants: true,
  },
  {
    productId: 'prod-blue-ridge-queen',
    glbUrl: `${MODEL_CDN_BASE}/glb/blue-ridge-queen-d4e5f6.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/blue-ridge-queen-d4e5f6.usdz`,
    dimensions: { width: inToM(60), depth: inToM(36), height: inToM(35) },
    fileSizeBytes: 7_500_000,
    contentHash: 'd4e5f6',
    hasFabricVariants: true,
  },
  {
    productId: 'prod-pisgah-twin',
    glbUrl: `${MODEL_CDN_BASE}/glb/pisgah-twin-g7h8i9.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/pisgah-twin-g7h8i9.usdz`,
    dimensions: { width: inToM(39), depth: inToM(32), height: inToM(31) },
    fileSizeBytes: 5_200_000,
    contentHash: 'g7h8i9',
    hasFabricVariants: true,
  },
  {
    productId: 'prod-biltmore-loveseat',
    glbUrl: `${MODEL_CDN_BASE}/glb/biltmore-loveseat-j0k1l2.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/biltmore-loveseat-j0k1l2.usdz`,
    dimensions: { width: inToM(48), depth: inToM(33), height: inToM(32) },
    fileSizeBytes: 5_800_000,
    contentHash: 'j0k1l2',
    hasFabricVariants: true,
  },
  {
    productId: 'prod-hardwood-frame',
    glbUrl: `${MODEL_CDN_BASE}/glb/hardwood-frame-m3n4o5.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/hardwood-frame-m3n4o5.usdz`,
    dimensions: { width: inToM(54), depth: inToM(38), height: inToM(33) },
    fileSizeBytes: 4_100_000,
    contentHash: 'm3n4o5',
    hasFabricVariants: false,
  },
];

/** Look up 3D model asset for a product */
export function getModel3DForProduct(productId) {
  if (!productId) return undefined;
  return MODELS_3D.find(m => m.productId === productId);
}

/** Check whether a product has an AR model available */
export function hasARModel(productId) {
  if (!productId) return false;
  return MODELS_3D.some(m => m.productId === productId);
}
