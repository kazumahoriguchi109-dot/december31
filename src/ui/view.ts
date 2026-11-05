import { Game, type Action } from '../app/game';
import { currentObjective } from '../domain/objectives';
import { WorldView } from '../render/world';
import { copy, puzzles } from '../content/load';
import { dialogueEmotion, portrait } from './portraits';

const VIEW_NAMES: Record<string, string> = {
  front: '正面', wall_side: '側面', observe: '観測点', apparatus_side: '装置の側面', portal_front: '枠の表', portal_back: '枠の裏',
};
const PLACE_NAMES: Record<string, string> = {
  room: '部屋', arrival: '入口', p01_panel: '光る石の前', mill: '水車', gate_near: '門の手前', gate_far: '門の向こう',
  wall_base: '白い壁の前', wall_top: '白い壁の上', observatory: '観測台', castle: '城の前',
  portal_front: '枠の表', portal_back: '枠の裏', home: '部屋',
};
const GROUP_TITLES: Record<string, string> = { view: '見る向き', puzzle: '仕掛けを動かす', move: '移動', misc: 'そのほか' };

const el = <T extends HTMLElement>(sel: string, root: ParentNode = document): T => {
  const n = root.querySelector(sel);
  if (!n) throw new Error(`missing element ${sel}`);
  return n as T;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

import { Mixer } from '../audio/mixer';
export const mixer = new Mixer();
export interface UiOptions { era: () => string; presetOverride: () => string | null; p05Override: () => { a: number; b: number } | null; onPause?: () => void }

export function mountUi(root: HTMLElement, game: Game, opts: UiOptions) {
  root.innerHTML = `
  <div class="shell">
    <header class="hud">
      <div class="objective"><span class="tag">目的</span><span id="obj-text"></span></div>
      <div class="where"><span id="place"></span> / <span id="viewname" tabindex="-1"></span></div>
      <div class="hudright"><span id="savestate" class="savestate" role="status" aria-live="polite"></span>${opts.onPause ? '<button type="button" class="btn small" id="pausebtn">ひと休み</button>' : ''}</div>
    </header>
    <main class="main">
      <section class="stage-col">
        <div class="stage" id="stage">
          <canvas id="world" aria-hidden="true"></canvas>
          <svg id="etching" class="etching" viewBox="-0.75 -0.75 1.5 1.5" aria-hidden="true" hidden>
            <circle cx="0" cy="0" r="${puzzles.p05Projection.targetRadius}" fill="none" stroke="#F0EEE5" stroke-opacity=".28" stroke-width=".008" stroke-dasharray=".03 .02" />
          </svg>
          <div id="hotspots" class="hotspots"></div>
          <div id="fade" class="fade"></div>
          <svg id="cue" class="cue" viewBox="-1 -0.5625 2 1.125" aria-hidden="true" data-cue="" hidden></svg>
          <div id="stagemsg" class="stagemsg" hidden></div>
        </div>
        <section id="dlg" class="dlg" aria-labelledby="dlg-speaker" hidden>
          <div id="dlg-portrait" class="dlg-portrait" aria-hidden="true"></div>
          <h2 id="dlg-speaker" class="dlg-speaker"></h2>
          <p id="dlg-text" class="dlg-text" aria-hidden="true"></p>
          <p id="dlg-sr" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>
          <div class="btnrow" id="dlg-actions"></div>
        </section>
        <p id="status" class="status" role="status" aria-live="polite"></p>
      </section>
      <aside class="panel" aria-label="操作パネル">
        <h2 id="targets-h">調べられる場所</h2>
        <ul id="targets" class="targets" aria-labelledby="targets-h"></ul>
        <div id="readout" class="readout" role="status" aria-live="polite"></div>
        <div id="controls"></div>
      </aside>
    </main>
    <dialog id="practice" class="modal" aria-labelledby="practice-h">
      <h2 id="practice-h">標柱で試す</h2>
      <p class="hint-line">標柱は、見る向きの練習用です。</p>
      <div class="post-art" id="post-art"></div>
      <div class="btnrow" id="practice-actions"></div>
    </dialog>
    <dialog id="confirm" class="modal" aria-labelledby="confirm-h">
      <h2 id="confirm-h">やり直しの確認</h2>
      <p id="confirm-text"></p>
      <div class="btnrow" id="confirm-actions"></div>
    </dialog>
    <dialog id="hint" class="modal" aria-labelledby="hint-h">
      <h2 id="hint-h">ヒント</h2>
      <div id="hint-body"></div>
      <div class="btnrow" id="hint-actions"></div>
    </dialog>
    <div id="dev" class="dev" hidden></div>
  </div>`;

  const stage = el<HTMLDivElement>('#stage');
  const canvas = el<HTMLCanvasElement>('#world');
  const view = new WorldView(canvas);
  let lastFocusId: string | null = null;
  let lastReadout = '';
  let modalOpen = false;
  let modalTrigger: string | null = null; // the control that was focused when a modal opened; focus returns there on close
  let lastViewName = '';
  // presentation hold: shows the just-closed ring from the observe camera before the committed castle view takes over.
  // render-only; authoritative state has already moved on.
  let hold: { until: number; anchor: 'observatory' } | null = null;

  // ---------- keyboard / pointer: one path for every input ----------
  const idOf = (t: EventTarget | null): string | null => (t as HTMLElement | null)?.closest<HTMLElement>('[data-action-id]')?.dataset['actionId'] ?? null;
  for (const t of ['pointerdown', 'keydown'] as const) document.addEventListener(t, () => mixer.unlock(), { capture: true });
  document.addEventListener('click', (e) => {
    const id = idOf(e.target);
    if (!id) return;
    const t = e.target as HTMLElement;
    lastFocusId = id;
    // pointer clicks have detail>=1; keyboard-activated clicks have detail 0
    game.perform(id, (e as MouseEvent).detail === 0 ? 'keyboard' : 'mouse');
    void t;
  });
  // holding Enter/Space must not repeat the action: swallow auto-repeat before it becomes another click
  document.addEventListener('keydown', (e) => {
    if (e.repeat && (e.key === 'Enter' || e.key === ' ') && idOf(e.target)) { e.preventDefault(); return; }
    if (e.key === 'Escape' && opts.onPause && !document.querySelector('dialog[open]') && !game.dialogueActive && playVisible()) { e.preventDefault(); game.settle(); opts.onPause(); return; }
    if (e.ctrlKey || e.altKey || e.metaKey) return; // browser and screen-reader shortcuts are not ours
    if ((e.key === 'h' || e.key === 'H') && !e.repeat && !isTyping(e.target) && !document.querySelector('dialog[open]') && !game.dialogueActive && playVisible()) {
      game.perform('hint_open', 'keyboard'); return;
    }
    if (e.key === 'q' || e.key === 'Q') {
      if (isTyping(e.target) || document.querySelector('dialog[open]') || !playVisible()) return;
      game.highlight(2000);
      return;
    }
    const grp = (e.target as HTMLElement).closest<HTMLElement>('[data-roving]');
    if (grp && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const btns = [...grp.querySelectorAll<HTMLButtonElement>('button')];
      const i = btns.indexOf(e.target as HTMLButtonElement);
      if (i >= 0) {
        e.preventDefault();
        btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length]!.focus(); // focus only; Enter/Space selects
      }
    }
  });
  const playVisible = () => stage.getBoundingClientRect().width > 0;
  root.querySelector('#pausebtn')?.addEventListener("click", () => { game.settle(); opts.onPause?.(); });
  const isTyping = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
  // Esc closes the topmost modal through the game so runtime state and the DOM never disagree
  for (const id of ['practice', 'confirm', 'hint']) {
    el<HTMLDialogElement>(`#${id}`).addEventListener('cancel', (e) => {
      e.preventDefault();
      if (id === 'practice') game.closePractice(); else if (id === 'hint') game.closeHint(); else game.cancelReset();
    });
  }
  // an empty click on the stage changes nothing but points at the list
  stage.addEventListener('click', (e) => {
    if (e.target === stage || e.target === canvas) game.setStatus('調べられる場所は、右の一覧からも選べます。');
  });

  // ---------- rendering ----------
  const btn = (a: Action, extra = '') =>
    `<button type="button" class="btn ${a.pressed ? 'on' : ''} ${extra}" data-action-id="${a.id}" ${a.enabled ? '' : 'aria-disabled="true"'} ${a.pressed !== undefined ? `aria-pressed="${a.pressed}"` : ''} ${!a.enabled && a.reason ? `aria-describedby="why-${a.id}"` : ''}>${esc(a.label)}</button>${!a.enabled && a.reason ? `<span class="why" id="why-${a.id}">${esc(a.reason)}</span>` : ''}`;

  function renderPanel() {
    const acts = game.actions().filter((a) => a.id !== 'practice_side' && a.id !== 'practice_front' && a.id !== 'practice_close' && a.id !== 'confirm_no' && a.id !== 'confirm_yes' && (!a.id.startsWith('hint_') || a.id === 'hint_open') && !a.id.startsWith('confirm_return_'));
    // target list = every hotspot object, plus movement destinations; same actionIds as the canvas
    const objs = acts.filter((a) => (a.world || a.group === 'move') && !(a.id === 'p05_object' && game.state.player.view === 'observe'));
    el('#targets').innerHTML = objs.map((a) => `<li>${btn(a)}</li>`).join('');
    const groups: Record<string, Action[]> = {};
    for (const a of acts) if (a.group !== 'object' && a.group !== 'move' && !a.world) (groups[a.group] ??= []).push(a); // world objects are already in the target list
    const s = game.state.puzzles.p05;
    let html = '';
    for (const g of ['view', 'puzzle', 'misc']) {
      const list = groups[g];
      if (!list?.length) continue;
      if (g === 'puzzle' && list.some((a) => a.id.startsWith('p05_'))) {
        for (const piece of ['a', 'b'] as const) {
          const stops = list.filter((a) => a.id.startsWith(`p05_${piece}`));
          const cur = ['手前', '中央', '奥'][s[piece]]!;
          html += `<section class="group" aria-labelledby="g-${piece}"><h3 id="g-${piece}">板${piece.toUpperCase()}（${piece === 'a' ? '左下' : '右下'}の欠けた輪）<span class="cur">いま：${cur}</span></h3><div class="btnrow" data-roving>${stops.map((a) => btn(a)).join('')}</div></section>`;
        }
      } else {
        html += `<section class="group" aria-labelledby="g-${g}"><h3 id="g-${g}">${GROUP_TITLES[g]}</h3><div class="btnrow" ${g === 'view' ? 'data-roving' : ''}>${list.map((a) => btn(a)).join('')}</div></section>`;
      }
    }
    el('#controls').innerHTML = html;
    const lines = game.readout();
    const readoutHtml = lines.length ? `<h3>いまの様子</h3><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '';
    if (readoutHtml !== lastReadout) { lastReadout = readoutHtml; el('#readout').innerHTML = readoutHtml; } // a live region is rewritten only when its text changes
  }

  function renderHotspots() {
    const hl = game.now() < game.rt.highlightUntil;
    const acts = game.actions().filter((a) => a.world);
    const focused = document.activeElement instanceof HTMLElement && el('#hotspots').contains(document.activeElement) ? document.activeElement.dataset['actionId'] : undefined;
    el('#hotspots').innerHTML = acts.map((a) => {
      const p = view.project(a.world!);
      const outside = p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1;
      if (outside) return '';
      return `<button type="button" class="hot ${hl ? 'hl' : ''}" style="left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%" data-action-id="${a.id}" aria-label="${esc(a.label)}" ${a.enabled ? '' : 'aria-disabled="true"'}><span class="hot-label">${esc(a.label)}</span></button>`;
    }).join('');
    if (focused) el('#hotspots').querySelector<HTMLElement>(`[data-action-id="${focused}"]`)?.focus(); // rebuilding must not drop keyboard focus
  }

  // Typewriter: textContent always holds the whole line (tests, find-in-page); unrevealed characters are visibility:hidden.
  let typeTimer = 0;
  function typeLine(node: HTMLElement, text: string) {
    clearInterval(typeTimer);
    const per = game.reducedMotion || game.textSpeed === 'instant' ? 0 : game.textSpeed === 'slow' ? 90 : 35;
    if (!per) { node.textContent = text; return; }
    node.textContent = '';
    const chars = [...text].map((c) => { const sp = document.createElement('span'); sp.textContent = c; sp.style.visibility = 'hidden'; node.append(sp); return sp; });
    let i = 0;
    typeTimer = window.setInterval(() => { if (i >= chars.length) { clearInterval(typeTimer); return; } chars[i++]!.style.visibility = ''; }, per);
  }

  // Evolution cues (docs/STORY.md): non-authoritative overlay on the committed state. Never replayed on load.
  const CUE_FOR: Record<string, string> = { p01_solved: 'CUE_EVOLVE_P01', p03_solved: 'CUE_EVOLVE_P03', p05_solved: 'CUE_EVOLVE_P05', p06_solved: 'CUE_RETURN_OPEN', ending: 'CUE_HOME_STABLE' };
  let cueFrame = 0;
  function playCue(name: string) {
    mixer.play('cue');
    cancelAnimationFrame(cueFrame);
    const svg = document.querySelector('#cue') as unknown as SVGSVGElement;
    const dur = game.reducedMotion ? 150 : 1200;
    const ring = (r: number) => `<circle cx="0" cy="0" r="${r}" fill="none" stroke="#FFD166" stroke-width="2"/>`;
    svg.innerHTML = `<g class="cue-a">${ring(12)}</g><g class="cue-b">${ring(12)}${ring(18)}</g><g class="cue-c" opacity="0">${ring(10)}${ring(18)}</g>`;
    svg.dataset['cue'] = name; svg.dataset['last'] = name; svg.dataset['dur'] = String(dur);
    svg.removeAttribute('hidden');
    const started = performance.now();
    const destination: Record<string, [number, number, number]> = {
      CUE_ENTRY: [0, 1.5, 0], CUE_EVOLVE_P01: [0, .3, 5],
      CUE_EVOLVE_P03: [10, 1.3, 12], CUE_RETURN_OPEN: [0, 1.5, 0], CUE_HOME_STABLE: [1.2, 2.3, 5.33],
    };
    const draw = (now: number) => {
      if (!svg.isConnected || now - started >= dur) { svg.setAttribute('hidden', ''); svg.dataset['cue'] = ''; cueFrame = 0; return; }
      const rect = stage.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
      // Projection is sampled after rendering and on every cue frame: resizing, camera and actor offsets stay aligned.
      const feet = view.projectedFeet() ?? [{ x: .325, y: .66 }, { x: .675, y: .66 }];
      const target = destination[name] ? view.project(destination[name]!) : { x: .5, y: .5 };
      const progress = Math.min(1, (now - started) / (dur * .5));
      // Briefly hold at the feet before the two lights travel to the apparatus.
      const travel = Math.max(0, (progress - .22) / .78);
      feet.forEach((foot, i) => {
        const node = svg.querySelector(i ? '.cue-b' : '.cue-a')!;
        node.setAttribute('transform', `translate(${(foot.x + (target.x - foot.x) * travel) * rect.width} ${(foot.y + (target.y - foot.y) * travel) * rect.height})`);
        node.setAttribute('opacity', game.reducedMotion || name === 'CUE_HOME_STABLE' ? '0' : String(1 - travel));
      });
      const centre = svg.querySelector('.cue-c')!;
      centre.setAttribute('transform', `translate(${target.x * rect.width} ${target.y * rect.height})`);
      centre.setAttribute('opacity', game.reducedMotion || name === 'CUE_HOME_STABLE' ? '1' : String(progress < .8 ? 0 : Math.min(1, (progress - .8) * 5) * Math.min(1, (1 - (now - started) / dur) * 5)));
      cueFrame = requestAnimationFrame(draw);
    };
    draw(started);
  }

  let dlgShownId: string | null = null;
  function renderDialogue() {
    const box = el<HTMLElement>('#dlg');
    const line = game.currentLine();
    const holding = hold !== null && game.now() < hold.until;
    const show = line !== null && !holding;
    box.toggleAttribute('hidden', !show);
    el('#hotspots').toggleAttribute('hidden', line !== null);
    el('#controls').toggleAttribute('hidden', line !== null);
    el('#targets').toggleAttribute('hidden', line !== null);
    el('#readout').toggleAttribute('hidden', line !== null);
    if (!show || !line) { dlgShownId = null; el('#dlg-actions').innerHTML = ''; return; } // no stale buttons behind a hidden box
    el('#dlg-speaker').textContent = line.speaker;
    if (dlgShownId !== line.id) {
      el('#dlg-portrait').innerHTML = portrait(line.speaker, dialogueEmotion(line.id));
      box.dataset['speaker'] = line.speaker === 'トト' ? 'toto' : 'player';
      typeLine(el('#dlg-text'), line.text); el('#dlg-sr').textContent = `${line.speaker}。${line.text}`;
    } // read out once, whole, however the text is revealed
    const hadFocus = box.contains(document.activeElement); // the buttons are rebuilt; keep keyboard focus on them
    el('#dlg-actions').innerHTML = game.actions().filter((a) => a.group === 'dialogue').map((a) => btn(a)).join('');
    if (hadFocus && dlgShownId === line.id) el<HTMLElement>('[data-action-id="dlg_next"]', box).focus();
    if (dlgShownId !== line.id) { // a new line: keyboard focus goes to "next" so Enter keeps reading
      dlgShownId = line.id;
      lastFocusId = 'dlg_next';
      el<HTMLElement>('[data-action-id="dlg_next"]', box).focus();
    }
  }

  function renderModals() {
    const pr = el<HTMLDialogElement>('#practice');
    const prOpen = game.rt.practiceOpen && !game.dialogueActive; // a dialogue takes the screen; the panel comes back after it
    if (prOpen && !pr.open) pr.showModal();
    if (!prOpen && pr.open) pr.close();
    if (prOpen) {
      const side = game.rt.practiceSide;
      el('#post-art').innerHTML = side
        ? '<svg viewBox="0 0 160 100" role="img" aria-label="標柱を横から見た図：厚みのある箱"><rect x="50" y="30" width="40" height="50" fill="#cfd6dd"/><polygon points="50,30 90,30 110,20 70,20" fill="#fff"/><polygon points="90,30 110,20 110,70 90,80" fill="#8aa1b5"/></svg>'
        : '<svg viewBox="0 0 160 100" role="img" aria-label="標柱を正面から見た図：四角い面"><rect x="50" y="30" width="60" height="50" fill="#cfd6dd"/></svg>';
      el('#practice-actions').innerHTML = game.actions().filter((a) => a.id === 'practice_side' || a.id === 'practice_front' || a.id === 'practice_close').map((a) => btn(a)).join('');
    }
    const cf = el<HTMLDialogElement>('#confirm');
    const asking = (game.rt.confirmReset !== null || game.rt.confirmReturn) && !game.dialogueActive;
    if (asking && !cf.open) cf.showModal();
    if (!asking && cf.open) cf.close();
    if (asking) {
      el('#confirm-h').textContent = game.rt.confirmReturn ? '帰る前の確認' : 'やり直しの確認';
      el('#confirm-text').textContent = game.rt.confirmReturn ? copy('return_confirm') : copy('reset_confirm');
      el('#confirm-actions').innerHTML = game.actions().filter((a) => a.id.startsWith('confirm_')).map((a) => btn(a)).join('');
      const no = cf.querySelector<HTMLElement>('[data-action-id$="_no"]'); // initial focus is the safe choice
      if (no && !cf.contains(document.activeElement)) no.focus();
    }
    const hd = el<HTMLDialogElement>('#hint');
    const hOpen = game.rt.hintOpen && !game.dialogueActive;
    if (hOpen && !hd.open) hd.showModal();
    if (!hOpen && hd.open) hd.close();
    if (hOpen) {
      const h = game.hintLines();
      el('#hint-body').innerHTML = h && h.lines.length
        ? `<ol class="hint-list">${h.lines.map((l) => `<li><strong>${esc(l.speaker)}</strong>：${esc(l.text)}</li>`).join('')}</ol>`
        : '<p class="hint-line">ヒントは、見たいときだけ開けます。いくつ見ても、ペナルティはありません。</p>';
      el('#hint-actions').innerHTML = game.actions().filter((a) => a.id.startsWith('hint_') && a.id !== 'hint_open').map((a) => btn(a)).join('');
      if (!hd.contains(document.activeElement)) hd.querySelector<HTMLElement>('[data-action-id="hint_more"], [data-action-id="hint_close"]')?.focus();
    }
  }

  function renderStatic() {
    const s = game.state;
    const obj = currentObjective(s);
    el('#obj-text').textContent = obj ? obj.text : '';
    el('.objective').style.visibility = obj ? 'visible' : 'hidden'; // ROOM and the ending have no objective line (no empty label)
    el('#place').textContent = PLACE_NAMES[s.player.anchor] ?? s.player.anchor;
    const vn = `${VIEW_NAMES[s.player.view] ?? s.player.view}の視点`;
    el('#viewname').textContent = vn;
    if (el('#status').textContent !== game.rt.status) el('#status').textContent = game.rt.status;
    const holding = hold && game.now() < hold.until;
    if (!holding) hold = null;
    const preset = opts.presetOverride() ?? (holding ? WorldView.presetFor('observatory', 'observe') : WorldView.presetFor(s.player.anchor, s.player.view));
    const square = WorldView.isSquare(preset);
    stage.classList.toggle('square', square);
    el('.main').classList.toggle('p05-layout', s.player.anchor === 'observatory');
    document.getElementById('etching')!.toggleAttribute('hidden', !square);
    const note = el('#stagemsg');
    note.textContent = '';
    note.toggleAttribute('hidden', !note.textContent);
    return { vn, preset };
  }

  function drawWorld(preset: string) {
    const rect = stage.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return; // screen is hidden behind a menu
    const s = game.state;
    const era = opts.era();
    view.resize(rect.width, rect.height);
    mixer.setEra(era as 'E0' | 'E1' | 'E2' | 'E3');
    view.lowQuality = document.documentElement.dataset['quality'] === 'low';
    view.render({
      era: era as 'E0' | 'E1' | 'E2' | 'E3', reducedMotion: game.reducedMotion, presetId: preset, anchor: hold ? hold.anchor : s.player.anchor, view: hold ? 'observe' : s.player.view,
      p04Solved: s.puzzles.p04.solved, p05: opts.p05Override() ?? { a: s.puzzles.p05.a, b: s.puzzles.p05.b },
      p01: s.puzzles.p01, p02: s.puzzles.p02, speaker: game.currentLine()?.speaker, dialogueId: game.currentLine()?.id,
      p03: {
        gateOpen: s.puzzles.p03.gateLatched || s.toto.anchor === 'p03_plate' || game.rt.selfPlate,
        latched: s.puzzles.p03.gateLatched, plateDown: s.toto.anchor === 'p03_plate' || game.rt.selfPlate,
      },
      totoWait: s.toto.mode === 'wait' ? (s.toto.anchor as 'p03_plate' | 'p06_front' | 'p06_back') : null,
      p06: {
        latched: s.puzzles.p06.portalLatched,
        frontHeld: (s.toto.mode === 'wait' && s.toto.anchor === 'p06_front') || s.player.anchor === 'portal_front',
        backHeld: (s.toto.mode === 'wait' && s.toto.anchor === 'p06_back') || s.player.anchor === 'portal_back',
      },
    });
  }

  function refresh() {
    const hadFocus = lastFocusId;
    const ae = document.activeElement as HTMLElement | null; // the panel is rebuilt below: remember which control the player is actually on
    const onNow = ae && ae.closest('#controls, #targets') ? ae.dataset['actionId'] ?? null : null;
    const { vn, preset } = renderStatic();
    drawWorld(preset);
    renderPanel();
    renderHotspots();
    renderDialogue();
    const modalWas = modalOpen;
    renderModals();
    modalOpen = !!document.querySelector('dialog[open]');
    if (modalOpen && !modalWas) modalTrigger = hadFocus;
    // a line that appeared while a modal was open could not take focus then (the page behind a modal is inert): take it now
    const dbox = el<HTMLElement>('#dlg');
    if (!modalOpen && modalWas && !dbox.hasAttribute('hidden') && !dbox.contains(document.activeElement)) { lastFocusId = 'dlg_next'; el<HTMLElement>('[data-action-id="dlg_next"]', dbox).focus(); }
    else if (!modalOpen && modalWas && modalTrigger) {
      const back = document.querySelector<HTMLElement>(`#controls [data-action-id="${modalTrigger}"], #targets [data-action-id="${modalTrigger}"]`);
      if (back) { lastFocusId = modalTrigger; back.focus(); }
      modalTrigger = null;
    }
    // focus: viewpoint change -> viewpoint heading; otherwise back on the same action if it still exists
    if (vn !== lastViewName) {
      if (lastViewName !== '' && hadFocus && /^view_/.test(hadFocus)) el('#viewname').focus();
      lastViewName = vn;
    } else if (hadFocus && !document.querySelector('dialog[open]')) {
      const want = onNow ?? hadFocus;
      const same = document.querySelector<HTMLElement>(`#controls [data-action-id="${want}"], #targets [data-action-id="${want}"]`);
      if (!same && (hadFocus === 'dlg_next' || hadFocus === 'dlg_skip')) lastFocusId = null;
      const lost = document.activeElement === document.body || document.activeElement === null; // only restore focus the rebuild took away
      if (same && lost) same.focus(); else if (!same && lost) el('#obj-text').parentElement!.setAttribute('tabindex', '-1'), el('.objective').focus();
    }
  }

  game.onChange((events) => {
    const solved = events.some((e) => /_solved$/.test(e.type) || e.type === 'ending');
    mixer.play(solved ? 'solve' : events.some((e) => e.type === 'moved') ? 'move' : events.length ? 'press' : 'deny');
    const cue = events.map(e => e.type === 'moved' && e.from === 'room' ? 'CUE_ENTRY' : CUE_FOR[e.type]).find(Boolean);
    if (events.some((e) => e.type === 'p05_solved')) {
      const ms = game.reducedMotion ? 200 : 1300;
      hold = { until: game.now() + ms, anchor: 'observatory' };
      setTimeout(() => refresh(), ms + 20);
    }
    refresh();
    if (cue) playCue(cue);
  });
  new ResizeObserver(() => refresh()).observe(stage);
  window.addEventListener('resize', () => refresh());
  // Q highlight fades without a state change
  setInterval(() => { if (game.rt.highlightUntil && game.now() > game.rt.highlightUntil) { game.rt.highlightUntil = 0; renderHotspots(); } }, 250);
  refresh();
  return { refresh, stage, canvas, view, setSaveText: (t: string) => {
    const n = el('#savestate');
    n.textContent = t;
    n.setAttribute('aria-live', t === '' || /^保存(中|しました)/.test(t) ? 'off' : 'polite'); // routine saving/saved is visual only; problems and the unsaved state are announced
  } };
}
