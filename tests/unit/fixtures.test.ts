import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync, readdirSync } from 'node:fs';
import { validateGame } from '../../src/domain/invariants';
import type { GameState } from '../../src/domain/types';

const read = (p: string) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));
const schema = read('data/save.schema.json');
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateEnvelope = ajv.compile(schema);
const starts = readdirSync(new URL('../fixtures/starts/', import.meta.url)).filter((f) => f.endsWith('.json'));

describe('development start fixtures obey the same validation as the shipped game', () => {
  it('has the two M1a starts', () => expect([...starts].sort()).toEqual(['m1a_p04.json', 'm1a_p05.json']));
  for (const f of starts) {
    const env = read(`tests/fixtures/starts/${f}`);
    it(`${f}: schema (structure)`, () => {
      const ok = validateEnvelope(env);
      expect(validateEnvelope.errors ?? []).toEqual([]);
      expect(ok).toBe(true);
    });
    it(`${f}: semantic invariants`, () => expect(validateGame(env.slot.game)).toEqual([]));
  }
  it('the example save from the design package is valid too', () => {
    const env = read('data/save.example.json');
    expect(validateEnvelope(env)).toBe(true);
    expect(validateGame(env.slot.game)).toEqual([]);
  });
  it('keeps the next dialogue unread', () => {
    const p04 = read('tests/fixtures/starts/m1a_p04.json').slot.game as GameState;
    const p05 = read('tests/fixtures/starts/m1a_p05.json').slot.game as GameState;
    expect(p04.dialogue.seenIds).not.toContain('D040');
    expect(p05.dialogue.seenIds).toContain('D043');
    expect(p05.dialogue.seenIds).not.toContain('D050');
    expect(p05.dialogue.seenIds).not.toContain('D041');
  });
});

describe('validation is not weakened: contradictory states are rejected', () => {
  const base = () => structuredClone(read('tests/fixtures/starts/m1a_p05.json').slot.game) as GameState;
  const cases: [string, (g: GameState) => void][] = [
    ['P04_DONE but p04 not solved', (g) => { g.puzzles.p04 = { sideSeen: false, climbed: false, solved: false }; }],
    ['P03 solved without latch', (g) => { g.puzzles.p03.gateLatched = false; }],
    ['P05 solved flag with a0', (g) => { g.puzzles.p05 = { a: 0, b: 1, solved: true }; }],
    ['observatory before P04_DONE', (g) => { g.progress.milestone = 'P03_DONE'; g.puzzles.p04 = { sideSeen: false, climbed: false, solved: false }; }],
    ['toto waiting at plate after P03_DONE', (g) => { g.toto = { mode: 'wait', anchor: 'p03_plate' }; }],
    ['unknown dialogue id', (g) => { g.dialogue.seenIds.push('D999'); }],
    ['view not allowed at anchor', (g) => { g.player.view = 'wall_side'; }],
    ['hint for future puzzle', (g) => { g.hints.P06 = 1; }],
  ];
  for (const [name, mutate] of cases) {
    it(name, () => { const g = base(); mutate(g); expect(validateGame(g).length).toBeGreaterThan(0); });
  }
});
