/**
 * @module wwex-freight.web
 * @description WWEX SpeedFreight LTL (Less-Than-Truckload) rate service.
 * Carolina Futons uses WWEX's negotiated UPS Freight account for large
 * items that exceed standard parcel limits (murphy beds, platform beds,
 * multi-piece orders). This module provides real-time LTL rate quotes via
 * the WWEX SpeedFreight SOAP API.
 *
 * Called by shippingIntelligence.web.js when item weight/dims exceed parcel
 * thresholds. NOT called directly from shipping-rates-plugin.js (which
 * handles checkout); this is for product page estimates + bundle builder.
 *
 * WWEX credentials stored in Wix Secrets Manager:
 *   - WWEX_USERNAME
 *   - WWEX_PASSWORD
 *   - WWEX_ACCOUNT_NUMBER
 *
 * @requires wix-secrets-backend - Credential retrieval
 * @requires wix-fetch - HTTP requests to WWEX endpoint
 *
 * @see https://www.wwex.com/tools/api-integration
 */

import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import { logError } from 'backend/utils/errorHandler';

/** WWEX SpeedFreight SOAP endpoint */
const WWEX_ENDPOINT = 'https://api.wwex.com/SpeedFreight/RateQuote';

/**
 * LTL freight thresholds — items above these dimensions/weight route to WWEX.
 * Below these, UPS parcel is used instead.
 */
export const LTL_THRESHOLDS = {
  /** Max single-item weight (lbs) for parcel shipping */
  maxParcelWeightLbs: 150,
  /** Max single-item longest dimension (inches) for parcel */
  maxParcelLengthIn: 108,
  /** Min shipment weight (lbs) to get LTL rates (WWEX minimum) */
  minLTLWeightLbs: 100,
};

/**
 * NMFC freight class mapping for CF product categories.
 * Used to calculate LTL rates — higher class = higher rate.
 * @see http://www.nmfta.org/pages/nmfc
 */
const FREIGHT_CLASS = {
  'murphy-bed': '125',    // Cabinet beds with mechanisms
  'platform-bed': '100',  // Knocked-down wood furniture
  'futon-frame': '150',   // Metal/wood frames, flat-packed
  'futon-mattress': '200', // Dense compressed foam
  'casegoods': '85',      // Dressers, nightstands — dense
  'default': '100',
};

/**
 * Determine whether a set of packages should route to LTL vs parcel.
 *
 * @param {Array<{weight: number, length: number}>} packages
 * @returns {boolean} True if LTL routing is recommended
 */
export function shouldUseLTL(packages) {
  if (!packages || packages.length === 0) return false;
  const totalWeight = packages.reduce((sum, p) => sum + (p.weight || 0), 0);
  const hasOversizeItem = packages.some(
    p => (p.weight || 0) > LTL_THRESHOLDS.maxParcelWeightLbs ||
         (p.length || 0) > LTL_THRESHOLDS.maxParcelLengthIn
  );
  return hasOversizeItem || totalWeight > LTL_THRESHOLDS.maxParcelWeightLbs;
}

/**
 * Fetch LTL freight rates from WWEX SpeedFreight API.
 *
 * @param {string} originZip   - 5-digit origin ZIP (CF store: 28792)
 * @param {string} destZip     - 5-digit destination ZIP
 * @param {Array<{weight: number, length: number, width: number, height: number, category?: string}>} packages
 * @returns {Promise<{success: boolean, rates?: Array, error?: string}>}
 */
export async function getLTLRates(originZip, destZip, packages) {
  if (!originZip || !destZip || !packages || packages.length === 0) {
    return { success: false, error: 'Missing required parameters' };
  }

  try {
    const [username, password, accountNumber] = await Promise.all([
      getSecret('WWEX_USERNAME'),
      getSecret('WWEX_PASSWORD'),
      getSecret('WWEX_ACCOUNT_NUMBER'),
    ]);

    // Build WWEX SpeedFreight SOAP request
    const totalWeight = packages.reduce((sum, p) => sum + (p.weight || 0), 0);
    const freightClass = FREIGHT_CLASS[packages[0]?.category || 'default'];

    const soapBody = buildWWEXSoapRequest({
      username,
      password,
      accountNumber,
      originZip,
      destZip,
      totalWeight,
      freightClass,
      packages,
    });

    const response = await fetch(WWEX_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'RateQuote',
      },
      body: soapBody,
    });

    if (!response.ok) {
      logError('wwex-freight.getLTLRates', new Error(`WWEX API returned ${response.status}`), { status: response.status, destZip });
      return { success: false, error: `WWEX API returned ${response.status}` };
    }

    const xml = await response.text();
    const rates = parseWWEXResponse(xml);

    return { success: true, rates };

  } catch (err) {
    logError('wwex-freight.getLTLRates', err, { destZip });
    return { success: false, error: err.message || 'WWEX rate lookup failed' };
  }
}

/**
 * Build the WWEX SpeedFreight SOAP request XML.
 * @private
 */
function buildWWEXSoapRequest({ username, password, accountNumber, originZip, destZip, totalWeight, freightClass, packages }) {
  const packageItems = packages.map((p, i) => `
    <HandlingUnit>
      <Sequence>${i + 1}</Sequence>
      <Weight>${Math.ceil(p.weight || 1)}</Weight>
      <Length>${Math.ceil(p.length || 48)}</Length>
      <Width>${Math.ceil(p.width || 24)}</Width>
      <Height>${Math.ceil(p.height || 6)}</Height>
      <FreightClass>${FREIGHT_CLASS[p.category || 'default']}</FreightClass>
    </HandlingUnit>`).join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <AuthHeader xmlns="http://api.wwex.com/">
      <Username>${escapeXml(username)}</Username>
      <Password>${escapeXml(password)}</Password>
      <AccountNumber>${escapeXml(accountNumber)}</AccountNumber>
    </AuthHeader>
  </soap:Header>
  <soap:Body>
    <RateQuoteRequest xmlns="http://api.wwex.com/">
      <OriginZip>${escapeXml(originZip)}</OriginZip>
      <DestinationZip>${escapeXml(destZip)}</DestinationZip>
      <TotalWeight>${Math.ceil(totalWeight)}</TotalWeight>
      <HandlingUnits>${packageItems}
      </HandlingUnits>
    </RateQuoteRequest>
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Parse WWEX SOAP response XML into normalized rate objects.
 * @private
 * @returns {Array<{code: string, title: string, cost: number, estimatedDays: string, currency: string, icon: string, badge: string}>}
 */
function parseWWEXResponse(xml) {
  const rates = [];

  // Extract rate quotes from WWEX response
  // WWEX returns multiple service levels (Standard, Guaranteed, etc.)
  const rateMatches = xml.matchAll(/<RateQuote>([\s\S]*?)<\/RateQuote>/g);

  for (const match of rateMatches) {
    const block = match[1];
    const serviceCode = extractXmlValue(block, 'ServiceCode');
    const serviceName = extractXmlValue(block, 'ServiceName');
    const totalCharge = parseFloat(extractXmlValue(block, 'TotalCharge') || '0');
    const transitDays = extractXmlValue(block, 'TransitDays');

    if (!serviceCode || totalCharge <= 0) continue;

    rates.push({
      code: `wwex-ltl-${serviceCode.toLowerCase()}`,
      title: `🚛 ${serviceName || 'LTL Freight'} (WWEX)`,
      cost: totalCharge,
      estimatedDays: transitDays ? `${transitDays} business days` : '5-10 business days',
      currency: 'USD',
      icon: '🚛',
      badge: null,
      upsellMessage: 'Full-service freight delivery — contact us to schedule your delivery window',
      isLTL: true,
    });
  }

  // If XML parsing yielded nothing, return fallback structure
  if (rates.length === 0) {
    throw new Error('No rates in WWEX response');
  }

  return rates;
}

/**
 * Flat fallback LTL rates when WWEX API is unavailable.
 * Based on zone distance from Hendersonville.
 *
 * @param {string} destZip
 * @param {Array} packages
 * @returns {Array}
 */
export function getLTLFallbackRates(destZip, packages) {
  const totalWeight = (packages || []).reduce((sum, p) => sum + (p.weight || 0), 0);
  const zip3 = parseInt((destZip || '').substring(0, 3), 10);

  // Zone-based LTL flat rate estimate
  let baseRate = 299;
  if (zip3 >= 270 && zip3 <= 299) baseRate = 199;       // NC/SC close
  else if (zip3 >= 300 && zip3 <= 399) baseRate = 249;  // SE regional
  else if (zip3 >= 200 && zip3 <= 269) baseRate = 349;  // VA/Mid-Atlantic

  // Weight surcharge above 500 lbs
  const weightSurcharge = totalWeight > 500 ? Math.floor((totalWeight - 500) / 100) * 25 : 0;
  const total = baseRate + weightSurcharge;

  return [{
    code: 'wwex-ltl-est',
    title: '🚛 LTL Freight (Estimated)',
    cost: total,
    estimatedDays: '5-10 business days',
    currency: 'USD',
    icon: '🚛',
    badge: null,
    upsellMessage: 'Large item freight delivery — contact us to schedule',
    isLTL: true,
    isEstimate: true,
  }];
}

/** Escape XML special characters in string values */
function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Extract text content of a single XML element by tag name */
function extractXmlValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`));
  return match ? match[1].trim() : null;
}
