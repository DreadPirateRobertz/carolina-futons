/**
 * @module ups-shipping
 * @description UPS REST API integration for shipping rates, label generation,
 * package tracking, and address validation. Authenticates via OAuth 2.0
 * client-credentials flow with token caching.
 *
 * Key responsibilities:
 * - Fetch live multi-service shipping rates (Shop endpoint)
 * - Create shipments and generate PDF shipping labels (forward + return)
 * - Track packages by tracking number
 * - Validate destination addresses before shipment creation
 * - Provide fallback estimated rates when UPS API is unavailable
 * - Map product categories to default package dimensions for furniture
 *
 * No CMS collections — secrets stored in Wix Secrets Manager.
 *
 * @requires wix-secrets-backend - UPS_CLIENT_ID, UPS_CLIENT_SECRET, UPS_ACCOUNT_NUMBER
 * @requires wix-fetch           - HTTP calls to UPS REST API
 * @requires public/sharedTokens.js - Brand name, business address, shipping config
 * @requires backend/utils/sanitize - Input sanitization for address fields
 *
 * SETUP REQUIRED:
 * 1. Create app at https://developer.ups.com/ → get Client ID + Client Secret
 * 2. In Wix Dashboard → Secrets Manager, add:
 *    - "UPS_CLIENT_ID" → your Client ID
 *    - "UPS_CLIENT_SECRET" → your Client Secret
 *    - "UPS_ACCOUNT_NUMBER" → your UPS account number
 * 3. For testing, set UPS_SANDBOX=true in secrets; remove for production
 */

import { Permissions, webMethod } from 'wix-web-module';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import { brand, business, shippingConfig } from 'public/sharedTokens.js';
import { sanitize } from 'backend/utils/sanitize';

// ── Configuration ───────────────────────────────────────────────────

const ORIGIN_ADDRESS = {
  Name: brand.name,
  AddressLine: [business.address.street],
  City: business.address.city,
  StateProvinceCode: business.address.state,
  PostalCode: business.address.zip,
  CountryCode: 'US',
};

// UPS Service Codes
const UPS_SERVICES = {
  '03': { name: 'UPS Ground', estimated: '3-7 business days' },
  '02': { name: 'UPS 2nd Day Air', estimated: '2 business days' },
  '01': { name: 'UPS Next Day Air', estimated: '1 business day' },
  '12': { name: 'UPS 3 Day Select', estimated: '3 business days' },
  '13': { name: 'UPS Next Day Air Saver', estimated: '1 business day (end of day)' },
  '14': { name: 'UPS Next Day Air Early', estimated: 'Next morning' },
  '59': { name: 'UPS 2nd Day Air A.M.', estimated: '2 business days (morning)' },
};

// Package dimension defaults for furniture categories (inches, lbs)
// These are used when product-specific dimensions aren't available
const PACKAGE_DEFAULTS = {
  'futon-frame': { length: 80, width: 40, height: 12, weight: 85 },
  'futon-mattress': { length: 78, width: 54, height: 14, weight: 55 },
  'murphy-bed': { length: 82, width: 60, height: 20, weight: 150 },
  'platform-bed': { length: 80, width: 42, height: 8, weight: 70 },
  'casegoods': { length: 36, width: 20, height: 36, weight: 45 },
  'accessory': { length: 24, width: 18, height: 12, weight: 15 },
  'default': { length: 48, width: 30, height: 12, weight: 50 },
};

// Free shipping threshold
const FREE_SHIPPING_THRESHOLD = shippingConfig.freeThreshold;

// ── OAuth 2.0 Token Management ──────────────────────────────────────

let cachedToken = null;
let tokenExpiry = 0;

/**
 * Obtain a UPS OAuth 2.0 access token, returning a cached token when possible.
 * Tokens are refreshed 5 minutes before expiry to avoid mid-request failures.
 *
 * @returns {Promise<string>} Bearer access token
 * @throws {Error} If UPS OAuth endpoint rejects credentials
 */
async function getUPSToken() {
  // Return cached token if still valid (with 5-minute buffer)
  if (cachedToken && Date.now() < tokenExpiry - 300000) {
    return cachedToken;
  }

  const clientId = await getSecret('UPS_CLIENT_ID');
  const clientSecret = await getSecret('UPS_CLIENT_SECRET');

  // Wix Velo backend doesn't have Node.js Buffer - use btoa for base64
  const credentials = btoa(`${clientId}:${clientSecret}`);

  let sandbox = false;
  try {
    sandbox = (await getSecret('UPS_SANDBOX')) === 'true';
  } catch (e) {
    // No sandbox secret means production
  }

  const tokenUrl = sandbox
    ? 'https://wwwcie.ups.com/security/v1/oauth/token'
    : 'https://onlinetools.ups.com/security/v1/oauth/token';

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('UPS OAuth error:', error);
    throw new Error('Failed to authenticate with UPS');
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (parseInt(data.expires_in) * 1000);

  return cachedToken;
}

/**
 * Resolve the UPS API base URL (sandbox vs production) from Wix Secrets.
 * @returns {Promise<string>} Base URL for UPS REST endpoints
 */
async function getBaseUrl() {
  let sandbox = false;
  try {
    sandbox = (await getSecret('UPS_SANDBOX')) === 'true';
  } catch (e) { console.error('[ups-shipping] Failed to retrieve UPS_SANDBOX setting:', e.message); }
  return sandbox
    ? 'https://wwwcie.ups.com/api'
    : 'https://onlinetools.ups.com/api';
}

// ── Rate Calculation ────────────────────────────────────────────────

/**
 * Fetch live UPS shipping rates for a destination and set of packages.
 * Called by the shipping-rates-plugin SPI during checkout and by the cart
 * page for rate estimates. Returns free-ground when order exceeds the
 * free-shipping threshold.
 *
 * Permission: Anyone — rate quotes must work for anonymous shoppers.
 *
 * @param {Object} destinationAddress - Recipient address
 * @param {string} destinationAddress.name - Recipient name
 * @param {string} destinationAddress.addressLine1 - Street address
 * @param {string} destinationAddress.city - City
 * @param {string} destinationAddress.state - State/province code
 * @param {string} destinationAddress.postalCode - ZIP/postal code
 * @param {string} destinationAddress.country - ISO country code (default 'US')
 * @param {Array<{length: number, width: number, height: number, weight: number, description: string}>} packages
 *   Package dimensions in inches/lbs. Capped at 20 to prevent API amplification.
 * @param {number} [orderSubtotal=0] - Cart subtotal for free-shipping eligibility
 * @returns {Promise<Array<{code: string, title: string, cost: number, estimatedDelivery: string, currency: string}>>}
 *   Sorted by cost ascending. Falls back to estimated flat rates on API error.
 */
export const getUPSRates = webMethod(
  Permissions.Anyone,
  async (destinationAddress, packages, orderSubtotal = 0) => {
    try {
      // Cap packages array to prevent API amplification
      const safePackages = (Array.isArray(packages) ? packages : []).slice(0, 20);

      // Sanitize address fields
      if (destinationAddress) {
        destinationAddress.name = sanitize(destinationAddress.name, 100);
        destinationAddress.addressLine1 = sanitize(destinationAddress.addressLine1, 200);
        destinationAddress.city = sanitize(destinationAddress.city, 100);
        destinationAddress.state = sanitize(destinationAddress.state, 10);
        destinationAddress.postalCode = sanitize(destinationAddress.postalCode, 15);
        destinationAddress.country = sanitize(destinationAddress.country, 5);
      }

      // Check for free shipping eligibility
      if (orderSubtotal >= FREE_SHIPPING_THRESHOLD) {
        return [{
          code: 'free-ground',
          title: 'FREE UPS Ground Shipping',
          cost: 0,
          estimatedDelivery: '5-7 business days',
          description: 'Free shipping on orders over $999!',
        }];
      }

      const token = await getUPSToken();
      const accountNumber = await getSecret('UPS_ACCOUNT_NUMBER');
      const baseUrl = await getBaseUrl();

      // Build package array for UPS request
      const upsPackages = safePackages.map(pkg => ({
        PackagingType: {
          Code: '02', // Customer Supplied Package
          Description: 'Package',
        },
        Dimensions: {
          UnitOfMeasurement: { Code: 'IN', Description: 'Inches' },
          Length: String(pkg.length || PACKAGE_DEFAULTS.default.length),
          Width: String(pkg.width || PACKAGE_DEFAULTS.default.width),
          Height: String(pkg.height || PACKAGE_DEFAULTS.default.height),
        },
        PackageWeight: {
          UnitOfMeasurement: { Code: 'LBS', Description: 'Pounds' },
          Weight: String(pkg.weight || PACKAGE_DEFAULTS.default.weight),
        },
      }));

      // Request rates for multiple services (Shop rate = all available)
      const rateRequest = {
        RateRequest: {
          Request: {
            SubVersion: '2403',
            TransactionReference: {
              CustomerContext: `cf-rate-${Date.now()}`,
            },
          },
          Shipment: {
            Shipper: {
              Name: 'Carolina Futons',
              ShipperNumber: accountNumber,
              Address: ORIGIN_ADDRESS,
            },
            ShipTo: {
              Name: destinationAddress.name || 'Customer',
              Address: {
                AddressLine: [destinationAddress.addressLine1 || ''],
                City: destinationAddress.city || '',
                StateProvinceCode: destinationAddress.state || '',
                PostalCode: destinationAddress.postalCode || '',
                CountryCode: destinationAddress.country || 'US',
              },
            },
            ShipFrom: {
              Name: 'Carolina Futons',
              Address: ORIGIN_ADDRESS,
            },
            Package: upsPackages,
          },
        },
      };

      const response = await fetch(`${baseUrl}/rating/v2403/Shop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'transId': `cf-${Date.now()}`,
          'transactionSrc': 'CarolinaFutons',
        },
        body: JSON.stringify(rateRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('UPS Rate API error:', response.status, errorText);
        return getFallbackRates(destinationAddress.postalCode);
      }

      const data = await response.json();
      const ratedShipments = data.RateResponse?.RatedShipment || [];

      return ratedShipments.map(shipment => {
        const serviceCode = shipment.Service?.Code;
        const serviceInfo = UPS_SERVICES[serviceCode] || {
          name: `UPS Service ${serviceCode}`,
          estimated: 'Contact for estimate',
        };
        const totalCharge = parseFloat(shipment.TotalCharges?.MonetaryValue || '0');

        return {
          code: `ups-${serviceCode}`,
          title: serviceInfo.name,
          cost: totalCharge,
          estimatedDelivery: serviceInfo.estimated,
          currency: shipment.TotalCharges?.CurrencyCode || 'USD',
          guaranteedDays: shipment.GuaranteedDelivery?.BusinessDaysInTransit || null,
        };
      }).sort((a, b) => a.cost - b.cost);

    } catch (err) {
      console.error('Error getting UPS rates:', err);
      return getFallbackRates(destinationAddress?.postalCode);
    }
  }
);

/**
 * Generate estimated flat-rate shipping prices when the UPS API is down.
 * Uses 3-digit ZIP prefix to apply regional pricing tiers so customers
 * still get a reasonable estimate during outages.
 *
 * @param {string|undefined} postalCode - Destination ZIP code
 * @returns {Array<{code: string, title: string, cost: number, estimatedDelivery: string, isEstimate: boolean}>}
 */
function getFallbackRates(postalCode) {
  const prefix = postalCode ? parseInt(postalCode.substring(0, 3)) : 0;
  let groundRate = 49.99;

  // Regional pricing tiers
  if (prefix >= 270 && prefix <= 299) groundRate = 29.99; // NC/SC
  else if (prefix >= 300 && prefix <= 399) groundRate = 39.99; // Southeast
  else if (prefix >= 100 && prefix <= 199) groundRate = 59.99; // Northeast
  else if (prefix >= 900 && prefix <= 999) groundRate = 79.99; // West Coast

  return [
    { code: 'ups-ground-est', title: 'UPS Ground (Estimated)', cost: groundRate, estimatedDelivery: '5-7 business days', isEstimate: true },
    { code: 'ups-2day-est', title: 'UPS 2nd Day Air (Estimated)', cost: groundRate + 40, estimatedDelivery: '2 business days', isEstimate: true },
  ];
}

// ── Shipment Creation & Label Generation ────────────────────────────

/**
 * Create a UPS shipment and generate a PDF shipping label.
 * Supports both outbound and return (RMA) labels — when `orderData.returnLabel`
 * is true, ShipTo/ShipFrom are swapped so the label routes back to Carolina Futons.
 *
 * Permission: Admin — only staff should generate labels and incur shipping charges.
 *
 * @param {Object} orderData - Shipment details
 * @param {string} orderData.orderId - Wix order number (used in UPS transaction reference)
 * @param {string} orderData.recipientName - Full name of the recipient
 * @param {string} [orderData.recipientPhone] - Recipient phone number
 * @param {string} orderData.addressLine1 - Street address line 1
 * @param {string} [orderData.addressLine2] - Street address line 2
 * @param {string} orderData.city - City
 * @param {string} orderData.state - State/province code
 * @param {string} orderData.postalCode - ZIP/postal code
 * @param {string} [orderData.country='US'] - ISO country code
 * @param {string} [orderData.serviceCode='03'] - UPS service code (default Ground)
 * @param {boolean} [orderData.returnLabel=false] - If true, generate a return label
 * @param {Array<{length: number, width: number, height: number, weight: number, description: string}>} orderData.packages
 * @returns {Promise<{success: boolean, trackingNumber?: string, labels?: Array, totalCharge?: number, currency?: string, error?: string}>}
 */
export const createShipment = webMethod(
  Permissions.Admin,
  async (orderData) => {
    try {
      const token = await getUPSToken();
      const accountNumber = await getSecret('UPS_ACCOUNT_NUMBER');
      const baseUrl = await getBaseUrl();

      const shipmentRequest = {
        ShipmentRequest: {
          Request: {
            SubVersion: '2403',
            TransactionReference: {
              CustomerContext: `cf-ship-${orderData.orderId}`,
            },
          },
          Shipment: {
            Description: orderData.returnLabel ? `${brand.name} Return` : `${brand.name} Order`,
            Shipper: {
              Name: brand.name,
              AttentionName: 'Brenda Deal',
              ShipperNumber: accountNumber,
              Phone: { Number: business.phoneDigits },
              Address: ORIGIN_ADDRESS,
            },
            ShipTo: orderData.returnLabel
              ? {
                Name: brand.name,
                AttentionName: `Returns Dept (RMA)`,
                Phone: { Number: business.phoneDigits },
                Address: ORIGIN_ADDRESS,
              }
              : {
                Name: orderData.recipientName,
                AttentionName: orderData.recipientName,
                Phone: { Number: orderData.recipientPhone || '' },
                Address: {
                  AddressLine: [orderData.addressLine1, orderData.addressLine2 || ''].filter(Boolean),
                  City: orderData.city,
                  StateProvinceCode: orderData.state,
                  PostalCode: orderData.postalCode,
                  CountryCode: orderData.country || 'US',
                },
              },
            ShipFrom: orderData.returnLabel
              ? {
                Name: orderData.recipientName,
                AttentionName: orderData.recipientName,
                Phone: { Number: orderData.recipientPhone || '' },
                Address: {
                  AddressLine: [orderData.addressLine1, orderData.addressLine2 || ''].filter(Boolean),
                  City: orderData.city,
                  StateProvinceCode: orderData.state,
                  PostalCode: orderData.postalCode,
                  CountryCode: orderData.country || 'US',
                },
              }
              : {
                Name: brand.name,
                AttentionName: 'Brenda Deal',
                Phone: { Number: business.phoneDigits },
                Address: ORIGIN_ADDRESS,
              },
            PaymentInformation: {
              ShipmentCharge: [{
                Type: '01', // Transportation
                BillShipper: {
                  AccountNumber: accountNumber,
                },
              }],
            },
            Service: {
              Code: orderData.serviceCode || '03', // Default to Ground
              Description: UPS_SERVICES[orderData.serviceCode || '03']?.name || 'UPS Ground',
            },
            Package: orderData.packages.map(pkg => ({
              Description: pkg.description || 'Furniture',
              Packaging: {
                Code: '02', // Customer Supplied
                Description: 'Package',
              },
              Dimensions: {
                UnitOfMeasurement: { Code: 'IN' },
                Length: String(pkg.length),
                Width: String(pkg.width),
                Height: String(pkg.height),
              },
              PackageWeight: {
                UnitOfMeasurement: { Code: 'LBS' },
                Weight: String(pkg.weight),
              },
            })),
          },
          LabelSpecification: {
            LabelImageFormat: {
              Code: 'PDF',
              Description: 'PDF',
            },
            LabelStockSize: {
              Height: '6',
              Width: '4',
            },
          },
        },
      };

      const response = await fetch(`${baseUrl}/shipments/v2403/ship`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'transId': `cf-ship-${Date.now()}`,
          'transactionSrc': 'CarolinaFutons',
        },
        body: JSON.stringify(shipmentRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('UPS Shipment API error:', response.status, errorText);
        throw new Error(`UPS shipment creation failed: ${response.status}`);
      }

      const data = await response.json();
      const shipmentResult = data.ShipmentResponse?.ShipmentResults;

      if (!shipmentResult) {
        throw new Error('Invalid response from UPS');
      }

      // Extract tracking number and label
      const trackingNumber = shipmentResult.ShipmentIdentificationNumber;
      const packages = Array.isArray(shipmentResult.PackageResults)
        ? shipmentResult.PackageResults
        : [shipmentResult.PackageResults];

      const labels = packages.map(pkg => ({
        trackingNumber: pkg.TrackingNumber,
        labelBase64: pkg.ShippingLabel?.GraphicImage, // Base64 PDF
        labelFormat: 'PDF',
      }));

      const totalCharge = parseFloat(
        shipmentResult.ShipmentCharges?.TotalCharges?.MonetaryValue || '0'
      );

      return {
        success: true,
        trackingNumber,
        labels,
        totalCharge,
        currency: shipmentResult.ShipmentCharges?.TotalCharges?.CurrencyCode || 'USD',
        billingWeight: shipmentResult.BillingWeight?.Weight,
      };
    } catch (err) {
      console.error('Error creating UPS shipment:', err);
      return {
        success: false,
        error: 'Unable to create shipment. Please try again or contact support.',
      };
    }
  }
);

// ── Shipment Tracking ───────────────────────────────────────────────

/**
 * Look up real-time tracking status and activity history for a UPS package.
 * Sanitizes the tracking number to alphanumeric only (UPS format: 1Z + digits).
 *
 * Permission: Anyone — customers need to track their own packages.
 *
 * @param {string} trackingNumber - UPS tracking number (10-35 alphanumeric chars)
 * @returns {Promise<{success: boolean, trackingNumber?: string, status?: string, statusCode?: string, estimatedDelivery?: string|null, activities?: Array<{status: string, location: string, date: string, time: string}>, error?: string}>}
 */
export const trackShipment = webMethod(
  Permissions.Anyone,
  async (trackingNumber) => {
    try {
      // Sanitize tracking number — alphanumeric only (UPS format: 1Z... + digits)
      const cleanTracking = (trackingNumber || '').replace(/[^a-zA-Z0-9]/g, '');
      if (!cleanTracking || cleanTracking.length < 10 || cleanTracking.length > 35) {
        return { success: false, error: 'Invalid tracking number format' };
      }

      const token = await getUPSToken();
      const baseUrl = await getBaseUrl();

      const response = await fetch(
        `${baseUrl}/track/v1/details/${cleanTracking}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'transId': `cf-track-${Date.now()}`,
            'transactionSrc': 'CarolinaFutons',
          },
        }
      );

      if (!response.ok) {
        console.error('UPS Tracking API error:', response.status);
        return {
          success: false,
          error: 'Unable to retrieve tracking information',
        };
      }

      const data = await response.json();
      const trackResult = data.trackResponse?.shipment?.[0];

      if (!trackResult) {
        return {
          success: false,
          error: 'No tracking information found',
        };
      }

      const pkg = trackResult.package?.[0];
      const activities = pkg?.activity || [];

      return {
        success: true,
        trackingNumber,
        status: pkg?.currentStatus?.description || 'Unknown',
        statusCode: pkg?.currentStatus?.code || '',
        estimatedDelivery: pkg?.deliveryDate?.[0]?.date || null,
        weight: pkg?.weight?.weight || null,
        activities: activities.map(act => ({
          status: act.status?.description || '',
          statusCode: act.status?.code || '',
          location: [
            act.location?.address?.city,
            act.location?.address?.stateProvince,
            act.location?.address?.countryCode,
          ].filter(Boolean).join(', '),
          date: act.date || '',
          time: act.time || '',
        })),
      };
    } catch (err) {
      console.error('Error tracking UPS shipment:', err);
      return {
        success: false,
        error: 'Unable to retrieve tracking information',
      };
    }
  }
);

// ── Address Validation ──────────────────────────────────────────────

/**
 * Validate a shipping address against UPS Address Validation (XAV) API.
 * Returns whether the address is valid, ambiguous (with candidate suggestions),
 * or invalid. Gracefully degrades — returns `unavailable: true` if the API is down,
 * so checkout is never blocked by validation outages.
 *
 * Permission: Anyone — used during checkout address entry.
 *
 * @param {Object} address - Address to validate
 * @param {string} address.addressLine1 - Street address
 * @param {string} address.city - City
 * @param {string} address.state - State/province code
 * @param {string} address.postalCode - ZIP/postal code
 * @param {string} [address.country='US'] - ISO country code
 * @returns {Promise<{valid: boolean, ambiguous?: boolean, candidates: Array<{addressLine1: string, city: string, state: string, postalCode: string}>, unavailable?: boolean, error?: string}>}
 */
export const validateAddress = webMethod(
  Permissions.Anyone,
  async (address) => {
    try {
      const token = await getUPSToken();
      const baseUrl = await getBaseUrl();

      const requestBody = {
        XAVRequest: {
          AddressKeyFormat: {
            AddressLine: [address.addressLine1 || ''],
            PoliticalDivision2: address.city || '',
            PoliticalDivision1: address.state || '',
            PostcodePrimaryLow: address.postalCode || '',
            CountryCode: address.country || 'US',
          },
        },
      };

      const response = await fetch(`${baseUrl}/addressvalidation/v2/3`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'transId': `cf-addr-${Date.now()}`,
          'transactionSrc': 'CarolinaFutons',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.error('UPS address validation API returned', response.status);
        return { valid: false, candidates: [], unavailable: true, error: 'validation unavailable' };
      }

      const data = await response.json();
      const result = data.XAVResponse;

      if (result?.ValidAddressIndicator !== undefined) {
        return { valid: true, candidates: [] };
      }

      if (result?.AmbiguousAddressIndicator !== undefined) {
        const candidates = (result.Candidate || []).map(c => ({
          addressLine1: c.AddressKeyFormat?.AddressLine?.[0] || '',
          city: c.AddressKeyFormat?.PoliticalDivision2 || '',
          state: c.AddressKeyFormat?.PoliticalDivision1 || '',
          postalCode: c.AddressKeyFormat?.PostcodePrimaryLow || '',
        }));
        return { valid: false, ambiguous: true, candidates };
      }

      if (result?.NoCandidatesIndicator !== undefined) {
        return { valid: false, ambiguous: false, candidates: [] };
      }

      return { valid: false, candidates: [], unavailable: true, error: 'validation unavailable' };
    } catch (err) {
      console.error('Address validation error:', err);
      return { valid: false, candidates: [], unavailable: true, error: 'validation unavailable' };
    }
  }
);

// ── Helper: Get package dimensions from product category ────────────

/**
 * Look up default package dimensions for a furniture product category.
 * The shipping-rates-plugin calls this to size packages when Wix line items
 * lack physical dimension data.
 *
 * Permission: Anyone — called indirectly during checkout rate calculation.
 *
 * @param {string} category - Category key (e.g. 'futon-frame', 'murphy-bed', 'casegoods')
 * @returns {{length: number, width: number, height: number, weight: number}} Dimensions in inches, weight in lbs
 */
export const getPackageDimensions = webMethod(
  Permissions.Anyone,
  (category) => {
    return PACKAGE_DEFAULTS[category] || PACKAGE_DEFAULTS.default;
  }
);
