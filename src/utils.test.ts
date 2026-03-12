import { describe, it, expect } from 'vitest';
import { hpBar, colorLine, C_HP, C_MANA, C_DMG, C_XP, C_DIM } from './utils';

// ---- hpBar ----

describe('hpBar', () => {
  it('full bar', () => {
    expect(hpBar(10, 10)).toBe('██████████');
  });

  it('empty bar', () => {
    expect(hpBar(0, 10)).toBe('░░░░░░░░░░');
  });

  it('half bar', () => {
    expect(hpBar(5, 10)).toBe('█████░░░░░');
  });

  it('custom width', () => {
    expect(hpBar(3, 6, 6)).toBe('███░░░');
  });

  it('rounds correctly', () => {
    // 1/3 of 10 rounds to 3
    expect(hpBar(1, 3, 9)).toBe('███░░░░░░');
  });
});

// ---- colorLine ----

function span(color: string, text: string): string {
  return `<span style="color:${color}">${text}</span>`;
}

describe('colorLine', () => {
  const title = '#aabbcc';

  it('first line uses title color', () => {
    expect(colorLine('* [MONSTER] Rat  Lv.1', title, true)).toBe(span(title, '* [MONSTER] Rat  Lv.1'));
  });

  it('blank line returns empty string', () => {
    expect(colorLine('', title, false)).toBe('');
    expect(colorLine('   ', title, false)).toBe('');
  });

  it('◆ mod bullet → dim', () => {
    expect(colorLine('  ◆ Frenzied  — description', title, false)).toBe(span(C_DIM, '  ◆ Frenzied  — description'));
  });

  it('→ mod effect (variable indent) → dim', () => {
    expect(colorLine('             → +30% DMG', title, false)).toBe(span(C_DIM, '             → +30% DMG'));
  });

  it('HP: line → hp color', () => {
    expect(colorLine('HP: ██████████  50', title, false)).toBe(span(C_HP, 'HP: ██████████  50'));
  });

  it('DMG: line → dmg color', () => {
    expect(colorLine('DMG: 10', title, false)).toBe(span(C_DMG, 'DMG: 10'));
  });

  it('DRAIN: line → mana color', () => {
    expect(colorLine('DRAIN: 5', title, false)).toBe(span(C_MANA, 'DRAIN: 5'));
  });

  it('+ XP reward → xp color', () => {
    expect(colorLine('+ 15 XP  on defeat', title, false)).toBe(span(C_XP, '+ 15 XP  on defeat'));
  });

  it('+ MANA reward → mana color', () => {
    expect(colorLine('+ 4 MANA  on disarm', title, false)).toBe(span(C_MANA, '+ 4 MANA  on disarm'));
  });

  it('+ HP reward → hp color', () => {
    expect(colorLine('+ 10 HP  on loot', title, false)).toBe(span(C_HP, '+ 10 HP  on loot'));
  });

  it('+ unknown reward → dim', () => {
    expect(colorLine('+ 1 item  on loot', title, false)).toBe(span(C_DIM, '+ 1 item  on loot'));
  });

  it('stat line with DAMAGE → dmg color', () => {
    expect(colorLine('+5 DAMAGE', title, false)).toBe(span(C_DMG, '+5 DAMAGE'));
  });

  it('stat line with HP → hp color', () => {
    expect(colorLine('+4 HP', title, false)).toBe(span(C_HP, '+4 HP'));
  });

  it('effect line with MANA → mana color', () => {
    expect(colorLine('+3 MANA on use', title, false)).toBe(span(C_MANA, '+3 MANA on use'));
  });

  it('effect line with XP → xp color', () => {
    expect(colorLine('+10 XP on use', title, false)).toBe(span(C_XP, '+10 XP on use'));
  });

  it('description line → dim', () => {
    expect(colorLine('A small but fierce creature.', title, false)).toBe(span(C_DIM, 'A small but fierce creature.'));
  });

  it('REWARD header → dim', () => {
    expect(colorLine('REWARD', title, false)).toBe(span(C_DIM, 'REWARD'));
  });

  it('escapes HTML special chars', () => {
    expect(colorLine('HP: <test> & "more"', title, false)).toContain('&lt;test&gt; &amp;');
  });
});
