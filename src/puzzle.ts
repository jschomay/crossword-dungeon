// puzzle cell in the grid layout: "#", null, a number, a string clue-number, or an object with cell/style
type IpuzPuzzleCell = string | number | null | Record<string, unknown>;

export type Ipuz = {
  version: string;
  kind: string[];
  dimensions: { width: number; height: number };
  solution: (string | null)[][];
  puzzle: IpuzPuzzleCell[][];
  clues: { Across: [number, string][]; Down: [number, string][] };
  [key: string]: unknown;
}

type Coord = { x: number; y: number };

export function isBlackCell(ipuz: Ipuz, { x, y }: Coord): boolean {
  const v = ipuz.solution[y][x];
  return v === null || v === '#';
}

function clueNumberFromCell(cell: IpuzPuzzleCell): number | null {
  if (typeof cell === 'number') return cell;
  if (cell && typeof cell === 'object' && typeof (cell as Record<string, unknown>)['cell'] === 'number') {
    return (cell as Record<string, unknown>)['cell'] as number;
  }
  return null;
}

function wordStart(ipuz: Ipuz, coord: Coord, direction: 'across' | 'down'): Coord {
  const start = { ...coord };
  if (direction === 'across') {
    while (start.x > 0 && !isBlackCell(ipuz, { x: start.x - 1, y: start.y })) start.x--;
  } else {
    while (start.y > 0 && !isBlackCell(ipuz, { x: start.x, y: start.y - 1 })) start.y--;
  }
  return start;
}

// Returns the length of the word at coord in the given direction.
// Returns 0 if coord is part of a 1-letter run (not a real word).
function wordLength(ipuz: Ipuz, coord: Coord, direction: 'across' | 'down'): number {
  if (isBlackCell(ipuz, coord)) return 0;
  const { width, height } = ipuz.dimensions;
  let len = 1;
  if (direction === 'across') {
    for (let x = coord.x - 1; x >= 0 && !isBlackCell(ipuz, { x, y: coord.y }); x--) len++;
    for (let x = coord.x + 1; x < width && !isBlackCell(ipuz, { x, y: coord.y }); x++) len++;
  } else {
    for (let y = coord.y - 1; y >= 0 && !isBlackCell(ipuz, { x: coord.x, y }); y--) len++;
    for (let y = coord.y + 1; y < height && !isBlackCell(ipuz, { x: coord.x, y }); y++) len++;
  }
  return len > 1 ? len : 0;
}

// Potential level = (acrossWordLen - 1) + (downWordLen - 1), capped at 8.
// Words of length 1 don't count (wordLength returns 0 for those).
export function computePotentialLevel(ipuz: Ipuz, coord: Coord): number {
  const across = wordLength(ipuz, coord, 'across');
  const down = wordLength(ipuz, coord, 'down');
  const level = (across > 0 ? across - 1 : 0) + (down > 0 ? down - 1 : 0);
  return Math.min(level, 8);
}

export function computePotentialLevels(ipuz: Ipuz): number[][] {
  const { width, height } = ipuz.dimensions;
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) =>
      isBlackCell(ipuz, { x, y }) ? 0 : computePotentialLevel(ipuz, { x, y })
    )
  );
}

export function validateIpuz(data: unknown): Ipuz {
  if (!data || typeof data !== 'object') throw new Error('Invalid ipuz: not an object');
  const d = data as Record<string, unknown>;

  if (typeof d['version'] !== 'string' || !d['version'].startsWith('http://ipuz.org')) {
    throw new Error('Invalid ipuz: missing or invalid version');
  }
  if (!Array.isArray(d['kind']) || !d['kind'].some((k: unknown) => typeof k === 'string' && k.includes('crossword'))) {
    throw new Error('Invalid ipuz: not a crossword puzzle');
  }
  const dims = d['dimensions'] as Record<string, unknown> | undefined;
  if (!dims || typeof dims['width'] !== 'number' || typeof dims['height'] !== 'number') {
    throw new Error('Invalid ipuz: missing or invalid dimensions');
  }
  if (!Array.isArray(d['solution'])) {
    throw new Error('Invalid ipuz: missing solution array');
  }
  if (!Array.isArray(d['puzzle'])) {
    throw new Error('Invalid ipuz: missing puzzle array');
  }

  return d as unknown as Ipuz;
}

export type Word = {
  key: string; // e.g. "1A" or "5D"
  direction: 'across' | 'down';
  number: number;
  cells: Coord[];
};

// Returns all valid words (length >= 2) in the puzzle.
export function getWords(ipuz: Ipuz): Word[] {
  const { width, height } = ipuz.dimensions;
  const words: Word[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const num = clueNumberFromCell(ipuz.puzzle[y][x]);
      if (num === null) continue;
      for (const direction of ['across', 'down'] as const) {
        // Only start a word at cells where this direction begins
        if (direction === 'across' && x > 0 && !isBlackCell(ipuz, { x: x - 1, y })) continue;
        if (direction === 'down' && y > 0 && !isBlackCell(ipuz, { x, y: y - 1 })) continue;
        const len = wordLength(ipuz, { x, y }, direction);
        if (len < 2) continue;
        const cells: Coord[] = [];
        for (let i = 0; i < len; i++) {
          cells.push(direction === 'across' ? { x: x + i, y } : { x, y: y + i });
        }
        words.push({ key: `${num}${direction === 'across' ? 'A' : 'D'}`, direction, number: num, cells });
      }
    }
  }
  return words;
}

const CROSS_REF_CLUE_RE = /\d+[-.]?\s*(across|down)/i;

function wordClue(ipuz: Ipuz, word: Word): string {
  const dir = word.direction === 'across' ? 'Across' : 'Down';
  return ipuz.clues[dir].find(([n]) => n === word.number)?.[1] ?? '';
}

// Build-up algorithm using a parity row/col constraint to guarantee valid sparse words.
// Across words must lie on a row matching parity; down words on a col matching parity.
// Expansion only happens through intersection cells matching parity (col for across, row for down).
// This ensures every selected word is always fully included — no partial word stubs.
// parity=1 means odd rows/cols (default); parity=0 means even rows/cols.
export function selectWords(ipuz: Ipuz, targetCount: number, rng: () => number, parity: 0 | 1 = 1): Set<string> {
  const allWords = getWords(ipuz);

  // Only eligible words: across on rows matching parity, down on cols matching parity,
  // and clue must not reference another clue number (e.g. "See 58-Down").
  const eligible = allWords.filter(w =>
    (w.direction === 'across' ? w.cells[0].y % 2 === parity : w.cells[0].x % 2 === parity) &&
    !CROSS_REF_CLUE_RE.test(wordClue(ipuz, w))
  );
  if (eligible.length === 0) return new Set();
  const clampedTarget = Math.min(targetCount, eligible.length);

  // Build a map: for each cell, which eligible words cover it
  const cellToWords = new Map<string, Word[]>();
  for (const word of eligible) {
    for (const cell of word.cells) {
      const ck = `${cell.x},${cell.y}`;
      if (!cellToWords.has(ck)) cellToWords.set(ck, []);
      cellToWords.get(ck)!.push(word);
    }
  }

  // Seed: random word from all eligible words
  const seedIndex = Math.floor(rng() * eligible.length);
  const seed = eligible[seedIndex];
  const selected = new Set<string>([seed.key]);

  // selectedCells: parity-matching cells of selected words, used for centroid
  const selectedCells: Coord[] = [];

  type Option = { cell: Coord; word: Word; centroidScore: number; lengthScore: number };

  // frontier: cells in selected words (at parity) that have an unselected crossing word
  const frontier = new Map<string, Option>();

  const parityCell = (word: Word, cell: Coord): boolean =>
    word.direction === 'across' ? cell.x % 2 === parity : cell.y % 2 === parity;

  const addWordToSelection = (word: Word) => {
    for (const cell of word.cells) {
      if (!parityCell(word, cell)) continue;
      selectedCells.push(cell);
      const ck = `${cell.x},${cell.y}`;
      // The crossing word at this cell (different direction, in allWords)
      const crossing = (cellToWords.get(ck) ?? []).find(w => w.direction !== word.direction && !selected.has(w.key));
      if (crossing) {
        frontier.set(ck, { cell, word: crossing, centroidScore: 0, lengthScore: 1 / crossing.cells.length });
      } else {
        // No unselected crossing word — remove from frontier if it was there
        frontier.delete(ck);
      }
    }
  };

  const updateScores = () => {
    const cx = selectedCells.reduce((s, c) => s + c.x, 0) / selectedCells.length;
    const cy = selectedCells.reduce((s, c) => s + c.y, 0) / selectedCells.length;
    for (const [, opt] of frontier) {
      const dist2 = (opt.cell.x - cx) ** 2 + (opt.cell.y - cy) ** 2;
      opt.centroidScore = 1 / (dist2 + 1);
    }
  };

  addWordToSelection(seed);

  while (selected.size < clampedTarget) {
    if (frontier.size === 0) break;
    updateScores();
    const options = [...frontier.values()].sort((a, b) => b.centroidScore - a.centroidScore);
    const top = options.slice(0, 3);
    const pick = top[Math.floor(rng() * top.length)];
    selected.add(pick.word.key);
    // Remove this cell from frontier — it's now fully selected on both sides
    frontier.delete(`${pick.cell.x},${pick.cell.y}`);
    addWordToSelection(pick.word);
    // Also update frontier: any cell of the new word that was previously frontier
    // may now have its crossing word already selected — addWordToSelection handles this
    // But we also need to re-check cells of existing selected words that cross the new word
    for (const cell of pick.word.cells) {
      if (!parityCell(pick.word, cell)) continue;
      const ck = `${cell.x},${cell.y}`;
      const existing = frontier.get(ck);
      if (existing && selected.has(existing.word.key)) frontier.delete(ck);
    }
  }

  return selected;
}

// Returns a new ipuz with only the cells belonging to selectedWords kept; all others blacked out,
// and dimensions trimmed to the bounding box of kept cells.
export function buildSparseIpuz(ipuz: Ipuz, selectedWords: Set<string>): Ipuz {
  const allWords = getWords(ipuz);
  const keptCells = new Set<string>();
  for (const word of allWords) {
    if (selectedWords.has(word.key)) {
      for (const cell of word.cells) keptCells.add(`${cell.x},${cell.y}`);
    }
  }

  // Compute bounding box of kept cells
  const { width, height } = ipuz.dimensions;
  let minX = width, maxX = 0, minY = height, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (keptCells.has(`${x},${y}`)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const newWidth = maxX - minX + 1;
  const newHeight = maxY - minY + 1;

  const newSolution: (string | null)[][] = Array.from({ length: newHeight }, (_, y) =>
    Array.from({ length: newWidth }, (_, x) =>
      keptCells.has(`${x + minX},${y + minY}`) ? (ipuz.solution[y + minY][x + minX] as string) : '#'
    )
  );
  const newPuzzle = Array.from({ length: newHeight }, (_, y) =>
    Array.from({ length: newWidth }, (_, x) =>
      keptCells.has(`${x + minX},${y + minY}`) ? ipuz.puzzle[y + minY][x + minX] : '#'
    )
  );

  // Filter clues to only selected words
  const selectedAcross = new Set<number>();
  const selectedDown = new Set<number>();
  for (const word of allWords) {
    if (!selectedWords.has(word.key)) continue;
    if (word.direction === 'across') selectedAcross.add(word.number);
    else selectedDown.add(word.number);
  }

  return {
    ...ipuz,
    dimensions: { width: newWidth, height: newHeight },
    solution: newSolution,
    puzzle: newPuzzle,
    clues: {
      Across: ipuz.clues.Across.filter(([n]) => selectedAcross.has(n)),
      Down: ipuz.clues.Down.filter(([n]) => selectedDown.has(n)),
    },
  };
}

export default class Puzzle {
  ipuz: Ipuz;
  readonly potentialLevels: number[][];

  constructor(ipuz: Ipuz) {
    this.ipuz = ipuz;
    this.potentialLevels = computePotentialLevels(ipuz);
  }

  // Returns all coords sharing an across or down word with coord. Does not include coord itself.
  getWordNeighbors(coord: Coord): Coord[] {
    const neighbors: Coord[] = [];
    for (const direction of ['across', 'down'] as const) {
      if (wordLength(this.ipuz, coord, direction) === 0) continue;
      const start = wordStart(this.ipuz, coord, direction);
      let pos = { ...start };
      while (pos.x < this.ipuz.dimensions.width && pos.y < this.ipuz.dimensions.height && !isBlackCell(this.ipuz, pos)) {
        if (pos.x !== coord.x || pos.y !== coord.y) neighbors.push({ ...pos });
        if (direction === 'across') pos = { x: pos.x + 1, y: pos.y };
        else pos = { x: pos.x, y: pos.y + 1 };
      }
    }
    return neighbors;
  }

  getRooms(): { x: number; y: number }[] {
    const { width, height } = this.ipuz.dimensions;
    const rooms: { x: number; y: number }[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!isBlackCell(this.ipuz, { x, y })) rooms.push({ x, y });
      }
    }
    return rooms;
  }

  getCluesAt(coord: Coord): { direction: 'Across' | 'Down'; clue: string }[] {
    const results: { direction: 'Across' | 'Down'; clue: string }[] = [];
    for (const direction of ['across', 'down'] as const) {
      if (wordLength(this.ipuz, coord, direction) === 0) continue;
      const start = wordStart(this.ipuz, coord, direction);
      const num = clueNumberFromCell(this.ipuz.puzzle[start.y][start.x]);
      if (num === null) continue;
      const dir = direction === 'across' ? 'Across' : 'Down';
      const entry = this.ipuz.clues[dir].find(([n]) => n === num);
      if (entry) results.push({ direction: dir, clue: entry[1] });
    }
    return results;
  }
}
