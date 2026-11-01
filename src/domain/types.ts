export const MILESTONES = [
  'ROOM', 'ARRIVAL', 'P01_DONE', 'P02_DONE', 'P03_DONE', 'P04_DONE', 'P05_DONE', 'RETURN_OPEN', 'ENDING',
] as const;
export type Milestone = (typeof MILESTONES)[number];

export const ANCHORS = [
  'room', 'arrival', 'p01_panel', 'mill', 'gate_near', 'gate_far', 'wall_base', 'wall_top',
  'observatory', 'castle', 'portal_front', 'portal_back', 'home',
] as const;
export type Anchor = (typeof ANCHORS)[number];

export type View = 'front' | 'wall_side' | 'observe' | 'apparatus_side' | 'portal_front' | 'portal_back';
export type TotoAnchor = 'party' | 'p03_plate' | 'p06_front' | 'p06_back';
export type SlotId = 'auto' | 'manual-1' | 'manual-2' | 'manual-3';

export interface GameState {
  progress: { milestone: Milestone; activeManualSlot: SlotId | null };
  player: { anchor: Anchor; view: View };
  toto: { mode: 'follow' | 'wait'; anchor: TotoAnchor };
  puzzles: {
    p01: { rotation: number; solved: boolean };
    p02: { drain: 'open' | 'closed'; stopper: 'locked' | 'released'; solved: boolean };
    p03: { gateLatched: boolean; crossed: boolean; solved: boolean };
    p04: { sideSeen: boolean; climbed: boolean; solved: boolean };
    p05: { a: number; b: number; solved: boolean };
    p06: { portalLatched: boolean; solved: boolean };
  };
  dialogue: { seenIds: string[]; activeId: string | null; lineIndex: number; queue: string[] };
  hints: { P01: number; P02: number; P03: number; P04: number; P05: number; P06: number };
}

export type Era = 'ROOM' | 'E0' | 'E1' | 'E2' | 'E3';

export const milestoneIndex = (m: Milestone): number => MILESTONES.indexOf(m);
export const atLeast = (s: GameState, m: Milestone): boolean => milestoneIndex(s.progress.milestone) >= milestoneIndex(m);
