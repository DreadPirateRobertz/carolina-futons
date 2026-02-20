// Wix HTTP Functions - Public API endpoints
// Accessible at: https://www.carolinafutons.com/_functions/<functionName>
import { ok, serverError } from 'wix-http-functions';
import { generateFeed } from 'backend/googleMerchantFeed.web';

// Google Merchant Center product feed endpoint
// URL: GET https://www.carolinafutons.com/_functions/googleShoppingFeed
// Configure this URL in Google Merchant Center as a scheduled fetch source
export function get_googleShoppingFeed(request) {
  return generateFeed()
    .then(xml => {
      if (!xml) {
        return serverError({
          body: 'Error generating feed',
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      return ok({
        body: xml,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    })
    .catch(err => {
      console.error('HTTP function error (googleShoppingFeed):', err);
      return serverError({
        body: 'Internal server error',
        headers: { 'Content-Type': 'text/plain' },
      });
    });
}
