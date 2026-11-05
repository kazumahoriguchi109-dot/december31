import type { JourneyState } from './contract';
import { validateSave } from './model';

// Cycle-specific namespace: cycle004/005 v3 records and earlier saves remain untouched.
// State schema version and preview namespace are independent. No automatic migration or legacy reads.
const JOURNEY_KEY = 'dec31-evolution-c013:journey';
const PREFERENCES_KEY = 'dec31-evolution-c013:preferences';
export interface JourneyPreferences { volume: number; reducedMotion: boolean }
const defaults = (): JourneyPreferences => ({ volume: .65, reducedMotion: false });

export function loadJourney(): JourneyState | null {
  try {
    const json = localStorage.getItem(JOURNEY_KEY);
    return json === null ? null : validateSave(JSON.parse(json));
  } catch { return null; }
}

export function saveJourney(state: JourneyState): boolean {
  try {
    // Validate a JSON snapshot so later model mutations cannot affect the stored record.
    const snapshot = validateSave(JSON.parse(JSON.stringify(state)));
    if (!snapshot) return false;
    localStorage.setItem(JOURNEY_KEY, JSON.stringify(snapshot));
    return true;
  } catch { return false; } // quota, privacy-mode storage denial, cyclic input or unavailable browser storage
}

export function clearJourney(): void {
  try { localStorage.removeItem(JOURNEY_KEY); } catch { /* callers can continue without writable storage */ }
}

function validPreferences(value: unknown): value is JourneyPreferences {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Partial<JourneyPreferences>;
  return typeof p.volume === 'number' && Number.isFinite(p.volume) && p.volume >= 0 && p.volume <= 1 && typeof p.reducedMotion === 'boolean';
}
export function loadPreferences(): JourneyPreferences {
  try {
    const json = localStorage.getItem(PREFERENCES_KEY);
    if (json === null) return defaults();
    const value: unknown = JSON.parse(json);
    return validPreferences(value) ? { volume: value.volume, reducedMotion: value.reducedMotion } : defaults();
  } catch { return defaults(); }
}
export function savePreferences(preferences: JourneyPreferences): boolean {
  try {
    if (!validPreferences(preferences)) return false;
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({volume:preferences.volume,reducedMotion:preferences.reducedMotion}));
    return true;
  } catch { return false; }
}
