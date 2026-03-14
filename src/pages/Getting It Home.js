// Getting It Home.js - Assembly & Delivery Information
// Service tiers, delivery rates, and assembly options
import { initPageSeo } from 'public/pageSeo.js';
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { makeClickable } from 'public/a11yHelpers.js';
import { getIntroText, getServiceTiers, getDeliveryRates } from 'public/deliveryHelpers.js';

$w.onReady(async function () {
  initBackToTop($w);
  initIntro();
  initServiceTiers();
  initDeliveryRates();
  initNavLinks();
  initPageSeo('getting-it-home');
  trackEvent('page_view', { page: 'getting-it-home' });
});

// ── Intro Section ───────────────────────────────────────────────────

function initIntro() {
  try {
    const intro = $w('#deliveryIntro');
    if (intro) intro.text = getIntroText();
  } catch (e) { /* Element may not exist in template */ }
}

// ── Service Tiers ───────────────────────────────────────────────────

function initServiceTiers() {
  try {
    const repeater = $w('#serviceTierRepeater');
    if (!repeater) return;

    try { repeater.accessibility.ariaLabel = 'Delivery and assembly service options'; } catch (e) {}
    repeater.onItemReady(($item, itemData) => {
      try { $item('#tierTitle').text = itemData.title; } catch (e) {}
      try { $item('#tierPrice').text = itemData.price; } catch (e) {}
      try { $item('#tierDescription').text = itemData.description; } catch (e) {}
    });
    repeater.data = getServiceTiers();
  } catch (e) { /* Repeater may not exist in template */ }
}

// ── Delivery Rates ──────────────────────────────────────────────────

function initDeliveryRates() {
  try {
    const rates = getDeliveryRates();
    try {
      const chargeEl = $w('#deliveryMinCharge');
      if (chargeEl) chargeEl.text = `Minimum local charge (up to approx. ${rates.minimumRadius} radius from our store) ${rates.minimumCharge}`;
    } catch (e) {}
    try {
      const noteEl = $w('#deliveryRateNote');
      if (noteEl) noteEl.text = rates.note;
    } catch (e) {}
  } catch (e) { /* Rate elements may not exist */ }
}

// ── Navigation Links ────────────────────────────────────────────────

function initNavLinks() {
  try {
    makeClickable($w('#deliveryFaqLink'), () => {
      import('wix-location-frontend').then(({ to }) => to('/faq'));
    }, { ariaLabel: 'View assembly videos and FAQs' });
  } catch (e) {}

  try {
    makeClickable($w('#deliveryContactLink'), () => {
      import('wix-location-frontend').then(({ to }) => to('/contact'));
    }, { ariaLabel: 'Contact us about delivery rates' });
  } catch (e) {}
}
