// Terms & Conditions.js - Terms of Service Page
// Code-driven policy content with accordion sections and TOC navigation
import { initBackToTop, collapseOnMobile } from 'public/mobileHelpers';
import { initPageSeo } from 'public/pageSeo.js';

$w.onReady(function () {
  initPageSeo('termsConditions');
  initTermsContent();
  initTermsNavigation();
  try { collapseOnMobile($w, ['#termsTocRepeater']); } catch (e) {}
  try { initBackToTop($w); } catch (e) {}
});

const TERMS_SECTIONS = [
  {
    _id: '1',
    title: 'Acceptance of Terms',
    anchor: '#termsAcceptance',
    content:
      'By accessing or using carolinafutons.com, you agree to be bound by these Terms & Conditions. If you do not agree, please do not use our website or services. We reserve the right to update these terms at any time; continued use of the site constitutes acceptance of any changes.',
  },
  {
    _id: '2',
    title: 'Products & Pricing',
    anchor: '#termsProducts',
    content:
      'We strive to display accurate product descriptions, images, and pricing. However:\n\n' +
      '\u2022 Colors may vary slightly between your screen and the actual product due to monitor settings and material variations\n' +
      '\u2022 Prices are listed in US dollars and are subject to change without notice\n' +
      '\u2022 We reserve the right to correct pricing errors. If an item is listed at an incorrect price, we will contact you before processing the order\n' +
      '\u2022 Product availability is not guaranteed. Items may sell out or be discontinued\n' +
      '\u2022 Some products are available for "Call for Price" \u2014 contact us at (828) 252-9449 for current pricing\n' +
      '\u2022 Free swatches are available for most fabric options so you can verify colors before purchasing',
  },
  {
    _id: '3',
    title: 'Orders & Payment',
    anchor: '#termsOrders',
    content:
      'When you place an order:\n\n' +
      '\u2022 Your order is an offer to purchase. We may accept or decline orders at our discretion\n' +
      '\u2022 Order confirmation emails are sent automatically but do not guarantee acceptance\n' +
      '\u2022 We accept Visa, Mastercard, American Express, Discover, PayPal, and Afterpay\n' +
      '\u2022 Payment is collected at the time of order placement\n' +
      '\u2022 North Carolina sales tax is applied where required by law\n' +
      '\u2022 For financing options, see our financing page or contact us for details',
  },
  {
    _id: '4',
    title: 'Shipping & Delivery',
    anchor: '#termsShipping',
    content:
      'Shipping details:\n\n' +
      '\u2022 We ship to all 50 US states. Free shipping on orders over $999\n' +
      '\u2022 Standard shipping: 5\u201314 business days depending on destination and product\n' +
      '\u2022 Local delivery available in the Hendersonville/Asheville area with optional in-home setup\n' +
      '\u2022 In-store pickup available at our showroom: 824 Locust St, Ste 200, Hendersonville, NC 28792\n' +
      '\u2022 White glove delivery (assembly and placement) available in select areas\n' +
      '\u2022 Delivery dates are estimates and not guaranteed. Delays may occur due to carrier schedules, weather, or product availability\n' +
      '\u2022 Please inspect all items upon delivery and note any damage on the carrier\u2019s delivery receipt',
  },
  {
    _id: '5',
    title: 'Returns & Refunds',
    anchor: '#termsReturns',
    content:
      'Our return policy:\n\n' +
      '\u2022 Items may be returned within 30 days of delivery in original, unused condition with all packaging\n' +
      '\u2022 Contact us at (828) 252-9449 for a Return Authorization number before shipping any return\n' +
      '\u2022 Custom-ordered items (including custom fabric covers) are final sale\n' +
      '\u2022 Return shipping costs are the customer\u2019s responsibility unless the return is due to our error or a defect\n' +
      '\u2022 Refunds are processed within 5\u20137 business days of receiving the return\n' +
      '\u2022 Refunds are issued to the original payment method\n' +
      '\u2022 See our full Refund Policy page for complete details',
  },
  {
    _id: '6',
    title: 'Warranties',
    anchor: '#termsWarranties',
    content:
      'Product warranties are provided by the manufacturer:\n\n' +
      '\u2022 Night & Day Furniture: limited 3-year warranty against manufacturing defects\n' +
      '\u2022 KD Frames: 5-year warranty against manufacturing defects\n' +
      '\u2022 Otis Bed mattresses: see manufacturer warranty card included with product\n' +
      '\u2022 Strata furniture: see manufacturer warranty documentation\n\n' +
      'Warranties do not cover normal wear and tear, misuse, improper assembly, or damage from accidents. Contact us to initiate a warranty claim \u2014 we will work with the manufacturer on your behalf.',
  },
  {
    _id: '7',
    title: 'Intellectual Property',
    anchor: '#termsIP',
    content:
      'All content on carolinafutons.com \u2014 including text, images, logos, product descriptions, and design \u2014 is owned by Carolina Futons or our licensors and is protected by copyright and trademark law. You may not reproduce, distribute, or use our content without written permission.',
  },
  {
    _id: '8',
    title: 'Limitation of Liability',
    anchor: '#termsLiability',
    content:
      'Carolina Futons provides this website and its contents on an "as is" basis. To the fullest extent permitted by law:\n\n' +
      '\u2022 We make no warranties, express or implied, regarding the site\u2019s accuracy, completeness, or availability\n' +
      '\u2022 We are not liable for indirect, incidental, or consequential damages arising from your use of the site or purchase of products\n' +
      '\u2022 Our total liability for any claim related to a purchase shall not exceed the amount you paid for that product\n' +
      '\u2022 We are not responsible for third-party website content linked from our site',
  },
  {
    _id: '9',
    title: 'Governing Law',
    anchor: '#termsGoverning',
    content:
      'These terms are governed by the laws of the State of North Carolina without regard to conflict of law principles. Any disputes shall be resolved in the courts of Henderson County, North Carolina.',
  },
  {
    _id: '10',
    title: 'Contact Information',
    anchor: '#termsContact',
    content:
      'For questions about these terms, contact us:\n\n' +
      'Carolina Futons\n' +
      '824 Locust St, Ste 200\n' +
      'Hendersonville, NC 28792\n' +
      'Phone: (828) 252-9449\n' +
      'Website: carolinafutons.com/contact',
  },
];

function initTermsContent() {
  try {
    try { $w('#termsTitle').text = 'Terms & Conditions'; } catch (e) {}
    try { $w('#termsEffectiveDate').text = 'Effective Date: March 14, 2026'; } catch (e) {}
    try {
      $w('#termsIntro').text =
        'Welcome to carolinafutons.com, operated by Carolina Futons in Hendersonville, North Carolina. These terms govern your use of our website and purchase of our products.';
    } catch (e) {}

    const repeater = $w('#termsRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      $item('#sectionTitle').text = itemData.title;
      $item('#sectionContent').text = itemData.content;

      // Start collapsed
      $item('#sectionContent').collapse();
      $item('#sectionToggle').text = '+';

      try { $item('#sectionTitle').accessibility.role = 'button'; } catch (e) {}
      try { $item('#sectionTitle').accessibility.ariaLabel = `Toggle ${itemData.title}`; } catch (e) {}
      try { $item('#sectionToggle').accessibility.ariaExpanded = false; } catch (e) {}

      $item('#sectionTitle').onClick(() => {
        if ($item('#sectionContent').collapsed) {
          $item('#sectionContent').expand();
          $item('#sectionToggle').text = '\u2212';
          try { $item('#sectionToggle').accessibility.ariaExpanded = true; } catch (e) {}
        } else {
          $item('#sectionContent').collapse();
          $item('#sectionToggle').text = '+';
          try { $item('#sectionToggle').accessibility.ariaExpanded = false; } catch (e) {}
        }
      });
    });
    repeater.data = TERMS_SECTIONS;
  } catch (e) {}
}

function initTermsNavigation() {
  try {
    const tocRepeater = $w('#termsTocRepeater');
    if (!tocRepeater) return;

    try { tocRepeater.accessibility.ariaLabel = 'Terms and conditions table of contents'; } catch (e) {}
    tocRepeater.onItemReady(($item, itemData) => {
      $item('#tocLink').text = itemData.title;
      try { $item('#tocLink').accessibility.ariaLabel = `Jump to ${itemData.title}`; } catch (e) {}
      $item('#tocLink').onClick(() => {
        try {
          $w(itemData.anchor).scrollTo();
        } catch (e) {}
      });
    });
    tocRepeater.data = TERMS_SECTIONS;
  } catch (e) {}
}
