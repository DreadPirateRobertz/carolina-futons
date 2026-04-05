/**
 * upload-gamification-assets.mjs — Upload bear Lottie animations to Wix Media Manager.
 *
 * Uploads placeholder Lottie JSON files for the chibi bear avatar animations.
 * After upload, prints the Wix file IDs so AvatarDisplay.js constants can be updated.
 *
 * IMPORTANT: Requires a Wix Site API Key, NOT the Velo IST backend key.
 * To obtain the key:
 *   1. Wix Dashboard → Settings → API Keys
 *   2. Create a new key with "Media Manager" permission (read + write)
 *   3. Add WIX_SITE_API_KEY=<key> to scripts/secrets.env
 *
 * Usage:
 *   WIX_SITE_API_KEY=xxx WIX_SITE_ID=49cd75b0-92f1-4978-93e2-f5b5da531142 \
 *     node scripts/upload-gamification-assets.mjs
 *
 * After running, update src/public/AvatarDisplay.js:
 *   const DANCING_BEAR_ID = '<returned dancing bear fileId>';
 *   const IDLE_BEAR_ID    = '<returned idle bear fileId>';
 *
 * CF-tgsn.2
 */

const WIX_MEDIA_API = 'https://www.wixapis.com/site-media/v1';

// ── Minimal placeholder Lottie JSON ───────────────────────────────────────────
// Valid Lottie v5, 60-frame loop at 30fps (2 seconds).
// Bear shape: brown circle (head) with simple scale pulse animation.
// Replace with real design assets when available.

export function makePlaceholderLottie(name, hue) {
  // hue: 'brown' = dancing bear (orange-brown), 'tan' = idle bear (light brown)
  const [r, g, b] = hue === 'brown' ? [0.55, 0.27, 0.07] : [0.82, 0.69, 0.44];
  return {
    v: '5.9.6',
    fr: 30,
    ip: 0,
    op: 60,
    w: 400,
    h: 400,
    nm: name,
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'head',
        sr: 1,
        ks: {
          o: { a: 0, k: 100, ix: 11 },
          r: { a: 0, k: 0, ix: 10 },
          p: { a: 0, k: [200, 200, 0], ix: 2, l: 2 },
          a: { a: 0, k: [0, 0, 0], ix: 1, l: 2 },
          s: {
            a: 1,
            ix: 6,
            l: 2,
            k: [
              { i: { x: [0.5, 0.5, 0.5], y: [1, 1, 1] }, o: { x: [0.5, 0.5, 0.5], y: [0, 0, 0] }, t: 0, s: [100, 100, 100] },
              { i: { x: [0.5, 0.5, 0.5], y: [1, 1, 1] }, o: { x: [0.5, 0.5, 0.5], y: [0, 0, 0] }, t: 30, s: [110, 110, 100] },
              { t: 60, s: [100, 100, 100] },
            ],
          },
        },
        ao: 0,
        shapes: [
          {
            ty: 'gr',
            it: [
              {
                ty: 'el',
                p: { a: 0, k: [0, 0] },
                s: { a: 0, k: [180, 180] },
                nm: 'head-circle',
              },
              {
                ty: 'fl',
                c: { a: 0, k: [r, g, b, 1] },
                o: { a: 0, k: 100 },
                nm: 'fill',
                r: 1,
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 },
              },
            ],
            nm: 'head-group',
          },
        ],
        ip: 0,
        op: 60,
        st: 0,
        bm: 0,
      },
    ],
  };
}

// ── API helpers ───────────────────────────────────────────────────────────────

export function getConfig() {
  // Requires a Wix Site API Key (dashboard → Settings → API Keys), NOT the Velo IST backend key
  const apiKey = process.env.WIX_SITE_API_KEY;
  const siteId = process.env.WIX_SITE_ID || '49cd75b0-92f1-4978-93e2-f5b5da531142';
  if (!apiKey) {
    throw new Error(
      'Missing WIX_SITE_API_KEY.\n' +
      'Obtain from: Wix Dashboard → Settings → API Keys\n' +
      'Required permissions: Media Manager (read + write)\n' +
      'Then: WIX_SITE_API_KEY=xxx WIX_SITE_ID=49cd75b0-... node scripts/upload-gamification-assets.mjs'
    );
  }
  return { apiKey, siteId };
}

/**
 * Step 1: Request a signed upload URL from Wix Media Manager.
 */
export async function getUploadUrl(fileName, mimeType, config) {
  const res = await fetch(`${WIX_MEDIA_API}/upload/url`, {
    method: 'POST',
    headers: {
      Authorization: config.apiKey,
      'wix-site-id': config.siteId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mimeType, fileName }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`getUploadUrl failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data; // { uploadUrl, uploadToken }
}

/**
 * Step 2: POST file content to the signed upload URL.
 * Wix upload endpoint expects multipart/form-data with:
 *   - field "uploadToken" (the token from step 1)
 *   - field "file" (the file content)
 */
export async function uploadFile(uploadUrl, uploadToken, fileName, content) {
  const bufModule = await import('node:buffer').catch(() => ({}));
  const FormData = bufModule.FormData ?? globalThis.FormData;
  const Blob = bufModule.Blob ?? globalThis.Blob;

  const form = new FormData();
  form.append('uploadToken', uploadToken);
  form.append('file', new Blob([content], { type: 'application/json' }), fileName);

  const res = await fetch(uploadUrl, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`uploadFile failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────

export const ANIMATIONS = [
  {
    key: 'DANCING_BEAR_ID',
    fileName: 'cute-bear-dancing.json',
    hue: 'brown',
    description: 'Dancing/celebration bear (plays on accessory unlock)',
  },
  {
    key: 'IDLE_BEAR_ID',
    fileName: 'waving-bear.json',
    hue: 'tan',
    description: 'Idle waving bear (default avatar state)',
  },
];

export async function main() {
  let config;
  try {
    config = getConfig();
  } catch (err) {
    console.error(`\nConfiguration error: ${err.message}\n`);
    process.exit(1);
  }

  console.log(`Site ID: ${config.siteId}`);
  console.log(`Uploading ${ANIMATIONS.length} Lottie animations...\n`);

  const results = [];

  for (const anim of ANIMATIONS) {
    console.log(`→ ${anim.fileName} (${anim.description})`);

    const json = JSON.stringify(makePlaceholderLottie(anim.fileName.replace('.json', ''), anim.hue), null, 2);

    try {
      // Step 1: get upload URL
      const { uploadUrl, uploadToken } = await getUploadUrl(anim.fileName, 'application/json', config);
      console.log(`  ✓ Upload URL obtained`);

      // Step 2: upload the file
      const uploaded = await uploadFile(uploadUrl, uploadToken, anim.fileName, json);
      console.log(`  ✓ Uploaded`);

      const fileId = uploaded?.file?.id || uploaded?.fileId || uploaded?.id || JSON.stringify(uploaded).slice(0, 80);
      console.log(`  fileId: ${fileId}`);

      results.push({ key: anim.key, fileName: anim.fileName, fileId });
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
      results.push({ key: anim.key, fileName: anim.fileName, fileId: null, error: err.message });
    }
  }

  console.log('\n─────────────────────────────────────────────────────');
  console.log('Update src/public/AvatarDisplay.js with these values:');
  console.log('─────────────────────────────────────────────────────');

  for (const r of results) {
    if (r.fileId) {
      console.log(`const ${r.key} = '${r.fileId}';`);
    } else {
      console.log(`// ${r.key}: UPLOAD FAILED — ${r.error}`);
    }
  }

  const failed = results.filter(r => !r.fileId);
  if (failed.length > 0) {
    console.error(`\n${failed.length} upload(s) failed. See errors above.`);
    process.exit(1);
  }
}

// Run only when executed directly (not imported by tests)
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main();
}
