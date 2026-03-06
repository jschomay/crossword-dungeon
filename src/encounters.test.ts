import { describe, it, expect } from 'vitest';
import {
  generateMonster,
  generateTrap,
  generateTreasure,
  formatEncounter,
  getMonsterStats,
  getTrapStats,
  resolveCombat,
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
      return [firstMod as unknown as U, ...arr.filter(x => x !== (firstMod as unknown))];
    },
  };
}

// ---- getMonsterStats ----

describe('getMonsterStats', () => {
  // Rat: base_hp=8 hp_growth=2, base_damage=2 damage_growth=1, base_xp=8 xp_growth=2
  // mod1=Frenzied: hp=1.0, dmg=1.3, xp=1.2
  // mod2=Armored:  hp=1.4, dmg=1.0, xp=1.3
  const getRat = () => {
    const rng = mockRng([MONSTER_TYPES[0], MONSTER_MODIFIERS[0], MONSTER_MODIFIERS[1]]);
    return generateMonster(rng);
  };

  it('level 1: raw stats, no multipliers', () => {
    const stats = getMonsterStats(getRat(), 1);
    // hp=8+2=10, dmg=2+1=3, xp=8+2=10
    expect(stats).toEqual({ hp: 10, dmg: 3, xp: 10 });
  });

  it('level 3: mod1 applied', () => {
    const stats = getMonsterStats(getRat(), 3);
    // raw hp=8+6=14, dmg=2+3=5, xp=8+6=14
    // *1.0, *1.3, *1.2
    expect(stats.hp).toBe(14);
    expect(stats.dmg).toBe(Math.round(5 * 1.3)); // 7
    expect(stats.xp).toBe(Math.round(14 * 1.2)); // 17
  });

  it('level 6: mod1 and mod2 applied', () => {
    const stats = getMonsterStats(getRat(), 6);
    // raw hp=8+12=20, dmg=2+6=8, xp=8+12=20
    // *1.0*1.4=1.4, *1.3*1.0=1.3, *1.2*1.3=1.56
    expect(stats.hp).toBe(Math.round(20 * 1.4)); // 28
    expect(stats.dmg).toBe(Math.round(8 * 1.3)); // 10
    expect(stats.xp).toBe(Math.round(20 * 1.56)); // 31
  });
});

// ---- getTrapStats ----

describe('getTrapStats', () => {
  // Dart Trap: base_damage=4, damage_growth=2, base_xp=8, xp_growth=2
  // mod1=Hidden: dmg_mult=1.3, reward_mult=1.2
  // mod2=Ancient: dmg_mult=1.2, reward_mult=1.1
  const getDartTrap = () => {
    const rng = mockRng([TRAP_TYPES[0], TRAP_MODIFIERS[0], TRAP_MODIFIERS[1]]);
    return generateTrap(rng);
  };

  it('level 1: raw stats, no multipliers', () => {
    const stats = getTrapStats(getDartTrap(), 1);
    // dmg=4+2=6, reward=8+2=10
    expect(stats).toEqual({ dmg: 6, reward: 10, rewardType: 'xp' });
  });

  it('level 3: mod1 applied', () => {
    const stats = getTrapStats(getDartTrap(), 3);
    // raw dmg=4+6=10, reward=8+6=14 ; *1.3, *1.2
    expect(stats.dmg).toBe(Math.round(10 * 1.3)); // 13
    expect(stats.reward).toBe(Math.round(14 * 1.2)); // 17
    expect(stats.rewardType).toBe('xp');
  });

  it('level 6: mod1 and mod2 applied', () => {
    const stats = getTrapStats(getDartTrap(), 6);
    // raw dmg=4+12=16, reward=8+12=20
    // mod1=Hidden: dmg_mult=1.3, reward_mult=1.2
    // mod2=Ancient: dmg_mult=1.2, reward_mult=1.3
    expect(stats.dmg).toBe(Math.round(16 * 1.3 * 1.2)); // 25
    expect(stats.reward).toBe(Math.round(20 * 1.2 * 1.3)); // 31
  });
});

// ---- resolveCombat ----

describe('resolveCombat', () => {
  it('player wins when player kills monster in one hit', () => {
    const result = resolveCombat(50, 30, 5, 10, 20);
    expect(result.playerWon).toBe(true);
    expect(result.xpGained).toBe(20);
    expect(result.turns[0].attacker).toBe('player');
    expect(result.turns[0].monsterHpAfter).toBe(0);
    expect(result.turns.length).toBe(1);
  });

  it('monster wins when it kills player first', () => {
    // player dmg=1, player hp=5; monster dmg=10, monster hp=100
    // round 1: player hits for 1 (monster hp=99), monster hits for 10 (player hp=0)
    const result = resolveCombat(1, 5, 10, 100, 50);
    expect(result.playerWon).toBe(false);
    expect(result.xpGained).toBe(0);
    const lastTurn = result.turns[result.turns.length - 1];
    expect(lastTurn.playerHpAfter).toBe(0);
  });

  it('multi-round combat, player wins', () => {
    // player dmg=5, hp=20; monster dmg=3, hp=12
    // r1: player hits 5 (mon hp=7), monster hits 3 (pl hp=17)
    // r2: player hits 5 (mon hp=2), monster hits 3 (pl hp=14)
    // r3: player hits 5 (mon hp=0) -> player wins
    const result = resolveCombat(5, 20, 3, 12, 10);
    expect(result.playerWon).toBe(true);
    expect(result.turns.length).toBe(5); // 3 player attacks, 2 monster attacks
    expect(result.turns[result.turns.length - 1].monsterHpAfter).toBe(0);
  });

  it('exact-kill: player and monster hp reach 0 simultaneously', () => {
    // player dmg=10, hp=10; monster dmg=10, hp=10
    // player attacks: mon hp=0 -> player wins immediately
    const result = resolveCombat(10, 10, 10, 10, 5);
    expect(result.playerWon).toBe(true);
    expect(result.turns.length).toBe(1);
  });
});

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
    const all = lines.join('\n');
    expect(all).toContain('Lv.1');
    expect(all).toContain('Rat');
    // hp = 8 + 1*2 = 10, dmg = 2 + 1*1 = 3, xp = 8 + 1*2 = 10
    expect(all).toContain('HP: 10');
    expect(all).toContain('DMG: 3');
    expect(all).toContain('10 XP');
  });

  it('level 3: one modifier (mod1) applied', () => {
    // Goblin: base_hp=12 hp_growth=3, base_dmg=3 dmg_growth=1, base_xp=10 xp_growth=3
    // mod1=Frenzied: hp_mult=1.0, dmg_mult=1.3, xp_mult=1.2
    const goblin = MONSTER_TYPES[1];
    const frenzied = MONSTER_MODIFIERS[0];
    const armored = MONSTER_MODIFIERS[1];
    const rng = mockRng([goblin, frenzied, armored]);
    const m = generateMonster(rng);
    const lines = formatEncounter(m, 3);
    const all = lines.join('\n');
    expect(all).toContain('Lv.3');
    expect(all).toContain('Frenzied');
    expect(all).toContain('Goblin');
    // raw_hp = 12 + 3*3 = 21, *1.0 = 21
    expect(all).toContain('HP: 21');
    // raw_dmg = 3 + 3*1 = 6, *1.3 = round(7.8) = 8
    expect(all).toContain('DMG: 8');
    // raw_xp = 10 + 3*3 = 19, *1.2 = round(22.8) = 23
    expect(all).toContain('23 XP');
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
    const all = lines.join('\n');
    expect(all).toContain('Lv.6');
    expect(all).toContain('Frenzied');
    expect(all).toContain('Armored');
    expect(all).toContain('Goblin');
    // raw_hp = 12 + 6*3 = 30, *1.0 *1.4 = 42
    expect(all).toContain('HP: 42');
    // raw_dmg = 3 + 6*1 = 9, *1.3 *1.0 = round(11.7) = 12
    expect(all).toContain('DMG: 12');
    // raw_xp = 10 + 6*3 = 28, *1.2 *1.3 = round(43.68) = 44
    expect(all).toContain('44 XP');
  });

  it('level 5: only mod1 applied, mod2 not shown', () => {
    const goblin = MONSTER_TYPES[1];
    const frenzied = MONSTER_MODIFIERS[0];
    const armored = MONSTER_MODIFIERS[1];
    const rng = mockRng([goblin, frenzied, armored]);
    const m = generateMonster(rng);
    const lines = formatEncounter(m, 5);
    const all = lines.join('\n');
    expect(all).toContain('Frenzied');
    expect(all).toContain('Goblin');
    expect(all).not.toContain('Armored');
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
    const all = formatEncounter(t, 1).join('\n');
    // dmg = 4 + 1*2 = 6, xp = 8 + 1*2 = 10
    expect(all).toContain('DMG: 6');
    expect(all).toContain('10 XP');
  });

  it('magical trap shows mana drain and mana reward', () => {
    // Rune Ward: damage_type=mana, base_mana=3, mana_growth=1
    const runeWard = TRAP_TYPES[2];
    const rng = mockRng([runeWard]);
    const t = generateTrap(rng);
    expect(t.trapType).toBe('magical');
    expect(t.damageType).toBe('mana');
    expect(t.rewardType).toBe('mana');
    const all = formatEncounter(t, 1).join('\n');
    // reward = 3 + 1*1 = 4
    expect(all).toContain('MANA DRAIN');
    expect(all).toContain('4 mana');
  });

  it('level 3 trap: one modifier applied', () => {
    // Dart Trap, mod1=Hidden: dmg_mult=1.3, reward_mult=1.2
    const dartTrap = TRAP_TYPES[0];
    const hidden = TRAP_MODIFIERS[0];
    const ancient = TRAP_MODIFIERS[1];
    const rng = mockRng([dartTrap, hidden, ancient]);
    const t = generateTrap(rng);
    const all = formatEncounter(t, 3).join('\n');
    expect(all).toContain('Hidden');
    expect(all).toContain('Dart Trap');
    // raw_dmg = 4 + 3*2 = 10, *1.3 = 13
    expect(all).toContain('DMG: 13');
    // raw_xp = 8 + 3*2 = 14, *1.2 = round(16.8) = 17
    expect(all).toContain('17 XP');
  });

  it('level 6 trap: two modifiers applied', () => {
    // Dart Trap, mod1=Hidden (dmg_mult=1.3), mod2=Ancient (dmg_mult=1.2)
    const dartTrap = TRAP_TYPES[0];
    const hidden = TRAP_MODIFIERS[0];
    const ancient = TRAP_MODIFIERS[1];
    const rng = mockRng([dartTrap, hidden, ancient]);
    const t = generateTrap(rng);
    const all = formatEncounter(t, 6).join('\n');
    expect(all).toContain('Hidden');
    expect(all).toContain('Ancient');
    expect(all).toContain('Dart Trap');
    // raw_dmg = 4 + 6*2 = 16, *1.3 *1.2 = round(24.96) = 25
    expect(all).toContain('DMG: 25');
  });

  it('magical trap mod effect uses mana drain label', () => {
    // Rune Ward (mana), mod1=Cursed (dmg_mult=1.3)
    const runeWard = TRAP_TYPES[2];
    const cursed = TRAP_MODIFIERS[3];
    const hidden = TRAP_MODIFIERS[0];
    const rng = mockRng([runeWard, cursed, hidden]);
    const t = generateTrap(rng);
    const all = formatEncounter(t, 3).join('\n');
    expect(all).toContain('mana drain');
    expect(all).not.toContain('% DMG');
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
    const all = formatEncounter(t, 2).join('\n');
    // amount = 3 + 2*2 = 7
    expect(all).toContain('7');
    expect(all).toContain('on use');
  });

  it('immediate: correct amount scaling at display level', () => {
    // Healing Shrine: base_amount=10, amount_growth=5
    const rng = mockRng(['immediate', TREASURE_IMMEDIATE[0]]);
    const t = generateTreasure(rng);
    expect(t.subKind).toBe('immediate');
    const all = formatEncounter(t, 3).join('\n');
    // amount = 10 + 3*5 = 25
    expect(all).toContain('25');
    expect(all).toContain('on loot');
  });

  it('item level 1-2: no modifiers in display', () => {
    // Sword: base_damage_bonus=3, damage_bonus_growth=2; mod1=Fine, mod2=Masterwork
    const sword = TREASURE_ITEMS[0];
    const fine = TREASURE_MODIFIERS[0];
    const masterwork = TREASURE_MODIFIERS[1];
    const rng = mockRng(['item', sword, fine, masterwork]);
    const t = generateTreasure(rng);
    expect(t.subKind).toBe('item');
    const all = formatEncounter(t, 1).join('\n');
    expect(all).toContain('Sword');
    expect(all).not.toContain('Fine');
    // stat = 3 + 1*2 = 5, no multiplier
    expect(all).toContain('+5 damage');
  });

  it('item level 3: mod1 multiplies stat', () => {
    // Sword, mod1=Fine (stat_multiplier=1.2)
    const sword = TREASURE_ITEMS[0];
    const fine = TREASURE_MODIFIERS[0];
    const masterwork = TREASURE_MODIFIERS[1];
    const rng = mockRng(['item', sword, fine, masterwork]);
    const t = generateTreasure(rng);
    const all = formatEncounter(t, 3).join('\n');
    expect(all).toContain('Fine');
    expect(all).toContain('Sword');
    // raw = 3 + 3*2 = 9, *1.2 = round(10.8) = 11
    expect(all).toContain('+11 damage');
  });

  it('item level 6: mod1 and mod2 stack', () => {
    // Sword, mod1=Fine (1.2), mod2=Masterwork (1.4)
    const sword = TREASURE_ITEMS[0];
    const fine = TREASURE_MODIFIERS[0];
    const masterwork = TREASURE_MODIFIERS[1];
    const rng = mockRng(['item', sword, fine, masterwork]);
    const t = generateTreasure(rng);
    const all = formatEncounter(t, 6).join('\n');
    expect(all).toContain('Fine');
    expect(all).toContain('Masterwork');
    expect(all).toContain('Sword');
    // raw = 3 + 6*2 = 15, *1.2 *1.4 = round(25.2) = 25
    expect(all).toContain('+25 damage');
  });

  it('item with passive modifier shows passive effect in display', () => {
    // Sword, mod1=Regenerating (+3 HP each hit)
    const sword = TREASURE_ITEMS[0];
    const regenerating = TREASURE_MODIFIERS[2];
    const rng = mockRngWithFirstMod(['item', sword], regenerating);
    const t = generateTreasure(rng);
    const all = formatEncounter(t, 3).join('\n');
    expect(all).toContain('+3 HP each hit');
  });
});
