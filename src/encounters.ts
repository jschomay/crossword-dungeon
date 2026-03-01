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
    case 'restore_hp': return `Restores ${amount} HP`;
    case 'restore_mana': return `Restores ${amount} mana`;
    case 'increase_max_hp': return `+${amount} max HP`;
    case 'increase_max_mana': return `+${amount} max mana`;
    case 'grant_xp': return `Grants ${amount} XP`;
    case 'reveal_letter': return amount === 1 ? 'Reveals 1 letter' : `Reveals ${amount} letters`;
    default: return `${effect}: ${amount}`;
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

// ---- Display formatting (stats computed from displayLevel) ----

const FLAVOR_TEXTS = [
  'The room is quiet... for now.',
  'Something stirs in the shadows.',
  'An eerie stillness fills the air.',
  'The room is empty... for now!',
];

export function formatEncounter(encounter: Encounter, displayLevel: number): string[] {
  if (displayLevel === 0) {
    // activatedLevel 0 — reveal nothing yet
    const idx = Math.abs(encounter.baseName.charCodeAt(0)) % FLAVOR_TEXTS.length;
    return [FLAVOR_TEXTS[idx]];
  }

  const lines: string[] = [];

  if (encounter.kind === 'monster') {
    const rawHp = encounter.baseHp + displayLevel * encounter.hpGrowth;
    const rawDmg = encounter.baseDamage + displayLevel * encounter.damageGrowth;
    const rawXp = encounter.baseXp + displayLevel * encounter.xpGrowth;

    let hpMult = 1, dmgMult = 1, xpMult = 1;
    const activeModifiers: string[] = [];
    if (displayLevel >= 3) {
      hpMult *= encounter.mod1.hp_multiplier;
      dmgMult *= encounter.mod1.damage_multiplier;
      xpMult *= encounter.mod1.xp_multiplier;
      activeModifiers.push(encounter.mod1.name);
    }
    if (displayLevel >= 6) {
      hpMult *= encounter.mod2.hp_multiplier;
      dmgMult *= encounter.mod2.damage_multiplier;
      xpMult *= encounter.mod2.xp_multiplier;
      activeModifiers.push(encounter.mod2.name);
    }

    const nameParts = [...activeModifiers, encounter.baseName];
    lines.push(`[MONSTER] Level ${displayLevel}`);
    lines.push(nameParts.join(' '));
    lines.push(activeModifiers.length > 0
      ? `${activeModifiers.join(', ')} — ${encounter.baseDescription}`
      : encounter.baseDescription);
    lines.push(`HP: ${round(rawHp * hpMult)}  DMG: ${round(rawDmg * dmgMult)}  XP: ${round(rawXp * xpMult)}`);

  } else if (encounter.kind === 'trap') {
    const rawDmg = encounter.baseDamage + displayLevel * encounter.damageGrowth;
    const rawReward = encounter.baseReward + displayLevel * encounter.rewardGrowth;

    let dmgMult = 1, rewardMult = 1;
    const activeModifiers: string[] = [];
    if (displayLevel >= 3) {
      dmgMult *= encounter.mod1.damage_multiplier;
      rewardMult *= encounter.mod1.reward_multiplier;
      activeModifiers.push(encounter.mod1.name);
    }
    if (displayLevel >= 6) {
      dmgMult *= encounter.mod2.damage_multiplier;
      rewardMult *= encounter.mod2.reward_multiplier;
      activeModifiers.push(encounter.mod2.name);
    }

    const nameParts = [...activeModifiers, encounter.baseName];
    const typeLabel = encounter.trapType === 'magical' ? 'MAGICAL TRAP' : 'TRAP';
    lines.push(`[${typeLabel}] Level ${displayLevel}`);
    lines.push(nameParts.join(' '));
    lines.push(activeModifiers.length > 0
      ? `${activeModifiers.join(', ')} — ${encounter.baseDescription}`
      : encounter.baseDescription);
    const dmgLabel = encounter.damageType === 'hp' ? 'DMG' : 'Mana DMG';
    const rewardLabel = encounter.rewardType === 'xp' ? 'XP' : 'Mana';
    lines.push(`${dmgLabel}: ${round(rawDmg * dmgMult)}  ${rewardLabel}: ${round(rawReward * rewardMult)}`);

  } else if (encounter.subKind === 'item') {
    const rawStat = encounter.baseStat + displayLevel * encounter.statGrowth;

    const statMultipliers: number[] = [];
    const passiveEffects: string[] = [];
    const activeModifiers: string[] = [];

    const applyMod = (mod: typeof TREASURE_MODIFIERS[number]) => {
      activeModifiers.push(mod.name);
      if ('stat_multiplier' in mod) {
        statMultipliers.push(mod.stat_multiplier);
      } else {
        passiveEffects.push(`+${mod.passive_amount} ${mod.passive_effect === 'hp_per_combat_round' ? 'HP/round' : 'mana/round'}`);
      }
    };
    if (displayLevel >= 3) applyMod(encounter.mod1);
    if (displayLevel >= 6) applyMod(encounter.mod2);

    const totalMult = statMultipliers.reduce((a, b) => a * b, 1);
    const nameParts = [...activeModifiers, encounter.baseName];
    lines.push(`[TREASURE] Level ${displayLevel}`);
    lines.push(nameParts.join(' '));
    lines.push(activeModifiers.length > 0
      ? `${activeModifiers.join(', ')} — ${encounter.baseDescription}`
      : encounter.baseDescription);
    lines.push(`${encounter.slot.toUpperCase()} +${round(rawStat * totalMult)} ${encounter.statType}`);
    for (const pe of passiveEffects) lines.push(pe);

  } else {
    // consumable or immediate
    const amount = encounter.baseAmount + displayLevel * encounter.amountGrowth;
    lines.push(`[TREASURE] Level ${displayLevel}`);
    lines.push(encounter.baseName);
    lines.push(encounter.baseDescription);
    if (encounter.subKind === 'consumable') {
      lines.push(`Consumable: ${effectLabel(encounter.effect, amount)}`);
    } else {
      lines.push(`On solve: ${effectLabel(encounter.effect, amount)}`);
    }
  }

  return lines;
}
