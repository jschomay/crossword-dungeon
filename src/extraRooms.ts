/**
 * Extra Room architecture: registry + observer pattern.
 *
 * ExtraRoomDef  — static behavior object, one per room type
 * ExtraRoom     — per-level instance with position and mutable state
 * DungeonEvent  — events emitted by Game; defs react via onEvent
 * RunContext    — shared game state passed into all def handlers
 */

import { getWords } from './puzzle';
import type { Ipuz } from './puzzle';

// ---- Types ----

export type Coord = { x: number; y: number };

export type DungeonEvent =
  | { type: 'level:start' }
  | { type: 'room:solved'; x: number; y: number }
  | { type: 'puzzle:complete' };

/** Type-specific per-level state for a room instance. */
export type ShopRoomState = Record<string, never>; // all shop state lives on RunContext

export type BossRoomState = { failPending: boolean; exitPending: boolean };

export type ExtraRoomState = ShopRoomState | BossRoomState;

/** Per-run state for the arch puzzle — persists across dungeon levels. */
export type ArchPuzzleState = {
  word: string;
  clue: string;
  guessedLetters: Set<string>; // all letters guessed (correct or wrong) this run
};

export type ExtraRoom = {
  type: 'shop' | 'boss';
  pos: Coord;
  locked: boolean;
  glowColor: string;
  state: ExtraRoomState;
};

/**
 * RunContext is the interface that ExtraRoomDef handlers use to read/mutate game state.
 * Game implements this and passes `this` (cast) to all handler calls.
 */
export interface RunContext {
  // Read-only game state
  readonly dungeonLevel: number;
  readonly gold: number;
  readonly archPuzzle: ArchPuzzleState | null;
  readonly puzzleComplete: boolean;

  // Actions
  showInteraction(lines: string[]): void;
  clearLogs(): void;
  render(): void;
  advancePuzzle(): Promise<void>;
  triggerVictory(): void;

  // Shop-specific (kept on RunContext since shop state is all in Game)
  renderShopPanel(): void;
  shopPurchase(slot: number): void;
}

export type ExtraRoomDef = {
  type: 'shop' | 'boss';
  glowColor: string;
  centerChar: string;
  lockedCenterChar: string;
  /** onEvent mutates room.locked / room.state in response to game events */
  onEvent(room: ExtraRoom, event: DungeonEvent, ctx: RunContext): void;
  /**
   * renderPanel returns the HTML string for the sidebar panel when player is in this room.
   * Game is responsible for injecting it into the DOM.
   */
  renderPanel(room: ExtraRoom, ctx: RunContext): string;
  /** handleInput handles a key press when player is in this room. Returns true if consumed. */
  handleInput(room: ExtraRoom, key: string, ctx: RunContext): boolean;
};

// ---- Arch puzzle helpers (pure, testable) ----

/**
 * Select the arch puzzle word from the first ipuz puzzle.
 * selectedKeys: the Set<string> of word keys used in dungeon generation.
 * Returns the word of median length from the unused eligible words,
 * or null if none are available.
 */
export function selectArchWord(
  ipuz: Ipuz,
  selectedKeys: Set<string>,
): { word: string; clue: string } | null {
  const allWords = getWords(ipuz);
  const unused = allWords.filter(w => !selectedKeys.has(w.key));
  if (unused.length === 0) return null;

  // Build word strings from solution
  const candidates: { word: string; clue: string; len: number }[] = [];
  for (const w of unused) {
    const letters = w.cells.map(c => ipuz.solution[c.y]?.[c.x]);
    if (letters.some(l => !l || l === '#')) continue;
    const wordStr = letters.join('') as string;
    if (wordStr.length < 3) continue;
    const dir = w.direction === 'across' ? 'Across' : 'Down';
    const clue = ipuz.clues[dir].find(([n]) => n === w.number)?.[1] ?? '';
    if (!clue) continue;
    if (wordStr.length < 10) candidates.push({ word: wordStr, clue, len: wordStr.length });
  }
  if (candidates.length === 0) return null;

  // Sort descending by length, pick randomly from the top 3
  candidates.sort((a, b) => b.len - a.len);
  const pool = candidates.slice(0, 3);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return { word: pick.word, clue: pick.clue };
}

/**
 * Build the hangman display string for a word given guessed letters.
 * Returns space-separated chars: revealed letters or '_'.
 * e.g. word="CASTLE", guessed={'C','E'} → "C _ _ _ L E"  (wait, only C and E guessed)
 * Actually: "C _ _ _ _ E"
 */
export function hangmanDisplay(word: string, guessedLetters: Set<string>): string {
  return word
    .split('')
    .map(ch => (guessedLetters.has(ch) ? ch : '_'))
    .join(' ');
}

/**
 * Check if all letters in word have been guessed.
 */
export function isWordSolved(word: string, guessedLetters: Set<string>): boolean {
  return word.split('').every(ch => guessedLetters.has(ch));
}

/**
 * Process a boss letter guess.
 * Returns: 'already_guessed' | 'correct' | 'wrong'
 */
export function processBossGuess(
  arch: ArchPuzzleState,
  letter: string,
): 'already_guessed' | 'correct' | 'wrong' {
  const upper = letter.toUpperCase();
  if (arch.guessedLetters.has(upper)) return 'already_guessed';
  arch.guessedLetters.add(upper);
  return arch.word.includes(upper) ? 'correct' : 'wrong';
}

// ---- ExtraRoomDef: Shop ----

export const SHOP_DEF: ExtraRoomDef = {
  type: 'shop',
  glowColor: '#44ffcc',
  centerChar: '%',
  lockedCenterChar: '%',

  onEvent(room, event) {
    if (event.type === 'level:start') room.locked = false;
  },

  renderPanel(_room, ctx) {
    // Delegate to Game's existing shop render — returns sentinel so Game uses its own method
    ctx.renderShopPanel();
    return ''; // Game.renderShopPanel writes directly to DOM; return value unused
  },

  handleInput(_room, key, ctx) {
    if (/^[1-9]$/.test(key)) {
      ctx.clearLogs();
      ctx.shopPurchase(parseInt(key));
      return true;
    }
    if (/^[a-z]$/.test(key)) return true; // block letter guessing in shop
    return false;
  },
};

// ---- ExtraRoomDef: Boss ----

export const BOSS_DEF: ExtraRoomDef = {
  type: 'boss',
  glowColor: '#ff4444',
  centerChar: '/',
  lockedCenterChar: '/',

  onEvent(room, event) {
    if (event.type === 'level:start') {
      room.locked = true;
      (room.state as BossRoomState).failPending = false;
      (room.state as BossRoomState).exitPending = false;
    }
    if (event.type === 'puzzle:complete') room.locked = false;
  },

  renderPanel(room, ctx) {
    const arch = ctx.archPuzzle;
    const BOSS_COLOR = '#ff4444';
    const s = (color: string, text: string) => `<span style="color:${color}">${text}</span>`;
    const bossState = room.state as BossRoomState;

    if (room.locked) {
      return s(BOSS_COLOR, '/ The Sealed Door') + '<br>' +
        s('#888', 'You hear a rumbling beyond the sealed door.') + '<br>' +
        s('#666', 'Complete the dungeon to break the seal.') + '<br>';
    }

    // No arch puzzle yet (e.g. tutorial level) — show exit teaser, then fall
    if (!arch) {
      if (bossState.exitPending) {
        let html = s(BOSS_COLOR, '/ The Exit') + '<br>';
        html += s('#888', 'As you reach for the door, it seals with a magical lock!') + '<br>';
        html += s('#888', 'A trap door opens and you fall to a deeper level of the dungeon!') + '<br><br>';
        html += `<span style="color:#fff">[SPACE]</span>` + s('#888', ' Continue') + '<br>';
        return html;
      }
      let html = s(BOSS_COLOR, '/ The Exit') + '<br>';
      html += s('#888', 'You found the exit! Freedom is within reach.') + '<br><br>';
      html += `<span style="color:#fff">[SPACE]</span>` + s('#888', ' Escape the dungeon') + '<br>';
      return html;
    }

    if (bossState.failPending) {
      let html = s(BOSS_COLOR, '/ The Sealed Door') + '<br>';
      html += s('#888', 'The rune corrupts the spell.') + '<br>';
      html += s('#888', 'A trap door opens and you fall to a deeper level of the dungeon!') + '<br><br>';
      html += `<span style="color:#fff">[SPACE]</span>` + s('#888', ' Continue') + '<br>';
      return html;
    }

    const display = hangmanDisplay(arch.word, arch.guessedLetters);
    const failedList = [...arch.guessedLetters].filter(l => !arch.word.includes(l)).sort().join(' ');

    let html = s(BOSS_COLOR, '/ The Sealed Door') + '<br>';
    html += s('#888', 'You see a way out, but a magical seal bars the door.') + '<br>';
    html += s('#888', 'Cast the correct runes to break it —') + '<br>';
    html += s('#888', 'but watch out if you mess up the spell!') + '<br><br>';
    html += s('#ccc', 'Seal: ') + s('#ccc', display) + '<br><br>';
    if (failedList) html += s('#666', 'Failed runes tried: ' + failedList) + '<br>';
    html += s('#888', '[A-Z] Cast a rune') + '<br>';
    return html;
  },

  handleInput(room, key, ctx) {
    const arch = ctx.archPuzzle;
    const bossState = room.state as BossRoomState;

    // Handle pending failure: SPACE advances to next level
    if (bossState.failPending) {
      if (key === ' ') {
        bossState.failPending = false;
        ctx.advancePuzzle();
      }
      return true; // consume all input while failure is pending
    }

    // No arch puzzle yet — SPACE triggers exit-then-fall two-step
    if (!arch) {
      if (key === ' ') {
        if (bossState.exitPending) {
          bossState.exitPending = false;
          ctx.advancePuzzle();
        } else {
          bossState.exitPending = true;
          ctx.render();
        }
      }
      return true;
    }

    if (!/^[a-z]$/.test(key)) return false;
    if (room.locked) return true;

    const result = processBossGuess(arch, key.toUpperCase());
    if (result === 'already_guessed') {
      ctx.showInteraction([`You already tried '${key.toUpperCase()}'.`]);
      ctx.render();
      return true;
    }
    if (result === 'correct') {
      if (isWordSolved(arch.word, arch.guessedLetters)) {
        ctx.render();
        ctx.triggerVictory();
      } else {
        ctx.showInteraction([`The rune glows and burns into the seal.`]);
        ctx.render();
      }
      return true;
    }
    // wrong — show failure message, wait for SPACE
    bossState.failPending = true;
    ctx.clearLogs();
    ctx.render();
    return true;
  },
};

// ---- Registry ----

export const EXTRA_ROOM_DEFS: Record<string, ExtraRoomDef> = {
  shop: SHOP_DEF,
  boss: BOSS_DEF,
};

export function getDef(type: 'shop' | 'boss'): ExtraRoomDef {
  return EXTRA_ROOM_DEFS[type];
}
