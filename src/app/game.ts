import { jointGaps } from '../render/p05Geometry';
import { hintKeyFor, reduce, type Command, type GameEvent } from '../domain/commands';
import { validateGame } from '../domain/invariants';
import { checkMove, EDGES } from '../domain/movement';
import { atLeast, type Anchor, type GameState, type Milestone } from '../domain/types';
import { anchorDef, copy } from '../content/load';
import { acknowledge, normalize, rowOf } from '../domain/dialogue';

/** Transient UI state: never saved, never part of GameState. */
export interface Runtime {
  practiceOpen: boolean;
  practiceSide: boolean;
  confirmReset: 'p01' | 'p02' | 'p03' | 'p04' | 'p05' | null;
  /** P03 observation mode: the player stands on the plate to see what it does. Never saved (PUZZLES P03). */
  selfPlate: boolean;
  confirmReturn: boolean;
  hintOpen: boolean;
  status: string;
  highlightUntil: number;
}

export interface Action {
  id: string;
  label: string;          // accessible name, shared by canvas hotspot, target list and control button
  group: 'view' | 'puzzle' | 'move' | 'object' | 'misc' | 'dialogue';
  enabled: boolean;
  reason?: string;
  pressed?: boolean;
  world?: [number, number, number]; // present => also a canvas hotspot
  cmd?: Command;
  rt?: 'practice_open' | 'practice_close' | 'practice_toggle_side' | 'confirm_reset' | 'confirm_yes' | 'confirm_no' | 'dlg_next' | 'dlg_skip' | 'self_on' | 'self_off' | 'self_try' | 'confirm_return' | 'confirm_return_no' | 'hint_open' | 'hint_close' | 'credits_open';
}

export interface LogEntry { actionId: string; source: string; accepted: boolean; cmd?: Command }

const LABELS: Record<Anchor, string> = {
  room: '部屋', arrival: '入口', p01_panel: '光る石の前', mill: '水車', gate_near: '門の手前', gate_far: '門の向こう',
  wall_base: '白い壁の前', wall_top: '白い壁の上', observatory: '観測台', castle: '城の前',
  portal_front: '枠の表', portal_back: '枠の裏', home: '部屋',
};

const MOVE_LABELS: Record<string, string> = {
  'arrival>p01_panel': '光る石へ進む', 'p01_panel>arrival': '入口へ戻る',
  'p01_panel>mill': '水車へ進む', 'mill>p01_panel': '光る石へ戻る',
  'mill>gate_near': '橋を渡る', 'gate_near>mill': '水車へ戻る',
  'gate_near>gate_far': '門を通る', 'gate_far>gate_near': '手前へ戻る',
  'castle>portal_front': '光る枠へ進む', 'portal_front>castle': '城の前へ戻る',
  'portal_front>portal_back': '裏へ回る', 'portal_back>portal_front': '表へ回る',
  'gate_far>wall_base': '白い壁へ進む', 'wall_base>gate_far': '門の向こうへ戻る',
};

/** True when the gate lets the player through: latched, or Toto holds the plate. Never true for the player's own test. */
export const gateTraversable = (g: GameState) => g.puzzles.p03.gateLatched || g.toto.anchor === 'p03_plate';

export class Game {
  state: GameState;
  rt: Runtime = { practiceOpen: false, practiceSide: false, confirmReset: null, selfPlate: false, confirmReturn: false, hintOpen: false, status: '', highlightUntil: 0 };
  readonly log: LogEntry[] = [];
  busyUntil = 0;
  reducedMotion = false;
  onCredits: (() => void) | null = null;
  textSpeed: 'instant' | 'slow' | 'normal' = 'instant';
  private lastAt = new Map<string, number>();
  private listeners: ((events: GameEvent[], prev: GameState) => void)[] = [];

  constructor(initial: GameState) {
    const errs = validateGame(initial);
    if (errs.length) throw new Error(`invalid start state: ${errs.join('; ')}`);
    this.state = structuredClone(initial);
    normalize(this.state); // a reached milestone with unread required dialogue resumes it
  }

  onChange(fn: (events: GameEvent[], prev: GameState) => void) { this.listeners.push(fn); }
  private emit(events: GameEvent[], prev: GameState) { for (const l of this.listeners) l(events, prev); }
  now = () => performance.now();
  get busy() { return this.now() < this.busyUntil; }
  setBusy(ms: number) { this.busyUntil = Math.max(this.busyUntil, this.now() + ms); }

  /** Replace the whole game (used by the dev start loader). Runtime state is reset. */
  replace(next: GameState) {
    const errs = validateGame(next);
    if (errs.length) throw new Error(`invalid start state: ${errs.join('; ')}`);
    const prev = this.state;
    this.state = structuredClone(next);
    normalize(this.state);
    this.rt = { practiceOpen: false, practiceSide: false, confirmReset: null, selfPlate: false, confirmReturn: false, hintOpen: false, status: '', highlightUntil: 0 };
    this.busyUntil = 0;
    this.log.length = 0;
    this.lastAt.clear();
    this.emit([], prev);
  }

  /** True while an automatic dialogue is on screen: exploration input is not accepted. */
  get dialogueActive() { return this.state.dialogue.activeId !== null; }
  /** The current row, for the dialogue box. */
  currentLine() {
    const id = this.state.dialogue.activeId;
    if (id === null) return null;
    const r = rowOf(id);
    return { id, speaker: r.speaker, text: r.text, remaining: this.state.dialogue.queue.length, skipAllowed: r.skipAllowed };
  }

  actions(): Action[] {
    const s = this.state;
    const out: Action[] = [];
    const line = this.currentLine();
    if (line) {
      out.push({ id: 'dlg_next', label: line.remaining ? '次へ' : '閉じる', group: 'dialogue', enabled: true, rt: 'dlg_next' });
      if (line.skipAllowed) out.push({ id: 'dlg_skip', label: 'この会話をとばす', group: 'dialogue', enabled: true, rt: 'dlg_skip' });
      return out;
    }
    const { anchor, view } = s.player;
    const ms = s.progress.milestone;

    // ---- intro (ROOM) ----
    if (anchor === 'room' && ms === 'ROOM') {
      out.push({ id: 'start_rpg', label: 'いっしょに始める', group: 'puzzle', enabled: true, cmd: { type: 'start_rpg' } });
    }

    // ---- P01 (panel) ----
    if (anchor === 'p01_panel' && ms === 'ARRIVAL') {
      out.push(
        { id: 'p01_right', label: 'タイルを右に回す', group: 'puzzle', enabled: true, world: [0, 0.3, 5], cmd: { type: 'p01_rotate', dir: 'right' } },
        { id: 'p01_left', label: 'タイルを左に回す', group: 'puzzle', enabled: true, cmd: { type: 'p01_rotate', dir: 'left' } },
        { id: 'p01_reset', label: 'この仕掛けだけやり直す', group: 'misc', enabled: true, rt: 'confirm_reset' },
      );
    }

    // ---- P02 (mill) ----
    if (anchor === 'mill' && ms === 'P01_DONE') {
      const p2 = s.puzzles.p02;
      out.push(
        { id: 'p02_drain', label: p2.drain === 'open' ? '排水口を閉じる' : '排水口を開く', group: 'puzzle', enabled: true, world: [3, 0.2, 9], cmd: { type: 'p02_drain' } },
        { id: 'p02_stopper', label: p2.stopper === 'locked' ? '止め具を外す' : '止め具を戻す', group: 'puzzle', enabled: true, world: [6, 1.8, 8], cmd: { type: 'p02_stopper' } },
        { id: 'p02_reset', label: 'この仕掛けだけやり直す', group: 'misc', enabled: true, rt: 'confirm_reset' },
      );
    }

    // ---- P03 (gate) ----
    if ((anchor === 'gate_near' || anchor === 'gate_far') && ms === 'P02_DONE') {
      const p3 = s.puzzles.p03;
      const waiting = s.toto.mode === 'wait';
      if (anchor === 'gate_near' && !waiting && !p3.gateLatched) {
        if (!this.rt.selfPlate) out.push({ id: 'self_on', label: '自分で乗ってみる', group: 'puzzle', enabled: true, world: [10, 0.2, 9.2], rt: 'self_on' });
        else out.push(
          { id: 'self_off', label: '圧板から離れる', group: 'puzzle', enabled: true, rt: 'self_off' },
          { id: 'self_try', label: '門へ進んでみる', group: 'puzzle', enabled: true, rt: 'self_try' },
        );
        out.push({ id: 'p03_wait', label: 'トト：ここで待って', group: 'puzzle', enabled: true, world: [10.9, 0.2, 9.2], cmd: { type: 'p03_wait' } });
      }
      if (anchor === 'gate_far' && !p3.gateLatched) {
        out.push({ id: 'p03_latch', label: '留め金を固定する', group: 'object', enabled: true, world: [10, 0.9, 14.6], cmd: { type: 'p03_latch' } });
      }
      if (waiting) out.push({ id: 'p03_call', label: 'トトを呼ぶ', group: 'puzzle', enabled: true, cmd: { type: 'p03_call' } });
      if (!p3.gateLatched) out.push({ id: 'p03_reset', label: 'この仕掛けだけやり直す', group: 'misc', enabled: true, rt: 'confirm_reset' });
    }

    // ---- P06 (portal) ----
    if ((anchor === 'portal_front' || anchor === 'portal_back') && (ms === 'P05_DONE' || ms === 'RETURN_OPEN')) {
      const side = anchor === 'portal_front' ? -1.5 : 1.5;
      if (s.toto.mode === 'follow' && ms === 'P05_DONE') out.push({ id: 'p06_wait', label: 'トト：ここで待って', group: 'puzzle', enabled: true, world: [0.9, 0.2, side], cmd: { type: 'p06_wait' } });
      if (s.toto.mode === 'wait') out.push({ id: 'p06_call', label: 'トトを呼ぶ', group: 'puzzle', enabled: true, cmd: { type: 'p06_call' } });
      if (ms === 'RETURN_OPEN') {
        const together = s.toto.mode === 'follow';
        out.push({ id: 'return_ask', label: '一緒に帰る', group: 'puzzle', enabled: together, reason: together ? undefined : 'トトと合流してから、帰ろう。', world: [0, 1.5, 0], rt: 'confirm_return' });
      } else out.push({ id: 'p06_reset', label: 'この仕掛けだけやり直す', group: 'misc', enabled: true, rt: 'confirm_reset' });
    }

    // ---- P04 (wall) ----
    if (anchor === 'wall_base' || anchor === 'wall_top') {
      out.push(
        { id: 'view_front', label: '正面を見る', group: 'view', enabled: true, pressed: view === 'front', cmd: { type: 'view', view: 'front' } },
        { id: 'view_wall_side', label: '側面を見る', group: 'view', enabled: true, pressed: view === 'wall_side', cmd: { type: 'view', view: 'wall_side' } },
      );
    }
    if (anchor === 'wall_base' && ms === 'P03_DONE') {
      // Names are fixed by the view and only change after the recognising command has been accepted (PUZZLES P04).
      const noun = view === 'wall_side' ? '白い段' : '白い模様';
      out.push({ id: 'p04_inspect', label: `${noun}を調べる`, group: 'object', enabled: true, world: [14, 1.2, 16], cmd: { type: 'p04_inspect' } });
      out.push({ id: 'practice_open', label: '標柱を調べる', group: 'object', enabled: true, world: [12.4, 0.8, 12.6], rt: 'practice_open' });
      out.push({ id: 'p04_reset', label: 'この仕掛けだけやり直す', group: 'misc', enabled: !s.puzzles.p04.solved, rt: 'confirm_reset' });
    }
    if (s.puzzles.p04.solved && (anchor === 'wall_base' || anchor === 'wall_top')) {
      out.push(anchor === 'wall_base'
        ? { id: 'climb_up', label: '足場を上る', group: 'object', enabled: true, world: [14, 1.2, 16], cmd: { type: 'move', to: 'wall_top' } }
        : { id: 'climb_down', label: '足場を下りる', group: 'object', enabled: true, world: [14, 1.2, 16], cmd: { type: 'move', to: 'wall_base' } });
    }

    // ---- P05 (observatory) ----
    if (anchor === 'observatory') {
      const p5 = s.puzzles.p05;
      out.push({ id: 'view_peek', label: 'のぞく', group: 'view', enabled: ms === 'P04_DONE', pressed: view === 'observe', cmd: { type: 'view', view: 'observe' }, reason: copy('locked_generic') });
      out.push({ id: 'view_apparatus', label: '装置を見る', group: 'view', enabled: true, pressed: view === 'apparatus_side', cmd: { type: 'view', view: 'apparatus_side' } });
      out.push({ id: 'view_overview', label: '全景に戻る', group: 'view', enabled: true, pressed: view === 'front', cmd: { type: 'view', view: 'front' } });
      out.push({ id: 'p05_object', label: '観測装置をのぞく', group: 'object', enabled: ms === 'P04_DONE' && !p5.solved, world: [22, 3.6, 18.8], cmd: { type: 'view', view: 'observe' } });
      if (ms === 'P04_DONE' && !p5.solved) {
        for (const piece of ['a', 'b'] as const) {
          (['手前', '中央', '奥'] as const).forEach((stop, pos) => {
            out.push({
              id: `p05_${piece}${pos}`, label: `${piece.toUpperCase()}を${stop}へ`, group: 'puzzle', enabled: true,
              pressed: p5[piece] === pos, cmd: { type: 'p05_set', piece, pos: pos as 0 | 1 | 2 },
            });
          });
        }
        out.push({ id: 'p05_reset', label: 'この仕掛けだけやり直す', group: 'misc', enabled: true, rt: 'confirm_reset' });
      }
    }

    // ---- hints: opened by the player only, never automatically ----
    if (hintKeyFor(ms) !== null && !this.rt.hintOpen) out.push({ id: 'hint_open', label: 'ヒントを見る', group: 'misc', enabled: true, rt: 'hint_open' });
    if (this.rt.hintOpen) {
      const k = hintKeyFor(ms);
      const lvl = k ? s.hints[k] : 3;
      out.push(
        { id: 'hint_more', label: lvl === 0 ? '最初のヒントを見る' : 'つぎのヒントを見る', group: 'misc', enabled: lvl < 3, reason: 'これ以上のヒントはありません。', cmd: { type: 'hint_more' } },
        { id: 'hint_close', label: '閉じる', group: 'misc', enabled: true, rt: 'hint_close' },
      );
    }
    if (this.rt.confirmReturn) {
      out.push(
        { id: 'confirm_return_no', label: 'まだ見て回る', group: 'misc', enabled: true, rt: 'confirm_return_no' },
        { id: 'confirm_return_yes', label: '帰る', group: 'misc', enabled: true, cmd: { type: 'return_home' } },
      );
    }

    // ---- modal helpers (runtime only) ----
    if (this.rt.practiceOpen) {
      out.push(
        { id: this.rt.practiceSide ? 'practice_front' : 'practice_side', label: this.rt.practiceSide ? '正面へ戻る' : '側面を見る', group: 'misc', enabled: true, rt: 'practice_toggle_side' },
        { id: 'practice_close', label: '閉じる', group: 'misc', enabled: true, rt: 'practice_close' },
      );
    }
    if (this.rt.confirmReset) {
      out.push(
        { id: 'confirm_no', label: 'やめる', group: 'misc', enabled: true, rt: 'confirm_no' },
        { id: 'confirm_yes', label: '最初の状態に戻す', group: 'misc', enabled: true, rt: 'confirm_yes' },
      );
    }

    // ---- movement between known anchors (same guards as everywhere) ----
    for (const e of EDGES) {
      if (e.from !== anchor) continue;
      if ((anchor === 'wall_base' && e.to === 'wall_top') || (anchor === 'wall_top' && e.to === 'wall_base')) continue; // the climb object does this
      if (!atLeast(s, anchorDef(e.to).minMilestone as Milestone)) continue; // not yet part of the story
      if (this.rt.selfPlate && e.to === 'gate_far') continue; // the observation has its own "try" button
      const chk = checkMove(s, e.to);
      out.push({
        id: `move_${e.to}`, label: MOVE_LABELS[`${e.from}>${e.to}`] ?? `${LABELS[e.to]}へ進む`, group: 'move', enabled: chk.ok,
        reason: chk.ok ? undefined : chk.reason, cmd: { type: 'move', to: e.to },
      });
    }
    if (out.every((a) => a.group === 'misc' && a.rt)) {
      // Honest placeholder: this part of the story is not built yet (P01-P03, intro, P06 and ending come in later milestones).
      const built = !['home'].includes(anchor);
      if (!built) out.push({ id: 'credits_open', label: 'おしまい（クレジットを見る）', group: 'misc', enabled: true, rt: 'credits_open' });
    }
    return out;
  }

  /** Text state that must be readable without colour or sound (PUZZLES P01/P02/P03). */
  readout(): string[] {
    const s = this.state, ms = s.progress.milestone, a = s.player.anchor;
    if (a === 'p01_panel' && ms === 'ARRIVAL') {
      const ports = [['西', '北'], ['北', '東'], ['東', '南'], ['南', '西']][s.puzzles.p01.rotation]!;
      return [`タイルのつなぎ口：${ports.join('と')}`, '入口は北、門は東にある。']; // state only: what turning does is for the player to find
    }
    if (a === 'mill' && ms === 'P01_DONE') {
      const p = s.puzzles.p02;
      const drain = p.drain === 'open' ? '開いている' : '閉じている';
      const stopper = p.stopper === 'locked' ? '固定中' : '外れている';
      const lines = [`排水口：${drain}`, `止め具：${stopper}`];
      if (p.drain === 'open' && p.stopper === 'locked') lines.push('水は排水口から流れ出ている。車輪も止め具で止まっている。');
      else if (p.drain === 'open') lines.push('車輪は自由だが、水は排水口へ流れてしまっている。');
      else if (p.stopper === 'locked') lines.push('水は車輪に届いているが、止め具で動かない。');
      return lines;
    }
    if ((a === 'gate_near' || a === 'gate_far') && ms === 'P02_DONE') {
      const p = s.puzzles.p03;
      const open = gateTraversable(s) || this.rt.selfPlate;
      return [
        `門：${open ? '開いている' : '閉じている'}`,
        `トト：${s.toto.mode === 'wait' ? '圧板で待っている' : 'いっしょにいる'}`,
        `留め金：${p.gateLatched ? '固定した' : 'まだ'}`,
      ];
    }
    if (a === 'observatory' && s.player.view === 'observe' && ms === 'P04_DONE' && !s.puzzles.p05.solved) { // only while looking from the observation mark; state only: where each ring sits and whether each joint meets
      const g = jointGaps(s.puzzles.p05.a, s.puzzles.p05.b);
      const j = (n: string, d: number) => `${n}のつなぎ目：${d < 0.005 ? 'つながっている' : 'はなれている'}`;
      const stop = ['手前', '中央', '奥'] as const;
      return [`輪A：${stop[s.puzzles.p05.a]}　輪B：${stop[s.puzzles.p05.b]}`, j('左上', g.upperLeft), j('右上', g.upperRight), j('下', g.bottom)];
    }
    if ((a === 'portal_front' || a === 'portal_back') && (ms === 'P05_DONE' || ms === 'RETURN_OPEN')) {
      const t = s.toto;
      const frontHeld = t.mode === 'wait' && t.anchor === 'p06_front' || a === 'portal_front';
      const backHeld = t.mode === 'wait' && t.anchor === 'p06_back' || a === 'portal_back';
      return [
        `枠：${s.puzzles.p06.portalLatched ? '開いている（もう閉じない）' : '閉じている'}`,
        `表の圧板：${frontHeld ? (t.mode === 'wait' && t.anchor === 'p06_front' ? 'トトが乗っている' : '自分が乗っている') : 'だれも乗っていない'}`,
        `裏の圧板：${backHeld ? (t.mode === 'wait' && t.anchor === 'p06_back' ? 'トトが乗っている' : '自分が乗っている') : 'だれも乗っていない'}`,
        `トト：${t.mode === 'wait' ? '圧板で待っている' : 'いっしょにいる'}`,
      ];
    }
    return [];
  }

  /** Hints revealed so far for the current puzzle (cumulative, from the script rows). */
  hintLines(): { key: string; level: number; lines: { speaker: string; text: string }[] } | null {
    const k = hintKeyFor(this.state.progress.milestone);
    if (!k) return null;
    const level = this.state.hints[k];
    const lines = [];
    for (let n = 1; n <= level; n++) { const r = rowOf(`H_${k}_${n}`); lines.push({ speaker: r.speaker, text: r.text }); }
    return { key: k, level, lines };
  }

  private finish(events: GameEvent[]) {
    let busy = 0;
    for (const e of events) {
      if (e.type === 'p05_solved') busy = Math.max(busy, this.reducedMotion ? 200 : 1300);
      else if (e.type === 'moved') busy = Math.max(busy, this.reducedMotion ? 0 : 220);
    }
    if (busy) this.setBusy(busy);
  }

  /**
   * Single entry for every input method. Mouse clicks, Enter/Space on a focused button and test hooks all land here
   * with the same actionId, so accepted actions and resulting state cannot depend on the device.
   */
  perform(actionId: string, source: 'mouse' | 'keyboard' | 'api'): boolean {
    const t = this.now();
    if (this.busy) { this.setStatus(copy('busy')); return false; }            // dropped, never queued
    const last = this.lastAt.get(actionId);
    if (last !== undefined && t - last < 300) return false;                   // same action within 300 ms
    this.lastAt.set(actionId, t);
    const a = this.actions().find((x) => x.id === actionId);
    if (!a) return false;
    if (!a.enabled) { this.setStatus(a.reason ?? copy('locked_generic')); this.log.push({ actionId, source, accepted: false }); return false; }

    if (a.id === 'confirm_return_yes') this.rt.confirmReturn = false;
    if (this.rt.selfPlate && !a.id.startsWith('self_')) this.rt.selfPlate = false; // observation ends before anything else happens (never saved as "on")
    if (a.rt) {
      const before = this.state; // dialogue acknowledgement replaces the state, so listeners (autosave) must see the old one as prev
      this.runtimeAction(a.rt, actionId, source); this.log.push({ actionId, source, accepted: true }); this.emit([], before); return true;
    }
    if (!a.cmd) return false;
    const prev = this.state;
    const r = reduce(prev, a.cmd);
    if (!r.ok) { this.setStatus(r.reason); this.log.push({ actionId, source, accepted: false, cmd: a.cmd }); this.emit([], prev); return false; }
    const errs = validateGame(r.state);
    if (errs.length) throw new Error(`reducer produced an invalid state: ${errs.join('; ')}`);
    this.state = r.state;
    normalize(this.state); // same commit: the next dialogue event is chosen from the committed state
    const msg = r.events.find((e) => e.type === 'message');
    this.rt.status = msg && msg.type === 'message' ? msg.text : '';
    if (r.events.some((e) => e.type === 'p05_solved')) this.rt.status = copy('p05_solved_status');
    this.log.push({ actionId, source, accepted: true, cmd: a.cmd });
    this.finish(r.events);
    this.emit(r.events, prev);
    return true;
  }

  private runtimeAction(kind: NonNullable<Action['rt']>, actionId: string, source: 'mouse' | 'keyboard' | 'api') {
    const r = this.rt;
    switch (kind) {
      case 'practice_open': r.practiceOpen = true; r.practiceSide = false; r.status = ''; break;
      case 'practice_close': r.practiceOpen = false; break;
      case 'practice_toggle_side': {
        r.practiceSide = !r.practiceSide; r.status = copy(r.practiceSide ? 'practice_post_side' : 'practice_post_front');
        if (actionId === 'practice_side') { // the explicit command that view_tutorial_done waits for
          const next = structuredClone(this.state);
          if (normalize(next, 'practice_side')) this.state = next;
        }
        break;
      }
      case 'dlg_next': case 'dlg_skip': {
        const next = structuredClone(this.state);
        acknowledge(next, kind === 'dlg_skip');
        this.state = next;
        break;
      }
      case 'self_on': r.selfPlate = true; r.status = copy('p03_self_plate_on'); break;
      case 'self_off': r.selfPlate = false; r.status = copy('p03_self_plate_off'); break;
      case 'self_try': r.selfPlate = false; r.status = copy('p03_self_plate_off'); break; // crossed is untouched: the closed gate stops the player in front of it
      case 'confirm_reset': r.confirmReset = actionId.replace('_reset', '') as NonNullable<Runtime['confirmReset']>; break;
      case 'confirm_no': r.confirmReset = null; break;
      case 'confirm_return': r.confirmReturn = true; r.status = ''; break;
      case 'confirm_return_no': r.confirmReturn = false; break;
      case 'hint_open': r.hintOpen = true; r.status = ''; break;
      case 'hint_close': r.hintOpen = false; break;
      case 'credits_open': this.onCredits?.(); break;
      case 'confirm_yes': this.confirmResetYes(source); break;
    }
  }

  /** Confirmed reset: applies the reducer command for the pending puzzle. */
  confirmResetYes(source: 'mouse' | 'keyboard' | 'api' = 'api'): boolean {
    const which = this.rt.confirmReset;
    if (!which) return false;
    this.rt.confirmReset = null;
    const cmd = { type: `${which}_reset` } as Command;
    const prev = this.state;
    const r = reduce(prev, cmd);
    if (!r.ok) { this.setStatus(r.reason); this.emit([], prev); return false; }
    this.state = r.state;
    normalize(this.state);
    this.rt.status = '';
    this.log.push({ actionId: `${which}_reset_confirmed`, source, accepted: true, cmd });
    this.emit(r.events, prev);
    return true;
  }
  /** Called before pause/save: the observation is closed so only the stable gate_near state is ever persisted. */
  settle() { if (this.rt.selfPlate) { this.rt.selfPlate = false; this.emit([], this.state); } }
  closeHint() { if (this.rt.hintOpen) { this.rt.hintOpen = false; this.emit([], this.state); } }
  cancelReset() { this.rt.confirmReset = null; this.rt.confirmReturn = false; this.emit([], this.state); }
  closePractice() { if (this.rt.practiceOpen) { this.rt.practiceOpen = false; this.emit([], this.state); } }

  setStatus(text: string) { this.rt.status = text; this.emit([], this.state); }
  highlight(ms = 2000) { this.rt.highlightUntil = this.now() + ms; this.emit([], this.state); }
}
