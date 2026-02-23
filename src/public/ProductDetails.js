// ProductDetails.js - Breadcrumbs, info accordion, social share, delivery, SEO, swatch request
import { getProductSchema, getBreadcrumbSchema, getProductOgTags, getProductFaqSchema } from 'backend/seoHelpers.web';
import { submitSwatchRequest } from 'backend/emailService.web';
import { getCategoryFromCollections, addBusinessDays } from 'public/productPageUtils.js';
import { trackSocialShare } from 'public/engagementTracker';
import { makeClickable } from 'public/a11yHelpers';

// ── Breadcrumbs ───────────────────────────────────────────────────────

export async function initBreadcrumbs($w, state) {
  try {
    if (!state.product) return;
    const category = getCategoryFromCollections(state.product.collections);
    try {
      $w('#breadcrumb1').text = 'Home';
      makeClickable($w('#breadcrumb1'), () => { import('wix-location-frontend').then(({ to }) => to('/')); }, { ariaLabel: 'Go to home page', role: 'link' });
      $w('#breadcrumb2').text = category.label;
      makeClickable($w('#breadcrumb2'), () => { import('wix-location-frontend').then(({ to }) => to(category.path)); }, { ariaLabel: `Browse ${category.label}`, role: 'link' });
      $w('#breadcrumb3').text = state.product.name;
    } catch (e) {}
    const schema = await getBreadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: category.label, url: category.path },
      { name: state.product.name, url: null },
    ]);
    if (schema) { try { $w('#breadcrumbSchemaHtml').postMessage(schema); } catch (e) {} }
  } catch (e) {}
}

// ── Product Info Accordion ────────────────────────────────────────────

export function initProductInfoAccordion($w) {
  try {
    const sections = ['Description', 'Dimensions', 'Care', 'Shipping'];
    const openStates = {};
    sections.forEach(section => {
      try {
        const header = $w(`#infoHeader${section}`);
        const content = $w(`#infoContent${section}`);
        if (!header || !content) return;
        try { header.accessibility.ariaLabel = `${section} section`; } catch (e) {}
        if (section === 'Description') {
          content.expand(); openStates[section] = true;
          try { $w(`#infoArrow${section}`).text = '\u2212'; } catch (e) {}
          try { header.accessibility.ariaExpanded = true; } catch (e) {}
        } else {
          content.collapse(); openStates[section] = false;
          try { $w(`#infoArrow${section}`).text = '+'; } catch (e) {}
          try { header.accessibility.ariaExpanded = false; } catch (e) {}
        }
        const toggleSection = () => {
          if (openStates[section]) {
            content.collapse(); openStates[section] = false;
            try { $w(`#infoArrow${section}`).text = '+'; } catch (e) {}
            try { header.accessibility.ariaExpanded = false; } catch (e) {}
          } else {
            content.expand(); openStates[section] = true;
            try { $w(`#infoArrow${section}`).text = '\u2212'; } catch (e) {}
            try { header.accessibility.ariaExpanded = true; } catch (e) {}
          }
        };
        header.onClick(toggleSection);
        try {
          header.onKeyPress((event) => {
            if (event.key === 'Enter' || event.key === ' ') toggleSection();
          });
        } catch (e) {}
      } catch (e) {}
    });
    try {
      $w('#infoContentShipping').text =
        'Free standard shipping on orders $999+. ' +
        'White-glove delivery available: $149 local (WNC), $249 regional, free on orders over $1,999. ' +
        'Standard delivery: 5\u201310 business days. ' +
        'Local customers: call (828) 252-9449 to schedule Wed\u2013Sat delivery.';
    } catch (e) {}
  } catch (e) {}
}

// ── Social Share ──────────────────────────────────────────────────────

export function initSocialShare($w, state) {
  try {
    if (!state.product) return;
    const url = `https://www.carolinafutons.com/product-page/${state.product.slug}`;
    const title = state.product.name;
    const image = state.product.mainMedia || '';

    try { $w('#shareFacebook').accessibility.ariaLabel = 'Share on Facebook'; } catch (e) {}
    try { $w('#sharePinterest').accessibility.ariaLabel = 'Share on Pinterest'; } catch (e) {}
    try { $w('#shareEmail').accessibility.ariaLabel = 'Share via email'; } catch (e) {}
    try { $w('#shareCopyLink').accessibility.ariaLabel = 'Copy product link'; } catch (e) {}

    try { makeClickable($w('#shareFacebook'), () => {
      trackSocialShare('facebook', 'product');
      import('wix-window-frontend').then(({ openUrl }) => openUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`));
    }); } catch (e) {}
    try { makeClickable($w('#sharePinterest'), () => {
      trackSocialShare('pinterest', 'product');
      import('wix-window-frontend').then(({ openUrl }) => openUrl(`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(image)}&description=${encodeURIComponent(title)}`));
    }); } catch (e) {}
    try { makeClickable($w('#shareEmail'), () => {
      trackSocialShare('email', 'product');
      const subject = encodeURIComponent(`Check out ${title} from Carolina Futons`);
      const body = encodeURIComponent(`I thought you might like this: ${title}\n\n${url}`);
      import('wix-window-frontend').then(({ openUrl }) => openUrl(`mailto:?subject=${subject}&body=${body}`));
    }); } catch (e) {}
    try { makeClickable($w('#shareCopyLink'), () => {
      trackSocialShare('copy_link', 'product');
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          $w('#shareCopyLink').label = 'Copied!';
          setTimeout(() => { try { $w('#shareCopyLink').label = 'Copy Link'; } catch (e) {} }, 2000);
        });
      }
    }); } catch (e) {}
  } catch (e) {}
}

// ── Delivery Estimate ─────────────────────────────────────────────────

export function initDeliveryEstimate($w, state) {
  try {
    const el = $w('#deliveryEstimate');
    if (!el || !state.product) return;
    const today = new Date();
    const opts = { month: 'short', day: 'numeric', year: 'numeric' };
    el.text = `Estimated delivery: ${addBusinessDays(today, 5).toLocaleDateString('en-US', opts)} \u2013 ${addBusinessDays(today, 10).toLocaleDateString('en-US', opts)}`;
    el.show();
    try {
      const isLarge = state.product.weight > 50 ||
        (state.product.collections || []).some(c => /murphy|platform|futon|frame/i.test(c));
      if (isLarge) {
        const note = $w('#whiteGloveNote');
        if (note) { note.text = 'White-glove delivery available \u2014 call (828) 252-9449 to schedule'; note.show(); }
      }
    } catch (e) {}
  } catch (e) {}
}

// ── SEO Schema Injection ──────────────────────────────────────────────

export async function injectProductSchema($w, state) {
  try {
    if (!state.product) return;
    const schema = await getProductSchema(state.product);
    if (schema) $w('#productSchemaHtml').postMessage(schema);
    const faqSchema = await getProductFaqSchema(state.product);
    if (faqSchema) { try { $w('#productFaqSchemaHtml').postMessage(faqSchema); } catch (e) {} }
    const ogTags = await getProductOgTags(state.product);
    if (ogTags) { try { $w('#productOgHtml').postMessage(ogTags); } catch (e) {} }
  } catch (e) {}
}

// ── Swatch Request Form ───────────────────────────────────────────────

export function initSwatchRequest($w, state) {
  try {
    const btn = $w('#swatchRequestBtn');
    if (!btn || !state.product) return;
    const hasOptions = state.product.productOptions?.some(opt => /finish|fabric|color|cover/i.test(opt.name));
    if (!hasOptions) { btn.hide(); return; }
    btn.show();
    btn.onClick(() => openSwatchModal($w, state));
    try { $w('#swatchSubmit').onClick(() => handleSwatchSubmit($w, state)); } catch (e) {}
  } catch (e) {}
}

function openSwatchModal($w, state) {
  try {
    const modal = $w('#swatchModal');
    if (!modal) return;
    try { $w('#swatchProductName').text = state.product.name; } catch (e) {}
    try {
      const rep = $w('#swatchOptions');
      if (rep) {
        const opts = [];
        (state.product.productOptions || []).forEach(opt => {
          if (/finish|fabric|color|cover/i.test(opt.name)) {
            (opt.choices || []).forEach(c => opts.push({ _id: c.value, label: c.description || c.value, optionName: opt.name, checked: false }));
          }
        });
        rep.data = opts;
        rep.onItemReady(($item, d) => { try { $item('#swatchCheckbox').label = d.label; $item('#swatchCheckbox').checked = false; } catch (e) {} });
      }
    } catch (e) {}
    try { $w('#swatchName').value = ''; } catch (e) {}
    try { $w('#swatchEmail').value = ''; } catch (e) {}
    try { $w('#swatchAddress').value = ''; } catch (e) {}
    try { $w('#swatchSuccess').hide(); } catch (e) {}
    modal.show('fade', { duration: 200 });
  } catch (e) {}
}

async function handleSwatchSubmit($w, state) {
  try {
    const name = $w('#swatchName').value?.trim();
    const email = $w('#swatchEmail').value?.trim();
    const address = $w('#swatchAddress').value?.trim();
    if (!name || !email || !address) return;
    const selected = [];
    try {
      $w('#swatchOptions').forEachItem(($item, d) => {
        try { if ($item('#swatchCheckbox').checked) selected.push(d.label); } catch (e) {}
      });
    } catch (e) {}
    if (selected.length === 0) return;
    $w('#swatchSubmit').disable();
    await submitSwatchRequest({ name, email, address, productId: state.product._id, productName: state.product.name, swatchNames: selected });
    try { $w('#swatchSuccess').show('fade', { duration: 300 }); } catch (e) {}
    setTimeout(() => { try { $w('#swatchModal').hide('fade', { duration: 200 }); $w('#swatchSubmit').enable(); } catch (e) {} }, 3000);
  } catch (err) {
    console.error('Error submitting swatch request:', err);
    try {
      $w('#swatchSubmit').enable();
      const msg = $w('#swatchError');
      if (msg) { msg.text = 'Something went wrong. Please call us at (828) 252-9449.'; msg.show('fade', { duration: 300 }); }
    } catch (e) {}
  }
}
