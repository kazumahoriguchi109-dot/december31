import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createState } from '../../src/journey/model';
import { clearJourney, loadJourney, loadPreferences, saveJourney, savePreferences } from '../../src/journey/persistence';

const key = 'dec31-evolution-c013:journey';
let records: Map<string, string>;
let storage: {getItem:ReturnType<typeof vi.fn>;setItem:ReturnType<typeof vi.fn>;removeItem:ReturnType<typeof vi.fn>};
beforeEach(() => {
  records = new Map([['december31', 'legacy data must survive']]);
  storage = {
    getItem:vi.fn((k:string)=>records.get(k)??null),
    setItem:vi.fn((k:string,v:string)=>{records.set(k,v);}),
    removeItem:vi.fn((k:string)=>{records.delete(k);}),
  };
  vi.stubGlobal('localStorage',storage);
});
afterEach(()=>vi.unstubAllGlobals());

describe('isolated evolution persistence',()=>{
  it('round trips a validated snapshot without touching legacy storage or sharing references',()=>{
    const state = createState();
    expect(saveJourney(state)).toBe(true);
    const loaded = loadJourney();
    expect(loaded).toEqual(state);
    state.seen.push('later mutation');
    expect(loadJourney()?.seen).not.toContain('later mutation');
    if (loaded) loaded.player.x += 1;
    expect(loadJourney()?.player.x).not.toBe(loaded?.player.x);
    expect([...records.keys()].sort()).toEqual(['december31',key].sort());
    expect(storage.getItem.mock.calls.every(([k])=>k===key)).toBe(true);
  });
  it('rejects malformed and structurally invalid state without overwriting a good save',()=>{
    expect(saveJourney(createState())).toBe(true);
    const saved = records.get(key);
    expect(saveJourney({...createState(), era:99} as any)).toBe(false);
    expect(records.get(key)).toBe(saved);
    records.set(key,'{truncated'); expect(loadJourney()).toBeNull();
    records.set(key,JSON.stringify({version:3})); expect(loadJourney()).toBeNull();
  });
  it('keeps preferences when clearing the journey, and preserves other namespaces',()=>{
    expect(savePreferences({volume:0,reducedMotion:true})).toBe(true);
    expect(saveJourney(createState())).toBe(true);
    clearJourney();
    expect(loadJourney()).toBeNull();
    expect(loadPreferences()).toEqual({volume:0,reducedMotion:true});
    expect(records.get('december31')).toBe('legacy data must survive');
    expect(storage.removeItem).toHaveBeenCalledExactlyOnceWith(key);
  });
  it('never reads, writes, migrates or deletes earlier namespaces even with valid same-schema saves',()=>{
    const sentinels=new Map([
      ['dec31-evolution-c012:journey',JSON.stringify(createState())],
      ['dec31-evolution-c012:preferences',JSON.stringify({volume:.3,reducedMotion:true})],
      ['dec31-evolution-c011:journey',JSON.stringify(createState())],
      ['dec31-evolution-c011:preferences',JSON.stringify({volume:.3,reducedMotion:true})],
      ['dec31-evolution-c010:journey',JSON.stringify(createState())],
      ['dec31-evolution-c010:preferences',JSON.stringify({volume:.3,reducedMotion:true})],
      ['dec31-evolution-c009:journey',JSON.stringify(createState())],
      ['dec31-evolution-c009:preferences',JSON.stringify({volume:.3,reducedMotion:true})],
      ['dec31-evolution-c008:journey',JSON.stringify(createState())],
      ['dec31-evolution-c008:preferences',JSON.stringify({volume:.3,reducedMotion:true})],
      ['dec31-evolution-c007:journey',JSON.stringify(createState())],
      ['dec31-evolution-c007:preferences',JSON.stringify({volume:.3,reducedMotion:true})],
      ['dec31-evolution-c006:journey',JSON.stringify(createState())],
      ['dec31-evolution-c006:preferences',JSON.stringify({volume:.3,reducedMotion:true})],
      ['dec31-evolution-v3:journey',JSON.stringify(createState())],
      ['dec31-evolution-v3:preferences',JSON.stringify({volume:0,reducedMotion:true})],
      ['dec31-evolution-v2:journey',JSON.stringify({...createState(),version:2})],
      ['dec31-evolution-v2:preferences',JSON.stringify({volume:.1,reducedMotion:true})],
      ['december31','legacy original data'],
    ]);
    for(const [k,v] of sentinels)records.set(k,v);
    expect(loadJourney()).toBeNull();expect(loadPreferences()).toEqual({volume:.65,reducedMotion:false});
    expect(saveJourney(createState())).toBe(true);
    expect(savePreferences({volume:.5,reducedMotion:false})).toBe(true);
    expect(loadJourney()).toEqual(createState());
    expect(loadPreferences()).toEqual({volume:.5,reducedMotion:false});
    clearJourney();
    for(const [k,v] of sentinels)expect(records.get(k)).toBe(v);
    for(const method of [storage.getItem,storage.setItem,storage.removeItem])
      expect(method.mock.calls.every(([k])=>k==='dec31-evolution-c013:journey'||k==='dec31-evolution-c013:preferences')).toBe(true);
  });
  it('returns failure on quota denial without claiming to save; blocked reads use safe defaults',()=>{
    storage.setItem.mockImplementation(()=>{throw new Error('QuotaExceededError');});
    expect(saveJourney(createState())).toBe(false);
    expect(savePreferences({volume:0,reducedMotion:true})).toBe(false);
    storage.getItem.mockImplementation(()=>{throw new Error('SecurityError');});
    expect(loadJourney()).toBeNull();
    expect(loadPreferences()).toEqual({volume:.65,reducedMotion:false});
    storage.removeItem.mockImplementation(()=>{throw new Error('SecurityError');});
    expect(()=>clearJourney()).not.toThrow();
  });
  it('rejects invalid preferences and does not retain arbitrary input fields',()=>{
    expect(savePreferences({volume:NaN,reducedMotion:false})).toBe(false);
    expect(savePreferences({volume:1.1,reducedMotion:false})).toBe(false);
    expect(savePreferences({volume:.2,reducedMotion:true,extra:'ignored'} as any)).toBe(true);
    expect(loadPreferences()).toEqual({volume:.2,reducedMotion:true});
    records.set('dec31-evolution-c013:preferences',JSON.stringify({volume:-1,reducedMotion:false}));
    expect(loadPreferences()).toEqual({volume:.65,reducedMotion:false});
  });
});
