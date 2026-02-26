import { describe, it, expect } from 'vitest';
import { validateIpuz, computePotentialLevel, computePotentialLevels } from './puzzle';
import Puzzle from './puzzle';
import testPuzzleJson from '../puzzles/test-potential.json';
import demoJson from '../puzzles/demo.json';

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

// Demo puzzle layout:
//   x: 0    1    2    3
// y=0: C    A    #    #
// y=1: B    O    T    S
// y=2: null L    O    #
//
// Across: CA(1,"OR neighbor"), BOTS(3,"Droids"), LO(5,"Behold!")
// Down: CB(1,"Trucker's radio"), AOL(2,"MSN competitor"), TO(4,"A preposition")
// Puzzle cells: (0,0)={cell:1,...}, (1,0)=2(plain number), (3,1)=null(no clue number)

describe('getCluesAt', () => {
  const demoPuzzle = new Puzzle(validateIpuz(demoJson));

  it('returns both clues for a cell at a word intersection', () => {
    // O(1,1): across BOTS ("Droids") + down AOL ("MSN competitor")
    // Cell at (1,1) is an object with style but no cell number — word start is (0,1) for across, (1,0) for down
    const clues = demoPuzzle.getCluesAt({ x: 1, y: 1 });
    expect(clues).toHaveLength(2);
    expect(clues).toContainEqual({ direction: 'Across', clue: 'Droids' });
    expect(clues).toContainEqual({ direction: 'Down', clue: 'MSN competitor' });
  });

  it('reads clue number from a plain number puzzle cell', () => {
    // A(1,0): cell value is plain number 2 — across CA ("OR neighbor") + down AOL ("MSN competitor")
    const clues = demoPuzzle.getCluesAt({ x: 1, y: 0 });
    expect(clues).toContainEqual({ direction: 'Across', clue: 'OR neighbor' });
    expect(clues).toContainEqual({ direction: 'Down', clue: 'MSN competitor' });
  });

  it('reads clue number from an object-format puzzle cell', () => {
    // C(0,0): cell is { cell: 1, style: ... } — across CA ("OR neighbor") + down CB ("Trucker\'s radio")
    const clues = demoPuzzle.getCluesAt({ x: 0, y: 0 });
    expect(clues).toContainEqual({ direction: 'Across', clue: 'OR neighbor' });
    expect(clues).toContainEqual({ direction: 'Down', clue: "Trucker's radio" });
  });

  it('returns both clues for S, which now intersects down word IS', () => {
    // S(3,1): across BOTS ("Droids") + down IS ("Exists")
    const clues = demoPuzzle.getCluesAt({ x: 3, y: 1 });
    expect(clues).toHaveLength(2);
    expect(clues).toContainEqual({ direction: 'Across', clue: 'Droids' });
    expect(clues).toContainEqual({ direction: 'Down', clue: 'Exists' });
  });
});

// getWordNeighbors uses the test-potential fixture:
//   x: 0  1  2  3  4
// y=0: A  B  #  C  D
// y=1: E  F  #  G  H
// y=2: I  J  #  K  L
// Across words: AB, EF, IJ, CD, GH, KL
// Down words: AEI(x=0), BFJ(x=1), CGK(x=3), DHL(x=4)

describe('getWordNeighbors', () => {
  const puzzle = new Puzzle(ipuz);

  it('returns across and down neighbors for an intersection cell', () => {
    // A(0,0): across neighbor B(1,0), down neighbors E(0,1) and I(0,2)
    const neighbors = puzzle.getWordNeighbors({ x: 0, y: 0 });
    expect(neighbors).toHaveLength(3);
    expect(neighbors).toContainEqual({ x: 1, y: 0 });
    expect(neighbors).toContainEqual({ x: 0, y: 1 });
    expect(neighbors).toContainEqual({ x: 0, y: 2 });
  });

  it('does not include coord itself', () => {
    const neighbors = puzzle.getWordNeighbors({ x: 0, y: 0 });
    expect(neighbors).not.toContainEqual({ x: 0, y: 0 });
  });

  it('does not cross black cells to include cells from a different word', () => {
    // A(0,0): across word is AB only — C(3,0) and D(4,0) are across a black cell at x=2
    const neighbors = puzzle.getWordNeighbors({ x: 0, y: 0 });
    expect(neighbors).not.toContainEqual({ x: 3, y: 0 });
    expect(neighbors).not.toContainEqual({ x: 4, y: 0 });
  });

  it('returns only down neighbors for an interior cell of a down-only word', () => {
    // E(0,1): across word EF (len 2) → neighbor F(1,1); down word AEI → neighbors A(0,0) and I(0,2)
    const neighbors = puzzle.getWordNeighbors({ x: 0, y: 1 });
    expect(neighbors).toContainEqual({ x: 1, y: 1 }); // across neighbor
    expect(neighbors).toContainEqual({ x: 0, y: 0 }); // down neighbor above
    expect(neighbors).toContainEqual({ x: 0, y: 2 }); // down neighbor below
    expect(neighbors).toHaveLength(3);
  });

  it('returns no neighbors for a 1-letter run cell', () => {
    const soloIpuz = validateIpuz({
      version: 'http://ipuz.org/v1',
      kind: ['http://ipuz.org/crossword#1'],
      dimensions: { width: 3, height: 3 },
      puzzle: [[1, '#', 2], ['#', '#', '#'], [3, '#', 4]],
      solution: [['A', null, 'B'], [null, null, null], ['C', null, 'D']],
      clues: { Across: [], Down: [] },
    });
    // A(0,0): surrounded by black cells on all sides — no valid words
    const soloPuzzle = new Puzzle(soloIpuz);
    expect(soloPuzzle.getWordNeighbors({ x: 0, y: 0 })).toHaveLength(0);
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
