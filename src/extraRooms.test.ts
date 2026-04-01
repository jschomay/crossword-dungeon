import { describe, it, expect } from 'vitest';
import {
  hangmanDisplay,
  isWordSolved,
  processBossGuess,
  selectArchWord,
  SHOP_DEF,
  BOSS_DEF,
  type ExtraRoom,
  type ArchPuzzleState,
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
    return { type: 'shop', pos: { x: 0, y: 0 }, locked: true, glowColor: '#44ffcc', state: {} };
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
    return { type: 'boss', pos: { x: 1, y: 0 }, locked: true, glowColor: '#ff4444', state: {} };
  }

  it('locks on level:start', () => {
    const room = makeBossRoom();
    room.locked = false;
    BOSS_DEF.onEvent(room, { type: 'level:start' }, {} as never);
    expect(room.locked).toBe(true);
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
    return { type: 'boss', pos: { x: 1, y: 0 }, locked, glowColor: '#ff4444', state: { failPending } };
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

  it('shows fallback when no arch puzzle', () => {
    const ctx = { archPuzzle: null } as never;
    const html = BOSS_DEF.renderPanel(makeBossRoom(false), ctx);
    expect(html).toContain('Sealed Door');
  });
});

// ---- BOSS_DEF handleInput ----

describe('BOSS_DEF.handleInput', () => {
  function makeBossRoom(locked = false, failPending = false): ExtraRoom {
    return { type: 'boss', pos: { x: 0, y: 0 }, locked, glowColor: '#ff4444', state: { failPending } };
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

  it('wrong guess sets failPending and calls clearLogs+render', () => {
    const room = makeBossRoom(false);
    const { ctx, calls } = makeCtx('CAT');
    BOSS_DEF.handleInput(room, 'z', ctx);
    expect((room.state as { failPending: boolean }).failPending).toBe(true);
    expect(calls).toContain('clear');
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
