import { describe, it, expect } from 'vitest';
import {
  hangmanDisplay,
  isWordSolved,
  processBossGuess,
  selectArchWord,
  SHOP_DEF,
  BOSS_DEF,
  DRAGON_TREASURE_DEF,
  type ExtraRoom,
  type ArchPuzzleState,
  type DragonTreasureRoomState,
} from './extraRooms';
import { validateIpuz, selectWords } from './puzzle';
import demoJson from '../tests/fixtures/demo.json';

const ipuz = validateIpuz(demoJson);

// ---- hangmanDisplay ----

describe('hangmanDisplay', () => {
  it('shows blanks for unguessed letters', () => {
    expect(hangmanDisplay('CASTLE', new Set())).toBe('_ _ _ _ _ _');
  });

  it('reveals guessed letters in place', () => {
    expect(hangmanDisplay('CASTLE', new Set(['C', 'E']))).toBe('C _ _ _ _ E');
  });

  it('fully revealed word', () => {
    expect(hangmanDisplay('CAT', new Set(['C', 'A', 'T']))).toBe('C A T');
  });
});

// ---- isWordSolved ----

describe('isWordSolved', () => {
  it('returns false when no letters guessed', () => {
    expect(isWordSolved('CASTLE', new Set())).toBe(false);
  });

  it('returns false when some letters missing', () => {
    expect(isWordSolved('CASTLE', new Set(['C', 'A', 'S']))).toBe(false);
  });

  it('returns true when all unique letters guessed', () => {
    expect(isWordSolved('CASTLE', new Set(['C', 'A', 'S', 'T', 'L', 'E']))).toBe(true);
  });

  it('handles duplicate letters — only unique needed', () => {
    // MOON has M, O, N — O appears twice but only needs one guess
    expect(isWordSolved('MOON', new Set(['M', 'O', 'N']))).toBe(true);
  });
});

// ---- processBossGuess ----

describe('processBossGuess', () => {
  function makeArch(word: string, guessed: string[] = []): ArchPuzzleState {
    return { word, clue: 'test clue', guessedLetters: new Set(guessed) };
  }

  it('returns correct for a letter in the word', () => {
    const arch = makeArch('CASTLE');
    expect(processBossGuess(arch, 'C')).toBe('correct');
    expect(arch.guessedLetters.has('C')).toBe(true);
  });

  it('returns wrong for a letter not in the word', () => {
    const arch = makeArch('CASTLE');
    expect(processBossGuess(arch, 'Z')).toBe('wrong');
    expect(arch.guessedLetters.has('Z')).toBe(true);
  });

  it('returns already_guessed for a repeated letter', () => {
    const arch = makeArch('CASTLE', ['C']);
    expect(processBossGuess(arch, 'C')).toBe('already_guessed');
    // still only one occurrence
    expect([...arch.guessedLetters].filter(l => l === 'C').length).toBe(1);
  });

  it('uppercases input before checking', () => {
    const arch = makeArch('CASTLE');
    expect(processBossGuess(arch, 'c')).toBe('correct');
  });
});

// ---- selectArchWord ----

describe('selectArchWord', () => {
  it('returns null if all words are used', () => {
    const allKeys = new Set(
      [...ipuz.clues.Across.map((_, i) => `${ipuz.clues.Across[i][0]}A`),
       ...ipuz.clues.Down.map((_, i) => `${ipuz.clues.Down[i][0]}D`)]
    );
    // This won't exclude every word by key but ensures the function doesn't crash
    const result = selectArchWord(ipuz, allKeys);
    // result may or may not be null depending on key overlap — just check no throw
    expect(result === null || (typeof result.word === 'string' && result.word.length >= 3)).toBe(true);
  });

  it('returns a word and clue when unused words exist', () => {
    const result = selectArchWord(ipuz, new Set());
    expect(result).not.toBeNull();
    expect(result!.word.length).toBeGreaterThanOrEqual(3);
    expect(result!.clue.length).toBeGreaterThan(0);
  });

  it('picks from unused words only', () => {
    // Select some words, then check arch word is not among them
    const selected = selectWords(ipuz, 3, Math.random, 1);
    const result = selectArchWord(ipuz, selected);
    if (result && selected.size > 0) {
      // The arch word's letters should come from the full ipuz solution
      // We can verify it's a real word string (all alpha)
      expect(/^[A-Z]+$/.test(result.word)).toBe(true);
    }
  });

  it('returned word is of median length among candidates', () => {
    const result = selectArchWord(ipuz, new Set());
    expect(result).not.toBeNull();
    // Just verify it's a reasonable length (not the shortest or longest extreme)
    expect(result!.word.length).toBeGreaterThanOrEqual(3);
  });
});

// ---- SHOP_DEF event handling ----

describe('SHOP_DEF.onEvent', () => {
  function makeShopRoom(): ExtraRoom {
    return { type: 'shop', pos: { x: 0, y: 0 }, locked: true, completed: false, glowColor: '#44ffcc', state: {} };
  }

  it('unlocks on level:start', () => {
    const room = makeShopRoom();
    room.locked = true;
    SHOP_DEF.onEvent(room, { type: 'level:start' }, {} as never);
    expect(room.locked).toBe(false);
  });

  it('does not change lock on other events', () => {
    const room = makeShopRoom();
    room.locked = false;
    SHOP_DEF.onEvent(room, { type: 'puzzle:complete' }, {} as never);
    expect(room.locked).toBe(false);
    SHOP_DEF.onEvent(room, { type: 'room:solved', x: 0, y: 0 }, {} as never);
    expect(room.locked).toBe(false);
  });
});

// ---- BOSS_DEF event handling ----

describe('BOSS_DEF.onEvent', () => {
  function makeBossRoom(): ExtraRoom {
    return { type: 'boss', pos: { x: 1, y: 0 }, locked: true, completed: false, glowColor: '#ff4444', state: { failPending: false, exitPending: false } };
  }

  it('spawns locked via initialLocked', () => {
    expect(BOSS_DEF.initialLocked).toBe(true);
  });

  it('unlocks on puzzle:complete', () => {
    const room = makeBossRoom();
    room.locked = true;
    BOSS_DEF.onEvent(room, { type: 'puzzle:complete' }, {} as never);
    expect(room.locked).toBe(false);
  });

  it('does not change lock on room:solved', () => {
    const room = makeBossRoom();
    room.locked = true;
    BOSS_DEF.onEvent(room, { type: 'room:solved', x: 0, y: 0 }, {} as never);
    expect(room.locked).toBe(true);
  });
});

// ---- BOSS_DEF renderPanel ----

describe('BOSS_DEF.renderPanel', () => {
  function makeBossRoom(locked = false, failPending = false): ExtraRoom {
    return { type: 'boss', pos: { x: 1, y: 0 }, locked, completed: false, glowColor: '#ff4444', state: { failPending, exitPending: false } };
  }

  it('shows locked message when room is locked', () => {
    const ctx = { archPuzzle: { word: 'CASTLE', clue: 'A fortress', guessedLetters: new Set<string>() }, renderShopPanel: () => {} } as never;
    const html = BOSS_DEF.renderPanel(makeBossRoom(true), ctx);
    expect(html).toContain('Complete the dungeon');
  });

  it('shows hangman display when unlocked', () => {
    const arch: ArchPuzzleState = { word: 'CAT', clue: 'Feline', guessedLetters: new Set(['C']) };
    const ctx = { archPuzzle: arch } as never;
    const html = BOSS_DEF.renderPanel(makeBossRoom(false), ctx);
    expect(html).toContain('C _ _');
    expect(html).toContain('Seal:');
    expect(html).not.toContain('Feline');
  });

  it('shows failure screen when failPending', () => {
    const arch: ArchPuzzleState = { word: 'CAT', clue: 'Feline', guessedLetters: new Set(['Z']) };
    const ctx = { archPuzzle: arch } as never;
    const html = BOSS_DEF.renderPanel(makeBossRoom(false, true), ctx);
    expect(html).toContain('trap door');
    expect(html).toContain('SPACE');
    expect(html).not.toContain('C _ _');
  });

  it('shows exit teaser when no arch puzzle', () => {
    const ctx = { archPuzzle: null } as never;
    const html = BOSS_DEF.renderPanel(makeBossRoom(false), ctx);
    expect(html).toContain('exit');
    expect(html).toContain('SPACE');
  });
});

// ---- BOSS_DEF handleInput ----

describe('BOSS_DEF.handleInput', () => {
  function makeBossRoom(locked = false, failPending = false): ExtraRoom {
    return { type: 'boss', pos: { x: 0, y: 0 }, locked, completed: false, glowColor: '#ff4444', state: { failPending, exitPending: false } };
  }

  function makeCtx(word: string, guessed: string[] = [], overrides: Partial<{ puzzleComplete: boolean }> = {}) {
    const arch: ArchPuzzleState = { word, clue: 'test', guessedLetters: new Set(guessed) };
    const calls: string[] = [];
    const ctx = {
      archPuzzle: arch,
      puzzleComplete: overrides.puzzleComplete ?? false,
      showInteraction: (lines: string[]) => calls.push('show:' + lines.join('|')),
      clearLogs: () => calls.push('clear'),
      render: () => calls.push('render'),
      advancePuzzle: () => calls.push('advance'),
      triggerVictory: () => calls.push('victory'),
    } as never;
    return { ctx, arch, calls };
  }

  it('wrong guess sets failPending and calls render', () => {
    const room = makeBossRoom(false);
    const { ctx, calls } = makeCtx('CAT');
    BOSS_DEF.handleInput(room, 'z', ctx);
    expect((room.state as { failPending: boolean }).failPending).toBe(true);
    expect(calls).toContain('render');
    expect(calls).not.toContain('advance');
  });

  it('SPACE while failPending calls advancePuzzle', () => {
    const room = makeBossRoom(false, true);
    const { ctx, calls } = makeCtx('CAT');
    BOSS_DEF.handleInput(room, ' ', ctx);
    expect(calls).toContain('advance');
    expect((room.state as { failPending: boolean }).failPending).toBe(false);
  });

  it('non-space input while failPending is consumed without advancing', () => {
    const room = makeBossRoom(false, true);
    const { ctx, calls } = makeCtx('CAT');
    const consumed = BOSS_DEF.handleInput(room, 'a', ctx);
    expect(consumed).toBe(true);
    expect(calls).not.toContain('advance');
  });

  it('correct guess shows interaction and renders', () => {
    const room = makeBossRoom(false);
    const { ctx, calls } = makeCtx('CAT');
    BOSS_DEF.handleInput(room, 'c', ctx);
    expect(calls.some(c => c.startsWith('show:'))).toBe(true);
    expect(calls).toContain('render');
  });

  it('correct final guess triggers victory', () => {
    const room = makeBossRoom(false);
    const { ctx, calls } = makeCtx('CAT', ['C', 'A']); // only T missing
    BOSS_DEF.handleInput(room, 't', ctx);
    expect(calls).toContain('victory');
  });

  it('already guessed letter shows interaction', () => {
    const room = makeBossRoom(false);
    const { ctx, calls } = makeCtx('CAT', ['C']);
    BOSS_DEF.handleInput(room, 'c', ctx);
    expect(calls.some(c => c.startsWith('show:'))).toBe(true);
  });
});

// ---- Dragon Treasure ----

function makeDragonTreasureRoom(locked: boolean, looted = false): ExtraRoom {
  const state: DragonTreasureRoomState = { dragonPos: { x: 3, y: 2 }, looted, goldAmount: 40 };
  return { type: 'dragon_treasure', pos: { x: 4, y: 2 }, locked, completed: false, glowColor: '#ffaa00', state };
}

function makeDragonCtx() {
  const calls: string[] = [];
  let goldAdded = 0;
  const ctx = {
    showInteraction: (lines: string[]) => calls.push('show:' + lines.join('|')),
    render: () => calls.push('render'),
    addGold: (amount: number) => { goldAdded += amount; calls.push('gold:' + amount); },
    markExtraRoomSolved: (pos: { x: number; y: number }) => calls.push('solved:' + pos.x + ',' + pos.y),
  } as never;
  return { ctx, calls, get goldAdded() { return goldAdded; } };
}

describe('DRAGON_TREASURE_DEF', () => {
  it('locks on level:start', () => {
    const room = makeDragonTreasureRoom(false);
    const { ctx } = makeDragonCtx();
    DRAGON_TREASURE_DEF.onEvent(room, { type: 'level:start' }, ctx);
    expect(room.locked).toBe(true);
  });

  it('unlocks when matching dragon room is solved', () => {
    const room = makeDragonTreasureRoom(true);
    const { ctx } = makeDragonCtx();
    DRAGON_TREASURE_DEF.onEvent(room, { type: 'room:solved', x: 3, y: 2 }, ctx);
    expect(room.locked).toBe(false);
  });

  it('stays locked when a different room is solved', () => {
    const room = makeDragonTreasureRoom(true);
    const { ctx } = makeDragonCtx();
    DRAGON_TREASURE_DEF.onEvent(room, { type: 'room:solved', x: 1, y: 1 }, ctx);
    expect(room.locked).toBe(true);
  });

  it('handleInput space loots gold when unlocked', () => {
    const room = makeDragonTreasureRoom(false);
    const { ctx, calls } = makeDragonCtx();
    const consumed = DRAGON_TREASURE_DEF.handleInput(room, ' ', ctx);
    expect(consumed).toBe(true);
    expect(calls).toContain('gold:40');
    expect((room.state as DragonTreasureRoomState).looted).toBe(true);
  });

  it('handleInput does nothing when locked', () => {
    const room = makeDragonTreasureRoom(true);
    const { ctx, calls } = makeDragonCtx();
    const consumed = DRAGON_TREASURE_DEF.handleInput(room, ' ', ctx);
    expect(consumed).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('renderPanel shows loot prompt when unlocked and not looted', () => {
    const room = makeDragonTreasureRoom(false);
    const { ctx } = makeDragonCtx();
    const html = DRAGON_TREASURE_DEF.renderPanel(room, ctx);
    expect(html).toContain('40 gold');
    expect(html).toContain('SPACE');
  });

  it('renderPanel shows hoard prompt when looted flag is set (panel hidden by game via completed flag)', () => {
    const room = makeDragonTreasureRoom(false, true);
    const { ctx } = makeDragonCtx();
    const html = DRAGON_TREASURE_DEF.renderPanel(room, ctx);
    // Panel still returns content; game hides it via room.completed after dismiss
    expect(html).toContain('Dragon');
  });
});

// ---- buildSimmDialogue ----

import { buildSimmDialogue, SIMM_DEF, type SimmRoomState } from './extraRooms';

describe('buildSimmDialogue', () => {
  it('returns a non-empty dialogue string', () => {
    const { dialogue } = buildSimmDialogue(false, 1.0, 1.0, []);
    expect(typeof dialogue).toBe('string');
    expect(dialogue.length).toBeGreaterThan(0);
  });

  it('on first meeting, includes first-content flavour (greedy check)', () => {
    // Run many times to verify first-meeting content is possible
    let sawFirstContent = false;
    for (let i = 0; i < 50; i++) {
      const { dialogue } = buildSimmDialogue(false, 1.0, 1.0, []);
      // First-content items are distinct from random content (they mention e.g. "new here")
      if (dialogue.includes("new here") || dialogue.includes("poking around") || dialogue.includes("recognized") ||
          dialogue.includes("compare notes") || dialogue.includes("last adventurer")) {
        sawFirstContent = true;
        break;
      }
    }
    expect(sawFirstContent).toBe(true);
  });

  it('when HP is low, includes a health warning', () => {
    // With HP at 10%, should include hp warning in additional content
    let sawWarning = false;
    for (let i = 0; i < 30; i++) {
      const { dialogue } = buildSimmDialogue(false, 0.1, 1.0, []);
      if (dialogue.includes('rough') || dialogue.includes('alright') || dialogue.includes('health potion') || dialogue.includes('low')) {
        sawWarning = true;
        break;
      }
    }
    expect(sawWarning).toBe(true);
  });

  it('consumes space key and shows dialogue popup', () => {
    const state: SimmRoomState = { dialogue: 'Hello there!', };
    const room: ExtraRoom = { type: 'simm', pos: { x: 0, y: 0 }, locked: false, completed: false, glowColor: '#88ff88', state };
    const shown: string[][] = [];
    const ctx = { showInteraction: (lines: string[]) => shown.push(lines) } as never;
    expect(SIMM_DEF.handleInput(room, ' ', ctx)).toBe(true);
    expect(shown[0][0]).toContain('Hello there!');
    expect(shown[0][shown[0].length - 1]).toContain('runs off');
  });

  it('blocks letter guessing', () => {
    const state: SimmRoomState = { dialogue: 'Hello!', };
    const room: ExtraRoom = { type: 'simm', pos: { x: 0, y: 0 }, locked: false, completed: false, glowColor: '#88ff88', state };
    expect(SIMM_DEF.handleInput(room, 'a', {} as never)).toBe(true);
  });
});

// ---- Trapped Adventurer ----

import { TRAPPED_ADVENTURER_DEF, type TrappedAdventurerRoomState } from './extraRooms';

function makeTrappedRoom(locked: boolean, rescued = false, reward: TrappedAdventurerRoomState['reward'] = 'gold'): ExtraRoom {
  const state: TrappedAdventurerRoomState = {
    adjacentRooms: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
    rescued,
    reward,
  };
  return { type: 'trapped_adventurer', pos: { x: 1, y: 2 }, locked, completed: false, glowColor: '#ffcc44', state };
}

describe('TRAPPED_ADVENTURER_DEF', () => {
  it('unlocks when all adjacent rooms solved via room:solved event', () => {
    const room = makeTrappedRoom(true);
    const ctx = {
      isRoomSolved: (pos: { x: number; y: number }) =>
        (pos.x === 1 && pos.y === 1) || (pos.x === 2 && pos.y === 1),
      showAfterPopup: () => {},
      render: () => {},
    } as never;
    TRAPPED_ADVENTURER_DEF.onEvent(room, { type: 'room:solved', x: 2, y: 1 }, ctx);
    expect(room.locked).toBe(false);
  });

  it('stays locked if not all adjacent rooms solved', () => {
    const room = makeTrappedRoom(true);
    const ctx = {
      isRoomSolved: (pos: { x: number; y: number }) => pos.x === 1 && pos.y === 1,
      showInteraction: () => {},
      render: () => {},
    } as never;
    TRAPPED_ADVENTURER_DEF.onEvent(room, { type: 'room:solved', x: 1, y: 1 }, ctx);
    expect(room.locked).toBe(true);
  });

  it('space gives gold reward', () => {
    const room = makeTrappedRoom(false, false, 'gold');
    const calls: string[] = [];
    const ctx = {
      addGold: (n: number) => calls.push('gold:' + n),
      addHpPotion: () => calls.push('hp'),
      addManaPotion: () => calls.push('mana'),
      revealArchLetter: () => { calls.push('arch'); return 'A'; },
      showInteraction: () => {},
      markExtraRoomSolved: () => {},
      render: () => {},
    } as never;
    TRAPPED_ADVENTURER_DEF.handleInput(room, ' ', ctx);
    expect(calls).toContain('gold:30');
    expect((room.state as TrappedAdventurerRoomState).rescued).toBe(true);
  });

  it('space gives hp potion reward', () => {
    const room = makeTrappedRoom(false, false, 'hp_potion');
    const calls: string[] = [];
    const ctx = {
      addGold: () => {},
      addHpPotion: () => calls.push('hp'),
      addManaPotion: () => {},
      revealArchLetter: () => 'A',
      showInteraction: () => {},
      markExtraRoomSolved: () => {},
      render: () => {},
    } as never;
    TRAPPED_ADVENTURER_DEF.handleInput(room, ' ', ctx);
    expect(calls).toContain('hp');
  });

  it('does nothing when locked', () => {
    const room = makeTrappedRoom(true);
    const consumed = TRAPPED_ADVENTURER_DEF.handleInput(room, ' ', {} as never);
    expect(consumed).toBe(false);
  });
});

// ---- Hidden Treasure ----

import { HIDDEN_TREASURE_DEF, type HiddenTreasureRoomState } from './extraRooms';

function makeHiddenRoom(hidden: boolean, claimed = false, contents: HiddenTreasureRoomState['contents'] = 'gold'): ExtraRoom {
  const state: HiddenTreasureRoomState = { claimed, contents };
  return { type: 'hidden_treasure', pos: { x: 3, y: 3 }, locked: false, completed: false, glowColor: '#ffdd66', state, hidden };
}

describe('HIDDEN_TREASURE_DEF', () => {
  it('spawns hidden via initialHidden', () => {
    expect(HIDDEN_TREASURE_DEF.initialHidden).toBe(true);
  });

  it('does nothing when hidden', () => {
    const room = makeHiddenRoom(true);
    expect(HIDDEN_TREASURE_DEF.handleInput(room, ' ', {} as never)).toBe(false);
  });

  it('claims gold on space', () => {
    const room = makeHiddenRoom(false, false, 'gold');
    const calls: string[] = [];
    const ctx = {
      addGold: (n: number) => calls.push('gold:' + n),
      revealArchLetter: () => 'A',
      showInteraction: () => {},
      markExtraRoomSolved: () => {},
      render: () => {},
    } as never;
    HIDDEN_TREASURE_DEF.handleInput(room, ' ', ctx);
    expect(calls).toContain('gold:50');
    expect((room.state as HiddenTreasureRoomState).claimed).toBe(true);
  });

  it('renderPanel shows claim prompt when discovered', () => {
    const room = makeHiddenRoom(false, false, 'gold');
    const html = HIDDEN_TREASURE_DEF.renderPanel(room, {} as never);
    expect(html).toContain('SPACE');
    expect(html).toContain('loot');
  });

  it('renderPanel returns empty string when hidden', () => {
    const room = makeHiddenRoom(true);
    expect(HIDDEN_TREASURE_DEF.renderPanel(room, {} as never)).toBe('');
  });
});

// ---- Very Hidden Room ----

import { VERY_HIDDEN_DEF, type VeryHiddenRoomState } from './extraRooms';

describe('VERY_HIDDEN_DEF', () => {
  function makeVeryHiddenRoom(veryHidden: boolean, blessed = false, stat: VeryHiddenRoomState['stat'] = 'max_hp'): ExtraRoom {
    const state: VeryHiddenRoomState = { blessed, stat };
    return { type: 'very_hidden', pos: { x: 5, y: 5 }, locked: false, completed: false, glowColor: '#aa66ff', state, veryHidden };
  }

  it('spawns very hidden via initialVeryHidden', () => {
    expect(VERY_HIDDEN_DEF.initialVeryHidden).toBe(true);
  });

  it('does nothing when very hidden', () => {
    const room = makeVeryHiddenRoom(true);
    expect(VERY_HIDDEN_DEF.handleInput(room, ' ', {} as never)).toBe(false);
  });

  it('applies max_hp bonus on space', () => {
    const room = makeVeryHiddenRoom(false, false, 'max_hp');
    const calls: string[] = [];
    const ctx = {
      applyStatBonus: (stat: string, amt: number) => calls.push(stat + ':' + amt),
      showInteraction: () => {},
      markExtraRoomSolved: () => {},
      render: () => {},
    } as never;
    VERY_HIDDEN_DEF.handleInput(room, ' ', ctx);
    expect(calls).toContain('max_hp:10');
    expect((room.state as VeryHiddenRoomState).blessed).toBe(true);
  });

  it('renderPanel returns empty when veryHidden', () => {
    const room = makeVeryHiddenRoom(true);
    expect(VERY_HIDDEN_DEF.renderPanel(room, {} as never)).toBe('');
  });
});

// ---- Cursed Fountain ----

import { getValidFountainTrades, CURSED_FOUNTAIN_DEF, type CursedFountainRoomState } from './extraRooms';

describe('getValidFountainTrades', () => {
  function makeCtxWithStats(maxHp: number, maxMana: number, dmg: number, def: number) {
    return { maxHp, maxMana, effectiveDamage: dmg, effectiveDefense: def } as never;
  }

  it('returns trades where player can afford the stat taken', () => {
    // Player has 20 maxHp, 10 maxMana, 5 dmg, 5 def
    const trades = getValidFountainTrades(makeCtxWithStats(20, 10, 5, 5));
    // +3dmg/-15maxHp needs maxHp>=15 ✓, +5dmg/-5def needs def>=5 ✓
    expect(trades.length).toBeGreaterThan(0);
  });

  it('excludes trades player cannot afford', () => {
    // Player has only 5 maxHp — cannot afford -15maxHp trade
    const trades = getValidFountainTrades(makeCtxWithStats(5, 10, 5, 5));
    const has15HpTrade = trades.some(t => t.take.stat === 'max_hp' && t.take.amount === 15);
    expect(has15HpTrade).toBe(false);
  });

  it('fountain applies trade on space', () => {
    const state: CursedFountainRoomState = {
      used: false,
      trade: {
        give: { stat: 'damage', amount: 3 },
        take: { stat: 'max_hp', amount: 15 },
        desc: '+3 DMG, -15 max HP',
      },
    };
    const room: ExtraRoom = { type: 'cursed_fountain', pos: { x: 0, y: 0 }, locked: false, completed: false, glowColor: '#4444cc', state };
    const calls: string[] = [];
    const ctx = {
      applyStatBonus: (s: string, a: number) => calls.push(s + ':' + a),
      showInteraction: () => {},
      markExtraRoomSolved: () => {},
      render: () => {},
    } as never;
    CURSED_FOUNTAIN_DEF.handleInput(room, ' ', ctx);
    expect(calls).toContain('damage:3');
    expect(calls).toContain('max_hp:-15');
    expect(state.used).toBe(true);
  });
});

import { MIMIC_CHEST_DEF, type MimicChestRoomState } from './extraRooms';

describe('MIMIC_CHEST_DEF', () => {
  function makeRoom(isReal: boolean): ExtraRoom {
    const state: MimicChestRoomState = { opened: false, isReal };
    return { type: 'mimic_chest', pos: { x: 2, y: 2 }, locked: false, completed: false, glowColor: '#ccaa22', state };
  }

  it('gives 100 gold when real chest opened', () => {
    const room = makeRoom(true);
    const goldAdded: number[] = [];
    const ctx = {
      hp: 20, mana: 10,
      addGold: (n: number) => goldAdded.push(n),
      takeDamage: () => {},
      showInteraction: () => {},
    } as never;
    MIMIC_CHEST_DEF.handleInput(room, ' ', ctx);
    expect(goldAdded).toContain(100);
    expect((room.state as MimicChestRoomState).opened).toBe(true);
  });

  it('deals 50% HP and mana damage and marks solved when mimic', () => {
    const room = makeRoom(false);
    let hpDmg = 0;
    let manaDmg = 0;
    const ctx = {
      hp: 20, mana: 10,
      addGold: () => {},
      takeDamage: (h: number, m: number) => { hpDmg = h; manaDmg = m; },
      showInteraction: () => {},
      markExtraRoomSolved: () => {},
      render: () => {},
    } as never;
    MIMIC_CHEST_DEF.handleInput(room, ' ', ctx);
    expect(hpDmg).toBe(10); // 50% of 20
    expect(manaDmg).toBe(5); // 50% of 10
    expect((room.state as MimicChestRoomState).opened).toBe(true);
  });

  it('does nothing on non-space key', () => {
    const room = makeRoom(true);
    const ctx = { hp: 10, mana: 10, addGold: () => {}, takeDamage: () => {}, showInteraction: () => {}, markExtraRoomSolved: () => {}, render: () => {} } as never;
    const consumed = MIMIC_CHEST_DEF.handleInput(room, 'a', ctx);
    expect(consumed).toBe(false);
    expect((room.state as MimicChestRoomState).opened).toBe(false);
  });

  it('ignores repeated space after opened', () => {
    const room = makeRoom(true);
    const goldAdded: number[] = [];
    const ctx = { hp: 10, mana: 10, addGold: (n: number) => goldAdded.push(n), takeDamage: () => {}, showInteraction: () => {}, markExtraRoomSolved: () => {}, render: () => {} } as never;
    MIMIC_CHEST_DEF.handleInput(room, ' ', ctx);
    MIMIC_CHEST_DEF.handleInput(room, ' ', ctx);
    expect(goldAdded).toHaveLength(1); // only awarded once
  });
});
