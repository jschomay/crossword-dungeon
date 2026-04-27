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
import type Puzzle from './puzzle';

// ---- Types ----

export type Coord = { x: number; y: number };

export type DungeonEvent =
  | { type: 'level:start' }
  | { type: 'room:solved'; x: number; y: number; encounterName: string }
  | { type: 'room:completed'; x: number; y: number }
  | { type: 'room:activated'; x: number; y: number }
  | { type: 'puzzle:complete' };

/** Type-specific per-level state for a room instance. */
export type ShopRoomState = Record<string, never>; // all shop state lives on RunContext

export type BossRoomState = { failPending: boolean; exitPending: boolean };

export type DragonTreasureRoomState = {
  dragonPos: Coord;    // grid position of the connected dragon letter room
  looted: boolean;
  goldAmount: number;
};

export type SimmRoomState = {
  dialogue: string;   // assembled dialogue lines, shown on interaction
};

export type HiddenTreasureRoomState = {
  claimed: boolean;
  contents: 'gold' | 'notes' | 'arch_hint';
  notesWords?: string[];   // 3 words: 1 real + 2 unused
};

export type VeryHiddenRoomState = {
  blessed: boolean;
  stat: 'max_hp' | 'max_mana' | 'damage' | 'defense';
};

export type TreasureHunterRoomState = {
  talked: boolean;
};

export type TraderRoomState = {
  traded: boolean;
  tradeSlot: string | null;   // slot of the item being offered for trade
  tradeOffer: { name: string; stats: string } | null;  // pre-generated offer shown in panel
};

export type MimicChestRoomState = {
  opened: boolean;
  isReal: boolean;  // true = 100 gold; false = mimic attack
};

export type FountainTrade = {
  give: { stat: 'damage' | 'defense' | 'max_hp' | 'max_mana'; amount: number };
  take: { stat: 'damage' | 'defense' | 'max_hp' | 'max_mana'; amount: number };
  desc: string;
};

export type CursedFountainRoomState = {
  used: boolean;
  trade: FountainTrade | null;
};

export type TrappedAdventurerRoomState = {
  adjacentRooms: Coord[];  // letter room positions that must be solved to unlock
  rescued: boolean;
  reward: 'gold' | 'hp_potion' | 'mana_potion' | 'arch_hint';
};

export type ExtraRoomState = ShopRoomState | BossRoomState | DragonTreasureRoomState | SimmRoomState | TrappedAdventurerRoomState | HiddenTreasureRoomState | VeryHiddenRoomState | TreasureHunterRoomState | TraderRoomState | CursedFountainRoomState | MimicChestRoomState;

/** Per-run state for the arch puzzle — persists across dungeon levels. */
export type ArchPuzzleState = {
  word: string;
  clue: string;
  guessedLetters: Set<string>; // all letters guessed (correct or wrong) this run
};

export type ExtraRoom = {
  type: 'shop' | 'boss' | 'dragon_treasure' | 'simm' | 'trapped_adventurer' | 'hidden_treasure' | 'very_hidden' | 'treasure_hunter' | 'trader' | 'cursed_fountain' | 'mimic_chest';
  pos: Coord;
  locked: boolean;
  completed: boolean;
  glowColor: string;
  state: ExtraRoomState;
  /**
   * If set, this room only draws corridors to/from this specific position.
   * Used for dragon treasure rooms that exclusively connect to their dragon room.
   */
  connectedTo?: Coord;
  /**
   * If true, this room is hidden until the player walks through its entrance.
   * The dungeon renders a crack '+' in the adjacent letter room wall instead of a full corridor.
   * Set to false once the player discovers the room.
   */
  hidden?: boolean;
  /**
   * If true, this room is very hidden: no crack indicator.
   * The room's wall positions render as subtle background chars.
   * Set to false once the player discovers the room.
   */
  veryHidden?: boolean;
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
  showInteraction(lines: string[], onDismiss?: () => void): void;
  render(): void;
  advancePuzzle(): Promise<void>;
  triggerVictory(): void;

  // Shop-specific (kept on RunContext since shop state is all in Game)
  renderShopPanel(): void;
  shopPurchase(slot: number): void;

  // General bonus room actions
  addGold(amount: number): void;
  isRoomSolved(pos: Coord): boolean;  // true if puzzle letter room at pos has solvedLetter

  // Per-run state flags
  readonly hasMetSimm: boolean;
  setHasMetSimm(value: boolean): void;
  readonly simmLastCommentedItem: string | null;
  setSimmLastCommentedItem(value: string | null): void;

  // Bonus room queries
  getVeryHiddenRooms(): Array<{ pos: Coord; adjacentLetterRoom: Coord; direction: string; letterHint: string }>;
  hasFoundTreasureAlready(): boolean;

  // Append a line to the next popup that gets shown (used by event handlers that fire before showInteraction)
  appendToNextPopup(line: string): void;
  // Queue a popup to show after the current popup is dismissed
  showAfterPopup(line: string): void;

  // Puzzle word helpers
  readonly puzzleWords: string[];    // words used in current puzzle
  readonly unusedPuzzleWords: string[];  // words from ipuz not used in current puzzle

  // Permanent stat bonuses
  applyStatBonus(stat: 'max_hp' | 'max_mana' | 'damage' | 'defense', amount: number): void;

  // Equipment trading
  readonly equippedItemsFull: Array<{ slot: string; name: string; level: number }>;
  generateTradeOffer(slot: string): { name: string; stats: string } | null;
  tradeEquippedItem(slot: string): { newItemName: string } | null;

  // Direct damage (for traps and mimic attacks)
  takeDamage(hpDmg: number, manaDmg: number): void;

  // Inventory actions
  addHpPotion(): void;
  addManaPotion(): void;
  revealArchLetter(): string | null;  // reveals a random unrevealed arch puzzle letter; returns letter or null if no arch puzzle

  // Player status
  readonly hp: number;
  readonly maxHp: number;
  readonly mana: number;
  readonly maxMana: number;
  readonly effectiveDamage: number;
  readonly effectiveDefense: number;
  readonly equippedItems: Array<{ name: string }>;
}

/**
 * Context passed to buildState at room generation time.
 * Lighter than RunContext — only what's needed to construct initial room state.
 */
export interface BuildContext {
  readonly dungeonLevel: number;
  readonly archPuzzle: ArchPuzzleState | null;
  readonly puzzle: Puzzle;
  readonly fullIpuz: Ipuz;
  readonly selectedWordKeys: Set<string>;
  /** Returns true if the letter room at pos has a pre-solved letter at generation time. */
  isPreSolved(pos: Coord): boolean;
  /** Pick a random position from available, removing it. Returns null if none left. */
  pickPosition(available: Set<string>): Coord | null;
}

export type ExtraRoomDef = {
  type: 'shop' | 'boss' | 'dragon_treasure' | 'simm' | 'trapped_adventurer' | 'hidden_treasure' | 'very_hidden' | 'treasure_hunter' | 'trader' | 'cursed_fountain' | 'mimic_chest';
  glowColor: string;
  centerChar: string;
  lockedCenterChar: string;
  /** Minimum dungeon level for this room to spawn. */
  minLevel: number;
  /** Spawn chance 0–1, or 'always' to always spawn. */
  spawnChance: number | 'always';
  /** If true, room spawns locked. */
  initialLocked?: boolean;
  /** If true, room spawns hidden (crack indicator visible in adjacent wall). */
  initialHidden?: boolean;
  /** If true, room spawns very hidden (no indicator). */
  initialVeryHidden?: boolean;
  /**
   * Pick a position from available and build initial state.
   * Removes chosen position from available. Returns null if no valid placement exists.
   */
  buildState(ctx: BuildContext, available: Set<string>): { pos: Coord; state: ExtraRoomState } | null;
  /** onEvent mutates room.locked / room.state in response to game events */
  onEvent(room: ExtraRoom, event: DungeonEvent, ctx: RunContext): void;
  /** renderPanel returns the HTML string for the sidebar panel when player is in this room. */
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
  minLevel: 1,
  spawnChance: 'always',
  buildState: (ctx, available) => {
    const pos = ctx.pickPosition(available);
    return pos ? { pos, state: {} } : null;
  },

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
  minLevel: 1,
  spawnChance: 'always',
  initialLocked: true,
  buildState: (ctx, available) => {
    const pos = ctx.pickPosition(available);
    return pos ? { pos, state: { failPending: false, exitPending: false } } : null;
  },

  onEvent(room, event) {
    if (event.type === 'puzzle:complete') room.locked = false;
  },

  renderPanel(room, ctx) {
    const arch = ctx.archPuzzle;
    const BOSS_COLOR = '#ff4444';
    const s = (color: string, text: string) => `<span style="color:${color}">${text}</span>`;
    const bossState = room.state as BossRoomState;

    if (room.locked) {
      return s(BOSS_COLOR, 'The Sealed Door') + '<br>' +
        s('#888', 'You hear a rumbling beyond the sealed door.') + '<br>' +
        s('#666', 'Complete the dungeon to break the seal.') + '<br>';
    }

    // No arch puzzle yet (e.g. tutorial level) — show exit teaser, then fall
    if (!arch) {
      if (bossState.exitPending) {
        let html = s(BOSS_COLOR, 'The Exit') + '<br>';
        html += s('#888', 'As you reach for the door, it seals with a magical lock!') + '<br>';
        html += s('#888', 'A trap door opens and you fall to a deeper level of the dungeon!') + '<br><br>';
        html += s('#888', 'Press ') + `<span style="color:#fff">[SPACE]</span>` + s('#888', ' to continue.') + '<br>';
        return html;
      }
      let html = s(BOSS_COLOR, 'The Exit') + '<br>';
      html += s('#888', 'You found the exit! Freedom is within reach.') + '<br><br>';
      html += s('#888', 'Press ') + `<span style="color:#fff">[SPACE]</span>` + s('#888', ' to escape the dungeon.') + '<br>';
      return html;
    }

    if (bossState.failPending) {
      let html = s(BOSS_COLOR, 'The Sealed Door') + '<br>';
      html += s('#888', 'The rune corrupts the spell.') + '<br>';
      html += s('#888', 'A trap door opens and you fall to a deeper level of the dungeon!') + '<br><br>';
      html += s('#888', 'Press ') + `<span style="color:#fff">[SPACE]</span>` + s('#888', ' to continue.') + '<br>';
      return html;
    }

    const display = hangmanDisplay(arch.word, arch.guessedLetters);
    const failedList = [...arch.guessedLetters].filter(l => !arch.word.includes(l)).sort().join(' ');

    let html = s(BOSS_COLOR, 'The Sealed Door') + '<br>';
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
    ctx.render();
    return true;
  },
};

// ---- ExtraRoomDef: Dragon Treasure ----

export const DRAGON_TREASURE_DEF: ExtraRoomDef = {
  type: 'dragon_treasure',
  glowColor: '#ffaa00',
  centerChar: '$',
  lockedCenterChar: '$',
  minLevel: 2,
  spawnChance: 'always', // special: handled outside main loop, one per dragon
  buildState: () => null, // handled specially outside the main loop

  onEvent(room, event, ctx) {
    if (event.type === 'level:start') {
      room.locked = true;
      room.hidden = true;
    }
    if (event.type === 'room:activated') {
      const ds = room.state as DragonTreasureRoomState;
      if (event.x === ds.dragonPos.x && event.y === ds.dragonPos.y) {
        room.hidden = false;
        ctx.render();
      }
    }
    if (event.type === 'room:solved') {
      const ds = room.state as DragonTreasureRoomState;
      if (event.x === ds.dragonPos.x && event.y === ds.dragonPos.y && !room.hidden && event.encounterName === 'Dragon') {
        room.locked = false;
        ctx.showInteraction([
          `The dragon is defeated! The treasure room unlocks.`,
        ]);
        ctx.render();
      }
    }
  },

  renderPanel(room, _ctx) {
    const ds = room.state as DragonTreasureRoomState;
    const GOLD_COLOR = '#ffaa00';
    const s = (color: string, text: string) => `<span style="color:${color}">${text}</span>`;

    if (room.locked) {
      return s(GOLD_COLOR, "Dragon's Hoard") + '<br>' +
        s('#888', 'The chamber is sealed — the dragon still lives.') + '<br>' +
        s('#666', 'Defeat the dragon to claim the treasure.') + '<br>';
    }

    return s(GOLD_COLOR, "Dragon's Hoard") + '<br>' +
      s('#888', `A pile of gold glitters in the torchlight.`) + '<br>' +
      s('#ccc', `${ds.goldAmount} gold`) + '<br><br>' +
      s('#888', 'Press ') + `<span style="color:#fff">[SPACE]</span>` + s('#888', ' to loot the treasure.') + '<br>';
  },

  handleInput(room, key, ctx) {
    const ds = room.state as DragonTreasureRoomState;
    if (room.locked || ds.looted) return false;
    if (key === ' ') {
      ds.looted = true;
      ctx.addGold(ds.goldAmount);
      ctx.showInteraction([`You claim ${ds.goldAmount} gold from the dragon's hoard!`], () => { room.completed = true; });
      return true;
    }
    return false;
  },
};

// ---- Simm dialogue helpers (pure, testable) ----

const SIMM_GREETINGS_FIRST = [
  "Ah, another puzzle solver!",
  "Greetings, fellow adventurer!",
  "Oh! You surprised me, I don't run into many folks down here.",
];

const SIMM_GREETINGS_REPEAT = [
  "Hello again!",
  "We meet again.",
  "Oh hi. How are you managing?",
  "You again.",
  "Thought I'd see you again.",
  "You made it.",
  "Good to see you again.",
  "You're still here.",
];

const SIMM_CONTENT_FIRST = [
  "I've been poking around these corridors for quite some time. I can't tell you how many puzzles I've solved! Maybe we'll cross paths again.",
  "You must be new here. There's plenty of puzzles to solve. Plenty of danger too so watch your step. See you around.",
  "That's strange, I thought I recognized you from somewhere... But I've been down here so long, everything starts to look the same. You'll see.",
  "Glad you're here. We can compare notes and maybe we'll eventually find a way out.",
  "The last adventurer I ran into down here... well... never mind. I'm sure you'll do great!",
];

const SIMM_CONTENT_RANDOM = [
  "How do you like the puzzles? At first they irked me, now they are all I think about.",
  "Sometimes you'll find some good loot around here.",
  "Nice to see you've made it past all the monsters and traps so far!",
  "We're getting deeper now! Must be close to an exit.",
  "Have you made any progress on the magical seal barring the exit?",
  "Impressive! Not many make it this far.",
  "You have a respectable level. I stopped counting mine a long time ago.",
  "Have you fought a dragon yet? They're no joke!",
  "Have you come across the slime blob yet?",
  "If I ever get out, I'm going to write down all of these puzzles in a big book and become famous.",
  "Some say these halls used to be the foundations of a lost city.",
  "This used to be a safe place. Then smugglers started hiding their loot here. Next thing you know, they built traps to keep it safe. Then the monsters showed up...",
  "You ever wonder who made all these clues? Some say it is the work of multiple cryptic craftsmen, but there's a theory that all these levels are the work of a single mad puzzle setter who just couldn't stop.",
];

const SIMM_HP_LOW = [
  "You look a bit rough. Better find some health potion before your next fight!",
  "Are you doing alright? Be careful out there!",
  "Go buy some health potion before you do anything else.",
  "Your health is quite low. Take it slow. I'm hoping you'll be around for a while.",
];

const SIMM_MANA_LOW = [
  "You may need to conserve your mana more.",
  "Now might be a good time for a mana potion.",
  "Your mana is low, maybe there's a shrine around here somewhere to boost it.",
];

const SIMM_ITEM_COMMENTS = [
  (name: string) => `That's a fine ${name} you've got there.`,
  (name: string) => `Good thing you've got that ${name}.`,
  (name: string) => `Keep upgrading your ${name}.`,
  (name: string) => `I see you got a new ${name}.`,
];

/** Pick a random element from an array using Math.random. */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Build Simm's dialogue string for this encounter.
 * Pure aside from Math.random usage.
 */
export function buildSimmDialogue(
  hasMetBefore: boolean,
  hpPct: number,       // hp / maxHp
  manaPct: number,     // mana / maxMana
  equippedItemNames: string[],
): { dialogue: string; commentedItem: string | null } {
  const parts: string[] = [];

  // 1. Greeting
  const greeting = hasMetBefore
    ? pickRandom(SIMM_GREETINGS_REPEAT)
    : pickRandom(SIMM_GREETINGS_FIRST);
  parts.push(greeting);

  // 2. Content
  const content = !hasMetBefore
    ? pickRandom(SIMM_CONTENT_FIRST)
    : pickRandom(SIMM_CONTENT_RANDOM);
  parts.push(content);

  // 3. Additional content (at most one)
  const additionalOptions: Array<{ text: string; itemName: string | null }> = [];
  if (hpPct < 0.2) additionalOptions.push({ text: pickRandom(SIMM_HP_LOW), itemName: null });
  if (manaPct < 0.2) additionalOptions.push({ text: pickRandom(SIMM_MANA_LOW), itemName: null });
  let commentedItem: string | null = null;
  if (equippedItemNames.length > 0) {
    const itemName = pickRandom(equippedItemNames);
    const template = pickRandom(SIMM_ITEM_COMMENTS);
    additionalOptions.push({ text: template(itemName), itemName });
  }
  if (additionalOptions.length > 0) {
    const picked = pickRandom(additionalOptions);
    parts.push(picked.text);
    commentedItem = picked.itemName;
  }

  return { dialogue: parts.join(' '), commentedItem };
}

// ---- ExtraRoomDef: Simm ----

export const SIMM_DEF: ExtraRoomDef = {
  type: 'simm',
  glowColor: '#88ff88',
  centerChar: '&',
  lockedCenterChar: '&',
  minLevel: 1,
  spawnChance: 'always',
  buildState: (ctx, available) => {
    const pos = ctx.pickPosition(available);
    return pos ? { pos, state: { dialogue: '' } } : null;
  },

  onEvent(room, event, ctx) {
    if (event.type === 'level:start') {
      const s = room.state as SimmRoomState;
      const equippedNames = ctx.equippedItems.map(i => i.name).filter(Boolean);
      const newItemNames = equippedNames.filter(n => n !== ctx.simmLastCommentedItem);
      const result = buildSimmDialogue(
        ctx.hasMetSimm,
        ctx.hp / ctx.maxHp,
        ctx.mana / ctx.maxMana,
        newItemNames,
      );
      s.dialogue = result.dialogue;
      if (result.commentedItem !== null) ctx.setSimmLastCommentedItem(result.commentedItem);
      ctx.setHasMetSimm(true);
    }
  },

  renderPanel(_room, _ctx) {
    const COLOR = '#88ff88';
    const sp = (color: string, text: string) => `<span style="color:${color}">${text}</span>`;
    return sp(COLOR, 'Simm') + '<br>' +
      sp('#aaa', 'A plucky fellow adventurer.') + '<br><br>' +
      sp('#888', 'Press ') + `<span style="color:#fff">[SPACE]</span>` + sp('#888', ' to talk.') + '<br>';
  },

  handleInput(room, key, ctx) {
    if (key === ' ') {
      const s = room.state as SimmRoomState;
      ctx.showInteraction([`"${s.dialogue}"`, '', 'Simm runs off to solve other puzzles.'], () => { room.completed = true; });
      return true;
    }
    if (/^[a-z]$/.test(key)) return true;
    return false;
  },
};

// ---- ExtraRoomDef: Very Hidden Room (Sorcerer) ----

export const VERY_HIDDEN_DEF: ExtraRoomDef = {
  type: 'very_hidden',
  glowColor: '#aa66ff',
  centerChar: '%',
  lockedCenterChar: '%',
  minLevel: 2,
  spawnChance: 0.3,
  initialVeryHidden: true,
  buildState: (ctx, available) => {
    const pos = ctx.pickPosition(available);
    if (!pos) return null;
    const stats = ['max_hp', 'max_mana', 'damage', 'defense'] as const;
    return { pos, state: { blessed: false, stat: stats[Math.floor(Math.random() * stats.length)] } };
  },

  onEvent(_room, _event, _ctx) {},

  renderPanel(room, _ctx) {
    const COLOR = '#aa66ff';
    const sp = (color: string, text: string) => `<span style="color:${color}">${text}</span>`;

    if (room.veryHidden) return '';

    return sp(COLOR, 'Mysterious Sorcerer') + '<br>' +
      sp('#aaa', 'A mysterious sorcerer materializes before you, offering you a gift.') + '<br><br>' +
      sp('#888', 'Press ') + `<span style="color:#fff">[space]</span>` + sp('#888', ' to accept') + '<br>';
  },

  handleInput(room, key, ctx) {
    const s = room.state as VeryHiddenRoomState;
    if (room.veryHidden) return false;
    if (key === ' ') {
      s.blessed = true;
      const onDismiss = () => { room.completed = true; };
      if (s.stat === 'max_hp') {
        ctx.applyStatBonus('max_hp', 10);
        ctx.showInteraction(['The sorcerer blesses you with +10 max HP!'], onDismiss);
      } else if (s.stat === 'max_mana') {
        ctx.applyStatBonus('max_mana', 5);
        ctx.showInteraction(['The sorcerer blesses you with +5 max Mana!'], onDismiss);
      } else if (s.stat === 'damage') {
        ctx.applyStatBonus('damage', 3);
        ctx.showInteraction(['The sorcerer blesses you with +3 Damage!'], onDismiss);
      } else {
        ctx.applyStatBonus('defense', 2);
        ctx.showInteraction(['The sorcerer blesses you with +2 Defense!'], onDismiss);
      }
      return true;
    }
    if (/^[a-z]$/.test(key)) return true;
    return false;
  },
};

// ---- ExtraRoomDef: Hidden Treasure ----

export const HIDDEN_TREASURE_DEF: ExtraRoomDef = {
  type: 'hidden_treasure',
  glowColor: '#ffdd66',
  centerChar: '?',
  lockedCenterChar: '?',
  minLevel: 2,
  spawnChance: 0.3,
  initialHidden: true,
  buildState: (ctx, available) => {
    const pos = ctx.pickPosition(available);
    if (!pos) return null;
    const contentsOptions: HiddenTreasureRoomState['contents'][] = ['gold', 'notes'];
    if (ctx.archPuzzle) contentsOptions.push('arch_hint');
    const contents = contentsOptions[Math.floor(Math.random() * contentsOptions.length)];
    let notesWords: string[] | undefined;
    if (contents === 'notes') {
      const wordStr = (sol: Ipuz['solution'], cells: { x: number; y: number }[]) =>
        cells.map(c => sol[c.y]?.[c.x] as string).join('');
      const puzzleWds = getWords(ctx.puzzle.ipuz as Ipuz)
        .filter(w => ctx.selectedWordKeys.has(w.key))
        .map(w => wordStr(ctx.puzzle.ipuz.solution as Ipuz['solution'], w.cells))
        .filter(w => w && !/[^A-Z]/.test(w));
      const unusedWds = getWords(ctx.fullIpuz)
        .filter(w => !ctx.selectedWordKeys.has(w.key))
        .map(w => wordStr(ctx.fullIpuz.solution, w.cells))
        .filter(w => w && !/[^A-Z]/.test(w));
      const realWord = puzzleWds[Math.floor(Math.random() * puzzleWds.length)] ?? 'MYSTERY';
      const unused1 = unusedWds[Math.floor(Math.random() * unusedWds.length)] ?? 'UNKNOWN';
      const unused2 = unusedWds.filter(w => w !== unused1)[Math.floor(Math.random() * (unusedWds.length - 1))] ?? 'ENIGMA';
      notesWords = [realWord, unused1, unused2].sort(() => Math.random() - 0.5);
    }
    return { pos, state: { claimed: false, contents, notesWords } };
  },

  onEvent(_room, _event, _ctx) {},

  renderPanel(room, _ctx) {
    const s = room.state as HiddenTreasureRoomState;
    const COLOR = '#ffdd66';
    const sp = (color: string, text: string) => `<span style="color:${color}">${text}</span>`;

    if (room.hidden) {
      return ''; // not visible yet
    }

    const actionWord = s.contents === 'gold' ? 'loot' : 'explore';
    let contentsDesc = '';
    if (s.contents === 'gold') {
      contentsDesc = 'Something glitters in the dust.';
    } else if (s.contents === 'notes') {
      contentsDesc = 'Paper scraps litter the floor, notes scribbled across them.';
    } else {
      contentsDesc = 'A faded inscription adorns the wall, hinting at a magical seal.';
    }

    return sp(COLOR, 'Secret Chamber') + '<br>' +
      sp('#aaa', 'A long forgotten room.') + '<br>' +
      sp('#aaa', contentsDesc) + '<br><br>' +
      sp('#888', 'Press ') + `<span style="color:#fff">[SPACE]</span>` + sp('#888', ` to ${actionWord}.`) + '<br>';
  },

  handleInput(room, key, ctx) {
    if (room.hidden) return false;
    if (key === ' ') {
      const s = room.state as HiddenTreasureRoomState;
      s.claimed = true;
      const onDismiss = () => { room.completed = true; };
      if (s.contents === 'gold') {
        ctx.addGold(50);
        ctx.showInteraction(['You find 50 gold!'], onDismiss);
      } else if (s.contents === 'arch_hint') {
        const letter = ctx.revealArchLetter();
        if (letter) {
          ctx.showInteraction([`The inscription reveals the letter '${letter}'. Don't forget it!`], onDismiss);
        } else {
          ctx.showInteraction(['The inscription is illegible.'], onDismiss);
        }
      } else {
        ctx.showInteraction([
          'You piece together the notes...',
          ...(s.notesWords ?? []).map(w => `  ${w}`),
          'The paper crumbles to dust in your hands.',
        ], onDismiss);
      }
      return true;
    }
    if (/^[a-z]$/.test(key)) return true;
    return false;
  },
};

// ---- ExtraRoomDef: Trapped Adventurer ----

const TRAPPED_ADVENTURER_DIALOGUES = [
  "I'm free! At last, I'm free!",
  "Oh, thank you! I thought I'd be locked down here forever.",
  "I got trapped in here while searching for treasure. Thank you for freeing me!",
];

export const TRAPPED_ADVENTURER_DEF: ExtraRoomDef = {
  type: 'trapped_adventurer',
  glowColor: '#ffcc44',
  centerChar: '&',
  lockedCenterChar: '&',
  minLevel: 2,
  spawnChance: 0.3,
  buildState: (ctx, available) => {
    const { width, height } = ctx.puzzle.ipuz.dimensions;
    const roomSet = new Set(ctx.puzzle.getRooms().map(r => `${r.x},${r.y}`));
    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];

    // Filter available positions to those with at least one unsolved adjacent letter room
    const validKeys = [...available].filter(key => {
      const [x, y] = key.split(',').map(Number);
      return dirs.some(({ dx, dy }) => {
        const nx = x + dx, ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < width && ny < height
          && roomSet.has(`${nx},${ny}`)
          && !ctx.isPreSolved({ x: nx, y: ny });
      });
    });
    if (validKeys.length === 0) return null;

    const key = validKeys[Math.floor(Math.random() * validKeys.length)];
    available.delete(key);
    const [x, y] = key.split(',').map(Number);
    const pos = { x, y };

    const adjacentRooms: Coord[] = [];
    for (const { dx, dy } of dirs) {
      const nx = pos.x + dx, ny = pos.y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && roomSet.has(`${nx},${ny}`)
          && !ctx.isPreSolved({ x: nx, y: ny })) {
        adjacentRooms.push({ x: nx, y: ny });
      }
    }
    const rewards = ['gold', 'hp_potion', 'mana_potion', 'arch_hint'] as const;
    const reward = rewards[Math.floor(Math.random() * rewards.length)];
    return { pos, state: { adjacentRooms, rescued: false, reward } };
  },

  onEvent(room, event, ctx) {
    if (event.type === 'level:start') {
      const s = room.state as TrappedAdventurerRoomState;
      s.rescued = false;
      // Only lock if there are unsolved adjacent rooms that aren't already solved
      const unsolvedAdjacent = s.adjacentRooms.filter(pos => !ctx.isRoomSolved(pos));
      room.locked = unsolvedAdjacent.length > 0;
    }
    if (event.type === 'room:solved') {
      if (room.locked) {
        const s = room.state as TrappedAdventurerRoomState;
        const unsolvedAdjacent = s.adjacentRooms.filter(pos => !ctx.isRoomSolved(pos));
        if (unsolvedAdjacent.length === 0) {
          ctx.showAfterPopup('A nearby door swings open.');
          room.locked = false;
          ctx.render();
        }
      }
    }
  },

  renderPanel(room, ctx) {
    const s = room.state as TrappedAdventurerRoomState;
    const COLOR = '#ffcc44';
    const sp = (color: string, text: string) => `<span style="color:${color}">${text}</span>`;

    if (room.locked) {
      const remaining = s.adjacentRooms.filter(pos => !ctx.isRoomSolved(pos)).length;
      return sp(COLOR, 'Trapped Adventurer') + '<br>' +
        sp('#888', 'A ragged adventurer peers at you desperately from behind a locked door.') + '<br>' +
        sp('#666', `Solve ${remaining} more adjacent room(s) to unlock`) + '<br>';
    }

    return sp(COLOR, 'Trapped Adventurer') + '<br>' +
      sp('#aaa', 'A ragged adventurer waits behind the now-open door.') + '<br><br>' +
      sp('#888', 'Press ') + `<span style="color:#fff">[SPACE]</span>` + sp('#888', ' to free them.') + '<br>';
  },

  handleInput(room, key, ctx) {
    if (room.locked) return false;
    if (key === ' ') {
      const s = room.state as TrappedAdventurerRoomState;
      if (s.rescued) return false;
      s.rescued = true;
      const onDismiss = () => { room.completed = true; };
      let rewardLine: string;
      if (s.reward === 'gold') {
        ctx.addGold(30);
        rewardLine = 'They press 30 gold into your hand. "Take it, please."';
      } else if (s.reward === 'hp_potion') {
        ctx.addHpPotion();
        rewardLine = '"Here, take this health potion. It\'s all I have."';
      } else if (s.reward === 'mana_potion') {
        ctx.addManaPotion();
        rewardLine = '"Here, take this mana potion. It\'s all I have."';
      } else {
        const letter = ctx.revealArchLetter();
        rewardLine = letter
          ? `They lean in close. "I have a secret. '${letter}' is a magical rune. You'll know when to use it. Don't forget!"`
          : '"Thank you for freeing me. Safe travels."';
      }
      ctx.showInteraction([pickRandom(TRAPPED_ADVENTURER_DIALOGUES), rewardLine], onDismiss);
      return true;
    }
    if (/^[a-z]$/.test(key)) return true;
    return false;
  },
};

// ---- ExtraRoomDef: Treasure Hunter ----

export const TREASURE_HUNTER_DEF: ExtraRoomDef = {
  type: 'treasure_hunter',
  glowColor: '#ffaa44',
  centerChar: '&',
  lockedCenterChar: '&',
  minLevel: 2,
  spawnChance: 0.3,
  buildState: (ctx, available) => {
    const pos = ctx.pickPosition(available);
    return pos ? { pos, state: { talked: false } } : null;
  },

  onEvent(room, event, _ctx) {
    if (event.type === 'level:start') {
      (room.state as TreasureHunterRoomState).talked = false;
    }
  },

  renderPanel(_room, _ctx) {
    const COLOR = '#ffaa44';
    const sp = (color: string, text: string) => `<span style="color:${color}">${text}</span>`;

    return sp(COLOR, 'Treasure Hunter') + '<br>' +
      sp('#aaa', 'A furtive treasure hunter hides in the shadows.') + '<br><br>' +
      sp('#888', 'Press ') + `<span style="color:#fff">[SPACE]</span>` + sp('#888', ' to talk.') + '<br>';
  },

  handleInput(room, key, ctx) {
    if (key === ' ') {
      const s = room.state as TreasureHunterRoomState;
      s.talked = true;
      const vhRooms = ctx.getVeryHiddenRooms();
      let hint: string;
      if (vhRooms.length === 0) {
        if (ctx.hasFoundTreasureAlready()) {
          hint = "You found it before me! Keep treasure hunting — see you next time.";
        } else {
          hint = "Have you heard about the secret rooms? Sometimes you can find them if you look hard enough. I haven't found any on this level yet.";
        }
      } else {
        const vh = vhRooms[0];
        hint = `Pssst! I found something! There's a secret room hidden ${vh.direction} of the letter ${vh.letterHint}.`;
      }
      ctx.showInteraction([hint], () => { room.completed = true; });
      return true;
    }
    if (/^[a-z]$/.test(key)) return true;
    return false;
  },
};

// ---- ExtraRoomDef: Trader ----

export const TRADER_DEF: ExtraRoomDef = {
  type: 'trader',
  glowColor: '#cc8844',
  centerChar: '%',
  lockedCenterChar: '%',
  minLevel: 3,
  spawnChance: 0.3,
  buildState: (ctx, available) => {
    const pos = ctx.pickPosition(available);
    return pos ? { pos, state: { traded: false, tradeSlot: null, tradeOffer: null } } : null;
  },

  onEvent(room, event, ctx) {
    if (event.type === 'level:start') {
      const s = room.state as TraderRoomState;
      s.traded = false;
      const items = ctx.equippedItemsFull;
      s.tradeSlot = items.length > 0 ? items[Math.floor(Math.random() * items.length)].slot : null;
      s.tradeOffer = s.tradeSlot ? ctx.generateTradeOffer(s.tradeSlot) : null;
    }
  },

  renderPanel(room, ctx) {
    const s = room.state as TraderRoomState;
    const COLOR = '#cc8844';
    const sp = (color: string, text: string) => `<span style="color:${color}">${text}</span>`;

    const items = ctx.equippedItemsFull;
    if (items.length === 0 || !s.tradeSlot) {
      return sp(COLOR, 'Trader') + '<br>' +
        sp('#aaa', 'A weathered trader eyes your gear.') + '<br>' +
        sp('#888', 'Come back when you have some items to trade!') + '<br>';
    }

    const offerItem = items.find(i => i.slot === s.tradeSlot);
    if (!offerItem) {
      return sp(COLOR, 'Trader') + '<br>' +
        sp('#888', '"Hmm, seems you no longer have the item I wanted..."') + '<br>';
    }

    const offer = s.tradeOffer;
    const offerDesc = offer ? `${offer.name} Lv.${offerItem.level} [${offerItem.slot}] ${offer.stats}` : '...';
    return sp(COLOR, 'Trader') + '<br>' +
      sp('#aaa', 'A weathered trader eyes your gear.') + '<br>' +
      sp('#aaa', `They offer to trade your ${offerItem.name} for their ${offerDesc}.`) + '<br><br>' +
      sp('#888', 'Press ') + `<span style="color:#fff">[SPACE]</span>` + sp('#888', ' to accept trade.') + '<br>';
  },

  handleInput(room, key, ctx) {
    const s = room.state as TraderRoomState;
    if (!s.tradeSlot) return false;
    const items = ctx.equippedItemsFull;
    if (items.length === 0) return false;
    if (key === ' ') {
      const result = ctx.tradeEquippedItem(s.tradeSlot);
      s.traded = true;
      const onDismiss = () => { room.completed = true; };
      if (result) {
        ctx.showInteraction([`Trade complete! You received a ${result.newItemName}.`], onDismiss);
      } else {
        ctx.showInteraction(['The trader shrugs — no suitable item for trade.'], onDismiss);
      }
      return true;
    }
    if (/^[a-z]$/.test(key)) return true;
    return false;
  },
};

// ---- Cursed Fountain helpers ----

const ALL_FOUNTAIN_TRADES: FountainTrade[] = [
  { give: { stat: 'damage', amount: 3 }, take: { stat: 'max_hp', amount: 15 }, desc: '+3 DMG, -15 max HP' },
  { give: { stat: 'max_hp', amount: 15 }, take: { stat: 'damage', amount: 3 }, desc: '+15 max HP, -3 DMG' },
  { give: { stat: 'max_hp', amount: 10 }, take: { stat: 'max_mana', amount: 5 }, desc: '+10 max HP, -5 max Mana' },
  { give: { stat: 'max_mana', amount: 5 }, take: { stat: 'max_hp', amount: 10 }, desc: '+5 max Mana, -10 max HP' },
  { give: { stat: 'damage', amount: 5 }, take: { stat: 'defense', amount: 5 }, desc: '+5 DMG, -5 DEF' },
  { give: { stat: 'defense', amount: 5 }, take: { stat: 'damage', amount: 5 }, desc: '+5 DEF, -5 DMG' },
];

function statValue(stat: FountainTrade['give']['stat'], ctx: RunContext): number {
  switch (stat) {
    case 'max_hp': return ctx.maxHp;
    case 'max_mana': return ctx.maxMana;
    case 'damage': return ctx.effectiveDamage;
    case 'defense': return ctx.effectiveDefense;
  }
}

export function getValidFountainTrades(ctx: RunContext): FountainTrade[] {
  return ALL_FOUNTAIN_TRADES.filter(t => statValue(t.take.stat, ctx) >= t.take.amount);
}

// ---- ExtraRoomDef: Cursed Fountain ----

export const CURSED_FOUNTAIN_DEF: ExtraRoomDef = {
  type: 'cursed_fountain',
  glowColor: '#4444cc',
  centerChar: '?',
  lockedCenterChar: '?',
  minLevel: 3,
  spawnChance: 0.3,
  buildState: (ctx, available) => {
    const pos = ctx.pickPosition(available);
    return pos ? { pos, state: { used: false, trade: null } } : null;
  },

  onEvent(room, event, ctx) {
    if (event.type === 'level:start') {
      const s = room.state as CursedFountainRoomState;
      s.used = false;
      // Pick a random affordable trade; fall back to any trade if none affordable
      const validTrades = getValidFountainTrades(ctx);
      s.trade = pickRandom(validTrades.length > 0 ? validTrades : ALL_FOUNTAIN_TRADES);
    }
  },

  renderPanel(room, ctx) {
    const s = room.state as CursedFountainRoomState;
    const COLOR = '#4444cc';
    const sp = (color: string, text: string) => `<span style="color:${color}">${text}</span>`;

    // Re-check trade validity in case stats changed since level:start
    if (s.trade && !s.used) {
      const valid = getValidFountainTrades(ctx);
      if (!valid.some(t => t.give.stat === s.trade!.give.stat && t.take.stat === s.trade!.take.stat)) {
        s.trade = valid.length > 0 ? pickRandom(valid) : null;
      }
    }

    const [give, take] = s.trade && !s.used ? [s.trade.give, s.trade.take] : [null, null];
    const fmtStat = (stat: string, amt: number) => {
      const label = stat === 'max_hp' ? 'max HP' : stat === 'max_mana' ? 'max Mana' : stat === 'damage' ? 'DMG' : 'DEF';
      return `+${amt} ${label}`;
    };
    const tradeGive = give ? fmtStat(give.stat, give.amount) : '';
    const tradeTake = take ? `-${take.amount} ${take.stat === 'max_hp' ? 'max HP' : take.stat === 'max_mana' ? 'max Mana' : take.stat === 'damage' ? 'DMG' : 'DEF'}` : '';
    const tradeDesc = give && take
      ? `An eerie voice whispers an unholy transaction:<br>${tradeGive} for ${tradeTake}`
      : s.used ? 'You have already drunk from this fountain.' : 'The fountain offers no trade you can afford.';

    const spacePrompt = give && take
      ? sp('#888', 'Press ') + `<span style="color:#fff">[SPACE]</span>` + sp('#888', ' to drink.') + '<br>'
      : '';

    return sp(COLOR, 'Cursed Fountain') + '<br>' +
      sp('#aaa', 'A fountain bubbling with dark energy.') + '<br>' +
      sp('#ccc', tradeDesc) + '<br><br>' +
      spacePrompt;
  },

  handleInput(room, key, ctx) {
    const s = room.state as CursedFountainRoomState;
    if (!s.trade) return false;
    if (key === ' ') {
      s.used = true;
      ctx.applyStatBonus(s.trade.give.stat, s.trade.give.amount);
      ctx.applyStatBonus(s.trade.take.stat, -s.trade.take.amount);
      const g = s.trade.give, t = s.trade.take;
      const fmtS = (stat: string, amt: number, sign: '+' | '-') => {
        const label = stat === 'max_hp' ? 'max HP' : stat === 'max_mana' ? 'max Mana' : stat === 'damage' ? 'DMG' : 'DEF';
        return `${sign}${amt} ${label}`;
      };
      ctx.showInteraction([
        'You drink from the cursed fountain...',
        `${fmtS(g.stat, g.amount, '+')}  ${fmtS(t.stat, t.amount, '-')}`,
      ], () => { room.completed = true; });
      return true;
    }
    if (/^[a-z]$/.test(key)) return true;
    return false;
  },
};

// ---- ExtraRoomDef: Mimic Chest ----

export const MIMIC_CHEST_DEF: ExtraRoomDef = {
  type: 'mimic_chest',
  glowColor: '#ccaa22',
  centerChar: '$',
  lockedCenterChar: '$',
  minLevel: 2,
  spawnChance: 0.3,
  buildState: (ctx, available) => {
    const pos = ctx.pickPosition(available);
    return pos ? { pos, state: { opened: false, isReal: Math.random() < 0.5 } } : null;
  },

  onEvent(room, event) {
    if (event.type === 'level:start') {
      room.locked = false;
      const s = room.state as MimicChestRoomState;
      s.opened = false;
      s.isReal = Math.random() < 0.5;
    }
  },

  renderPanel(_room, _ctx) {
    const GOLD = '#ccaa22';
    const sp = (color: string, text: string) => `<span style="color:${color}">${text}</span>`;

    return sp(GOLD, 'Treasure Chest') + '<br>' +
      sp('#aaa', 'An old chest covered in dust sits here.') + '<br><br>' +
      sp('#888', 'Press ') + `<span style="color:#fff">[SPACE]</span>` + sp('#888', ' to loot.') + '<br>';
  },

  handleInput(room, key, ctx) {
    if (key !== ' ') return false;
    const s = room.state as MimicChestRoomState;
    if (s.opened) return true;

    s.opened = true;
    const onDismiss = () => { room.completed = true; };
    if (s.isReal) {
      ctx.addGold(100);
      ctx.showInteraction(['You find 100 gold inside the chest!'], onDismiss);
    } else {
      const hpDmg = Math.floor(ctx.hp * 0.5);
      const manaDmg = Math.floor(ctx.mana * 0.5);
      ctx.takeDamage(hpDmg, manaDmg);
      ctx.showInteraction([
        'The chest is trapped!',
        `-${hpDmg} HP  -${manaDmg} MANA`,
      ], onDismiss);
    }
    return true;
  },
};

// ---- Registry ----

export const EXTRA_ROOM_DEFS: Record<string, ExtraRoomDef> = {
  shop: SHOP_DEF,
  boss: BOSS_DEF,
  dragon_treasure: DRAGON_TREASURE_DEF,
  simm: SIMM_DEF,
  trapped_adventurer: TRAPPED_ADVENTURER_DEF,
  hidden_treasure: HIDDEN_TREASURE_DEF,
  very_hidden: VERY_HIDDEN_DEF,
  treasure_hunter: TREASURE_HUNTER_DEF,
  trader: TRADER_DEF,
  cursed_fountain: CURSED_FOUNTAIN_DEF,
  mimic_chest: MIMIC_CHEST_DEF,
};

/** Alias for use in dungeon rendering — same object, exported separately for clarity. */
export const EXTRA_ROOM_DEFS_MAP = EXTRA_ROOM_DEFS;

/**
 * Ordered list of defs for the bonus room generation loop.
 * Dragon treasure is excluded — it's handled separately per dragon encounter.
 */
export const BONUS_ROOM_DEFS: ExtraRoomDef[] = [
  SHOP_DEF,
  BOSS_DEF,
  SIMM_DEF,
  TRAPPED_ADVENTURER_DEF,
  VERY_HIDDEN_DEF,
  HIDDEN_TREASURE_DEF,
  TREASURE_HUNTER_DEF,
  TRADER_DEF,
  CURSED_FOUNTAIN_DEF,
  MIMIC_CHEST_DEF,
];

export function getDef(type: string): ExtraRoomDef {
  return EXTRA_ROOM_DEFS[type];
}
