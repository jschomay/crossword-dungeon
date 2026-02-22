import * as ROT from "../lib/rotjs"

const WIDTH = 40;
const HEIGHT = 20;

export default class Game {
  display: ROT.Display;

  constructor() {
    this.display = new ROT.Display({ width: WIDTH, height: HEIGHT, fontSize: 18 });
    document.body.appendChild(this.display.getContainer()!);

    this.drawHello();
  }

  drawHello() {
    const msg = "HELLO, DUNGEON";
    const x = Math.floor((WIDTH - msg.length) / 2);
    const y = Math.floor(HEIGHT / 2);

    for (let i = 0; i < msg.length; i++) {
      this.display.draw(x + i, y, msg[i], "#ff0", "#000");
    }
  }
}
