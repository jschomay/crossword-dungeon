import * as ROT from '../lib/rotjs';
import demoJson from '../puzzles/demo.json';
import { validateIpuz } from './puzzle';
import Puzzle from './puzzle';
import Dungeon from './dungeon';

const KEY_DIRS: Record<string, { dx: number; dy: number }> = {
  ArrowUp: { dx: 0, dy: -1 }, w: { dx: 0, dy: -1 }, k: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 }, s: { dx: 0, dy: 1 }, j: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 }, a: { dx: -1, dy: 0 }, h: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 }, d: { dx: 1, dy: 0 }, l: { dx: 1, dy: 0 },
};

export default class Game {
  display: ROT.Display;
  private dungeon: Dungeon;
  private playerPos: { x: number; y: number };

  constructor() {
    const ipuz = validateIpuz(demoJson);
    const puzzle = new Puzzle(ipuz);
    this.dungeon = new Dungeon(puzzle);

    this.display = new ROT.Display({
      width: this.dungeon.displayWidth,
      height: this.dungeon.displayHeight,
      fontSize: 20,
    });
    document.body.appendChild(this.display.getContainer()!);

    this.playerPos = ROT.RNG.getItem(puzzle.getRooms())!;

    this.render();
    window.addEventListener('keydown', (e) => this.handleKey(e));
  }

  private handleKey(e: KeyboardEvent): void {
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
    this.dungeon.render(this.display, this.playerPos);
  }
}
