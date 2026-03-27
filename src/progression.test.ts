import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getProgressionIndex, isTutorial, completeTutorial, consumeProgression } from './progression';

// Mock localStorage
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
});

// Mock window.location.search (no ?puzzle= override)
vi.stubGlobal('window', { location: { search: '' } });

const STORAGE_KEY = 'crossword_dungeon_progression';

beforeEach(() => {
  delete store[STORAGE_KEY];
});

describe('isTutorial', () => {
  it('returns true for a brand new player (no progression stored)', () => {
    expect(isTutorial()).toBe(true);
  });

  it('returns false once progression has advanced past tutorial', () => {
    store[STORAGE_KEY] = '1';
    expect(isTutorial()).toBe(false);
  });

  it('returns false at higher progression indices', () => {
    store[STORAGE_KEY] = '10';
    expect(isTutorial()).toBe(false);
  });
});

describe('completeTutorial', () => {
  it('advances progression index to 1', () => {
    expect(getProgressionIndex()).toBe(0);
    completeTutorial();
    expect(getProgressionIndex()).toBe(1);
  });

  it('calling again does not double-advance', () => {
    completeTutorial();
    completeTutorial();
    expect(getProgressionIndex()).toBe(1);
  });
});

describe('consumeProgression after tutorial', () => {
  it('does not bump progression during tutorial', () => {
    // index=0 = tutorial, should not bump
    consumeProgression();
    expect(getProgressionIndex()).toBe(0);
  });

  it('bumps progression for normal puzzles', () => {
    store[STORAGE_KEY] = '1';
    consumeProgression();
    expect(getProgressionIndex()).toBe(2);
  });

  it('returns puzzle 1 at index 1', () => {
    store[STORAGE_KEY] = '1';
    const { puzzleNumber, parityFlip } = consumeProgression();
    expect(puzzleNumber).toBe(1);
    expect(parityFlip).toBe(false);
  });

  it('returns puzzle 1 with parityFlip at index 2', () => {
    store[STORAGE_KEY] = '2';
    const { puzzleNumber, parityFlip } = consumeProgression();
    expect(puzzleNumber).toBe(1);
    expect(parityFlip).toBe(true);
  });

  it('returns puzzle 2 at index 3', () => {
    store[STORAGE_KEY] = '3';
    const { puzzleNumber } = consumeProgression();
    expect(puzzleNumber).toBe(2);
  });
});
