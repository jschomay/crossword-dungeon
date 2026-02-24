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

function isBlackCell(ipuz: Ipuz, { x, y }: Coord): boolean {
  const v = ipuz.solution[y][x];
  return v === null || v === '#';
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
  x: number = 0;
  y: number = 0;
  current: string;
  readonly potentialLevels: number[][];

  constructor(ipuz: Ipuz) {
    this.ipuz = ipuz;
    this.potentialLevels = computePotentialLevels(ipuz);
    if (!this.valid()) this.next();
    this.current = this.ipuz.solution[this.y][this.x] ?? '#';
  }

  valueAt(coords: { x: number; y: number }): string {
    return this.ipuz.solution[coords.y][coords.x] ?? '#';
  }

  isBlack(coords: { x: number; y: number }): boolean {
    const v = this.ipuz.solution[coords.y][coords.x];
    return v === null || v === '#';
  }

  valid(): boolean {
    return !this.isBlack({ x: this.x, y: this.y });
  }

  next(): boolean {
    this.x++;
    if (this.x >= this.ipuz.dimensions.width) {
      this.x = 0;
      this.y++;
    }
    if (this.y >= this.ipuz.dimensions.height) return false;
    if (!this.valid()) return this.next();
    this.current = this.ipuz.solution[this.y][this.x] ?? '#';
    return true;
  }

  set({ x, y }: { x: number; y: number }) {
    this.x = x;
    this.y = y;
    this.current = this.ipuz.solution[this.y][this.x] ?? '#';
  }
}
