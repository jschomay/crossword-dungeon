import * as ROT from '../lib/rotjs';
import Puzzle from './puzzle';
import { ENCOUNTER_STYLE, UNKNOWN_COLOR } from './encounters';

const WALL_FG = '#888888';
const UNKNOWN_FG = UNKNOWN_COLOR;
const SOLVED_FG = '#ffffff';
const DOT_FG = '#4444ff';
const PLAYER_FG = '#ffdd44';
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

  render(display: ROT.Display, playerPos: { x: number; y: number }, roomStates: Map<string, { activatedLevel: number; solvedLetter: string | null; encounter: { kind: 'monster' | 'trap' | 'treasure' } }>, hidePlayer = false, camera?: { x: number; y: number }): void {
    const { width, height } = this.puzzle.ipuz.dimensions;
    display.clear();
    for (let gy = 0; gy < height; gy++) {
      for (let gx = 0; gx < width; gx++) {
        if (this.hasRoom(gx, gy)) {
          this.drawRoom(display, gx, gy, playerPos, roomStates, hidePlayer, camera);
          if (this.hasRoom(gx + 1, gy)) this.drawHCorridor(display, gx, gy, camera);
          if (this.hasRoom(gx, gy + 1)) this.drawVCorridor(display, gx, gy, camera);
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

  private drawRoom(display: ROT.Display, gx: number, gy: number, playerPos: { x: number; y: number }, roomStates: Map<string, { activatedLevel: number; solvedLetter: string | null; encounter: { kind: 'monster' | 'trap' | 'treasure' } }>, hidePlayer: boolean, camera?: { x: number; y: number }): void {
    const wx = 1 + gx * 6;
    const wy = 1 + gy * 6;
    const dx = camera ? wx - camera.x : wx;
    const dy = camera ? wy - camera.y : wy;
    const { width: vpW, height: vpH } = display.getOptions();
    // Skip rooms fully outside viewport
    if (camera && (dx + 5 < 0 || dy + 5 < 0 || dx >= vpW || dy >= vpH)) return;

    const connUp    = this.hasRoom(gx, gy - 1);
    const connDown  = this.hasRoom(gx, gy + 1);
    const connLeft  = this.hasRoom(gx - 1, gy);
    const connRight = this.hasRoom(gx + 1, gy);

    const state = roomStates.get(`${gx},${gy}`);
    const solved = state?.solvedLetter ?? null;
    const activatedLevel = state?.activatedLevel ?? 0;
    const encounterKind = state?.encounter.kind ?? 'monster';
    const potentialLevel = this.puzzle.potentialLevels[gy][gx];
    const hasPlayer = !hidePlayer && playerPos.x === gx && playerPos.y === gy;

    for (let lx = 0; lx < 5; lx++) {
      for (let ly = 0; ly < 5; ly++) {
        if (lx === 2 && ly === 2) {
          let centerChar: string;
          let centerFg: string;
          if (hasPlayer) {
            centerChar = '@'; centerFg = PLAYER_FG;
          } else if (solved !== null) {
            centerChar = solved; centerFg = SOLVED_FG;
          } else if (activatedLevel > 0) {
            const style = ENCOUNTER_STYLE[encounterKind];
            centerChar = style.symbol; centerFg = style.color;
          } else {
            centerChar = '?'; centerFg = UNKNOWN_FG;
          }
          display.draw(dx + lx, dy + ly, centerChar, centerFg, BLACK);
          continue;
        }

        const wall = this.isWall(lx, ly, connUp, connDown, connLeft, connRight);
        if (wall) {
          display.draw(dx + lx, dy + ly, '#', WALL_FG, BLACK);
        } else {
          // Clear interior floor cells so stale chars don't linger
          display.draw(dx + lx, dy + ly, ' ', BLACK, BLACK);
        }
      }
    }

    const plusFg = ENCOUNTER_STYLE[encounterKind].color;
    if (solved !== null) {
      // Solved: show only activated plusses, no dots
      for (let i = 0; i < activatedLevel; i++) {
        const [lx, ly] = DOT_POSITIONS[i];
        display.draw(dx + lx, dy + ly, '+', plusFg, BLACK);
      }
    } else {
      // Unsolved: activated plusses first, then potential dots
      for (let i = 0; i < potentialLevel; i++) {
        const [lx, ly] = DOT_POSITIONS[i];
        if (i < activatedLevel) {
          display.draw(dx + lx, dy + ly, '+', plusFg, BLACK);
        } else {
          display.draw(dx + lx, dy + ly, '.', DOT_FG, BLACK);
        }
      }
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
  private drawHCorridor(display: ROT.Display, gx: number, gy: number, camera?: { x: number; y: number }): void {
    const wcx = 1 + gx * 6 + 5;
    const wry = 1 + gy * 6;
    const cx = camera ? wcx - camera.x : wcx;
    const ry = camera ? wry - camera.y : wry;
    display.draw(cx, ry + 1, '#', WALL_FG, BLACK);
    display.draw(cx, ry + 3, '#', WALL_FG, BLACK);
  }

  // Corridor row between (gx, gy) and (gx, gy+1): walls at cols 1 and 3, open at center
  private drawVCorridor(display: ROT.Display, gx: number, gy: number, camera?: { x: number; y: number }): void {
    const wrx = 1 + gx * 6;
    const wcy = 1 + gy * 6 + 5;
    const rx = camera ? wrx - camera.x : wrx;
    const cy = camera ? wcy - camera.y : wcy;
    display.draw(rx + 1, cy, '#', WALL_FG, BLACK);
    display.draw(rx + 3, cy, '#', WALL_FG, BLACK);
  }
}
