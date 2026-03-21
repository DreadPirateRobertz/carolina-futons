/**
 * Static local SEO data for /near/[city] city landing pages.
 * Shared source of truth for localSeoService.web.js (webMethod layer).
 *
 * Each key is a URL slug. Hendersonville NC is the home/store city (distance = 0).
 * Nearby areas provide internal cross-linking between city pages.
 */

export const SITE_URL = 'https://www.carolinafutons.com';
export const STORE_CITY = 'hendersonville-nc';

export const STORE_PHONE = '+1-828-693-1935';
export const STORE_ADDRESS = {
  streetAddress: '329 N Main St',
  addressLocality: 'Hendersonville',
  addressRegion: 'NC',
  postalCode: '28792',
  addressCountry: 'US',
};
export const STORE_GEO = { latitude: 35.3162, longitude: -82.4609 };
export const STORE_HOURS = ['Mo-Fr 10:00-18:00', 'Sa 10:00-17:00'];

export const LOCAL_PAGES = {
  'hendersonville-nc': {
    slug: 'hendersonville-nc',
    city: 'Hendersonville',
    state: 'NC',
    isHomeCity: true,
    distance: null,
    headline: 'Carolina Futons — Your Local Futon Store in Hendersonville, NC',
    metaTitle: 'Futon Store in Hendersonville, NC | Carolina Futons',
    metaDescription: 'Shop futons, frames, and mattresses at Carolina Futons in Hendersonville, NC. Family-owned since 1991. Visit our showroom or order online.',
    featuredProducts: ['futon-frames', 'mattresses', 'covers'],
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3293!2d-82.461!3d35.316!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zHendersonville+NC!5e0!3m2!1sen!2sus!4v1',
    directions: 'Located in Hendersonville, NC. Call us for exact directions to our showroom.',
    nearbyAreas: ['asheville-nc', 'flat-rock-nc', 'brevard-nc'],
  },
  'asheville-nc': {
    slug: 'asheville-nc',
    city: 'Asheville',
    state: 'NC',
    isHomeCity: false,
    distance: '20 miles',
    headline: 'Futons Near Asheville, NC — Shop Carolina Futons',
    metaTitle: 'Futon Store Near Asheville, NC | Carolina Futons',
    metaDescription: 'Looking for futons near Asheville, NC? Carolina Futons is just 20 miles away in Hendersonville. Shop frames, mattresses, and covers — family-owned since 1991.',
    featuredProducts: ['futon-frames', 'mattresses', 'bundle-deals'],
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3293!2d-82.554!3d35.595!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zAsheville+NC!5e0!3m2!1sen!2sus!4v1',
    directions: 'From Asheville, take I-26 South to Hendersonville — about 20 miles.',
    nearbyAreas: ['hendersonville-nc', 'weaverville-nc', 'black-mountain-nc'],
  },
  'charlotte-nc': {
    slug: 'charlotte-nc',
    city: 'Charlotte',
    state: 'NC',
    isHomeCity: false,
    distance: '2 hours',
    headline: 'Futons Near Charlotte, NC — Order Online from Carolina Futons',
    metaTitle: 'Futon Store Near Charlotte, NC | Carolina Futons',
    metaDescription: 'Shop Carolina Futons from Charlotte, NC. Wide selection of futon frames, mattresses, and covers — shop online or visit our Hendersonville showroom.',
    featuredProducts: ['futon-frames', 'mattresses', 'covers'],
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3293!2d-80.843!3d35.227!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zCharlotte+NC!5e0!3m2!1sen!2sus!4v1',
    directions: 'From Charlotte, take I-85 North to I-26 West toward Hendersonville — about 2 hours.',
    nearbyAreas: ['gastonia-nc', 'concord-nc', 'rock-hill-sc'],
  },
  'greenville-sc': {
    slug: 'greenville-sc',
    city: 'Greenville',
    state: 'SC',
    isHomeCity: false,
    distance: '45 miles',
    headline: 'Futons Near Greenville, SC — Carolina Futons',
    metaTitle: 'Futon Store Near Greenville, SC | Carolina Futons',
    metaDescription: 'Shop futons near Greenville, SC. Carolina Futons carries frames, mattresses, and covers — just 45 miles from Greenville in Hendersonville, NC.',
    featuredProducts: ['futon-frames', 'mattresses', 'accessories'],
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3293!2d-82.394!3d34.852!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zGreenville+SC!5e0!3m2!1sen!2sus!4v1',
    directions: 'From Greenville SC, take I-26 East to Hendersonville NC — about 45 miles.',
    nearbyAreas: ['spartanburg-sc', 'anderson-sc', 'hendersonville-nc'],
  },
  'spartanburg-sc': {
    slug: 'spartanburg-sc',
    city: 'Spartanburg',
    state: 'SC',
    isHomeCity: false,
    distance: '55 miles',
    headline: 'Futons Near Spartanburg, SC — Carolina Futons',
    metaTitle: 'Futon Store Near Spartanburg, SC | Carolina Futons',
    metaDescription: 'Looking for futons near Spartanburg, SC? Carolina Futons has a full showroom in Hendersonville, NC — about an hour away. Shop futon frames, mattresses, and more.',
    featuredProducts: ['futon-frames', 'mattresses', 'covers'],
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3293!2d-81.934!3d34.949!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zSpartanburg+SC!5e0!3m2!1sen!2sus!4v1',
    directions: 'From Spartanburg SC, take I-26 East to Hendersonville NC — about 55 miles.',
    nearbyAreas: ['greenville-sc', 'gaffney-sc', 'hendersonville-nc'],
  },
  'boone-nc': {
    slug: 'boone-nc',
    city: 'Boone',
    state: 'NC',
    isHomeCity: false,
    distance: '1.5 hours',
    headline: 'Futons Near Boone, NC — Carolina Futons',
    metaTitle: 'Futon Store Near Boone, NC | Carolina Futons',
    metaDescription: 'Shop futons near Boone, NC. Carolina Futons in Hendersonville carries frames, mattresses, covers, and accessories — family-owned since 1991.',
    featuredProducts: ['futon-frames', 'mattresses', 'pillows'],
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3293!2d-81.674!3d36.217!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zBoone+NC!5e0!3m2!1sen!2sus!4v1',
    directions: 'From Boone NC, take US-321 South to I-40, then I-26 West to Hendersonville — about 1.5 hours.',
    nearbyAreas: ['blowing-rock-nc', 'lenoir-nc', 'banner-elk-nc'],
  },
};
