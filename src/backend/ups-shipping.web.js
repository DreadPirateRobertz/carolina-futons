// UPS Shipping Integration - Backend Web Module
// Handles OAuth 2.0 auth, rate calculation, label generation, and tracking
// Uses UPS REST API (OAuth 2.0 client credentials flow)
//
// SETUP REQUIRED:
// 1. Create app at https://developer.ups.com/ → get Client ID + Client Secret
// 2. In Wix Dashboard → Secrets Manager, add:
//    - "UPS_CLIENT_ID" → your Client ID
//    - "UPS_CLIENT_SECRET" → your Client Secret
//    - "UPS_ACCOUNT_NUMBER" → your UPS account number
// 3. For testing, set UPS_SANDBOX=true in secrets; remove for production

import { Permissions, webMethod } from 'wix-web-module';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import { brand, business, shippingConfig } from 'public/sharedTokens.js';

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

async function getBaseUrl() {
  let sandbox = false;
  try {
    sandbox = (await getSecret('UPS_SANDBOX')) === 'true';
  } catch (e) {}
  return sandbox
    ? 'https://wwwcie.ups.com/api'
    : 'https://onlinetools.ups.com/api';
}

// ── Rate Calculation ────────────────────────────────────────────────

// Get shipping rates for a destination address and package details
// Called by the Wix Shipping Rates plugin and also directly from cart
export const getUPSRates = webMethod(
  Permissions.Anyone,
  async (destinationAddress, packages, orderSubtotal = 0) => {
    try {
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
      const upsPackages = packages.map(pkg => ({
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

// Fallback rates when API is unavailable
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

// Create a shipment and generate a shipping label
// Called from the order fulfillment dashboard
export const createShipment = webMethod(
  Permissions.SiteMember,
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
            Description: `${brand.name} Order`,
            Shipper: {
              Name: brand.name,
              AttentionName: 'Brenda Deal',
              ShipperNumber: accountNumber,
              Phone: { Number: business.phoneDigits },
              Address: ORIGIN_ADDRESS,
            },
            ShipTo: {
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
            ShipFrom: {
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
        error: err.message,
      };
    }
  }
);

// ── Shipment Tracking ───────────────────────────────────────────────

// Track a package by tracking number
export const trackShipment = webMethod(
  Permissions.Anyone,
  async (trackingNumber) => {
    try {
      const token = await getUPSToken();
      const baseUrl = await getBaseUrl();

      const response = await fetch(
        `${baseUrl}/track/v1/details/${trackingNumber}`,
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
        error: err.message,
      };
    }
  }
);

// ── Address Validation ──────────────────────────────────────────────

// Validate a shipping address with UPS before creating shipment
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
        return { valid: true, candidates: [], unavailable: true };
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

      return { valid: true, candidates: [] };
    } catch (err) {
      console.error('Address validation error:', err);
      return { valid: true, candidates: [], unavailable: true };
    }
  }
);

// ── Helper: Get package dimensions from product category ────────────

export const getPackageDimensions = webMethod(
  Permissions.Anyone,
  (category) => {
    return PACKAGE_DEFAULTS[category] || PACKAGE_DEFAULTS.default;
  }
);
