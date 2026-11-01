import { objectiveRules } from '../content/load';
import type { GameState } from './types';

const flagValue = (g: GameState, path: string): unknown => {
  const [puzzle, field] = path.split('.') as [keyof GameState['puzzles'], string];
  return (g.puzzles[puzzle] as unknown as Record<string, unknown>)[field];
};

/** Current objective line (data/objectives.json, first matching rule wins), or null when none applies. */
export function currentObjective(g: GameState): { id: string; text: string } | null {
  for (const r of objectiveRules) {
    if (!r.milestones.includes(g.progress.milestone)) continue;
    if (r.anchors && !r.anchors.includes(g.player.anchor)) continue;
    if (r.flags && !Object.entries(r.flags).every(([k, v]) => flagValue(g, k) === v)) continue;
    return { id: r.id, text: r.text };
  }
  return null;
}
