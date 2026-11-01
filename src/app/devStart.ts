// Dev-only. Imported only behind `import.meta.env.DEV`, so none of this reaches the shipped bundle (tools/check-bundle.mjs).
import type { GameState } from '../domain/types';

export async function devGame(name: string): Promise<GameState> {
  const fx = name === 'M1A_P05' ? await import('../../tests/fixtures/starts/m1a_p05.json') : await import('../../tests/fixtures/starts/m1a_p04.json');
  return structuredClone(fx.default.slot.game) as unknown as GameState;
}
