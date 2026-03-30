/**
 * @module lifecycleEmailTemplates
 * @description HTML email template generators for post-purchase lifecycle emails.
 * Each function accepts {name, productName, orderDate} and returns a complete HTML string.
 *
 * Templates:
 *   - Day 7:   Care guide — how to flip/rotate futon for even wear
 *   - Month 1: Check-in with care tips + review encouragement
 *   - Year 1:  Anniversary thank-you with 15% off code ANNIVERSARY15
 *
 * Used by the lifecycle cron (CF-3izl.1) to send emails at scheduled intervals.
 */

const SITE_URL = 'https://www.carolinafutons.com';
const SITE_NAME = 'Carolina Futons';
const SUPPORT_PHONE = '(828) 252-9449';
const SUPPORT_EMAIL = 'carolinafutons@gmail.com';
const LOGO_URL = `${SITE_URL}/logo.png`;

const BRAND_COLOR = '#2C3E50';
const ACCENT_COLOR = '#8B5E3C';

function baseLayout({ preheader, title, bodyContent }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f4; font-family: Georgia, serif; color: #333; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background-color: ${BRAND_COLOR}; padding: 24px 32px; text-align: center; }
    .header img { max-height: 48px; }
    .header-name { color: #ffffff; font-size: 18px; letter-spacing: 1px; margin: 8px 0 0; font-family: Georgia, serif; }
    .body { padding: 32px; }
    .body h1 { font-size: 22px; color: ${BRAND_COLOR}; margin: 0 0 16px; }
    .body p { font-size: 15px; line-height: 1.7; margin: 0 0 16px; }
    .cta-btn { display: inline-block; background: ${ACCENT_COLOR}; color: #fff !important; text-decoration: none; padding: 12px 28px; border-radius: 4px; font-size: 15px; margin: 8px 0 16px; }
    .tip-box { background: #f9f5f1; border-left: 4px solid ${ACCENT_COLOR}; padding: 16px 20px; margin: 20px 0; border-radius: 0 4px 4px 0; }
    .tip-box p { margin: 0; }
    .code-box { background: #f0f8f0; border: 2px dashed #5a8a5a; padding: 16px 24px; text-align: center; margin: 24px 0; border-radius: 4px; }
    .code-box .code { font-family: monospace; font-size: 22px; font-weight: bold; color: #2a6a2a; letter-spacing: 2px; }
    .code-box p { margin: 4px 0; font-size: 13px; color: #555; }
    .footer { background: #f4f4f4; padding: 20px 32px; font-size: 12px; color: #888; text-align: center; line-height: 1.6; }
    .footer a { color: #888; text-decoration: underline; }
    @media (max-width: 600px) { .body { padding: 20px; } }
  </style>
</head>
<body>
  <span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
  <div class="wrapper">
    <div class="header">
      <div class="header-name">${SITE_NAME}</div>
    </div>
    <div class="body">
      ${bodyContent}
    </div>
    <div class="footer">
      <p>${SITE_NAME} · Hendersonville, NC · <a href="tel:${SUPPORT_PHONE}">${SUPPORT_PHONE}</a></p>
      <p><a href="${SITE_URL}">Visit our website</a> · <a href="${SITE_URL}/loyalty">My Account</a></p>
      <p style="margin-top:12px;font-size:11px;">You're receiving this because you purchased from ${SITE_NAME}. Questions? Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Day 7 care guide — how to flip and rotate a futon mattress for even wear.
 * @param {Object} params
 * @param {string} params.name - Customer first name
 * @param {string} params.productName - Product purchased
 * @param {string} params.orderDate - ISO date string of order
 * @returns {string} HTML email
 */
export function generateDay7CareGuide({ name, productName, orderDate }) {
  return baseLayout({
    preheader: `Quick care tip for your ${productName} — flip it today for even wear!`,
    title: `Your ${productName} care guide`,
    bodyContent: `
      <h1>Hi ${name}, it's been a week! 🛋️</h1>
      <p>We hope you're loving your <strong>${productName}</strong>. Here's a quick care tip that most people miss — and it makes a big difference.</p>

      <div class="tip-box">
        <p><strong>Flip &amp; Rotate your futon mattress every 4–6 weeks.</strong></p>
      </div>

      <p>Futon mattresses develop wear patterns over time. Regular flipping and rotating (180°) distributes the filling evenly, prevents body impressions, and extends the life of your mattress by years.</p>

      <h1 style="font-size:18px;">How to do it:</h1>
      <p>
        <strong>1. Flip it:</strong> Lift one side of the mattress and fold it over — the bottom becomes the top.<br />
        <strong>2. Rotate it:</strong> Turn the mattress 180° so the head end becomes the foot end.<br />
        <strong>3. Repeat</strong> every 4–6 weeks, or whenever you change your sheets.
      </p>

      <p>It only takes 2 minutes and your futon will thank you for it.</p>

      <p>Have questions about your <strong>${productName}</strong>? We're here to help.</p>
      <a class="cta-btn" href="${SITE_URL}/contact">Ask Us Anything</a>

      <p style="font-size:13px;color:#888;">Order date: ${orderDate}</p>
    `,
  });
}

/**
 * Month 1 check-in — care tips summary and review encouragement.
 * @param {Object} params
 * @param {string} params.name - Customer first name
 * @param {string} params.productName - Product purchased
 * @param {string} params.orderDate - ISO date string of order
 * @returns {string} HTML email
 */
export function generateMonth1CheckIn({ name, productName, orderDate }) {
  return baseLayout({
    preheader: `One month with your ${productName} — care tips inside + we'd love your feedback!`,
    title: `One month check-in — ${productName}`,
    bodyContent: `
      <h1>One month already, ${name}!</h1>
      <p>It's been a whole month since your <strong>${productName}</strong> arrived. We hope it's become a favorite spot in your home.</p>

      <h1 style="font-size:18px;">Monthly care tips:</h1>

      <div class="tip-box">
        <p><strong>✓ Flip &amp; rotate your mattress</strong> — once a month keeps it even.</p>
      </div>
      <div class="tip-box">
        <p><strong>✓ Spot clean spills immediately</strong> — blot (don't rub) with a damp cloth and mild soap. Air dry fully.</p>
      </div>
      <div class="tip-box">
        <p><strong>✓ Check frame hardware</strong> — tighten any bolts that may have loosened with regular use.</p>
      </div>
      <div class="tip-box">
        <p><strong>✓ Air it out</strong> — leave the mattress unfolded occasionally to allow moisture to escape.</p>
      </div>

      <p>With a little maintenance, your futon will look great for years to come.</p>

      <p><strong>One small favor:</strong> If you've been happy with your ${productName}, sharing your experience helps other customers find us — and supports our small family business in Hendersonville, NC.</p>
      <a class="cta-btn" href="${SITE_URL}/reviews">Leave a Review</a>

      <p>It only takes 2 minutes and means the world to us. Thank you, ${name}!</p>
      <p style="font-size:13px;color:#888;">Order date: ${orderDate}</p>
    `,
  });
}

/**
 * Year 1 anniversary — thank you message with 15% discount code.
 * @param {Object} params
 * @param {string} params.name - Customer first name
 * @param {string} params.productName - Product purchased
 * @param {string} params.orderDate - ISO date string of order
 * @returns {string} HTML email
 */
export function generateYear1Anniversary({ name, productName, orderDate }) {
  return baseLayout({
    preheader: `Happy 1-year anniversary, ${name}! A special thank-you gift inside 🎉`,
    title: `Happy 1-year anniversary from Carolina Futons!`,
    bodyContent: `
      <h1>Happy anniversary, ${name}! 🎉</h1>
      <p>One year ago, you brought home your <strong>${productName}</strong> — and we're so glad you chose Carolina Futons.</p>

      <p>As a family-owned store in Hendersonville, NC, customers like you are why we do what we do. A heartfelt <strong>thank you</strong> for your support.</p>

      <p>To celebrate your one-year anniversary with us, here's a special gift:</p>

      <div class="code-box">
        <p>Your exclusive anniversary discount</p>
        <div class="code">ANNIVERSARY15</div>
        <p>15% off your next purchase — no minimum</p>
      </div>

      <p>Use it on anything in our store — new frames, mattresses, murphy beds, or accessories. The code is yours to keep.</p>
      <a class="cta-btn" href="${SITE_URL}/shop">Shop Now</a>

      <p>And if your futon is starting to show its age, ask us about our <a href="${SITE_URL}/trade-in" style="color:${ACCENT_COLOR};">Trade-In program</a> — we'll help you upgrade and give your old futon a second life.</p>

      <p>Thank you again, ${name}. Here's to many more years together.</p>
      <p>— The Carolina Futons family</p>
      <p style="font-size:13px;color:#888;">Order date: ${orderDate} · Code expires 30 days from receipt</p>
    `,
  });
}
