/** Original vector portraits, matching the winter models. Expressions only describe acknowledged dialogue. */
export type DialogueEmotion = 'neutral' | 'question' | 'surprise' | 'relief';
const EMOTIONS: Partial<Record<string, DialogueEmotion>> = {
  D000: 'relief', D001: 'relief', D002: 'relief',
  D003: 'surprise', D010: 'question', D011: 'surprise', D012: 'question', D013: 'question',
  D016: 'surprise', D017: 'surprise', D018: 'surprise', D020: 'question', D021: 'relief', D022: 'relief',
  D031: 'relief', D032: 'surprise', D033: 'question', D041: 'surprise', D042: 'question', D043: 'relief',
  D051: 'relief', D052: 'surprise', D053: 'question', D060: 'question', D061: 'question', D062: 'surprise',
  D070: 'surprise', D071: 'question', D072: 'relief', D073: 'relief',
  D080: 'relief', D081: 'relief', D082: 'surprise', D083: 'relief', D084: 'question', D085: 'relief', D086: 'relief', D087: 'relief',
};
export const dialogueEmotion = (id: string): DialogueEmotion => EMOTIONS[id] ?? 'neutral';

export function portrait(speaker: string, emotion: DialogueEmotion): string {
  const toto = speaker === 'トト';
  const hair = toto ? '#49392f' : '#523a31';
  const coat = toto ? '#57796b' : '#b96b4d';
  const brows = emotion === 'question' ? 'M32 40l9-3 M55 37l9 5'
    : emotion === 'surprise' ? 'M32 34q5-4 10-1 M55 33q5-3 10 1' : 'M32 39q5-3 10-1 M55 38q5-2 10 1';
  const eyes = emotion === 'relief'
    ? '<path d="M33 46q4-5 8 0 M56 46q4-5 8 0" fill="none" stroke="#342f2c" stroke-width="2.3" stroke-linecap="round"/>'
    : `<ellipse cx="37" cy="46" rx="2.6" ry="${emotion === 'surprise' ? 4.5 : 3.4}" fill="#342f2c"/><ellipse cx="60" cy="46" rx="2.6" ry="${emotion === 'surprise' ? 4.5 : 3.4}" fill="#342f2c"/><circle cx="37.7" cy="44.8" r=".7" fill="#fff5de"/><circle cx="60.7" cy="44.8" r=".7" fill="#fff5de"/>`;
  const mouth = emotion === 'surprise' ? '<ellipse cx="48" cy="61" rx="3.1" ry="4" fill="#956758"/>'
    : `<path d="${emotion === 'relief' ? 'M42 59q6 7 12 0' : emotion === 'question' ? 'M44 62q4-2 8 0' : 'M44 60q4 2 8 0'}" fill="none" stroke="#956758" stroke-width="1.8" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 112" aria-hidden="true" focusable="false" data-character="${toto ? 'toto' : 'player'}" data-emotion="${emotion}">
    <path d="M2 24Q2 4 22 4h52q20 0 20 20v86H2Z" fill="${toto ? '#243d3a' : '#43372f'}"/>
    <path d="M7 108q1-30 21-36h40q21 6 21 36" fill="${coat}"/>
    <path d="M16 107l7-25M80 107l-7-25" stroke="${toto ? '#36584c' : '#8d503e'}" stroke-width="2"/>
    ${toto ? '' : `<path d="M21 36q-2-26 27-26t27 26v39q-11 7-19-4H37q-12 13-16 2Z" fill="${hair}"/>`}
    <path d="M39 65v11q9 9 18 0V65" fill="#d7a281"/>
    <ellipse cx="25" cy="47" rx="5" ry="7" fill="#deb08b"/><ellipse cx="71" cy="47" rx="5" ry="7" fill="#deb08b"/>
    <path d="M25 32q1-19 23-19t23 19v17q-2 22-23 23T25 49Z" fill="#edc5a1"/>
    <path d="M27 51q2 18 21 20 18-2 22-19" fill="none" stroke="#d9a887" stroke-width="1.3"/>
    <ellipse cx="32" cy="55" rx="5" ry="2.7" fill="#d98f7c" opacity=".38"/><ellipse cx="65" cy="55" rx="5" ry="2.7" fill="#d98f7c" opacity=".38"/>
    <path d="M${toto ? '22 36 21 24 28 22 26 13 38 16 44 7 52 13 64 11 73 24 74 38 66 30 58 31 52 24 43 31 33 29Z' : '23 40Q17 14 42 11q27-3 32 24l-9 5-5-13-8 10-5-9-11 9-7-3-4 11Z'}" fill="${hair}"/>
    <path d="${toto ? 'M31 22l9 1 6-7 M54 19l9 2' : 'M29 25q6-11 16-10 M56 17q9 3 11 11'}" fill="none" stroke="#775344" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    ${toto ? '' : '<path d="M64 28l6 3m-1-5l-3 8" fill="none" stroke="#d9ad65" stroke-width="2.6" stroke-linecap="round"/>'}
    <path d="${brows}" fill="none" stroke="${hair}" stroke-width="2" stroke-linecap="round"/>
    ${eyes}<path d="M48 48l-2 6h4" fill="none" stroke="#cb9679" stroke-width="1.3" stroke-linejoin="round"/>${mouth}
    ${toto ? '<path d="M29 71q19 11 39 0l2 10q-22 12-43 0Z" fill="#ad5148"/><path d="M57 80l12-1-4 27-12-2Z" fill="#ad5148"/><path d="M60 85l-3 17M32 76q12 6 22 4" fill="none" stroke="#d37e66" stroke-width="2"/>' : '<path d="M30 72l18 7-9 12-14-11ZM66 72l-18 7 9 12 14-11Z" fill="#e6d3aa"/><path d="M48 82v28" stroke="#e6d3aa" stroke-width="1.4"/><circle cx="53" cy="97" r="1.6" fill="#d6b27d"/>'}
    <path d="M26 99h12M70 99H59" stroke="${toto ? '#36584c' : '#8d503e'}" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}
