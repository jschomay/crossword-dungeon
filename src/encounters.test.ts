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
    // hp=8+(0)*2=8, dmg=2+(0)*1=2, xp=8+(0)*2=8
    expect(stats).toEqual({ hp: 8, dmg: 2, xp: 8 });
  });

  it('level 3: mod1 applied', () => {
    const stats = getMonsterStats(getRat(), 3);
    // raw hp=8+(2)*2=12, dmg=2+(2)*1=4, xp=8+(2)*2=12
    // *1.0, *1.3, *1.2
    expect(stats.hp).toBe(12);
    expect(stats.dmg).toBe(Math.round(4 * 1.3)); // 5
    expect(stats.xp).toBe(Math.round(12 * 1.2)); // 14
  });

  it('level 6: mod1 and mod2 applied', () => {
    const stats = getMonsterStats(getRat(), 6);
    // raw hp=8+(5)*2=18, dmg=2+(5)*1=7, xp=8+(5)*2=18
    // *1.0*1.4=1.4, *1.3*1.0=1.3, *1.2*1.3=1.56
    expect(stats.hp).toBe(Math.round(18 * 1.4)); // 25
    expect(stats.dmg).toBe(Math.round(7 * 1.3)); // 9
    expect(stats.xp).toBe(Math.round(18 * 1.56)); // 28
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
    // dmg=4+(0)*2=4, reward=8+(0)*2=8
    expect(stats).toEqual({ dmg: 4, reward: 8, rewardType: 'xp' });
  });

  it('level 3: mod1 applied', () => {
    const stats = getTrapStats(getDartTrap(), 3);
    // raw dmg=4+(2)*2=8, reward=8+(2)*2=12 ; *1.3, *1.2
    expect(stats.dmg).toBe(Math.round(8 * 1.3)); // 10
    expect(stats.reward).toBe(Math.round(12 * 1.2)); // 14
    expect(stats.rewardType).toBe('xp');
  });

  it('level 6: mod1 and mod2 applied', () => {
    const stats = getTrapStats(getDartTrap(), 6);
    // raw dmg=4+(5)*2=14, reward=8+(5)*2=18
    // mod1=Hidden: dmg_mult=1.3, reward_mult=1.2
    // mod2=Ancient: dmg_mult=1.2, reward_mult=1.3
    expect(stats.dmg).toBe(Math.round(14 * 1.3 * 1.2)); // 22
    expect(stats.reward).toBe(Math.round(18 * 1.2 * 1.3)); // 28
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
    // hp = 8+(0)*2 = 8, dmg = 2+(0)*1 = 2, xp = 8+(0)*2 = 8
    expect(all).toContain('HP: ██████████  8');
    expect(all).toContain('DMG: 2');
    expect(all).toContain('8 XP');
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
    // raw_hp = 12+(2)*3 = 18, *1.0 = 18
    expect(all).toContain('HP: ██████████  18');
    // raw_dmg = 3+(2)*1 = 5, *1.3 = round(6.5) = 7
    expect(all).toContain('DMG: 7');
    // raw_xp = 10+(2)*3 = 16, *1.2 = round(19.2) = 19
    expect(all).toContain('19 XP');
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
    // raw_hp = 12+(5)*3 = 27, *1.0 *1.4 = round(37.8) = 38
    expect(all).toContain('HP: ██████████  38');
    // raw_dmg = 3+(5)*1 = 8, *1.3 *1.0 = round(10.4) = 10
    expect(all).toContain('DMG: 10');
    // raw_xp = 10+(5)*3 = 25, *1.2 *1.3 = round(39) = 39
    expect(all).toContain('39 XP');
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
    // dmg = 4+(0)*2 = 4, xp = 8+(0)*2 = 8
    expect(all).toContain('DMG: 4');
    expect(all).toContain('8 XP');
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
    // reward = 3+(0)*1 = 3
    expect(all).toContain('DRAIN');
    expect(all).toContain('3 MANA');
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
    // raw_dmg = 4+(2)*2 = 8, *1.3 = round(10.4) = 10
    expect(all).toContain('DMG: 10');
    // raw_xp = 8+(2)*2 = 12, *1.2 = round(14.4) = 14
    expect(all).toContain('14 XP');
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
    // raw_dmg = 4+(5)*2 = 14, *1.3 *1.2 = round(21.84) = 22
    expect(all).toContain('DMG: 22');
  });

  it('magical trap mod effect uses mana drain label', () => {
    // Rune Ward (mana), mod1=Cursed (dmg_mult=1.3)
    const runeWard = TRAP_TYPES[2];
    const cursed = TRAP_MODIFIERS[3];
    const hidden = TRAP_MODIFIERS[0];
    const rng = mockRng([runeWard, cursed, hidden]);
    const t = generateTrap(rng);
    const all = formatEncounter(t, 3).join('\n');
    expect(all).toContain('MANA drain');
    expect(all).not.toContain('% DMG');
  });
});

// ---- Treasure generation ----

describe('generateTreasure', () => {
  it('consumable: fixed restore amount + quantity at display level', () => {
    // Health Potion: restore_amount=20, base_quantity=1, quantity_growth=0.5
    const rng = mockRng(['consumable', TREASURE_CONSUMABLES[0]]);
    const t = generateTreasure(rng);
    expect(t.kind).toBe('treasure');
    expect(t.subKind).toBe('consumable');
    const all = formatEncounter(t, 2).join('\n');
    // quantity = 1 + floor((2-1)*0.5) = 1, shown in title
    expect(all).toContain('Health Potion ×1');
  });

  it('immediate restore_hp: correct label and scaling', () => {
    // Healing Shrine: base_amount=10, amount_growth=5
    const rng = mockRng(['immediate', TREASURE_IMMEDIATE[0]]);
    const t = generateTreasure(rng);
    expect(t.subKind).toBe('immediate');
    const all = formatEncounter(t, 3).join('\n');
    // amount = 10 + (3-1)*5 = 20
    expect(all).toContain('+20 HP on loot');
  });

  it('immediate restore_mana: correct label and scaling', () => {
    // Mana Well: base_amount=5, amount_growth=2
    const rng = mockRng(['immediate', TREASURE_IMMEDIATE[1]]);
    const t = generateTreasure(rng);
    const all = formatEncounter(t, 3).join('\n');
    // amount = 5 + (3-1)*2 = 9
    expect(all).toContain('+9 MANA on loot');
  });

  it('immediate increase_max_hp: correct label and scaling', () => {
    // Blessed Fountain: base_amount=2, amount_growth=2
    const rng = mockRng(['immediate', TREASURE_IMMEDIATE[2]]);
    const t = generateTreasure(rng);
    const all = formatEncounter(t, 2).join('\n');
    // amount = 2 + (2-1)*2 = 4
    expect(all).toContain('+4 max HP on loot');
  });

  it('immediate increase_max_mana: correct label and scaling', () => {
    // Arcane Nexus: base_amount=2, amount_growth=2
    const rng = mockRng(['immediate', TREASURE_IMMEDIATE[3]]);
    const t = generateTreasure(rng);
    const all = formatEncounter(t, 2).join('\n');
    // amount = 2 + (2-1)*2 = 4
    expect(all).toContain('+4 max MANA on loot');
  });

  it('immediate grant_xp: correct label and scaling', () => {
    // Experience Tome: base_amount=10, amount_growth=10
    const rng = mockRng(['immediate', TREASURE_IMMEDIATE[4]]);
    const t = generateTreasure(rng);
    const all = formatEncounter(t, 2).join('\n');
    // amount = 10 + (2-1)*10 = 20
    expect(all).toContain('+20 XP on loot');
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
    // stat = 3 + (1-1)*2 = 3, no multiplier
    expect(all).toContain('+3 DMG');
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
    // raw = 3 + (3-1)*2 = 7, *1.2 = round(8.4) = 8
    expect(all).toContain('+8 DMG');
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
    // raw = 3 + (6-1)*2 = 13, *1.2 *1.4 = round(21.84) = 22
    expect(all).toContain('+22 DMG');
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
