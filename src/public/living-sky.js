/**
 * @module living-sky
 * @description Core interpolation engine for Phase 7 Living Blue Ridge Sky.
 * Pure JavaScript, no DOM dependencies — fully testable.
 *
 * Exports:
 *  - useLivingSky(totalMinutes) → LivingSkyState
 *  - getSeason(date) → 'spring'|'summer'|'fall'|'winter'
 *
 * Data tables lifted exactly from 03-living-sky.html demo prototype.
 * The 16-keyframe tables are the canonical source of truth for all colors/values.
 */

// ── Sky color table — 16 keyframes × [sky0–3, glow0–1, sun, stars, moon, cloud, wildlife] ──

const skyTable = [
  // Night — very deep indigo-black, rich star sky
  { h: 0,   sky:['#050810','#080D1C','#0D1628','#141E30'], glow:['transparent','transparent'], sunCX:520, sunCY:220, sunR:14, sunOp:0,    starOp:0.9,  moonOp:1,    cloudOp:0,    birdOp:0,    rimOp:0.12, rimCol:'#4A6E8A', navBg:'#0A0F1C', navText:'#8BAFC8', fireflyOp:0.55, owlOp:0.9  },
  { h: 4,   sky:['#050810','#080D1C','#0D1628','#141E30'], glow:['transparent','transparent'], sunCX:520, sunCY:220, sunR:14, sunOp:0,    starOp:0.85, moonOp:0.9,  cloudOp:0,    birdOp:0,    rimOp:0.12, rimCol:'#4A6E8A', navBg:'#0A0F1C', navText:'#8BAFC8', fireflyOp:0.4,  owlOp:0.85 },
  // Dawn — first light, warm rose-peach at horizon
  { h: 5,   sky:['#18182A','#301830','#D07858','#F0A858'], glow:['#E89050','#D06828'], sunCX:70,  sunCY:148, sunR:12, sunOp:0.65, starOp:0.25, moonOp:0.15, cloudOp:0.55, birdOp:0,    rimOp:0.25, rimCol:'#F0A060', navBg:'#1A100C', navText:'#C8A880', fireflyOp:0.1,  owlOp:0.5  },
  { h: 6,   sky:['#2A2440','#5A4060','#E89060','#F8C060'], glow:['#F8C840','#E07820'], sunCX:150, sunCY:138, sunR:13, sunOp:0.8,  starOp:0.05, moonOp:0,    cloudOp:0.85, birdOp:0,    rimOp:0.35, rimCol:'#F8A050', navBg:'#1E150C', navText:'#D4B888', fireflyOp:0,    owlOp:0.15 },
  // Morning — clean cool blue, sea of clouds dissipating
  { h: 7,   sky:['#607888','#8AA0B0','#BED0DC','#D4E4F0'], glow:['#F8E8C8','#E8D0A0'], sunCX:220, sunCY:128, sunR:14, sunOp:0.9,  starOp:0,    moonOp:0,    cloudOp:0.7,  birdOp:0,    rimOp:0.3,  rimCol:'#F8E0A8', navBg:'#ffffff', navText:'#1E2A3A', fireflyOp:0,    owlOp:0    },
  { h: 8.5, sky:['#4A6A88','#7090A8','#A8C4D8','#C4D8EC'], glow:['#F0E4C0','#E0C880'], sunCX:300, sunCY:108, sunR:14, sunOp:0.95, starOp:0,    moonOp:0,    cloudOp:0.28, birdOp:0,    rimOp:0.18, rimCol:'#F8E8C0', navBg:'#ffffff', navText:'#1E2A3A', fireflyOp:0,    owlOp:0    },
  { h: 10,  sky:['#3860A0','#608098','#98B8CC','#B4CCE0'], glow:['transparent','transparent'], sunCX:410, sunCY:74,  sunR:15, sunOp:1,    starOp:0,    moonOp:0,    cloudOp:0,    birdOp:0,    rimOp:0.08, rimCol:'#FFFAE0', navBg:'#ffffff', navText:'#1E2A3A', fireflyOp:0,    owlOp:0    },
  { h: 12,  sky:['#2858A0','#4878A8','#88B0C4','#A4C8DC'], glow:['transparent','transparent'], sunCX:524, sunCY:52,  sunR:16, sunOp:1,    starOp:0,    moonOp:0,    cloudOp:0,    birdOp:0,    rimOp:0.04, rimCol:'#FFFCE8', navBg:'#ffffff', navText:'#1E2A3A', fireflyOp:0,    owlOp:0    },
  { h: 14,  sky:['#3060A8','#588898','#90B4C8','#ACCCE0'], glow:['transparent','transparent'], sunCX:658, sunCY:70,  sunR:15, sunOp:1,    starOp:0,    moonOp:0,    cloudOp:0,    birdOp:0,    rimOp:0.06, rimCol:'#FFFCE8', navBg:'#ffffff', navText:'#1E2A3A', fireflyOp:0,    owlOp:0    },
  { h: 16,  sky:['#385A98','#607C98','#98B0C0','#B4C8D8'], glow:['transparent','transparent'], sunCX:768, sunCY:94,  sunR:15, sunOp:1,    starOp:0,    moonOp:0,    cloudOp:0,    birdOp:0,    rimOp:0.12, rimCol:'#F8E8C0', navBg:'#ffffff', navText:'#1E2A3A', fireflyOp:0,    owlOp:0    },
  // Golden Hour — dramatic purple-blue to orange fire
  { h: 17.5,sky:['#2C2458','#6C3868','#C86040','#F0A030'], glow:['#FFD840','#E05800'], sunCX:848, sunCY:116, sunR:17, sunOp:1,    starOp:0,    moonOp:0,    cloudOp:0,    birdOp:0.7,  rimOp:0.7,  rimCol:'#FF9010', navBg:'#F5EFE6', navText:'#3D2310', fireflyOp:0,    owlOp:0    },
  { h: 18.5,sky:['#201840','#5C2C60','#C85038','#F08828'], glow:['#FFD050','#E05000'], sunCX:920, sunCY:140, sunR:18, sunOp:0.95, starOp:0,    moonOp:0,    cloudOp:0,    birdOp:1,    rimOp:0.95, rimCol:'#FF7010', navBg:'#F5EFE6', navText:'#3D2310', fireflyOp:0.08, owlOp:0    },
  // Dusk — sun gone, deep rich purple-red, first stars, bats peak
  { h: 19.5,sky:['#100E1E','#381630','#801C20','#C04020'], glow:['#E05018','#A03010'], sunCX:985, sunCY:155, sunR:13, sunOp:0.3,  starOp:0.2,  moonOp:0.5,  cloudOp:0,    birdOp:0.25, rimOp:0.2,  rimCol:'#E06018', navBg:'#160A08', navText:'#C8A880', fireflyOp:0.6,  owlOp:0.25 },
  // Early night
  { h: 20.5,sky:['#070B14','#0E1422','#181E2E','#20283A'], glow:['transparent','transparent'], sunCX:1060,sunCY:220, sunR:12, sunOp:0,    starOp:0.55, moonOp:0.88, cloudOp:0,    birdOp:0,    rimOp:0.14, rimCol:'#3C608A', navBg:'#0C1020', navText:'#8BAFC8', fireflyOp:0.85, owlOp:0.65 },
  // Full night — darkest, richest indigo
  { h: 22,  sky:['#050810','#080D1C','#0D1628','#141E30'], glow:['transparent','transparent'], sunCX:1060,sunCY:220, sunR:12, sunOp:0,    starOp:0.85, moonOp:1,    cloudOp:0,    birdOp:0,    rimOp:0.15, rimCol:'#4A6E8A', navBg:'#080D18', navText:'#8BAFC8', fireflyOp:0.7,  owlOp:1    },
  { h: 24,  sky:['#050810','#080D1C','#0D1628','#141E30'], glow:['transparent','transparent'], sunCX:520, sunCY:220, sunR:14, sunOp:0,    starOp:0.9,  moonOp:1,    cloudOp:0,    birdOp:0,    rimOp:0.15, rimCol:'#4A6E8A', navBg:'#080D18', navText:'#8BAFC8', fireflyOp:0.55, owlOp:0.9  },
];

// ── Ridge colors table — 16 keyframes × [r1–r4, tree] ─────────────────────────

const ridgeTable = [
  // Night — deep indigo, ridges barely separate from sky
  { h:0,   r4:'#3C4E6A', r3:'#283860', r2:'#162850', r1:'#0C1838', tree:'#080E1E' },
  { h:4,   r4:'#3A4C68', r3:'#26365E', r2:'#14264C', r1:'#0A1636', tree:'#070D1C' },
  // Dawn — whole range goes warm violet-rose
  { h:5,   r4:'#C888A8', r3:'#9A6080', r2:'#6C3060', r1:'#3A1040', tree:'#1A0620' },
  { h:6,   r4:'#B87E98', r3:'#8A5070', r2:'#5C2450', r1:'#32103C', tree:'#160820' },
  // Morning — warming to day
  { h:7,   r4:'#96B8C8', r3:'#6A90A8', r2:'#426874', r1:'#224850', tree:'#101E28' },
  { h:8.5, r4:'#90B4C2', r3:'#648CA0', r2:'#3C6470', r1:'#1E444C', tree:'#0E1C24' },
  // Midday — photo-accurate: near=dark forest green-blue, far=pale atmospheric blue-purple
  { h:10,  r4:'#B4D0E0', r3:'#80A8C4', r2:'#4A7898', r1:'#1E4858', tree:'#0E1E28' },
  { h:12,  r4:'#AECCD8', r3:'#7AA4BE', r2:'#487494', r1:'#1C4454', tree:'#0C1C26' },
  { h:14,  r4:'#B0CED8', r3:'#7CA2BA', r2:'#4A7490', r1:'#1E4452', tree:'#0E1E28' },
  { h:16,  r4:'#A8C8D8', r3:'#7498B2', r2:'#466E98', r1:'#205080', tree:'#102030' },
  // Golden hour — near ridges go almost BLACK silhouette
  { h:17.5,r4:'#8860A0', r3:'#602870', r2:'#3E0850', r1:'#1C0430', tree:'#0C0218' },
  { h:18.5,r4:'#703480', r3:'#4C1468', r2:'#300850', r1:'#140230', tree:'#080118' },
  // Dusk — deep, nearly silhouette
  { h:19.5,r4:'#3A1C40', r3:'#26102E', r2:'#160820', r1:'#0A0412', tree:'#04020A' },
  { h:20.5,r4:'#2C3858', r3:'#1C2848', r2:'#0E1838', r1:'#081026', tree:'#050C16' },
  // Full night — cool indigo
  { h:21,  r4:'#2E3E5E', r3:'#1E2E54', r2:'#121E44', r1:'#0A1430', tree:'#060C1E' },
  { h:24,  r4:'#3C4E6A', r3:'#283860', r2:'#162850', r1:'#0C1838', tree:'#080E1E' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function parseColor(c) {
  if (!c || c === 'transparent') return [0, 0, 0, 0];
  const rgba = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgba) {
    return [
      parseInt(rgba[1]),
      parseInt(rgba[2]),
      parseInt(rgba[3]),
      rgba[4] !== undefined ? parseFloat(rgba[4]) : 1,
    ];
  }
  const hex = c.replace('#', '');
  if (hex.length === 3) {
    return [parseInt(hex[0]+hex[0],16), parseInt(hex[1]+hex[1],16), parseInt(hex[2]+hex[2],16), 1];
  }
  if (hex.length === 6) {
    return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16), 1];
  }
  if (hex.length === 8) {
    return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16), parseInt(hex.slice(6,8),16)/255];
  }
  return [0, 0, 0, 1];
}

function lerpColor(c1, c2, t) {
  if (!c1 || c1 === 'transparent') c1 = '#00000000';
  if (!c2 || c2 === 'transparent') c2 = '#00000000';
  const p1 = parseColor(c1), p2 = parseColor(c2);
  const r = Math.round(lerp(p1[0], p2[0], t));
  const g = Math.round(lerp(p1[1], p2[1], t));
  const b = Math.round(lerp(p1[2], p2[2], t));
  const a = lerp(p1[3], p2[3], t);
  if (a < 0.01) return 'transparent';
  if (a > 0.98) return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  return `rgba(${r},${g},${b},${a.toFixed(2)})`;
}

function getInterpolated(table, hour) {
  let i = 0;
  while (i < table.length - 1 && table[i + 1].h <= hour) i++;
  const a = table[i];
  const b = table[Math.min(i + 1, table.length - 1)];
  const t = (b.h === a.h) ? 1 : (hour - a.h) / (b.h - a.h);
  return { a, b, t };
}

// ── Moon phase ────────────────────────────────────────────────────────────────

const KNOWN_NEW_MOON = new Date('2025-01-29T12:36:00Z').getTime();
const LUNAR_CYCLE = 29.53058867;

function getMoonPhase(date) {
  const diff = (date.getTime() - KNOWN_NEW_MOON) / (1000 * 60 * 60 * 24);
  return ((diff % LUNAR_CYCLE) + LUNAR_CYCLE) % LUNAR_CYCLE;
}

function moonShadowOffset(phase) {
  const angle = (phase / LUNAR_CYCLE) * Math.PI * 2;
  const illum = (1 - Math.cos(angle)) / 2;
  return (1 - illum * 2) * 14; // ranges −14 (new) to +14 (waning)
}

// ── Season ────────────────────────────────────────────────────────────────────

/**
 * Detect season from a Date object.
 * @param {Date} [date]
 * @returns {'spring'|'summer'|'fall'|'winter'}
 */
export function getSeason(date = new Date()) {
  const m = date.getMonth(); // 0-based
  if (m >= 2 && m <= 4) return 'spring'; // Mar–May
  if (m >= 5 && m <= 7) return 'summer'; // Jun–Aug
  if (m >= 8 && m <= 10) return 'fall';  // Sep–Nov
  return 'winter';                         // Dec, Jan, Feb
}

// ── Season ridge color modifier ───────────────────────────────────────────────

function seasonalColor(hex, element, season) {
  if (season === 'summer') return hex;
  const [r, g, b, a] = parseColor(hex);
  if (a < 0.01) return hex;
  if (season === 'fall') {
    const warmth = element === 'r1' ? 0.85 : element === 'r2' ? 0.65 : element === 'r3' ? 0.35 : 0.12;
    return `rgb(${Math.min(255,Math.round(r + 70*warmth))},${Math.round(g * (1-0.25*warmth))},${Math.round(b * (1-0.55*warmth))})`;
  }
  if (season === 'winter') {
    const avg = (r + g + b) / 3;
    const fade = element === 'r1' ? 0.5 : element === 'r2' ? 0.45 : element === 'r3' ? 0.35 : 0.2;
    return `rgb(${Math.min(255,Math.round(lerp(r,avg,fade)+18))},${Math.min(255,Math.round(lerp(g,avg,fade)+18))},${Math.min(255,Math.round(lerp(b,avg,fade)+28))})`;
  }
  if (season === 'spring') {
    return `rgb(${Math.max(0,Math.round(r-8))},${Math.min(255,Math.round(g+18))},${Math.round(b)})`;
  }
  return hex;
}

// ── Moon position ─────────────────────────────────────────────────────────────

function computeMoonPosition(hour) {
  // Moon rises ~6pm, sets ~6am
  let moonAngle = 0;
  if (hour >= 18 || hour < 6) {
    const moonHour = hour >= 18 ? hour - 18 : hour + 6;
    moonAngle = (moonHour / 12) * Math.PI;
  }
  const cx = 520 + Math.cos(Math.PI - moonAngle) * 320;
  const cy = 140 - Math.sin(moonAngle) * 110;
  return { cx, cy };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compute the full LivingSkyState for a given time of day.
 * @param {number} totalMinutes - Minutes since midnight (0..1440). 1440 wraps to 0.
 * @returns {LivingSkyState}
 */
export function useLivingSky(totalMinutes) {
  // Clamp/wrap to [0, 1440)
  const mins = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = mins / 60;

  const now = new Date();
  const season = getSeason(now);

  // Interpolate sky table
  const { a: sa, b: sb, t: st } = getInterpolated(skyTable, hour);

  const skyColors = [
    lerpColor(sa.sky[0], sb.sky[0], st),
    lerpColor(sa.sky[1], sb.sky[1], st),
    lerpColor(sa.sky[2], sb.sky[2], st),
    lerpColor(sa.sky[3], sb.sky[3], st),
  ];

  const glowColors = [
    lerpColor(sa.glow[0], sb.glow[0], st),
    lerpColor(sa.glow[1], sb.glow[1], st),
  ];

  const sunPos = {
    cx:      lerp(sa.sunCX, sb.sunCX, st),
    cy:      lerp(sa.sunCY, sb.sunCY, st),
    r:       lerp(sa.sunR,  sb.sunR,  st),
    opacity: lerp(sa.sunOp, sb.sunOp, st),
  };

  const starOpacity    = lerp(sa.starOp    || 0, sb.starOp    || 0, st);
  const cloudOpacity   = lerp(sa.cloudOp   || 0, sb.cloudOp   || 0, st);
  const birdOpacity    = lerp(sa.birdOp    || 0, sb.birdOp    || 0, st);
  const fireflyOpacity = lerp(sa.fireflyOp || 0, sb.fireflyOp || 0, st);
  const owlOpacity     = lerp(sa.owlOp     || 0, sb.owlOp     || 0, st);
  const rimOpacity     = lerp(sa.rimOp     || 0, sb.rimOp     || 0, st);
  const rimColor       = lerpColor(sa.rimCol || '#ffffff', sb.rimCol || '#ffffff', st);
  const navBg          = lerpColor(sa.navBg,   sb.navBg   || sa.navBg,   st);
  const navText        = lerpColor(sa.navText, sb.navText || sa.navText, st);

  // Interpolate ridge table
  const { a: ra, b: rb, t: rt } = getInterpolated(ridgeTable, hour);

  const ridgeColors = {
    r1:   seasonalColor(lerpColor(ra.r1,   rb.r1,   rt), 'r1',   season),
    r2:   seasonalColor(lerpColor(ra.r2,   rb.r2,   rt), 'r2',   season),
    r3:   seasonalColor(lerpColor(ra.r3,   rb.r3,   rt), 'r3',   season),
    r4:   seasonalColor(lerpColor(ra.r4,   rb.r4,   rt), 'r4',   season),
    tree: lerpColor(ra.tree, rb.tree, rt),
  };

  // Moon
  const moonPhase = getMoonPhase(now);
  const moonShadowDx = moonShadowOffset(moonPhase);
  const moonOpacity = lerp(sa.moonOp || 0, sb.moonOp || 0, st);
  const { cx: moonCx, cy: moonCy } = computeMoonPosition(hour);

  const moonPos = {
    cx: moonCx,
    cy: moonCy,
    opacity: moonOpacity,
    phase: moonPhase,
    shadowOffset: { dx: moonShadowDx, dy: 0 },
  };

  // Precipitation
  let precipitationType = 'none';
  if (season === 'winter' && cloudOpacity > 0) {
    precipitationType = 'snow';
  } else if (season === 'spring' && cloudOpacity > 0.4) {
    precipitationType = 'mist';
  }
  const precipitationOpacity = season === 'winter' && cloudOpacity > 0
    ? Math.max(0, 0.55 - Math.abs(hour - 12) * 0.02)
    : season === 'spring' && cloudOpacity > 0.4
      ? 0.38
      : 0;

  return {
    skyColors,
    glowColors,
    ridgeColors,
    sunPos,
    moonPos,
    starOpacity,
    cloudOpacity,
    birdOpacity,
    fireflyOpacity,
    owlOpacity,
    rimOpacity,
    rimColor,
    navBg,
    navText,
    season,
    precipitationOpacity,
    precipitationType,
  };
}
