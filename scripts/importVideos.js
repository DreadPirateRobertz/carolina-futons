/**
 * Import scraped video data into the Videos CMS collection.
 *
 * Expected input shape per item:
 * {
 *   title: string,          // video title
 *   videoUrl: string,       // video URL (YouTube, Vimeo, etc.)
 *   thumbnail?: string,     // thumbnail image URL
 *   productId?: string,     // associated product ID
 *   category?: string,      // e.g. "futon", "murphy", "platform", "general"
 *   duration?: string,      // e.g. "2:30"
 *   isFeatured?: boolean    // featured flag (defaults to false)
 * }
 */
import wixData from 'wix-data';
import { processBatches, requireString, validateUrl, sanitize } from './importConfig';

/**
 * Import videos with dedup on videoUrl.
 * @param {Array} videos - Array of video objects from scrape.
 * @returns {Promise<{inserted: number, skipped: number, errors: Array}>}
 */
export async function importVideos(videos) {
  if (!Array.isArray(videos) || videos.length === 0) {
    return { inserted: 0, skipped: 0, errors: [{ error: 'No video data provided' }] };
  }

  // Pre-fetch existing video URLs for dedup
  const existingUrls = new Set();
  let skip = 0;
  const PAGE = 100;
  while (true) {
    const page = await wixData.query('Videos')
      .limit(PAGE)
      .skip(skip)
      .find();
    for (const item of page.items) {
      existingUrls.add(item.videoUrl);
    }
    if (page.items.length < PAGE) break;
    skip += PAGE;
  }

  return processBatches(videos, async (batch) => {
    let inserted = 0;
    let skipped = 0;
    const errors = [];

    for (const video of batch) {
      const validationErrors = [
        requireString(video.title, 'title'),
        requireString(video.videoUrl, 'videoUrl'),
        validateUrl(video.videoUrl, 'videoUrl'),
        validateUrl(video.thumbnail, 'thumbnail'),
      ].filter(Boolean);

      if (validationErrors.length > 0) {
        errors.push({ title: video.title, errors: validationErrors });
        skipped++;
        continue;
      }

      if (existingUrls.has(video.videoUrl)) {
        skipped++;
        continue;
      }

      try {
        await wixData.insert('Videos', {
          title: sanitize(video.title, 200),
          videoUrl: video.videoUrl,
          thumbnail: video.thumbnail || '',
          productId: sanitize(video.productId, 100),
          category: sanitize(video.category, 50),
          duration: sanitize(video.duration, 20),
          viewCount: 0,
          isFeatured: video.isFeatured === true,
        });
        existingUrls.add(video.videoUrl);
        inserted++;
      } catch (err) {
        errors.push({ title: video.title, error: err.message });
      }
    }

    return { inserted, skipped, errors };
  });
}
