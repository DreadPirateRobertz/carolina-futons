/**
<<<<<<< HEAD
 * PAGES data bundle — S2 (CF-4rv2).
 * Extracted from docs/EDITOR_HOOKUP_GUIDE.html.
 * 31 pages, 1093+ elements. DO NOT edit by hand — re-run extraction script.
 */
import type { PageDef, ElementDef, SectionDef } from '../types/index.js';

export const PAGES: PageDef[] = [
  {
    name: 'Home',
    file: 'Home.c1dmp.js',
    priority: 'P0',
    est: '45 min',
    sections: [
      {
        name: 'Hero Section',
        elements: [
          { id: 'heroSection', type: 'Section', notes: 'Full-width, bg set by code (#3A2518)' },
          { id: 'heroBg', type: 'Image', notes: 'Hero background image' },
          { id: 'heroOverlay', type: 'Box', notes: 'Transparent overlay' },
          { id: 'heroTitle', type: 'Text', notes: 'H1, code sets text', defaultHidden: true },
          { id: 'heroSubtitle', type: 'Text', notes: 'Subheading', defaultHidden: true },
          { id: 'heroCTA', type: 'Button', notes: 'Shop Now button', defaultHidden: true },
          { id: 'heroSkyline', type: 'Box', notes: 'Mountain skyline animation container' },
        ],
      },
      {
        name: 'Featured Products',
        repeater: 'featuredRepeater',
        elements: [
          { id: 'featuredTitle', type: 'Text', notes: 'Section heading' },
          { id: 'featuredSubtitle', type: 'Text', notes: 'Section subheading' },
          { id: 'featuredSkeleton', type: 'Box', notes: 'Loading placeholder', defaultHidden: true },
          { id: 'featuredRepeater', type: 'Repeater', notes: '4 product cards' },
          { id: 'featuredQuickViewModal', type: 'Box', notes: 'Hidden modal dialog', defaultHidden: true },
          { id: 'featuredQvImage', type: 'Image', notes: 'Modal child', defaultHidden: true },
          { id: 'featuredQvName', type: 'Text', notes: 'Modal child', defaultHidden: true },
          { id: 'featuredQvPrice', type: 'Text', notes: 'Modal child', defaultHidden: true },
          { id: 'featuredQvViewFull', type: 'Button', notes: 'Modal child', defaultHidden: true },
          { id: 'featuredQvAddToCart', type: 'Button', notes: 'Modal child', defaultHidden: true },
          { id: 'featuredQvClose', type: 'Button', notes: 'Modal child - X button', defaultHidden: true },
        ],
        children: [
          { id: 'featuredCard', type: 'Box', notes: 'Card container' },
          { id: 'featuredImage', type: 'Image', notes: 'Product image' },
          { id: 'featuredName', type: 'Text', notes: 'Product name' },
          { id: 'featuredPrice', type: 'Text', notes: 'Current price' },
          { id: 'featuredOriginalPrice', type: 'Text', notes: 'Strikethrough price', defaultHidden: true },
          { id: 'featuredSaleBadge', type: 'Text', notes: 'X% OFF badge' },
          { id: 'featuredRibbon', type: 'Text', notes: 'New/Sale ribbon' },
          { id: 'featuredColorText', type: 'Text', notes: 'Available in X colors' },
          { id: 'featuredSwatchContainer', type: 'Box', notes: 'Color swatch dots' },
          { id: 'featuredQuickViewBtn', type: 'Button', notes: 'Quick view trigger', defaultHidden: true },
        ],
      },
      {
        name: 'Sale Products',
        repeater: 'saleRepeater',
        elements: [
          { id: 'saleSection', type: 'Section', notes: 'Collapsible - hides if no sales' },
          { id: 'saleSkeleton', type: 'Box', notes: 'Loading placeholder' },
          { id: 'saleRepeater', type: 'Repeater', notes: 'Sale product cards' },
        ],
        children: [
          { id: 'saleCard', type: 'Box', notes: 'Card container' },
          { id: 'saleImage', type: 'Image', notes: 'Product image' },
          { id: 'saleName', type: 'Text', notes: 'Product name' },
          { id: 'salePrice', type: 'Text', notes: 'Sale price' },
          { id: 'saleOrigPrice', type: 'Text', notes: 'Original price' },
        ],
      },
      {
        name: 'Category Cards',
        repeater: 'categoryRepeater',
        elements: [
          { id: 'categorySkeleton', type: 'Box', notes: 'Loading placeholder' },
          { id: 'categoryRepeater', type: 'Repeater', notes: '8 category cards' },
        ],
        children: [
          { id: 'categoryCard', type: 'Box', notes: 'Card with bg image' },
          { id: 'categoryCardTitle', type: 'Text', notes: 'Category name' },
          { id: 'categoryCardTagline', type: 'Text', notes: 'Category tagline' },
          { id: 'categoryCardCount', type: 'Text', notes: 'Product count' },
          { id: 'categoryCardImage', type: 'Image', notes: 'Category image' },
        ],
      },
      {
        name: 'Trust Bar',
        elements: [
          { id: 'trustBar', type: 'Box', notes: 'DONE - Espresso bg #3A2518' },
          { id: 'trustItem1', type: 'Box', notes: 'Trust signal container' },
          { id: 'trustIcon1', type: 'Text', notes: 'Emoji icon' },
          { id: 'trustText1', type: 'Text', notes: 'Signal text' },
          { id: 'trustItem2', type: 'Box', notes: 'Trust signal container' },
          { id: 'trustIcon2', type: 'Text', notes: 'Emoji icon' },
          { id: 'trustText2', type: 'Text', notes: 'Signal text' },
          { id: 'trustItem3', type: 'Box', notes: 'Trust signal container' },
          { id: 'trustIcon3', type: 'Text', notes: 'Emoji icon' },
          { id: 'trustText3', type: 'Text', notes: 'Signal text' },
          { id: 'trustItem4', type: 'Box', notes: 'Trust signal container (may be hidden)' },
          { id: 'trustIcon4', type: 'Text', notes: 'Emoji icon' },
          { id: 'trustText4', type: 'Text', notes: 'Signal text' },
          { id: 'trustItem5', type: 'Box', notes: 'Trust signal container' },
          { id: 'trustIcon5', type: 'Text', notes: 'Emoji icon' },
          { id: 'trustText5', type: 'Text', notes: 'Signal text' },
        ],
      },
      {
        name: 'Testimonials',
        repeater: 'testimonialRepeater',
        elements: [
          { id: 'testimonialSection', type: 'Section', notes: 'Container' },
          { id: 'testimonialRepeater', type: 'Repeater', notes: 'Rotating testimonials' },
          { id: 'testimonialSchemaScript', type: 'HtmlComponent', notes: 'SEO schema (code uses testimonialSchemaScript)' },
          { id: 'testimonialSlideshow', type: 'Box', notes: 'Slideshow wrapper' },
          { id: 'testimonialPauseBtn', type: 'Button', notes: 'Pause/play toggle' },
        ],
        children: [
          { id: 'testimonialQuote', type: 'Text', notes: 'Quote text' },
          { id: 'testimonialName', type: 'Text', notes: 'Customer name' },
          { id: 'testimonialPhoto', type: 'Image', notes: 'Customer photo' },
          { id: 'testimonialRating', type: 'Text', notes: 'Star rating' },
        ],
      },
      {
        name: 'Recently Viewed',
        repeater: 'recentRepeater',
        elements: [
          { id: 'recentSection', type: 'Section', notes: 'Collapsible' },
          { id: 'recentRepeater', type: 'Repeater', notes: 'Recently viewed products' },
        ],
        children: [
          { id: 'recentImage', type: 'Image', notes: 'Product image' },
          { id: 'recentName', type: 'Text', notes: 'Product name' },
          { id: 'recentPrice', type: 'Text', notes: 'Price' },
          { id: 'recentAddToCart', type: 'Button', notes: 'Add to cart' },
        ],
      },
      {
        name: 'Video Showcase',
        elements: [
          { id: 'videoShowcaseSection', type: 'Section', notes: 'Collapsible' },
          { id: 'videoShowcaseTitle', type: 'Text', notes: 'Heading' },
          { id: 'videoShowcaseSubtitle', type: 'Text', notes: 'Subheading' },
          { id: 'viewAllVideosCTA', type: 'Button', notes: 'Videos page link' },
          { id: 'videoThumb1', type: 'Image', notes: 'Clickable video thumbnail' },
          { id: 'videoThumb2', type: 'Image', notes: 'Clickable video thumbnail' },
          { id: 'videoThumb3', type: 'Image', notes: 'Clickable video thumbnail' },
        ],
      },
      {
        name: 'Smooth Scroll Triggers',
        elements: [
          { id: 'scrollToFeatured', type: 'Button', notes: 'Scroll to featured' },
          { id: 'scrollToCategories', type: 'Button', notes: 'Scroll to categories' },
          { id: 'scrollToSale', type: 'Button', notes: 'Scroll to sale' },
          { id: 'scrollToReviews', type: 'Button', notes: 'Scroll to reviews' },
        ],
      },
      {
        name: 'Quiz CTA',
        elements: [
          { id: 'quizCTASection', type: 'Section', notes: 'Collapsible' },
          { id: 'quizCTATitle', type: 'Text', notes: 'Find Your Perfect Futon' },
          { id: 'quizCTASubtitle', type: 'Text', notes: 'Description' },
          { id: 'quizCTAButton', type: 'Button', notes: 'Start quiz' },
        ],
      },
      {
        name: 'Swatch Promo',
        elements: [
          { id: 'swatchPromoSection', type: 'Section', notes: 'Container' },
          { id: 'swatchPromoTitle', type: 'Text', notes: 'Heading' },
          { id: 'swatchPromoSubtitle', type: 'Text', notes: 'Subheading' },
          { id: 'swatchPromoCTA', type: 'Button', notes: 'Order swatches' },
        ],
      },
      {
        name: 'Blog Teasers',
        elements: [
          { id: 'blogTeaserSection', type: 'HtmlComponent', notes: 'Blog post cards — 3 recent posts' },
        ],
      },
      {
        name: 'Social Feeds',
        elements: [
          { id: 'instagramFeedContainer', type: 'HtmlComponent', notes: 'Instagram embed iframe' },
          { id: 'tiktokFeedContainer', type: 'HtmlComponent', notes: 'TikTok follow card' },
          { id: 'pinterestBoardContainer', type: 'HtmlComponent', notes: 'Pinterest follow card' },
        ],
      },
      {
        name: 'Newsletter',
        elements: [
          { id: 'newsletterSection', type: 'Section', notes: 'Container', defaultHidden: true },
          { id: 'newsletterTitle', type: 'Text', notes: 'Heading', defaultHidden: true },
          { id: 'newsletterSubtitle', type: 'Text', notes: 'Subheading', defaultHidden: true },
          { id: 'newsletterEmail', type: 'Input', notes: 'Email field', defaultHidden: true },
          { id: 'newsletterSubmit', type: 'Button', notes: 'Subscribe', defaultHidden: true },
          { id: 'newsletterSuccess', type: 'Text', notes: 'Hidden success msg', defaultHidden: true },
          { id: 'newsletterError', type: 'Text', notes: 'Hidden error msg', defaultHidden: true },
        ],
      },
      {
        name: 'Gift Card Section (CF-mwpw)',
        elements: [
          { id: 'giftCardSection', type: 'Section', notes: 'Gift card CTA hero — links to /gift-cards' },
          { id: 'giftCardHeroText', type: 'Text', notes: 'Heading text, set by code' },
          { id: 'giftCardCta', type: 'Button', notes: 'Shop Gift Cards CTA button' },
        ],
      },
      {
        name: 'SEO / Decorative',
        elements: [
          { id: 'websiteSchemaHtml', type: 'HtmlComponent', notes: 'SEO schema' },
          { id: 'ridgelineHeader', type: 'Box', notes: 'Mountain skyline' },
          { id: 'section4', type: 'Section', notes: 'Collapsible misc' },
        ],
      },
    ],
  },
  {
    name: 'masterPage (Global)',
    file: 'masterPage.js',
    priority: 'P0',
    est: '60 min',
    sections: [
      {
        name: 'Accessibility',
        elements: [
          { id: 'mainContent', type: 'Section', notes: 'Skip-nav target' },
          { id: 'skipToContent', type: 'Button', notes: 'Skip navigation link' },
          { id: 'a11yLiveRegion', type: 'Text', notes: 'Hidden screen reader' },
        ],
      },
      {
        name: 'Navigation',
        elements: [
          { id: 'navHome', type: 'Text', notes: 'Nav link' },
          { id: 'navShop', type: 'Text', notes: 'Nav link' },
          { id: 'navFutonFrames', type: 'Text', notes: 'Nav link' },
          { id: 'navMattresses', type: 'Text', notes: 'Nav link' },
          { id: 'navMurphy', type: 'Text', notes: 'Nav link' },
          { id: 'navPlatformBeds', type: 'Text', notes: 'Nav link' },
          { id: 'navSale', type: 'Text', notes: 'Nav link' },
          { id: 'navProductVideos', type: 'Text', notes: 'Nav link' },
          { id: 'navGettingItHome', type: 'Text', notes: 'Nav link' },
          { id: 'navContact', type: 'Text', notes: 'Nav link' },
          { id: 'navFAQ', type: 'Text', notes: 'Nav link' },
          { id: 'navAbout', type: 'Text', notes: 'Nav link' },
          { id: 'navBlog', type: 'Text', notes: 'Nav link' },
          { id: 'navGiftCards', type: 'Text', notes: 'Nav link — Gift Cards (CF-t6b8)' },
          { id: 'navFreeSwatches', type: 'Text', notes: 'Nav link' },
          { id: 'siteLogo', type: 'Image', notes: 'Logo' },
          { id: 'headerSearchInput', type: 'Input', notes: 'Search bar' },
          { id: 'megaMenuPanel', type: 'Box', notes: 'Mega menu dropdown', defaultHidden: true },
          { id: 'desktopNavBar', type: 'Box', notes: 'Desktop nav container' },
          { id: 'productTitle', type: 'Text', notes: 'LiveChat context' },
        ],
      },
      {
        name: 'Mobile Drawer',
        elements: [
          { id: 'mobileMenuButton', type: 'Button', notes: 'Hamburger toggle', defaultHidden: true },
          { id: 'mobileMenuOverlay', type: 'Box', notes: 'Full-screen drawer', defaultHidden: true },
          { id: 'mobileMenuClose', type: 'Button', notes: 'Close drawer', defaultHidden: true },
          { id: 'mobileSearchInput', type: 'Input', notes: 'Mobile search' },
          { id: 'mobileNavHome', type: 'Text', notes: 'Mobile nav' },
          { id: 'mobileNavShop', type: 'Text', notes: 'Mobile nav' },
          { id: 'mobileNavFutonFrames', type: 'Text', notes: 'Mobile nav' },
          { id: 'mobileNavMattresses', type: 'Text', notes: 'Mobile nav' },
          { id: 'mobileNavMurphy', type: 'Text', notes: 'Mobile nav' },
          { id: 'mobileNavPlatformBeds', type: 'Text', notes: 'Mobile nav' },
          { id: 'mobileNavSale', type: 'Text', notes: 'Mobile nav' },
          { id: 'mobileNavContact', type: 'Text', notes: 'Mobile nav' },
          { id: 'mobileNavFAQ', type: 'Text', notes: 'Mobile nav' },
          { id: 'mobileNavAbout', type: 'Text', notes: 'Mobile nav' },
        ],
      },
      {
        name: 'Cart (global)',
        elements: [
          { id: 'cartIcon', type: 'Image', notes: 'Cart icon clickable' },
          { id: 'cartBadge', type: 'Text', notes: 'Item count badge', defaultHidden: true },
          { id: 'sideCartPanel', type: 'Box', notes: 'Slide-in panel', defaultHidden: true },
          { id: 'justAddedHighlight', type: 'Box', notes: 'Just-added animation', defaultHidden: true },
        ],
      },
      {
        name: 'Header Shipping Progress',
        elements: [
          { id: 'headerShippingBar', type: 'ProgressBar', notes: 'Free shipping progress' },
          { id: 'headerShippingText', type: 'Text', notes: '$X away from free shipping' },
          { id: 'headerSkyline', type: 'Box', notes: 'Mountain skyline' },
        ],
      },
      {
        name: 'Schema',
        elements: [
          { id: 'businessSchemaHtml', type: 'HtmlComponent', notes: 'Business schema' },
          { id: 'websiteSchemaHtml', type: 'HtmlComponent', notes: 'Website schema' },
        ],
      },
      {
        name: 'Breadcrumbs',
        elements: [
          { id: 'breadcrumb1', type: 'Text', notes: 'Breadcrumb level 1' },
          { id: 'breadcrumb2', type: 'Text', notes: 'Breadcrumb level 2' },
          { id: 'breadcrumb3', type: 'Text', notes: 'Breadcrumb level 3' },
          { id: 'breadcrumbSchemaHtml', type: 'HtmlComponent', notes: 'Breadcrumb JSON-LD' },
        ],
      },
      {
        name: 'Announcement Bar',
        elements: [
          { id: 'announcementBar', type: 'Box', notes: 'Announcement container' },
          { id: 'announcementText', type: 'Text', notes: 'Announcement text' },
          { id: 'announcementDismiss', type: 'Button', notes: 'Dismiss button' },
        ],
      },
      {
        name: 'Sticky Nav / Back to Top',
        elements: [
          { id: 'headerStrip', type: 'Box', notes: 'Header for sticky nav' },
          { id: 'backToTop', type: 'Button', notes: 'Back-to-top button', defaultHidden: true },
        ],
      },
      {
        name: 'Promo Lightbox',
        repeater: 'promoRepeater',
        elements: [
          { id: 'promoLightbox', type: 'Box', notes: 'Modal dialog' },
          { id: 'promoOverlay', type: 'Box', notes: 'Background overlay' },
          { id: 'promoClose', type: 'Button', notes: 'Close X' },
          { id: 'promoDismiss', type: 'Button', notes: 'No thanks', defaultHidden: true },
          { id: 'promoTitle', type: 'Text', notes: 'Heading' },
          { id: 'promoSubtitle', type: 'Text', notes: 'Subheading', defaultHidden: true },
          { id: 'promoHeroImage', type: 'Image', notes: 'Banner image' },
          { id: 'promoCode', type: 'Text', notes: 'Discount code', defaultHidden: true },
          { id: 'promoCopyCode', type: 'Button', notes: 'Copy code', defaultHidden: true },
          { id: 'promoCTA', type: 'Button', notes: 'Shop now', defaultHidden: true },
          { id: 'promoCountdown', type: 'Text', notes: 'Timer', defaultHidden: true },
          { id: 'promoRepeater', type: 'Repeater', notes: 'Featured promo products', defaultHidden: true },
          { id: 'promoEmailInput', type: 'Input', notes: 'Email capture', defaultHidden: true },
          { id: 'promoEmailSubmit', type: 'Button', notes: 'Submit email', defaultHidden: true },
        ],
        children: [
          { id: 'promoImage', type: 'Image', notes: 'Product image' },
          { id: 'promoName', type: 'Text', notes: 'Product name' },
          { id: 'promoPrice', type: 'Text', notes: 'Price' },
          { id: 'promoOrigPrice', type: 'Text', notes: 'Original price' },
          { id: 'promoQuickAdd', type: 'Button', notes: 'Quick add' },
        ],
      },
      {
        name: 'Newsletter Modal',
        elements: [
          { id: 'newsletterModalTrigger', type: 'Button', notes: 'Open modal' },
          { id: 'newsletterModal', type: 'Box', notes: 'Modal panel', defaultHidden: true },
          { id: 'newsletterModalClose', type: 'Button', notes: 'Close X', defaultHidden: true },
          { id: 'newsletterModalOverlay', type: 'Box', notes: 'Background overlay', defaultHidden: true },
          { id: 'newsletterModalEmail', type: 'Input', notes: 'Email field', defaultHidden: true },
          { id: 'newsletterModalSubmit', type: 'Button', notes: 'Subscribe', defaultHidden: true },
          { id: 'newsletterModalError', type: 'Text', notes: 'Error msg', defaultHidden: true },
          { id: 'newsletterModalSuccess', type: 'Text', notes: 'Success msg', defaultHidden: true },
        ],
      },
      {
        name: 'Exit Intent Popup',
        elements: [
          { id: 'exitIntentPopup', type: 'Box', notes: 'Slide-in popup' },
          { id: 'exitOverlay', type: 'Box', notes: 'Background overlay' },
          { id: 'exitClose', type: 'Button', notes: 'Close X' },
          { id: 'exitTitle', type: 'Text', notes: 'Heading' },
          { id: 'exitSubtitle', type: 'Text', notes: 'Subheading' },
          { id: 'exitEmailInput', type: 'Input', notes: 'Email field', defaultHidden: true },
          { id: 'exitEmailSubmit', type: 'Button', notes: 'Submit', defaultHidden: true },
          { id: 'exitEmailError', type: 'Text', notes: 'Error msg' },
          { id: 'exitSuccess', type: 'Text', notes: 'Success msg' },
          { id: 'exitSwatchLink', type: 'Button', notes: 'Swatch link' },
          { id: 'exitDragHandle', type: 'Box', notes: 'Mobile bottom sheet', defaultHidden: true },
        ],
      },
      {
        name: 'Footer Accordions (mobile)',
        elements: [
          { id: 'footerShopHeader', type: 'Text', notes: 'Accordion header' },
          { id: 'footerShopLinks', type: 'Box', notes: 'Accordion content' },
          { id: 'footerServiceHeader', type: 'Text', notes: 'Accordion header' },
          { id: 'footerServiceLinks', type: 'Box', notes: 'Accordion content' },
          { id: 'footerAboutHeader', type: 'Text', notes: 'Accordion header' },
          { id: 'footerAboutLinks', type: 'Box', notes: 'Accordion content' },
        ],
      },
      {
        name: 'PWA Install Banner',
        elements: [
          { id: 'installBanner', type: 'Box', notes: 'Slide-in banner', defaultHidden: true },
          { id: 'installBannerText', type: 'Text', notes: 'Install prompt', defaultHidden: true },
          { id: 'installBannerBtn', type: 'Button', notes: 'Install button', defaultHidden: true },
          { id: 'installBannerDismiss', type: 'Button', notes: 'Dismiss', defaultHidden: true },
        ],
      },
      {
        name: 'Footer',
        repeater: 'footerShopRepeater',
        elements: [
          { id: 'siteFooter', type: 'Section', notes: 'Footer container' },
          { id: 'footerLogo', type: 'Image', notes: 'Footer logo' },
          { id: 'footerStoreName', type: 'Text', notes: 'Store name' },
          { id: 'footerStoreAddress', type: 'Text', notes: 'Address' },
          { id: 'footerStorePhone', type: 'Text', notes: 'Phone' },
          { id: 'footerStoreHours', type: 'Text', notes: 'Hours' },
          { id: 'footerCopyright', type: 'Text', notes: 'Copyright' },
          { id: 'footerMountainDivider', type: 'HtmlComponent', notes: 'Mountain SVG divider' },
          { id: 'footerShopHeading', type: 'Text', notes: 'Column heading' },
          { id: 'footerShopRepeater', type: 'Repeater', notes: 'Shop links' },
          { id: 'footerServiceHeading', type: 'Text', notes: 'Column heading' },
          { id: 'footerServiceRepeater', type: 'Repeater', notes: 'Service links' },
          { id: 'footerAboutHeading', type: 'Text', notes: 'Column heading' },
          { id: 'footerAboutRepeater', type: 'Repeater', notes: 'About links' },
          { id: 'footerBadgeRepeater', type: 'Repeater', notes: 'Trust badges' },
          { id: 'footerPaymentRepeater', type: 'Repeater', notes: 'Payment icons' },
          { id: 'footerSocialRepeater', type: 'Repeater', notes: 'Social icons' },
          { id: 'socialFacebook', type: 'Button', notes: 'Facebook' },
          { id: 'socialInstagram', type: 'Button', notes: 'Instagram' },
          { id: 'socialPinterest', type: 'Button', notes: 'Pinterest' },
          { id: 'footerEmailInput', type: 'Input', notes: 'Newsletter email' },
          { id: 'footerEmailSubmit', type: 'Button', notes: 'Newsletter submit' },
          { id: 'footerEmailError', type: 'Text', notes: 'Error msg', defaultHidden: true },
          { id: 'footerEmailSuccess', type: 'Text', notes: 'Success msg', defaultHidden: true },
        ],
        children: [
          { id: 'footerLink', type: 'Text', notes: 'Link text (shared child)' },
          { id: 'badgeIcon', type: 'Text', notes: 'Badge icon' },
          { id: 'badgeLabel', type: 'Text', notes: 'Badge label' },
          { id: 'paymentIcon', type: 'Text', notes: 'Payment icon' },
          { id: 'socialIcon', type: 'Text', notes: 'Social icon' },
        ],
      },
    ],
  },
  {
    name: 'Product Page',
    file: 'Product Page.ve2z7.js',
    priority: 'P0',
    est: '90 min',
    sections: [
      {
        name: 'Product Info',
        elements: [
          { id: 'productDataset', type: 'Dataset', notes: 'Stores/Products' },
          { id: 'productName', type: 'Text', notes: 'H1 product name' },
          { id: 'productPrice', type: 'Text', notes: 'Current price' },
          { id: 'productMainImage', type: 'Image', notes: 'Main product image' },
          { id: 'productDescription', type: 'Text', notes: 'Description' },
          { id: 'productComparePrice', type: 'Text', notes: 'Original price' },
          { id: 'addToCartButton', type: 'Button', notes: 'Add to cart' },
          { id: 'giftProductBtn', type: 'Button', notes: 'Give as a Gift — links to /gift-cards (CF-9fv2)', defaultHidden: true },
          { id: 'quantityInput', type: 'Input', notes: 'Quantity' },
          { id: 'quantityMinus', type: 'Button', notes: 'Decrease qty' },
          { id: 'quantityPlus', type: 'Button', notes: 'Increase qty' },
          { id: 'buyNowButton', type: 'Button', notes: 'Express checkout' },
          { id: 'productHeroSkyline', type: 'Box', notes: 'Mountain skyline' },
        ],
      },
      {
        name: 'Related Products',
        repeater: 'relatedRepeater',
        elements: [
          { id: 'relatedSection', type: 'Section', notes: 'Collapsible', defaultHidden: true },
          { id: 'relatedRepeater', type: 'Repeater', notes: 'Related products', defaultHidden: true },
        ],
        children: [
          { id: 'relatedImage', type: 'Image', notes: 'Product image' },
          { id: 'relatedName', type: 'Text', notes: 'Name' },
          { id: 'relatedPrice', type: 'Text', notes: 'Price' },
          { id: 'relatedBadge', type: 'Text', notes: 'Badge', defaultHidden: true },
        ],
      },
      {
        name: 'Collection Products',
        repeater: 'collectionRepeater',
        elements: [
          { id: 'collectionSection', type: 'Section', notes: 'Collapsible' },
          { id: 'collectionRepeater', type: 'Repeater', notes: 'Same-collection' },
        ],
        children: [
          { id: 'collectionImage', type: 'Image', notes: 'Product image' },
          { id: 'collectionName', type: 'Text', notes: 'Name' },
          { id: 'collectionPrice', type: 'Text', notes: 'Price' },
        ],
      },
      {
        name: 'Recently Viewed',
        repeater: 'recentlyViewedRepeater',
        elements: [
          { id: 'recentlyViewedSection', type: 'Section', notes: 'Collapsible', defaultCollapsed: true },
          { id: 'recentlyViewedRepeater', type: 'Repeater', notes: 'Recently viewed' },
        ],
        children: [
          { id: 'recentImage', type: 'Image', notes: 'Image' },
          { id: 'recentName', type: 'Text', notes: 'Name' },
          { id: 'recentPrice', type: 'Text', notes: 'Price' },
          { id: 'recentAddToCart', type: 'Button', notes: 'Add to cart' },
        ],
      },
      {
        name: 'Also Bought',
        repeater: 'alsoBoughtRepeater',
        elements: [
          { id: 'alsoBoughtSection', type: 'Section', notes: 'Collapsible', defaultHidden: true, defaultCollapsed: true },
          { id: 'alsoBoughtRepeater', type: 'Repeater', notes: 'Frequently bought', defaultHidden: true, defaultCollapsed: true },
        ],
        children: [
          { id: 'alsoBoughtImage', type: 'Image', notes: 'Image' },
          { id: 'alsoBoughtName', type: 'Text', notes: 'Name' },
          { id: 'alsoBoughtPrice', type: 'Text', notes: 'Price' },
          { id: 'alsoBoughtBadge', type: 'Text', notes: 'Badge', defaultHidden: true, defaultCollapsed: true },
          { id: 'alsoBoughtAddToCart', type: 'Button', notes: 'Add to cart', defaultHidden: true, defaultCollapsed: true },
        ],
      },
      {
        name: 'Product Options / Variant Swatches',
        elements: [
          { id: 'sizeDropdown', type: 'Dropdown', notes: 'Size variant selector' },
          { id: 'finishDropdown', type: 'Dropdown', notes: 'Finish/color variant selector' },
          { id: 'productGallery', type: 'Gallery', notes: 'Product image gallery' },
          { id: 'stockStatus', type: 'Text', notes: 'In Stock / Low Stock / Out of Stock' },
          { id: 'finishSwatches', type: 'Box', notes: 'Visual swatch dot container' },
          { id: 'swatchSection', type: 'Section', notes: 'Collapsible swatch section' },
          { id: 'swatchCount', type: 'Text', notes: 'Showing X of Y available fabrics' },
          { id: 'swatchViewAll', type: 'Button', notes: 'Opens full swatch gallery' },
          { id: 'swatchRequestLink', type: 'Button', notes: 'Request free swatch link' },
        ],
      },
      {
        name: 'Financing (PDP)',
        repeater: 'financingDetailRepeater',
        elements: [
          { id: 'financingSection', type: 'Section', notes: 'Collapsible financing area' },
          { id: 'financingTeaser', type: 'Text', notes: 'As low as $X/mo teaser' },
          { id: 'afterpayMessage', type: 'Text', notes: 'Afterpay 4-payment breakdown' },
          { id: 'financingLearnMore', type: 'Button', notes: 'Opens financing detail overlay' },
          { id: 'financingOverlay', type: 'Box', notes: 'Modal overlay background' },
          { id: 'financingModal', type: 'Box', notes: 'Modal content container' },
          { id: 'financingClose', type: 'Button', notes: 'Close modal X button' },
          { id: 'financingRepeater', type: 'Repeater', notes: 'Monthly payment options' },
          { id: 'financingTermPills', type: 'Repeater', notes: 'Term length pill selector' },
          { id: 'financingDetailRepeater', type: 'Repeater', notes: 'Detailed breakdown in modal' },
        ],
      },
      {
        name: 'Reviews & Ratings',
        repeater: 'reviewsRepeater',
        elements: [
          { id: 'reviewsSection', type: 'Section', notes: 'Collapsible reviews area' },
          { id: 'reviewsAverage', type: 'Text', notes: 'Average rating (e.g. 4.5)' },
          { id: 'reviewsCount', type: 'Text', notes: 'Total review count' },
          { id: 'ratingBar1', type: 'Box', notes: '1-star row container (label + bar + count)' },
          { id: 'ratingBar2', type: 'Box', notes: '2-star row container' },
          { id: 'ratingBar3', type: 'Box', notes: '3-star row container' },
          { id: 'ratingBar4', type: 'Box', notes: '4-star row container' },
          { id: 'ratingBar5', type: 'Box', notes: '5-star row container' },
          { id: 'ratingCount1', type: 'Text', notes: '1-star count' },
          { id: 'ratingCount2', type: 'Text', notes: '2-star count' },
          { id: 'ratingCount3', type: 'Text', notes: '3-star count' },
          { id: 'ratingCount4', type: 'Text', notes: '4-star count' },
          { id: 'ratingCount5', type: 'Text', notes: '5-star count' },
          { id: 'histogramBar1', type: 'Box', notes: '1-star filled progress bar (visual width)' },
          { id: 'histogramBar2', type: 'Box', notes: '2-star filled progress bar' },
          { id: 'histogramBar3', type: 'Box', notes: '3-star filled progress bar' },
          { id: 'histogramBar4', type: 'Box', notes: '4-star filled progress bar' },
          { id: 'histogramBar5', type: 'Box', notes: '5-star filled progress bar' },
          { id: 'histogramPercent1', type: 'Text', notes: '1-star percentage' },
          { id: 'histogramPercent2', type: 'Text', notes: '2-star percentage' },
          { id: 'histogramPercent3', type: 'Text', notes: '3-star percentage' },
          { id: 'histogramPercent4', type: 'Text', notes: '4-star percentage' },
          { id: 'histogramPercent5', type: 'Text', notes: '5-star percentage' },
          { id: 'reviewsSortDropdown', type: 'Dropdown', notes: 'Sort reviews' },
          { id: 'reviewsEmptyState', type: 'Box', notes: 'No reviews yet message' },
          { id: 'reviewSchemaMarkup', type: 'HtmlComponent', notes: 'JSON-LD structured data' },
          { id: 'reviewsRepeater', type: 'Repeater', notes: 'Individual review cards' },
          { id: 'reviewsNextBtn', type: 'Button', notes: 'Pagination next' },
          { id: 'reviewsPrevBtn', type: 'Button', notes: 'Pagination prev' },
          { id: 'reviewsPageInfo', type: 'Text', notes: 'Page X of Y' },
          { id: 'starFilterAll', type: 'Button', notes: 'Show all reviews' },
          { id: 'starFilter1', type: 'Button', notes: 'Filter 1-star' },
          { id: 'starFilter2', type: 'Button', notes: 'Filter 2-star' },
          { id: 'starFilter3', type: 'Button', notes: 'Filter 3-star' },
          { id: 'starFilter4', type: 'Button', notes: 'Filter 4-star' },
          { id: 'starFilter5', type: 'Button', notes: 'Filter 5-star' },
          { id: 'reviewSubmitBtn', type: 'Button', notes: 'Open/submit review form' },
          { id: 'reviewRatingInput', type: 'Input', notes: 'Star rating selector' },
          { id: 'reviewTitleInput', type: 'Input', notes: 'Review title' },
          { id: 'reviewBodyInput', type: 'TextBox', notes: 'Review body text' },
          { id: 'reviewForm', type: 'Box', notes: 'Form container' },
          { id: 'reviewFormError', type: 'Text', notes: 'Error message' },
          { id: 'reviewFormSuccess', type: 'Text', notes: 'Success message' },
          { id: 'reviewPhotoUpload', type: 'Button', notes: 'Upload review photo' },
          { id: 'reviewPhotoStatus', type: 'Text', notes: 'Upload status label' },
          { id: 'reviewPhotoCount', type: 'Text', notes: 'X/3 photos counter' },
          { id: 'reviewPhotoPreview', type: 'Repeater', notes: 'Photo thumbnail previews' },
        ],
      },
      {
        name: 'Size Guide & Room Fit',
        repeater: 'sizeCompareRepeater',
        elements: [
          { id: 'dimensionSection', type: 'Section', notes: 'Collapsible dimensions area' },
          { id: 'dimensionTitle', type: 'Text', notes: 'Dimensions heading' },
          { id: 'dimensionPlaceholder', type: 'Text', notes: 'Coming soon / error fallback' },
          { id: 'dimensionGrid', type: 'Box', notes: 'Dimension data grid' },
          { id: 'unitToggle', type: 'Toggle', notes: 'Imperial / Metric switch' },
          { id: 'productWeight', type: 'Text', notes: 'Weight: X lbs' },
          { id: 'mattressSize', type: 'Text', notes: 'Mattress Size: Full/Queen' },
          { id: 'closedDimsLabel', type: 'Text', notes: 'Closed (Sofa Position)' },
          { id: 'closedDims', type: 'Text', notes: 'W x D x H closed' },
          { id: 'openDimsLabel', type: 'Text', notes: 'Open (Bed Position)' },
          { id: 'openDims', type: 'Text', notes: 'W x D x H open' },
          { id: 'seatHeight', type: 'Text', notes: 'Seat height measurement' },
          { id: 'dimensionDiagramHtml', type: 'HtmlComponent', notes: 'SVG dimension diagram' },
          { id: 'diagramPositionToggle', type: 'Toggle', notes: 'Closed / Open diagram view' },
          { id: 'dimensionOverlayBtn', type: 'Button', notes: 'Toggle dimension overlay' },
          { id: 'dimensionOverlaySvg', type: 'HtmlComponent', notes: 'SVG overlay on product image' },
          { id: 'roomFitTitle', type: 'Text', notes: 'Will It Fit? heading' },
          { id: 'doorwayWidth', type: 'Input', notes: 'Doorway width (inches)' },
          { id: 'doorwayHeight', type: 'Input', notes: 'Doorway height (inches)' },
          { id: 'hallwayWidth', type: 'Input', notes: 'Hallway width (inches)' },
          { id: 'roomWidth', type: 'Input', notes: 'Room width (inches)' },
          { id: 'roomDepth', type: 'Input', notes: 'Room depth (inches)' },
          { id: 'checkFitBtn', type: 'Button', notes: 'Check Fit action' },
          { id: 'fitResultText', type: 'Text', notes: 'Fit result summary' },
          { id: 'fitResultSection', type: 'Box', notes: 'Result container' },
          { id: 'roomFitCallout', type: 'Box', notes: 'Highlighted callout' },
          { id: 'shippingDimsRow', type: 'Box', notes: 'Shipping dimensions row' },
          { id: 'shippingDimsLabel', type: 'Text', notes: 'Shipping dims label' },
          { id: 'shippingDims', type: 'Text', notes: 'Shipping dimensions' },
          { id: 'shippingWeight', type: 'Text', notes: 'Shipping weight' },
          { id: 'sizeCompareSection', type: 'Section', notes: 'Size comparison section' },
          { id: 'sizeCompareTitle', type: 'Text', notes: 'Comparison heading' },
          { id: 'sizeCompareRepeater', type: 'Repeater', notes: 'Size comparison items' },
          { id: 'sizeComparisonTitle', type: 'Text', notes: 'Comparison title' },
          { id: 'sizeComparisonVisual', type: 'HtmlComponent', notes: 'Size comparison visual' },
        ],
      },
    ],
  },
  {
    name: 'Category Page',
    file: 'Category Page.u0gn0.js',
    priority: 'P0',
    est: '60 min',
    sections: [
      {
        name: 'Hero / Breadcrumb',
        elements: [
          { id: 'categoryHeroSection', type: 'Section', notes: 'Dynamic bg' },
          { id: 'categoryHeroTitle', type: 'Text', notes: 'Category H1' },
          { id: 'categoryHeroSubtitle', type: 'Text', notes: 'Description' },
          { id: 'breadcrumbHome', type: 'Text', notes: 'Home link' },
          { id: 'breadcrumbCurrent', type: 'Text', notes: 'Current category' },
          { id: 'flashSaleBanner', type: 'Box', notes: 'Collapsible sale' },
        ],
      },
      {
        name: 'Product Grid',
        repeater: 'productGridRepeater',
        elements: [
          { id: 'categoryDataset', type: 'Dataset', notes: 'Stores/Products' },
          { id: 'productGridRepeater', type: 'Repeater', notes: 'Main product grid' },
          { id: 'resultCount', type: 'Text', notes: 'X products' },
          { id: 'sortDropdown', type: 'Dropdown', notes: 'Sort options' },
        ],
        children: [
          { id: 'gridCard', type: 'Box', notes: 'Card' },
          { id: 'gridImage', type: 'Image', notes: 'Image' },
          { id: 'gridName', type: 'Text', notes: 'Name' },
          { id: 'gridPrice', type: 'Text', notes: 'Price' },
          { id: 'gridOrigPrice', type: 'Text', notes: 'Original price' },
          { id: 'gridSaleBadge', type: 'Text', notes: 'Sale badge' },
          { id: 'gridBadge', type: 'Text', notes: 'Badge' },
          { id: 'gridBrand', type: 'Text', notes: 'Brand' },
          { id: 'gridRibbon', type: 'Text', notes: 'Ribbon' },
          { id: 'gridFabricBadge', type: 'Text', notes: 'Fabric badge' },
          { id: 'gridLifestyleBadge', type: 'Text', notes: 'Lifestyle' },
          { id: 'gridCompareBtn', type: 'Button', notes: 'Compare' },
          { id: 'quickViewBtn', type: 'Button', notes: 'Quick view', defaultHidden: true },
          { id: 'gridSwatchPreview', type: 'Box', notes: 'Swatch preview' },
        ],
      },
      {
        name: 'Quick View Modal',
        elements: [
          { id: 'quickViewModal', type: 'Box', notes: 'Hidden modal', defaultHidden: true },
          { id: 'qvImage', type: 'Image', notes: 'Product image', defaultHidden: true },
          { id: 'qvName', type: 'Text', notes: 'Name', defaultHidden: true },
          { id: 'qvPrice', type: 'Text', notes: 'Price', defaultHidden: true },
          { id: 'qvDescription', type: 'Text', notes: 'Description', defaultHidden: true },
          { id: 'qvAddToCart', type: 'Button', notes: 'Add to cart', defaultHidden: true },
          { id: 'qvViewFull', type: 'Button', notes: 'View full', defaultHidden: true },
          { id: 'qvClose', type: 'Button', notes: 'Close X', defaultHidden: true },
          { id: 'qvSizeSelect', type: 'Dropdown', notes: 'Size options', defaultHidden: true },
        ],
      },
      {
        name: 'Filters',
        elements: [
          { id: 'filterCategory', type: 'Dropdown', notes: 'Category' },
          { id: 'filterBrand', type: 'Dropdown', notes: 'Brand' },
          { id: 'filterPrice', type: 'Dropdown', notes: 'Price range' },
          { id: 'filterSize', type: 'Dropdown', notes: 'Size' },
          { id: 'clearFilters', type: 'Button', notes: 'Clear all' },
          { id: 'filterMaterial', type: 'Dropdown', notes: 'Material' },
          { id: 'filterColor', type: 'Dropdown', notes: 'Color' },
          { id: 'filterFeatures', type: 'CheckboxGroup', notes: 'Features' },
          { id: 'filterPriceRange', type: 'Dropdown', notes: 'Price range' },
          { id: 'filterComfortLevel', type: 'Dropdown', notes: 'Comfort' },
          { id: 'filterWidthMin', type: 'Input', notes: 'Min width' },
          { id: 'filterWidthMax', type: 'Input', notes: 'Max width' },
          { id: 'filterDepthMin', type: 'Input', notes: 'Min depth' },
          { id: 'filterDepthMax', type: 'Input', notes: 'Max depth' },
          { id: 'filterResultCount', type: 'Text', notes: 'Result count' },
          { id: 'filterLoadingIndicator', type: 'Box', notes: 'Loading' },
          { id: 'clearAllFilters', type: 'Button', notes: 'Clear all' },
          { id: 'clearAllFiltersChip', type: 'Button', notes: 'Clear chip' },
          { id: 'activeFilterChips', type: 'Box', notes: 'Chips container' },
          { id: 'filterChipsText', type: 'Text', notes: 'Fallback filter chips text' },
        ],
      },
      {
        name: 'Filter Chips',
        repeater: 'filterChipRepeater',
        elements: [
          { id: 'filterChipRepeater', type: 'Repeater', notes: 'Active filter chips' },
        ],
        children: [
          { id: 'chipLabel', type: 'Text', notes: 'Chip label' },
          { id: 'chipRemove', type: 'Button', notes: 'Remove chip' },
        ],
      },
      {
        name: 'Mobile Filter Drawer',
        elements: [
          { id: 'filterToggleBtn', type: 'Button', notes: 'Open drawer' },
          { id: 'filterDrawer', type: 'Box', notes: 'Drawer panel', defaultHidden: true },
          { id: 'filterDrawerOverlay', type: 'Box', notes: 'Overlay', defaultHidden: true },
          { id: 'filterDrawerApply', type: 'Button', notes: 'Apply filters', defaultHidden: true },
          { id: 'mobileSortBar', type: 'Box', notes: 'Mobile sort bar' },
        ],
      },
      {
        name: 'Empty States',
        elements: [
          { id: 'emptyStateSection', type: 'Section', notes: 'No products', defaultHidden: true },
          { id: 'emptyStateTitle', type: 'Text', notes: 'Heading' },
          { id: 'emptyStateMessage', type: 'Text', notes: 'Message' },
          { id: 'emptyStateIllustration', type: 'Image', notes: 'Illustration' },
          { id: 'noMatchesSection', type: 'Section', notes: 'No filter matches', defaultHidden: true },
          { id: 'noMatchesTitle', type: 'Text', notes: 'Heading' },
          { id: 'noMatchesMessage', type: 'Text', notes: 'Message' },
          { id: 'noMatchesSuggestion', type: 'Text', notes: 'Suggestion' },
        ],
      },
      {
        name: 'Compare Bar',
        repeater: 'compareRepeater',
        elements: [
          { id: 'compareBar', type: 'Box', notes: 'Sticky compare bar' },
          { id: 'compareRepeater', type: 'Repeater', notes: 'Compare thumbs' },
          { id: 'compareViewBtn', type: 'Button', notes: 'View comparison' },
        ],
        children: [
          { id: 'compareThumb', type: 'Image', notes: 'Thumbnail' },
          { id: 'compareName', type: 'Text', notes: 'Name' },
          { id: 'comparePrice', type: 'Text', notes: 'Price' },
          { id: 'compareRemove', type: 'Button', notes: 'Remove' },
        ],
      },
      {
        name: 'Recently Viewed',
        elements: [
          { id: 'recentlyViewedTitle', type: 'Text', notes: 'Section heading' },
        ],
      },
      {
        name: 'SEO',
        elements: [
          { id: 'categorySchemaHtml', type: 'HtmlComponent', notes: 'Category schema' },
          { id: 'categoryBreadcrumbSchemaHtml', type: 'HtmlComponent', notes: 'Breadcrumb schema' },
          { id: 'categoryOgHtml', type: 'HtmlComponent', notes: 'OG tags' },
        ],
      },
    ],
  },
  {
    name: 'Cart Page',
    file: 'Cart Page.mqi5m.js',
    priority: 'P1',
    est: '35 min',
    sections: [
      {
        name: 'Cart Data',
        elements: [
          { id: 'cartDataset', type: 'Dataset', notes: 'Cart dataset' },
        ],
      },
      {
        name: 'Empty Cart',
        elements: [
          { id: 'emptyCartSection', type: 'Section', notes: 'Shown when empty' },
          { id: 'emptyCartTitle', type: 'Text', notes: 'Your Cart is Empty' },
          { id: 'emptyCartMessage', type: 'Text', notes: 'Message' },
          { id: 'continueShoppingBtn', type: 'Button', notes: 'Back to shop' },
        ],
      },
      {
        name: 'Shipping Progress',
        elements: [
          { id: 'shippingProgressBar', type: 'ProgressBar', notes: 'Free shipping progress' },
          { id: 'shippingProgressText', type: 'Text', notes: 'Progress text' },
          { id: 'shippingProgressIcon', type: 'Image', notes: 'Truck icon' },
        ],
      },
      {
        name: 'Tier Discount',
        elements: [
          { id: 'tierProgressBar', type: 'ProgressBar', notes: 'Tier progress' },
          { id: 'tierProgressText', type: 'Text', notes: 'Progress text' },
        ],
      },
      {
        name: 'Cart Items',
        repeater: 'cartItemsRepeater',
        elements: [
          { id: 'cartItemsRepeater', type: 'Repeater', notes: 'Cart line items' },
        ],
        children: [
          { id: 'cartItemName', type: 'Text', notes: 'Item name' },
          { id: 'cartItemPrice', type: 'Text', notes: 'Price' },
          { id: 'qtyMinus', type: 'Button', notes: 'Decrease' },
          { id: 'qtyPlus', type: 'Button', notes: 'Increase' },
          { id: 'qtyInput', type: 'Input', notes: 'Quantity' },
          { id: 'removeItem', type: 'Button', notes: 'Remove' },
          { id: 'saveForLaterBtn', type: 'Button', notes: 'Save for later' },
        ],
      },
      {
        name: 'Cart Totals',
        elements: [
          { id: 'cartSubtotal', type: 'Text', notes: 'Subtotal' },
          { id: 'cartShipping', type: 'Text', notes: 'Shipping' },
          { id: 'cartTotal', type: 'Text', notes: 'Total' },
        ],
      },
      {
        name: 'Cross-Sell',
        repeater: 'suggestionsRepeater',
        elements: [
          { id: 'suggestionsSection', type: 'Section', notes: 'Collapsible' },
          { id: 'suggestionsHeading', type: 'Text', notes: 'Heading' },
          { id: 'suggestionsSubheading', type: 'Text', notes: 'Subheading' },
          { id: 'sugSavingsBadge', type: 'Text', notes: 'Savings' },
          { id: 'suggestionsRepeater', type: 'Repeater', notes: 'Suggested' },
          { id: 'sugBundlePrice', type: 'Text', notes: 'Bundle price' },
          { id: 'sugOriginalPrice', type: 'Text', notes: 'Original' },
        ],
        children: [
          { id: 'sugImage', type: 'Image', notes: 'Image' },
          { id: 'sugName', type: 'Text', notes: 'Name' },
          { id: 'sugPrice', type: 'Text', notes: 'Price' },
          { id: 'sugAddBtn', type: 'Button', notes: 'Add' },
        ],
      },
      {
        name: 'Recently Viewed',
        repeater: 'cartRecentRepeater',
        elements: [
          { id: 'cartRecentSection', type: 'Section', notes: 'Container' },
          { id: 'cartRecentRepeater', type: 'Repeater', notes: 'Recent products' },
        ],
        children: [
          { id: 'cartRecentImage', type: 'Image', notes: 'Image' },
          { id: 'cartRecentName', type: 'Text', notes: 'Name' },
          { id: 'cartRecentPrice', type: 'Text', notes: 'Price' },
        ],
      },
      {
        name: 'Financing',
        elements: [
          { id: 'cartFinancingSection', type: 'Section', notes: 'Container' },
          { id: 'financingThreshold', type: 'Text', notes: 'Threshold' },
          { id: 'cartFinancingTeaser', type: 'Text', notes: 'Teaser' },
          { id: 'cartAfterpayMessage', type: 'Text', notes: 'Afterpay msg' },
        ],
      },
      {
        name: 'Delivery',
        elements: [
          { id: 'cartDeliverySection', type: 'Section', notes: 'Container' },
        ],
      },
    ],
  },
  {
    name: 'Checkout',
    file: 'Checkout.psuom.js',
    priority: 'P1',
    est: '50 min',
    sections: [
      {
        name: 'Progress',
        repeater: 'checkoutProgressRepeater',
        elements: [
          { id: 'checkoutProgressNav', type: 'Box', notes: 'Progress nav' },
          { id: 'checkoutProgressRepeater', type: 'Repeater', notes: 'Progress steps' },
        ],
        children: [
          { id: 'progressStepLabel', type: 'Text', notes: 'Label' },
          { id: 'progressStepNumber', type: 'Text', notes: 'Number' },
          { id: 'progressStepDot', type: 'Box', notes: 'Dot' },
          { id: 'progressStepCheck', type: 'Image', notes: 'Check' },
          { id: 'progressStepContainer', type: 'Box', notes: 'Container' },
        ],
      },
      {
        name: 'Trust Signals',
        repeater: 'trustRepeater',
        elements: [
          { id: 'trustRepeater', type: 'Repeater', notes: 'Trust signals' },
        ],
        children: [
          { id: 'trustText', type: 'Text', notes: 'Text' },
          { id: 'trustIcon', type: 'Image', notes: 'Icon' },
        ],
      },
      {
        name: 'Order Notes',
        elements: [
          { id: 'orderNotesToggle', type: 'Button', notes: 'Toggle' },
          { id: 'orderNotesField', type: 'TextBox', notes: 'Notes field' },
        ],
      },
      {
        name: 'Checkout Summary',
        elements: [
          { id: 'checkoutFreeShipping', type: 'Text', notes: 'Free shipping msg' },
          { id: 'checkoutItemCount', type: 'Text', notes: 'Item count' },
        ],
      },
      {
        name: 'Payment Methods',
        repeater: 'paymentMethodsRepeater',
        elements: [
          { id: 'paymentMethodsRepeater', type: 'Repeater', notes: 'Payment options' },
        ],
        children: [
          { id: 'paymentMethodName', type: 'Text', notes: 'Name' },
          { id: 'paymentMethodIcon', type: 'Image', notes: 'Icon' },
          { id: 'paymentBrands', type: 'Text', notes: 'Brands' },
        ],
      },
      {
        name: 'Afterpay / Financing',
        elements: [
          { id: 'checkoutAfterpay', type: 'Section', notes: 'Afterpay section' },
          { id: 'afterpayMessage', type: 'Text', notes: 'Message' },
          { id: 'afterpayInstallment', type: 'Text', notes: 'Installment' },
          { id: 'checkoutFinancing', type: 'Section', notes: 'Financing section' },
          { id: 'financingMessage', type: 'Text', notes: 'Message' },
          { id: 'checkoutShippingMessage', type: 'Text', notes: 'Shipping msg' },
        ],
      },
      {
        name: 'Shipping Options',
        repeater: 'shippingOptionsRepeater',
        elements: [
          { id: 'shippingOptionsRepeater', type: 'Repeater', notes: 'Shipping options' },
        ],
        children: [
          { id: 'shippingOptionLabel', type: 'Text', notes: 'Label' },
          { id: 'shippingOptionPrice', type: 'Text', notes: 'Price' },
          { id: 'shippingOptionDesc', type: 'Text', notes: 'Description' },
          { id: 'shippingOptionDays', type: 'Text', notes: 'Days' },
          { id: 'shippingOptionRadio', type: 'RadioButton', notes: 'Select' },
        ],
      },
      {
        name: 'Address Validation',
        elements: [
          { id: 'validateAddressBtn', type: 'Button', notes: 'Validate' },
          { id: 'addressFullName', type: 'Input', notes: 'Full name' },
          { id: 'addressLine1', type: 'Input', notes: 'Line 1' },
          { id: 'addressCity', type: 'Input', notes: 'City' },
          { id: 'addressState', type: 'Input', notes: 'State' },
          { id: 'addressZip', type: 'Input', notes: 'ZIP' },
          { id: 'addressFullNameError', type: 'Text', notes: 'Error' },
          { id: 'addressLine1Error', type: 'Text', notes: 'Error' },
          { id: 'addressCityError', type: 'Text', notes: 'Error' },
          { id: 'addressStateError', type: 'Text', notes: 'Error' },
          { id: 'addressZipError', type: 'Text', notes: 'Error' },
          { id: 'addressErrors', type: 'Text', notes: 'General errors', defaultHidden: true },
          { id: 'addressSuccess', type: 'Text', notes: 'Success', defaultHidden: true },
        ],
      },
      {
        name: 'Delivery Estimate',
        elements: [
          { id: 'checkoutDeliveryEstimate', type: 'Text', notes: 'Delivery estimate' },
        ],
      },
      {
        name: 'Order Summary Sidebar',
        repeater: 'orderSummaryItemsRepeater',
        elements: [
          { id: 'orderSummarySidebar', type: 'Box', notes: 'Sidebar' },
          { id: 'orderSummaryItemsRepeater', type: 'Repeater', notes: 'Items' },
          { id: 'orderSummarySubtotal', type: 'Text', notes: 'Subtotal' },
          { id: 'orderSummaryShipping', type: 'Text', notes: 'Shipping' },
          { id: 'orderSummaryTax', type: 'Text', notes: 'Tax' },
          { id: 'orderSummaryTotal', type: 'Text', notes: 'Total' },
          { id: 'orderSummarySavings', type: 'Text', notes: 'Savings' },
          { id: 'orderSummaryStoreCredit', type: 'Text', notes: 'Credit' },
          { id: 'orderSummaryStoreCreditRow', type: 'Box', notes: 'Credit row' },
        ],
        children: [
          { id: 'summaryItemName', type: 'Text', notes: 'Name' },
          { id: 'summaryItemQty', type: 'Text', notes: 'Qty' },
          { id: 'summaryItemPrice', type: 'Text', notes: 'Price' },
        ],
      },
      {
        name: 'Express Checkout',
        elements: [
          { id: 'expressCheckoutSection', type: 'Section', notes: 'Express section', defaultHidden: true },
          { id: 'expressCheckoutBtn', type: 'Button', notes: 'Express checkout' },
          { id: 'expressSummaryTotal', type: 'Text', notes: 'Total' },
          { id: 'expressSummaryShipping', type: 'Text', notes: 'Shipping' },
          { id: 'expressSummaryAddress', type: 'Text', notes: 'Address' },
          { id: 'expressSummarySection', type: 'Box', notes: 'Summary' },
        ],
      },
      {
        name: 'Store Credit',
        elements: [
          { id: 'storeCreditApplyBtn', type: 'Button', notes: 'Apply credit' },
          { id: 'storeCreditAppliedAmount', type: 'Text', notes: 'Applied amount' },
          { id: 'storeCreditAppliedSection', type: 'Box', notes: 'Applied section', defaultHidden: true },
        ],
      },
      {
        name: 'Protection Plans',
        repeater: 'protectionPlanRepeater',
        elements: [
          { id: 'protectionPlanSection', type: 'Section', notes: 'Container' },
          { id: 'protectionPlanTitle', type: 'Text', notes: 'Title' },
          { id: 'protectionPlanSubtitle', type: 'Text', notes: 'Subtitle' },
          { id: 'protectionPlanRepeater', type: 'Repeater', notes: 'Plans' },
        ],
        children: [
          { id: 'protPlanProductName', type: 'Text', notes: 'Product name' },
          { id: 'protPlanProductPrice', type: 'Text', notes: 'Price' },
          { id: 'protPlanTierRepeater', type: 'Repeater', notes: 'NESTED tiers' },
          { id: 'protPlanDecline', type: 'Button', notes: 'Decline' },
          { id: 'tierName', type: 'Text', notes: 'Tier name' },
          { id: 'tierPrice', type: 'Text', notes: 'Price' },
          { id: 'tierDuration', type: 'Text', notes: 'Duration' },
          { id: 'tierCoverage', type: 'Text', notes: 'Coverage' },
          { id: 'tierCard', type: 'Box', notes: 'Card' },
          { id: 'tierSelectBtn', type: 'Button', notes: 'Select' },
          { id: 'tierCurrentBadge', type: 'Text', notes: 'Current badge' },
        ],
      },
    ],
  },
  {
    name: 'Side Cart',
    file: 'Side Cart.ego5s.js',
    priority: 'P1',
    est: '25 min',
    sections: [
      {
        name: 'Panel',
        elements: [
          { id: 'sideCartPanel', type: 'Box', notes: 'Panel', defaultHidden: true },
          { id: 'sideCartTitle', type: 'Text', notes: 'Title' },
          { id: 'sideCartClose', type: 'Button', notes: 'Close' },
          { id: 'sideCartOverlay', type: 'Box', notes: 'Overlay', defaultHidden: true },
          { id: 'sideCartEmpty', type: 'Box', notes: 'Empty state' },
          { id: 'sideCartItems', type: 'Box', notes: 'Items container' },
          { id: 'sideCartFooter', type: 'Box', notes: 'Footer' },
          { id: 'sideCartSubtotal', type: 'Text', notes: 'Subtotal' },
          { id: 'sideCartCheckout', type: 'Button', notes: 'Checkout' },
          { id: 'viewFullCart', type: 'Button', notes: 'View cart' },
          { id: 'cartIcon', type: 'Image', notes: 'Cart icon' },
          { id: 'cartBadge', type: 'Text', notes: 'Badge', defaultHidden: true },
          { id: 'justAddedHighlight', type: 'Box', notes: 'Just-added (managed by masterPage)', defaultHidden: true },
        ],
      },
      {
        name: 'Items',
        repeater: 'sideCartRepeater',
        elements: [
          { id: 'sideCartRepeater', type: 'Repeater', notes: 'Cart items' },
        ],
        children: [
          { id: 'sideItemImage', type: 'Image', notes: 'Image' },
          { id: 'sideItemName', type: 'Text', notes: 'Name' },
          { id: 'sideItemPrice', type: 'Text', notes: 'Price' },
          { id: 'sideItemQty', type: 'Text', notes: 'Qty' },
          { id: 'sideQtyMinus', type: 'Button', notes: 'Decrease' },
          { id: 'sideQtyPlus', type: 'Button', notes: 'Increase' },
          { id: 'sideItemLineTotal', type: 'Text', notes: 'Line total' },
          { id: 'sideItemVariant', type: 'Text', notes: 'Variant' },
          { id: 'sideItemRemove', type: 'Button', notes: 'Remove' },
          { id: 'sideSaveForLater', type: 'Button', notes: 'Save for later' },
        ],
      },
      {
        name: 'Progress Bars',
        elements: [
          { id: 'sideShippingBar', type: 'ProgressBar', notes: 'Shipping progress' },
          { id: 'sideShippingText', type: 'Text', notes: 'Shipping text' },
          { id: 'sideTierBar', type: 'ProgressBar', notes: 'Tier progress' },
          { id: 'sideTierText', type: 'Text', notes: 'Tier text' },
        ],
      },
      {
        name: 'Cross-Sell',
        repeater: 'sideSugRepeater',
        elements: [
          { id: 'sideCartSuggestion', type: 'Section', notes: 'Container' },
          { id: 'sideSugLabel', type: 'Text', notes: 'Label' },
          { id: 'sideSugSubheading', type: 'Text', notes: 'Subheading' },
          { id: 'sideSugSavingsBadge', type: 'Text', notes: 'Savings' },
          { id: 'sideSugRepeater', type: 'Repeater', notes: 'Suggestions' },
          { id: 'sideSugBundlePrice', type: 'Text', notes: 'Bundle price' },
          { id: 'sideSugOriginalPrice', type: 'Text', notes: 'Original' },
        ],
        children: [
          { id: 'sideSugImage', type: 'Image', notes: 'Image' },
          { id: 'sideSugName', type: 'Text', notes: 'Name' },
          { id: 'sideSugPrice', type: 'Text', notes: 'Price' },
          { id: 'sideSugAdd', type: 'Button', notes: 'Add' },
        ],
      },
    ],
  },
  {
    name: 'Search Results',
    file: 'Search Results.evr2j.js',
    priority: 'P1',
    est: '25 min',
    sections: [
      {
        name: 'Search Controls',
        elements: [
          { id: 'searchInput', type: 'Input', notes: 'Search input' },
          { id: 'searchBtn', type: 'Button', notes: 'Search' },
          { id: 'searchQuery', type: 'Text', notes: 'Query display' },
          { id: 'resultCount', type: 'Text', notes: 'Count' },
          { id: 'loadMoreBtn', type: 'Button', notes: 'Load more' },
          { id: 'loadingIndicator', type: 'Box', notes: 'Loading' },
        ],
      },
      {
        name: 'Results Grid',
        repeater: 'searchRepeater',
        elements: [
          { id: 'searchRepeater', type: 'Repeater', notes: 'Results grid' },
        ],
        children: [
          { id: 'searchImage', type: 'Image', notes: 'Image' },
          { id: 'searchName', type: 'Text', notes: 'Name' },
          { id: 'searchPrice', type: 'Text', notes: 'Price' },
          { id: 'searchDesc', type: 'Text', notes: 'Description' },
          { id: 'searchRibbon', type: 'Text', notes: 'Ribbon' },
          { id: 'searchOrigPrice', type: 'Text', notes: 'Original' },
          { id: 'searchAddBtn', type: 'Button', notes: 'Add to cart' },
          { id: 'searchSwatchPreview', type: 'Box', notes: 'Swatch preview' },
        ],
      },
      {
        name: 'Suggestions',
        repeater: 'suggestionsRepeater',
        elements: [
          { id: 'suggestionsBox', type: 'Box', notes: 'Container' },
          { id: 'suggestionsRepeater', type: 'Repeater', notes: 'Suggestions' },
        ],
        children: [
          { id: 'suggestionText', type: 'Text', notes: 'Text' },
          { id: 'suggestionType', type: 'Text', notes: 'Type' },
        ],
      },
      {
        name: 'Filters',
        elements: [
          { id: 'categoryFilter', type: 'Dropdown', notes: 'Category' },
          { id: 'priceFilter', type: 'Dropdown', notes: 'Price' },
          { id: 'materialFilter', type: 'Dropdown', notes: 'Material' },
          { id: 'colorFilter', type: 'Dropdown', notes: 'Color' },
          { id: 'sortDropdown', type: 'Dropdown', notes: 'Sort' },
          { id: 'filterToggleBtn', type: 'Button', notes: 'Toggle filters' },
          { id: 'filterSidebar', type: 'Box', notes: 'Sidebar' },
          { id: 'clearFiltersBtn', type: 'Button', notes: 'Clear' },
          { id: 'filterBadge', type: 'Text', notes: 'Badge' },
        ],
      },
      {
        name: 'No Results',
        repeater: 'searchChipsRepeater',
        elements: [
          { id: 'noResultsBox', type: 'Box', notes: 'Container' },
          { id: 'noResultsText', type: 'Text', notes: 'Message' },
          { id: 'searchChipsRepeater', type: 'Repeater', notes: 'Suggestion chips' },
        ],
        children: [
          { id: 'chipLabel', type: 'Text', notes: 'Chip text' },
        ],
      },
    ],
  },
  {
    name: 'Member Page',
    file: 'Member Page.f00pg.js',
    priority: 'P2',
    est: '55 min',
    sections: [
      {
        name: 'Dashboard',
        elements: [
          { id: 'memberWelcome', type: 'Text', notes: 'Welcome msg' },
          { id: 'memberOrderCount', type: 'Text', notes: 'Order count' },
          { id: 'memberWishCount', type: 'Text', notes: 'Wishlist count' },
          { id: 'memberPointsDisplay', type: 'Text', notes: 'Points' },
          { id: 'memberTierDisplay', type: 'Text', notes: 'Tier' },
          { id: 'memberErrorFallback', type: 'Box', notes: 'Error fallback', defaultHidden: true },
          { id: 'memberErrorText', type: 'Text', notes: 'Error text', defaultHidden: true },
        ],
      },
      {
        name: 'Quick Links',
        elements: [
          { id: 'dashQuickOrders', type: 'Button', notes: 'Orders' },
          { id: 'dashQuickWishlist', type: 'Button', notes: 'Wishlist' },
          { id: 'dashQuickSettings', type: 'Button', notes: 'Settings' },
        ],
      },
      {
        name: 'Loyalty',
        repeater: 'tierComparisonRepeater',
        elements: [
          { id: 'tierProgressBar', type: 'ProgressBar', notes: 'Progress' },
          { id: 'tierProgressText', type: 'Text', notes: 'Progress text' },
          { id: 'loyaltyMilestone', type: 'Text', notes: 'Milestone' },
          { id: 'tierComparisonRepeater', type: 'Repeater', notes: 'Tiers' },
        ],
        children: [
          { id: 'tierName', type: 'Text', notes: 'Name' },
          { id: 'tierMinPoints', type: 'Text', notes: 'Min points' },
          { id: 'tierBenefits', type: 'Text', notes: 'Benefits' },
          { id: 'tierCard', type: 'Box', notes: 'Card' },
          { id: 'tierCurrentBadge', type: 'Text', notes: 'Current badge' },
        ],
      },
      {
        name: 'Rewards',
        repeater: 'rewardsRepeater',
        elements: [
          { id: 'rewardsRepeater', type: 'Repeater', notes: 'Rewards', defaultHidden: true },
          { id: 'rewardsSection', type: 'Section', notes: 'Container', defaultHidden: true },
          { id: 'rewardsEmpty', type: 'Text', notes: 'Empty state', defaultHidden: true },
        ],
        children: [
          { id: 'rewardName', type: 'Text', notes: 'Name' },
          { id: 'rewardDescription', type: 'Text', notes: 'Description' },
          { id: 'rewardCost', type: 'Text', notes: 'Cost' },
          { id: 'redeemBtn', type: 'Button', notes: 'Redeem' },
          { id: 'rewardCouponCode', type: 'Text', notes: 'Coupon code', defaultHidden: true },
        ],
      },
      {
        name: 'Order History',
        repeater: 'ordersRepeater',
        elements: [
          { id: 'ordersRepeater', type: 'Repeater', notes: 'Orders' },
          { id: 'orderFilterDropdown', type: 'Dropdown', notes: 'Filter' },
          { id: 'ordersLoadMoreBtn', type: 'Button', notes: 'Load more' },
          { id: 'ordersRetryBtn', type: 'Button', notes: 'Retry' },
          { id: 'ordersLoader', type: 'Box', notes: 'Loading' },
          { id: 'ordersError', type: 'Text', notes: 'Error' },
          { id: 'ordersEmpty', type: 'Box', notes: 'Empty state' },
          { id: 'startReturnBtn', type: 'Button', notes: 'Start return' },
        ],
        children: [
          { id: 'orderNumber', type: 'Text', notes: 'Number' },
          { id: 'orderDate', type: 'Text', notes: 'Date' },
          { id: 'orderTotal', type: 'Text', notes: 'Total' },
          { id: 'orderItemCount', type: 'Text', notes: 'Items' },
          { id: 'orderStatusBadge', type: 'Text', notes: 'Status badge' },
          { id: 'orderStatus', type: 'Text', notes: 'Status' },
          { id: 'orderDeliveryEta', type: 'Text', notes: 'Delivery ETA' },
          { id: 'orderTrackBtn', type: 'Button', notes: 'Track' },
          { id: 'orderReorderBtn', type: 'Button', notes: 'Reorder' },
          { id: 'orderStartReturnBtn', type: 'Button', notes: 'Return' },
          { id: 'orderItemsGallery', type: 'Gallery', notes: 'Items gallery' },
        ],
      },
      {
        name: 'Wishlist',
        repeater: 'wishlistRepeater',
        elements: [
          { id: 'wishlistRepeater', type: 'Repeater', notes: 'Wishlist' },
          { id: 'wishlistEmpty', type: 'Box', notes: 'Empty' },
          { id: 'wishSortDropdown', type: 'Dropdown', notes: 'Sort' },
          { id: 'wishShareBtn', type: 'Button', notes: 'Share' },
          { id: 'wishSharePinterest', type: 'Button', notes: 'Pinterest' },
          { id: 'wishShareEmail', type: 'Button', notes: 'Email' },
          { id: 'wishShareFacebook', type: 'Button', notes: 'Facebook' },
          { id: 'wishAlertHistorySection', type: 'Section', notes: 'Alert history' },
          { id: 'wishAlertHistoryRepeater', type: 'Repeater', notes: 'Alert history' },
        ],
        children: [
          { id: 'wishImage', type: 'Image', notes: 'Image' },
          { id: 'wishName', type: 'Text', notes: 'Name' },
          { id: 'wishPrice', type: 'Text', notes: 'Price' },
          { id: 'wishStockStatus', type: 'Text', notes: 'Stock' },
          { id: 'wishSalePrice', type: 'Text', notes: 'Sale price' },
          { id: 'wishAddToCartBtn', type: 'Button', notes: 'Add to cart' },
          { id: 'wishViewBtn', type: 'Button', notes: 'View' },
          { id: 'wishAlertToggle', type: 'Toggle', notes: 'Alert toggle' },
          { id: 'wishRemoveBtn', type: 'Button', notes: 'Remove' },
          { id: 'wishCard', type: 'Box', notes: 'Card' },
        ],
      },
      {
        name: 'Account / Address / Prefs',
        repeater: 'addressRepeater',
        elements: [
          { id: 'logoutBtn', type: 'Button', notes: 'Logout' },
          { id: 'accountSettings', type: 'Section', notes: 'Settings' },
          { id: 'addressBook', type: 'Box', notes: 'Address book' },
          { id: 'addressRepeater', type: 'Repeater', notes: 'Addresses' },
          { id: 'addressEmptyState', type: 'Box', notes: 'Empty' },
          { id: 'commPrefs', type: 'Box', notes: 'Preferences' },
          { id: 'prefNewsletter', type: 'Toggle', notes: 'Newsletter' },
          { id: 'prefSaleAlerts', type: 'Toggle', notes: 'Sale alerts' },
          { id: 'prefBackInStock', type: 'Toggle', notes: 'Back in stock' },
        ],
        children: [
          { id: 'addressText', type: 'Text', notes: 'Address text' },
        ],
      },
    ],
  },
  {
    name: 'Blog',
    file: 'Blog.js',
    priority: 'P1',
    est: '40 min',
    sections: [
      {
        name: 'Blog List Repeater (Paginated)',
        repeater: 'blogListRepeater',
        elements: [
          { id: 'blogListRepeater', type: 'Repeater', notes: 'Paginated blog post list' },
          { id: 'blogPostCount', type: 'Text', notes: "Post count (e.g. '12 posts')" },
          { id: 'blogPageIndicator', type: 'Text', notes: 'Page X of Y' },
          { id: 'blogPrevBtn', type: 'Button', notes: 'Previous page — disabled on first page' },
          { id: 'blogNextBtn', type: 'Button', notes: 'Next page — disabled on last page' },
          { id: 'blogEmptyState', type: 'Box', notes: 'Shown when no posts match filter', defaultHidden: true },
        ],
        children: [
          { id: 'listTitle', type: 'Text', notes: 'Post title' },
          { id: 'listExcerpt', type: 'Text', notes: 'Post excerpt' },
          { id: 'listCategory', type: 'Text', notes: 'Category badge' },
          { id: 'listDate', type: 'Text', notes: 'Formatted publish date' },
          { id: 'listReadTime', type: 'Text', notes: 'Reading time badge' },
          { id: 'listPostLink', type: 'Box', notes: 'Click navigates to /blog/{slug}' },
        ],
      },
      {
        name: 'Blog Grid (Viewport-limited)',
        repeater: 'blogGridRepeater',
        elements: [
          { id: 'blogGridRepeater', type: 'Repeater', notes: 'Viewport-limited blog card grid' },
        ],
        children: [
          { id: 'cardTitle', type: 'Text', notes: 'Post title' },
          { id: 'cardExcerpt', type: 'Text', notes: 'Post excerpt' },
          { id: 'cardCategory', type: 'Text', notes: 'Category badge' },
          { id: 'cardDate', type: 'Text', notes: 'Formatted date' },
          { id: 'cardReadTime', type: 'Text', notes: 'Reading time' },
          { id: 'blogCardLink', type: 'Box', notes: 'Click navigates to /blog/{slug}' },
        ],
      },
      {
        name: 'Featured Hero',
        elements: [
          { id: 'featuredHeroSection', type: 'Section', notes: 'Featured post hero — collapses if empty' },
          { id: 'featuredTitle', type: 'Text', notes: 'Most recent post title' },
          { id: 'featuredExcerpt', type: 'Text', notes: 'Post excerpt' },
          { id: 'featuredCategory', type: 'Text', notes: 'Category badge' },
          { id: 'featuredDate', type: 'Text', notes: 'Formatted date' },
          { id: 'featuredReadTime', type: 'Text', notes: 'Reading time badge' },
          { id: 'featuredAuthor', type: 'Text', notes: 'Author name' },
          { id: 'featuredHeroLink', type: 'Box', notes: 'Click navigates to /blog/{slug}' },
        ],
      },
      {
        name: 'Category Filter',
        repeater: 'categoryFilterRepeater',
        elements: [
          { id: 'categoryFilterRepeater', type: 'Repeater', notes: 'Category filter chips' },
        ],
        children: [
          { id: 'filterChip', type: 'Box', notes: 'Clickable chip — active state changes color' },
          { id: 'filterLabel', type: 'Text', notes: 'Category name' },
        ],
      },
      {
        name: 'Social Share',
        elements: [
          { id: 'shareFacebook', type: 'Box', notes: 'Share on Facebook' },
          { id: 'sharePinterest', type: 'Box', notes: 'Share on Pinterest' },
          { id: 'shareTwitter', type: 'Box', notes: 'Share on X/Twitter' },
          { id: 'shareEmail', type: 'Box', notes: 'Share via email' },
        ],
      },
      {
        name: 'Newsletter CTA',
        elements: [
          { id: 'blogNewsletterEmail', type: 'Input', notes: 'Email input for newsletter' },
          { id: 'blogNewsletterSubmit', type: 'Button', notes: 'Subscribe button' },
          { id: 'blogNewsletterSuccess', type: 'Box', notes: 'Success state', defaultHidden: true },
          { id: 'blogNewsletterError', type: 'Text', notes: 'Error message', defaultHidden: true },
        ],
      },
      {
        name: 'SEO Schema',
        elements: [
          { id: 'blogSeoSchema', type: 'HtmlComponent', notes: 'JSON-LD schema injection' },
        ],
      },
    ],
  },
  {
    name: 'Blog Post',
    file: 'Blog Post.js',
    priority: 'P1',
    est: '35 min',
    sections: [
      {
        name: 'Post Header',
        elements: [
          { id: 'blogTitle', type: 'Text', notes: 'Post title heading' },
          { id: 'blogBody', type: 'Text', notes: 'Post excerpt / intro copy' },
          { id: 'blogAuthor', type: 'Text', notes: 'Author byline — Carolina Futons' },
          { id: 'blogDate', type: 'Text', notes: 'Formatted publish date' },
        ],
      },
      {
        name: 'Breadcrumbs',
        elements: [
          { id: 'breadcrumb1', type: 'Text', notes: 'Home link' },
          { id: 'breadcrumb2', type: 'Text', notes: 'Blog link' },
          { id: 'breadcrumb3', type: 'Text', notes: 'Current post title (aria-current=page)' },
          { id: 'breadcrumbSchemaHtml', type: 'HtmlComponent', notes: 'Breadcrumb JSON-LD schema' },
        ],
      },
      {
        name: 'Post Metadata',
        elements: [
          { id: 'postReadTime', type: 'Text', notes: "Reading time — e.g. '5 min read'" },
          { id: 'postDate', type: 'Text', notes: 'Formatted publish date' },
          { id: 'postCategory', type: 'Text', notes: 'Category name' },
        ],
      },
      {
        name: 'Author Bio',
        elements: [
          { id: 'authorName', type: 'Text', notes: 'Author name — Carolina Futons' },
          { id: 'authorDescription', type: 'Text', notes: 'Store bio text' },
          { id: 'authorLocation', type: 'Text', notes: 'Hendersonville, NC' },
          { id: 'authorEstablished', type: 'Text', notes: 'Est. 1991' },
          { id: 'authorBioSection', type: 'Section', notes: 'Expanded when post loads' },
        ],
      },
      {
        name: 'Social Share (Post page)',
        elements: [
          { id: 'postShareFacebook', type: 'Box', notes: 'Share on Facebook (opens new tab)' },
          { id: 'postSharePinterest', type: 'Box', notes: 'Share on Pinterest (opens new tab)' },
          { id: 'postShareTwitter', type: 'Box', notes: 'Share on X/Twitter (opens new tab)' },
          { id: 'postShareEmail', type: 'Box', notes: 'Share via email (mailto)' },
          { id: 'copyLink', type: 'Box', notes: "Copy post URL to clipboard — label changes to 'Copied!' for 2s" },
        ],
      },
      {
        name: 'Related Posts',
        repeater: 'relatedPostsRepeater',
        elements: [
          { id: 'relatedPostsRepeater', type: 'Repeater', notes: 'Related posts — up to 3' },
          { id: 'relatedPostsSection', type: 'Section', notes: 'Collapses when empty' },
        ],
        children: [
          { id: 'relatedTitle', type: 'Text', notes: 'Related post title' },
          { id: 'relatedCategory', type: 'Text', notes: 'Category' },
          { id: 'relatedReadTime', type: 'Text', notes: 'Reading time' },
          { id: 'relatedPostLink', type: 'Box', notes: 'Click navigates to /blog/{slug}' },
        ],
      },
      {
        name: 'Newsletter Subscription (Post)',
        elements: [
          { id: 'blogNewsletterInput', type: 'Input', notes: 'Inline email newsletter input on post page' },
          { id: 'blogNewsletterSubmit', type: 'Button', notes: 'Subscribe button' },
          { id: 'blogNewsletterSuccess', type: 'Box', notes: 'Success state', defaultHidden: true },
          { id: 'blogNewsletterError', type: 'Text', notes: 'Error message', defaultHidden: true },
        ],
      },
      {
        name: 'SEO Schema (Post)',
        elements: [
          { id: 'postSeoSchema', type: 'HtmlComponent', notes: 'BlogPosting JSON-LD + optional FAQ schema' },
          { id: 'postMetaHtml', type: 'HtmlComponent', notes: 'Dynamic title/description/canonical injection' },
        ],
      },
    ],
  },
  {
    name: 'Contact',
    file: 'Contact.k14wx.js',
    priority: 'P2',
    est: '30 min',
    sections: [
      {
        name: 'Contact Form',
        elements: [
          { id: 'contactName', type: 'Input', notes: 'Name' },
          { id: 'contactEmail', type: 'Input', notes: 'Email' },
          { id: 'contactPhone', type: 'Input', notes: 'Phone' },
          { id: 'contactSubject', type: 'Input', notes: 'Subject' },
          { id: 'contactMessage', type: 'TextBox', notes: 'Message' },
          { id: 'contactSubmit', type: 'Button', notes: 'Submit' },
          { id: 'contactSuccess', type: 'Box', notes: 'Success', defaultHidden: true },
          { id: 'contactForm', type: 'Box', notes: 'Form container' },
          { id: 'contactError', type: 'Text', notes: 'Error', defaultHidden: true },
          { id: 'contactNameError', type: 'Text', notes: 'Name error' },
          { id: 'contactEmailError', type: 'Text', notes: 'Email error' },
          { id: 'contactMessageError', type: 'Text', notes: 'Msg error' },
          { id: 'contactPhoneError', type: 'Text', notes: 'Phone error' },
        ],
      },
      {
        name: 'Business Info',
        repeater: 'contactFeatures',
        elements: [
          { id: 'infoAddress', type: 'Text', notes: 'Address' },
          { id: 'infoPhone', type: 'Text', notes: 'Phone' },
          { id: 'infoPhoneLink', type: 'Button', notes: 'Phone link' },
          { id: 'directionsBtn', type: 'Button', notes: 'Directions' },
          { id: 'contactFaqLink', type: 'Button', notes: 'Link to FAQ page' },
          { id: 'contactFeatures', type: 'Repeater', notes: 'Features' },
        ],
        children: [
          { id: 'featureItem', type: 'Text', notes: 'Feature text' },
        ],
      },
      {
        name: 'Hours',
        repeater: 'hoursRepeater',
        elements: [
          { id: 'todayStatus', type: 'Text', notes: 'Today status' },
          { id: 'hoursRepeater', type: 'Repeater', notes: 'Hours' },
        ],
        children: [
          { id: 'hourDay', type: 'Text', notes: 'Day' },
          { id: 'hourTime', type: 'Text', notes: 'Time' },
        ],
      },
      {
        name: 'Appointment',
        elements: [
          { id: 'appointmentBookBtn', type: 'Button', notes: 'Book' },
          { id: 'appointmentName', type: 'Input', notes: 'Name' },
          { id: 'appointmentEmail', type: 'Input', notes: 'Email' },
          { id: 'appointmentPhone', type: 'Input', notes: 'Phone' },
          { id: 'appointmentVisitType', type: 'Dropdown', notes: 'Visit type' },
          { id: 'appointmentDate', type: 'Dropdown', notes: 'Date (code uses .options)' },
          { id: 'appointmentTimeSlot', type: 'Dropdown', notes: 'Time' },
          { id: 'appointmentInterests', type: 'TextBox', notes: 'Interests' },
          { id: 'appointmentError', type: 'Text', notes: 'Error', defaultHidden: true },
          { id: 'appointmentConfirmation', type: 'Text', notes: 'Confirmation' },
          { id: 'appointmentForm', type: 'Box', notes: 'Form', defaultHidden: true },
          { id: 'appointmentSuccess', type: 'Box', notes: 'Success', defaultHidden: true },
        ],
      },
      {
        name: 'Social Proof',
        repeater: 'contactTestimonials',
        elements: [
          { id: 'contactTestimonials', type: 'Repeater', notes: 'Customer testimonials' },
        ],
        children: [
          { id: 'testimonialQuote', type: 'Text', notes: 'Quote' },
          { id: 'testimonialAuthor', type: 'Text', notes: 'Author' },
          { id: 'testimonialStars', type: 'Text', notes: 'Stars' },
        ],
      },
      {
        name: 'Schema',
        elements: [
          { id: 'contactSchemaHtml', type: 'HtmlComponent', notes: 'Contact schema' },
          { id: 'contactMetaHtml', type: 'HtmlComponent', notes: 'Meta tags' },
        ],
      },
    ],
  },
  {
    name: 'About',
    file: 'About.gar3e.js',
    priority: 'P2',
    est: '20 min',
    sections: [
      {
        name: 'Header',
        elements: [
          { id: 'aboutTitle', type: 'Text', notes: 'Title' },
          { id: 'aboutSubtitle', type: 'Text', notes: 'Subtitle' },
        ],
      },
      {
        name: 'Brand Story',
        repeater: 'brandStoryRepeater',
        elements: [
          { id: 'brandStoryRepeater', type: 'Repeater', notes: 'Brand story' },
        ],
        children: [
          { id: 'storyHeading', type: 'Text', notes: 'Heading' },
          { id: 'storyBody', type: 'Text', notes: 'Body' },
          { id: 'storyImage', type: 'Image', notes: 'Image' },
        ],
      },
      {
        name: 'Team',
        repeater: 'teamRepeater',
        elements: [
          { id: 'teamRepeater', type: 'Repeater', notes: 'Team members' },
          { id: 'teamGallery', type: 'Repeater', notes: 'Polaroid gallery' },
        ],
        children: [
          { id: 'teamName', type: 'Text', notes: 'Name' },
          { id: 'teamRole', type: 'Text', notes: 'Role' },
          { id: 'teamBio', type: 'Text', notes: 'Bio' },
          { id: 'polaroidImage', type: 'Image', notes: 'Photo' },
          { id: 'polaroidCaption', type: 'Text', notes: 'Caption' },
        ],
      },
      {
        name: 'Timeline',
        repeater: 'timelineRepeater',
        elements: [
          { id: 'timelineRepeater', type: 'Repeater', notes: 'Timeline' },
        ],
        children: [
          { id: 'timelineYear', type: 'Text', notes: 'Year' },
          { id: 'timelineTitle', type: 'Text', notes: 'Title' },
          { id: 'timelineDesc', type: 'Text', notes: 'Description' },
        ],
      },
      {
        name: 'Showroom Features',
        repeater: 'showroomFeatures',
        elements: [
          { id: 'showroomFeatures', type: 'Repeater', notes: 'Features' },
        ],
        children: [
          { id: 'featureText', type: 'Text', notes: 'Feature' },
        ],
      },
      {
        name: 'Testimonials',
        repeater: 'aboutTestimonials',
        elements: [
          { id: 'aboutTestimonials', type: 'Repeater', notes: 'Testimonials' },
        ],
        children: [
          { id: 'testimonialQuote', type: 'Text', notes: 'Quote' },
          { id: 'testimonialAuthor', type: 'Text', notes: 'Author' },
          { id: 'testimonialStars', type: 'Text', notes: 'Stars' },
        ],
      },
      {
        name: 'Showroom Info',
        elements: [
          { id: 'aboutAddress', type: 'Text', notes: 'Address' },
          { id: 'aboutPhone', type: 'Text', notes: 'Phone' },
          { id: 'aboutTodayHours', type: 'Text', notes: 'Today hours' },
          { id: 'aboutDirectionsBtn', type: 'Button', notes: 'Directions' },
        ],
      },
      {
        name: 'Visit CTA',
        elements: [
          { id: 'aboutVisitTitle', type: 'Text', notes: 'Title' },
          { id: 'aboutVisitBody', type: 'Text', notes: 'Body' },
          { id: 'aboutVisitBtn', type: 'Button', notes: 'Visit' },
          { id: 'aboutBookBtn', type: 'Button', notes: 'Book' },
          { id: 'aboutFaqLink', type: 'Button', notes: 'FAQ link' },
          { id: 'aboutSchemaHtml', type: 'HtmlComponent', notes: 'Schema' },
        ],
      },
    ],
  },
  {
    name: 'FAQ',
    file: 'FAQ.s2c5g.js',
    priority: 'P2',
    est: '15 min',
    sections: [
      {
        name: 'Header',
        elements: [
          { id: 'faqTitle', type: 'Text', notes: 'Title' },
          { id: 'faqSubtitle', type: 'Text', notes: 'Subtitle' },
          { id: 'faqSearchInput', type: 'Input', notes: 'Search' },
          { id: 'faqNoResults', type: 'Text', notes: 'No results' },
        ],
      },
      {
        name: 'Category Filters',
        repeater: 'faqCategoryRepeater',
        elements: [
          { id: 'faqCategoryRepeater', type: 'Repeater', notes: 'Categories' },
        ],
        children: [
          { id: 'categoryLabel', type: 'Text', notes: 'Label' },
        ],
      },
      {
        name: 'FAQ Accordion',
        repeater: 'faqRepeater',
        elements: [
          { id: 'faqRepeater', type: 'Repeater', notes: 'FAQ items' },
        ],
        children: [
          { id: 'faqQuestion', type: 'Text', notes: 'Question' },
          { id: 'faqAnswer', type: 'Text', notes: 'Answer' },
          { id: 'faqToggle', type: 'Text', notes: 'Toggle icon' },
        ],
      },
      {
        name: 'Contact CTA',
        elements: [
          { id: 'faqContactTitle', type: 'Text', notes: 'Title' },
          { id: 'faqContactBody', type: 'Text', notes: 'Body' },
          { id: 'faqContactBtn', type: 'Button', notes: 'Contact' },
          { id: 'faqPhoneBtn', type: 'Button', notes: 'Phone' },
        ],
      },
    ],
  },
  {
    name: 'Gift Cards',
    file: 'Gift Cards.js',
    priority: 'P2',
    est: '20 min',
    sections: [
      {
        name: 'Denomination Picker',
        elements: [
          { id: 'gcDenomRepeater', type: 'Repeater', notes: 'Amount picker' },
        ],
        children: [
          { id: 'gcDenomLabel', type: 'Text', notes: 'Amount label' },
        ],
      },
      {
        name: 'Purchase Form',
        elements: [
          { id: 'gcPurchaserEmail', type: 'Input', notes: 'Buyer email' },
          { id: 'gcRecipientEmail', type: 'Input', notes: 'Recipient email' },
          { id: 'gcRecipientName', type: 'Input', notes: 'Recipient name (optional)' },
          { id: 'gcMessage', type: 'TextBox', notes: 'Personal message (optional)' },
          { id: 'gcPurchaseBtn', type: 'Button', notes: 'Purchase Gift Card button' },
          { id: 'gcPurchaseForm', type: 'Section', notes: 'Purchase form container' },
          { id: 'gcPurchaseSuccess', type: 'Text', notes: 'Success message (hidden)', defaultHidden: true },
          { id: 'gcPurchaseError', type: 'Text', notes: 'Error message (hidden)', defaultHidden: true },
        ],
      },
      {
        name: 'Balance Checker',
        elements: [
          { id: 'gcCodeInput', type: 'Input', notes: 'Gift card code input' },
          { id: 'gcCheckBalanceBtn', type: 'Button', notes: 'Check Balance button' },
          { id: 'gcBalanceResult', type: 'Section', notes: 'Balance result (hidden)', defaultHidden: true },
          { id: 'gcBalanceAmount', type: 'Text', notes: 'Balance dollar amount' },
          { id: 'gcBalanceStatus', type: 'Text', notes: 'Active/Expired/Redeemed' },
          { id: 'gcBalanceUsage', type: 'Text', notes: 'Usage text' },
          { id: 'gcBalanceExpiry', type: 'Text', notes: 'Expiry date' },
          { id: 'gcBalanceError', type: 'Text', notes: 'Error message (hidden)', defaultHidden: true },
        ],
      },
    ],
  },
  {
    name: 'Thank You Page',
    file: 'Thank You Page.dk9x8.js',
    priority: 'P2',
    est: '30 min',
    sections: [
      {
        name: 'Order Summary',
        elements: [
          { id: 'thankYouTitle', type: 'Text', notes: 'Title' },
          { id: 'orderNumber', type: 'Text', notes: 'Order number' },
          { id: 'thankYouMessage', type: 'Text', notes: 'Message' },
          { id: 'orderContactInfo', type: 'Text', notes: 'Contact info' },
        ],
      },
      {
        name: 'Brenda\'s Message',
        elements: [
          { id: 'brendaMessageSection', type: 'Section', notes: 'Container' },
          { id: 'brendaTitle', type: 'Text', notes: 'Title' },
          { id: 'brendaMessage', type: 'Text', notes: 'Message' },
        ],
      },
      {
        name: 'Delivery Timeline',
        elements: [
          { id: 'deliveryTimeline', type: 'Section', notes: 'Container' },
          { id: 'deliveryEstimateText', type: 'Text', notes: 'Estimate' },
          { id: 'step1', type: 'Text', notes: 'Step 1' },
          { id: 'step2', type: 'Text', notes: 'Step 2' },
          { id: 'step3', type: 'Text', notes: 'Step 3' },
          { id: 'step4', type: 'Text', notes: 'Step 4' },
        ],
      },
      {
        name: 'Social Sharing',
        elements: [
          { id: 'shareText', type: 'Text', notes: 'Share text' },
          { id: 'shareFacebook', type: 'Button', notes: 'Facebook' },
          { id: 'sharePinterest', type: 'Button', notes: 'Pinterest' },
          { id: 'shareInstagram', type: 'Button', notes: 'Instagram' },
          { id: 'shareTwitter', type: 'Button', notes: 'Twitter' },
        ],
      },
      {
        name: 'Newsletter',
        elements: [
          { id: 'newsletterPrompt', type: 'Text', notes: 'Prompt' },
          { id: 'newsletterEmail', type: 'Input', notes: 'Email', defaultHidden: true },
          { id: 'newsletterSignup', type: 'Button', notes: 'Sign up' },
          { id: 'newsletterSuccess', type: 'Text', notes: 'Success', defaultHidden: true },
          { id: 'newsletterError', type: 'Text', notes: 'Error', defaultHidden: true },
        ],
      },
      {
        name: 'Referral',
        elements: [
          { id: 'referralSection', type: 'Section', notes: 'Container' },
          { id: 'referralTitle', type: 'Text', notes: 'Title' },
          { id: 'referralMessage', type: 'Text', notes: 'Message' },
          { id: 'referralCopyBtn', type: 'Button', notes: 'Copy' },
          { id: 'referralEmailBtn', type: 'Button', notes: 'Email' },
        ],
      },
      {
        name: 'Post-Purchase',
        repeater: 'postPurchaseRepeater',
        elements: [
          { id: 'postPurchaseHeading', type: 'Text', notes: 'Heading' },
          { id: 'postPurchaseRepeater', type: 'Repeater', notes: 'Products' },
        ],
        children: [
          { id: 'ppImage', type: 'Image', notes: 'Image' },
          { id: 'ppName', type: 'Text', notes: 'Name' },
          { id: 'ppPrice', type: 'Text', notes: 'Price' },
        ],
      },
      {
        name: 'Gift Card Upsell (CF-ou1f)',
        elements: [
          { id: 'giftUpsellSection', type: 'Section', notes: 'Post-purchase gift card upsell', defaultHidden: true },
          { id: 'giftUpsellHeading', type: 'Text', notes: 'Heading text' },
          { id: 'giftUpsellText', type: 'Text', notes: 'Body copy' },
          { id: 'giftUpsellCta', type: 'Button', notes: 'Send a Gift Card CTA' },
        ],
      },
      {
        name: 'Care / Assembly / Review',
        elements: [
          { id: 'careSequenceInfo', type: 'Section', notes: 'Care section' },
          { id: 'careSequenceText', type: 'Text', notes: 'Care text' },
          { id: 'assemblyGuideSection', type: 'Section', notes: 'Assembly' },
          { id: 'assemblyGuideTitle', type: 'Text', notes: 'Title' },
          { id: 'assemblyGuideText', type: 'Text', notes: 'Text' },
          { id: 'assemblyGuideBtn', type: 'Button', notes: 'Guide btn' },
          { id: 'testimonialSection', type: 'Section', notes: 'Testimonial' },
          { id: 'testimonialTitle', type: 'Text', notes: 'Title' },
          { id: 'testimonialPrompt', type: 'Text', notes: 'Prompt' },
          { id: 'testimonialNameInput', type: 'Input', notes: 'Name' },
          { id: 'testimonialStoryInput', type: 'TextBox', notes: 'Story' },
          { id: 'testimonialSubmitBtn', type: 'Button', notes: 'Submit' },
          { id: 'testimonialError', type: 'Text', notes: 'Error' },
          { id: 'testimonialSuccess', type: 'Text', notes: 'Success' },
          { id: 'reviewSection', type: 'Section', notes: 'Review' },
          { id: 'reviewTitle', type: 'Text', notes: 'Title' },
          { id: 'reviewPrompt', type: 'Text', notes: 'Prompt' },
          { id: 'reviewStar1', type: 'Button', notes: 'Star 1' },
          { id: 'reviewStar2', type: 'Button', notes: 'Star 2' },
          { id: 'reviewStar3', type: 'Button', notes: 'Star 3' },
          { id: 'reviewStar4', type: 'Button', notes: 'Star 4' },
          { id: 'reviewStar5', type: 'Button', notes: 'Star 5' },
          { id: 'reviewRating', type: 'Text', notes: 'Rating display' },
          { id: 'reviewBodyInput', type: 'TextBox', notes: 'Review body' },
          { id: 'reviewSubmitBtn', type: 'Button', notes: 'Submit' },
          { id: 'reviewSuccess', type: 'Text', notes: 'Success' },
          { id: 'reviewError', type: 'Text', notes: 'Error' },
        ],
      },
    ],
  },
  {
    name: 'Shipping Policy',
    file: 'Shipping Policy.ype8c.js',
    priority: 'P3',
    est: '20 min',
    sections: [
      {
        name: 'Calculator',
        elements: [
          { id: 'shippingZipInput', type: 'Input', notes: 'ZIP code' },
          { id: 'shippingCalcBtn', type: 'Button', notes: 'Calculate' },
          { id: 'shippingResult', type: 'Text', notes: 'Result' },
        ],
      },
      {
        name: 'Delivery Methods',
        repeater: 'deliveryRepeater',
        elements: [
          { id: 'deliveryRepeater', type: 'Repeater', notes: 'Methods' },
          { id: 'assemblyTips', type: 'Text', notes: 'Tips' },
        ],
        children: [
          { id: 'deliveryTitle', type: 'Text', notes: 'Title' },
          { id: 'deliveryDesc', type: 'Text', notes: 'Description' },
        ],
      },
      {
        name: 'Assembly Guides',
        repeater: 'assemblyGuidesRepeater',
        elements: [
          { id: 'assemblyGuidesRepeater', type: 'Repeater', notes: 'Guides' },
        ],
        children: [
          { id: 'guideTitle', type: 'Text', notes: 'Title' },
          { id: 'guideTime', type: 'Text', notes: 'Time' },
          { id: 'guideTools', type: 'Text', notes: 'Tools' },
          { id: 'guideSteps', type: 'Text', notes: 'Steps' },
          { id: 'guideExpandBtn', type: 'Button', notes: 'Expand' },
        ],
      },
      {
        name: 'Care Tips',
        repeater: 'careTipsRepeater',
        elements: [
          { id: 'careCategoryDropdown', type: 'Dropdown', notes: 'Category' },
          { id: 'careTipsRepeater', type: 'Repeater', notes: 'Tips' },
        ],
        children: [
          { id: 'careTipTitle', type: 'Text', notes: 'Title' },
          { id: 'careTipSummary', type: 'Text', notes: 'Summary' },
          { id: 'careTipSteps', type: 'Text', notes: 'Steps' },
          { id: 'careTipVideoLink', type: 'Button', notes: 'Video link' },
        ],
      },
      {
        name: 'Delivery Prep',
        elements: [
          { id: 'deliveryTierDropdown', type: 'Dropdown', notes: 'Tier' },
          { id: 'deliveryPrepInstructions', type: 'Text', notes: 'Instructions' },
          { id: 'deliveryPrepTips', type: 'Text', notes: 'Tips' },
        ],
      },
      {
        name: 'Scheduling',
        elements: [
          { id: 'nextAvailableSlot', type: 'Text', notes: 'Next slot' },
          { id: 'scheduleDeliveryBtn', type: 'Button', notes: 'Schedule' },
        ],
      },
      {
        name: 'Schema',
        elements: [
          { id: 'shippingSchemaHtml', type: 'HtmlComponent', notes: 'Schema' },
        ],
      },
    ],
  },
  {
    name: 'Fullscreen/Videos',
    file: 'Fullscreen Page.vu50r.js',
    priority: 'P3',
    est: '15 min',
    sections: [
      {
        name: 'Video Player',
        elements: [
          { id: 'videoPageTitle', type: 'Text', notes: 'Title' },
          { id: 'videoPageSubtitle', type: 'Text', notes: 'Subtitle' },
          { id: 'videoPlayer', type: 'Video', notes: 'Player' },
          { id: 'nowPlayingTitle', type: 'Text', notes: 'Now playing' },
          { id: 'videoPlayerContainer', type: 'Section', notes: 'Container' },
          { id: 'videoProductLink', type: 'Button', notes: 'Product link' },
          { id: 'videoNoResults', type: 'Text', notes: 'No results' },
        ],
      },
      {
        name: 'Video Grid',
        repeater: 'videosRepeater',
        elements: [
          { id: 'videosRepeater', type: 'Repeater', notes: 'Videos' },
        ],
        children: [
          { id: 'videoTitle', type: 'Text', notes: 'Title' },
          { id: 'videoDescription', type: 'Text', notes: 'Description' },
          { id: 'videoThumb', type: 'Image', notes: 'Thumbnail' },
          { id: 'videoCategoryBadge', type: 'Text', notes: 'Category' },
        ],
      },
      {
        name: 'Category Filters',
        repeater: 'videoCategoryRepeater',
        elements: [
          { id: 'videoCategoryRepeater', type: 'Repeater', notes: 'Categories' },
        ],
        children: [
          { id: 'categoryLabel', type: 'Text', notes: 'Label' },
        ],
      },
    ],
  },
  {
    name: 'Privacy Policy',
    file: 'Privacy Policy.pcvmd.js',
    priority: 'P3',
    est: '10 min',
    sections: [
      {
        name: 'Header',
        elements: [
          { id: 'policyTitle', type: 'Text', notes: 'Title' },
          { id: 'policyEffectiveDate', type: 'Text', notes: 'Date' },
          { id: 'policyIntro', type: 'Text', notes: 'Intro' },
        ],
      },
      {
        name: 'Sections',
        repeater: 'policyRepeater',
        elements: [
          { id: 'policyRepeater', type: 'Repeater', notes: 'Policy sections' },
        ],
        children: [
          { id: 'sectionTitle', type: 'Text', notes: 'Title' },
          { id: 'sectionContent', type: 'Text', notes: 'Content' },
          { id: 'sectionToggle', type: 'Text', notes: 'Toggle' },
        ],
      },
      {
        name: 'TOC',
        repeater: 'policyTocRepeater',
        elements: [
          { id: 'policyTocRepeater', type: 'Repeater', notes: 'TOC links' },
        ],
        children: [
          { id: 'tocLink', type: 'Text', notes: 'Link' },
        ],
      },
      {
        name: 'Anchor Sections',
        elements: [
          { id: 'policyCollect', type: 'Section', notes: 'Collection' },
          { id: 'policyUse', type: 'Section', notes: 'Use' },
          { id: 'policySharing', type: 'Section', notes: 'Sharing' },
          { id: 'policyCookies', type: 'Section', notes: 'Cookies' },
          { id: 'policyRights', type: 'Section', notes: 'Rights' },
          { id: 'policySecurity', type: 'Section', notes: 'Security' },
          { id: 'policyChildren', type: 'Section', notes: 'Children' },
          { id: 'policyChanges', type: 'Section', notes: 'Changes' },
          { id: 'policyContact', type: 'Section', notes: 'Contact' },
        ],
      },
    ],
  },
  {
    name: 'Terms & Conditions',
    file: 'Terms & Conditions.z0xvf.js',
    priority: 'P3',
    est: '10 min',
    sections: [
      {
        name: 'Header',
        elements: [
          { id: 'termsTitle', type: 'Text', notes: 'Title' },
          { id: 'termsEffectiveDate', type: 'Text', notes: 'Date' },
          { id: 'termsIntro', type: 'Text', notes: 'Intro' },
        ],
      },
      {
        name: 'Sections',
        repeater: 'termsRepeater',
        elements: [
          { id: 'termsRepeater', type: 'Repeater', notes: 'Terms sections' },
        ],
        children: [
          { id: 'sectionTitle', type: 'Text', notes: 'Title' },
          { id: 'sectionContent', type: 'Text', notes: 'Content' },
          { id: 'sectionToggle', type: 'Text', notes: 'Toggle' },
        ],
      },
      {
        name: 'TOC',
        repeater: 'termsTocRepeater',
        elements: [
          { id: 'termsTocRepeater', type: 'Repeater', notes: 'TOC links' },
        ],
        children: [
          { id: 'tocLink', type: 'Text', notes: 'Link' },
        ],
      },
      {
        name: 'Anchor Sections',
        elements: [
          { id: 'termsAcceptance', type: 'Section', notes: 'Acceptance' },
          { id: 'termsProducts', type: 'Section', notes: 'Products' },
          { id: 'termsOrders', type: 'Section', notes: 'Orders' },
          { id: 'termsShipping', type: 'Section', notes: 'Shipping' },
          { id: 'termsReturns', type: 'Section', notes: 'Returns' },
          { id: 'termsWarranties', type: 'Section', notes: 'Warranties' },
          { id: 'termsIP', type: 'Section', notes: 'IP' },
          { id: 'termsLiability', type: 'Section', notes: 'Liability' },
          { id: 'termsGoverning', type: 'Section', notes: 'Governing' },
          { id: 'termsContact', type: 'Section', notes: 'Contact' },
        ],
      },
    ],
  },
  {
    name: 'Refund Policy',
    file: 'Refund Policy.jmwgj.js',
    priority: 'P3',
    est: '5 min',
    sections: [
      {
        name: 'Policy Sections',
        repeater: 'policyRepeater',
        elements: [
          { id: 'policyRepeater', type: 'Repeater', notes: 'Policy sections' },
        ],
        children: [
          { id: 'policyTitle', type: 'Text', notes: 'Title' },
          { id: 'policyContent', type: 'Text', notes: 'Content' },
          { id: 'policyToggle', type: 'Text', notes: 'Toggle' },
        ],
      },
    ],
  },
  {
    name: 'Search Suggestions Box',
    file: 'Search Suggestions Box.gg5mx.js',
    priority: 'P3',
    est: '5 min',
    sections: [
      {
        name: 'Suggestions',
        repeater: 'suggestionsRepeater',
        elements: [
          { id: 'searchInput', type: 'Input', notes: 'Search input' },
          { id: 'suggestionsBox', type: 'Box', notes: 'Container' },
          { id: 'suggestionsRepeater', type: 'Repeater', notes: 'Suggestions' },
        ],
        children: [
          { id: 'sugImage', type: 'Image', notes: 'Image' },
          { id: 'sugName', type: 'Text', notes: 'Name' },
          { id: 'sugPrice', type: 'Text', notes: 'Price' },
        ],
      },
    ],
  },
  {
    name: 'Returns Portal (on Member Page)',
    file: 'ReturnsPortal.js',
    priority: 'P2',
    est: '20 min',
    sections: [
      {
        name: 'Return Flow',
        elements: [
          { id: 'returnFlowSection', type: 'Box', notes: 'Return flow container' },
          { id: 'returnNoOrders', type: 'Text', notes: 'No orders message' },
          { id: 'returnOrderDropdown', type: 'Dropdown', notes: 'Select order' },
          { id: 'returnReasonDropdown', type: 'Dropdown', notes: 'Return reason' },
          { id: 'returnWindowInfo', type: 'Text', notes: 'Return window status' },
          { id: 'returnDetailsInput', type: 'TextBox', notes: 'Additional details' },
          { id: 'returnError', type: 'Text', notes: 'Error message' },
          { id: 'returnSuccess', type: 'Text', notes: 'Success message' },
          { id: 'submitReturnBtn', type: 'Button', notes: 'Submit return' },
          { id: 'cancelReturnBtn', type: 'Button', notes: 'Cancel flow' },
          { id: 'returnsListSection', type: 'Box', notes: 'Return history container' },
        ],
      },
      {
        name: 'Returnable Items',
        repeater: 'returnItemsRepeater',
        elements: [
          { id: 'returnItemsRepeater', type: 'Repeater', notes: 'Returnable items' },
        ],
        children: [
          { id: 'returnItemName', type: 'Text', notes: 'Item name' },
          { id: 'returnItemQty', type: 'Text', notes: 'Quantity' },
          { id: 'returnItemPrice', type: 'Text', notes: 'Price' },
          { id: 'returnItemImage', type: 'Image', notes: 'Item image' },
          { id: 'returnItemCheckbox', type: 'CheckboxGroup', notes: 'Select item' },
          { id: 'returnItemBlockReason', type: 'Text', notes: 'Block reason' },
        ],
      },
      {
        name: 'Return History',
        repeater: 'returnsListRepeater',
        elements: [
          { id: 'returnsListRepeater', type: 'Repeater', notes: 'Return requests' },
        ],
        children: [
          { id: 'returnRma', type: 'Text', notes: 'RMA number' },
          { id: 'returnOrderNum', type: 'Text', notes: 'Order number' },
          { id: 'returnDate', type: 'Text', notes: 'Request date' },
          { id: 'returnReason', type: 'Text', notes: 'Reason' },
          { id: 'returnStatusBadge', type: 'Text', notes: 'Status badge' },
          { id: 'returnTimeline', type: 'Text', notes: 'Timeline' },
        ],
      },
    ],
  },
  {
    name: 'Product Financing (on Product Page)',
    file: 'ProductFinancing.js',
    priority: 'P1',
    est: '15 min',
    sections: [
      {
        name: 'Financing Widget',
        elements: [
          { id: 'financingSection', type: 'Box', notes: 'Financing container' },
          { id: 'financingTeaser', type: 'Text', notes: 'As low as $X/mo' },
          { id: 'afterpayMessage', type: 'Text', notes: 'Afterpay message' },
          { id: 'financingLearnMore', type: 'Button', notes: 'Learn more link' },
          { id: 'financingModal', type: 'Box', notes: 'Modal dialog' },
          { id: 'financingOverlay', type: 'Box', notes: 'Modal overlay' },
          { id: 'financingClose', type: 'Button', notes: 'Close modal' },
        ],
      },
      {
        name: 'Financing Plans',
        repeater: 'financingRepeater',
        elements: [
          { id: 'financingRepeater', type: 'Repeater', notes: 'Financing plans' },
        ],
        children: [
          { id: 'planLabel', type: 'Text', notes: 'Plan label' },
          { id: 'planMonthly', type: 'Text', notes: 'Monthly payment' },
          { id: 'planDescription', type: 'Text', notes: 'Description' },
          { id: 'planInterest', type: 'Text', notes: 'Interest/APR' },
        ],
      },
      {
        name: 'Financing Details Modal',
        repeater: 'financingDetailRepeater',
        elements: [
          { id: 'financingDetailRepeater', type: 'Repeater', notes: 'Detail view' },
        ],
        children: [
          { id: 'detailLabel', type: 'Text', notes: 'Label' },
          { id: 'detailMonthly', type: 'Text', notes: 'Monthly' },
          { id: 'detailApr', type: 'Text', notes: 'APR' },
          { id: 'detailInterest', type: 'Text', notes: 'Interest' },
        ],
      },
    ],
  },
  {
    name: 'Admin Analytics Dashboard',
    file: 'analyticsDashboard.web.js',
    priority: 'P2',
    est: '40 min',
    sections: [
      {
        name: 'KPI Summary Cards',
        elements: [
          { id: 'dashKpiSection', type: 'Section', notes: 'Dashboard container' },
          { id: 'dashDateRange', type: 'Dropdown', notes: 'Time range selector' },
          { id: 'dashKpiRepeater', type: 'Repeater', notes: '6 KPI cards' },
          { id: 'dashFunnelSection', type: 'Box', notes: 'Funnel chart container' },
          { id: 'dashFunnelHtml', type: 'HtmlComponent', notes: 'Funnel visualization' },
          { id: 'dashTopProducts', type: 'Repeater', notes: 'Top products table' },
        ],
        children: [
          { id: 'dashKpiLabel', type: 'Text', notes: 'Metric name' },
          { id: 'dashKpiValue', type: 'Text', notes: 'Metric value' },
          { id: 'dashKpiTrend', type: 'Text', notes: 'Trend indicator' },
          { id: 'dashProductName', type: 'Text', notes: 'Product name' },
          { id: 'dashProductViews', type: 'Text', notes: 'View count' },
          { id: 'dashProductConv', type: 'Text', notes: 'Conversion rate' },
          { id: 'dashProductRev', type: 'Text', notes: 'Revenue' },
        ],
      },
      {
        name: 'Category & Email Performance',
        elements: [
          { id: 'dashCategoryRepeater', type: 'Repeater', notes: 'Category breakdown' },
          { id: 'dashEmailSection', type: 'Box', notes: 'Email metrics container' },
          { id: 'dashEmailRepeater', type: 'Repeater', notes: 'Email sequence metrics' },
          { id: 'dashRevenueChart', type: 'HtmlComponent', notes: 'Revenue chart' },
        ],
        children: [
          { id: 'dashCatName', type: 'Text', notes: 'Category name' },
          { id: 'dashCatViews', type: 'Text', notes: 'Views' },
          { id: 'dashCatCartRate', type: 'Text', notes: 'Add-to-cart %' },
          { id: 'dashEmailType', type: 'Text', notes: 'Sequence type' },
          { id: 'dashEmailSent', type: 'Text', notes: 'Sent count' },
          { id: 'dashEmailOpened', type: 'Text', notes: 'Open rate' },
          { id: 'dashEmailClicked', type: 'Text', notes: 'Click rate' },
        ],
      },
    ],
  },
  {
    name: 'Content Orchestrator Admin',
    file: 'contentOrchestrator.web.js',
    priority: 'P2',
    est: '35 min',
    sections: [
      {
        name: 'Orchestration Controls',
        elements: [
          { id: 'orchConfigSection', type: 'Section', notes: 'Orchestrator admin page' },
          { id: 'orchNewsletterToggle', type: 'Toggle', notes: 'Enable newsletter generation' },
          { id: 'orchSocialToggle', type: 'Toggle', notes: 'Enable social story generation' },
          { id: 'orchCatalogToggle', type: 'Toggle', notes: 'Enable catalog sync' },
          { id: 'orchEmailToggle', type: 'Toggle', notes: 'Enable email campaigns' },
          { id: 'orchEventType', type: 'Dropdown', notes: 'Event type selector' },
          { id: 'orchDryRunToggle', type: 'Toggle', notes: 'Dry-run mode' },
          { id: 'orchTriggerBtn', type: 'Button', notes: 'Manual trigger' },
          { id: 'orchStatusText', type: 'Text', notes: 'Last trigger result' },
        ],
      },
      {
        name: 'Schedule Queue',
        elements: [
          { id: 'schedQueueRepeater', type: 'Repeater', notes: 'Content queue' },
          { id: 'schedStatusFilter', type: 'Dropdown', notes: 'Filter by status' },
          { id: 'schedStatsSection', type: 'Box', notes: 'Queue statistics' },
          { id: 'schedStatsPending', type: 'Text', notes: 'Pending count' },
          { id: 'schedStatsSent', type: 'Text', notes: 'Sent count' },
          { id: 'schedStatsFailed', type: 'Text', notes: 'Failed count' },
        ],
        children: [
          { id: 'schedContentType', type: 'Text', notes: 'newsletter/social/catalog' },
          { id: 'schedPlatform', type: 'Text', notes: 'Platform name' },
          { id: 'schedProduct', type: 'Text', notes: 'Product name' },
          { id: 'schedTime', type: 'Text', notes: 'Scheduled datetime' },
          { id: 'schedStatus', type: 'Text', notes: 'Status badge' },
          { id: 'schedCancelBtn', type: 'Button', notes: 'Cancel item' },
        ],
      },
    ],
  },
  {
    name: 'Bundle Analytics (on Product Page)',
    file: 'bundleAnalytics.web.js',
    priority: 'P2',
    est: '15 min',
    sections: [
      {
        name: 'Bundle Performance',
        elements: [
          { id: 'bundleAnalyticsSection', type: 'Box', notes: 'Admin analytics panel' },
          { id: 'bundlePerformanceRepeater', type: 'Repeater', notes: 'Bundle comparison' },
          { id: 'bundleRecommendations', type: 'Repeater', notes: 'AI recommendations' },
        ],
        children: [
          { id: 'bundleName', type: 'Text', notes: 'Bundle name' },
          { id: 'bundleConv', type: 'Text', notes: 'Conversion rate' },
          { id: 'bundleRevenue', type: 'Text', notes: 'Revenue' },
          { id: 'bundleAction', type: 'Text', notes: 'Recommended action' },
        ],
      },
    ],
  },
  {
    name: 'Core Web Vitals Monitor',
    file: 'coreWebVitals.web.js',
    priority: 'P2',
    est: '15 min',
    sections: [
      {
        name: 'Performance Dashboard',
        elements: [
          { id: 'cwvDashboard', type: 'Box', notes: 'CWV dashboard container' },
          { id: 'cwvMetricsRepeater', type: 'Repeater', notes: '6 metric cards' },
          { id: 'cwvPageDropdown', type: 'Dropdown', notes: 'Page selector' },
          { id: 'cwvImageHints', type: 'Repeater', notes: 'Image optimization tips' },
        ],
        children: [
          { id: 'cwvMetricName', type: 'Text', notes: 'Metric name' },
          { id: 'cwvMetricValue', type: 'Text', notes: 'Current value' },
          { id: 'cwvMetricTarget', type: 'Text', notes: 'Target threshold' },
          { id: 'cwvMetricStatus', type: 'Text', notes: 'Pass/Fail badge' },
        ],
      },
    ],
  },
  {
    name: 'Error Monitoring Admin',
    file: 'errorMonitoring.web.js',
    priority: 'P2',
    est: '15 min',
    sections: [
      {
        name: 'Error Dashboard',
        elements: [
          { id: 'errorDashboard', type: 'Box', notes: 'Error dashboard container' },
          { id: 'errorRepeater', type: 'Repeater', notes: 'Error log entries' },
          { id: 'errorFlowFilter', type: 'Dropdown', notes: 'Filter by flow' },
          { id: 'errorDateRange', type: 'Dropdown', notes: 'Time range' },
        ],
        children: [
          { id: 'errorTimestamp', type: 'Text', notes: 'When' },
          { id: 'errorFlow', type: 'Text', notes: 'Checkout/Cart/Product' },
          { id: 'errorMessage', type: 'Text', notes: 'Error summary' },
          { id: 'errorCount', type: 'Text', notes: 'Occurrence count' },
        ],
      },
    ],
  },
  {
    name: 'Social Media Hub (on Home/Product Pages)',
    file: 'SocialFeedEmbed.js + socialStoryHelpers.js',
    priority: 'P2',
    est: '25 min',
    sections: [
      {
        name: 'Social Feed Embeds',
        elements: [
          { id: 'socialFeedSection', type: 'Section', notes: 'Social feeds container' },
          { id: 'socialSectionTitle', type: 'Text', notes: 'Section heading' },
          { id: 'instagramFeed', type: 'HtmlComponent', notes: 'Instagram grid embed' },
          { id: 'tiktokEmbed', type: 'HtmlComponent', notes: 'TikTok video embed' },
          { id: 'pinterestBoard', type: 'HtmlComponent', notes: 'Pinterest board embed' },
        ],
      },
      {
        name: 'Social Catalog Sync Status',
        elements: [
          { id: 'catalogSyncStatus', type: 'Box', notes: 'Sync status container' },
          { id: 'fbSyncStatus', type: 'Text', notes: 'Facebook sync health' },
          { id: 'fbRateLimit', type: 'Text', notes: 'FB API rate usage' },
          { id: 'pinSyncStatus', type: 'Text', notes: 'Pinterest sync health' },
          { id: 'pinRateLimit', type: 'Text', notes: 'Pinterest API rate usage' },
          { id: 'catalogAuditBtn', type: 'Button', notes: 'Run catalog audit' },
          { id: 'catalogAuditResults', type: 'Repeater', notes: 'Audit results' },
        ],
        children: [
          { id: 'auditProductName', type: 'Text', notes: 'Product name' },
          { id: 'auditFbReady', type: 'Text', notes: 'FB ready status' },
          { id: 'auditPinReady', type: 'Text', notes: 'Pinterest ready status' },
          { id: 'auditIssues', type: 'Text', notes: 'Issues found' },
        ],
      },
    ],
  },
  {
    name: 'Social Media Content Calendar',
    file: 'contentScheduler.web.js + socialStoryHelpers.js',
    priority: 'P2',
    est: '20 min',
    sections: [
      {
        name: 'Content Calendar View',
        elements: [
          { id: 'contentCalendar', type: 'Box', notes: 'Calendar container' },
          { id: 'calendarViewToggle', type: 'Button', notes: 'Grid/List toggle' },
          { id: 'calendarPlatformFilter', type: 'Dropdown', notes: 'Platform filter' },
          { id: 'calendarRepeater', type: 'Repeater', notes: 'Scheduled content items' },
        ],
        children: [
          { id: 'calendarDate', type: 'Text', notes: 'Schedule date' },
          { id: 'calendarType', type: 'Text', notes: 'Content type' },
          { id: 'calendarPlatform', type: 'Text', notes: 'Platform' },
          { id: 'calendarProduct', type: 'Text', notes: 'Product name' },
          { id: 'calendarStatus', type: 'Text', notes: 'Status badge' },
        ],
      },
    ],
  },
  {
    name: 'Compare Page',
    file: 'Compare Page.js',
    priority: 'P1',
    est: '35 min',
    sections: [
      {
        name: 'URL Params / Fetch',
        elements: [
          { id: 'compareGridSection', type: 'Section', notes: 'Main content — opacity 0.4 skeleton on load' },
          { id: 'compareEmptySection', type: 'Section', notes: 'Shown when no products to compare' },
          { id: 'compareErrorSection', type: 'Section', notes: 'Shown on fetch failure' },
          { id: 'compareAttrSection', type: 'Section', notes: 'Attributes table section' },
          { id: 'compareEmptyShopBtn', type: 'Button', notes: '→ /shop-main (empty state)' },
          { id: 'compareErrorText', type: 'Text', notes: 'Error message' },
        ],
      },
      {
        name: 'Column Rendering',
        repeater: 'compareColRepeater',
        elements: [
          { id: 'compareSubtitle', type: 'Text', notes: 'Comparing N products count' },
          { id: 'compareColRepeater', type: 'Repeater', notes: 'One column per product' },
        ],
        children: [
          { id: 'compareColImage', type: 'Image', notes: 'Product image' },
          { id: 'compareColName', type: 'Text', notes: 'Product name' },
          { id: 'compareColPrice', type: 'Text', notes: 'Current/sale price' },
          { id: 'compareColOrigPrice', type: 'Text', notes: 'Original price strikethrough', defaultHidden: true },
          { id: 'compareColBadge', type: 'Text', notes: 'Sale/ribbon badge', defaultHidden: true },
          { id: 'compareColAddCart', type: 'Button', notes: 'Add to cart — cycles states (2s)' },
          { id: 'compareColViewBtn', type: 'Button', notes: 'View product page' },
          { id: 'compareColRemoveBtn', type: 'Button', notes: 'Remove from compare' },
        ],
      },
      {
        name: 'Attributes Table',
        repeater: 'compareAttrRepeater',
        elements: [
          { id: 'compareAttrRepeater', type: 'Repeater', notes: 'Attribute rows' },
        ],
        children: [
          { id: 'compareAttrLabel', type: 'Text', notes: 'Attribute name' },
          { id: 'compareAttrRow', type: 'HtmlComponent', notes: 'Inline-block value cells with diff highlight' },
        ],
      },
      {
        name: 'Mobile & Reset',
        elements: [
          { id: 'compareMobileSnapHtml', type: 'HtmlComponent', notes: 'Mobile snap-scroll CSS via postMessage' },
          { id: 'compareResetBtn', type: 'Button', notes: 'Start Over → /shop-main' },
        ],
      },
      {
        name: 'SEO',
        elements: [
          { id: 'compareSchemaHtml', type: 'HtmlComponent', notes: 'ItemList JSON-LD schema via postMessage' },
        ],
      },
    ],
  },
  {
    name: 'Fabric Swatches',
    file: 'Fabric Swatches.js',
    priority: 'P1',
    est: '40 min',
    sections: [
      {
        name: 'Filter Controls',
        elements: [
          { id: 'swatchDataset', type: 'Dataset', notes: 'FabricSwatches CMS collection' },
          { id: 'swatchSearchInput', type: 'Input', notes: 'Debounced 250ms name/color search' },
          { id: 'swatchColorFilter', type: 'Dropdown', notes: 'Color family filter' },
          { id: 'swatchMaterialFilter', type: 'Dropdown', notes: 'Material filter' },
          { id: 'swatchBrandFilter', type: 'Dropdown', notes: 'Brand client-side filter' },
          { id: 'swatchClearFilters', type: 'Button', notes: 'Reset all filters' },
          { id: 'swatchResultCount', type: 'Text', notes: 'N swatches count (aria-live polite)' },
          { id: 'swatchEmptyState', type: 'Box', notes: 'No results state', defaultHidden: true },
        ],
      },
      {
        name: 'Swatch Grid',
        repeater: 'swatchGridRepeater',
        elements: [
          { id: 'swatchGridRepeater', type: 'Repeater', notes: 'CMS-driven swatch grid' },
        ],
        children: [
          { id: 'swatchCard', type: 'Box', notes: 'Card container (border color on select)' },
          { id: 'swatchColorDot', type: 'Box', notes: 'Color preview dot (hexColor bg)' },
          { id: 'swatchImage', type: 'Image', notes: 'Swatch fabric image' },
          { id: 'swatchName', type: 'Text', notes: 'Swatch name' },
          { id: 'swatchMaterial', type: 'Text', notes: 'Material type' },
          { id: 'swatchBrand', type: 'Text', notes: 'Brand name' },
          { id: 'swatchOutOfStock', type: 'Box', notes: 'Out of stock overlay', defaultHidden: true },
          { id: 'swatchSelectedBadge', type: 'Box', notes: 'Selected checkmark badge', defaultHidden: true },
          { id: 'swatchSelectBtn', type: 'Button', notes: 'Add/Remove toggle — disabled at max-5' },
        ],
      },
      {
        name: 'Selection Tray',
        repeater: 'swatchSelectionRepeater',
        elements: [
          { id: 'swatchTraySection', type: 'Section', notes: 'Collapsed at 0 selections, expanded otherwise' },
          { id: 'swatchTrayTitle', type: 'Text', notes: 'Your Selections (N / 5)' },
          { id: 'swatchSelectionRepeater', type: 'Repeater', notes: 'Selected swatch mini-cards' },
          { id: 'swatchTrayProceedBtn', type: 'Button', notes: 'Open request form' },
          { id: 'swatchTrayClearBtn', type: 'Button', notes: 'Clear all selections' },
        ],
        children: [
          { id: 'swatchTrayDot', type: 'Box', notes: 'Color preview dot' },
          { id: 'swatchTrayName', type: 'Text', notes: 'Swatch name' },
          { id: 'swatchTrayRemove', type: 'Button', notes: 'Remove swatch from selection' },
        ],
      },
      {
        name: 'Request Form',
        elements: [
          { id: 'swatchFormOverlay', type: 'Box', notes: 'Collapsible form overlay' },
          { id: 'swatchFormModal', type: 'Box', notes: 'Accessible dialog container' },
          { id: 'swatchFormClose', type: 'Button', notes: 'Close form (X)' },
          { id: 'swatchFirstName', type: 'Input', notes: 'First name (required)' },
          { id: 'swatchLastName', type: 'Input', notes: 'Last name (required)' },
          { id: 'swatchEmail', type: 'Input', notes: 'Email (required, validated)' },
          { id: 'swatchAddress1', type: 'Input', notes: 'Street address (required)' },
          { id: 'swatchAddress2', type: 'Input', notes: 'Address line 2 (optional)' },
          { id: 'swatchCity', type: 'Input', notes: 'City (required)' },
          { id: 'swatchState', type: 'Input', notes: 'State (required)' },
          { id: 'swatchZip', type: 'Input', notes: 'ZIP 5-digit (required)' },
          { id: 'swatchPhone', type: 'Input', notes: 'Phone (optional)' },
          { id: 'swatchSubmitBtn', type: 'Button', notes: 'Submit — cycles Send My Swatches/Sending...' },
          { id: 'swatchFormError', type: 'Text', notes: 'Validation/API error', defaultHidden: true },
          { id: 'swatchFormSuccess', type: 'Box', notes: 'Success state', defaultHidden: true },
          { id: 'swatchSuccessShopBtn', type: 'Button', notes: 'Continue shopping post-success' },
        ],
      },
      {
        name: 'SEO',
        elements: [
          { id: 'swatchSchemaHtml', type: 'HtmlComponent', notes: 'Service JSON-LD: Free Fabric Swatch Program' },
        ],
      },
    ],
  },
  {
    name: 'Wishlist Share',
    file: 'Wishlist Share.js',
    priority: 'P1',
    est: '25 min',
    sections: [
      {
        name: 'Token Resolution',
        elements: [
          { id: 'wishlistShareContentSection', type: 'Section', notes: 'Main content — opacity 0.4 skeleton on load' },
          { id: 'wishlistShareInvalidSection', type: 'Section', notes: 'Invalid/expired/missing token state' },
          { id: 'wishlistShareInvalidText', type: 'Text', notes: 'Error message for invalid token' },
          { id: 'wishlistShareShopBtn', type: 'Button', notes: '→ /shop-main (wired in all states)' },
          { id: 'wishlistShareTitle', type: 'Text', notes: "{ownerName}'s Wishlist" },
          { id: 'wishlistShareSubtitle', type: 'Text', notes: 'N item(s) count' },
          { id: 'wishlistShareEmptySection', type: 'Section', notes: 'Empty wishlist state', defaultHidden: true },
        ],
      },
      {
        name: 'Product Cards',
        repeater: 'wishlistShareRepeater',
        elements: [
          { id: 'wishlistShareRepeater', type: 'Repeater', notes: 'Shared wishlist product cards' },
        ],
        children: [
          { id: 'shareImage', type: 'Image', notes: 'Product image (src + alt via populateShareCard)' },
          { id: 'shareName', type: 'Text', notes: 'Product name' },
          { id: 'shareAddCart', type: 'Button', notes: 'Add to cart — cycles states (2s reset)' },
        ],
      },
      {
        name: 'SEO',
        elements: [],
      },
    ],
  },
  {
    name: 'Showroom (Product Page)',
    file: 'showroomService.web.js + Product Page.js',
    priority: 'P2',
    est: '20 min',
    sections: [
      {
        name: 'Showroom CTA (S1)',
        elements: [
          { id: 'showroomCTA', type: 'Button', notes: 'Book a Showroom Visit → Wix Bookings' },
        ],
      },
      {
        name: 'QR / Store Mode (S3)',
        elements: [
          { id: 'storeModeBar', type: 'Text', notes: 'Staff store-mode banner (shown only when ?qr=1)', defaultHidden: true },
        ],
      },
    ],
  },
  {
    name: 'Showroom (Category Page)',
    file: 'showroomService.web.js + Category Page.js',
    priority: 'P2',
    est: '10 min',
    sections: [
      {
        name: 'See It In Store Badge (S2)',
        elements: [
          { id: 'showroomBadge', type: 'Text', notes: 'See It In Store badge (repeater child — shown for eligible products)', defaultHidden: true },
        ],
      },
    ],
  },
  {
    name: 'Showroom (Home Page)',
    file: 'showroomService.web.js + Home.js',
    priority: 'P2',
    est: '20 min',
    sections: [
      {
        name: 'Showroom Section (S4)',
        elements: [
          { id: 'showroomSection', type: 'Section', notes: 'Showroom info container — hidden until data loads', defaultHidden: true },
          { id: 'showroomAddress', type: 'Text', notes: 'Address: name, street, city/state/zip, phone' },
          { id: 'showroomHours', type: 'Text', notes: 'Formatted hours (Wed–Fri 10–5, Sat 10–4, closed Sun–Tue)' },
          { id: 'showroomBookingCTA', type: 'Button', notes: 'Book a Visit → Wix Bookings' },
          { id: 'showroomMapEmbed', type: 'Button', notes: 'Google Maps link (.url property set by code)' },
        ],
      },
    ],
  },
];
=======
 * PAGES data bundle — stub for S1 scaffold.
 *
 * S2 (CF-4rv2) will replace this stub with the full 28-page / 1,093-element
 * dataset extracted from docs/editor-hookup-guide.html.
 *
 * This module exports the data helpers used by the panel; the actual data
 * array is intentionally empty here so the app compiles and the panel
 * renders its placeholder state.
 */

import type { PageDef, ElementDef } from '../types/index.js';

export const PAGES: PageDef[] = [];
>>>>>>> origin/polecat/chrome/CF-3avw@mmvdgu2t

/** Return the ElementDef for a specific element ID on a page, or null. */
export function getElementDef(pageName: string, elementId: string): ElementDef | null {
  const page = PAGES.find((p) => p.name === pageName);
  if (!page) return null;
  for (const section of page.sections) {
    const hit =
      section.elements.find((e) => e.id === elementId) ??
      section.children?.find((e) => e.id === elementId) ??
      null;
    if (hit) return hit;
  }
  return null;
}

/** Return all elements for a page (sections + repeater children flattened). */
export function getAllElements(pageName: string): ElementDef[] {
  const page = PAGES.find((p) => p.name === pageName);
  if (!page) return [];
  return page.sections.flatMap((s) => [
    ...s.elements,
    ...(s.children ?? []),
  ]);
}

/** Return elements not yet hooked (their ID is not in hookedIds). */
export function getUnhookedElements(pageName: string, hookedIds: string[]): ElementDef[] {
  const hookedSet = new Set(hookedIds);
  return getAllElements(pageName).filter((e) => !hookedSet.has(e.id));
}
<<<<<<< HEAD

/**
 * S14: Return the section where elementId is a repeater child, or null.
 * Used by the Repeater Guard to detect when the current element lives
 * inside a repeater template and must be accessed via Edit Repeater.
 */
export function getRepeaterSection(pageName: string, elementId: string): SectionDef | null {
  const page = PAGES.find((p) => p.name === pageName);
  if (!page) return null;
  for (const section of page.sections) {
    if (section.children?.some((e) => e.id === elementId)) {
      return section;
    }
  }
  return null;
}
=======
>>>>>>> origin/polecat/chrome/CF-3avw@mmvdgu2t
