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

  constructor(ipuz: Ipuz) {
    this.ipuz = ipuz;
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
