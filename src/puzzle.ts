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
