/**
 * aboutIllustrations.js — About/Our Story page SVG illustrations.
 * Team Portrait scene + Blue Ridge Timeline.
 * Static SVG strings following Figma-first pipeline export pattern.
 * All hex colors verified against sharedTokens brand palette.
 * @module aboutIllustrations
 */

/**
 * Team Portrait SVG — team silhouettes against Blue Ridge mountain backdrop.
 * 7 overlapping soft rolling ridgelines with atmospheric haze,
 * golden hour sky, hand-drawn detail.
 * @returns {string} SVG markup
 */
export function getTeamPortraitSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 500" width="100%" height="100%" role="img" aria-labelledby="title-team-portrait">
  <title id="title-team-portrait">Team portrait illustration — Carolina Futons team silhouettes gathered before layered Blue Ridge mountains at golden hour</title>
  <defs>
    <linearGradient id="team-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#B8D4E3"/>
      <stop offset="12%" stop-color="#A8CCD8"/>
      <stop offset="28%" stop-color="#B8D4E3" stop-opacity="0.8"/>
      <stop offset="42%" stop-color="#F2E8D5"/>
      <stop offset="56%" stop-color="#F2A882"/>
      <stop offset="70%" stop-color="#F0C87A"/>
      <stop offset="82%" stop-color="#F2A882" stop-opacity="0.6"/>
      <stop offset="92%" stop-color="#E8D5B7"/>
      <stop offset="100%" stop-color="#FAF7F2"/>
    </linearGradient>
    <radialGradient id="team-sun-glow" cx="55%" cy="28%" r="45%">
      <stop offset="0%" stop-color="#F0C87A" stop-opacity="0.8"/>
      <stop offset="18%" stop-color="#F2A882" stop-opacity="0.55"/>
      <stop offset="40%" stop-color="#F2E8D5" stop-opacity="0.25"/>
      <stop offset="70%" stop-color="#A8CCD8" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#F2E8D5" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="team-haze-blue" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#A8CCD8" stop-opacity="0.08"/>
      <stop offset="50%" stop-color="#5B8FA8" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#A8CCD8" stop-opacity="0.35"/>
    </linearGradient>
    <linearGradient id="team-haze-warm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F2A882" stop-opacity="0"/>
      <stop offset="100%" stop-color="#F2E8D5" stop-opacity="0.3"/>
    </linearGradient>
    <linearGradient id="team-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E8D5B7"/>
      <stop offset="40%" stop-color="#D4BC96"/>
      <stop offset="75%" stop-color="#5C4033"/>
      <stop offset="100%" stop-color="#3A2518" stop-opacity="0.6"/>
    </linearGradient>
    <linearGradient id="team-ridge-far" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#A8CCD8"/>
      <stop offset="100%" stop-color="#B8D4E3" stop-opacity="0.5"/>
    </linearGradient>
    <linearGradient id="team-ridge-mid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5B8FA8"/>
      <stop offset="100%" stop-color="#3D6B80" stop-opacity="0.7"/>
    </linearGradient>
    <linearGradient id="team-ridge-near" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3D6B80"/>
      <stop offset="100%" stop-color="#5C4033" stop-opacity="0.5"/>
    </linearGradient>
  </defs>
  <g>
    <g id="background">
      <rect x="0" y="0" width="900" height="500" fill="url(#team-sky)"/>
      <rect x="0" y="0" width="900" height="500" fill="url(#team-sun-glow)"/>
      <ellipse cx="680" cy="55" rx="62" ry="22" fill="#FAF7F2" opacity="0.5"/>
      <ellipse cx="720" cy="48" rx="48" ry="16" fill="#F2E8D5" opacity="0.4"/>
      <ellipse cx="160" cy="80" rx="70" ry="22" fill="#FAF7F2" opacity="0.45"/>
      <ellipse cx="195" cy="72" rx="50" ry="16" fill="#FFFFFF" opacity="0.3"/>
      <ellipse cx="440" cy="42" rx="55" ry="18" fill="#FAF7F2" opacity="0.35"/>
      <path d="M760 42 Q768 33 776 40 Q784 30 792 37 Q796 28 806 36 Q800 44 792 41 Q785 47 778 42 Q770 48 762 44Z" fill="#FAF7F2" opacity="0.45"/>
      <line x1="250" y1="38" x2="259" y2="30" stroke="#3A2518" stroke-width="1.4" opacity="0.28"/>
      <line x1="259" y1="30" x2="268" y2="38" stroke="#3A2518" stroke-width="1.4" opacity="0.28"/>
      <line x1="275" y1="44" x2="283" y2="37" stroke="#3A2518" stroke-width="1.1" opacity="0.22"/>
      <line x1="283" y1="37" x2="291" y2="44" stroke="#3A2518" stroke-width="1.1" opacity="0.22"/>
      <line x1="570" y1="28" x2="577" y2="22" stroke="#3A2518" stroke-width="1.1" opacity="0.22"/>
      <line x1="577" y1="22" x2="584" y2="28" stroke="#3A2518" stroke-width="1.1" opacity="0.22"/>
      <line x1="420" y1="48" x2="426" y2="42" stroke="#3A2518" stroke-width="1" opacity="0.2"/>
      <line x1="426" y1="42" x2="432" y2="48" stroke="#3A2518" stroke-width="1" opacity="0.2"/>
      <line x1="340" y1="55" x2="345" y2="50" stroke="#3A2518" stroke-width="0.9" opacity="0.18"/>
      <line x1="345" y1="50" x2="350" y2="55" stroke="#3A2518" stroke-width="0.9" opacity="0.18"/>
      <line x1="810" y1="62" x2="815" y2="57" stroke="#3A2518" stroke-width="0.9" opacity="0.16"/>
      <line x1="815" y1="57" x2="820" y2="62" stroke="#3A2518" stroke-width="0.9" opacity="0.16"/>
    </g>
    <g id="midground">
      <path id="mountain-ridge-7" d="M0 228 Q18 220 38 222 Q58 212 82 218 Q108 205 138 212 Q168 200 202 208 Q238 195 278 205 Q318 192 358 202 Q398 190 442 200 Q482 188 525 198 Q568 185 612 195 Q658 182 702 192 Q748 180 792 190 Q838 178 878 188 Q892 182 900 185 L900 290 L0 290Z" fill="url(#team-ridge-far)" opacity="0.22"/>
      <rect x="0" y="225" width="900" height="45" fill="url(#team-haze-blue)" opacity="0.5"/>
      <path id="mountain-ridge-6" d="M0 248 Q25 235 55 240 Q85 225 120 234 Q155 218 195 228 Q235 212 280 224 Q325 208 370 220 Q418 205 465 218 Q512 202 560 215 Q608 200 655 212 Q702 198 750 210 Q798 195 842 208 Q872 198 900 205 L900 308 L0 308Z" fill="#A8CCD8" opacity="0.28"/>
      <rect x="0" y="248" width="900" height="40" fill="url(#team-haze-blue)" opacity="0.45"/>
      <rect x="0" y="255" width="900" height="30" fill="url(#team-haze-warm)" opacity="0.2"/>
      <path id="mountain-ridge-5" d="M0 268 Q30 250 68 258 Q108 238 152 250 Q198 232 248 245 Q298 228 348 242 Q398 225 452 238 Q505 222 558 235 Q612 218 668 232 Q722 215 778 228 Q832 212 878 225 Q895 218 900 222 L900 320 L0 320Z" fill="#5B8FA8" opacity="0.3"/>
      <rect x="0" y="268" width="900" height="35" fill="url(#team-haze-blue)" opacity="0.38"/>
      <path id="mountain-ridge-4" d="M0 288 Q35 268 78 278 Q122 258 172 270 Q222 252 278 265 Q332 248 390 260 Q448 242 508 258 Q568 240 628 255 Q688 238 748 252 Q808 235 862 248 Q888 240 900 245 L900 338 L0 338Z" fill="#5B8FA8" opacity="0.38"/>
      <rect x="0" y="288" width="900" height="30" fill="url(#team-haze-blue)" opacity="0.3"/>
      <path id="mountain-ridge-3" d="M0 305 Q40 288 88 296 Q138 275 195 288 Q252 270 315 282 Q378 265 445 278 Q512 260 580 275 Q648 258 718 272 Q788 255 852 268 Q880 260 900 265 L900 355 L0 355Z" fill="url(#team-ridge-mid)" opacity="0.42"/>
      <rect x="0" y="305" width="900" height="28" fill="url(#team-haze-blue)" opacity="0.22"/>
      <path id="mountain-ridge-2" d="M0 322 Q45 305 100 312 Q158 292 225 305 Q292 285 365 298 Q438 280 515 295 Q592 278 668 292 Q745 275 818 288 Q862 278 900 285 L900 370 L0 370Z" fill="url(#team-ridge-near)" opacity="0.48"/>
      <path id="tree-pine-1" d="M62 348 L68 328 L70 322 L72 318 L74 314 L77 318 L80 324 L82 330 L88 348Z" fill="#4A7C59" opacity="0.5"/>
      <path id="tree-pine-2" d="M145 342 L150 324 L152 318 L154 314 L156 310 L159 315 L162 322 L164 328 L170 342Z" fill="#4A7C59" opacity="0.42"/>
      <path id="tree-pine-3" d="M105 350 L110 334 L112 330 L115 334 L120 350Z" fill="#4A7C59" opacity="0.38"/>
      <path id="tree-pine-4" d="M780 340 L785 322 L787 316 L789 312 L792 316 L795 322 L800 340Z" fill="#4A7C59" opacity="0.48"/>
      <path id="tree-pine-5" d="M820 346 L825 330 L827 326 L830 330 L835 346Z" fill="#4A7C59" opacity="0.4"/>
      <path id="tree-pine-6" d="M852 344 L856 328 L858 324 L860 320 L863 324 L866 330 L870 344Z" fill="#4A7C59" opacity="0.36"/>
      <path id="tree-pine-7" d="M38 352 L42 340 L44 338 L47 340 L50 352Z" fill="#4A7C59" opacity="0.32"/>
      <path id="tree-pine-8" d="M755 345 L759 332 L761 330 L764 332 L768 345Z" fill="#4A7C59" opacity="0.34"/>
    </g>
    <g id="foreground">
      <path d="M0 368 Q60 355 140 360 Q230 348 340 355 Q460 342 570 352 Q690 340 800 350 Q860 344 900 348 L900 500 L0 500Z" fill="url(#team-ground)"/>
      <line x1="500" y1="140" x2="300" y2="360" stroke="#F0C87A" stroke-width="2" opacity="0.06"/>
      <line x1="500" y1="140" x2="500" y2="360" stroke="#F0C87A" stroke-width="1.5" opacity="0.05"/>
      <line x1="500" y1="140" x2="700" y2="360" stroke="#F0C87A" stroke-width="2" opacity="0.06"/>
      <g id="figure-person-1" transform="translate(230, 322)">
        <ellipse cx="0" cy="-62" rx="14" ry="16" fill="#3A2518" opacity="0.85"/>
        <path d="M-18 -45 Q-22 -15 -16 25 Q-12 32 0 34 Q12 32 16 25 Q22 -15 18 -45Z" fill="#5C4033" opacity="0.8"/>
        <line x1="-15" y1="-25" x2="-28" y2="8" stroke="#3A2518" stroke-width="3.5" stroke-linecap="round" opacity="0.75"/>
        <line x1="15" y1="-25" x2="28" y2="8" stroke="#3A2518" stroke-width="3.5" stroke-linecap="round" opacity="0.75"/>
        <line x1="-8" y1="34" x2="-12" y2="72" stroke="#3A2518" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
        <line x1="8" y1="34" x2="12" y2="72" stroke="#3A2518" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
      </g>
      <g id="figure-person-2" transform="translate(340, 315)">
        <ellipse cx="0" cy="-66" rx="15" ry="17" fill="#3A2518" opacity="0.85"/>
        <path d="M-19 -48 Q-23 -16 -17 28 Q-13 36 0 38 Q13 36 17 28 Q23 -16 19 -48Z" fill="#3D6B80" opacity="0.78"/>
        <line x1="-16" y1="-26" x2="-30" y2="10" stroke="#3A2518" stroke-width="3.5" stroke-linecap="round" opacity="0.75"/>
        <line x1="16" y1="-26" x2="22" y2="-8" stroke="#3A2518" stroke-width="3.5" stroke-linecap="round" opacity="0.75"/>
        <line x1="-9" y1="38" x2="-13" y2="78" stroke="#3A2518" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
        <line x1="9" y1="38" x2="13" y2="78" stroke="#3A2518" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
      </g>
      <g id="figure-person-3" transform="translate(450, 318)">
        <ellipse cx="0" cy="-64" rx="14" ry="16" fill="#3A2518" opacity="0.85"/>
        <path d="M-18 -47 Q-21 -14 -15 26 Q-11 34 0 36 Q11 34 15 26 Q21 -14 18 -47Z" fill="#E8845C" opacity="0.78"/>
        <line x1="-14" y1="-24" x2="-27" y2="8" stroke="#3A2518" stroke-width="3.5" stroke-linecap="round" opacity="0.75"/>
        <line x1="14" y1="-24" x2="27" y2="8" stroke="#3A2518" stroke-width="3.5" stroke-linecap="round" opacity="0.75"/>
        <line x1="-8" y1="36" x2="-11" y2="74" stroke="#3A2518" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
        <line x1="8" y1="36" x2="11" y2="74" stroke="#3A2518" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
      </g>
      <g id="figure-person-4" transform="translate(555, 316)">
        <ellipse cx="0" cy="-65" rx="14" ry="16" fill="#3A2518" opacity="0.85"/>
        <path d="M-18 -48 Q-21 -14 -15 27 Q-11 35 0 37 Q11 35 15 27 Q21 -14 18 -48Z" fill="#D4BC96" opacity="0.8"/>
        <line x1="-14" y1="-25" x2="-26" y2="6" stroke="#3A2518" stroke-width="3.5" stroke-linecap="round" opacity="0.75"/>
        <line x1="14" y1="-25" x2="26" y2="6" stroke="#3A2518" stroke-width="3.5" stroke-linecap="round" opacity="0.75"/>
        <line x1="-8" y1="37" x2="-12" y2="76" stroke="#3A2518" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
        <line x1="8" y1="37" x2="12" y2="76" stroke="#3A2518" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
      </g>
      <g id="figure-person-5" transform="translate(660, 322)">
        <ellipse cx="0" cy="-62" rx="14" ry="16" fill="#3A2518" opacity="0.85"/>
        <path d="M-18 -45 Q-21 -14 -15 25 Q-11 33 0 35 Q11 33 15 25 Q21 -14 18 -45Z" fill="#816D51" opacity="0.78"/>
        <line x1="-14" y1="-23" x2="-27" y2="7" stroke="#3A2518" stroke-width="3.5" stroke-linecap="round" opacity="0.75"/>
        <line x1="14" y1="-23" x2="24" y2="-2" stroke="#3A2518" stroke-width="3.5" stroke-linecap="round" opacity="0.75"/>
        <line x1="-8" y1="35" x2="-11" y2="72" stroke="#3A2518" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
        <line x1="8" y1="35" x2="11" y2="72" stroke="#3A2518" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
      </g>
      <path d="M85 458 Q110 442 135 450 Q155 436 178 445 Q198 432 220 442 Q238 430 258 440" fill="none" stroke="#F2A882" stroke-width="1.8" opacity="0.45"/>
      <circle cx="98" cy="452" r="4" fill="#E8845C" opacity="0.6"/>
      <circle cx="115" cy="448" r="3" fill="#F2A882" opacity="0.5"/>
      <circle cx="142" cy="444" r="3.5" fill="#E8845C" opacity="0.55"/>
      <circle cx="165" cy="440" r="2.8" fill="#F2A882" opacity="0.48"/>
      <circle cx="185" cy="438" r="3.5" fill="#E8845C" opacity="0.5"/>
      <circle cx="210" cy="436" r="3" fill="#F2A882" opacity="0.42"/>
      <circle cx="240" cy="434" r="2.5" fill="#E8845C" opacity="0.45"/>
      <path d="M680 452 Q705 442 728 448 Q748 435 770 444" fill="none" stroke="#F2A882" stroke-width="1.5" opacity="0.38"/>
      <circle cx="695" cy="446" r="2.5" fill="#E8845C" opacity="0.48"/>
      <circle cx="718" cy="442" r="3" fill="#F2A882" opacity="0.42"/>
      <circle cx="748" cy="438" r="2.8" fill="#E8845C" opacity="0.4"/>
      <path d="M380 475 Q382 465 384 475 Q386 462 388 475 Q390 468 392 475" fill="none" stroke="#4A7C59" stroke-width="1.2" opacity="0.3"/>
      <path d="M520 478 Q522 468 524 478 Q526 465 528 478" fill="none" stroke="#4A7C59" stroke-width="1" opacity="0.25"/>
    </g>
  </g>
</svg>`;
}

/**
 * Blue Ridge Timeline SVG — milestones across a mountain landscape.
 * 6 overlapping ridgelines with atmospheric haze, milestone markers
 * along a winding trail path, vertical dawn-to-dusk sky gradient.
 * @returns {string} SVG markup
 */
export function getTimelineSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="100%" height="100%" role="img" aria-labelledby="title-timeline">
  <title id="title-timeline">Blue Ridge timeline illustration — Carolina Futons company milestones winding through layered mountain scenery from 1991 to present</title>
  <defs>
    <linearGradient id="tl-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#B8D4E3"/>
      <stop offset="14%" stop-color="#A8CCD8"/>
      <stop offset="28%" stop-color="#B8D4E3" stop-opacity="0.75"/>
      <stop offset="42%" stop-color="#F2E8D5"/>
      <stop offset="56%" stop-color="#F2A882"/>
      <stop offset="70%" stop-color="#F0C87A"/>
      <stop offset="84%" stop-color="#E8D5B7"/>
      <stop offset="100%" stop-color="#FAF7F2"/>
    </linearGradient>
    <linearGradient id="tl-haze-blue" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#A8CCD8" stop-opacity="0.06"/>
      <stop offset="50%" stop-color="#5B8FA8" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#A8CCD8" stop-opacity="0.4"/>
    </linearGradient>
    <linearGradient id="tl-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E8D5B7"/>
      <stop offset="50%" stop-color="#D4BC96"/>
      <stop offset="85%" stop-color="#5C4033"/>
      <stop offset="100%" stop-color="#3A2518" stop-opacity="0.5"/>
    </linearGradient>
    <radialGradient id="tl-milestone-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#E8845C" stop-opacity="0.55"/>
      <stop offset="45%" stop-color="#F2A882" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#E8845C" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="tl-sun-warmth" cx="80%" cy="25%" r="40%">
      <stop offset="0%" stop-color="#F0C87A" stop-opacity="0.5"/>
      <stop offset="50%" stop-color="#F2A882" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#F2E8D5" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="tl-ridge-far" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#A8CCD8"/>
      <stop offset="100%" stop-color="#B8D4E3" stop-opacity="0.4"/>
    </linearGradient>
    <linearGradient id="tl-ridge-mid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5B8FA8"/>
      <stop offset="100%" stop-color="#3D6B80" stop-opacity="0.65"/>
    </linearGradient>
  </defs>
  <g>
    <g id="background">
      <rect x="0" y="0" width="1200" height="400" fill="url(#tl-sky)"/>
      <rect x="0" y="0" width="1200" height="400" fill="url(#tl-sun-warmth)"/>
      <ellipse cx="140" cy="35" rx="55" ry="20" fill="#FAF7F2" opacity="0.5"/>
      <ellipse cx="175" cy="28" rx="40" ry="14" fill="#F2E8D5" opacity="0.38"/>
      <ellipse cx="480" cy="25" rx="62" ry="22" fill="#FAF7F2" opacity="0.44"/>
      <ellipse cx="520" cy="20" rx="45" ry="15" fill="#FFFFFF" opacity="0.3"/>
      <ellipse cx="880" cy="38" rx="58" ry="19" fill="#FAF7F2" opacity="0.42"/>
      <ellipse cx="1060" cy="30" rx="48" ry="16" fill="#FAF7F2" opacity="0.35"/>
      <path d="M1020 22 Q1028 14 1036 20 Q1044 10 1052 17 Q1056 8 1066 16 Q1060 24 1052 21 Q1045 27 1038 22 Q1030 28 1022 24Z" fill="#FAF7F2" opacity="0.42"/>
      <line x1="290" y1="20" x2="298" y2="12" stroke="#3A2518" stroke-width="1.2" opacity="0.24"/>
      <line x1="298" y1="12" x2="306" y2="20" stroke="#3A2518" stroke-width="1.2" opacity="0.24"/>
      <line x1="316" y1="26" x2="323" y2="19" stroke="#3A2518" stroke-width="1" opacity="0.2"/>
      <line x1="323" y1="19" x2="330" y2="26" stroke="#3A2518" stroke-width="1" opacity="0.2"/>
      <line x1="680" y1="16" x2="687" y2="10" stroke="#3A2518" stroke-width="1.1" opacity="0.22"/>
      <line x1="687" y1="10" x2="694" y2="16" stroke="#3A2518" stroke-width="1.1" opacity="0.22"/>
      <line x1="1040" y1="46" x2="1046" y2="40" stroke="#3A2518" stroke-width="1.1" opacity="0.22"/>
      <line x1="1046" y1="40" x2="1052" y2="46" stroke="#3A2518" stroke-width="1.1" opacity="0.22"/>
      <line x1="390" y1="30" x2="395" y2="25" stroke="#3A2518" stroke-width="0.9" opacity="0.18"/>
      <line x1="395" y1="25" x2="400" y2="30" stroke="#3A2518" stroke-width="0.9" opacity="0.18"/>
    </g>
    <g id="midground">
      <path id="mountain-ridge-far" d="M0 155 Q30 140 65 145 Q100 130 140 138 Q180 122 225 132 Q270 118 320 128 Q365 115 415 125 Q460 112 510 122 Q560 108 610 120 Q660 106 710 118 Q760 104 810 115 Q860 102 910 112 Q960 100 1010 110 Q1060 98 1110 108 Q1160 100 1200 105 L1200 210 L0 210Z" fill="url(#tl-ridge-far)" opacity="0.2"/>
      <rect x="0" y="152" width="1200" height="42" fill="url(#tl-haze-blue)" opacity="0.5"/>
      <path id="mountain-ridge-5" d="M0 172 Q35 155 78 162 Q122 145 172 155 Q222 138 278 148 Q332 132 388 145 Q442 128 500 140 Q558 125 618 138 Q678 122 738 135 Q798 118 858 132 Q918 115 978 128 Q1038 112 1098 125 Q1155 115 1200 120 L1200 228 L0 228Z" fill="#A8CCD8" opacity="0.28"/>
      <rect x="0" y="170" width="1200" height="38" fill="url(#tl-haze-blue)" opacity="0.42"/>
      <path id="mountain-ridge-4" d="M0 192 Q42 172 92 182 Q142 162 198 175 Q255 155 318 168 Q378 150 442 165 Q505 148 570 162 Q635 145 700 160 Q765 142 832 158 Q898 140 962 155 Q1028 138 1092 152 Q1150 142 1200 148 L1200 245 L0 245Z" fill="#5B8FA8" opacity="0.32"/>
      <rect x="0" y="190" width="1200" height="35" fill="url(#tl-haze-blue)" opacity="0.35"/>
      <path id="mountain-ridge-3" d="M0 212 Q48 192 105 202 Q162 182 228 195 Q295 175 365 190 Q435 172 508 188 Q580 168 655 185 Q728 165 802 180 Q878 162 952 178 Q1025 160 1098 175 Q1155 165 1200 170 L1200 260 L0 260Z" fill="url(#tl-ridge-mid)" opacity="0.38"/>
      <rect x="0" y="210" width="1200" height="30" fill="url(#tl-haze-blue)" opacity="0.28"/>
      <path id="mountain-ridge-2" d="M0 232 Q55 215 120 222 Q188 202 262 215 Q335 198 412 210 Q488 195 568 208 Q648 192 728 205 Q808 188 888 202 Q968 185 1048 198 Q1128 185 1200 192 L1200 275 L0 275Z" fill="#3D6B80" opacity="0.45"/>
      <path id="mountain-ridge-near" d="M0 248 Q62 235 132 240 Q205 225 285 235 Q365 220 448 232 Q532 218 618 228 Q702 215 788 225 Q872 212 955 222 Q1038 210 1120 218 Q1165 212 1200 215 L1200 280 L0 280Z" fill="#3D6B80" opacity="0.5"/>
      <path id="bird-flock-1" d="M175 68 L184 58 L193 68" fill="none" stroke="#3A2518" stroke-width="1.4" opacity="0.28"/>
      <path id="bird-flock-2" d="M198 75 L206 66 L214 75" fill="none" stroke="#3A2518" stroke-width="1.1" opacity="0.22"/>
      <path id="bird-flock-3" d="M840 58 L848 50 L856 58" fill="none" stroke="#3A2518" stroke-width="1.2" opacity="0.25"/>
      <path id="bird-flock-4" d="M858 65 L865 58 L872 65" fill="none" stroke="#3A2518" stroke-width="0.9" opacity="0.2"/>
      <path id="bird-flock-5" d="M555 48 L562 42 L569 48" fill="none" stroke="#3A2518" stroke-width="1" opacity="0.2"/>
      <path id="tree-timeline-1" d="M38 262 L44 240 L46 234 L48 230 L50 226 L53 230 L56 236 L58 242 L64 262Z" fill="#4A7C59" opacity="0.5"/>
      <path id="tree-timeline-2" d="M320 255 L325 235 L327 229 L329 225 L332 229 L335 236 L340 255Z" fill="#4A7C59" opacity="0.42"/>
      <path id="tree-timeline-3" d="M715 250 L720 230 L722 224 L724 220 L727 224 L730 232 L735 250Z" fill="#4A7C59" opacity="0.45"/>
      <path id="tree-timeline-4" d="M1080 258 L1085 238 L1087 232 L1089 228 L1092 232 L1095 240 L1100 258Z" fill="#4A7C59" opacity="0.38"/>
      <path id="tree-timeline-5" d="M80 268 L84 252 L86 250 L89 252 L94 268Z" fill="#4A7C59" opacity="0.35"/>
      <path id="tree-timeline-6" d="M1140 254 L1144 238 L1146 236 L1149 238 L1154 254Z" fill="#4A7C59" opacity="0.32"/>
      <path id="tree-timeline-7" d="M180 260 L184 244 L186 242 L189 244 L193 260Z" fill="#4A7C59" opacity="0.3"/>
      <path id="tree-timeline-8" d="M555 252 L559 236 L561 234 L564 236 L568 252Z" fill="#4A7C59" opacity="0.36"/>
    </g>
    <g id="foreground">
      <path d="M0 272 Q80 260 180 265 Q300 252 440 260 Q580 248 720 258 Q860 245 1000 255 Q1110 248 1200 252 L1200 400 L0 400Z" fill="url(#tl-ground)"/>
      <path d="M40 300 Q100 290 170 296 Q260 284 350 292 Q450 278 550 288 Q650 275 750 285 Q850 272 950 282 Q1040 270 1140 278" fill="none" stroke="#3A2518" stroke-width="3.5" stroke-dasharray="12,8" opacity="0.45"/>
      <path d="M45 306 Q105 296 175 302 Q265 290 355 298 Q455 284 555 294 Q655 281 755 291 Q855 278 955 288 Q1045 276 1145 284" fill="none" stroke="#5C4033" stroke-width="1.5" stroke-dasharray="6,10" opacity="0.25"/>
      <g id="milestone-era-1991" transform="translate(120, 290)">
        <circle cx="0" cy="0" r="24" fill="url(#tl-milestone-glow)"/>
        <circle cx="0" cy="0" r="12" fill="#E8845C" opacity="0.9"/>
        <circle cx="0" cy="0" r="5" fill="#FAF7F2" opacity="0.88"/>
        <rect x="-24" y="26" width="48" height="20" rx="5" fill="#3A2518" opacity="0.78"/>
        <line x1="0" y1="-24" x2="0" y2="-40" stroke="#E8845C" stroke-width="1.5" opacity="0.35"/>
      </g>
      <g id="milestone-era-2005" transform="translate(420, 280)">
        <circle cx="0" cy="0" r="24" fill="url(#tl-milestone-glow)"/>
        <circle cx="0" cy="0" r="12" fill="#5B8FA8" opacity="0.9"/>
        <circle cx="0" cy="0" r="5" fill="#FAF7F2" opacity="0.88"/>
        <rect x="-24" y="26" width="48" height="20" rx="5" fill="#3A2518" opacity="0.78"/>
        <line x1="0" y1="-24" x2="0" y2="-40" stroke="#5B8FA8" stroke-width="1.5" opacity="0.35"/>
      </g>
      <g id="milestone-era-2015" transform="translate(720, 275)">
        <circle cx="0" cy="0" r="24" fill="url(#tl-milestone-glow)"/>
        <circle cx="0" cy="0" r="12" fill="#E8845C" opacity="0.9"/>
        <circle cx="0" cy="0" r="5" fill="#FAF7F2" opacity="0.88"/>
        <rect x="-24" y="26" width="48" height="20" rx="5" fill="#3A2518" opacity="0.78"/>
        <line x1="0" y1="-24" x2="0" y2="-40" stroke="#E8845C" stroke-width="1.5" opacity="0.35"/>
      </g>
      <g id="milestone-year-present" transform="translate(1020, 272)">
        <circle cx="0" cy="0" r="24" fill="url(#tl-milestone-glow)"/>
        <circle cx="0" cy="0" r="12" fill="#4A7C59" opacity="0.9"/>
        <circle cx="0" cy="0" r="5" fill="#FAF7F2" opacity="0.88"/>
        <rect x="-24" y="26" width="48" height="20" rx="5" fill="#3A2518" opacity="0.78"/>
        <line x1="0" y1="-24" x2="0" y2="-40" stroke="#4A7C59" stroke-width="1.5" opacity="0.35"/>
      </g>
      <path d="M20 365 Q45 352 68 360 Q88 348 112 356 Q132 344 155 354" fill="none" stroke="#F2A882" stroke-width="1.6" opacity="0.42"/>
      <circle id="flower-tl-1" cx="35" cy="358" r="3.5" fill="#E8845C" opacity="0.55"/>
      <circle id="flower-tl-2" cx="55" cy="355" r="2.8" fill="#F2A882" opacity="0.48"/>
      <circle id="flower-tl-3" cx="78" cy="352" r="3" fill="#E8845C" opacity="0.5"/>
      <circle id="flower-tl-4" cx="100" cy="350" r="2.5" fill="#F2A882" opacity="0.42"/>
      <circle id="flower-tl-5" cx="125" cy="348" r="3" fill="#E8845C" opacity="0.45"/>
      <circle id="flower-tl-6" cx="145" cy="350" r="2.5" fill="#F2A882" opacity="0.4"/>
      <path d="M1040 360 Q1062 350 1082 358" fill="none" stroke="#F2A882" stroke-width="1.3" opacity="0.35"/>
      <circle id="flower-tl-7" cx="1055" cy="355" r="2.5" fill="#E8845C" opacity="0.42"/>
      <circle id="flower-tl-8" cx="1075" cy="352" r="3" fill="#F2A882" opacity="0.38"/>
      <path d="M280 380 Q282 370 284 380 Q286 367 288 380 Q290 372 292 380" fill="none" stroke="#4A7C59" stroke-width="1.2" opacity="0.28"/>
      <path d="M600 375 Q602 365 604 375 Q606 362 608 375" fill="none" stroke="#4A7C59" stroke-width="1" opacity="0.22"/>
      <path d="M900 378 Q902 368 904 378 Q906 365 908 378" fill="none" stroke="#4A7C59" stroke-width="1.1" opacity="0.25"/>
    </g>
  </g>
</svg>`;
}

/**
 * Initialize About page illustrations by injecting SVGs into $w containers.
 * @param {Function} $w - Wix selector function.
 * @returns {void}
 */
export function initAboutIllustrations($w) {
  try {
    const teamContainer = $w('#teamPortraitContainer');
    if (teamContainer) {
      teamContainer.html = getTeamPortraitSvg();
    }
  } catch (e) {
    console.error('[aboutIllustrations] Failed to inject team portrait:', e);
  }
  try {
    const timelineContainer = $w('#timelineContainer');
    if (timelineContainer) {
      timelineContainer.html = getTimelineSvg();
    }
  } catch (e) {
    console.error('[aboutIllustrations] Failed to inject timeline:', e);
  }
}
