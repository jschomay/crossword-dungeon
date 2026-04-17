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
import { TREASURE_IMMEDIATE } from './data/treasures';

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
  // Rat: base_hp=8 hp_growth=2, base_damage=2 damage_growth=1, base_def=0 def_growth=0, base_xp=8 xp_growth=2
  // mod1=Frenzied: dmg_bonus=2, hp_bonus=0, def_bonus=0, mana_drain=0
  // mod2=Armored:  dmg_bonus=0, hp_bonus=0, def_bonus=2, mana_drain=0
  const getRat = () => {
    const rng = mockRng([MONSTER_TYPES[0], MONSTER_MODIFIERS[0], MONSTER_MODIFIERS[1]]);
    return generateMonster(rng);
  };

  it('level 1: raw stats, no modifiers', () => {
    const stats = getMonsterStats(getRat(), 1);
    // hp=8, dmg=2, def=0, xp=8, manaDrain=0
    expect(stats).toEqual({ hp: 8, dmg: 2, def: 0, xp: 8, manaDrain: 0 });
  });

  it('level 3: mod1 applied', () => {
    const stats = getMonsterStats(getRat(), 3);
    // raw hp=8+(2)*2=12, dmg=2+(2)*1=4, def=0, xp=8+(2)*2=12
    // Frenzied: +2 dmg
    expect(stats.hp).toBe(12);
    expect(stats.dmg).toBe(6); // 4+2
    expect(stats.def).toBe(0);
    expect(stats.xp).toBe(12);
    expect(stats.manaDrain).toBe(0);
  });

  it('level 6: mod1 and mod2 applied', () => {
    // getRat uses mod1=Frenzied(dmg+2), mod2=Huge(hp+6)
    const stats = getMonsterStats(getRat(), 6);
    // raw hp=8+(5)*2=18, dmg=2+(5)*1=7, def=0, xp=18
    // Frenzied: +2 dmg; Huge: +6 hp
    expect(stats.hp).toBe(24); // 18+6
    expect(stats.dmg).toBe(9); // 7+2
    expect(stats.def).toBe(0);
    expect(stats.xp).toBe(18);
    expect(stats.manaDrain).toBe(0);
  });

  it('Armored mod adds def bonus', () => {
    // Orc: base_def=1, def_growth=1; mod1=Armored (def_bonus=2)
    const rng = mockRngWithFirstMod([MONSTER_TYPES[3]], MONSTER_MODIFIERS[2]); // Armored first
    const m = generateMonster(rng);
    const stats = getMonsterStats(m, 3);
    // base_def = 1 + (3-1)*1 = 3, +2 bonus = 5
    expect(stats.def).toBe(5);
  });

  it('Leech mod adds manaDrain', () => {
    // Rat; mod1=Leech (mana_drain=2)
    const rng = mockRngWithFirstMod([MONSTER_TYPES[0]], MONSTER_MODIFIERS[3]); // Leech first
    const m = generateMonster(rng);
    const stats = getMonsterStats(m, 3);
    expect(stats.manaDrain).toBe(2);
    expect(stats.dmg).toBe(4); // no dmg bonus from Leech
  });

  it('two Leech mods stack manaDrain', () => {
    // mod1=Leech, mod2=Leech
    const leech = MONSTER_MODIFIERS[3];
    const rng: Rng = {
      getItem<T>(arr: readonly T[]) { return arr[0] as T; },
      shuffle<T>() { return [leech as unknown as T, leech as unknown as T]; },
    };
    const m = generateMonster(rng);
    const stats = getMonsterStats(m, 6);
    expect(stats.manaDrain).toBe(4); // 2+2
  });
});

// ---- getTrapStats ----

describe('getTrapStats', () => {
  // Dart Trap: base_damage=4, damage_growth=2, base_xp=8, xp_growth=2
  // mod1=Volatile: dmg_bonus=3, mana_drain=0, max_hp_reduce=0, max_mana_reduce=0
  // mod2=Draining: dmg_bonus=0, mana_drain=4, max_hp_reduce=0, max_mana_reduce=0
  const getDartTrap = () => {
    const rng = mockRng([TRAP_TYPES[0], TRAP_MODIFIERS[0], TRAP_MODIFIERS[1]]);
    return generateTrap(rng);
  };

  it('level 1: raw stats, no modifiers', () => {
    const stats = getTrapStats(getDartTrap(), 1);
    // dmg=4, reward=8, no side effects
    expect(stats.dmg).toBe(4);
    expect(stats.reward).toBe(8);
    expect(stats.rewardType).toBe('xp');
    expect(stats.sideEffects).toEqual({ manaDrain: 0, maxHpReduce: 0, maxManaReduce: 0 });
  });

  it('level 3: mod1 applied', () => {
    const stats = getTrapStats(getDartTrap(), 3);
    // raw dmg=4+(2)*2=8 + Volatile dmg_bonus=3 = 11; reward flat=12
    expect(stats.dmg).toBe(11);
    expect(stats.reward).toBe(12);
    expect(stats.rewardType).toBe('xp');
    expect(stats.sideEffects.manaDrain).toBe(0);
  });

  it('level 6: two modifiers applied', () => {
    const stats = getTrapStats(getDartTrap(), 6);
    // raw dmg=4+(5)*2=14 + Volatile(3) + Draining(0) = 17; reward flat=18
    expect(stats.dmg).toBe(17);
    expect(stats.reward).toBe(18);
    expect(stats.sideEffects.manaDrain).toBe(4); // Draining
  });

  it('Wasting mod reduces max HP', () => {
    // Dart Trap, mod1=Wasting (max_hp_reduce=2)
    const rng = mockRngWithFirstMod([TRAP_TYPES[0]], TRAP_MODIFIERS[2]);
    const t = generateTrap(rng);
    const stats = getTrapStats(t, 3);
    expect(stats.sideEffects.maxHpReduce).toBe(2);
    expect(stats.sideEffects.maxManaReduce).toBe(0);
    expect(stats.sideEffects.manaDrain).toBe(0);
  });

  it('Cursed mod reduces max MANA', () => {
    // Dart Trap, mod1=Cursed (max_mana_reduce=2)
    const rng = mockRngWithFirstMod([TRAP_TYPES[0]], TRAP_MODIFIERS[3]);
    const t = generateTrap(rng);
    const stats = getTrapStats(t, 3);
    expect(stats.sideEffects.maxManaReduce).toBe(2);
    expect(stats.sideEffects.maxHpReduce).toBe(0);
  });

  it('stacked side effects accumulate across two mods', () => {
    // shuffle puts Wasting first, then Cursed second → mod1=Wasting, mod2=Cursed
    let shuffleCall = 0;
    const rng: Rng = {
      getItem<T>(arr: readonly T[]) { return arr[0] as T; }, // always Dart Trap
      shuffle<T>(arr: readonly T[]) {
        shuffleCall++;
        // put Wasting at 0, Cursed at 1
        const wasting = TRAP_MODIFIERS[2] as unknown as T;
        const cursed  = TRAP_MODIFIERS[3] as unknown as T;
        return [wasting, cursed, ...arr.filter(x => x !== (wasting as unknown) && x !== (cursed as unknown))];
      },
    };
    const t = generateTrap(rng);
    const stats = getTrapStats(t, 6);
    expect(stats.sideEffects.maxHpReduce).toBe(2);
    expect(stats.sideEffects.maxManaReduce).toBe(2);
  });
});

// ---- resolveCombat ----

describe('resolveCombat', () => {
  it('player wins when player kills monster in one hit', () => {
    const result = resolveCombat({ dmg: 50, hp: 30 }, { dmg: 5, hp: 10, xp: 20, def: 0, manaDrain: 0 });
    expect(result.playerWon).toBe(true);
    expect(result.xpGained).toBe(20);
    expect(result.turns[0].attacker).toBe('player');
    expect(result.turns[0].monsterHpAfter).toBe(0);
    expect(result.turns.length).toBe(1);
  });

  it('monster wins when it kills player first', () => {
    // player dmg=1, player hp=5; monster dmg=10, monster hp=100
    // round 1: player hits for 1 (monster hp=99), monster hits for 10 (player hp=0)
    const result = resolveCombat({ dmg: 1, hp: 5 }, { dmg: 10, hp: 100, xp: 50, def: 0, manaDrain: 0 });
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
    const result = resolveCombat({ dmg: 5, hp: 20 }, { dmg: 3, hp: 12, xp: 10, def: 0, manaDrain: 0 });
    expect(result.playerWon).toBe(true);
    expect(result.turns.length).toBe(5); // 3 player attacks, 2 monster attacks
    expect(result.turns[result.turns.length - 1].monsterHpAfter).toBe(0);
  });

  it('exact-kill: player and monster hp reach 0 simultaneously', () => {
    // player dmg=10, hp=10; monster dmg=10, hp=10
    // player attacks: mon hp=0 -> player wins immediately
    const result = resolveCombat({ dmg: 10, hp: 10 }, { dmg: 10, hp: 10, xp: 5, def: 0, manaDrain: 0 });
    expect(result.playerWon).toBe(true);
    expect(result.turns.length).toBe(1);
  });

  it('monster def reduces player damage, minimum 1', () => {
    // player dmg=5, monster def=3 -> effective=2
    const result = resolveCombat({ dmg: 5, hp: 30 }, { dmg: 2, hp: 10, xp: 5, def: 3, manaDrain: 0 });
    expect(result.turns[0].dmg).toBe(2); // 5-3=2
    expect(result.playerWon).toBe(true);
  });

  it('monster def cannot reduce player damage below 1', () => {
    // player dmg=2, monster def=5 -> clamped to 1
    const result = resolveCombat({ dmg: 2, hp: 30 }, { dmg: 1, hp: 3, xp: 5, def: 5, manaDrain: 0 });
    expect(result.turns[0].dmg).toBe(1);
    expect(result.playerWon).toBe(true);
  });

  it('Leech: manaDrained recorded on monster attack turns', () => {
    // monster has manaDrain=3; player takes 2 rounds to kill it
    const result = resolveCombat({ dmg: 5, hp: 20 }, { dmg: 2, hp: 8, xp: 5, def: 0, manaDrain: 3 });
    const monsterTurns = result.turns.filter(t => t.attacker === 'monster');
    expect(monsterTurns.length).toBeGreaterThan(0);
    monsterTurns.forEach(t => expect(t.manaDrained).toBe(3));
  });

  it('Leech: player attack turns have manaDrained=0', () => {
    const result = resolveCombat({ dmg: 5, hp: 20 }, { dmg: 2, hp: 8, xp: 5, def: 0, manaDrain: 3 });
    const playerTurns = result.turns.filter(t => t.attacker === 'player');
    playerTurns.forEach(t => expect(t.manaDrained).toBe(0));
  });

  it('mana hitting 0 mid-combat triggers manaGameOver', () => {
    // player mana=4, monster drains 3/hit; after 2 monster hits mana=0
    // player dmg=5, hp=30, monster hp=20 (takes 4 hits) so mana runs out first
    const result = resolveCombat({ dmg: 5, hp: 30, mana: 4 }, { dmg: 1, hp: 20, xp: 10, def: 0, manaDrain: 3 });
    expect(result.manaGameOver).toBe(true);
    expect(result.playerWon).toBe(false);
    expect(result.xpGained).toBe(0);
  });

  it('manaGameOver is false when player wins before mana runs out', () => {
    // player kills monster in one hit, mana never drained
    const result = resolveCombat({ dmg: 50, hp: 30, mana: 5 }, { dmg: 1, hp: 5, xp: 10, def: 0, manaDrain: 3 });
    expect(result.playerWon).toBe(true);
    expect(result.manaGameOver).toBe(false);
  });

  it('manaGameOver is false when player dies to HP first', () => {
    // no mana drain, player dies to damage
    const result = resolveCombat({ dmg: 1, hp: 5, mana: 20 }, { dmg: 10, hp: 100, xp: 10, def: 0, manaDrain: 0 });
    expect(result.playerWon).toBe(false);
    expect(result.manaGameOver).toBe(false);
  });

  it('playerManaAfter tracked on monster turns', () => {
    // player mana=10, manaDrain=3; after first monster turn mana=7
    const result = resolveCombat({ dmg: 5, hp: 20, mana: 10 }, { dmg: 1, hp: 20, xp: 5, def: 0, manaDrain: 3 });
    const firstMonsterTurn = result.turns.find(t => t.attacker === 'monster')!;
    expect(firstMonsterTurn.playerManaAfter).toBe(7); // 10-3
  });
});


// ---- Passive effects (combat) ----

describe('passive effects', () => {
  it('resolveCombat: hpPerRound heals player on player attack turn', () => {
    // player dmg=5, hp=20; monster dmg=3, hp=12; hpPerRound=3
    // turn 0 (player): hits 5 (mon hp=7), regen +3 (pl stays 20, capped at max)
    // turn 1 (monster): hits 3 (pl hp=17)
    // turn 2 (player): hits 5 (mon hp=2), regen +3 (pl hp=20)
    // turn 3 (monster): hits 3 (pl hp=17)
    // turn 4 (player): hits 5 (mon hp=0) -> player wins
    const result = resolveCombat({ dmg: 5, hp: 20, maxHp: 20, hpPerRound: 3 }, { dmg: 3, hp: 12, xp: 10, def: 0, manaDrain: 0 });
    expect(result.playerWon).toBe(true);
    expect(result.turns[0].manaGained).toBe(0); // player turn: no manaGained from regen here
    expect(result.turns[2].playerHpAfter).toBe(20); // healed back to full on player turn 2
  });

  it('resolveCombat: manaPerRound tracked per turn', () => {
    const result = resolveCombat({ dmg: 5, hp: 20, manaPerRound: 2 }, { dmg: 3, hp: 12, xp: 10, def: 0, manaDrain: 0 });
    expect(result.turns[0].manaGained).toBe(2); // regen on player turn now
  });
});

// ---- Monster generation ----

describe('generateMonster', () => {
  it('stores base stats and always rolls two mods', () => {
    const rng = mockRng([MONSTER_TYPES[0]]);
    const m = generateMonster(rng);
    expect(m.kind).toBe('monster');
    expect(m.baseName).toBe('Rat');
    // shuffle returns array as-is, so mod1=MONSTER_MODIFIERS[0]=Frenzied, mod2=MONSTER_MODIFIERS[1]=Huge
    expect(m.mod1.name).toBe('Frenzied');
    expect(m.mod2.name).toBe('Huge');
  });

  it('level 1: no modifiers applied in display, correct stats', () => {
    // Rat: base_hp=8, base_damage=2, base_def=0, base_xp=8
    const rng = mockRng([MONSTER_TYPES[0]]);
    const m = generateMonster(rng);
    const lines = formatEncounter(m, 1);
    const all = lines.join('\n');
    expect(all).toContain('Lv.1');
    expect(all).toContain('Rat');
    expect(all).toContain('HP: ██████████  8');
    expect(all).toContain('DMG: 2');
    expect(all).toContain('8 XP');
  });

  it('level 3: one modifier (mod1) applied', () => {
    // Goblin: base_hp=12 hp_growth=3, base_dmg=3 dmg_growth=1, base_xp=10 xp_growth=3
    // mod1=Frenzied: dmg_bonus=2
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
    // hp = 12+(2)*3 = 18 (no hp bonus)
    expect(all).toContain('HP: ██████████  18');
    // dmg = 3+(2)*1 = 5, +2 bonus = 7
    expect(all).toContain('DMG: 7');
    // xp = 10+(2)*3 = 16 (flat)
    expect(all).toContain('16 XP');
  });

  it('level 6: both modifiers (mod1 + mod2) applied', () => {
    // Goblin, shuffle as-is: mod1=Frenzied (dmg_bonus=2), mod2=Huge (hp_bonus=6)
    const goblin = MONSTER_TYPES[1];
    const rng = mockRng([goblin]);
    const m = generateMonster(rng);
    const lines = formatEncounter(m, 6);
    const all = lines.join('\n');
    expect(all).toContain('Lv.6');
    expect(all).toContain('Frenzied');
    expect(all).toContain('Huge');
    expect(all).toContain('Goblin');
    // hp = 12+(5)*3 = 27, +6 (Huge) = 33
    expect(all).toContain('HP: ██████████  33');
    // dmg = 3+(5)*1 = 8, +2 (Frenzied) = 10
    expect(all).toContain('DMG: 10');
    // xp = 10+(5)*3 = 25 (flat)
    expect(all).toContain('25 XP');
  });

  it('level 5: only mod1 applied, mod2 not shown', () => {
    const goblin = MONSTER_TYPES[1];
    const frenzied = MONSTER_MODIFIERS[0];
    const armored = MONSTER_MODIFIERS[2]; // Armored is index 2
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
    // Dart Trap, mod1=Volatile (dmg_bonus=3), mod2=Draining (mana_drain=4)
    const dartTrap = TRAP_TYPES[0];
    const volatile_ = TRAP_MODIFIERS[0];
    const draining = TRAP_MODIFIERS[1];
    const rng = mockRng([dartTrap, volatile_, draining]);
    const t = generateTrap(rng);
    const all = formatEncounter(t, 3).join('\n');
    expect(all).toContain('Volatile');
    expect(all).toContain('Dart Trap');
    // raw_dmg = 4+(2)*2 = 8, +3 bonus = 11
    expect(all).toContain('DMG: 11');
    // reward flat = 8+(2)*2 = 12
    expect(all).toContain('12 XP');
  });

  it('level 6 trap: two modifiers applied', () => {
    // Dart Trap, mod1=Volatile (dmg_bonus=3), mod2=Draining (mana_drain=4)
    const dartTrap = TRAP_TYPES[0];
    const volatile_ = TRAP_MODIFIERS[0];
    const draining = TRAP_MODIFIERS[1];
    const rng = mockRng([dartTrap, volatile_, draining]);
    const t = generateTrap(rng);
    const all = formatEncounter(t, 6).join('\n');
    expect(all).toContain('Volatile');
    expect(all).toContain('Draining');
    expect(all).toContain('Dart Trap');
    // raw_dmg = 4+(5)*2 = 14, +3 = 17
    expect(all).toContain('DMG: 17');
    expect(all).toContain('-4 MANA');
  });

  it('magical trap mod effect uses mana drain label', () => {
    // Rune Ward (mana), mod1=Wasting (max_hp_reduce=2)
    const runeWard = TRAP_TYPES[2];
    const wasting = TRAP_MODIFIERS[2];
    const volatile_ = TRAP_MODIFIERS[0];
    const rng = mockRng([runeWard, wasting, volatile_]);
    const t = generateTrap(rng);
    const all = formatEncounter(t, 3).join('\n');
    expect(all).toContain('DRAIN');
    expect(all).not.toContain('% DMG');
  });

  it('Wasting mod shows max HP reduction in display', () => {
    const rng = mockRngWithFirstMod([TRAP_TYPES[0]], TRAP_MODIFIERS[2]);
    const t = generateTrap(rng);
    const all = formatEncounter(t, 3).join('\n');
    expect(all).toContain('Wasting');
    expect(all).toContain('-2 max HP');
  });

  it('Cursed mod shows max MANA reduction in display', () => {
    const rng = mockRngWithFirstMod([TRAP_TYPES[0]], TRAP_MODIFIERS[3]);
    const t = generateTrap(rng);
    const all = formatEncounter(t, 3).join('\n');
    expect(all).toContain('Cursed');
    expect(all).toContain('-2 max MANA');
  });

  it('Draining mod shows mana drain in display', () => {
    const rng = mockRngWithFirstMod([TRAP_TYPES[0]], TRAP_MODIFIERS[1]);
    const t = generateTrap(rng);
    const all = formatEncounter(t, 3).join('\n');
    expect(all).toContain('Draining');
    expect(all).toContain('-4 MANA');
  });
});

// ---- Treasure generation ----

describe('generateTreasure', () => {
  it('always generates an immediate encounter', () => {
    const rng = mockRng([TREASURE_IMMEDIATE[0]]);
    const t = generateTreasure(rng);
    expect(t.kind).toBe('treasure');
    expect(t.subKind).toBe('immediate');
  });

  it('immediate restore_hp: correct label and scaling', () => {
    // Healing Shrine [0]: base_amount=10, amount_growth=5
    const rng = mockRng([TREASURE_IMMEDIATE[0]]);
    const t = generateTreasure(rng);
    expect(t.subKind).toBe('immediate');
    const all = formatEncounter(t, 3).join('\n');
    // amount = 10 + (3-1)*5 = 20
    expect(all).toContain('+20 HP on loot');
  });

  it('immediate restore_mana: correct label and scaling', () => {
    // Mana Well [1]: base_amount=5, amount_growth=2
    const rng = mockRng([TREASURE_IMMEDIATE[1]]);
    const t = generateTreasure(rng);
    const all = formatEncounter(t, 3).join('\n');
    // amount = 5 + (3-1)*2 = 9
    expect(all).toContain('+9 MANA on loot');
  });

  it('immediate grant_xp: correct label and scaling', () => {
    // Experience Tome [2]: base_amount=10, amount_growth=10
    const rng = mockRng([TREASURE_IMMEDIATE[2]]);
    const t = generateTreasure(rng);
    const all = formatEncounter(t, 2).join('\n');
    // amount = 10 + (2-1)*10 = 20
    expect(all).toContain('+20 XP on loot');
  });

  it('immediate grant_gold: correct label and scaling', () => {
    // Gold Chest [3]: base_amount=20, amount_growth=11
    const rng = mockRng([TREASURE_IMMEDIATE[3]]);
    const t = generateTreasure(rng);
    const all = formatEncounter(t, 2).join('\n');
    // amount = 20 + (2-1)*11 = 31
    expect(all).toContain('+31 GOLD on loot');
  });

});

// ---- Shop gold chest scaling ----

describe('gold chest scaling', () => {
  it('level 1 yields base amount 20', () => {
    const chest = TREASURE_IMMEDIATE[3]; // Gold Chest
    expect(chest.effect).toBe('grant_gold');
    const amount = Math.round(chest.base_amount + (1 - 1) * chest.amount_growth);
    expect(amount).toBe(20);
  });

  it('level 8 yields ~108 (base 20 + 7*11)', () => {
    const chest = TREASURE_IMMEDIATE[3];
    const amount = Math.round(chest.base_amount + (8 - 1) * chest.amount_growth);
    expect(amount).toBe(97); // 20 + 7*11 = 97
  });

  it('scales linearly from level 1 to 8', () => {
    const chest = TREASURE_IMMEDIATE[3];
    for (let level = 1; level <= 8; level++) {
      const amount = Math.round(chest.base_amount + (level - 1) * chest.amount_growth);
      expect(amount).toBeGreaterThanOrEqual(20);
      expect(amount).toBeLessThanOrEqual(110);
    }
  });
});

// ---- formatEncounter puzzleMult ----

describe('formatEncounter puzzleMult', () => {
  it('monster: stats scale with puzzleMult', () => {
    // Rat: base_hp=8, base_dmg=2, base_xp=8 — with puzzleMult=2 all should double
    const rng = mockRng([MONSTER_TYPES[0]]);
    const m = generateMonster(rng);
    const all = formatEncounter(m, 1, undefined, 2).join('\n');
    expect(all).toContain('HP: ██████████  16');
    expect(all).toContain('DMG: 4');
    expect(all).toContain('16 XP');
  });

  it('trap: dmg scales with puzzleMult', () => {
    // Dart Trap: base_dmg=4 — with puzzleMult=2 should show DMG: 8
    const rng = mockRng([TRAP_TYPES[0]]);
    const t = generateTrap(rng);
    const all = formatEncounter(t, 1, undefined, 2).join('\n');
    expect(all).toContain('DMG: 8');
  });
});

// ---- Level-based encounter filtering ----

describe('generateMonster level filtering', () => {
  // Rat has max_level:3, Dragon has min_level:2
  it('excludes Dragon at dungeon level 1', () => {
    // Force pick to always return the last item — if pool excludes Dragon, last item is Orc
    const rng: Rng = {
      getItem<T>(arr: readonly T[]): T { return arr[arr.length - 1]; },
      shuffle<T>(arr: readonly T[]): T[] { return [...arr]; },
    };
    const m = generateMonster(rng, 1);
    expect(m.baseName).not.toBe('Dragon');
  });

  it('includes Dragon at dungeon level 2', () => {
    // Force pick to always return last item — Dragon is last in MONSTER_TYPES
    const rng: Rng = {
      getItem<T>(arr: readonly T[]): T { return arr[arr.length - 1]; },
      shuffle<T>(arr: readonly T[]): T[] { return [...arr]; },
    };
    const m = generateMonster(rng, 2);
    expect(m.baseName).toBe('Dragon');
  });

  it('excludes Rat at dungeon level 4', () => {
    // Force pick to return first item — if Rat excluded, first is Goblin
    const rng: Rng = {
      getItem<T>(arr: readonly T[]): T { return arr[0]; },
      shuffle<T>(arr: readonly T[]): T[] { return [...arr]; },
    };
    const m = generateMonster(rng, 4);
    expect(m.baseName).not.toBe('Rat');
  });

  it('includes Rat at dungeon level 3', () => {
    const rng: Rng = {
      getItem<T>(arr: readonly T[]): T { return arr[0]; },
      shuffle<T>(arr: readonly T[]): T[] { return [...arr]; },
    };
    const m = generateMonster(rng, 3);
    expect(m.baseName).toBe('Rat');
  });
});

// ---- Shop modifier application ----

