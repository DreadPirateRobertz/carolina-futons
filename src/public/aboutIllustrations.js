/**
 * aboutIllustrations.js — About/Our Story page SVG illustrations.
 * Team Portrait scene + Blue Ridge Timeline.
 * Blue Ridge Mountain aesthetic: watercolor textures, organic paths, warm palette.
 * @module aboutIllustrations
 */
import { colors } from 'public/sharedTokens.js';

const {
  sandBase, sandLight, sandDark,
  espresso, espressoLight,
  mountainBlue, mountainBlueDark, mountainBlueLight,
  sunsetCoral, sunsetCoralDark, sunsetCoralLight,
  offWhite, white,
  skyGradientTop, skyGradientBottom,
  success, mutedBrown,
} = colors;

/**
 * Team Portrait SVG — team silhouettes against Blue Ridge mountain backdrop.
 * Warm sunset atmosphere, watercolor textures, hand-drawn feel.
 * @returns {string} SVG markup
 */
export function getTeamPortraitSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 500" width="100%" height="100%" role="img" aria-labelledby="title-team-portrait">
  <title id="title-team-portrait">Team portrait illustration — Carolina Futons team silhouettes gathered before Blue Ridge mountains at golden hour</title>
  <defs>
    <filter id="wc-team">
      <feTurbulence type="turbulence" baseFrequency="0.035" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3"/>
    </filter>
    <filter id="grain-team">
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desat"/>
      <feBlend in="SourceGraphic" in2="desat" mode="multiply"/>
    </filter>
    <linearGradient id="team-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyGradientTop}"/>
      <stop offset="20%" stop-color="${mountainBlueLight}"/>
      <stop offset="45%" stop-color="${sandLight}"/>
      <stop offset="70%" stop-color="${sunsetCoralLight}"/>
      <stop offset="88%" stop-color="${skyGradientBottom}"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <radialGradient id="team-sun-glow" cx="50%" cy="35%" r="35%">
      <stop offset="0%" stop-color="${skyGradientBottom}" stop-opacity="0.6"/>
      <stop offset="50%" stop-color="${sunsetCoralLight}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${sandLight}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="team-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sandBase}"/>
      <stop offset="100%" stop-color="${sandDark}"/>
    </linearGradient>
  </defs>
  <g filter="url(#grain-team)">
    <g id="background">
      <rect x="0" y="0" width="900" height="500" fill="url(#team-sky)" filter="url(#wc-team)"/>
      <rect x="0" y="0" width="900" height="500" fill="url(#team-sun-glow)"/>
      <ellipse cx="700" cy="70" rx="50" ry="20" fill="${offWhite}" opacity="0.45"/>
      <ellipse cx="730" cy="65" rx="38" ry="15" fill="${sandLight}" opacity="0.35"/>
      <ellipse cx="200" cy="95" rx="55" ry="18" fill="${offWhite}" opacity="0.4"/>
      <line x1="250" y1="50" x2="258" y2="44" stroke="${espresso}" stroke-width="1.2" opacity="0.25"/>
      <line x1="258" y1="44" x2="266" y2="50" stroke="${espresso}" stroke-width="1.2" opacity="0.25"/>
      <line x1="600" y1="38" x2="607" y2="32" stroke="${espresso}" stroke-width="1" opacity="0.2"/>
      <line x1="607" y1="32" x2="614" y2="38" stroke="${espresso}" stroke-width="1" opacity="0.2"/>
      <line x1="420" y1="55" x2="426" y2="49" stroke="${espresso}" stroke-width="1" opacity="0.18"/>
      <line x1="426" y1="49" x2="432" y2="55" stroke="${espresso}" stroke-width="1" opacity="0.18"/>
    </g>
    <g id="midground" opacity="0.75">
      <path id="mountain-ridge-far" d="M0 290 Q60 230 130 255 Q190 210 260 240 Q330 195 400 225 Q470 185 540 215 Q610 175 680 205 Q750 165 820 195 Q870 180 900 200 L900 350 L0 350Z" fill="${mountainBlue}" opacity="0.3" filter="url(#wc-team)"/>
      <path id="mountain-ridge-mid" d="M0 310 Q80 265 170 285 Q240 245 320 275 Q400 240 480 265 Q560 230 640 258 Q720 225 800 252 Q860 235 900 248 L900 370 L0 370Z" fill="${mountainBlueDark}" opacity="0.25" filter="url(#wc-team)"/>
      <path id="tree-pine-1" d="M80 345 L88 315 L92 313 L97 317 L104 345Z" fill="${success}" opacity="0.35"/>
      <path id="tree-pine-2" d="M160 340 L167 312 L170 310 L175 314 L180 340Z" fill="${success}" opacity="0.3"/>
      <path id="tree-pine-3" d="M780 338 L786 310 L790 308 L794 312 L800 338Z" fill="${success}" opacity="0.32"/>
      <path id="tree-pine-4" d="M820 342 L826 316 L830 314 L834 318 L840 342Z" fill="${success}" opacity="0.28"/>
    </g>
    <g id="foreground">
      <path d="M0 380 Q120 365 250 372 Q400 358 550 368 Q700 355 900 365 L900 500 L0 500Z" fill="url(#team-ground)" filter="url(#wc-team)"/>
      <g id="figure-person-1" transform="translate(260, 340)">
        <ellipse cx="0" cy="-55" rx="12" ry="14" fill="${espresso}" opacity="0.8"/>
        <path d="M-15 -40 Q-18 -10 -12 20 L12 20 Q18 -10 15 -40Z" fill="${espressoLight}" opacity="0.75"/>
        <line x1="-12" y1="-20" x2="-22" y2="5" stroke="${espresso}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
        <line x1="12" y1="-20" x2="22" y2="5" stroke="${espresso}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
      </g>
      <g id="figure-person-2" transform="translate(350, 335)">
        <ellipse cx="0" cy="-60" rx="13" ry="15" fill="${espresso}" opacity="0.8"/>
        <path d="M-16 -44 Q-20 -12 -14 22 L14 22 Q20 -12 16 -44Z" fill="${mountainBlueDark}" opacity="0.7"/>
        <line x1="-14" y1="-22" x2="-24" y2="6" stroke="${espresso}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
        <line x1="14" y1="-22" x2="24" y2="6" stroke="${espresso}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
      </g>
      <g id="figure-person-3" transform="translate(450, 338)">
        <ellipse cx="0" cy="-57" rx="12" ry="14" fill="${espresso}" opacity="0.8"/>
        <path d="M-15 -42 Q-18 -12 -12 20 L12 20 Q18 -12 15 -42Z" fill="${sunsetCoral}" opacity="0.7"/>
        <line x1="-12" y1="-20" x2="-22" y2="5" stroke="${espresso}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
        <line x1="12" y1="-20" x2="22" y2="5" stroke="${espresso}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
      </g>
      <g id="figure-person-4" transform="translate(550, 336)">
        <ellipse cx="0" cy="-58" rx="12" ry="14" fill="${espresso}" opacity="0.8"/>
        <path d="M-15 -43 Q-18 -12 -12 21 L12 21 Q18 -12 15 -43Z" fill="${sandDark}" opacity="0.75"/>
        <line x1="-12" y1="-21" x2="-22" y2="5" stroke="${espresso}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
        <line x1="12" y1="-21" x2="22" y2="5" stroke="${espresso}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
      </g>
      <g id="figure-person-5" transform="translate(640, 340)">
        <ellipse cx="0" cy="-55" rx="12" ry="14" fill="${espresso}" opacity="0.8"/>
        <path d="M-15 -40 Q-18 -10 -12 20 L12 20 Q18 -10 15 -40Z" fill="${mutedBrown}" opacity="0.7"/>
        <line x1="-12" y1="-20" x2="-22" y2="5" stroke="${espresso}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
        <line x1="12" y1="-20" x2="22" y2="5" stroke="${espresso}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
      </g>
      <path d="M100 460 Q130 448 145 455 Q160 442 175 450 Q190 440 210 450" fill="none" stroke="${sunsetCoralLight}" stroke-width="1.5" opacity="0.4"/>
      <circle cx="115" cy="455" r="3" fill="${sunsetCoral}" opacity="0.5"/>
      <circle cx="155" cy="448" r="2.5" fill="${sunsetCoralLight}" opacity="0.45"/>
      <circle cx="195" cy="445" r="3" fill="${sunsetCoral}" opacity="0.4"/>
    </g>
  </g>
</svg>`;
}

/**
 * Blue Ridge Timeline SVG — milestones across a mountain landscape.
 * Shows company history as a path winding through mountain scenery.
 * @returns {string} SVG markup
 */
export function getTimelineSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="100%" height="100%" role="img" aria-labelledby="title-timeline">
  <title id="title-timeline">Blue Ridge timeline illustration — Carolina Futons company milestones winding through layered mountain scenery from 1991 to present</title>
  <defs>
    <filter id="wc-tl">
      <feTurbulence type="turbulence" baseFrequency="0.03" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5"/>
    </filter>
    <filter id="grain-tl">
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desat"/>
      <feBlend in="SourceGraphic" in2="desat" mode="multiply"/>
    </filter>
    <linearGradient id="tl-sky" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${skyGradientTop}"/>
      <stop offset="20%" stop-color="${mountainBlueLight}"/>
      <stop offset="40%" stop-color="${sandLight}"/>
      <stop offset="60%" stop-color="${sunsetCoralLight}"/>
      <stop offset="80%" stop-color="${skyGradientBottom}"/>
      <stop offset="100%" stop-color="${offWhite}"/>
    </linearGradient>
    <linearGradient id="tl-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sandBase}"/>
      <stop offset="100%" stop-color="${sandDark}"/>
    </linearGradient>
    <radialGradient id="tl-milestone-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${sunsetCoral}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${sunsetCoral}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g filter="url(#grain-tl)">
    <g id="background">
      <rect x="0" y="0" width="1200" height="400" fill="url(#tl-sky)" filter="url(#wc-tl)"/>
      <ellipse cx="150" cy="45" rx="45" ry="16" fill="${offWhite}" opacity="0.4"/>
      <ellipse cx="500" cy="35" rx="50" ry="18" fill="${sandLight}" opacity="0.35"/>
      <ellipse cx="900" cy="50" rx="55" ry="17" fill="${offWhite}" opacity="0.38"/>
      <line x1="300" y1="30" x2="307" y2="24" stroke="${espresso}" stroke-width="1" opacity="0.2"/>
      <line x1="307" y1="24" x2="314" y2="30" stroke="${espresso}" stroke-width="1" opacity="0.2"/>
      <line x1="700" y1="25" x2="706" y2="19" stroke="${espresso}" stroke-width="1" opacity="0.18"/>
      <line x1="706" y1="19" x2="712" y2="25" stroke="${espresso}" stroke-width="1" opacity="0.18"/>
      <line x1="1050" y1="35" x2="1056" y2="29" stroke="${espresso}" stroke-width="1.1" opacity="0.2"/>
      <line x1="1056" y1="29" x2="1062" y2="35" stroke="${espresso}" stroke-width="1.1" opacity="0.2"/>
    </g>
    <g id="midground" opacity="0.7">
      <path id="mountain-ridge-timeline" d="M0 200 Q60 160 130 178 Q200 140 280 165 Q360 130 440 155 Q520 120 600 148 Q680 115 760 140 Q840 105 920 132 Q1000 95 1080 125 Q1140 108 1200 120 L1200 260 L0 260Z" fill="${mountainBlue}" opacity="0.3" filter="url(#wc-tl)"/>
      <path d="M0 225 Q90 190 190 208 Q290 175 390 200 Q490 170 590 195 Q690 160 790 188 Q890 155 990 180 Q1080 150 1200 168 L1200 280 L0 280Z" fill="${mountainBlueDark}" opacity="0.22" filter="url(#wc-tl)"/>
      <path id="bird-flock-1" d="M180 80 L187 74 L194 80" fill="none" stroke="${espresso}" stroke-width="1.2" opacity="0.25"/>
      <path id="bird-flock-2" d="M195 85 L201 79 L207 85" fill="none" stroke="${espresso}" stroke-width="1" opacity="0.2"/>
      <path id="tree-timeline-1" d="M50 255 L57 228 L60 226 L64 230 L70 255Z" fill="${success}" opacity="0.35"/>
      <path id="tree-timeline-2" d="M350 248 L356 222 L360 220 L364 224 L370 248Z" fill="${success}" opacity="0.3"/>
      <path id="tree-timeline-3" d="M750 245 L756 218 L760 216 L764 220 L770 245Z" fill="${success}" opacity="0.32"/>
      <path id="tree-timeline-4" d="M1100 250 L1106 224 L1110 222 L1114 226 L1120 250Z" fill="${success}" opacity="0.28"/>
    </g>
    <g id="foreground">
      <path d="M0 280 Q150 268 300 274 Q500 260 700 270 Q900 258 1200 266 L1200 400 L0 400Z" fill="url(#tl-ground)" filter="url(#wc-tl)"/>
      <path d="M60 310 Q200 295 350 305 Q500 290 650 300 Q800 288 950 298 Q1050 286 1150 295" fill="none" stroke="${espresso}" stroke-width="2.5" stroke-dasharray="8,6" opacity="0.45"/>
      <g id="milestone-era-1991" transform="translate(120, 290)">
        <circle cx="0" cy="0" r="18" fill="url(#tl-milestone-glow)"/>
        <circle cx="0" cy="0" r="8" fill="${sunsetCoral}" opacity="0.9"/>
        <circle cx="0" cy="0" r="4" fill="${offWhite}" opacity="0.8"/>
        <rect x="-20" y="22" width="40" height="16" rx="3" fill="${espresso}" opacity="0.7"/>
      </g>
      <g id="milestone-era-2005" transform="translate(420, 282)">
        <circle cx="0" cy="0" r="18" fill="url(#tl-milestone-glow)"/>
        <circle cx="0" cy="0" r="8" fill="${mountainBlue}" opacity="0.9"/>
        <circle cx="0" cy="0" r="4" fill="${offWhite}" opacity="0.8"/>
        <rect x="-20" y="22" width="40" height="16" rx="3" fill="${espresso}" opacity="0.7"/>
      </g>
      <g id="milestone-era-2015" transform="translate(720, 278)">
        <circle cx="0" cy="0" r="18" fill="url(#tl-milestone-glow)"/>
        <circle cx="0" cy="0" r="8" fill="${sunsetCoral}" opacity="0.9"/>
        <circle cx="0" cy="0" r="4" fill="${offWhite}" opacity="0.8"/>
        <rect x="-20" y="22" width="40" height="16" rx="3" fill="${espresso}" opacity="0.7"/>
      </g>
      <g id="milestone-year-present" transform="translate(1020, 274)">
        <circle cx="0" cy="0" r="18" fill="url(#tl-milestone-glow)"/>
        <circle cx="0" cy="0" r="8" fill="${success}" opacity="0.9"/>
        <circle cx="0" cy="0" r="4" fill="${offWhite}" opacity="0.8"/>
        <rect x="-20" y="22" width="40" height="16" rx="3" fill="${espresso}" opacity="0.7"/>
      </g>
      <path d="M30 370 Q55 358 70 365 Q85 355 100 362" fill="none" stroke="${sunsetCoralLight}" stroke-width="1.3" opacity="0.35"/>
      <circle id="flower-tl-1" cx="45" cy="365" r="2.5" fill="${sunsetCoral}" opacity="0.45"/>
      <circle id="flower-tl-2" cx="80" cy="358" r="2" fill="${sunsetCoralLight}" opacity="0.4"/>
    </g>
  </g>
</svg>`;
}

/**
 * Initialize About page illustrations by injecting SVGs into $w containers.
 * @param {Function} $w - Wix selector function.
 */
export function initAboutIllustrations($w) {
  try {
    const teamContainer = $w('#teamPortraitContainer');
    if (teamContainer) {
      teamContainer.html = getTeamPortraitSvg();
    }
  } catch (e) {}
  try {
    const timelineContainer = $w('#timelineContainer');
    if (timelineContainer) {
      timelineContainer.html = getTimelineSvg();
    }
  } catch (e) {}
}
