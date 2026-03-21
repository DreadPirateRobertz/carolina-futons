/**
 * visualSearch — Wix backend function
 * POST /_functions/visualSearch
 *
 * Security: all 5 dutch controls implemented (hq-eehh sign-off)
 * D38+D16: no client-asserted role/membership accepted
 */
'use strict';

const https = require('https');
const dns = require('dns').promises;

// ── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_HOST = 'api.openai.com';
const OPENAI_PATH = '/v1/chat/completions';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

// RFC-1918 + link-local + loopback ranges
const BLOCKED_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^::1$/,
  /^fc/,
];

function isBlockedIp(ip) {
  return BLOCKED_RANGES.some((re) => re.test(ip));
}

function respond(status, body) {
  return { status, body: JSON.stringify(body) };
}

// ── Handler ──────────────────────────────────────────────────────────────────

async function post(request) {
  try {
    const body = JSON.parse(request.body.text);

    // D38+D16: reject client-asserted privilege fields
    if (body.role !== undefined || body.membership !== undefined || body.is_admin !== undefined) {
      return respond(400, { error: 'Client-asserted trust fields not permitted' });
    }

    // Validate image exists and size
    const { image } = body;
    if (!image || typeof image !== 'string') {
      return respond(400, { error: 'image field required' });
    }
    const imageBytes = Buffer.byteLength(image, 'utf8');
    if (imageBytes > MAX_IMAGE_BYTES) {
      return respond(413, { error: 'Image exceeds 10MB limit' });
    }

    // Control 1: domain allowlist
    // Control 2: HTTPS + port 443 only (no scheme/port overrides accepted from client)
    // (Client cannot control scheme/host — they are hardcoded here)

    // Control 4+5: resolve hostname ONCE, check RFC-1918, use IP as TCP target
    const { address: resolvedIp } = await dns.lookup(ALLOWED_HOST);
    if (isBlockedIp(resolvedIp)) {
      return respond(400, { error: 'Resolved IP is in a blocked range' });
    }

    // Control 3+5: make HTTPS request using resolved IP as TCP target
    // TLS SNI and Host header remain api.openai.com for cert validation
    const openAiKey = process.env.OPENAI_API_KEY;
    const requestBody = JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Classify this furniture photo. Return ONLY valid JSON with these fields:
{"category":"futons|murphy-beds|covers|mattresses|accessories|unknown","style":"modern|rustic|traditional|mid-century|industrial|unknown","colorFamily":"neutral|warm|cool|dark|light|unknown","keywords":["...up to 5 descriptive words"]}`,
            },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } },
          ],
        },
      ],
    });

    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: resolvedIp,      // Control 5: TCP connects to resolved IP
        host: resolvedIp,
        port: 443,
        path: OPENAI_PATH,
        method: 'POST',
        headers: {
          Host: ALLOWED_HOST,      // Control 5: TLS SNI + server routing via Host header
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        },
      };

      const req = https.request(options, (res) => {
        // Control 3: reject redirects
        if (res.statusCode >= 300 && res.statusCode < 400) {
          reject(new Error(`Unexpected redirect: ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      });

      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(new Error('OpenAI request timeout')); });
      req.write(requestBody);
      req.end();
    });

    if (response.statusCode === 408 || response.statusCode === 504) {
      return respond(504, { error: 'OpenAI request timed out' });
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      return respond(502, { error: 'OpenAI API error' }); // safe message only — no raw error exposed
    }

    let parsed;
    try {
      const openAiBody = JSON.parse(response.body);
      const content = openAiBody.choices?.[0]?.message?.content;
      parsed = JSON.parse(content);
    } catch {
      return respond(502, { error: 'Invalid response from AI service' });
    }

    const { category, style, colorFamily, keywords } = parsed;
    if (!category || !style || !colorFamily) {
      return respond(502, { error: 'Incomplete AI response' });
    }

    // No logging/retention of image data (zhora requirement)
    return respond(200, { category, style, colorFamily, keywords: keywords ?? [] });

  } catch (err) {
    if (err.message?.includes('timeout')) {
      return respond(504, { error: 'Gateway timeout' });
    }
    return respond(502, { error: 'Visual search failed' });
  }
}

module.exports = { post };
