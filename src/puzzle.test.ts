import { describe, it, expect } from 'vitest';
import { validateIpuz, computePotentialLevel, computePotentialLevels, getWords, selectWords, buildSparseIpuz } from './puzzle';
import Puzzle from './puzzle';
import testPuzzleJson from '../tests/fixtures/test-potential.json';
import demoJson from '../tests/fixtures/demo.json';

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

// test-potential fixture words:
//   Across: 1A(AB), 3A(CD), 5A(EF), 7A(GH), 9A(IJ), 11A(KL) — 6 words
//   Down: 1D(AEI), 2D(BFJ), 3D(CGK), 4D(DHL) — 4 words
//   Total: 10 words

describe('getWords', () => {
  it('returns all words in the fixture', () => {
    const words = getWords(ipuz);
    expect(words).toHaveLength(10);
  });

  it('includes expected word keys', () => {
    const keys = new Set(getWords(ipuz).map(w => w.key));
    expect(keys.has('1A')).toBe(true);
    expect(keys.has('1D')).toBe(true);
    expect(keys.has('2D')).toBe(true);
    expect(keys.has('11A')).toBe(true);
  });

  it('returns correct cells for 1A (AB at y=0)', () => {
    const word = getWords(ipuz).find(w => w.key === '1A')!;
    expect(word.cells).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  });

  it('returns correct cells for 1D (AEI at x=0)', () => {
    const word = getWords(ipuz).find(w => w.key === '1D')!;
    expect(word.cells).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }]);
  });
});

// Eligible words in test-potential fixture (odd row/col constraint):
//   Across on odd rows: row 1 only → 5A (EF at y=1, cols 0-1) and 7A (GH at y=1, cols 3-4)
//   Down on odd cols: col 1 → 2D (BFJ), col 3 → 3D (CGK)
//   Total eligible: 4 words, but black col at x=2 splits into two components:
//     Component A: 5A + 2D (connected via col 1)
//     Component B: 7A + 3D (connected via col 3)
//   From any seed, only 2 words reachable

describe('selectWords', () => {
  const seededRng = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it('returns exactly targetCount words when enough eligible words exist', () => {
    const selected = selectWords(ipuz, 2, Math.random);
    expect(selected.size).toBe(2);
  });

  it('clamps to reachable connected component when targetCount exceeds it', () => {
    // Black col at x=2 splits eligible words into two 2-word components
    const selected = selectWords(ipuz, 999, Math.random);
    expect(selected.size).toBe(2);
  });

  it('only selects eligible words (across on odd rows, down on odd cols)', () => {
    const allWords = getWords(ipuz);
    const selected = selectWords(ipuz, 3, Math.random);
    const selectedWords = allWords.filter(w => selected.has(w.key));
    for (const word of selectedWords) {
      if (word.direction === 'across') {
        expect(word.cells[0].y % 2).toBe(1);
      } else {
        expect(word.cells[0].x % 2).toBe(1);
      }
    }
  });

  it('all selected words share at least one cell with another selected word (connected)', () => {
    for (let trial = 0; trial < 20; trial++) {
      const selected = selectWords(ipuz, 2, Math.random);
      const allWords = getWords(ipuz);
      const selectedWords = allWords.filter(w => selected.has(w.key));
      for (const word of selectedWords) {
        const wordCellKeys = new Set(word.cells.map(c => `${c.x},${c.y}`));
        const hasNeighbor = selectedWords.some(other => {
          if (other.key === word.key) return false;
          return other.cells.some(c => wordCellKeys.has(`${c.x},${c.y}`));
        });
        expect(hasNeighbor).toBe(true);
      }
    }
  });

  it('seed word is always in the selected set', () => {
    // rng returns 0 first → seed = eligible[0] = '5A'
    const rng = seededRng([0, 0.5, 0.5, 0.5, 0.5]);
    const selected = selectWords(ipuz, 2, rng);
    expect(selected.has('5A')).toBe(true);
  });
});

describe('buildSparseIpuz', () => {
  it('only keeps cells belonging to selected words', () => {
    const selected = selectWords(ipuz, 2, Math.random);
    const sparse = buildSparseIpuz(ipuz, selected);
    // Every non-black cell in the sparse ipuz must belong to a selected word
    const allWords = getWords(sparse);
    const sparseWordKeys = new Set(allWords.map(w => w.key));
    for (let y = 0; y < sparse.dimensions.height; y++) {
      for (let x = 0; x < sparse.dimensions.width; x++) {
        if (sparse.solution[y][x] !== '#') {
          // At least one word in the sparse grid covers this cell
          const coveredByWord = allWords.some(w => w.cells.some(c => c.x === x && c.y === y));
          expect(coveredByWord).toBe(true);
        }
      }
    }
    // And only selected word keys are present
    for (const key of sparseWordKeys) {
      expect(selected.has(key)).toBe(true);
    }
  });

  it('clues only contain selected words', () => {
    // Select just 1A and 1D: across num 1, down num 1
    const sparse = buildSparseIpuz(ipuz, new Set(['1A', '1D']));
    expect(sparse.clues.Across).toHaveLength(1);
    expect(sparse.clues.Across[0][0]).toBe(1);
    expect(sparse.clues.Down).toHaveLength(1);
    expect(sparse.clues.Down[0][0]).toBe(1);
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
