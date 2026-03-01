import { describe, it, expect } from 'vitest';
import {
  generateMonster,
  generateTrap,
  generateTreasure,
  formatEncounter,
  type Rng,
} from './encounters';
import { MONSTER_TYPES, MONSTER_MODIFIERS } from './data/monsters';
import { TRAP_TYPES, TRAP_MODIFIERS } from './data/traps';
import { TREASURE_ITEMS, TREASURE_CONSUMABLES, TREASURE_IMMEDIATE, TREASURE_MODIFIERS } from './data/treasures';

// Returns items from a queue in order. shuffle returns the array as-is (stable order = first two are mod1/mod2).
function mockRng(queue: unknown[]): Rng {
  let i = 0;
  return {
    getItem<T>(_arr: readonly T[]): T {
      return queue[i++] as T;
    },
    shuffle<T>(arr: readonly T[]): T[] {
      return [...arr];
    },
  };
}

// Convenience: shuffle that puts a specific item first (for testing passive modifiers etc.)
function mockRngWithFirstMod<T>(getItems: unknown[], firstMod: T): Rng {
  let i = 0;
  return {
    getItem<U>(_arr: readonly U[]): U {
      return getItems[i++] as U;
    },
    shuffle<U>(arr: readonly U[]): U[] {
      return [firstMod as unknown as U, ...arr.filter(x => x !== firstMod)];
    },
  };
}

// ---- Monster generation ----

describe('generateMonster', () => {
  it('stores base stats and always rolls two mods', () => {
    const rng = mockRng([MONSTER_TYPES[0], MONSTER_MODIFIERS[0], MONSTER_MODIFIERS[1]]);
    const m = generateMonster(rng);
    expect(m.kind).toBe('monster');
    expect(m.baseName).toBe('Rat');
    expect(m.mod1.name).toBe('Frenzied');
    expect(m.mod2.name).toBe('Armored');
  });

  it('level 1: no modifiers applied in display, correct stats', () => {
    // Rat: base_hp=8 hp_growth=2, base_damage=2 damage_growth=1, base_xp=8 xp_growth=2
    const rng = mockRng([MONSTER_TYPES[0]]); // Rat; mods don't matter at display level 1
    const m = generateMonster(rng);
    const lines = formatEncounter(m, 1);
    expect(lines[0]).toContain('Level 1');
    expect(lines[1]).toBe('Rat');
    // hp = 8 + 1*2 = 10, dmg = 2 + 1*1 = 3, xp = 8 + 1*2 = 10
    expect(lines.some(l => l.includes('HP: 10'))).toBe(true);
    expect(lines.some(l => l.includes('DMG: 3'))).toBe(true);
    expect(lines.some(l => l.includes('XP: 10'))).toBe(true);
  });

  it('level 3: one modifier (mod1) applied', () => {
    // Goblin: base_hp=12 hp_growth=3, base_dmg=3 dmg_growth=1, base_xp=10 xp_growth=3
    // mod1=Frenzied: hp_mult=1.0, dmg_mult=1.3, xp_mult=1.2
    const goblin = MONSTER_TYPES[1];
    const frenzied = MONSTER_MODIFIERS[0];
    const armored = MONSTER_MODIFIERS[1];
    const rng = mockRng([goblin, frenzied, armored]); // shuffle returns [frenzied, armored, ...]
    const m = generateMonster(rng);
    const lines = formatEncounter(m, 3);
    expect(lines[0]).toContain('Level 3');
    expect(lines[1]).toBe('Frenzied Goblin');
    // raw_hp = 12 + 3*3 = 21, *1.0 = 21
    expect(lines.some(l => l.includes('HP: 21'))).toBe(true);
    // raw_dmg = 3 + 3*1 = 6, *1.3 = round(7.8) = 8
    expect(lines.some(l => l.includes('DMG: 8'))).toBe(true);
    // raw_xp = 10 + 3*3 = 19, *1.2 = round(22.8) = 23
    expect(lines.some(l => l.includes('XP: 23'))).toBe(true);
  });

  it('level 6: both modifiers (mod1 + mod2) applied', () => {
    // Goblin, mod1=Frenzied (hp_mult=1.0, dmg_mult=1.3, xp_mult=1.2)
    //         mod2=Armored  (hp_mult=1.4, dmg_mult=1.0, xp_mult=1.3)
    const goblin = MONSTER_TYPES[1];
    const frenzied = MONSTER_MODIFIERS[0];
    const armored = MONSTER_MODIFIERS[1];
    const rng = mockRng([goblin, frenzied, armored]);
    const m = generateMonster(rng);
    const lines = formatEncounter(m, 6);
    expect(lines[0]).toContain('Level 6');
    expect(lines[1]).toBe('Frenzied Armored Goblin');
    // raw_hp = 12 + 6*3 = 30, *1.0 *1.4 = 42
    expect(lines.some(l => l.includes('HP: 42'))).toBe(true);
    // raw_dmg = 3 + 6*1 = 9, *1.3 *1.0 = round(11.7) = 12
    expect(lines.some(l => l.includes('DMG: 12'))).toBe(true);
    // raw_xp = 10 + 6*3 = 28, *1.2 *1.3 = round(43.68) = 44
    expect(lines.some(l => l.includes('XP: 44'))).toBe(true);
  });

  it('level 5: only mod1 applied, mod2 not shown', () => {
    const goblin = MONSTER_TYPES[1];
    const frenzied = MONSTER_MODIFIERS[0];
    const armored = MONSTER_MODIFIERS[1];
    const rng = mockRng([goblin, frenzied, armored]);
    const m = generateMonster(rng);
    const lines = formatEncounter(m, 5);
    expect(lines[1]).toBe('Frenzied Goblin');
  });

  it('activatedLevel 0 shows flavor text, not encounter stats', () => {
    const rng = mockRng([MONSTER_TYPES[0]]);
    const m = generateMonster(rng);
    const lines = formatEncounter(m, 0);
    expect(lines.some(l => l.includes('HP:'))).toBe(false);
    expect(lines.join(' ')).toMatch(/empty|quiet|for now|eerie/i);
  });
});

// ---- Trap generation ----

describe('generateTrap', () => {
  it('level 1 physical trap: no modifiers, correct stats', () => {
    // Dart Trap: base_damage=4, damage_growth=2, base_xp=8, xp_growth=2
    const dartTrap = TRAP_TYPES[0];
    const rng = mockRng([dartTrap]);
    const t = generateTrap(rng);
    expect(t.kind).toBe('trap');
    expect(t.trapType).toBe('physical');
    expect(t.damageType).toBe('hp');
    expect(t.rewardType).toBe('xp');
    const lines = formatEncounter(t, 1);
    // dmg = 4 + 1*2 = 6, xp = 8 + 1*2 = 10
    expect(lines.some(l => l.includes('DMG: 6'))).toBe(true);
    expect(lines.some(l => l.includes('XP: 10'))).toBe(true);
  });

  it('magical trap rewards mana', () => {
    // Rune Ward: damage_type=mana, base_mana=3, mana_growth=1
    const runeWard = TRAP_TYPES[2];
    const rng = mockRng([runeWard]);
    const t = generateTrap(rng);
    expect(t.trapType).toBe('magical');
    expect(t.damageType).toBe('mana');
    expect(t.rewardType).toBe('mana');
    const lines = formatEncounter(t, 1);
    // reward = 3 + 1*1 = 4
    expect(lines.some(l => l.includes('Mana: 4'))).toBe(true);
  });

  it('level 3 trap: one modifier applied', () => {
    // Dart Trap, mod1=Hidden: dmg_mult=1.3, reward_mult=1.2
    const dartTrap = TRAP_TYPES[0];
    const hidden = TRAP_MODIFIERS[0];
    const ancient = TRAP_MODIFIERS[1];
    const rng = mockRng([dartTrap, hidden, ancient]);
    const t = generateTrap(rng);
    const lines = formatEncounter(t, 3);
    expect(lines[1]).toContain('Hidden Dart Trap');
    // raw_dmg = 4 + 3*2 = 10, *1.3 = 13
    expect(lines.some(l => l.includes('DMG: 13'))).toBe(true);
    // raw_xp = 8 + 3*2 = 14, *1.2 = round(16.8) = 17
    expect(lines.some(l => l.includes('XP: 17'))).toBe(true);
  });

  it('level 6 trap: two modifiers applied', () => {
    // Dart Trap, mod1=Hidden (dmg_mult=1.3), mod2=Ancient (dmg_mult=1.2)
    const dartTrap = TRAP_TYPES[0];
    const hidden = TRAP_MODIFIERS[0];
    const ancient = TRAP_MODIFIERS[1];
    const rng = mockRng([dartTrap, hidden, ancient]);
    const t = generateTrap(rng);
    const lines = formatEncounter(t, 6);
    expect(lines[1]).toContain('Hidden Ancient Dart Trap');
    // raw_dmg = 4 + 6*2 = 16, *1.3 *1.2 = round(24.96) = 25
    expect(lines.some(l => l.includes('DMG: 25'))).toBe(true);
  });
});

// ---- Treasure generation ----

describe('generateTreasure', () => {
  it('consumable: correct amount scaling at display level', () => {
    // Health Potion: base_amount=3, amount_growth=2
    const rng = mockRng(['consumable', TREASURE_CONSUMABLES[0]]);
    const t = generateTreasure(rng);
    expect(t.kind).toBe('treasure');
    expect(t.subKind).toBe('consumable');
    const lines = formatEncounter(t, 2);
    // amount = 3 + 2*2 = 7
    expect(lines.some(l => l.includes('7'))).toBe(true);
    expect(lines.some(l => l.includes('Consumable:'))).toBe(true);
  });

  it('immediate: correct amount scaling at display level', () => {
    // Healing Shrine: base_amount=10, amount_growth=5
    const rng = mockRng(['immediate', TREASURE_IMMEDIATE[0]]);
    const t = generateTreasure(rng);
    expect(t.subKind).toBe('immediate');
    const lines = formatEncounter(t, 3);
    // amount = 10 + 3*5 = 25
    expect(lines.some(l => l.includes('25'))).toBe(true);
    expect(lines.some(l => l.includes('On solve:'))).toBe(true);
  });

  it('item level 1-2: no modifiers in display', () => {
    // Sword: base_damage_bonus=3, damage_bonus_growth=2; mod1=Fine, mod2=Masterwork
    const sword = TREASURE_ITEMS[0];
    const fine = TREASURE_MODIFIERS[0];
    const masterwork = TREASURE_MODIFIERS[1];
    const rng = mockRng(['item', sword, fine, masterwork]);
    const t = generateTreasure(rng);
    expect(t.subKind).toBe('item');
    const lines = formatEncounter(t, 1);
    expect(lines[1]).toBe('Sword');
    // stat = 3 + 1*2 = 5, no multiplier
    expect(lines.some(l => l.includes('+5 damage'))).toBe(true);
  });

  it('item level 3: mod1 multiplies stat', () => {
    // Sword, mod1=Fine (stat_multiplier=1.2)
    const sword = TREASURE_ITEMS[0];
    const fine = TREASURE_MODIFIERS[0];
    const masterwork = TREASURE_MODIFIERS[1];
    const rng = mockRng(['item', sword, fine, masterwork]);
    const t = generateTreasure(rng);
    const lines = formatEncounter(t, 3);
    expect(lines[1]).toBe('Fine Sword');
    // raw = 3 + 3*2 = 9, *1.2 = round(10.8) = 11
    expect(lines.some(l => l.includes('+11 damage'))).toBe(true);
  });

  it('item level 6: mod1 and mod2 stack', () => {
    // Sword, mod1=Fine (1.2), mod2=Masterwork (1.4)
    const sword = TREASURE_ITEMS[0];
    const fine = TREASURE_MODIFIERS[0];
    const masterwork = TREASURE_MODIFIERS[1];
    const rng = mockRng(['item', sword, fine, masterwork]);
    const t = generateTreasure(rng);
    const lines = formatEncounter(t, 6);
    expect(lines[1]).toBe('Fine Masterwork Sword');
    // raw = 3 + 6*2 = 15, *1.2 *1.4 = round(25.2) = 25
    expect(lines.some(l => l.includes('+25 damage'))).toBe(true);
  });

  it('item with passive modifier shows passive effect in display', () => {
    // Sword, mod1=Regenerating (+3 HP/round)
    const sword = TREASURE_ITEMS[0];
    const regenerating = TREASURE_MODIFIERS[2];
    const rng = mockRngWithFirstMod(['item', sword], regenerating);
    const t = generateTreasure(rng);
    const lines = formatEncounter(t, 3);
    expect(lines.some(l => l.includes('+3 HP/round'))).toBe(true);
  });
});
