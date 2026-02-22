// productDetails.js - Info Accordion, Video, Delivery Estimate, Stock Urgency, Back-in-Stock
// Collapsible info sections, product demo video, delivery date range,
// stock urgency indicators, and back-in-stock email notification.

import { getProductVariants } from 'public/cartService';

// ── Product Info Accordion ─────────────────────────────────────────

/**
 * Initialize collapsible sections for Description, Dimensions, Care, Shipping.
 */
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
          content.expand();
          openStates[section] = true;
          try { $w(`#infoArrow${section}`).text = '\u2212'; } catch (e) {}
          try { header.accessibility.ariaExpanded = true; } catch (e) {}
        } else {
          content.collapse();
          openStates[section] = false;
          try { $w(`#infoArrow${section}`).text = '+'; } catch (e) {}
          try { header.accessibility.ariaExpanded = false; } catch (e) {}
        }

        header.onClick(() => {
          if (openStates[section]) {
            content.collapse();
            openStates[section] = false;
            try { $w(`#infoArrow${section}`).text = '+'; } catch (e) {}
            try { header.accessibility.ariaExpanded = false; } catch (e) {}
          } else {
            content.expand();
            openStates[section] = true;
            try { $w(`#infoArrow${section}`).text = '\u2212'; } catch (e) {}
            try { header.accessibility.ariaExpanded = true; } catch (e) {}
          }
        });
      } catch (e) {}
    });

    try {
      $w('#infoContentShipping').text =
        'Free standard shipping on orders $999+. ' +
        'White-glove delivery available: $149 local (WNC), $249 regional, free on orders over $1,999. ' +
        'Standard delivery: 5\u201310 business days. ' +
        'Local customers: call (828) 252-9449 to schedule Wed\u2013Sat delivery.';
    } catch (e) {}
  } catch (e) {
    // Accordion elements may not exist — non-critical
  }
}

// ── Product Video ──────────────────────────────────────────────────

/**
 * Show product demo video if the product has video media items.
 */
export function initProductVideo($w, product) {
  try {
    const videoSection = $w('#productVideoSection');
    if (!videoSection || !product) return;

    const mediaItems = product.mediaItems || [];
    const videoItem = mediaItems.find(item =>
      item.mediaType === 'video' || item.type === 'video'
    );

    if (!videoItem) {
      videoSection.collapse();
      return;
    }

    try {
      $w('#productVideoTitle').text = 'See It In Action';
    } catch (e) {}

    try {
      const player = $w('#productVideo');
      if (player) {
        if (videoItem.src) {
          player.src = videoItem.src;
        } else if (videoItem.url) {
          player.src = videoItem.url;
        }
        player.mute();
      }
    } catch (e) {}

    try {
      $w('#viewAllVideosLink').onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
          to('/product-videos');
        });
      });
    } catch (e) {}

    videoSection.expand();
  } catch (e) {
    try { $w('#productVideoSection').collapse(); } catch (e2) {}
  }
}

// ── Stock Urgency Indicators ─────────────────────────────────────

/**
 * Show "Only X left" warning and popularity badge.
 */
export async function initStockUrgency($w, product) {
  try {
    if (!product) return;

    try {
      const stockUrgency = $w('#stockUrgency');
      if (stockUrgency) {
        if (product.quantityInStock != null && product.quantityInStock < 5 && product.quantityInStock > 0) {
          stockUrgency.text = `Only ${product.quantityInStock} left in stock`;
          stockUrgency.show();
        } else {
          stockUrgency.hide();
        }
      }
    } catch (e) {}

    try {
      const badge = $w('#popularityBadge');
      if (badge) {
        const analytics = await import('wix-data').then(mod =>
          mod.default.query('ProductAnalytics')
            .eq('productId', product._id)
            .find()
        );

        if (analytics.items.length > 0 && analytics.items[0].weekSales > 0) {
          badge.text = `Popular \u2014 ${analytics.items[0].weekSales} sold this week`;
          badge.show();
        } else {
          badge.hide();
        }
      }
    } catch (e) {
      try { $w('#popularityBadge').hide(); } catch (e2) {}
    }
  } catch (e) {}
}

// ── Delivery Estimate ────────────────────────────────────────────

/**
 * Show estimated delivery range (5-10 business days from today).
 */
export function initDeliveryEstimate($w, product) {
  try {
    const el = $w('#deliveryEstimate');
    if (!el || !product) return;

    const today = new Date();
    const minDate = addBusinessDays(today, 5);
    const maxDate = addBusinessDays(today, 10);

    const opts = { month: 'short', day: 'numeric', year: 'numeric' };
    const minStr = minDate.toLocaleDateString('en-US', opts);
    const maxStr = maxDate.toLocaleDateString('en-US', opts);

    el.text = `Estimated delivery: ${minStr} \u2013 ${maxStr}`;
    el.show();

    try {
      const isLargeItem = product.weight > 50 ||
        (product.collections || []).some(c => /murphy|platform|futon|frame/i.test(c));
      if (isLargeItem) {
        const whiteGloveEl = $w('#whiteGloveNote');
        if (whiteGloveEl) {
          whiteGloveEl.text = 'White-glove delivery available \u2014 call (828) 252-9449 to schedule';
          whiteGloveEl.show();
        }
      }
    } catch (e) {}
  } catch (e) {}
}

function addBusinessDays(startDate, days) {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

// ── Back-in-Stock Notification ──────────────────────────────────────

/**
 * Show email signup when a variant is out of stock / special order.
 */
export async function initBackInStockNotification($w, product) {
  try {
    const section = $w('#backInStockSection');
    const emailInput = $w('#backInStockEmail');
    const submitBtn = $w('#backInStockBtn');
    const successMsg = $w('#backInStockSuccess');

    if (!section || !emailInput || !submitBtn) return;

    section.collapse();
    if (successMsg) successMsg.hide();

    updateBackInStockVisibility($w, product, section);

    const sizeDropdown = $w('#sizeDropdown');
    const finishDropdown = $w('#finishDropdown');
    if (sizeDropdown) sizeDropdown.onChange(() => updateBackInStockVisibility($w, product, section));
    if (finishDropdown) finishDropdown.onChange(() => updateBackInStockVisibility($w, product, section));

    submitBtn.onClick(async () => {
      const email = emailInput.value?.trim();
      if (!email || !email.includes('@')) return;

      try {
        const { submitContactForm } = await import('backend/contactSubmissions.web');
        await submitContactForm({
          email,
          source: 'back_in_stock',
          status: 'back_in_stock_request',
          productId: product?._id || '',
          productName: product?.name || '',
          notes: `Back in stock request for ${product?.name || 'unknown product'}`,
        });

        submitBtn.hide();
        emailInput.hide();
        if (successMsg) {
          successMsg.text = "We'll email you when this item is back in stock!";
          successMsg.show('fade', { duration: 300 });
        }
      } catch (err) {
        console.error('Back in stock submission error:', err);
      }
    });
  } catch (e) {
    // Back-in-stock is non-critical
  }
}

async function updateBackInStockVisibility($w, product, section) {
  try {
    const size = $w('#sizeDropdown')?.value;
    const finish = $w('#finishDropdown')?.value;

    if (!size && !finish) {
      const stockBadge = $w('#stockStatus');
      if (stockBadge && stockBadge.text === 'Special Order') {
        section.expand();
      }
      return;
    }

    const choices = {};
    if (size) choices['Size'] = size;
    if (finish) choices['Finish'] = finish;

    const variants = await getProductVariants(product._id, choices);
    if (variants && variants.length > 0 && !variants[0].inStock) {
      section.expand();
    } else {
      section.collapse();
    }
  } catch (e) {
    // Default to hidden if we can't check stock
  }
}
