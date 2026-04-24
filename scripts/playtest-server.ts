/**
 * Headless playtest server for crossword-dungeon.
 * Run: npx tsx scripts/playtest-server.ts
 * Endpoints:
 *   GET /state          → current ASCII snapshot
 *   GET /key?k=ArrowRight  → send key, return new snapshot
 *   GET /dismiss        → send Space (dismiss popup)
 */
import { readFileSync } from 'fs';
import { createServer } from 'http';
import { resolve } from 'path';

// ── Stubs (must be set before any game import) ────────────────────────────────

const fakeCanvas = {
  width: 0, height: 0,
  getContext: () => ({
    font: '', textAlign: '', textBaseline: '', fillStyle: '',
    globalCompositeOperation: '',
    fillRect: () => {}, fillText: () => {}, drawImage: () => {},
    measureText: () => ({ width: 8 }),
    canvas: {
      width: 0, height: 0,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1 }),
    },
  }),
};

const elements: Record<string, {
  innerHTML: string;
  style: { setProperty: () => void };
  classList: { add: () => void; remove: () => void; toggle: () => void; contains: () => boolean };
  appendChild: () => void;
}> = {};
const makeEl = (initialClasses: string[] = []) => ({
  innerHTML: '',
  style: { setProperty: () => {} },
  classList: (() => {
    const classes = new Set<string>(initialClasses);
    return {
      add: (c: string) => classes.add(c),
      remove: (c: string) => classes.delete(c),
      toggle: (c: string) => classes.has(c) ? classes.delete(c) : classes.add(c),
      contains: (c: string) => classes.has(c),
    };
  })(),
  appendChild: () => {},
});

const keydownListeners: Array<(e: unknown) => void> = [];

(global as any).document = {
  createElement: () => fakeCanvas,
  getElementById: (id: string) => {
    if (!elements[id]) elements[id] = makeEl(id === 'help-overlay' || id === 'interaction-popup' ? ['hidden'] : []);
    return elements[id];
  },
};
(global as any).requestAnimationFrame = () => {};
// Run interval callbacks synchronously until clearInterval is called — needed so
// pulseRunning flag clears (pulse calls onDone() when r > maxR inside tick()).
// setInterval: dungeon.ts assigns intervalId from the return value, then calls tick() manually.
// tick() calls clearInterval(intervalId) when done. So we must return id before any fn() runs.
// We queue the remaining ticks via queueMicrotask so intervalId is assigned first.
(global as any).setInterval = (fn: () => void) => {
  const id = { active: true };
  queueMicrotask(() => { for (let i = 0; i < 100 && id.active; i++) fn(); });
  return id;
};
(global as any).clearInterval = (id: any) => { if (id) id.active = false; };
(global as any).setTimeout = (fn: () => void) => { fn(); return 0; }; // run combat instantly
(global as any).clearTimeout = () => {};
(global as any).window = {
  innerWidth: 1200, innerHeight: 800,
  location: { search: '?puzzle=debug' },
  addEventListener: (type: string, fn: (e: unknown) => void) => {
    if (type === 'keydown') keydownListeners.push(fn);
  },
};
(global as any).localStorage = {
  _store: {} as Record<string, string>,
  getItem(k: string) { return this._store[k] ?? null; },
  setItem(k: string, v: string) { this._store[k] = v; },
};
(global as any).fetch = async (url: string) => {
  const path = url.startsWith('/') ? url : `./public/${url}`;
  const data = readFileSync(path, 'utf8');
  return { ok: true, json: async () => JSON.parse(data) };
};

// ── Boot game ─────────────────────────────────────────────────────────────────

const { default: Game } = await import('../src/game.ts');
const { default: Dungeon } = await import('../src/dungeon.ts');
const { default: Puzzle, validateIpuz } = await import('../src/puzzle.ts');
const { generateEncounter } = await import('../src/encounters.ts');
const game = await (Game as any).create() as any;
console.log('Game booted. playerPos:', game.playerPos);

// ── Snapshot renderer ─────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function renderGrid(): string {
  const data: Record<string, [number, number, string, string, string]> = game.display._data;
  if (!data || Object.keys(data).length === 0) return '(empty grid)';
  let maxX = 0, maxY = 0;
  for (const [x, y] of Object.values(data)) { if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  const rows: string[][] = Array.from({ length: maxY + 1 }, () => Array(maxX + 1).fill(' '));
  for (const [x, y, ch] of Object.values(data)) {
    if (ch && ch !== '\t') rows[y][x] = ch;
  }
  return rows.map(r => r.join('')).join('\n');
}

/** Compact room-level map: one char per room (taken directly from display), corridors shown. */
function renderRoomMap(): string {
  const dungeon = game.dungeon as any;
  const puzzle = game.puzzle as any;
  const { width, height } = puzzle.ipuz.dimensions;
  const data: Record<string, [number, number, string]> = game.display._data;

  // Read center char of room at (gx,gy) directly from the drawn display data
  const centerChar = (gx: number, gy: number): string => {
    const cx = 3 + gx * 6; // 1 (padding) + gx*6 + 2 (center of 5×5)
    const cy = 3 + gy * 6;
    return data[`${cx},${cy}`]?.[2] ?? ' ';
  };

  // Read corridor char: horizontal corridor between (gx,gy) and (gx+1,gy) is at display col gx*6+6, row gy*6+3+1=gy*6+4...
  // Actually the corridor center cell is at (1+gx*6+5, 1+gy*6+2) = (gx*6+6, gy*6+3)
  const hCorrChar = (gx: number, gy: number): string => {
    const cx = gx * 6 + 6;
    const cy = gy * 6 + 3;
    return data[`${cx},${cy}`]?.[2] ?? ' ';
  };
const lines: string[] = [];
  for (let gy = 0; gy < height; gy++) {
    let roomLine = '';
    let corrLine = '';
    for (let gx = 0; gx < width; gx++) {
      if (!dungeon.hasRoom(gx, gy)) {
        roomLine += '    ';
        corrLine += '    ';
      } else {
        roomLine += `[${centerChar(gx, gy)}]`;
        const connD = dungeon.areConnected(gx, gy, gx, gy + 1);
        const lockedD = connD && dungeon.isLockedBetween(gx, gy, gx, gy + 1);
        corrLine += connD ? ` ${lockedD ? '‖' : '|'} ` : '   ';
      }
      // Horizontal corridor between this room and next
      if (gx < width - 1) {
        const conn = dungeon.areConnected(gx, gy, gx + 1, gy);
        const locked = conn && dungeon.isLockedBetween(gx, gy, gx + 1, gy);
        const sep = !conn ? ' ' : locked ? '=' : hCorrChar(gx, gy) === ' ' ? '-' : hCorrChar(gx, gy);
        roomLine += sep;
        corrLine += ' ';
      }
    }
    lines.push(roomLine);
    if (gy < height - 1) lines.push(corrLine);
  }
  return lines.join('\n');
}

function snapshot(): string {
  const grid = renderGrid();
  const roomMap = renderRoomMap();
  const hero = stripHtml(elements['hero']?.innerHTML ?? '');
  const encEl = elements['encounter'];
  const enc = (!encEl?.classList.contains('hidden')) ? stripHtml(encEl?.innerHTML ?? '') : '';
  const popupEl = elements['interaction-popup'];
  const popup = (!popupEl?.classList.contains('hidden')) ? stripHtml(popupEl?.innerHTML ?? '') : '';
  const level = stripHtml(elements['dungeon-level']?.innerHTML ?? '');
  const clues = stripHtml(elements['clues']?.innerHTML ?? '');
  const pos = `player @ grid(${game.playerPos?.x},${game.playerPos?.y})`;

  // Render full grid and room map side by side
  const gridLines = grid.split('\n');
  const mapLines = roomMap.split('\n');
  const mapW = Math.max(...mapLines.map(l => l.length)) + 4;
  const maxRows = Math.max(gridLines.length, mapLines.length);
  const sideBySide = Array.from({ length: maxRows }, (_, i) => {
    const g = (gridLines[i] ?? '').padEnd(46);
    const m = mapLines[i] ?? '';
    return `${g}  ${m}`;
  }).join('\n');

  return [
    `=== ${pos}  ${level} ===`,
    sideBySide,
    `--- HERO ---`,
    hero || '(empty)',
    `--- ENCOUNTER ---`,
    enc || '(empty)',
    clues ? `--- CLUES ---\n${clues}` : '',
    popup ? `--- POPUP ---\n${popup}` : '',
  ].filter(Boolean).join('\n');
}

// ── HTTP server ───────────────────────────────────────────────────────────────

async function sendKey(key: string): Promise<void> {
  const e = { key, preventDefault: () => {}, metaKey: false, ctrlKey: false, altKey: false };
  for (const fn of keydownListeners) fn(e);
  // Flush microtasks so queueMicrotask'd interval ticks (pulse animation) complete
  // before we read the snapshot.
  await Promise.resolve();
}

const PORT = 3001;
createServer(async (req, res) => {
  const url = new URL(req.url!, `http://localhost:${PORT}`);
  res.setHeader('Content-Type', 'text/plain');

  if (url.pathname === '/state') {
    res.end(snapshot());
  } else if (url.pathname === '/key') {
    const k = url.searchParams.get('k') ?? '';
    await sendKey(k);
    res.end(snapshot());
  } else if (url.pathname === '/dismiss') {
    await sendKey(' ');
    res.end(snapshot());
  } else if (url.pathname === '/debug') {
    const dungeon = game.dungeon as any;
    const puzzle = game.puzzle as any;
    const { width, height } = puzzle.ipuz.dimensions;
    const lines = [`Puzzle ${width}×${height}, playerPos: ${JSON.stringify(game.playerPos)}`];
    for (let gy = 0; gy < height; gy++) {
      let row = '';
      for (let gx = 0; gx < width; gx++) {
        const has = dungeon.hasRoom(gx, gy);
        const sol = puzzle.ipuz.solution[gy]?.[gx];
        row += has ? `(${gx},${gy})=${sol} ` : `(${gx},${gy})=# `;
      }
      lines.push(row);
    }
    // Print connections from player pos
    const px = game.playerPos.x, py = game.playerPos.y;
    lines.push(`\nFrom player (${px},${py}):`);
    for (const [dx,dy,name] of [[-1,0,'left'],[1,0,'right'],[0,-1,'up'],[0,1,'down']]) {
      const nx=px+(dx as number), ny=py+(dy as number);
      const has = dungeon.hasRoom(nx,ny);
      const conn = dungeon.areConnected(px,py,nx,ny);
      const locked = conn && dungeon.isLockedBetween(px,py,nx,ny);
      lines.push(`  ${name} (${nx},${ny}): hasRoom=${has} connected=${conn} locked=${locked}`);
    }
    res.end(lines.join('\n'));
  } else if (url.pathname === '/load') {
    // Load a hand-crafted fixture to set up a specific bug scenario.
    // GET /load?fixture=dragon-bug  → loads tests/fixtures/dragon-bug.json
    const name = url.searchParams.get('fixture') ?? '';
    const fixturePath = resolve(`./tests/fixtures/${name}.json`);
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

    // Build Puzzle + Dungeon from fixture ipuz
    const ipuz = validateIpuz(fixture.ipuz);
    const puzzle = new Puzzle(ipuz);
    const extraRooms = fixture.extraRooms ?? [];
    const dungeon = new Dungeon(puzzle, extraRooms);

    // Inject into live game instance (bypasses generator entirely)
    game.puzzle = puzzle;
    game.dungeon = dungeon;
    game.extraRooms = extraRooms;
    game.playerPos = fixture.playerPos;

    // Build roomStates map — generate a random encounter for any room missing one
    const rng = { getItem: <T>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)] as T, shuffle: <T>(arr: readonly T[]) => [...arr].sort(() => Math.random() - 0.5) as T[] };
    game.roomStates = new Map(Object.entries(fixture.roomStates).map(([k, v]: [string, any]) => {
      const enc = v.encounter ?? generateEncounter(rng, game.dungeonLevel);
      return [k, { ...v, encounter: enc }];
    }));

    game.puzzleComplete = false;
    game.gameOver = false;
    game.gameWon = false;
    game.render();
    res.end(`Loaded fixture: ${name}\n\n` + snapshot());
  } else {
    res.statusCode = 404;
    res.end('Not found. Endpoints: /state  /key?k=ArrowRight  /dismiss  /debug  /load?fixture=<name>');
  }
}).listen(PORT, () => {
  console.log(`Playtest server on http://localhost:${PORT}`);
  console.log('  GET /state         → current snapshot');
  console.log('  GET /key?k=<key>   → send key (ArrowUp/Down/Left/Right, a-z, 1-4)');
  console.log('  GET /dismiss       → dismiss popup (Space)');
});
