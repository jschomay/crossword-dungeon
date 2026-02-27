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

const MAX_MANA = 10;

export default class Game {
  display: ROT.Display;
  private puzzle: Puzzle;
  private dungeon: Dungeon;
  private playerPos: { x: number; y: number };
  private statsEl: HTMLElement;
  private cluesEl: HTMLElement;
  private dungeonEl: HTMLElement;
  private roomStates: Map<string, RoomState> = new Map();
  private mana: number = MAX_MANA;
  private gameOver: boolean = false;
  private puzzleComplete: boolean = false;
  private totalRooms: number = 0;

  constructor() {
    const ipuz = validateIpuz(demoJson);
    this.puzzle = new Puzzle(ipuz);
    this.dungeon = new Dungeon(this.puzzle);
    this.totalRooms = this.puzzle.getRooms().length;

    this.display = new ROT.Display({
      width: this.dungeon.displayWidth,
      height: this.dungeon.displayHeight,
      fontSize: 20,
    });

    this.dungeonEl = document.getElementById('dungeon')!;
    this.dungeonEl.appendChild(this.display.getContainer()!);

    this.statsEl = document.getElementById('stats')!;
    this.cluesEl = document.getElementById('clues')!;
    this.applyTilt();
    this.playerPos = ROT.RNG.getItem(this.puzzle.getRooms())!;

    this.render();
    window.addEventListener('keydown', (e) => this.handleKey(e));
  }

  private applyTilt(): void {
    const sign = ROT.RNG.getUniform() < 0.5 ? 1 : -1;
    const rotation = (sign * (5 + ROT.RNG.getUniform() * 2 - 1)).toFixed(2);
    this.dungeonEl.style.setProperty('--dungeon-rotation', `${rotation}deg`);
  }

  private restart(): void {
    this.roomStates = new Map();
    this.mana = MAX_MANA;
    this.gameOver = false;
    this.puzzleComplete = false;
    this.playerPos = ROT.RNG.getItem(this.puzzle.getRooms())!;
    this.applyTilt();
    this.render();
  }

  private getRoomState(x: number, y: number): RoomState {
    const key = roomKey(x, y);
    if (!this.roomStates.has(key)) this.roomStates.set(key, { activatedLevel: 0, solvedLetter: null });
    return this.roomStates.get(key)!;
  }

  private countSolved(): number {
    let count = 0;
    for (const state of this.roomStates.values()) {
      if (state.solvedLetter !== null) count++;
    }
    return count;
  }

  private tryGuess(x: number, y: number, letter: string): void {
    const state = this.getRoomState(x, y);
    if (state.solvedLetter !== null) return; // already solved
    if (this.mana <= 0) return;

    this.mana--;

    const correct = this.puzzle.ipuz.solution[y][x] === letter;
    if (correct) {
      state.solvedLetter = letter;
      // Propagate +1 activated level to each unsolved word neighbor
      const neighbors = this.puzzle.getWordNeighbors({ x, y });
      for (const nb of neighbors) {
        const nbState = this.getRoomState(nb.x, nb.y);
        if (nbState.solvedLetter !== null) continue;
        const potential = this.puzzle.potentialLevels[nb.y][nb.x];
        nbState.activatedLevel = Math.min(nbState.activatedLevel + 1, potential);
      }
      if (this.countSolved() === this.totalRooms) {
        this.puzzleComplete = true;
      }
    }

    if (this.mana === 0 && !this.puzzleComplete) {
      this.gameOver = true;
    }
  }

  private handleKey(e: KeyboardEvent): void {
    if (this.gameOver || this.puzzleComplete) {
      if (e.key === ' ') this.restart();
      return;
    }

    if (/^[a-z]$/.test(e.key)) {
      const { x, y } = this.playerPos;
      if (this.dungeon.hasRoom(x, y)) {
        this.tryGuess(x, y, e.key.toUpperCase());
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
    const ended = this.gameOver || this.puzzleComplete;
    this.dungeon.render(this.display, this.playerPos, this.roomStates, ended);

    const filled = '<span style="color:#00ffff">ᛗ</span>'.repeat(this.mana);
    const empty = '<span style="color:#555">ᛗ</span>'.repeat(MAX_MANA - this.mana);
    this.statsEl.innerHTML = `Mana: ${filled}${empty}`;

    if (this.gameOver) {
      this.cluesEl.innerHTML = 'Game over!<br>Press space to restart.';
    } else if (this.puzzleComplete) {
      this.cluesEl.innerHTML = 'Puzzle complete!<br>Press space to restart.';
    } else {
      const clues = this.puzzle.getCluesAt(this.playerPos);
      const lines = clues.map(({ direction, clue }) => `${direction}: ${clue}`);
      while (lines.length < 2) lines.push('&nbsp;');
      this.cluesEl.innerHTML = lines.join('<br>');
    }
  }
}
