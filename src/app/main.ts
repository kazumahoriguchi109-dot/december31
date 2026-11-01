import { Game } from './game';
import { Shell } from './shell';
import { mountUi } from '../ui/view';
import { world } from '../content/load';
import type { GameState } from '../domain/types';

const root = document.getElementById('app')!;
const params = new URLSearchParams(location.search);

async function initialState(): Promise<GameState | null> {
  // Fixtures exist only in the dev server; the dead branch is removed from the shipped bundle.
  if (import.meta.env.DEV) {
    const name = params.get('start') ?? 'M1A_P04';
    const fx = name === 'M1A_P05'
      ? await import('../../tests/fixtures/starts/m1a_p05.json')
      : await import('../../tests/fixtures/starts/m1a_p04.json');
    return structuredClone(fx.default.slot.game) as unknown as GameState;
  }
  return null;
}

async function boot() {
  // Dev-only direct starts (no storage) keep the M1a fixtures usable; everything else is the real app shell.
  if (!(import.meta.env.DEV && params.has('start'))) {
    const shell = new Shell(root, {});
    if (import.meta.env.DEV) { // dev-only test seam; check-bundle proves it is not in the shipped build
      const w = window as unknown as { __d31shell: unknown; __d31: unknown };
      w.__d31shell = shell;
      w.__d31 = {
        shell,
        state: () => structuredClone(shell.internals().game.state),
        log: () => structuredClone(shell.internals().game.log),
      };
    }
    await shell.start();
    return;
  }
  const state = await initialState();
  if (!state) return;
  const game = new Game(state);
  game.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // render-only overrides, kept outside authoritative state; dev only
  const dev = import.meta.env.DEV;
  const eraParam = dev ? params.get('era') : null;
  const camParam = dev ? params.get('cam') : null;
  const p05Param = dev ? params.get('p05') : null; // "a,b" to draw any of the nine settings without playing
  const era = () => eraParam ?? (world.eraByMilestone[game.state.progress.milestone] ?? 'E2');

  const ui = mountUi(root, game, {
    era,
    presetOverride: () => camParam,
    p05Override: () => {
      if (!p05Param) return null;
      const [a, b] = p05Param.split(',').map(Number);
      return { a: a ?? 0, b: b ?? 0 };
    },
  });
  void ui;
  if (dev) {
    (window as unknown as { __d31: unknown }).__d31 = {
      game,
      state: () => structuredClone(game.state),
      log: () => structuredClone(game.log),
      objective: () => document.getElementById('obj-text')?.textContent ?? '',
      setReduced: (v: boolean) => { game.reducedMotion = v; },
    };
  }
}
void boot();
