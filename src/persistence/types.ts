import type { GameState, SlotId } from '../domain/types';

export const SLOT_IDS: readonly SlotId[] = ['auto', 'manual-1', 'manual-2', 'manual-3'];
export const MANUAL_IDS: readonly SlotId[] = ['manual-1', 'manual-2', 'manual-3'];

export interface SlotRecord {
  schemaVersion: 1; contentVersion: '1.0'; slotId: SlotId; runId: string; revision: number;
  createdAt: string; updatedAt: string; playTimeMs: number; game: GameState;
}
export interface SettingsRecord {
  settingsRevision: number; masterVolume: number; musicVolume: number; sfxVolume: number;
  textSize: 'small' | 'standard' | 'large'; textSpeed: 'instant' | 'slow' | 'normal';
  reduceMotion: boolean; labelsAlways: boolean; quality: 'low' | 'standard';
}
export interface MetaRecord { writeRevision: number; writerEpoch: number; lastPlayedSlotId: SlotId | null }
export interface QuarantineRecord {
  archiveKey: string; sourceSlotId: 'auto'; archivedAt: string; archiveRevision: number;
  rawAuto: unknown; backupPresent: boolean; rawBackup: unknown;
}
export interface ExportEnvelope { format: 'december31-save'; exportedAt: string; unsaved: boolean; slot: SlotRecord; settings: SettingsRecord }

export type ErrorCode = 'E_STORAGE' | 'E_CORRUPT' | 'E_VERSION' | 'E_CAPABILITY' | 'E_TAB' | 'E_CONFLICT';
export class SaveError extends Error {
  constructor(readonly code: ErrorCode, message: string, readonly detail?: unknown) { super(`${code}: ${message}`); this.name = 'SaveError'; }
}

export type SlotRead =
  | { status: 'empty' }
  | { status: 'ok'; slot: SlotRecord }
  | { status: 'corrupt'; raw: unknown; reasons: string[] }
  | { status: 'future'; raw: unknown; schemaVersion: number };

export const defaultSettings = (reduceMotion = false): SettingsRecord => ({
  settingsRevision: 1, masterVolume: 0.7, musicVolume: 0.6, sfxVolume: 0.8, textSize: 'standard',
  textSpeed: 'instant', reduceMotion, labelsAlways: false, quality: 'standard',
});
