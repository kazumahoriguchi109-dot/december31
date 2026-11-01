import validateEnvelope from '../content/generated/saveValidator.mjs';
import { validateGame } from '../domain/invariants';
import { defaultSettings, SLOT_IDS, type ExportEnvelope, type SlotRead, type SlotRecord } from './types';

const isIso = (s: unknown) => typeof s === 'string' && !Number.isNaN(Date.parse(s));

/** Structure (generated schema validator) then meaning (domain invariants). Never repairs. */
export function checkEnvelope(env: unknown): string[] {
  if (!validateEnvelope(env)) {
    return (validateEnvelope.errors ?? []).slice(0, 8).map((e) => `${e.instancePath || '/'} ${e.message ?? e.keyword}`);
  }
  const e = env as ExportEnvelope;
  const errs: string[] = [];
  if (!isIso(e.exportedAt) || !isIso(e.slot.createdAt) || !isIso(e.slot.updatedAt)) errs.push('bad timestamp');
  errs.push(...validateGame(e.slot.game));
  const bound = e.slot.game.progress.activeManualSlot;
  if (bound !== null && !SLOT_IDS.includes(bound)) errs.push('activeManualSlot unknown');
  return errs;
}

/** Validates one stored slot by wrapping it in an envelope (the schema defines the slot as a property of it). */
export function classifySlot(raw: unknown, expectedId: string): SlotRead {
  if (raw === undefined || raw === null) return { status: 'empty' };
  const v = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof v === 'number' && Number.isInteger(v) && v > 1) return { status: 'future', raw, schemaVersion: v };
  const reasons = checkEnvelope({ format: 'december31-save', exportedAt: new Date().toISOString(), unsaved: false, slot: raw, settings: defaultSettings() });
  if ((raw as SlotRecord).slotId !== expectedId) reasons.push(`slotId does not match key ${expectedId}`);
  return reasons.length ? { status: 'corrupt', raw, reasons } : { status: 'ok', slot: raw as SlotRecord };
}
