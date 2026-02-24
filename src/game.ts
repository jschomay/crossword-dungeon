import * as ROT from '../lib/rotjs';
import demoJson from '../puzzles/demo.json';
import { validateIpuz } from './puzzle';
import Puzzle from './puzzle';
import Dungeon from './dungeon';

export default class Game {
  display: ROT.Display;

  constructor() {
    const ipuz = validateIpuz(demoJson);
    const puzzle = new Puzzle(ipuz);
    const dungeon = new Dungeon(puzzle);

    this.display = new ROT.Display({
      width: dungeon.displayWidth,
      height: dungeon.displayHeight,
      fontSize: 20,
    });
    document.body.appendChild(this.display.getContainer()!);

    dungeon.render(this.display);
  }
}
