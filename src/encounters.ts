import { hpBar } from './utils';
import { MONSTER_TYPES, MONSTER_MODIFIERS } from './data/monsters';
import { TRAP_TYPES, TRAP_MODIFIERS } from './data/traps';
import { TREASURE_ITEMS, TREASURE_CONSUMABLES, TREASURE_IMMEDIATE, TREASURE_MODIFIERS } from './data/treasures';

// Minimal RNG interface so we can inject a seeded RNG or Math.random in tests
export interface Rng {
  getItem<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];
}

// ---- Encounter definitions (rolled once at generation) ----
// Stats are NOT stored — they are computed from activatedLevel at display time.

export type MonsterEncounter = {
  kind: 'monster';
  baseName: string;
  baseDescription: string;
  baseHp: number;
  hpGrowth: number;
  baseDamage: number;
  damageGrowth: number;
  baseXp: number;
  xpGrowth: number;
  mod1: typeof MONSTER_MODIFIERS[number];
  mod2: typeof MONSTER_MODIFIERS[number];
};

export type TrapEncounter = {
  kind: 'trap';
  baseName: string;
  baseDescription: string;
  trapType: 'physical' | 'magical';
  baseDamage: number;
  damageGrowth: number;
  damageType: 'hp' | 'mana';
  baseReward: number;
  rewardGrowth: number;
  rewardType: 'xp' | 'mana';
  mod1: typeof TRAP_MODIFIERS[number];
  mod2: typeof TRAP_MODIFIERS[number];
};

export type TreasureItemEncounter = {
  kind: 'treasure';
  subKind: 'item';
  baseName: string;
  baseDescription: string;
  slot: 'weapon' | 'armor' | 'amulet';
  statType: 'damage' | 'defense' | 'hp';
  baseStat: number;
  statGrowth: number;
  mod1: typeof TREASURE_MODIFIERS[number];
  mod2: typeof TREASURE_MODIFIERS[number];
};

export type TreasureConsumableEncounter = {
  kind: 'treasure';
  subKind: 'consumable';
  baseName: string;
  baseDescription: string;
  effect: string;
  baseAmount: number;
  amountGrowth: number;
};

export type TreasureImmediateEncounter = {
  kind: 'treasure';
  subKind: 'immediate';
  baseName: string;
  baseDescription: string;
  effect: string;
  baseAmount: number;
  amountGrowth: number;
};

export type TreasureEncounter =
  | TreasureItemEncounter
  | TreasureConsumableEncounter
  | TreasureImmediateEncounter;

export type Encounter = MonsterEncounter | TrapEncounter | TreasureEncounter;

// ---- Encounter style (symbol + color per kind) ----

export const UNKNOWN_COLOR = '#aaaaaa';  // unactivated room '?' and flavor text
export const ENCOUNTER_STYLE: Record<'monster' | 'trap' | 'treasure', { symbol: string; color: string }> = {
  monster:  { symbol: '*', color: '#ff6666' },
  trap:     { symbol: '!', color: '#cc66ff' },
  treasure: { symbol: '$', color: '#ffaa00' },
};

// ---- Helpers ----

function round(n: number): number {
  return Math.round(n);
}

function pickTwo<T>(arr: readonly T[], rng: Rng): [T, T] {
  const shuffled = rng.shuffle(arr);
  return [shuffled[0], shuffled[1]];
}

function effectLabel(effect: string, amount: number): string {
  switch (effect) {
    case 'restore_hp':       return `+${amount} HP`;
    case 'restore_mana':     return `+${amount} MANA`;
    case 'increase_max_hp':  return `+${amount} max HP`;
    case 'increase_max_mana':return `+${amount} max MANA`;
    case 'grant_xp':         return `+${amount} XP`;
    case 'reveal_letter':    return amount === 1 ? 'Reveals 1 letter' : `Reveals ${amount} letters`;
    default:                 return `${effect}: ${amount}`;
  }
}

// ---- Generation (rolls base + modifiers, does NOT compute stats) ----

export function generateMonster(rng: Rng): MonsterEncounter {
  const base = rng.getItem(MONSTER_TYPES);
  const [mod1, mod2] = pickTwo(MONSTER_MODIFIERS, rng);
  return {
    kind: 'monster',
    baseName: base.name,
    baseDescription: base.description,
    baseHp: base.base_hp,
    hpGrowth: base.hp_growth,
    baseDamage: base.base_damage,
    damageGrowth: base.damage_growth,
    baseXp: base.base_xp,
    xpGrowth: base.xp_growth,
    mod1,
    mod2,
  };
}

export function generateTrap(rng: Rng): TrapEncounter {
  const base = rng.getItem(TRAP_TYPES);
  const [mod1, mod2] = pickTwo(TRAP_MODIFIERS, rng);
  const isPhysical = base.damage_type === 'hp';
  const baseReward = isPhysical
    ? (base as { base_xp: number; xp_growth: number }).base_xp
    : (base as { base_mana: number; mana_growth: number }).base_mana;
  const rewardGrowth = isPhysical
    ? (base as { base_xp: number; xp_growth: number }).xp_growth
    : (base as { base_mana: number; mana_growth: number }).mana_growth;
  return {
    kind: 'trap',
    baseName: base.name,
    baseDescription: base.description,
    trapType: base.type,
    baseDamage: base.base_damage,
    damageGrowth: base.damage_growth,
    damageType: base.damage_type,
    baseReward,
    rewardGrowth,
    rewardType: isPhysical ? 'xp' : 'mana',
    mod1,
    mod2,
  };
}

export function generateTreasure(rng: Rng): TreasureEncounter {
  const roll = rng.getItem(['item', 'consumable', 'immediate'] as const);

  if (roll === 'consumable') {
    const base = rng.getItem(TREASURE_CONSUMABLES);
    return {
      kind: 'treasure',
      subKind: 'consumable',
      baseName: base.name,
      baseDescription: base.description,
      effect: base.effect,
      baseAmount: base.base_amount,
      amountGrowth: base.amount_growth,
    };
  }

  if (roll === 'immediate') {
    const base = rng.getItem(TREASURE_IMMEDIATE);
    return {
      kind: 'treasure',
      subKind: 'immediate',
      baseName: base.name,
      baseDescription: base.description,
      effect: base.effect,
      baseAmount: base.base_amount,
      amountGrowth: base.amount_growth,
    };
  }

  // item — always roll both mods; apply at display time based on level
  const base = rng.getItem(TREASURE_ITEMS);
  const [mod1, mod2] = pickTwo(TREASURE_MODIFIERS, rng);

  let statType: 'damage' | 'defense' | 'hp';
  let baseStat: number;
  let statGrowth: number;
  if ('base_damage_bonus' in base) {
    statType = 'damage'; baseStat = base.base_damage_bonus; statGrowth = base.damage_bonus_growth;
  } else if ('base_defense_bonus' in base) {
    statType = 'defense'; baseStat = base.base_defense_bonus; statGrowth = base.defense_bonus_growth;
  } else {
    statType = 'hp'; baseStat = base.base_hp_bonus; statGrowth = base.hp_bonus_growth;
  }

  return {
    kind: 'treasure',
    subKind: 'item',
    baseName: base.name,
    baseDescription: base.description,
    slot: base.slot,
    statType,
    baseStat,
    statGrowth,
    mod1,
    mod2,
  };
}

export function generateEncounter(rng: Rng): Encounter {
  const type = rng.getItem(['monster', 'trap', 'treasure'] as const);
  switch (type) {
    case 'monster': return generateMonster(rng);
    case 'trap': return generateTrap(rng);
    case 'treasure': return generateTreasure(rng);
  }
}

// ---- Stat computation helpers (pure, testable) ----

export function getMonsterStats(
  enc: MonsterEncounter,
  level: number,
): { hp: number; dmg: number; xp: number } {
  const rawHp = enc.baseHp + (level - 1) * enc.hpGrowth;
  const rawDmg = enc.baseDamage + (level - 1) * enc.damageGrowth;
  const rawXp = enc.baseXp + (level - 1) * enc.xpGrowth;
  let hpMult = 1, dmgMult = 1, xpMult = 1;
  if (level >= 3) {
    hpMult *= enc.mod1.hp_multiplier;
    dmgMult *= enc.mod1.damage_multiplier;
    xpMult *= enc.mod1.xp_multiplier;
  }
  if (level >= 6) {
    hpMult *= enc.mod2.hp_multiplier;
    dmgMult *= enc.mod2.damage_multiplier;
    xpMult *= enc.mod2.xp_multiplier;
  }
  return {
    hp: round(rawHp * hpMult),
    dmg: round(rawDmg * dmgMult),
    xp: round(rawXp * xpMult),
  };
}

export function getTrapStats(
  enc: TrapEncounter,
  level: number,
): { dmg: number; reward: number; rewardType: 'xp' | 'mana' } {
  const rawDmg = enc.baseDamage + (level - 1) * enc.damageGrowth;
  const rawReward = enc.baseReward + (level - 1) * enc.rewardGrowth;
  let dmgMult = 1, rewardMult = 1;
  if (level >= 3) {
    dmgMult *= enc.mod1.damage_multiplier;
    rewardMult *= enc.mod1.reward_multiplier;
  }
  if (level >= 6) {
    dmgMult *= enc.mod2.damage_multiplier;
    rewardMult *= enc.mod2.reward_multiplier;
  }
  return {
    dmg: round(rawDmg * dmgMult),
    reward: round(rawReward * rewardMult),
    rewardType: enc.rewardType,
  };
}

// ---- Combat resolution (pure, no side effects) ----

export type CombatTurn = {
  attacker: 'player' | 'monster';
  dmg: number;
  playerHpAfter: number;
  monsterHpAfter: number;
};

export type CombatResult = {
  turns: CombatTurn[];
  playerWon: boolean;
  xpGained: number;
};

export function resolveCombat(
  playerDmg: number,
  playerHp: number,
  monsterDmg: number,
  monsterHp: number,
  xp: number,
): CombatResult {
  const turns: CombatTurn[] = [];
  let curPlayerHp = playerHp;
  let curMonsterHp = monsterHp;

  while (curPlayerHp > 0 && curMonsterHp > 0) {
    // Player attacks first
    curMonsterHp -= playerDmg;
    turns.push({
      attacker: 'player',
      dmg: playerDmg,
      playerHpAfter: curPlayerHp,
      monsterHpAfter: Math.max(0, curMonsterHp),
    });
    if (curMonsterHp <= 0) break;

    // Monster attacks
    curPlayerHp -= monsterDmg;
    turns.push({
      attacker: 'monster',
      dmg: monsterDmg,
      playerHpAfter: Math.max(0, curPlayerHp),
      monsterHpAfter: curMonsterHp,
    });
  }

  const playerWon = curMonsterHp <= 0;
  return { turns, playerWon, xpGained: playerWon ? xp : 0 };
}

// ---- Display formatting (stats computed from displayLevel) ----

const FLAVOR_TEXTS = [
  'The room is quiet... for now.',
  'Something stirs in the shadows.',
  'An eerie stillness fills the air.',
  'The room is empty... for now!',
];

function modEffectSummary(
  mod: typeof MONSTER_MODIFIERS[number] | typeof TRAP_MODIFIERS[number] | typeof TREASURE_MODIFIERS[number],
  context: 'monster' | 'trap' | 'treasure-item',
  extra?: string,
): string {
  const parts: string[] = [];
  if (context === 'monster') {
    const m = mod as typeof MONSTER_MODIFIERS[number];
    if ((m.hp_multiplier as number) !== 1) parts.push(`+${Math.round((m.hp_multiplier - 1) * 100)}% HP`);
    if ((m.damage_multiplier as number) !== 1) parts.push(`+${Math.round((m.damage_multiplier - 1) * 100)}% DMG`);
    if ((m.xp_multiplier as number) !== 1) parts.push(`+${Math.round((m.xp_multiplier - 1) * 100)}% XP reward`);
  } else if (context === 'trap') {
    const m = mod as typeof TRAP_MODIFIERS[number];
    const dmgLabel = extra === 'mana' ? 'MANA drain' : 'DMG';
    if ((m.damage_multiplier as number) !== 1) parts.push(`+${Math.round((m.damage_multiplier - 1) * 100)}% ${dmgLabel}`);
  } else {
    const m = mod as typeof TREASURE_MODIFIERS[number];
    if ('stat_multiplier' in m) {
      parts.push(`+${Math.round((m.stat_multiplier - 1) * 100)}% ${extra ?? 'stat'}`);
    } else {
      parts.push(`+${m.passive_amount} ${m.passive_effect === 'hp_per_combat_round' ? 'HP each hit' : 'mana each hit'}`);
    }
  }
  return parts.join(', ');
}

export function formatEncounter(encounter: Encounter, displayLevel: number, currentHp?: number): string[] {
  if (displayLevel === 0) {
    const idx = Math.abs(encounter.baseName.charCodeAt(0)) % FLAVOR_TEXTS.length;
    return [FLAVOR_TEXTS[idx]];
  }

  const lines: string[] = [];

  if (encounter.kind === 'monster') {
    const stats = getMonsterStats(encounter, displayLevel);
    const activeMods: typeof MONSTER_MODIFIERS[number][] = [];
    if (displayLevel >= 3) activeMods.push(encounter.mod1);
    if (displayLevel >= 6) activeMods.push(encounter.mod2);

    const title = `${ENCOUNTER_STYLE.monster.symbol} [MONSTER] ${activeMods.map(m => m.name).join(' ')} ${encounter.baseName}  Lv.${displayLevel}`.replace(/\s+/g, ' ');
    lines.push(title);
    lines.push(encounter.baseDescription);
    lines.push('');
    const displayHp = currentHp ?? stats.hp;
    lines.push(`HP: ${hpBar(displayHp, stats.hp)}  ${displayHp}`);
    lines.push(`DMG: ${stats.dmg}`);
    if (activeMods.length > 0) {
      lines.push('');
      const indent = '  ◆ ';
      const longestName = Math.max(...activeMods.map(m => m.name.length));
      const arrowPad = ' '.repeat(indent.length + longestName + 2);
      for (const mod of activeMods) {
        const fx = modEffectSummary(mod, 'monster');
        lines.push(`${indent}${mod.name.padEnd(longestName)}  — ${mod.description}`);
        if (fx) lines.push(`${arrowPad}→ ${fx}`);
      }
    }
    lines.push('');
    lines.push('REWARD');
    lines.push(`+ ${stats.xp} XP  on defeat`);

  } else if (encounter.kind === 'trap') {
    const stats = getTrapStats(encounter, displayLevel);
    const activeMods: typeof TRAP_MODIFIERS[number][] = [];
    if (displayLevel >= 3) activeMods.push(encounter.mod1);
    if (displayLevel >= 6) activeMods.push(encounter.mod2);

    const typeLabel = encounter.trapType === 'magical' ? 'MAGICAL TRAP' : 'TRAP';
    const title = `${ENCOUNTER_STYLE.trap.symbol} [${typeLabel}] ${activeMods.map(m => m.name).join(' ')} ${encounter.baseName}  Lv.${displayLevel}`.replace(/\s+/g, ' ');
    lines.push(title);
    lines.push(encounter.baseDescription);
    if (activeMods.length > 0) {
      const indent = '  ◆ ';
      const longestName = Math.max(...activeMods.map(m => m.name.length));
      const arrowPad = ' '.repeat(indent.length + longestName + 2);
      for (const mod of activeMods) {
        const fx = modEffectSummary(mod, 'trap', encounter.damageType);
        lines.push(`${indent}${mod.name.padEnd(longestName)}  — ${mod.description}`);
        if (fx) lines.push(`${arrowPad}→ ${fx}`);
      }
    }
    lines.push('');
    if (encounter.damageType === 'hp') {
      lines.push(`DMG: ${stats.dmg}`);
    } else {
      lines.push(`DRAIN: ${stats.dmg}`);
    }
    lines.push('');
    lines.push('REWARD');
    const rewardLabel = stats.rewardType === 'xp' ? 'XP' : 'MANA';
    lines.push(`+ ${stats.reward} ${rewardLabel}  on disarm`);

  } else if (encounter.subKind === 'item') {
    const rawStat = encounter.baseStat + (displayLevel - 1) * encounter.statGrowth;

    let totalMult = 1;
    const passiveEffects: string[] = [];
    const activeMods: typeof TREASURE_MODIFIERS[number][] = [];

    const applyMod = (mod: typeof TREASURE_MODIFIERS[number]) => {
      activeMods.push(mod);
      if ('stat_multiplier' in mod) {
        totalMult *= mod.stat_multiplier;
      } else {
        passiveEffects.push(`+${mod.passive_amount} ${mod.passive_effect === 'hp_per_combat_round' ? 'HP each hit' : 'MANA each hit'}`);
      }
    };
    if (displayLevel >= 3) applyMod(encounter.mod1);
    if (displayLevel >= 6) applyMod(encounter.mod2);

    const title = `${ENCOUNTER_STYLE.treasure.symbol} [TREASURE] ${activeMods.map(m => m.name).join(' ')} ${encounter.baseName}  Lv.${displayLevel}`.replace(/\s+/g, ' ');
    lines.push(title);
    lines.push(encounter.baseDescription);
    if (activeMods.length > 0) {
      const indent = '  ◆ ';
      const longestName = Math.max(...activeMods.map(m => m.name.length));
      const arrowPad = ' '.repeat(indent.length + longestName + 2); // +2 for "  " before "—"
      for (const mod of activeMods) {
        const fx = modEffectSummary(mod, 'treasure-item', encounter.statType);
        lines.push(`${indent}${mod.name.padEnd(longestName)}  — ${mod.description}`);
        if (fx) lines.push(`${arrowPad}→ ${fx}`);
      }
    }
    lines.push('');
    const statLine = `+${round(rawStat * totalMult)} ${encounter.statType.toUpperCase()}`;
    const extras = passiveEffects.length > 0 ? `   ${passiveEffects.join('  ')}` : '';
    lines.push(statLine + extras);

  } else {
    // consumable or immediate
    const amount = encounter.baseAmount + (displayLevel - 1) * encounter.amountGrowth;
    const title = `${ENCOUNTER_STYLE.treasure.symbol} [TREASURE] ${encounter.baseName}  Lv.${displayLevel}`;
    lines.push(title);
    lines.push(encounter.baseDescription);
    lines.push('');
    if (encounter.subKind === 'consumable') {
      lines.push(`${effectLabel(encounter.effect, amount)} on use`);
    } else {
      lines.push(`${effectLabel(encounter.effect, amount)} on loot`);
    }
  }

  return lines;
}
