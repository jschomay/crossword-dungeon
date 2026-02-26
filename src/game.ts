import * as ROT from '../lib/rotjs';
import demoJson from '../puzzles/demo.json';
import { validateIpuz } from './puzzle';
import Puzzle from './puzzle';
import Dungeon from './dungeon';

const KEY_DIRS: Record<string, { dx: number; dy: number }> = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
};

type RoomState = { activatedLevel: number; solvedLetter: string | null };

function roomKey(x: number, y: number): string {
  return `${x},${y}`;
}

export default class Game {
  display: ROT.Display;
  private puzzle: Puzzle;
  private dungeon: Dungeon;
  private playerPos: { x: number; y: number };
  private cluesEl: HTMLElement;
  private roomStates: Map<string, RoomState> = new Map();

  constructor() {
    const ipuz = validateIpuz(demoJson);
    this.puzzle = new Puzzle(ipuz);
    this.dungeon = new Dungeon(this.puzzle);

    this.display = new ROT.Display({
      width: this.dungeon.displayWidth,
      height: this.dungeon.displayHeight,
      fontSize: 20,
    });

    const dungeonEl = document.getElementById('dungeon')!;
    dungeonEl.appendChild(this.display.getContainer()!);

    // Random tilt: either ~+5 or ~-5 degrees (+/-1)
    const sign = ROT.RNG.getUniform() < 0.5 ? 1 : -1;
    const rotation = (sign * (5 + ROT.RNG.getUniform() * 2 - 1)).toFixed(2);
    dungeonEl.style.setProperty('--dungeon-rotation', `${rotation}deg`);

    this.cluesEl = document.getElementById('clues')!;
    this.playerPos = ROT.RNG.getItem(this.puzzle.getRooms())!;

    this.render();
    window.addEventListener('keydown', (e) => this.handleKey(e));
  }

  private getRoomState(x: number, y: number): RoomState {
    const key = roomKey(x, y);
    if (!this.roomStates.has(key)) this.roomStates.set(key, { activatedLevel: 0, solvedLetter: null });
    return this.roomStates.get(key)!;
  }

  private solveRoom(x: number, y: number, letter: string): void {
    const state = this.getRoomState(x, y);
    if (state.solvedLetter !== null) return; // already solved
    state.solvedLetter = letter;
    // Propagate +1 activated level to each unsolved word neighbor
    const neighbors = this.puzzle.getWordNeighbors({ x, y });
    for (const nb of neighbors) {
      const nbState = this.getRoomState(nb.x, nb.y);
      if (nbState.solvedLetter !== null) continue;
      const potential = this.puzzle.potentialLevels[nb.y][nb.x];
      nbState.activatedLevel = Math.min(nbState.activatedLevel + 1, potential);
    }
  }

  private handleKey(e: KeyboardEvent): void {
    if (/^[a-z]$/.test(e.key)) {
      const { x, y } = this.playerPos;
      if (this.dungeon.hasRoom(x, y)) {
        this.solveRoom(x, y, e.key.toUpperCase());
        this.render();
      }
      return;
    }

    const dir = KEY_DIRS[e.key];
    if (!dir) return;
    const nx = this.playerPos.x + dir.dx;
    const ny = this.playerPos.y + dir.dy;
    if (this.dungeon.hasRoom(nx, ny)) {
      this.playerPos = { x: nx, y: ny };
      this.render();
    }
  }

  private render(): void {
    this.dungeon.render(this.display, this.playerPos, this.roomStates);
    const clues = this.puzzle.getCluesAt(this.playerPos);
    const lines = clues.map(({ direction, clue }) => `${direction}: ${clue}`);
    while (lines.length < 2) lines.push('&nbsp;');
    this.cluesEl.innerHTML = lines.join('<br>');
  }
}
