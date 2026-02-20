// About.gar3e.js - "Our Story" Page
// Polaroid-style team photos, business history timeline,
// and trust-building content with local SEO signals
import { getBusinessSchema } from 'backend/seoHelpers.web';

$w.onReady(async function () {
  initPhotoGallery();
  initTimeline();
  await injectLocalSchema();
});

// ── Polaroid Photo Gallery ──────────────────────────────────────────
// Team/family photos in tilted polaroid-style frames

function initPhotoGallery() {
  try {
    const gallery = $w('#teamGallery');
    if (!gallery) return;

    // Apply random slight rotations to gallery items for polaroid effect
    gallery.onItemReady(($item, itemData) => {
      $item('#polaroidImage').alt = itemData.title || 'The Carolina Futons team in Hendersonville, NC';

      // Caption below polaroid
      if (itemData.description) {
        try {
          $item('#polaroidCaption').text = itemData.description;
        } catch (e) {}
      }
    });
  } catch (e) {}
}

// ── Business Timeline ───────────────────────────────────────────────
// Key milestones in the Carolina Futons story

function initTimeline() {
  const milestones = [
    { year: '1991', title: "Sims' Futon Gallery Opens", description: 'Richard and Liz Sims open their doors in Hendersonville, NC, bringing quality futon furniture to the Carolinas.' },
    { year: '2000s', title: 'Largest Selection in the Carolinas', description: 'The store grows to carry the widest range of futon frames, mattresses, and convertible furniture in the region.' },
    { year: '2021', title: 'A New Chapter Begins', description: 'Brenda and Howard Deal take the helm, continuing the same principles of honesty, fair pricing, and outstanding service.' },
    { year: 'Today', title: 'Carolina Futons', description: 'Now featuring Murphy Cabinet Beds, platform beds, and a curated selection of quality furniture — all from our Hendersonville showroom.' },
  ];

  try {
    const repeater = $w('#timelineRepeater');
    if (!repeater) return;

    repeater.data = milestones.map((m, i) => ({ ...m, _id: String(i) }));
    repeater.onItemReady(($item, itemData) => {
      $item('#timelineYear').text = itemData.year;
      $item('#timelineTitle').text = itemData.title;
      $item('#timelineDesc').text = itemData.description;
    });
  } catch (e) {}
}

// ── Local Business Schema ───────────────────────────────────────────

async function injectLocalSchema() {
  try {
    const schema = await getBusinessSchema();
    if (schema) {
      $w('#aboutSchemaHtml').postMessage(schema);
    }
  } catch (e) {}
}
