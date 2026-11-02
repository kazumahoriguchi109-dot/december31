// Application shell: title, slots, settings, pause, error screens around the play view (docs/SCREENS.md).
// It owns the SaveStore and the AutoSaver; the Game (domain + dispatcher) knows nothing about storage.
import { Game } from './game';
import { AutoSaver, type SaveStatus } from './autosaver';
import { diag } from './diag';
import { mountUi, mixer } from '../ui/view';
import { world } from '../content/load';
import { rowOf } from '../domain/dialogue';
import saveExample from '../../data/save.example.json';
import type { GameState, Milestone, SlotId } from '../domain/types';
import { SaveStore } from '../persistence/store';
import {
  defaultSettings, MANUAL_IDS, SaveError, type MetaRecord, type QuarantineRecord, type SettingsRecord, type SlotRead, type SlotRecord,
} from '../persistence/types';

const CHAPTER: Record<Milestone, string> = {
  ROOM: 'はじまり（部屋）', ARRIVAL: '到着', P01_DONE: '光る石のあと', P02_DONE: '水車のあと', P03_DONE: '門のあと',
  P04_DONE: '白い壁のあと', P05_DONE: '観測台のあと', RETURN_OPEN: '帰り口が開いた', ENDING: 'おわり',
};
const SLOT_NAME: Record<SlotId, string> = { auto: 'オートセーブ', 'manual-1': 'セーブ1', 'manual-2': 'セーブ2', 'manual-3': 'セーブ3' };
const ERROR_COPY: Record<string, string> = {
  E_STORAGE: 'ブラウザの保存庫に書き込めませんでした。いまの進行はこの画面の中で続けられます。',
  E_CORRUPT: 'このセーブは読めませんでした。元のデータは消していません。',
  E_VERSION: 'このセーブは、新しい版のゲームで作られています。この版では開けません（元のデータは変えていません）。',
  E_CAPABILITY: 'このブラウザでは、保存に必要な機能が使えません。読み取りと書き出しだけできます。',
  E_TAB: '別のタブがこのゲームを使っています。そちらを閉じてから、もう一度開いてください。読み取りと書き出しだけできます。',
  E_CONFLICT: '保存の途中で、別の操作で内容が変わっていました。上書きはしていません。',
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fresh = (): GameState => structuredClone(saveExample.slot.game) as unknown as GameState;
const uuid = (): string => (crypto.randomUUID?.() ?? `run-${Date.now()}-${Math.random().toString(16).slice(2)}`);

type Screen = 'CREDITS' | 'LOG' | 'TITLE' | 'NEW' | 'SLOTS' | 'SETTINGS' | 'ERROR' | 'IMPORT' | 'PAUSE' | 'CONFIRM' | 'PLAY' | 'LOAD';

export interface ShellOptions { storeFactory?: () => Promise<SaveStore> }

const DEV_TITLE_HTML = import.meta.env.DEV
  ? '<h2 class="dev-h">開発用（出荷版には含まれません）</h2><button type="button" class="btn" data-dev="M1A_P04">試作：白い壁（P04）から</button><button type="button" class="btn" data-dev="M1A_P05">試作：観測台（P05）から</button>'
  : '';

export class Shell {
  private store: SaveStore | null = null;
  private storeError: SaveError | null = null;
  private game = new Game(fresh());
  private saver: AutoSaver | null = null;
  private run = { runId: uuid(), createdAt: new Date().toISOString(), baseMs: 0, since: 0 };
  private settings: SettingsRecord = defaultSettings(matchMedia('(prefers-reduced-motion: reduce)').matches);
  private screen: Screen = 'LOAD';
  private back: Screen = 'TITLE';
  private playRoot: HTMLElement;
  private screenRoot: HTMLElement;
  private ui!: ReturnType<typeof mountUi>;
  private playMounted = false;
  private importPreview: { text: string } | null = null;
  private playing = false;
  private saveText = '';
  private unsaved = false; // playing in memory only because the browser cannot store saves

  constructor(private root: HTMLElement, private opts: ShellOptions) {
    root.innerHTML = '<div id="screen-root" class="screen-root"></div><div id="play-root" hidden></div>';
    this.screenRoot = root.querySelector('#screen-root')!;
    this.playRoot = root.querySelector('#play-root')!;
    this.game.onCredits = () => { this.game.settle(); this.showCredits(); };
    this.applySettings();
  }

  // ------------------------------------------------------------------ boot
  async start() {
    this.show('LOAD');
    try {
      this.store = await (this.opts.storeFactory ?? (() => SaveStore.open()))();
    } catch (e) {
      this.storeError = e instanceof SaveError ? e : new SaveError('E_STORAGE', String(e));
      return this.showError(this.storeError, 'TITLE');
    }
    try { await this.store.acquireWriter(); } catch (e) { this.storeError = e instanceof SaveError ? e : new SaveError('E_STORAGE', String(e)); }
    try { this.settings = await this.store.getSettings(); this.applySettings(); } catch { /* defaults */ }
    if (this.storeError) return this.showError(this.storeError, 'TITLE');
    this.saver = new AutoSaver(this.store, () => ({ runId: this.run.runId, createdAt: this.run.createdAt, playTimeMs: () => this.playMs() }));
    this.saver.onStatus = (s, e) => this.onSaveStatus(s, e);
    this.game.onChange((_ev, prev) => {
      if (!this.playing || this.game.state === prev) return;
      const chapter = this.game.state.progress.milestone !== prev.progress.milestone;
      this.saver?.schedule(this.game.state, chapter);
    });
    window.addEventListener('pagehide', () => { /* best effort only; never relied on */ void this.saver?.flush(); });
    void this.showTitle();
  }

  private playMs() { return this.run.baseMs + (this.playing ? Math.round(performance.now() - this.run.since) : 0); }
  get readOnly() { return this.storeError !== null || !this.store?.canWrite; }

  // ------------------------------------------------------------------ settings
  private applySettings() {
    const s = this.settings;
    const px = s.textSize === 'small' ? 18 : s.textSize === 'large' ? 26 : 22;
    document.documentElement.style.setProperty('--fs', `${px}px`);
    document.documentElement.dataset['labels'] = s.labelsAlways ? 'always' : 'auto';
    this.game.reducedMotion = s.reduceMotion;
    this.game.textSpeed = s.textSpeed;
    mixer.setVolumes(s.masterVolume, s.musicVolume, s.sfxVolume);
    document.documentElement.dataset['quality'] = s.quality;
  }

  private onSaveStatus(s: SaveStatus, e: SaveError | null) {
    this.saveText = ({ idle: '', saving: '保存中…', saved: '保存しました', slow: '保存に時間がかかっています', stuck: '保存が終わっていません（続けて遊べます）', failed: '保存できませんでした', halted: '保存を止めました' } as Record<SaveStatus, string>)[s];
    this.ui?.setSaveText(this.saveText);
    diag('status', s);
    if (s === 'halted' && e && this.playing) this.showError(e, 'PLAY'); // the tab must stop writing: tell the player, keep the game
  }

  // ------------------------------------------------------------------ screen plumbing
  private show(screen: Screen) {
    this.screen = screen;
    const isPlay = screen === 'PLAY';
    this.playRoot.hidden = !isPlay;
    this.screenRoot.hidden = isPlay;
    if (isPlay) {
      if (!this.playMounted) {
        this.ui = mountUi(this.playRoot, this.game, {
          era: () => world.eraByMilestone[this.game.state.progress.milestone] ?? 'E2',
          presetOverride: () => null, p05Override: () => null, onPause: () => this.openPause(),
        });
        this.playMounted = true;
      }
      this.ui.setSaveText(this.saveText);
      this.ui.refresh();
    }
    if (this.playing && !isPlay) this.run.baseMs += Math.round(performance.now() - this.run.since); // time played so far
    this.playing = isPlay;
    if (isPlay) this.run.since = performance.now();
  }
  private page(id: string, heading: string, body: string, focusSel?: string) {
    this.show(id as Screen);
    this.screenRoot.innerHTML = `<section class="screen" data-screen="${id}" aria-labelledby="scr-h"><h1 id="scr-h" tabindex="-1">${esc(heading)}</h1>${body}</section>`;
    const target = (focusSel && this.screenRoot.querySelector<HTMLElement>(focusSel)) || this.screenRoot.querySelector<HTMLElement>('#scr-h')!;
    target.focus();
  }
  private on(sel: string, fn: () => void | Promise<void>) {
    this.screenRoot.querySelectorAll<HTMLElement>(sel).forEach((n) => n.addEventListener('click', () => { void Promise.resolve(fn()).catch((e) => this.fail(e)); }));
  }
  private onEach(sel: string, fn: (el: HTMLElement) => void | Promise<void>) {
    this.screenRoot.querySelectorAll<HTMLElement>(sel).forEach((n) => n.addEventListener('click', () => { void Promise.resolve(fn(n)).catch((e) => this.fail(e)); }));
  }
  private fail(e: unknown) {
    const err = e instanceof SaveError ? e : new SaveError('E_STORAGE', String(e));
    this.showError(err, this.screen === 'PLAY' ? 'PLAY' : 'TITLE');
  }

  // ------------------------------------------------------------------ title
  private async showTitle() {
    let canContinue = false; let meta: MetaRecord | null = null;
    if (this.store) { try { meta = await this.store.meta(); const id = meta.lastPlayedSlotId; if (id) canContinue = (await this.store.readSlot(id)).status === 'ok'; } catch { /* leave disabled */ } }
    const ro = this.readOnly;
    this.page('TITLE', '12月31日', `
      <svg class="title-art" viewBox="0 0 320 120" role="img" aria-label="雪の夜の草原に立つ金色の枠と、重なる二つの輪" shape-rendering="crispEdges">
        <rect width="320" height="120" fill="#16233a"/><rect y="70" width="320" height="50" fill="#2a4a3d"/><rect y="70" width="320" height="4" fill="#e9eef5"/>
        ${Array.from({ length: 36 }, (_, i) => `<rect x="${(i * 97) % 320}" y="${(i * 53) % 60}" width="2" height="2" fill="#f6e7b4" opacity="${0.4 + (i % 4) * 0.15}"/>`).join('')}
        <rect x="140" y="26" width="6" height="52" fill="#d9ac5b"/><rect x="174" y="26" width="6" height="52" fill="#d9ac5b"/><rect x="140" y="22" width="40" height="6" fill="#d9ac5b"/><rect x="146" y="28" width="28" height="48" fill="#05080d"/>
        <circle cx="153" cy="52" r="9" fill="none" stroke="#ffd166" stroke-width="2"/><circle cx="167" cy="52" r="14" fill="none" stroke="#ffd166" stroke-width="2"/>
        <path d="M160 120 L150 78 L170 78 Z" fill="#b9a37c"/>
        <g fill="#2f6b4c"><path d="M40 88 l14 -34 l14 34 z"/><path d="M60 92 l12 -28 l12 28 z"/><path d="M240 90 l14 -36 l14 36 z"/><path d="M266 88 l10 -26 l10 26 z"/></g>
      </svg>
      ${ro ? '<p class="note" role="status">いまは読み取りと書き出しだけできます（書き込みは止まっています）。</p>' : ''}
      <div class="menu">
        <button type="button" class="btn" id="b-new" ${ro ? 'aria-disabled="true"' : ''}>はじめから</button>
        <button type="button" class="btn" id="b-cont" ${canContinue && !ro ? '' : 'aria-disabled="true"'}>つづきから</button>
        ${this.storeError ? '<button type="button" class="btn" id="b-unsaved">保存せずに遊ぶ</button>' : ''}
        <button type="button" class="btn" id="b-slots">セーブ一覧</button>
        <button type="button" class="btn" id="b-set">設定</button>
        <button type="button" class="btn" id="b-credits">クレジット</button>
        ${import.meta.env.DEV ? DEV_TITLE_HTML : ''}
      </div>
      <p class="fine">登録なしで遊べます。進行はこのブラウザに保存されます。セーブはこのブラウザの中だけに保存されます。ブラウザのデータを消したり、別のブラウザや端末で開いたりすると引き継げません。「セーブ一覧」から書き出せます。</p>`, '#b-new');
    this.on('#b-new', () => { if (!ro) this.showNew(); });
    this.on('#b-cont', async () => { if (canContinue && !ro && meta?.lastPlayedSlotId) await this.loadAndPlay(meta.lastPlayedSlotId); });
    this.on('#b-unsaved', () => this.playUnsaved());
    this.on('#b-slots', () => this.showSlots('TITLE'));
    this.on('#b-set', () => this.showSettings('TITLE'));
    this.on('#b-credits', () => this.showCredits());
    this.onEach('[data-dev]', async (n) => { if (!ro) await this.devStart(n.dataset['dev']!); });
  }

  /** Dev only (removed from the shipped bundle): a valid save-contract state in a real manual slot, so save/load can be tried at P04/P05. */
  private async devStart(name: string) {
    if (import.meta.env.DEV && this.store) {
      const { devGame } = await import('./devStart');
      await this.beginRun('manual-1', await devGame(name), true);
    }
  }

  // ------------------------------------------------------------------ new game
  private slotSummary(r: SlotRead): string {
    switch (r.status) {
      case 'empty': return '空き';
      case 'ok': return `${CHAPTER[r.slot.game.progress.milestone]} / ${Math.floor(r.slot.playTimeMs / 60000)}分 / ${new Date(r.slot.updatedAt).toLocaleString('ja-JP')}`;
      case 'corrupt': return '読めないデータがあります';
      case 'future': return '新しい版で作られています';
    }
  }
  private async showNew() {
    if (!this.store) return;
    const all = await this.store.readAll();
    const firstEmpty = MANUAL_IDS.find((id) => all.slots[id].status === 'empty') ?? 'manual-1';
    const rows = MANUAL_IDS.map((id) => `<li><button type="button" class="btn slot" data-new="${id}" ${all.slots[id].status === 'future' || all.slots[id].status === 'corrupt' ? 'aria-disabled="true"' : ''}><strong>${SLOT_NAME[id]}</strong><span>${esc(this.slotSummary(all.slots[id]))}</span></button></li>`).join('');
    this.page('NEW', '物語をはじめる', `<p>どのセーブ枠ではじめますか。</p><ul class="slots">${rows}</ul><div class="btnrow"><button type="button" class="btn" id="b-back">もどる</button></div>`, `[data-new="${firstEmpty}"]`);
    this.on('#b-back', () => this.showTitle());
    this.onEach('[data-new]', async (n) => {
      const id = n.dataset['new'] as SlotId;
      const st = all.slots[id].status;
      if (st === 'future') return this.showError(new SaveError('E_VERSION', 'target slot is from a newer version'), 'NEW');
      if (st === 'corrupt') return this.showError(new SaveError('E_CORRUPT', 'target slot unreadable'), 'NEW');
      await this.beginRun(id, fresh(), false);
    });
  }

  /** New game (or a dev start) into `manual`. Asks for confirmation when anything is already stored. */
  private async beginRun(manual: SlotId, game: GameState, confirmed: boolean): Promise<void> {
    const store = this.store!;
    try {
      const runId = uuid();
      const out = await store.newGame(manual, game, { runId }, { confirmed });
      this.run = { runId, createdAt: out.manual.createdAt, baseMs: 0, since: performance.now() };
      this.saver!.reset();
      this.game.replace(out.manual.game);
      this.show('PLAY');
    } catch (e) {
      if (e instanceof SaveError && e.code === 'E_CONFLICT' && (e.detail as { needsConfirm?: boolean } | undefined)?.needsConfirm) {
        return this.confirm({
          title: 'はじめからにします', text: `${SLOT_NAME[manual]}とオートセーブを、最初の状態にします。いまの内容は、1つ前の状態として1世代だけ残ります。`,
          yes: 'はじめからにする', no: 'やめる', onNo: () => this.showNew(), onYes: () => this.beginRun(manual, game, true),
        });
      }
      this.fail(e);
    }
  }

  // ------------------------------------------------------------------ load
  private async loadAndPlay(slotId: SlotId, rebuildAutoConfirmed = false): Promise<void> {
    const store = this.store!;
    try {
      this.saver?.reset();
      const { slot } = await store.load(slotId, { rebuildAutoConfirmed });
      this.run = { runId: slot.runId, createdAt: slot.createdAt, baseMs: slot.playTimeMs, since: performance.now() };
      this.game.replace(slot.game);
      this.show('PLAY');
    } catch (e) {
      if (e instanceof SaveError && e.code === 'E_CONFLICT' && (e.detail as { needsConfirm?: string } | undefined)?.needsConfirm === 'rebuild-auto') {
        return this.confirm({
          title: 'オートセーブを作り直します', text: '読めないオートセーブと1世代前のデータを退避して、新しいオートセーブを作ります。手動セーブは変わりません。',
          yes: '作り直して続ける', no: 'やめる', onNo: () => this.showSlots('TITLE'), onYes: () => this.loadAndPlay(slotId, true),
        });
      }
      this.fail(e);
    }
  }

  // ------------------------------------------------------------------ slots
  private async showSlots(back: Screen): Promise<void> {
    this.back = back;
    if (!this.store) return this.showTitle();
    const all = await this.store.readAll();
    const bk = async (id: SlotId) => (await this.store!.readBackup(id)).status === 'ok';
    const ids: SlotId[] = ['auto', ...MANUAL_IDS];
    const hasBackup: Record<string, boolean> = {};
    for (const id of ids) hasBackup[id] = await bk(id);
    const emptyManual = MANUAL_IDS.find((id) => all.slots[id].status === 'empty');
    const ro = this.readOnly;
    const rows = ids.map((id) => {
      const r = all.slots[id];
      const btns = [
        r.status === 'ok' && !ro ? `<button type="button" class="btn" data-load="${id}">ロード</button>` : '',
        r.status === 'ok' ? `<button type="button" class="btn" data-export="${id}">書き出す</button>` : '',
        r.status === 'corrupt' || r.status === 'future' ? `<button type="button" class="btn" data-exportraw="${id}">元のデータを書き出す</button>` : '',
        id !== 'auto' && this.screen !== 'TITLE' && back === 'PAUSE' && !ro ? `<button type="button" class="btn" data-save="${id}">ここに保存</button>` : '',
        id !== 'auto' && !ro ? `<button type="button" class="btn" data-import="${id}">取り込む</button>` : '',
        hasBackup[id] && !ro ? `<button type="button" class="btn" data-restore="${id}">1つ前を別の空きへ復元</button>` : '',
      ].join('');
      return `<li class="slotrow"><div><strong>${SLOT_NAME[id]}</strong> <span class="sum" data-slot-status="${id}">${esc(this.slotSummary(r))}</span></div><div class="btnrow">${btns}</div></li>`;
    }).join('');
    const q = all.quarantine.map((r: QuarantineRecord) => `<li><span>退避したオートセーブ（${new Date(r.archivedAt).toLocaleString('ja-JP')}）：読めませんでした</span> <button type="button" class="btn" data-exportq="${esc(r.archiveKey)}">書き出す</button></li>`).join('');
    this.page('SLOTS', 'セーブ一覧', `
      ${ro ? '<p class="note" role="status">いまは読み取りと書き出しだけできます。</p>' : ''}
      <ul class="slots">${rows}</ul>
      ${q ? `<h2>退避したオートセーブ</h2><ul>${q}</ul>` : ''}
      <div class="btnrow"><button type="button" class="btn" id="b-back">もどる</button></div>
      <p id="slot-status" role="status" class="fine"></p>`, '[data-load], #b-back');
    this.on('#b-back', () => (back === 'PAUSE' ? this.openPause() : this.showTitle()));
    const say = (t: string) => { this.screenRoot.querySelector('#slot-status')!.textContent = t; };
    this.onEach('[data-load]', (n) => this.loadAndPlay(n.dataset['load'] as SlotId));
    this.onEach('[data-export]', async (n) => this.download(`${n.dataset['export']}`, await this.store!.exportSlot(n.dataset['export'] as SlotId), say));
    this.onEach('[data-exportraw]', async (n) => this.download(`${n.dataset['exportraw']}-raw`, await this.store!.exportRaw(n.dataset['exportraw'] as SlotId), say));
    this.onEach('[data-exportq]', (n) => {
      const rec = all.quarantine.find((r) => r.archiveKey === n.dataset['exportq']);
      if (rec) this.download('auto-quarantine', JSON.stringify({ format: 'december31-raw', slotId: 'auto', which: 'quarantine', raw: rec }, null, 2), say);
    });
    this.onEach('[data-import]', (n) => this.showImport(n.dataset['import'] as SlotId, back));
    this.onEach('[data-save]', (n) => this.manualSave(n.dataset['save'] as SlotId));
    this.onEach('[data-restore]', async (n) => {
      const from = n.dataset['restore'] as SlotId;
      if (!emptyManual || emptyManual === from) {
        return say('復元先の空きがありません。先に別のセーブを書き出して、不要なものを整理してください。');
      }
      return this.confirm({
        title: '1つ前の状態を復元します', text: `${SLOT_NAME[from]}の1つ前の状態を、${SLOT_NAME[emptyManual]}（空き）へ復元します。いまのプレイは変わりません。`,
        yes: '復元する', no: 'やめる', onNo: () => this.showSlots(back),
        onYes: async () => { await this.store!.restoreBackup(from, emptyManual); await this.showSlots(back); },
      });
    });
  }

  private download(base: string, text: string, say: (t: string) => void) {
    const d = new Date(); const p = (n: number) => String(n).padStart(2, '0');
    const name = `december31-${base}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    say(`書き出しました（${name}）。ファイルがちゃんと保管できたかは、ブラウザ側で確認してください。`);
  }

  private async manualSave(id: SlotId) {
    const store = this.store!;
    await this.saver?.flush();
    const r = await store.observe(id);
    const bound = this.game.state.progress.activeManualSlot;
    const doSave = async () => {
      const g = structuredClone(this.game.state); g.progress.activeManualSlot = id;
      await store.saveSlot(id, g, { runId: this.run.runId, createdAt: this.run.createdAt, playTimeMs: this.playMs() }, { lastPlayed: id });
      this.game.state.progress.activeManualSlot = id; // binding follows SaveAs only after the write completed
      await this.showSlots('PAUSE');
    };
    if (r.status === 'future') return this.showError(new SaveError('E_VERSION', 'slot from a newer version'), 'SLOTS');
    if (r.status === 'corrupt') return this.showError(new SaveError('E_CORRUPT', 'slot unreadable'), 'SLOTS');
    if (r.status === 'ok' && id !== bound) {
      return this.confirm({ title: '上書きの確認', text: `${SLOT_NAME[id]}の内容を、いまのプレイで置きかえます。1つ前の状態は1世代だけ残ります。`, yes: '上書きする', no: 'やめる', onNo: () => this.showSlots('PAUSE'), onYes: doSave });
    }
    await doSave();
  }

  // ------------------------------------------------------------------ import
  private showImport(target: SlotId, back: Screen) {
    this.page('IMPORT', 'セーブファイルを確認', `
      <p>${SLOT_NAME[target]}へ取り込みます。いまのプレイは変わりません。取り込んだあと、「ロード」で開けます。</p>
      <label>セーブファイル（1MiB以下の .json）<input type="file" id="imp-file" accept="application/json,.json"></label>
      <div id="imp-preview" role="status"></div>
      <div class="btnrow"><button type="button" class="btn" id="imp-go" aria-disabled="true">取り込む</button><button type="button" class="btn" id="b-cancel">やめる</button></div>`, '#b-cancel');
    this.on('#b-cancel', () => this.showSlots(back));
    const file = this.screenRoot.querySelector<HTMLInputElement>('#imp-file')!;
    const prev = this.screenRoot.querySelector<HTMLElement>('#imp-preview')!;
    const go = this.screenRoot.querySelector<HTMLButtonElement>('#imp-go')!;
    let parsed: ReturnType<typeof SaveStore.parseImport> | null = null;
    file.addEventListener('change', async () => {
      parsed = null; go.setAttribute('aria-disabled', 'true');
      const f = file.files?.[0]; if (!f) return;
      if (f.size > 1024 * 1024) { prev.textContent = 'ファイルが大きすぎます（1MiBまで）。'; return; }
      try {
        parsed = SaveStore.parseImport(await f.text());
        const s = parsed.slot;
        prev.textContent = `読めました：${CHAPTER[s.game.progress.milestone]} / ${Math.floor(s.playTimeMs / 60000)}分${parsed.unsaved ? '（未保存の進行から書き出したものです）' : ''}`;
        go.removeAttribute('aria-disabled');
      } catch (e) {
        const err = e as SaveError;
        prev.textContent = err.code === 'E_VERSION' ? ERROR_COPY['E_VERSION']! : 'このファイルは取り込めません。内容を変えていません。';
      }
    });
    go.addEventListener('click', () => {
      if (!parsed || go.getAttribute('aria-disabled') === 'true') return;
      const env = parsed;
      void (async () => {
        try {
          const cur = await this.store!.observe(target);
          if (cur.status === 'ok') {
            return this.confirm({ title: '取り込みの確認', text: `${SLOT_NAME[target]}の内容を置きかえます。1つ前の状態は1世代だけ残ります。`, yes: '置きかえる', no: 'やめる', onNo: () => this.showSlots(back), onYes: async () => { await this.store!.importInto(target, env, { confirmedOverwrite: true }); await this.showSlots(back); } });
          }
          await this.store!.importInto(target, env, { confirmedOverwrite: false });
          await this.showSlots(back);
        } catch (e) { this.fail(e); }
      })();
    });
  }

  // ------------------------------------------------------------------ credits
  private showCredits() {
    // Facts only: nothing unconfirmed is credited.
    this.page('CREDITS', 'クレジット', `
      <p>『12月31日』</p>
      <ul>
        <li>ゲームの実装：Claude Code（Anthropic）との共同制作</li>
        <li>絵：ゲームの中でコードを使って描いた図形です</li>
        <li>音：ブラウザの中で作った、短い曲と効果音です（録音や既存の音源は使っていません）</li>
        <li>使用ソフトウェア：three.js（MIT License、Copyright © 2010-2026 three.js authors）、TypeScript、Vite</li>
      </ul>
      <p class="fine">セーブはこのブラウザの中だけに保存されます。</p>
      <div class="menu"><button type="button" class="btn" id="b-back">タイトルへ</button></div>`, '#b-back');
    this.on('#b-back', () => this.showTitle());
  }

  // ------------------------------------------------------------------ settings
  private showSettings(back: Screen) {
    const s = this.settings;
    const range = (id: string, label: string, v: number) => `<label>${label}<input type="range" id="${id}" min="0" max="1" step="0.05" value="${v}"></label>`;
    this.page('SETTINGS', '設定', `
      <p class="fine">音は、ブラウザの中で作った短い曲と効果音です。最初に画面を押すと鳴り始めます。</p>
      ${range('s-master', '全体の音量', s.masterVolume)}${range('s-music', '音楽', s.musicVolume)}${range('s-sfx', '効果音', s.sfxVolume)}
      <label>文字の大きさ<select id="s-size"><option value="small">小</option><option value="standard">ふつう</option><option value="large">大</option></select></label>
      <label>文字の速さ<select id="s-speed"><option value="instant">すぐ全部</option><option value="normal">ふつう</option><option value="slow">ゆっくり</option></select></label>
      <label>画質<select id="s-quality"><option value="standard">ふつう</option><option value="low">かるい（低）</option></select></label>
      <label><input type="checkbox" id="s-motion"> 動きをへらす</label>
      <label><input type="checkbox" id="s-labels"> 調べられる場所の名前をいつも出す</label>
      <p id="set-status" role="status" class="fine"></p>
      <div class="btnrow"><button type="button" class="btn" id="set-save">保存して戻る</button><button type="button" class="btn" id="set-cancel">変えずに戻る</button></div>`, '#s-master');
    const g = <T extends HTMLElement>(id: string) => this.screenRoot.querySelector<T>(`#${id}`)!;
    g<HTMLSelectElement>('s-size').value = s.textSize; g<HTMLSelectElement>('s-speed').value = s.textSpeed; g<HTMLSelectElement>('s-quality').value = s.quality;
    g<HTMLInputElement>('s-motion').checked = s.reduceMotion; g<HTMLInputElement>('s-labels').checked = s.labelsAlways;
    const goBack = () => (back === 'PAUSE' ? this.openPause() : this.showTitle());
    this.on('#set-cancel', goBack);
    this.on('#set-save', async () => {
      const next = {
        masterVolume: +g<HTMLInputElement>('s-master').value, musicVolume: +g<HTMLInputElement>('s-music').value, sfxVolume: +g<HTMLInputElement>('s-sfx').value,
        textSize: g<HTMLSelectElement>('s-size').value as SettingsRecord['textSize'], textSpeed: g<HTMLSelectElement>('s-speed').value as SettingsRecord['textSpeed'],
        reduceMotion: g<HTMLInputElement>('s-motion').checked, labelsAlways: g<HTMLInputElement>('s-labels').checked, quality: g<HTMLSelectElement>('s-quality').value as SettingsRecord['quality'],
      };
      try {
        if (!this.store || this.readOnly) throw new SaveError('E_TAB', 'read-only');
        this.settings = await this.store.putSettings(next);
      } catch { // saving failed: apply for this session only and say so
        this.settings = { ...s, ...next };
        this.applySettings();
        g('set-status').textContent = '保存できませんでした。今回だけ反映します。';
        return;
      }
      this.applySettings(); goBack();
    });
  }

  // ------------------------------------------------------------------ pause
  /** True when progress is really being written to this browser right now (not unsaved play, not a halted or failing saver). */
  private savingWorks() { return !this.unsaved && this.saver !== null && !this.saver.halted && this.saver.status !== 'failed'; }
  private async openPause() {
    await this.saver?.flush(); // pause is a write barrier: the last commit is in the store before any menu action
    this.page('PAUSE', 'ひと休み', `
      <div class="menu">
        <button type="button" class="btn" id="p-resume">続ける</button>
        ${this.unsaved ? '' : '<button type="button" class="btn" id="p-slots">セーブ一覧（保存・ロード）</button>'}
        <button type="button" class="btn" id="p-log">会話ログ</button>
        <button type="button" class="btn" id="p-set">設定</button>
        <button type="button" class="btn" id="p-title">タイトルへ</button>
      </div><p class="fine" role="status">${esc(this.saveText)}</p>`, '#p-resume');
    this.on('#p-resume', () => this.resume());
    this.on('#p-slots', () => this.showSlots('PAUSE'));
    this.on('#p-log', () => this.showLog());
    this.on('#p-set', () => this.showSettings('PAUSE'));
    this.on('#p-title', () => this.confirm({ title: 'タイトルへ戻ります', text: !this.savingWorks() ? 'いまは保存できていないため、タイトルへ戻るとここまでの進み方は消えます。' : 'ここまでの進み方は、オートセーブに入っています。', yes: 'タイトルへ', no: 'やめる', onNo: () => this.openPause(), onYes: () => this.showTitle() }));
    this.screen = 'PAUSE';
  }
  /** UI_LOG: only lines already acknowledged, oldest first. Reading the log changes nothing in the saved state. */
  private showLog() {
    const seen = this.game.state.dialogue.seenIds.filter((id) => { try { return rowOf(id).repeat === 'once'; } catch { return false; } });
    const items = seen.map((id) => { const r = rowOf(id); return `<li><strong>${esc(r.speaker)}</strong>　${esc(r.text)}</li>`; }).join('');
    this.page('LOG', 'これまでの会話', `<ol class="log" tabindex="0" aria-label="これまでの会話">${items || '<li>まだ会話はありません。</li>'}</ol><div class="btnrow"><button type="button" class="btn" id="l-back">もどる</button></div>`, '#l-back');
    this.screenRoot.querySelector('.log')!.scrollTop = 1e9; // starts at the end
    this.on('#l-back', () => this.openPause());
  }
  private resume() { this.show('PLAY'); }

  /** The browser cannot keep saves (no storage, no locks, or another tab is the writer): play from the start in memory only. */
  private playUnsaved() {
    this.unsaved = true;
    this.run = { runId: uuid(), createdAt: new Date().toISOString(), baseMs: 0, since: performance.now() };
    this.saveText = '保存されません（このタブを閉じると進行は消えます）';
    this.game.replace(fresh());
    this.show('PLAY');
  }

  // ------------------------------------------------------------------ confirm / error
  private confirm(o: { title: string; text: string; yes: string; no: string; onYes: () => void | Promise<void>; onNo: () => void | Promise<void> }) {
    this.page('CONFIRM', o.title, `<p>${esc(o.text)}</p><div class="btnrow"><button type="button" class="btn" id="c-no">${esc(o.no)}</button><button type="button" class="btn danger" id="c-yes">${esc(o.yes)}</button></div>`, '#c-no');
    this.on('#c-no', o.onNo);
    this.on('#c-yes', o.onYes);
  }

  private showError(err: SaveError, back: Screen) {
    const text = ERROR_COPY[err.code] ?? '操作を続けられません。';
    const canPlay = back === 'PLAY';
    this.page('ERROR', '操作を続けられません', `
      <p role="alert" data-error-code="${err.code}">${esc(text)}</p>
      <p class="fine">（${err.code}）<span data-error-detail>${esc(err.message.replace(/^E_[A-Z]+: /, "").slice(0, 200))}</span></p>
      <div class="btnrow">
        ${canPlay ? '<button type="button" class="btn" id="e-play">このまま続ける（保存はされません）</button>' : ''}
        ${!canPlay && this.storeError ? '<button type="button" class="btn" id="e-unsaved">保存せずに遊ぶ（進行は残りません）</button>' : ''}
        <button type="button" class="btn" id="e-slots">セーブ一覧（読み取り・書き出し）</button>
        <button type="button" class="btn" id="e-title">タイトルへ</button>
      </div>`, canPlay ? '#e-play' : '#e-slots');
    this.on('#e-play', () => this.show('PLAY'));
    this.on('#e-unsaved', () => this.playUnsaved());
    this.on('#e-slots', () => this.showSlots('TITLE'));
    this.on('#e-title', () => this.showTitle());
  }

  // ------------------------------------------------------------------ test seams (dev builds only, see main.ts)
  internals() { return { store: this.store, saver: this.saver, game: this.game, screen: () => this.screen }; }
}
