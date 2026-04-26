// Reviews.js — Site-wide customer reviews page for Carolina Futons.
// URL: /reviews
// cf-rxbi: migrated from hardcoded array → CMS + schema.org JSON-LD

import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { initPageSeo } from 'public/pageSeo.js';
import { getFeaturedReviews, getSiteAggregateRating } from 'backend/reviewsService.web';

const REVIEWS_LIMIT = 20;

$w.onReady(async function () {
  initPageSeo('reviews');
  initBackToTop($w);
  trackEvent('page_view', { page: 'reviews' });

  const [reviewsResult, aggregate] = await Promise.allSettled([
    getFeaturedReviews({ limit: REVIEWS_LIMIT }),
    getSiteAggregateRating(),
  ]);

  const reviews = reviewsResult.status === 'fulfilled' && reviewsResult.value?.success
    ? reviewsResult.value.reviews
    : [];

  const agg = aggregate.status === 'fulfilled'
    ? aggregate.value
    : { average: 0, total: 0, bestRating: 5 };

  initRepeater(reviews);
  initAggregateSummary(agg);
  initSchema(agg, reviews);
});

function initRepeater(reviews) {
  const repeater = $w('#reviewsRepeater');
  repeater.accessibility.ariaLabel = 'Customer reviews';
  repeater.onItemReady(($item, item) => {
    $item('#reviewAuthor').text = item.authorName || 'Customer';
    $item('#reviewRating').text = '★'.repeat(Math.round(item.rating || 0));
    $item('#reviewTitle').text = item.title || '';
    $item('#reviewBody').text = item.body || '';
    $item('#reviewProduct').text = item.productName || '';
  });
  repeater.data = reviews;
}

function initAggregateSummary(agg) {
  $w('#reviewsAggregateRating').text = `${agg.average} out of 5`;
  $w('#reviewsTotalCount').text = `${agg.total} reviews`;
}

function initSchema(agg, reviews) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Carolina Futons',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: agg.average,
      reviewCount: agg.total,
      bestRating: agg.bestRating || 5,
      worstRating: 1,
    },
    review: reviews.map(r => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.authorName || 'Customer' },
      reviewRating: { '@type': 'Rating', ratingValue: r.rating },
      name: r.title || '',
      reviewBody: r.body || '',
      datePublished: r._createdDate || '',
    })),
  };

  $w('#reviewsSchemaHtml').html =
    `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}
