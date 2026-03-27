import * as ROT from '../lib/rotjs';
import { hpBar, esc, renderEncounterHtml, C_HP, C_MANA, C_DMG, C_DEF, C_XP, C_DIM } from './utils';
import { validateIpuz, selectWords, buildSparseIpuz, getIntoneWord, getEligibleWordCount } from './puzzle';
import { consumeProgression, fetchPuzzle, getOverridePuzzle, isTutorial, completeTutorial } from './progression';
import Puzzle from './puzzle';
import Dungeon from './dungeon';
import {
  generateEncounter,
  formatEncounter,
  getMonsterStats,
  getTrapStats,
  getTreasureItemStats,
  resolveCombat,
  ENCOUNTER_STYLE,
  UNKNOWN_COLOR,
  type Encounter,
  type MonsterEncounter,
  type TrapEncounter,
  type TreasureEncounter,
  type TreasureItemStats,
  type Rng,
} from './encounters';
import { TREASURE_ITEMS, TREASURE_MODIFIERS } from './data/treasures';

const KEY_DIRS: Record<string, { dx: number; dy: number }> = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
};

type RoomState = {
  activatedLevel: number;
  solvedLetter: string | null;
  encounter: Encounter;
  incorrectGuesses: string[];
};

function roomKey(x: number, y: number): string {
  return `${x},${y}`;
}

const VIEWPORT_W = 43;
const VIEWPORT_H = 43;

const BASE_MANA = 20;
const BASE_HP = 50;
const BASE_DMG = 10;
const XP_PER_LEVEL = 100;
const BASE_WORD_COUNT = 10;
const WORD_COUNT_STEP = 2;
const MAX_WORD_COUNT = 20;

// ---- Inventory list rendering ----

function modEffectLabel(mod: typeof TREASURE_MODIFIERS[number]): string {
  if ('stat_multiplier' in mod) return `+${Math.round((mod.stat_multiplier - 1) * 100)}% base stat`;
  if ('passive_effect' in mod) return mod.passive_effect === 'hp_per_combat_round' ? `+${mod.passive_amount} HP/hit` : `+${mod.passive_amount} MANA/hit`;
  return mod.bonus_effect === 'max_hp' ? `+${mod.bonus_amount} max HP` : `+${mod.bonus_amount} max MANA`;
}

function baseStatLabel(item: TreasureItemStats): string {
  switch (item.statType) {
    case 'damage':   return `(+${item.baseStat} DMG)`;
    case 'defense':  return `(+${item.baseStat} DEF)`;
    case 'max_hp':   return `(+${item.baseStat} max HP)`;
    case 'max_mana': return `(+${item.baseStat} max MANA)`;
  }
}

function equipLines(item: TreasureItemStats): string[] {
  const lines = [`◆ ${item.name}  Lv.${item.level}  ${baseStatLabel(item)}`];
  for (const modName of item.modNames) {
    const mod = TREASURE_MODIFIERS.find(m => m.name === modName);
    if (mod) lines.push(`  ${mod.name} — ${mod.description} (${modEffectLabel(mod)})`);
    else lines.push(`  ${modName}`);
  }
  return lines;
}


type Equipped = {
  weapon: TreasureItemStats | null;
  armor: TreasureItemStats | null;
  amulet: TreasureItemStats | null;
};

export default class Game {
  display!: ROT.Display;
  private puzzle!: Puzzle;
  private dungeon!: Dungeon;
  private playerPos!: { x: number; y: number };
  private heroEl: HTMLElement;
  private dungeonLevelEl: HTMLElement;
  private statusEl: HTMLElement;
  private cluesEl: HTMLElement;
  private encounterEl: HTMLElement;
  private dungeonEl: HTMLElement;
  private interactionLogEl: HTMLElement;
  private helpOverlayEl: HTMLElement;
  private combatMonsterHp: number | null = null;
  private prevHp: number = BASE_HP;
  private maxMana: number = BASE_MANA;
  private prevMana: number = BASE_MANA;
  private prevDmg: number = BASE_DMG;
  private prevDef: number = 0;
  private prevXp: number = 0;
  private prevLevel: number = 1;
  private prevCombatMonsterHp: number | null = null;
  private roomStates: Map<string, RoomState> = new Map();
  private mana: number = BASE_MANA;
  private hp: number = BASE_HP;
  private maxHp: number = BASE_HP;
  private dmg: number = BASE_DMG;
  private level: number = 1;
  private xp: number = 0;
  private gameOver: boolean = false;
  private gameOverReason: 'hp' | 'mana' | null = null;
  private puzzleComplete: boolean = false;
  private dungeonLevel: number = 1;
  private totalRooms: number = 0;
  private combatRunning: boolean = false;
  private pulseRunning: boolean = false;
  private showMap: boolean = false;
  private equipped: Equipped = { weapon: null, armor: null, amulet: null };
  private gold: number = 0;
  private hpPotions: number = 1;
  private manaPotions: number = 2;
  private revealScrolls: number = 3;
  private intoneScrolls: number = 3;
  private shopPos: { x: number; y: number } | null = null;
  private shopItem: TreasureItemStats | null = null;       // one-time equipment offer
  private shopModTarget: TreasureItemStats | null = null;  // item to receive modifier
  private shopModifier: typeof TREASURE_MODIFIERS[number] | null = null;

  private fullIpuz!: ReturnType<typeof validateIpuz>;

  private readonly TILT_SCALE = 1.22;

  private calcFontSize(): number {
    const availW = (window.innerWidth * 0.6 - 12 - 24) / this.TILT_SCALE;
    const availH = (window.innerHeight - 24) / this.TILT_SCALE;
    const w = this.showMap ? this.dungeon.displayWidth : VIEWPORT_W;
    const h = this.showMap ? this.dungeon.displayHeight : VIEWPORT_H;
    return Math.max(4, Math.floor(Math.min(availW / w, availH / h)));
  }

  private wordCount(): number {
    return Math.min(MAX_WORD_COUNT, BASE_WORD_COUNT + (this.dungeonLevel - 1) * WORD_COUNT_STEP);
  }

  private puzzleMult(): number {
    return 1 + (this.dungeonLevel - 1) * 0.3;
  }

  private async regenDungeon(): Promise<void> {
    this.dungeonEl.innerHTML = '<p class="loading">Loading...</p>';
    const { puzzleNumber, parityFlip } = consumeProgression();
    this.fullIpuz = await fetchPuzzle(puzzleNumber);
    const target = this.wordCount();
    const isOverride = !!getOverridePuzzle() || isTutorial();
    let parityOffset: 0 | 1 = (isOverride || parityFlip) ? 1 : 0;
    let selected: Set<string> = new Set();
    let seedIndex = 0;
    while (selected.size < target) {
      const eligibleCount = getEligibleWordCount(this.fullIpuz, parityOffset);
      if (seedIndex < eligibleCount) {
        const candidate = selectWords(this.fullIpuz, target, Math.random, parityOffset, seedIndex);
        if (candidate.size > selected.size) selected = candidate;
        seedIndex++;
        if (isOverride && seedIndex >= eligibleCount) break; // accept best effort for overrides
      } else {
        // Exhausted all seeds for this puzzle/parity — advance progression and try next
        const next = consumeProgression();
        this.fullIpuz = await fetchPuzzle(next.puzzleNumber);
        parityOffset = next.parityFlip ? 1 : 0;
        seedIndex = 0;
      }
    }
    const ipuz = buildSparseIpuz(this.fullIpuz, selected);
    this.puzzle = new Puzzle(ipuz);
    this.shopPos = this.pickShopPos();
    this.shopItem = null;
    this.shopModTarget = null;
    this.shopModifier = null;
    this.dungeon = new Dungeon(this.puzzle, this.shopPos);
    this.totalRooms = this.puzzle.getRooms().length;
    this.dungeonEl.innerHTML = '';
    this.showMap = false;
    this.display = new ROT.Display({
      width: VIEWPORT_W,
      height: VIEWPORT_H,
      fontSize: this.calcFontSize(),
      forceSquareRatio: true,
    });
    this.dungeonEl.appendChild(this.display.getContainer()!);
  }

  private constructor() {
    this.dungeonEl = document.getElementById('dungeon')!;
    this.heroEl = document.getElementById('hero')!;
    this.dungeonLevelEl = document.getElementById('dungeon-level')!;
    this.statusEl = document.getElementById('status')!;
    this.cluesEl = document.getElementById('clues')!;
    this.encounterEl = document.getElementById('encounter')!;
    this.interactionLogEl = document.getElementById('interaction-log')!;
    this.helpOverlayEl = document.getElementById('help-overlay')!;
  }

  private applyDisplaySize(): void {
    this.display.setOptions({
      width: this.showMap ? this.dungeon.displayWidth : VIEWPORT_W,
      height: this.showMap ? this.dungeon.displayHeight : VIEWPORT_H,
      fontSize: this.calcFontSize(),
    });
  }

  static async create(): Promise<Game> {
    const game = new Game();
    await game.regenDungeon();
    window.addEventListener('resize', () => {
      game.applyDisplaySize();
      game.render();
    });
    game.applyTilt();
    game.initRoomStates();
    game.playerPos = ROT.RNG.getItem(game.puzzle.getRooms())!;
    if (getOverridePuzzle() === 'debug') game.gold = 3000;
    game.render();
    if (isTutorial() || getOverridePuzzle() === 'tutorial') game.showHelp();
    window.addEventListener('keydown', (e) => game.handleKey(e));
    return game;
  }

  private applyTilt(): void {
    const sign = ROT.RNG.getUniform() < 0.5 ? 1 : -1;
    const rotation = (sign * (5 + ROT.RNG.getUniform() * 2 - 1)).toFixed(2);
    this.dungeonEl.style.setProperty('--dungeon-rotation', `${rotation}deg`);
  }

  private makeRng(): Rng {
    return {
      getItem: <T>(arr: readonly T[]) => ROT.RNG.getItem([...arr]) as T,
      shuffle: <T>(arr: readonly T[]) => ROT.RNG.shuffle([...arr]) as T[],
    };
  }

  private initRoomStates(): void {
    this.roomStates = new Map();
    const rng = this.makeRng();
    for (const { x, y } of this.puzzle.getRooms()) {
      this.roomStates.set(roomKey(x, y), {
        activatedLevel: 0,
        solvedLetter: null,
        encounter: generateEncounter(rng),
        incorrectGuesses: [],
      });
    }

    // Pre-solve occurrences of N random letters, where N = dungeon level
    const rooms = this.puzzle.getRooms();
    const letters = rooms.map(({ x, y }) => (this.puzzle.ipuz.solution[y][x] as string)).filter(Boolean);
    const unique = rng.shuffle([...new Set(letters)]).slice(0, this.dungeonLevel);
    for (const { x, y } of rooms) {
      if (unique.includes(this.puzzle.ipuz.solution[y][x] as string)) {
        this.getRoomState(x, y).solvedLetter = this.puzzle.ipuz.solution[y][x] as string;
      }
    }

    this.generateShopInventory();
  }

  private pickShopPos(): { x: number; y: number } | null {
    const rooms = this.puzzle.getRooms();
    const { width, height } = this.puzzle.ipuz.dimensions;
    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
    // Collect all candidate cells: adjacent to a room, not already a room, within bounds
    const candidates: { x: number; y: number }[] = [];
    const roomSet = new Set(rooms.map(r => `${r.x},${r.y}`));
    for (const { x, y } of rooms) {
      for (const { dx, dy } of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (roomSet.has(`${nx},${ny}`)) continue;
        if (!candidates.find(c => c.x === nx && c.y === ny)) {
          // Check this cell is not a puzzle letter (already verified above) and not '#'
          const v = this.puzzle.ipuz.solution[ny]?.[nx];
          if (v === null || v === '#') candidates.push({ x: nx, y: ny });
        }
      }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private generateShopInventory(): void {
    const rng = this.makeRng();
    // Random equipment item — no mods, computed at dungeonLevel
    const base = rng.getItem(TREASURE_ITEMS);
    let statType: import('./encounters').TreasureItemEncounter['statType'];
    let baseStat: number;
    let statGrowth: number;
    if ('base_damage_bonus' in base) {
      statType = 'damage'; baseStat = base.base_damage_bonus; statGrowth = base.damage_bonus_growth;
    } else if ('base_defense_bonus' in base) {
      statType = 'defense'; baseStat = base.base_defense_bonus; statGrowth = base.defense_bonus_growth;
    } else if ('base_max_hp_bonus' in base) {
      statType = 'max_hp'; baseStat = base.base_max_hp_bonus; statGrowth = base.max_hp_bonus_growth;
    } else {
      statType = 'max_mana'; baseStat = base.base_max_mana_bonus; statGrowth = base.max_mana_bonus_growth;
    }
    const itemEnc: import('./encounters').TreasureItemEncounter = {
      kind: 'treasure', subKind: 'item',
      baseName: base.name, baseDescription: base.description,
      slot: base.slot, statType, baseStat, statGrowth,
    };
    this.shopItem = getTreasureItemStats(itemEnc, this.dungeonLevel);

    // Random modifier upgrade — pick an equipped item that still has at least one mod it doesn't already have
    const equipped = [this.equipped.weapon, this.equipped.armor, this.equipped.amulet].filter((i): i is TreasureItemStats => i !== null);
    this.shopModTarget = null;
    this.shopModifier = null;
    if (equipped.length > 0) {
      const candidates = equipped.filter(i => TREASURE_MODIFIERS.some(m => !i.modNames.includes(m.name)));
      if (candidates.length > 0) {
        const target = rng.getItem(candidates);
        const availableMods = TREASURE_MODIFIERS.filter(m => !target.modNames.includes(m.name));
        this.shopModTarget = target;
        this.shopModifier = rng.getItem(availableMods);
      }
    }
  }

  private async restart(): Promise<void> {
    this.dungeonLevel = 1;
    this.equipped = { weapon: null, armor: null, amulet: null };
    await this.regenDungeon();
    this.initRoomStates();
    this.mana = BASE_MANA;
    this.maxMana = BASE_MANA;
    this.hp = BASE_HP;
    this.maxHp = BASE_HP;
    this.dmg = BASE_DMG;
    this.level = 1;
    this.xp = 0;
    this.gold = 0;
    this.hpPotions = 1;
    this.manaPotions = 2;
    this.revealScrolls = 3;
    this.intoneScrolls = 3;
    this.gameOver = false;
    this.puzzleComplete = false;
    this.combatRunning = false;
    this.combatMonsterHp = null;
    this.gameOverReason = null;
    this.playerPos = ROT.RNG.getItem(this.puzzle.getRooms())!;
    this.applyTilt();
    this.clearLogs();
    this.render();
  }

  private async advancePuzzle(): Promise<void> {
    if (isTutorial()) completeTutorial();
    this.gold += this.dungeonLevel * 100;
    this.dungeonLevel++;
    await this.regenDungeon();
    this.initRoomStates();
    this.puzzleComplete = false;
    this.combatRunning = false;
    this.combatMonsterHp = null;
    this.playerPos = ROT.RNG.getItem(this.puzzle.getRooms())!;
    this.applyTilt();
    this.clearLogs();
    this.render();
  }

  private getRoomState(x: number, y: number): RoomState {
    return this.roomStates.get(roomKey(x, y))!;
  }

  private countSolved(): number {
    let count = 0;
    for (const state of this.roomStates.values()) {
      if (state.solvedLetter !== null) count++;
    }
    return count;
  }

  // ---- Effective stat helpers ----

  private effectiveDmg(): number {
    return this.dmg
      + (this.equipped.weapon?.damageBonus ?? 0)
      + (this.equipped.amulet?.damageBonus ?? 0);
  }

  private effectiveDef(): number {
    return (this.equipped.armor?.defenseBonus ?? 0)
      + (this.equipped.amulet?.defenseBonus ?? 0);
  }

  private effectiveMaxHp(): number {
    return this.maxHp + (this.equipped.amulet?.maxHpBonus ?? 0);
  }

  private effectiveMaxMana(): number {
    return this.maxMana + (this.equipped.amulet?.maxManaBonus ?? 0);
  }

  // ---- Inventory ----

  private equipItem(item: TreasureItemStats): void {
    this.equipped[item.slot] = item;
    // Cap current HP/mana in case effective max decreased
    this.hp = Math.min(this.hp, this.effectiveMaxHp());
    this.mana = Math.min(this.mana, this.effectiveMaxMana());
  }

  private itemStatLines(item: TreasureItemStats): string[] {
    const lines: string[] = [];
    if (item.damageBonus > 0) lines.push(`+${item.damageBonus} DMG`);
    if (item.defenseBonus > 0) lines.push(`+${item.defenseBonus} DEF`);
    if (item.maxHpBonus > 0) lines.push(`+${item.maxHpBonus} max HP`);
    if (item.maxManaBonus > 0) lines.push(`+${item.maxManaBonus} max MANA`);
    return lines;
  }

  private useConsumable(slot: 1 | 2 | 3 | 4): void {
    if (this.combatRunning) return;

    if (slot === 1) {
      if (this.hpPotions <= 0) { this.showInteraction([`No Heal potions remaining.`]); this.render(); return; }
      this.hpPotions--;
      const restored = Math.min(20, this.effectiveMaxHp() - this.hp);
      this.hp = Math.min(this.hp + 20, this.effectiveMaxHp());
      this.showInteraction([`Heal used.`, `  +${restored} HP`]);
    } else if (slot === 2) {
      if (this.manaPotions <= 0) { this.showInteraction([`No Restore potions remaining.`]); this.render(); return; }
      this.manaPotions--;
      const restored = Math.min(10, this.effectiveMaxMana() - this.mana);
      this.mana = Math.min(this.mana + 10, this.effectiveMaxMana());
      this.showInteraction([`Restore used.`, `  +${restored} MANA`]);
    } else if (slot === 3) {
      if (this.revealScrolls <= 0) { this.showInteraction([`No Inscribe scrolls remaining.`]); this.render(); return; }
      const { x, y } = this.playerPos;
      if (!this.dungeon.hasRoom(x, y)) return;
      const state = this.getRoomState(x, y);
      if (state.solvedLetter !== null) { this.showInteraction([`These runes are already known to you.`]); this.render(); return; }
      this.revealScrolls--;
      const letter = this.puzzle.ipuz.solution[y][x] as string;
      this.markRoomSolved(x, y, letter);
      this.checkPuzzleComplete();
      this.showInteraction([`You inscribe the '${letter}' rune. It burns into the stone.`]);
      if (this.mana === 0 && !this.puzzleComplete) this.triggerManaGameOver();
      else this.render();
      return;
    } else if (slot === 4) {
      const { x, y } = this.playerPos;
      if (this.intoneScrolls <= 0) {
        this.showInteraction([`No Intone scrolls remaining.`]);
        this.render();
        return;
      }
      const word = getIntoneWord(this.puzzle.ipuz, { x, y }, this.roomStates);
      if (!word) {
        const reason = (() => {
          const clues = this.puzzle.getCluesAt({ x, y });
          if (clues.length >= 2) return 'The incantation requires a single focus, but this room branches.';
          if (clues.length === 0) return 'The stone is silent here.';
          return 'These runes are already known to you.';
        })();
        this.showInteraction([reason]);
        this.render();
        return;
      }
      this.intoneScrolls--;
      for (const cell of word.cells) {
        const cellState = this.getRoomState(cell.x, cell.y);
        if (cellState.solvedLetter !== null) continue;
        const letter = this.puzzle.ipuz.solution[cell.y][cell.x] as string;
        this.markRoomSolved(cell.x, cell.y, letter);
      }
      this.checkPuzzleComplete();
      this.showInteraction([`Your voice echoes through the hall. The letters burn into the stone.`]);
      if (this.mana === 0 && !this.puzzleComplete) this.triggerManaGameOver();
      else this.render();
      return;
    }
    this.render();  // slots 1 and 2 render here
  }

  // ---- XP / leveling ----

  private gainXp(amount: number): boolean {
    this.xp += amount;
    const threshold = this.level * XP_PER_LEVEL;
    if (this.xp >= threshold) {
      this.level++;
      this.maxHp += 10;
      this.maxMana += 5;
      this.dmg += 1;
      this.hp = this.effectiveMaxHp();
      this.mana = this.effectiveMaxMana();
      return true;
    }
    return false;
  }

  private clearLogs(): void {
    this.interactionLogEl.textContent = '';
  }

  private showInteraction(lines: string[]): void {
    this.interactionLogEl.textContent = lines.join('\n');
  }

  private markRoomSolved(x: number, y: number, letter: string): void {
    const state = this.getRoomState(x, y);
    state.solvedLetter = letter;
    const neighbors = this.puzzle.getWordNeighbors({ x, y });
    for (const nb of neighbors) {
      const nbState = this.getRoomState(nb.x, nb.y);
      if (nbState.solvedLetter !== null) continue;
      const maxLevel = this.puzzle.potentialLevels[nb.y][nb.x];
      nbState.activatedLevel = Math.min(nbState.activatedLevel + 1, maxLevel);
    }
  }

  private checkPuzzleComplete(): void {
    if (this.countSolved() === this.totalRooms) this.puzzleComplete = true;
  }

  private solveRoom(x: number, y: number, letter: string): void {
    this.markRoomSolved(x, y, letter);
    this.checkPuzzleComplete();
  }

  private triggerGameOver(): void {
    this.gameOver = true;
    this.gameOverReason = 'hp';
    this.render();
  }

  private triggerManaGameOver(): void {
    this.gameOver = true;
    this.gameOverReason = 'mana';
    this.render();
  }

  private tryGuess(x: number, y: number, letter: string): void {
    const state = this.getRoomState(x, y);
    if (state.solvedLetter !== null) return;
    if (this.mana <= 0) return;

    this.mana--;

    const correct = this.puzzle.ipuz.solution[y][x] === letter;
    const enc = state.encounter;
    const level = state.activatedLevel;

    if (!correct) {
      state.incorrectGuesses.push(letter);
      const logLines: string[] = [];

      if (level === 0) {
        // Dark room — no encounter revealed, no damage
        logLines.push(`You cast the '${letter}' rune into the darkness...`);
        logLines.push(`It fades. Nothing changes.`);
      } else {
        logLines.push(`You cast the '${letter}' rune... but it fades away.`);

        if (enc.kind === 'monster') {
          const stats = getMonsterStats(enc as MonsterEncounter, level, this.puzzleMult());
          const dmgTaken = Math.max(0, stats.dmg - this.effectiveDef());
          this.hp = Math.max(0, this.hp - dmgTaken);
          logLines.push(`The ${enc.baseName} strikes!`);
          logLines.push(`  -${dmgTaken} HP`);
          if (stats.manaDrain > 0) {
            const drained = Math.min(this.mana, stats.manaDrain);
            this.mana = Math.max(0, this.mana - drained);
            logLines.push(`  -${drained} MANA (drained)`);
          }
        } else if (enc.kind === 'trap') {
          const stats = getTrapStats(enc as TrapEncounter, level, this.puzzleMult());
          if (enc.damageType === 'hp') {
            const dmgTaken = Math.max(0, stats.dmg - this.effectiveDef());
            this.hp = Math.max(0, this.hp - dmgTaken);
            logLines.push(`The ${enc.baseName} triggers!`);
            logLines.push(`  -${dmgTaken} HP`);
          } else {
            const manaDrain = Math.min(this.mana, stats.dmg);
            this.mana = Math.max(0, this.mana - manaDrain);
            logLines.push(`The ${enc.baseName} drains your MANA!`);
            logLines.push(`  -${manaDrain} MANA`);
          }
          const fx = stats.sideEffects;
          if (fx.manaDrain > 0) {
            const drained = Math.min(this.mana, fx.manaDrain);
            this.mana = Math.max(0, this.mana - drained);
            logLines.push(`  -${drained} MANA (drained)`);
          }
          if (fx.maxHpReduce > 0) {
            this.maxHp = Math.max(1, this.maxHp - fx.maxHpReduce);
            this.hp = Math.min(this.hp, this.effectiveMaxHp());
            logLines.push(`  -${fx.maxHpReduce} max HP (permanent)`);
          }
          if (fx.maxManaReduce > 0) {
            this.maxMana = Math.max(1, this.maxMana - fx.maxManaReduce);
            this.mana = Math.min(this.mana, this.effectiveMaxMana());
            logLines.push(`  -${fx.maxManaReduce} max MANA (permanent)`);
          }
        } else {
          // treasure — mana already spent above, no extra drain
          logLines.push(`You fumble with the treasure.`);
        }
      }


      if (this.hp <= 0) {
        this.triggerGameOver();
        return;
      }
      if (this.mana === 0 && !this.puzzleComplete) {
        this.triggerManaGameOver();
        return;
      }

      this.pulseRunning = true;
      this.dungeon.triggerCorrectPulse(this.display, this.playerPos, this.roomStates, this.camera(), () => { this.pulseRunning = false; }, [200, 0, 0], 2, 60);
      this.showInteraction(logLines);
      this.render();
      return;
    }

    // --- Correct guess ---
    if (level === 0) {
      // Dark room solved: no encounter, just reveal + neighbors stir
      const AWAKEN_LINES = [
        'Nearby chambers stir at the light.',
        'Something shifts in the rooms beyond.',
      ];
      this.solveRoom(x, y, letter);
      const awaken = AWAKEN_LINES[x % AWAKEN_LINES.length];
      const logLines = [
        `The '${letter}' rune glows. Light seeps through the cracks.`,
        awaken,
      ];
      if (this.mana === 0 && !this.puzzleComplete) this.triggerManaGameOver();
      else {
        this.pulseRunning = true;
        this.dungeon.triggerCorrectPulse(this.display, this.playerPos, this.roomStates, this.camera(), () => { this.pulseRunning = false; });
        this.showInteraction(logLines);
      }
      return;
    }

    this.resolveCorrectGuess(x, y, letter, enc, level);
  }

  private resolveCorrectGuess(x: number, y: number, letter: string, enc: Encounter, level: number, preamble?: string): void {
    this.markRoomSolved(x, y, letter);
    this.pulseRunning = true;
    this.dungeon.triggerCorrectPulse(this.display, this.playerPos, this.roomStates, this.camera(), () => { this.pulseRunning = false; });

    if (enc.kind === 'monster') {
      const stats = getMonsterStats(enc as MonsterEncounter, level, this.puzzleMult());
      const equippedItems = [this.equipped.weapon, this.equipped.armor, this.equipped.amulet];
      const manaPerRound = equippedItems.reduce((s, i) => s + (i?.manaPerRound ?? 0), 0);
      const hpPerRound = equippedItems.reduce((s, i) => s + (i?.hpPerRound ?? 0), 0);
      const result = resolveCombat(
        {
          dmg: this.effectiveDmg(),
          hp: this.hp,
          maxHp: this.effectiveMaxHp(),
          def: this.effectiveDef(),
          mana: this.mana,
          maxMana: this.effectiveMaxMana(),
          hpPerRound,
          manaPerRound,
        },
        { dmg: stats.dmg, hp: stats.hp, def: stats.def, xp: stats.xp, manaDrain: stats.manaDrain },
      );
      this.runCombatAnimation(enc as MonsterEncounter, result, stats.hp, preamble);
      return;
    }

    // Trap or treasure — instant resolve
    const logLines = enc.kind === 'trap'
      ? this.resolveTrap(enc as TrapEncounter, level)
      : this.resolveTreasure(enc as TreasureEncounter, level);

    if (preamble) logLines.unshift(preamble);
    this.checkPuzzleComplete();
    if (this.mana === 0 && !this.puzzleComplete) this.triggerManaGameOver();
    else { this.showInteraction(logLines); this.render(); }
  }

  private resolveTrap(enc: TrapEncounter, level: number): string[] {
    const stats = getTrapStats(enc, level, this.puzzleMult());
    const lines = [`You disarm the ${enc.baseName}!`];
    if (stats.rewardType === 'xp') {
      const leveledUp = this.gainXp(stats.reward);
      lines.push(`+${stats.reward} XP`);
      if (leveledUp) lines.push(`★ Level up! Now Lv.${this.level}`);
    } else {
      this.mana = Math.min(this.effectiveMaxMana(), this.mana + stats.reward);
      lines.push(`+${stats.reward} MANA`);
    }
    return lines;
  }

  private resolveTreasure(enc: TreasureEncounter, level: number): string[] {
    const lines = [`You claim the treasure: ${enc.baseName}!`];
    // Only immediate effects remain in treasure encounters
    if (enc.subKind === 'immediate') {
      const amount = Math.round(enc.baseAmount + (level - 1) * enc.amountGrowth);
      if (enc.effect === 'restore_hp') {
        this.hp = Math.min(this.effectiveMaxHp(), this.hp + amount);
        lines.push(`+${amount} HP`);
      } else if (enc.effect === 'restore_mana') {
        this.mana = Math.min(this.effectiveMaxMana(), this.mana + amount);
        lines.push(`+${amount} MANA`);
      } else if (enc.effect === 'grant_xp') {
        const leveledUp = this.gainXp(amount);
        lines.push(`+${amount} XP`);
        if (leveledUp) lines.push(`★ Level up! Now Lv.${this.level}`);
      } else if (enc.effect === 'grant_gold') {
        this.gold += amount;
        lines.push(`+${amount} GOLD`);
      }
    }
    return lines;
  }

  // ---- Shop ----

  private shopItemLine(num: number, label: string, price: number): string {
    const priceColor = this.gold >= price ? '#ffdd44' : '#ff6666';
    const priceStr = `<span style="color:${priceColor}">${price} GOLD</span>`;
    return `<span style="color:#aaa">[${num}] ${esc(label)}</span>  ${priceStr}`;
  }

  private renderShopPanel(): void {
    const SHOP_COLOR = '#44ffcc';
    let html = `<span style="color:${SHOP_COLOR};font-size:16px">% Merchant  Lv.${this.dungeonLevel}</span><br>`;
    html += `<span style="color:#888">Wares and wonder, for the right price.</span><br><br>`;

    let num = 1;

    // Always-available consumables ~10g each
    html += this.shopItemLine(num++, 'Health Potion (+20 HP)', 10) + '<br>';
    html += this.shopItemLine(num++, 'Mana Potion (+10 MANA)', 10) + '<br>';
    html += this.shopItemLine(num++, 'Inscribe Scroll (reveal letter)', 10) + '<br>';
    html += this.shopItemLine(num++, 'Intone Scroll (reveal word)', 10) + '<br>';

    // Random equipment item (always available)
    if (this.shopItem) {
      const item = this.shopItem;
      const stats = this.itemStatLines(item).join(', ') || 'no bonuses';
      const current = this.equipped[item.slot];
      html += this.shopItemLine(num++, `${item.name} Lv.${item.level} [${item.slot}] ${stats}`, 500) + '<br>';
      if (current) html += `<span style="color:#888">    replaces ${esc(current.name)}</span><br>`;
    }

    // Random modifier upgrade (only shown if available)
    if (this.shopModTarget && this.shopModifier) {
      const modEffect = modEffectLabel(this.shopModifier);
      html += this.shopItemLine(num, `Add ${this.shopModifier.name} (${modEffect}) to ${this.shopModTarget.name}`, 500) + '<br>';
    }

    this.encounterEl.classList.remove('hidden');
    this.encounterEl.innerHTML = html;
  }

  private shopPurchase(slot: number): void {
    const CONSUMABLE_PRICE = 10;
    const ITEM_PRICE = 500;

    if (slot === 1) {
      if (this.gold < CONSUMABLE_PRICE) { this.showInteraction(['Insufficient gold.']); this.render(); return; }
      this.gold -= CONSUMABLE_PRICE;
      this.hpPotions++;
      this.showInteraction([`Purchased Health Potion.`]);
    } else if (slot === 2) {
      if (this.gold < CONSUMABLE_PRICE) { this.showInteraction(['Insufficient gold.']); this.render(); return; }
      this.gold -= CONSUMABLE_PRICE;
      this.manaPotions++;
      this.showInteraction([`Purchased Mana Potion.`]);
    } else if (slot === 3) {
      if (this.gold < CONSUMABLE_PRICE) { this.showInteraction(['Insufficient gold.']); this.render(); return; }
      this.gold -= CONSUMABLE_PRICE;
      this.revealScrolls++;
      this.showInteraction([`Purchased Inscribe Scroll.`]);
    } else if (slot === 4) {
      if (this.gold < CONSUMABLE_PRICE) { this.showInteraction(['Insufficient gold.']); this.render(); return; }
      this.gold -= CONSUMABLE_PRICE;
      this.intoneScrolls++;
      this.showInteraction([`Purchased Intone Scroll.`]);
    } else if (slot === 5 && this.shopItem) {
      if (this.gold < ITEM_PRICE) { this.showInteraction(['Insufficient gold.']); this.render(); return; }
      this.gold -= ITEM_PRICE;
      const item = this.shopItem;
      this.shopItem = null;
      this.equipItem(item);
      // If mod target was displaced, try to reroll to another eligible equipped item
      if (this.shopModTarget && !Object.values(this.equipped).includes(this.shopModTarget)) {
        const rng = this.makeRng();
        const candidates = [this.equipped.weapon, this.equipped.armor, this.equipped.amulet]
          .filter((i): i is TreasureItemStats => i !== null)
          .filter(i => TREASURE_MODIFIERS.some(m => !i.modNames.includes(m.name)));
        if (candidates.length > 0) {
          const newTarget = rng.getItem(candidates);
          const availableMods = TREASURE_MODIFIERS.filter(m => !newTarget.modNames.includes(m.name));
          this.shopModTarget = newTarget;
          this.shopModifier = rng.getItem(availableMods);
        } else {
          this.shopModTarget = null;
          this.shopModifier = null;
        }
      }
      this.showInteraction([`Purchased and equipped: ${item.name}.`]);
    } else if (slot === (this.shopItem ? 6 : 5) && (this.shopModTarget && this.shopModifier)) {
      if (this.gold < ITEM_PRICE) { this.showInteraction(['Insufficient gold.']); this.render(); return; }
      this.gold -= ITEM_PRICE;
      const target = this.shopModTarget;
      const mod = this.shopModifier;
      this.shopModTarget = null;
      this.shopModifier = null;
      // Apply modifier to the item in place
      target.modNames.push(mod.name);
      if ('stat_multiplier' in mod) {
        target.damageBonus  = Math.round(target.damageBonus  * mod.stat_multiplier);
        target.defenseBonus = Math.round(target.defenseBonus * mod.stat_multiplier);
        target.maxHpBonus   = Math.round(target.maxHpBonus   * mod.stat_multiplier);
        target.maxManaBonus = Math.round(target.maxManaBonus * mod.stat_multiplier);
      } else if ('passive_effect' in mod) {
        if (mod.passive_effect === 'hp_per_combat_round')   target.hpPerRound   += mod.passive_amount;
        if (mod.passive_effect === 'mana_per_combat_round') target.manaPerRound += mod.passive_amount;
      } else {
        if (mod.bonus_effect === 'max_hp')   target.maxHpBonus   += mod.bonus_amount;
        if (mod.bonus_effect === 'max_mana') target.maxManaBonus += mod.bonus_amount;
      }
      // Re-cap HP/mana after potential max bonus
      this.hp   = Math.min(this.hp,   this.effectiveMaxHp());
      this.mana = Math.min(this.mana, this.effectiveMaxMana());
      const targetName = [...target.modNames, target.name].join(' ');
      this.showInteraction([`Upgraded to: ${targetName}.`]);
    }
    this.render();
  }

  private runCombatAnimation(
    enc: MonsterEncounter,
    result: ReturnType<typeof resolveCombat>,
    initialMonsterHp: number,
    preamble?: string,
  ): void {
    this.combatRunning = true;
    const { turns, playerWon, manaGameOver, xpGained } = result;

    this.combatMonsterHp = initialMonsterHp;

    const openingLines = preamble
      ? [preamble, `You fight the ${enc.baseName}!`]
      : [`You fight the ${enc.baseName}!`];
    this.showInteraction(openingLines);
    this.render();

    const showTurn = (idx: number) => {
      if (idx < turns.length) {
        const t = turns[idx];
        this.combatMonsterHp = t.monsterHpAfter;
        this.hp = t.playerHpAfter;
        this.mana = t.playerManaAfter;
        this.render();
        setTimeout(() => showTurn(idx + 1), 700);
      } else {
        this.combatMonsterHp = null;
        if (playerWon) {
          const leveledUp = this.gainXp(xpGained);
          this.checkPuzzleComplete();
          this.combatRunning = false;
          const lines = [`${enc.baseName} defeated.`, `+${xpGained} XP`];
          if (leveledUp) lines.push(`★ Level up! Now Lv.${this.level}`);
          this.showInteraction(lines);
          if (this.mana === 0 && !this.puzzleComplete) this.triggerManaGameOver();
          this.render();
        } else if (manaGameOver) {
          this.combatRunning = false;
          this.triggerManaGameOver();
        } else {
          this.hp = 0;
          this.combatRunning = false;
          this.gameOver = true;
          this.gameOverReason = 'hp';
          this.showInteraction([`You were defeated by the ${enc.baseName}.`]);
          this.render();
        }
      }
    };

    setTimeout(() => showTurn(0), 700);
  }

  private showHelp(): void {
    const C_TITLE  = '#aaaaff';
    const C_SECT   = '#ffdd44';
    const C_KEY    = '#aaa';
    const C_BODY   = '#888';
    const s = (color: string, text: string) => `<span style="color:${color}">${esc(text)}</span>`;
    const row = (key: string, desc: string) =>
      s(C_KEY, key.padEnd(14)) + s(C_BODY, desc) + '\n';
    const sect = (title: string) => s(C_SECT, title) + '\n';
    const hr = `<hr style="border-color:#444;margin:4px 0">`;

    const html =
      `<span style="color:${C_TITLE};font-size:18px">Crossword Dungeon Help</span>\n` +
      s(C_BODY, '[Esc] to close') + '\n' +
      hr +
      `<span style="color:${C_BODY}">Solve the crossword to escape the dungeon. Each room holds one letter of a word.\nSolving a letter raises the level of connected rooms — plan your path or face foes above your level.\n</span>` +
      hr +
      sect('MOVE') +
      row('← ↑ ↓ →', 'Move') +
      row('[SPACE]', 'Toggle map') +
      hr +
      sect('SOLVE ROOMS') +
      row('[A-Z]', 'Guess letter') +
      s(C_BODY, 'Each guess costs 1 MANA\nMANA = 0 → game over\n') +
      hr +
      sect('ENCOUNTERS') +
      row('*  Monster', '') +
      row('!  Trap', '') +
      row('$  Treasure', '') +
      s(C_BODY, 'Combat is automatic\nHP = 0 → game over\n') +
      hr +
      sect('ITEMS  (press number to use)') +
      row('[1] Heal', '+20 HP') +
      row('[2] Restore', '+10 MANA') +
      row('[3] Inscribe', 'Reveal letter') +
      row('[4] Intone', 'Reveal word') +
      s(C_BODY, 'Reveal spells skip the encounter and grant no reward');

    document.getElementById('help-content')!.innerHTML = html;
    this.helpOverlayEl.classList.remove('hidden');
  }

  private handleKey(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === 'Escape') {
      this.helpOverlayEl.classList.add('hidden');
      return;
    }

    if (!this.helpOverlayEl.classList.contains('hidden')) return;

    if (e.key === '?') {
      this.showHelp();
      return;
    }

    if (this.combatRunning || this.pulseRunning) return;

    if (this.gameOver || this.puzzleComplete) {
      if (e.key === ' ') {
        if (this.puzzleComplete) this.advancePuzzle();
        else this.restart();
      }
      return;
    }

    if (e.key === ' ') {
      this.showMap = !this.showMap;
      this.applyDisplaySize();
      this.render();
      return;
    }

    // Shop room: number keys purchase, letter keys do nothing, arrows still work
    if (this.shopPos && this.playerPos.x === this.shopPos.x && this.playerPos.y === this.shopPos.y) {
      if (/^[1-9]$/.test(e.key)) {
        this.clearLogs();
        this.shopPurchase(parseInt(e.key));
        return;
      }
      if (/^[a-z]$/.test(e.key)) return; // no guessing in shop
      // fall through to arrow key handling
    }

    if (e.key === '1') { this.clearLogs(); this.useConsumable(1); return; }
    if (e.key === '2') { this.clearLogs(); this.useConsumable(2); return; }
    if (e.key === '3') { this.clearLogs(); this.useConsumable(3); return; }
    if (e.key === '4') { this.clearLogs(); this.useConsumable(4); return; }

    if (/^[a-z]$/.test(e.key)) {
      const { x, y } = this.playerPos;
      if (this.dungeon.hasRoom(x, y) && !this.dungeon.isShop(x, y)) {
        this.clearLogs();
        this.tryGuess(x, y, e.key.toUpperCase());
        if (!this.pulseRunning) this.render();
      }
      return;
    }

    const dir = KEY_DIRS[e.key];
    if (!dir) return;
    const nx = this.playerPos.x + dir.dx;
    const ny = this.playerPos.y + dir.dy;
    if (this.dungeon.hasRoom(nx, ny)) {
      this.clearLogs();
      this.playerPos = { x: nx, y: ny };
      this.render();
    }
  }

  private renderHeroPanel(): void {
    const hpBarStr = hpBar(this.hp, this.effectiveMaxHp());
    const manaBarStr = hpBar(this.mana, this.effectiveMaxMana());
    const effDmg = this.effectiveDmg();
    const effDef = this.effectiveDef();
    const flash = (cur: number, prev: number) => cur !== prev ? ' class="flash"' : '';
    const hpFlash = flash(this.hp, this.prevHp);
    const manaFlash = flash(this.mana, this.prevMana);
    const dmgFlash = flash(effDmg, this.prevDmg);
    const defFlash = flash(effDef, this.prevDef);
    const xpFlash = flash(this.xp, this.prevXp);
    const lvlFlash = flash(this.level, this.prevLevel);

    const equipBlock = [this.equipped.weapon, this.equipped.armor, this.equipped.amulet]
      .filter((item): item is TreasureItemStats => item !== null)
      .flatMap(item => equipLines(item).map(l => esc(l)))
      .join('\n');

    const boxStyle = `display:inline-block;border:1px solid #555;padding:3px 5px;width:24%;text-align:left;font-size:12px;vertical-align:top;box-sizing:border-box`;
    const itemBox = (key: string, label: string, effect: string, count: number) =>
      `<div style="${boxStyle}"><span style="color:#aaa">[${key}] ${esc(label)} ×${count}</span><br>` +
      `<span style="color:#777">${esc(effect)}</span></div>`;
    const bagHtml =
      `<div style="display:flex;justify-content:space-between;width:100%">` +
      itemBox('1', 'Heal', '+20 HP', this.hpPotions) +
      itemBox('2', 'Restore', '+10 MANA', this.manaPotions) +
      itemBox('3', 'Inscribe', 'Reveal letter', this.revealScrolls) +
      itemBox('4', 'Intone', 'Reveal word', this.intoneScrolls) +
      `</div>`;

    this.heroEl.innerHTML =
      `<div style="display:flex;align-items:baseline;gap:12px">` +
      `<span style="color:#ffdd44">Adventurer</span>` +
      `<span${lvlFlash} style="color:#777">Lv.${this.level}</span>` +
      `</div>` +
      `<div style="display:flex;gap:32px;margin-top:4px">` +
      `<div>` +
      `<div><span${hpFlash} style="color:${C_HP}">HP:   ${hpBarStr}</span>  <span style="color:#ccc">${this.hp}/${this.effectiveMaxHp()}</span></div>` +
      `<div><span${manaFlash} style="color:${C_MANA}">MANA: ${manaBarStr}</span>  <span style="color:#ccc">${this.mana}/${this.effectiveMaxMana()}</span></div>` +
      `</div>` +
      `<div>` +
      `<div><span${dmgFlash} style="color:${C_DMG}">DMG: ${effDmg}</span></div>` +
      `<div><span${defFlash} style="color:${C_DEF}">DEF: ${effDef}</span></div>` +
      `</div>` +
      `<div>` +
      `<div><span${xpFlash} style="color:${C_XP}">XP:   ${this.xp}/${this.level * XP_PER_LEVEL}</span></div>` +
      `<div><span style="color:#ffdd44">GOLD: ${this.gold}</span></div>` +
      `</div>` +
      `</div>` +
      `\n` +
      (equipBlock ? `<span style="color:${C_DIM}">${equipBlock}</span>\n\n` : '') +
      bagHtml;

    this.prevHp = this.hp;
    this.prevMana = this.mana;
    this.prevDmg = effDmg;
    this.prevDef = effDef;
    this.prevXp = this.xp;
    this.prevLevel = this.level;
    this.prevCombatMonsterHp = this.combatMonsterHp;

    const mapHint = this.showMap ? 'Exit map' : 'Full map';
    this.dungeonLevelEl.innerHTML =
      `<span style="color:#aaaaff">Dungeon Level ${this.dungeonLevel}</span>` +
      `<span style="color:#777">  [SPACE] ${mapHint}  [?] Help</span>`;
  }

  private camera(): { x: number; y: number } | undefined {
    if (this.showMap) return undefined;
    const pw = 1 + this.playerPos.x * 6 + 2; // center of player room in world coords
    const ph = 1 + this.playerPos.y * 6 + 2;
    const camX = Math.max(0, Math.min(pw - Math.floor(VIEWPORT_W / 2), this.dungeon.displayWidth - VIEWPORT_W));
    const camY = Math.max(0, Math.min(ph - Math.floor(VIEWPORT_H / 2), this.dungeon.displayHeight - VIEWPORT_H));
    return { x: camX, y: camY };
  }

  private render(): void {
    const ended = this.gameOver || this.puzzleComplete;
    this.dungeon.render(this.display, this.playerPos, this.roomStates, ended, this.camera());
    this.renderHeroPanel();

    // Status panel: game over / puzzle complete
    if (this.gameOver) {
      const reason = this.gameOverReason === 'mana'
        ? 'You have exhausted your magic.'
        : 'You have been slain.';
      this.statusEl.innerHTML =
        `<span style="color:#ff3333;font-size:20px">GAME OVER</span><br>` +
        `<span style="color:#888">${reason}</span><br><br>` +
        `<span style="color:#aaa">[SPACE] Restart</span>`;
      this.statusEl.classList.remove('hidden');
      this.cluesEl.innerHTML = '&nbsp;<br>&nbsp;';
      this.encounterEl.classList.add('hidden');
    } else if (this.puzzleComplete) {
      const bonus = this.dungeonLevel * 100;
      this.statusEl.innerHTML =
        `<span style="color:#44ff88;font-size:20px">PUZZLE COMPLETE</span><br>` +
        `<span style="color:#ffdd44">+${bonus} gold bonus!</span><br><br>` +
        `<span style="color:#aaa">[SPACE] Continue to Dungeon Level ${this.dungeonLevel + 1}</span>`;
      this.statusEl.classList.remove('hidden');
      this.cluesEl.innerHTML = '&nbsp;<br>&nbsp;';
      this.encounterEl.classList.add('hidden');
    } else {
      this.statusEl.classList.add('hidden');
      const { x, y } = this.playerPos;
      const inShop = this.shopPos !== null && x === this.shopPos.x && y === this.shopPos.y;
      if (inShop) {
        this.cluesEl.innerHTML = '&nbsp;<br>&nbsp;';
        this.renderShopPanel();
        return;
      }
      this.encounterEl.classList.remove('hidden');
      const clues = this.puzzle.getCluesAt(this.playerPos);
      const dirLabel = (d: 'Across' | 'Down') => d === 'Across' ? '&#9664; &#9654;' : '&#9650; &#9660;';
      const lines = clues.map(({ direction, clue }) => `${dirLabel(direction)} ${clue}`);
      while (lines.length < 2) lines.push('&nbsp;');
      this.cluesEl.innerHTML = lines.join('<br>');
    }

    if (!this.gameOver && !this.puzzleComplete) {
      const { x, y } = this.playerPos;
      const state = this.getRoomState(x, y);
      const style = ENCOUNTER_STYLE[state.encounter.kind];
      this.encounterEl.style.color = '';

      if (state.solvedLetter !== null && !this.combatRunning) {
        this.encounterEl.classList.add('hidden');
      } else {
        this.encounterEl.classList.remove('hidden');
        const encLines = formatEncounter(state.encounter, state.activatedLevel, this.combatMonsterHp ?? undefined);
        const guesses = state.incorrectGuesses;
        const titleColor = state.activatedLevel > 0 ? style.color : UNKNOWN_COLOR;
        const flashMonsterHp = this.combatMonsterHp !== this.prevCombatMonsterHp;
        let html = renderEncounterHtml(encLines, titleColor, flashMonsterHp ? line => line.startsWith('HP:') : undefined);
        if (guesses.length > 0) {
          html += `\n<span style="color:${C_DIM}">Runes tried: ${esc(guesses.join(' '))}</span>`;
        }
        this.encounterEl.innerHTML = html;
      }
    }
  }
}
