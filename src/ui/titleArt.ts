// Original vector title illustration. Decorative: gameplay landmarks stay in WorldView.
export const titleArt = `<svg class="title-art" viewBox="0 0 1440 960" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="night" x2="0" y2="1"><stop stop-color="#101c30"/><stop offset=".58" stop-color="#355b70"/><stop offset="1" stop-color="#88a3aa"/></linearGradient>
    <linearGradient id="snow" x2=".3" y2="1"><stop stop-color="#b7cbd0"/><stop offset="1" stop-color="#345163"/></linearGradient>
    <linearGradient id="path" x2="0" y2="1"><stop stop-color="#ead49a" stop-opacity=".55"/><stop offset="1" stop-color="#d8e3df" stop-opacity="0"/></linearGradient>
    <radialGradient id="halo"><stop stop-color="#e8c78a" stop-opacity=".24"/><stop offset="1" stop-color="#e8c78a" stop-opacity="0"/></radialGradient>
    <linearGradient id="shade"><stop stop-color="#08121f"/><stop offset=".4" stop-color="#08121f" stop-opacity=".94"/><stop offset=".7" stop-color="#08121f" stop-opacity=".15"/><stop offset="1" stop-color="#08121f" stop-opacity="0"/></linearGradient>
    <g id="pine"><path d="M0 0 -18 39 -10 37 -29 66 -17 63 -37 96 37 96 17 63 29 66 10 37 18 39Z"/><path d="M0 5 -13 34 0 29 10 35Z" fill="#a9c3cc" opacity=".3"/></g>
  </defs>
  <path fill="url(#night)" d="M0 0H1440V960H0Z"/>
  ${Array.from({ length: 75 }, (_, i) => `<circle cx="${(i * 193 + 37) % 1440}" cy="${(i * 73 + 21) % 430}" r="${i % 6 === 0 ? 1.5 : .8}" fill="#e7ede5" opacity="${.25 + i % 4 * .15}"/>`).join('')}
  <circle cx="1090" cy="210" r="115" fill="url(#halo)"/><circle cx="1090" cy="210" r="28" fill="#e6e9d8"/>
  <path d="M410 555 650 310 781 464 933 358 1130 548 1280 378 1440 500V800H410Z" fill="#526f80"/>
  <path d="m650 310-84 111 80-41 55 31-18-49 98 102Z M933 358l-54 63 52-20 48 23Z M1280 378l-52 70 49-23 53 28Z" fill="#a4bcc6" opacity=".65"/>
  <path d="M400 600 600 490 760 563 1010 445 1210 587 1440 487V850H400Z" fill="#2c4b5c"/>
  <path d="M0 720Q430 560 690 660T1440 590V960H0Z" fill="url(#snow)"/>
  <path d="M730 960Q1100 786 1016 650L1064 650Q1250 823 1110 960Z" fill="url(#path)"/>
  <g fill="#1b3543"><use href="#pine" transform="translate(728 510) scale(1.4)"/><use href="#pine" transform="translate(663 548) scale(1.1)"/><use href="#pine" transform="translate(1310 470) scale(2.1)"/><use href="#pine" transform="translate(1402 536) scale(1.6)"/><use href="#pine" transform="translate(1235 546) scale(.9)"/></g>
  <ellipse cx="1035" cy="641" rx="130" ry="28" fill="#d3dcd1" opacity=".2"/>
  <circle cx="1038" cy="540" r="190" fill="url(#halo)"/>
  <path d="M987 653V469H1090V653" fill="#101f2b" stroke="#b69b69" stroke-width="9"/>
  <path d="M996 652V479H1081V652" fill="none" stroke="#f6db9c" stroke-width="2"/>
  <path d="M982 466H1095" stroke="#f1d8a3" stroke-width="5"/>
  <g fill="none" stroke="#ebd29a" stroke-width="2"><circle cx="1024" cy="555" r="22"/><circle cx="1053" cy="555" r="32"/></g>
  <g fill="#101e2a"><circle cx="940" cy="692" r="8"/><path d="m934 700-7 36 27 0-8-36Z"/><path d="m934 736-2 16m15-16 3 16" stroke="#101e2a" stroke-width="6"/><circle cx="977" cy="704" r="6"/><path d="m971 711-5 27h21l-5-27Z"/></g>
  <path d="M929 709 948 712" stroke="#bfa57d" stroke-width="4"/>
  <g fill="#dbe6e8" opacity=".55">${Array.from({ length: 32 }, (_, i) => `<circle cx="${(i * 137 + 630) % 1440}" cy="${440 + i * 57 % 480}" r="${i % 3 === 0 ? 2 : 1}"/>`).join('')}</g>
  <path fill="url(#shade)" d="M0 0H1440V960H0Z"/>
</svg>`;
