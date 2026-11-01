// Authoritative design data is imported as-is; nothing here edits or re-derives it.
import worldJson from '../../data/world.json';
import puzzlesJson from '../../data/puzzles.json';
import dialogueJson from '../../data/dialogue.json';
import objectivesJson from '../../data/objectives.json';
import uiCopyJson from '../../data/ui_copy.json';

export interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  projection: 'orthographic' | 'perspective';
  near: number;
  far: number;
  aspect: number;
  frustum: { left: number; right: number; top: number; bottom: number } | null;
  verticalFovDegrees: number | null;
}
export interface AnchorDef {
  id: string;
  position: [number, number, number];
  space: string;
  allowedViews: string[];
  defaultView: string;
  cameraByView: Record<string, string>;
  minMilestone: string;
}
export interface WorldEdge { from: string; to: string; guard: string; bidirectional: boolean }

export const world = worldJson as unknown as {
  anchorDefinitions: AnchorDef[];
  cameraPresets: Record<string, CameraPreset>;
  edges: WorldEdge[];
  eraByMilestone: Record<string, string>;
  p05LocalToWorld: { origin: [number, number, number]; scale: number };
  totoAnchorDefinitions: Record<string, { position?: [number, number, number] }>;
};
export const puzzles = puzzlesJson as unknown as {
  p05Projection: {
    zStops: number[]; targetRadius: number; viewportHalfExtent: number;
    fixed: { radius: number; z: number; startDegrees: number; endDegrees: number };
    a: { radius: number; startDegrees: number; endDegrees: number };
    b: { radius: number; startDegrees: number; endDegrees: number };
    radialWidthLocal: { fixed: number; a: number; b: number };
  };
  p04Geometry: {
    boxes: { id: string; min: number[]; max: number[] }[];
    frontMaskPolygonUV: number[][];
    route: number[][];
  };
};
export const dialogueIds: ReadonlySet<string> = new Set(
  (dialogueJson as unknown as { rows: { id: string }[] }).rows.map((r) => r.id),
);

export interface ObjectiveRule {
  id: string;
  text: string;
  milestones: string[];
  anchors?: string[];
  flags?: Record<string, boolean>;
}
export const objectiveRules = (objectivesJson as unknown as { objectives: ObjectiveRule[] }).objectives;
export const uiCopy = (uiCopyJson as unknown as { copy: Record<string, string> }).copy;
export const copy = (key: string): string => {
  const v = uiCopy[key];
  if (v === undefined) throw new Error(`missing ui copy key: ${key}`);
  return v;
};

export const anchorDef = (id: string): AnchorDef => {
  const d = world.anchorDefinitions.find((a) => a.id === id);
  if (!d) throw new Error(`unknown anchor ${id}`);
  return d;
};
