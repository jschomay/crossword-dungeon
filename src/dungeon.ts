import * as ROT from '../lib/rotjs';
import Puzzle from './puzzle';
import { ENCOUNTER_STYLE } from './encounters';

const WALL_FG = '#6b3f14';
const UNKNOWN_FG = '#518F91';
const SOLVED_FG = '#ffffff';
const DOT_FG = '#4444ff';
const PLAYER_FG = '#ffdd44';
const SHOP_FG = '#44ffcc';
const BLACK = '#000000';
const BG_FG = '#333333';
const BG_CHARS = [';', ',', "'", '^', '/', '%', '`', '~', '.', ':'];
const BG_DENSITY = 0.01; // fraction of empty cells that get a char

const TORCH_RADIUS = 6;
const TORCH_MAX_BOOST = 90;

const PULSE_COLOR: [number, number, number] = [255, 255, 255];
const PULSE_INTERVAL_MS = 20;
const PULSE_MAX_R = 25;

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
  private shopPos: { x: number; y: number } | null;
  private dungeonCells: Set<string>;
  private wallCells: Set<string>;

  constructor(puzzle: Puzzle, shopPos: { x: number; y: number } | null = null) {
    this.puzzle = puzzle;
    this.shopPos = shopPos;
    const { width, height } = puzzle.ipuz.dimensions;
    // Each grid cell = 5×5 room; adjacent rooms share a 1-cell corridor gap.
    // Total = gridSize * 6 - 1 cells, plus 1-cell padding each side = gridSize * 6 + 1
    this.displayWidth = width * 6 + 1;
    this.displayHeight = height * 6 + 1;
    ({ dungeonCells: this.dungeonCells, wallCells: this.wallCells } = this.buildCells());
  }

  private buildCells(): { dungeonCells: Set<string>; wallCells: Set<string> } {
    const dungeonCells = new Set<string>();
    const wallCells = new Set<string>();
    const { width, height } = this.puzzle.ipuz.dimensions;
    for (let gy = 0; gy < height; gy++) {
      for (let gx = 0; gx < width; gx++) {
        if (!this.hasRoom(gx, gy)) continue;
        const rx = 1 + gx * 6;
        const ry = 1 + gy * 6;
        const connUp    = this.hasRoom(gx, gy - 1);
        const connDown  = this.hasRoom(gx, gy + 1);
        const connLeft  = this.hasRoom(gx - 1, gy);
        const connRight = this.hasRoom(gx + 1, gy);
        for (let lx = 0; lx < 5; lx++) {
          for (let ly = 0; ly < 5; ly++) {
            const key = `${rx + lx},${ry + ly}`;
            dungeonCells.add(key);
            if (this.isWall(lx, ly, connUp, connDown, connLeft, connRight)) wallCells.add(key);
          }
        }
        if (connRight) {
          dungeonCells.add(`${rx + 5},${ry + 1}`); wallCells.add(`${rx + 5},${ry + 1}`);
          dungeonCells.add(`${rx + 5},${ry + 2}`);
          dungeonCells.add(`${rx + 5},${ry + 3}`); wallCells.add(`${rx + 5},${ry + 3}`);
        }
        if (connDown) {
          dungeonCells.add(`${rx + 1},${ry + 5}`); wallCells.add(`${rx + 1},${ry + 5}`);
          dungeonCells.add(`${rx + 2},${ry + 5}`);
          dungeonCells.add(`${rx + 3},${ry + 5}`); wallCells.add(`${rx + 3},${ry + 5}`);
        }
      }
    }
    return { dungeonCells, wallCells };
  }

  private bgChar(wx: number, wy: number): string | null {
    // Stable per-cell hash to decide density and char choice
    const h = Math.abs((wx * 2654435761) ^ (wy * 2246822519)) >>> 0;
    if ((h & 0xff) / 255 > BG_DENSITY) return null;
    return BG_CHARS[(h >> 8) % BG_CHARS.length];
  }

  drawBackground(display: ROT.Display, camera?: { x: number; y: number }): void {
    const { width: vpW, height: vpH } = display.getOptions();
    for (let sy = 0; sy < vpH; sy++) {
      for (let sx = 0; sx < vpW; sx++) {
        const wx = camera ? sx + camera.x : sx;
        const wy = camera ? sy + camera.y : sy;
        if (this.dungeonCells.has(`${wx},${wy}`)) continue;
        const ch = this.bgChar(wx, wy);
        if (ch) display.draw(sx, sy, ch, BG_FG, BLACK);
      }
    }
  }

  render(display: ROT.Display, playerPos: { x: number; y: number }, roomStates: Map<string, { activatedLevel: number; solvedLetter: string | null; encounter: { kind: 'monster' | 'trap' | 'treasure' } }>, hidePlayer = false, camera?: { x: number; y: number }): void {
    const { width, height } = this.puzzle.ipuz.dimensions;
    display.clear();
    this.drawBackground(display, camera);

    // Record all drawn dungeon cells for torch pass
    const cellMap = new Map<string, { ch: string; fg: string }>();
    const recordDraw = (wx: number, wy: number, ch: string, fg: string) => {
      cellMap.set(`${wx},${wy}`, { ch, fg });
      const sx = camera ? wx - camera.x : wx;
      const sy = camera ? wy - camera.y : wy;
      display.draw(sx, sy, ch, fg, BLACK);
    };

    for (let gy = 0; gy < height; gy++) {
      for (let gx = 0; gx < width; gx++) {
        if (this.hasRoom(gx, gy)) {
          this.drawRoom(display, gx, gy, playerPos, roomStates, hidePlayer, camera, recordDraw);
          if (this.hasRoom(gx + 1, gy)) this.drawHCorridor(display, gx, gy, camera, recordDraw);
          if (this.hasRoom(gx, gy + 1)) this.drawVCorridor(display, gx, gy, camera, recordDraw);
        }
      }
    }

    // Torch: brighten cells based on FOV distance from player
    const pwx = 1 + playerPos.x * 6 + 2;
    const pwy = 1 + playerPos.y * 6 + 2;
    const fov = new ROT.FOV.RecursiveShadowcasting(
      (x, y) => !this.wallCells.has(`${x},${y}`),
      { topology: 8 },
    );
    fov.compute(pwx, pwy, TORCH_RADIUS, (x, y, r) => {
      const cell = cellMap.get(`${x},${y}`);
      if (!cell || cell.fg === BLACK) return;
      const boost = Math.round(TORCH_MAX_BOOST * Math.pow(1 - r / (TORCH_RADIUS + 1), 1.2));
      if (boost <= 0) return;
      const base = ROT.Color.fromString(cell.fg);
      const brightened = ROT.Color.add(base, [boost, Math.round(boost * 0.7), Math.round(boost * 0.4)]);
      const sx = camera ? x - camera.x : x;
      const sy = camera ? y - camera.y : y;
      display.draw(sx, sy, cell.ch, ROT.Color.toHex(brightened), BLACK);
    });
  }

  isShop(gx: number, gy: number): boolean {
    return this.shopPos !== null && this.shopPos.x === gx && this.shopPos.y === gy;
  }

  hasRoom(gx: number, gy: number): boolean {
    if (this.isShop(gx, gy)) return true;
    const { width, height } = this.puzzle.ipuz.dimensions;
    if (gx < 0 || gy < 0 || gx >= width || gy >= height) return false;
    const v = this.puzzle.ipuz.solution[gy][gx];
    return v !== null && v !== '#';
  }

  private drawRoom(display: ROT.Display, gx: number, gy: number, playerPos: { x: number; y: number }, roomStates: Map<string, { activatedLevel: number; solvedLetter: string | null; encounter: { kind: 'monster' | 'trap' | 'treasure' } }>, hidePlayer: boolean, camera: { x: number; y: number } | undefined, recordDraw: (wx: number, wy: number, ch: string, fg: string) => void): void {
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
    const shopRoom = this.isShop(gx, gy);
    const solved = state?.solvedLetter ?? null;
    const activatedLevel = state?.activatedLevel ?? 0;
    const encounterKind = state?.encounter.kind ?? 'monster';
    const hasPlayer = !hidePlayer && playerPos.x === gx && playerPos.y === gy;

    for (let lx = 0; lx < 5; lx++) {
      for (let ly = 0; ly < 5; ly++) {
        const wall = this.isWall(lx, ly, connUp, connDown, connLeft, connRight);
        if (wall) {
          recordDraw(wx + lx, wy + ly, '#', WALL_FG);
          continue;
        }

        if (lx === 2 && ly === 2) {
          // Center cell
          let ch: string;
          let fg: string;
          if (hasPlayer) {
            ch = '@'; fg = PLAYER_FG;
          } else if (shopRoom) {
            ch = '%'; fg = SHOP_FG;
          } else if (solved !== null) {
            ch = solved; fg = SOLVED_FG;
          } else if (activatedLevel > 0) {
            const style = ENCOUNTER_STYLE[encounterKind];
            ch = style.symbol; fg = style.color;
          } else {
            ch = '?'; fg = UNKNOWN_FG;
          }
          recordDraw(wx + lx, wy + ly, ch, fg);
        } else if (shopRoom) {
        } else {
          recordDraw(wx + lx, wy + ly, ' ', BLACK);
        }
      }
    }

    if (!shopRoom && solved === null) {
      for (let i = 0; i < activatedLevel; i++) {
        const [lx, ly] = DOT_POSITIONS[i];
        recordDraw(wx + lx, wy + ly, '.', DOT_FG);
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
  private drawHCorridor(_display: ROT.Display, gx: number, gy: number, _camera: { x: number; y: number } | undefined, recordDraw: (wx: number, wy: number, ch: string, fg: string) => void): void {
    const wcx = 1 + gx * 6 + 5;
    const wry = 1 + gy * 6;
    recordDraw(wcx, wry + 1, '#', WALL_FG);
    recordDraw(wcx, wry + 3, '#', WALL_FG);
  }

  // Corridor row between (gx, gy) and (gx, gy+1): walls at cols 1 and 3, open at center
  private drawVCorridor(_display: ROT.Display, gx: number, gy: number, _camera: { x: number; y: number } | undefined, recordDraw: (wx: number, wy: number, ch: string, fg: string) => void): void {
    const wrx = 1 + gx * 6;
    const wcy = 1 + gy * 6 + 5;
    recordDraw(wrx + 1, wcy, '#', WALL_FG);
    recordDraw(wrx + 3, wcy, '#', WALL_FG);
  }

  private isWallCell(wx: number, wy: number): boolean {
    return this.wallCells.has(`${wx},${wy}`);
  }

  triggerCorrectPulse(
    display: ROT.Display,
    playerPos: { x: number; y: number },
    roomStates: Map<string, { activatedLevel: number; solvedLetter: string | null; encounter: { kind: 'monster' | 'trap' | 'treasure' } }>,
    camera: { x: number; y: number } | undefined,
    onDone: () => void,
    color: [number, number, number] = PULSE_COLOR,
    maxR: number = PULSE_MAX_R,
    intervalMs: number = PULSE_INTERVAL_MS,
  ): void {
    let r = 1;
    let fovCells: [number, number][] = [];
    const cx = 1 + playerPos.x * 6 + 2;
    const cy = 1 + playerPos.y * 6 + 2;

    const fov = new ROT.FOV.RecursiveShadowcasting(
      (x, y) => !this.isWallCell(x, y),
      { topology: 8 },
    );

    const drawCell = (x: number, y: number, tinted: boolean) => {
      const sx = camera ? x - camera.x : x;
      const sy = camera ? y - camera.y : y;
      let ch = ' ';
      let fg = BLACK;
      if (this.dungeonCells.has(`${x},${y}`)) {
        if (this.isWallCell(x, y)) {
          ch = '#'; fg = WALL_FG;
        } else {
          const gx = Math.floor((x - 1) / 6);
          const gy = Math.floor((y - 1) / 6);
          const lx = x - (1 + gx * 6);
          const ly = y - (1 + gy * 6);
          const state = roomStates.get(`${gx},${gy}`);
          const shopCell = this.isShop(gx, gy);
          if (lx === 2 && ly === 2) {
            if (playerPos.x === gx && playerPos.y === gy) { ch = '@'; fg = PLAYER_FG; }
            else if (shopCell) { ch = '%'; fg = SHOP_FG; }
            else if (state?.solvedLetter) { ch = state.solvedLetter; fg = SOLVED_FG; }
            else if (state?.activatedLevel ?? 0 > 0) { const s = ENCOUNTER_STYLE[state!.encounter.kind]; ch = s.symbol; fg = s.color; }
            else { ch = '?'; fg = UNKNOWN_FG; }
          } else if (shopCell) {
            // non-center shop cells: leave blank
          } else {
            const dotIdx = DOT_POSITIONS.findIndex(([dlx, dly]) => dlx === lx && dly === ly);
            if (dotIdx >= 0 && dotIdx < (state?.activatedLevel ?? 0) && state?.solvedLetter === null) {
              ch = '.'; fg = DOT_FG;
            }
          }
        }
      } else {
        const bgc = this.bgChar(x, y);
        if (bgc) { ch = bgc; fg = BG_FG; }
      }
      if (ch === ' ') return;
      if (tinted) {
        const blend = ROT.Color.interpolate(ROT.Color.fromString(fg), color, 0.75);
        display.draw(sx, sy, ch, ROT.Color.toHex(blend), BLACK);
      } else {
        display.draw(sx, sy, ch, fg, BLACK);
      }
    };

    const tick = () => {
      // Restore previously lit cells
      for (const [x, y] of fovCells) drawCell(x, y, false);

      if (r > maxR) {
        clearInterval(intervalId);
        this.render(display, playerPos, roomStates, false, camera);
        onDone();
        return;
      }

      fovCells = [];
      fov.compute(cx, cy, r, (x, y, fovR) => {
        if (fovR >= r - 1) {
          fovCells.push([x, y]);
          drawCell(x, y, true);
        }
      });

      r++;
    };

    const intervalId = setInterval(tick, intervalMs) as unknown as number;
    tick();
  }
}
