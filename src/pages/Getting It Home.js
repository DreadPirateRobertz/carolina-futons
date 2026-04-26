// Getting It Home.js — Delivery options and assembly service tiers for Carolina Futons.
// URL: /getting-it-home
// cf-z8sj

import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { makeClickable } from 'public/a11yHelpers.js';
import { initPageSeo } from 'public/pageSeo.js';
import { getIntroText, getServiceTiers, getDeliveryRates, getAssemblyGuides, getCareTips, getCareTipCategories, getDeliveryPrepInstructions, getDeliveryTierOptions, buildShippingSchemaHtml } from 'public/deliveryHelpers.js';
import { to } from 'wix-location-frontend';

$w.onReady(function () {
  initBackToTop($w);
  initPageSeo('getting-it-home');
  initIntro();
  initServiceTiers();
  initDeliveryRates();
  initAssemblyGuides();
  initCareTips();
  initDeliveryPrep();
  initScheduleDelivery();
  initShippingSchema();
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

function initAssemblyGuides() {
  const repeater = $w('#assemblyGuidesRepeater');
  repeater.accessibility.ariaLabel = 'Step-by-step assembly guides';
  repeater.onItemReady(($item, itemData) => {
    $item('#guideTitle').text = itemData.title;
    $item('#guideTime').text = itemData.time;
    $item('#guideTools').text = itemData.tools;
    $item('#guideSteps').text = itemData.steps;
    $item('#guideExpandBtn').onClick(() => {
      const stepsEl = $item('#guideSteps');
      if (stepsEl.collapsed) {
        stepsEl.expand();
      } else {
        stepsEl.collapse();
      }
    });
  });
  repeater.data = getAssemblyGuides();
}

function initCareTips() {
  const repeater = $w('#careTipsRepeater');
  const dropdown = $w('#careCategoryDropdown');

  repeater.accessibility.ariaLabel = 'Furniture care tips';
  repeater.onItemReady(($item, itemData) => {
    $item('#careTipTitle').text = itemData.title;
    $item('#careTipContent').text = itemData.content;
  });
  repeater.data = getCareTips(null);

  const categories = getCareTipCategories();
  dropdown.options = categories.map(c => ({ label: c.label, value: c.id }));
  dropdown.onChange((event) => {
    repeater.data = getCareTips(event.target.value);
  });
}

function initDeliveryPrep() {
  const dropdown = $w('#deliveryTierDropdown');
  dropdown.options = getDeliveryTierOptions().map(o => ({ label: o.label, value: o.id }));
  dropdown.onChange((event) => {
    $w('#deliveryPrepInstructions').text = getDeliveryPrepInstructions(event.target.value);
  });
}

function initScheduleDelivery() {
  $w('#scheduleDeliveryBtn').onClick(() => to('/contact?topic=schedule-delivery'));
}

function initShippingSchema() {
  $w('#shippingSchemaHtml').html = buildShippingSchemaHtml();
}

function initNavLinks() {
  makeClickable($w('#deliveryFaqLink'), () => to('/faq'), { ariaLabel: 'View assembly videos and FAQs' });
  makeClickable($w('#deliveryContactLink'), () => to('/contact'), { ariaLabel: 'Contact us about delivery rates' });
}
