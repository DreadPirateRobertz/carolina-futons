/**
 * deliveryHelpers.js — Content data for the Getting It Home page.
 * Service tiers, delivery rates, and assembly info for Carolina Futons.
 */

const SERVICE_TIERS = [
  {
    _id: 'diy',
    title: 'Do It Yourself',
    price: 'Free',
    description: 'Are you an "I can do it myself" kind of person? Then you\'ll save the most by taking your purchase home and assembling it yourself with included box instructions or viewing the instructional videos online, available on our FAQ page. Most futon frames are simple to build and will fit in a small SUV or truck. You can also pick up your mattress in its original box or we can unbox for you to carry out (tied up vertically and wrapped in plastic). We will help you carry out and load your purchases into your vehicle.',
    icon: 'wrench',
  },
  {
    _id: 'dropoff',
    title: 'Home Drop Off',
    price: 'Delivery rate',
    description: 'If you want to assemble your purchase yourself but don\'t have a suitable vehicle for transporting, we can deliver your items to your home. We can also deliver your mattress and take away your old mattress for a $10 landfill fee. Delivery rates are based on mileage from our store.',
    icon: 'truck',
  },
  {
    _id: 'instore',
    title: 'In-Store Assembly',
    price: '$40.00',
    description: 'Another option is to have us assemble your frame in our store for you to pick up and take home. You can also pick up your mattress in its original box or we can unbox for you to carry out (tied up vertically and wrapped in plastic). We will help you carry out and load your purchases into your vehicle. A full-sized pickup truck or van is recommended for transporting an assembled frame and/or mattress. Our fee for this service is $40.00, with a 24-hour notice required.',
    icon: 'build',
  },
  {
    _id: 'whiteglove',
    title: 'Premium White Glove Service',
    price: '$60.00 + delivery',
    description: 'A final option is to have us assemble/set up your frame in your home by our professional, courteous delivery personnel to your room of choice. This includes applying Grip Strips to your frame, putting your mattress protector and/or cover on your mattress, reviewing and demonstrating converting your frame or cabinet, final performance inspections, and removing all packaging and clean up area. Our fee for this service is $60.00, plus delivery rate based on the mileage from our store to your home.',
    icon: 'star',
  },
];

const INTRO_TEXT = 'At Carolina Futons, we don\'t add the cost of assembly and delivery into our prices, which means that you don\'t pay for services you don\'t need. Instead, we offer service levels to meet your individual needs. All of our frames come with a pack of Grip Strips to keep your mattress in place, at no additional charge. We\'ll also be here to answer any questions you might have after you take your purchase home regarding assembly and/or mechanics of your frame.';

const DELIVERY_RATES = {
  minimumCharge: '$25.00',
  minimumRadius: '10-mile',
  note: 'Contact us for rates or input your zip code when adding items to your cart for pricing.',
};

/**
 * Get the intro paragraph text for the Getting It Home page.
 * @returns {string}
 */
export function getIntroText() {
  return INTRO_TEXT;
}

/**
 * Get all service tiers with IDs, titles, prices, and descriptions.
 * @returns {Array<{_id: string, title: string, price: string, description: string, icon: string}>}
 */
export function getServiceTiers() {
  return SERVICE_TIERS;
}

/**
 * Get delivery rate information.
 * @returns {{minimumCharge: string, minimumRadius: string, note: string}}
 */
export function getDeliveryRates() {
  return DELIVERY_RATES;
}
