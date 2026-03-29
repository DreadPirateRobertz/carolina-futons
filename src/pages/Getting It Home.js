// Getting It Home.js — Delivery options and assembly service tiers for Carolina Futons.
// URL: /getting-it-home
// cf-z8sj

import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { makeClickable } from 'public/a11yHelpers.js';
import { initPageSeo } from 'public/pageSeo.js';
import { getIntroText, getServiceTiers, getDeliveryRates } from 'public/deliveryHelpers.js';
import { to } from 'wix-location-frontend';

$w.onReady(function () {
  initBackToTop($w);
  initPageSeo('getting-it-home');
  initIntro();
  initServiceTiers();
  initDeliveryRates();
  initNavLinks();
  trackEvent('page_view', { page: 'getting-it-home' });
});

function initIntro() {
  $w('#deliveryIntro').text = getIntroText();
}

function initServiceTiers() {
  const repeater = $w('#serviceTierRepeater');
  repeater.accessibility.ariaLabel = 'Delivery and assembly service options';
  repeater.onItemReady(($item, itemData) => {
    $item('#tierTitle').text = itemData.title;
    $item('#tierPrice').text = itemData.price;
    $item('#tierDescription').text = itemData.description;
  });
  repeater.data = getServiceTiers();
}

function initDeliveryRates() {
  const rates = getDeliveryRates();
  $w('#deliveryMinCharge').text = `Minimum local charge (up to approx. ${rates.minimumRadius} radius from our store) ${rates.minimumCharge}`;
  $w('#deliveryRateNote').text = rates.note;
}

function initNavLinks() {
  makeClickable($w('#deliveryFaqLink'), () => to('/faq'), { ariaLabel: 'View assembly videos and FAQs' });
  makeClickable($w('#deliveryContactLink'), () => to('/contact'), { ariaLabel: 'Contact us about delivery rates' });
}
