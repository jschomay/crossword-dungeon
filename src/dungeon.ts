import * as ROT from '../lib/rotjs';
import Puzzle from './puzzle';

const WALL_FG = '#888888';
const UNKNOWN_FG = '#ffff00';
const DOT_FG = '#4444ff';
const PLAYER_FG = '#ffffff';
const BLACK = '#000000';

// The 8 interior non-center cells in a 5×5 room, left-to-right, top-to-bottom
const DOT_POSITIONS: [number, number][] = [
  [1, 1], [2, 1], [3, 1],
  [1, 2],         [3, 2],
  [1, 3], [2, 3], [3, 3],
];

export default class Dungeon {
  readonly displayWidth: number;
  readonly displayHeight: number;
  private puzzle: Puzzle;

  constructor(puzzle: Puzzle) {
    this.puzzle = puzzle;
    const { width, height } = puzzle.ipuz.dimensions;
    // Each grid cell = 5×5 room; adjacent rooms share a 1-cell corridor gap.
    // Total = gridSize * 6 - 1 cells, plus 1-cell padding each side = gridSize * 6 + 1
    this.displayWidth = width * 6 + 1;
    this.displayHeight = height * 6 + 1;
  }

  render(display: ROT.Display, playerPos: { x: number; y: number }): void {
    const { width, height } = this.puzzle.ipuz.dimensions;
    for (let gy = 0; gy < height; gy++) {
      for (let gx = 0; gx < width; gx++) {
        if (this.hasRoom(gx, gy)) {
          this.drawRoom(display, gx, gy, playerPos);
          if (this.hasRoom(gx + 1, gy)) this.drawHCorridor(display, gx, gy);
          if (this.hasRoom(gx, gy + 1)) this.drawVCorridor(display, gx, gy);
        }
      }
    }
  }

  hasRoom(gx: number, gy: number): boolean {
    const { width, height } = this.puzzle.ipuz.dimensions;
    if (gx < 0 || gy < 0 || gx >= width || gy >= height) return false;
    const v = this.puzzle.ipuz.solution[gy][gx];
    return v !== null && v !== '#';
  }

  private drawRoom(display: ROT.Display, gx: number, gy: number, playerPos: { x: number; y: number }): void {
    const dx = 1 + gx * 6;
    const dy = 1 + gy * 6;

    const connUp    = this.hasRoom(gx, gy - 1);
    const connDown  = this.hasRoom(gx, gy + 1);
    const connLeft  = this.hasRoom(gx - 1, gy);
    const connRight = this.hasRoom(gx + 1, gy);

    const potentialLevel = this.puzzle.potentialLevels[gy][gx];
    const hasPlayer = playerPos.x === gx && playerPos.y === gy;

    for (let lx = 0; lx < 5; lx++) {
      for (let ly = 0; ly < 5; ly++) {
        if (lx === 2 && ly === 2) {
          const centerChar = hasPlayer ? '@' : '?';
          const centerFg = hasPlayer ? PLAYER_FG : UNKNOWN_FG;
          display.draw(dx + lx, dy + ly, centerChar, centerFg, BLACK);
          continue;
        }

        const wall = this.isWall(lx, ly, connUp, connDown, connLeft, connRight);
        if (wall) {
          display.draw(dx + lx, dy + ly, '#', WALL_FG, BLACK);
        }
        // interior floor cells: left as default (black bg, no char needed)
      }
    }

    // Draw blue dots for potential level, left-to-right
    for (let i = 0; i < potentialLevel; i++) {
      const [lx, ly] = DOT_POSITIONS[i];
      display.draw(dx + lx, dy + ly, '.', DOT_FG, BLACK);
    }
  }

  // Determines if local cell (lx, ly) within a 5×5 room is a wall
  private isWall(lx: number, ly: number, connUp: boolean, connDown: boolean, connLeft: boolean, connRight: boolean): boolean {
    if (ly === 0) return !(lx === 2 && connUp);
    if (ly === 4) return !(lx === 2 && connDown);
    if (lx === 0) return !(ly === 2 && connLeft);
    if (lx === 4) return !(ly === 2 && connRight);
    return false;
  }

  // Corridor column between (gx, gy) and (gx+1, gy): walls at rows 1 and 3, open at center
  private drawHCorridor(display: ROT.Display, gx: number, gy: number): void {
    const cx = 1 + gx * 6 + 5;
    const ry = 1 + gy * 6;
    display.draw(cx, ry + 1, '#', WALL_FG, BLACK);
    display.draw(cx, ry + 3, '#', WALL_FG, BLACK);
  }

  // Corridor row between (gx, gy) and (gx, gy+1): walls at cols 1 and 3, open at center
  private drawVCorridor(display: ROT.Display, gx: number, gy: number): void {
    const rx = 1 + gx * 6;
    const cy = 1 + gy * 6 + 5;
    display.draw(rx + 1, cy, '#', WALL_FG, BLACK);
    display.draw(rx + 3, cy, '#', WALL_FG, BLACK);
  }
}
