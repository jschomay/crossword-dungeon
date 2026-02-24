import { describe, it, expect } from 'vitest';
import { validateIpuz, computePotentialLevel, computePotentialLevels } from './puzzle';
import testPuzzleJson from '../puzzles/test-potential.json';

// Layout (x=col, y=row):
//   x: 0  1  2  3  4
// y=0: A  B  #  C  D
// y=1: E  F  #  G  H
// y=2: I  J  #  K  L
//
// Words:
//   Across: AB(y=0), EF(y=1), IJ(y=2), CD(y=0), GH(y=1), KL(y=2)
//   Down: AEI(x=0), BFJ(x=1), CGK(x=3), DHL(x=4)
//   Col x=2 is all black — separates left and right halves on every row

const ipuz = validateIpuz(testPuzzleJson);

describe('computePotentialLevel', () => {
  it('counts both words for a cell at intersection of 2-letter across and 3-letter down', () => {
    // A(0,0): across AB (len 2) + down AEI (len 3) → (2-1)+(3-1) = 3
    expect(computePotentialLevel(ipuz, { x: 0, y: 0 })).toBe(3);
  });

  it('does not count letters from a different word separated by a black cell on the same row', () => {
    // A(0,0) is only in across word AB (len 2), not CD — black cell at x=2 separates them
    // If naively counting all non-black cells in row: A,B,C,D = 4 → across contribution would be 3
    // Correct: across is just AB, contribution is 1
    expect(computePotentialLevel(ipuz, { x: 0, y: 0 })).toBe(3); // not 5
    expect(computePotentialLevel(ipuz, { x: 3, y: 0 })).toBe(3); // C: CD(2)+CGK(3) = 3, not inflated by AB
  });

  it('does not count letters from a different word separated by a black cell in the same column', () => {
    // No column separation in this fixture, but the col-2 black cells confirm column words stop at #
    // A(0,0): down word AEI goes through E(0,1) and I(0,2) — all non-black, len 3
    // If there were a # in the middle of the column it would stop there
    expect(computePotentialLevel(ipuz, { x: 0, y: 1 })).toBe(3); // E: EF(2)+AEI(3) = 3
  });

  it('counts the interior cell of a 3-letter down word correctly', () => {
    // F(1,1): across EF (len 2) + down BFJ (len 3) → 1+2 = 3
    expect(computePotentialLevel(ipuz, { x: 1, y: 1 })).toBe(3);
  });

  it('caps at 8', () => {
    const bigIpuz = validateIpuz({
      version: 'http://ipuz.org/v1',
      kind: ['http://ipuz.org/crossword#1'],
      dimensions: { width: 9, height: 9 },
      puzzle: Array.from({ length: 9 }, () => Array(9).fill(1)),
      solution: Array.from({ length: 9 }, () => Array(9).fill('A')),
      clues: { Across: [], Down: [] },
    });
    // Center cell(4,4): across len 9 + down len 9 → (9-1)+(9-1)=16, capped at 8
    expect(computePotentialLevel(bigIpuz, { x: 4, y: 4 })).toBe(8);
  });
});

describe('computePotentialLevels', () => {
  it('returns 0 for black cells', () => {
    const levels = computePotentialLevels(ipuz);
    // Entire column x=2 is black
    expect(levels[0][2]).toBe(0);
    expect(levels[1][2]).toBe(0);
    expect(levels[2][2]).toBe(0);
  });

  it('returns correct levels for all cells', () => {
    const levels = computePotentialLevels(ipuz);
    // Every non-black cell is in a 2-letter across word and a 3-letter down word → 1+2=3
    expect(levels[0]).toEqual([3, 3, 0, 3, 3]);
    expect(levels[1]).toEqual([3, 3, 0, 3, 3]);
    expect(levels[2]).toEqual([3, 3, 0, 3, 3]);
  });
});
