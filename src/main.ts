import './style.css'
import * as ROT from '../lib/rotjs';
import Game from './game'
import { initAudio, startAmbience } from './audio';
import Puzzle from './puzzle';
import Dungeon from './dungeon';
import { validateIpuz } from './puzzle';
import { EXTRA_ROOM_DEFS_MAP, type ExtraRoom } from './extraRooms';

// Title screen crossword layout (# = black cell):
//
//  col:  0  1  2  3  4  5  6  7  8
//  row0: #  #  C  R  O  S  S  #  #   ← CROSS across
//  row1: #  #  W  #  #  #  #  #  #   ← WORD down, col 2
//  row2: #  #  O  #  #  #  #  #  #
//  row3: D  U  N  G  E  O  N  #  #   ← DUNGEON across, N=WORD[2] at (2,3)... wait:
//
// WORD = W O R D  (down col 2, rows 0-3)
//   W at (2,0) — but CROSS[2]=O at (2,0): conflict.
//
// Fix: CROSS at row 1, WORD down col 2 rows 0-3, then:
//   W(2,0), O(2,1), R(2,2), D(2,3)
//   CROSS across at row 1: C(0,1) R(1,1) O(2,1) S(3,1) S(4,1) — O shared ✓
//   DUNGEON across at row 3: D(2,3) U(3,3) N(4,3) G(5,3) E(6,3) O(7,3) N(8,3) — D shared ✓
//
//  col:  0  1  2  3  4  5  6  7  8
//  row0: #  #  W  #  #  #  #  #  #
//  row1: C  R [O] S  S  #  #  #  #   ← CROSS, O shared with WORD[1]
//  row2: #  #  R  #  #  #  #  #  #
//  row3: # [D] U  N  G  E  O  N  #   ← DUNGEON, D shared with WORD[3]
//
// Wait: DUNGEON starts with D, and WORD[3]=D at (2,3).
// So DUNGEON across at row 3 starting at col 2: D(2,3) U(3,3) N(4,3) G(5,3) E(6,3) O(7,3) N(8,3) ✓

// Grid is 9 cols × 4 rows. Black cells fill everything else.
// Room cells (letter cells): WORD col 2 rows 0-3, CROSS row 1 cols 0-4, DUNGEON row 3 cols 2-8.
// Shared: O at (2,1), D at (2,3).

function buildTitleIpuz() {
  // H=5 to allow a room below DUNGEON row (row 4)
  const W = 9, H = 5;
  const solution: (string | null)[][] = Array.from({ length: H }, () => Array(W).fill('#'));
  const puzzle: (string | number | null)[][] = Array.from({ length: H }, () => Array(W).fill('#'));

  const place = (x: number, y: number, letter: string, num?: number) => {
    solution[y][x] = letter;
    puzzle[y][x] = num ?? null;
  };

  // WORD down col 2, rows 0-3: W O R D
  place(2, 0, 'W', 1);
  place(2, 1, 'O');   // intersection with CROSS
  place(2, 2, 'R');
  place(2, 3, 'D');   // intersection with DUNGEON

  // CROSS across row 1, cols 0-4: C R O S S
  place(0, 1, 'C', 2);
  place(1, 1, 'R');
  // (2,1) already placed
  place(3, 1, 'S');
  place(4, 1, 'S');

  // DUNGEON across row 3, cols 2-8: D U N G E O N
  puzzle[3][2] = 3;
  place(3, 3, 'U');
  place(4, 3, 'N');
  place(5, 3, 'G');
  place(6, 3, 'E');
  place(7, 3, 'O');
  place(8, 3, 'N');

  return validateIpuz({
    version: 'http://ipuz.org/v1',
    kind: ['http://ipuz.org/crossword#1'],
    dimensions: { width: W, height: H },
    solution,
    puzzle,
    clues: { Across: [[2, 'CROSS'], [3, 'DUNGEON']], Down: [[1, 'WORD']] },
  });
}

// RoomStates for title: all rooms show as solved (letter visible, white)
function buildTitleRoomStates(ipuz: ReturnType<typeof validateIpuz>): Map<string, {
  activatedLevel: number;
  solvedLetter: string | null;
  completed: boolean;
  encounter: { kind: 'monster' | 'trap' | 'treasure' };
  locked: boolean;
}> {
  const states = new Map();
  const { width, height } = ipuz.dimensions;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = ipuz.solution[y][x];
      if (v === null || v === '#') continue;
      states.set(`${x},${y}`, {
        activatedLevel: 3,
        solvedLetter: v as string,
        completed: true,
        encounter: { kind: 'monster' as const },
        locked: false,
      });
    }
  }
  return states;
}

// Four extra rooms, one per requested position:
//   above S(4,1) → (4,0)    right of S in CROSS
//   left of D(2,3) → (1,3)  start of DUNGEON
//   below G(5,3) → (5,4)    middle of DUNGEON
//   above O(7,3) → (7,2)    near end of DUNGEON
function buildTitleExtraRooms(): ExtraRoom[] {
  const make = (
    type: ExtraRoom['type'],
    x: number, y: number,
    connectedTo: { x: number; y: number },
  ): ExtraRoom => {
    const def = EXTRA_ROOM_DEFS_MAP[type];
    return {
      type,
      pos: { x, y },
      locked: false,
      completed: false,
      glowColor: def.glowColor,
      state: {} as never,
      connectedTo,
    };
  };

  return [
    make('simm',            0, 0, { x: 0, y: 1 }), // above C in CROSS — green
    make('boss',            1, 3, { x: 2, y: 3 }), // left of D in DUNGEON — red
    make('dragon_treasure', 5, 4, { x: 5, y: 3 }), // below G in DUNGEON — gold
    make('very_hidden',     7, 2, { x: 7, y: 3 }), // above O in DUNGEON — purple
  ];
}

let titleDisplay: ROT.Display | null = null;

function renderTitleScreen(container: HTMLElement, promptEl: HTMLElement, loading: boolean): void {
  const ipuz = buildTitleIpuz();
  const puzzle = new Puzzle(ipuz);
  const extraRooms = buildTitleExtraRooms();
  const dungeon = new Dungeon(puzzle, extraRooms);

  const cols = dungeon.displayWidth;
  const rows = dungeon.displayHeight;

  const fontSize = Math.min(
    Math.floor((window.innerWidth * 0.55) / cols),
    Math.floor((window.innerHeight * 0.55) / rows),
    14
  );

  if (titleDisplay) {
    titleDisplay.setOptions({ width: cols, height: rows, fontSize, forceSquareRatio: true });
  } else {
    titleDisplay = new ROT.Display({
      width: cols,
      height: rows,
      fontSize,
      forceSquareRatio: true,
    });
    container.appendChild(titleDisplay.getContainer()!);
  }

  const roomStates = buildTitleRoomStates(ipuz);
  // Player at the O intersection (col 2, row 1) for torch warmth — hidden so no @ drawn
  dungeon.render(titleDisplay, { x: 2, y: 1 }, roomStates, true);

  promptEl.textContent = loading ? 'Loading...' : 'Press [SPACE] to enter the dungeon';
}

window.addEventListener('load', async () => {
  const titleScreen = document.getElementById('title-screen')!;
  const titleCanvas = document.getElementById('title-canvas-container')!;
  const titlePrompt = document.getElementById('title-prompt')!;
  const uiEl = document.getElementById('ui')!;

  renderTitleScreen(titleCanvas, titlePrompt, true);

  const [game] = await Promise.all([
    Game.create(),
    initAudio(),
  ]);

  renderTitleScreen(titleCanvas, titlePrompt, false);

  const onResize = () => renderTitleScreen(titleCanvas, titlePrompt, false);
  window.addEventListener('resize', onResize);

  const onSpace = (e: KeyboardEvent) => {
    if (e.key !== ' ') return;
    window.removeEventListener('keydown', onSpace);
    window.removeEventListener('resize', onResize);
    titleScreen.classList.add('hidden');
    uiEl.classList.remove('hidden');
    startAmbience();
    game.activate();
  };
  window.addEventListener('keydown', onSpace);
});
