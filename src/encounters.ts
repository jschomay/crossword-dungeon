import { hpBar } from './utils';
import { MONSTER_TYPES, MONSTER_MODIFIERS } from './data/monsters';
import { TRAP_TYPES, TRAP_MODIFIERS } from './data/traps';
import { TREASURE_IMMEDIATE } from './data/treasures';

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
  baseDef: number;
  defGrowth: number;
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

export type TrapSideEffects = {
  manaDrain: number;
  maxHpReduce: number;
  maxManaReduce: number;
};

export type TreasureItemEncounter = {
  kind: 'treasure';
  subKind: 'item';
  baseName: string;
  baseDescription: string;
  slot: 'weapon' | 'armor' | 'amulet';
  statType: 'damage' | 'defense' | 'max_hp' | 'max_mana';
  baseStat: number;
  statGrowth: number;
};

export type TreasureImmediateEncounter = {
  kind: 'treasure';
  subKind: 'immediate';
  baseName: string;
  baseDescription: string;
  effect: 'restore_hp' | 'restore_mana' | 'grant_xp' | 'grant_gold';
  baseAmount: number;
  amountGrowth: number;
};

export type TreasureEncounter =
  | TreasureItemEncounter
  | TreasureImmediateEncounter;

export type Encounter = MonsterEncounter | TrapEncounter | TreasureEncounter;

// ---- Encounter style (symbol + color per kind) ----

export const UNKNOWN_COLOR = '#888888';  // unactivated room '?' and flavor text
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
    case 'restore_hp':   return `+${amount} HP`;
    case 'restore_mana': return `+${amount} MANA`;
    case 'grant_xp':     return `+${amount} XP`;
    case 'grant_gold':   return `+${amount} GOLD`;
    default:             return `${effect}: ${amount}`;
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
    baseDef: base.base_def,
    defGrowth: base.def_growth,
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
  puzzleMult: number = 1,
): { hp: number; dmg: number; def: number; xp: number; manaDrain: number } {
  const baseHp  = enc.baseHp  + (level - 1) * enc.hpGrowth;
  const baseDmg = enc.baseDamage + (level - 1) * enc.damageGrowth;
  const baseDef = enc.baseDef + (level - 1) * enc.defGrowth;
  const baseXp  = enc.baseXp  + (level - 1) * enc.xpGrowth;
  let hpBonus = 0, dmgBonus = 0, defBonus = 0, manaDrain = 0;
  const applyMod = (mod: typeof MONSTER_MODIFIERS[number]) => {
    hpBonus   += mod.hp_bonus;
    dmgBonus  += mod.dmg_bonus;
    defBonus  += mod.def_bonus;
    manaDrain += mod.mana_drain;
  };
  if (level >= 3) applyMod(enc.mod1);
  if (level >= 6) applyMod(enc.mod2);
  return {
    hp:  round((baseHp  + hpBonus)  * puzzleMult),
    dmg: round((baseDmg + dmgBonus) * puzzleMult),
    def: round((baseDef + defBonus) * puzzleMult),
    xp:  round(baseXp),
    manaDrain,
  };
}

export function getTrapStats(
  enc: TrapEncounter,
  level: number,
  puzzleMult: number = 1,
): { dmg: number; reward: number; rewardType: 'xp' | 'mana'; sideEffects: TrapSideEffects } {
  const baseDmg    = enc.baseDamage + (level - 1) * enc.damageGrowth;
  const baseReward = enc.baseReward + (level - 1) * enc.rewardGrowth;
  let dmgBonus = 0;
  const sideEffects: TrapSideEffects = { manaDrain: 0, maxHpReduce: 0, maxManaReduce: 0 };
  const applyMod = (mod: typeof TRAP_MODIFIERS[number]) => {
    dmgBonus                  += mod.dmg_bonus;
    sideEffects.manaDrain     += mod.mana_drain;
    sideEffects.maxHpReduce   += mod.max_hp_reduce;
    sideEffects.maxManaReduce += mod.max_mana_reduce;
  };
  if (level >= 3) applyMod(enc.mod1);
  if (level >= 6) applyMod(enc.mod2);
  return {
    dmg: round((baseDmg + dmgBonus) * puzzleMult),
    reward: round(baseReward),
    rewardType: enc.rewardType,
    sideEffects,
  };
}

export type TreasureItemStats = {
  slot: 'weapon' | 'armor' | 'amulet';
  name: string;
  level: number;
  statType: 'damage' | 'defense' | 'max_hp' | 'max_mana';
  baseStat: number;  // primary stat before mod bonuses, for display
  modNames: string[];
  damageBonus: number;
  defenseBonus: number;
  maxHpBonus: number;
  maxManaBonus: number;
  hpPerRound: number;
  manaPerRound: number;
};


export function getTreasureItemStats(enc: TreasureItemEncounter, level: number): TreasureItemStats {
  let stat = round(enc.baseStat + (level - 1) * enc.statGrowth);
  return {
    slot: enc.slot,
    name: enc.baseName,
    level,
    statType: enc.statType,
    baseStat: stat,
    modNames: [],
    damageBonus:  enc.statType === 'damage'   ? stat : 0,
    defenseBonus: enc.statType === 'defense'  ? stat : 0,
    maxHpBonus:   enc.statType === 'max_hp'   ? stat : 0,
    maxManaBonus: enc.statType === 'max_mana' ? stat : 0,
    hpPerRound: 0,
    manaPerRound: 0,
  };
}

// ---- Combat resolution (pure, no side effects) ----

export type CombatPlayerStats = {
  dmg: number;
  hp: number;
  maxHp?: number;
  def?: number;
  hpPerRound?: number;
  manaPerRound?: number;
};

export type CombatMonsterStats = {
  dmg: number;
  hp: number;
  def: number;
  xp: number;
  manaDrain: number;
};

export type CombatTurn = {
  attacker: 'player' | 'monster';
  dmg: number;
  playerHpAfter: number;
  monsterHpAfter: number;
  manaGained: number;
  manaDrained: number;
  playerManaAfter: number;
};

export type CombatResult = {
  turns: CombatTurn[];
  playerWon: boolean;
  manaGameOver: boolean;
  xpGained: number;
};

export function resolveCombat(
  player: CombatPlayerStats & { mana?: number; maxMana?: number },
  monster: CombatMonsterStats,
): CombatResult {
  const { dmg: playerDmg, hp: playerHp, maxHp: playerMaxHp, def: playerDef = 0, hpPerRound = 0, manaPerRound = 0, mana: startMana = Infinity, maxMana: playerMaxMana } = player;
  const hpCap = playerMaxHp ?? playerHp;
  const manaCap = playerMaxMana ?? Infinity;
  const { dmg: monsterDmg, hp: monsterHp, def: monsterDef = 0, xp, manaDrain = 0 } = monster;
  const turns: CombatTurn[] = [];
  let curPlayerHp = playerHp;
  let curMonsterHp = monsterHp;
  let curMana = startMana;
  const effectivePlayerDmg  = Math.max(1, playerDmg - monsterDef);
  const effectiveMonsterDmg = Math.max(0, monsterDmg - playerDef);

  while (curPlayerHp > 0 && curMonsterHp > 0 && curMana > 0) {
    // Player attacks first (reduced by monster def, minimum 1); passive regen on hit
    curMonsterHp -= effectivePlayerDmg;
    curPlayerHp = Math.min(hpCap, curPlayerHp + hpPerRound);
    curMana = Math.min(manaCap, curMana + manaPerRound);
    turns.push({
      attacker: 'player',
      dmg: effectivePlayerDmg,
      playerHpAfter: curPlayerHp,
      monsterHpAfter: Math.max(0, curMonsterHp),
      manaGained: manaPerRound,
      manaDrained: 0,
      playerManaAfter: curMana,
    });
    if (curMonsterHp <= 0) break;

    // Monster attacks (reduced by player def); leech drains mana
    curPlayerHp -= effectiveMonsterDmg;
    curMana = Math.max(0, curMana - manaDrain);
    turns.push({
      attacker: 'monster',
      dmg: effectiveMonsterDmg,
      playerHpAfter: Math.max(0, curPlayerHp),
      monsterHpAfter: curMonsterHp,
      manaGained: 0,
      manaDrained: manaDrain,
      playerManaAfter: curMana,
    });
  }

  const playerWon = curMonsterHp <= 0;
  const manaGameOver = !playerWon && curMana <= 0 && curPlayerHp > 0;
  return { turns, playerWon, manaGameOver, xpGained: playerWon ? xp : 0 };
}

// ---- Display formatting (stats computed from displayLevel) ----

const FLAVOR_TEXTS = [
  'The room is quiet... for now.',
  'Something stirs in the shadows.',
  'An eerie stillness fills the air.',
  'The room is empty... for now!',
];

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
    if (activeMods.length > 0) {
      for (const mod of activeMods) {
        lines.push(`◆ ${mod.name}  — ${mod.description}`);
      }
    }
    lines.push('');
    const displayHp = currentHp ?? stats.hp;
    lines.push(`HP: ${hpBar(displayHp, stats.hp)}  ${displayHp}`);
    lines.push(`DMG: ${stats.dmg}`);
    if (stats.def      > 0) lines.push(`DEF: ${stats.def}`);
    if (stats.manaDrain > 0) lines.push(`-${stats.manaDrain} MANA on hit`);
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
      for (const mod of activeMods) {
        lines.push(`◆ ${mod.name}  — ${mod.description}`);
      }
    }
    lines.push('');
    if (encounter.damageType === 'hp') {
      lines.push(`DMG: ${stats.dmg}`);
    } else {
      lines.push(`DRAIN: ${stats.dmg}`);
    }
    if (stats.sideEffects.manaDrain    > 0) lines.push(`-${stats.sideEffects.manaDrain} MANA`);
    if (stats.sideEffects.maxHpReduce  > 0) lines.push(`-${stats.sideEffects.maxHpReduce} max HP`);
    if (stats.sideEffects.maxManaReduce > 0) lines.push(`-${stats.sideEffects.maxManaReduce} max MANA`);
    lines.push('');
    lines.push('REWARD');
    const rewardLabel = stats.rewardType === 'xp' ? 'XP' : 'MANA';
    lines.push(`+ ${stats.reward} ${rewardLabel}  on disarm`);

  } else if (encounter.subKind === 'immediate') {
    const amount = encounter.baseAmount + (displayLevel - 1) * encounter.amountGrowth;
    const title = `${ENCOUNTER_STYLE.treasure.symbol} [TREASURE] ${encounter.baseName}  Lv.${displayLevel}`;
    lines.push(title);
    lines.push(encounter.baseDescription);
    lines.push('');
    lines.push(`${effectLabel(encounter.effect, amount)} on loot`);
  }

  return lines;
}
