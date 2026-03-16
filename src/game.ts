import * as ROT from '../lib/rotjs';
import { hpBar, esc, renderEncounterHtml, C_HP, C_MANA, C_DMG, C_DEF, C_XP, C_DIM } from './utils';
import demoJson from '../puzzles/demo.json';
import { validateIpuz } from './puzzle';
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
  type TreasureItemEncounter,
  type TreasureItemStats,
  type Rng,
} from './encounters';

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

const BASE_MANA = 10;
const BASE_HP = 50;
const BASE_DMG = 10;
const XP_PER_LEVEL = 50;

// ---- Inventory list rendering ----

function equipLine(item: TreasureItemStats): string {
  const fullName = [...item.modNames, item.name].join(' ');
  const parts: string[] = [];
  if (item.damageBonus > 0)  parts.push(`+${item.damageBonus} DMG`);
  if (item.defenseBonus > 0) parts.push(`+${item.defenseBonus} DEF`);
  if (item.maxHpBonus > 0)   parts.push(`+${item.maxHpBonus} max HP`);
  if (item.maxManaBonus > 0) parts.push(`+${item.maxManaBonus} max MANA`);
  parts.push(...item.passiveEffects);
  return `◆ ${fullName} (${parts.join(', ')})`;
}


type Equipped = {
  weapon: TreasureItemStats | null;
  armor: TreasureItemStats | null;
  amulet: TreasureItemStats | null;
};

export default class Game {
  display: ROT.Display;
  private puzzle: Puzzle;
  private dungeon: Dungeon;
  private playerPos: { x: number; y: number };
  private heroEl: HTMLElement;
  private statusEl: HTMLElement;
  private cluesEl: HTMLElement;
  private encounterEl: HTMLElement;
  private dungeonEl: HTMLElement;
  private interactionLogEl: HTMLElement;
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
  private totalRooms: number = 0;
  private combatRunning: boolean = false;
  private equipped: Equipped = { weapon: null, armor: null, amulet: null };
  private hpPotions: number = 0;
  private manaPotions: number = 0;
  private revealScrolls: number = 0;

  constructor() {
    const ipuz = validateIpuz(demoJson);
    this.puzzle = new Puzzle(ipuz);
    this.dungeon = new Dungeon(this.puzzle);
    this.totalRooms = this.puzzle.getRooms().length;

    this.display = new ROT.Display({
      width: this.dungeon.displayWidth,
      height: this.dungeon.displayHeight,
      fontSize: 20,
    });

    this.dungeonEl = document.getElementById('dungeon')!;
    this.dungeonEl.appendChild(this.display.getContainer()!);

    this.heroEl = document.getElementById('hero')!;
    this.statusEl = document.getElementById('status')!;
    this.cluesEl = document.getElementById('clues')!;
    this.encounterEl = document.getElementById('encounter')!;
    this.interactionLogEl = document.getElementById('interaction-log')!;

    this.applyTilt();
    this.initRoomStates();
    this.playerPos = ROT.RNG.getItem(this.puzzle.getRooms())!;

    this.render();
    window.addEventListener('keydown', (e) => this.handleKey(e));
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
  }

  private restart(): void {
    this.initRoomStates();
    this.mana = BASE_MANA;
    this.maxMana = BASE_MANA;
    this.hp = BASE_HP;
    this.maxHp = BASE_HP;
    this.dmg = BASE_DMG;
    this.level = 1;
    this.xp = 0;
    this.equipped = { weapon: null, armor: null, amulet: null };
    this.hpPotions = 0;
    this.manaPotions = 0;
    this.revealScrolls = 0;
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

  private useConsumable(slot: 1 | 2 | 3): void {
    if (this.combatRunning) return;

    if (slot === 1) {
      if (this.hpPotions <= 0) return;
      this.hpPotions--;
      const restored = Math.min(20, this.effectiveMaxHp() - this.hp);
      this.hp = Math.min(this.hp + 20, this.effectiveMaxHp());
      this.showInteraction([`Heal used.`, `  +${restored} HP`]);
    } else if (slot === 2) {
      if (this.manaPotions <= 0) return;
      this.manaPotions--;
      const restored = Math.min(10, this.effectiveMaxMana() - this.mana);
      this.mana = Math.min(this.mana + 10, this.effectiveMaxMana());
      this.showInteraction([`Restore used.`, `  +${restored} MANA`]);
    } else {
      if (this.revealScrolls <= 0) return;
      const { x, y } = this.playerPos;
      if (!this.dungeon.hasRoom(x, y)) return;
      const state = this.getRoomState(x, y);
      if (state.solvedLetter !== null) return;
      this.revealScrolls--;
      const letter = this.puzzle.ipuz.solution[y][x] as string;
      // resolveCorrectGuess handles its own render; return to avoid double render
      this.resolveCorrectGuess(x, y, letter, state.encounter, state.activatedLevel, `You inscribe the '${letter}' rune.`);
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
      nbState.activatedLevel++;
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
          const stats = getMonsterStats(enc as MonsterEncounter, level);
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
          const stats = getTrapStats(enc as TrapEncounter, level);
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

      this.showInteraction(logLines);
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
      else this.showInteraction(logLines);
      return;
    }

    this.resolveCorrectGuess(x, y, letter, enc, level);
  }

  private resolveCorrectGuess(x: number, y: number, letter: string, enc: Encounter, level: number, preamble?: string): void {
    this.markRoomSolved(x, y, letter);

    if (enc.kind === 'monster') {
      const stats = getMonsterStats(enc as MonsterEncounter, level);
      const equippedItems = [this.equipped.weapon, this.equipped.armor, this.equipped.amulet];
      const manaPerRound = equippedItems.reduce((s, i) => s + (i?.manaPerRound ?? 0), 0);
      const hpPerRound   = equippedItems.reduce((s, i) => s + (i?.hpPerRound   ?? 0), 0);
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
      this.runCombatAnimation(enc as MonsterEncounter, result, preamble);
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
    const stats = getTrapStats(enc, level);
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
    if (enc.subKind === 'immediate') {
      const amount = enc.baseAmount + (level - 1) * enc.amountGrowth;
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
      } else if (enc.effect === 'increase_max_hp') {
        this.maxHp += amount;
        this.hp = Math.min(this.hp + amount, this.effectiveMaxHp());
        lines.push(`+${amount} max HP`);
      } else if (enc.effect === 'increase_max_mana') {
        this.maxMana += amount;
        this.mana = Math.min(this.mana + amount, this.effectiveMaxMana());
        lines.push(`+${amount} max MANA`);
      }
    } else if (enc.subKind === 'item') {
      const item = getTreasureItemStats(enc as TreasureItemEncounter, level);
      this.equipItem(item);
      lines.push(`Equipped: ${item.name}`);
      if (item.damageBonus > 0)  lines.push(`+${item.damageBonus} DMG`);
      if (item.defenseBonus > 0) lines.push(`+${item.defenseBonus} DEF`);
      if (item.maxHpBonus > 0)   lines.push(`+${item.maxHpBonus} max HP`);
      if (item.maxManaBonus > 0) lines.push(`+${item.maxManaBonus} max MANA`);
    } else if (enc.subKind === 'consumable') {
      const quantity = enc.baseQuantity + Math.floor((level - 1) * enc.quantityGrowth);
      if (enc.effect === 'restore_hp') {
        this.hpPotions += quantity;
        lines.push(`+${quantity} Health Potion${quantity > 1 ? 's' : ''}`);
      } else if (enc.effect === 'restore_mana') {
        this.manaPotions += quantity;
        lines.push(`+${quantity} Mana Potion${quantity > 1 ? 's' : ''}`);
      } else if (enc.effect === 'reveal_letter') {
        this.revealScrolls += quantity;
        lines.push(`+${quantity} Letter Reveal Scroll${quantity > 1 ? 's' : ''}`);
      }
    }
    return lines;
  }

  private runCombatAnimation(
    enc: MonsterEncounter,
    result: ReturnType<typeof resolveCombat>,
    preamble?: string,
  ): void {
    this.combatRunning = true;
    const { turns, playerWon, manaGameOver, xpGained } = result;

    const firstPlayerTurn = turns.find(t => t.attacker === 'player');
    this.combatMonsterHp = firstPlayerTurn ? firstPlayerTurn.monsterHpAfter + firstPlayerTurn.dmg : 0;

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

  private handleKey(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (this.combatRunning) return;

    if (this.gameOver || this.puzzleComplete) {
      if (e.key === ' ') this.restart();
      return;
    }

    if (e.key === '1') { this.clearLogs(); this.useConsumable(1); return; }
    if (e.key === '2') { this.clearLogs(); this.useConsumable(2); return; }
    if (e.key === '3') { this.clearLogs(); this.useConsumable(3); return; }

    if (/^[a-z]$/.test(e.key)) {
      const { x, y } = this.playerPos;
      if (this.dungeon.hasRoom(x, y)) {
        this.clearLogs();
        this.tryGuess(x, y, e.key.toUpperCase());
        this.render();
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
    const hpBarStr   = hpBar(this.hp,   this.effectiveMaxHp());
    const manaBarStr = hpBar(this.mana, this.effectiveMaxMana());
    const effDmg = this.effectiveDmg();
    const effDef = this.effectiveDef();
    const flash = (cur: number, prev: number) => cur !== prev ? ' class="flash"' : '';
    const hpFlash   = flash(this.hp,    this.prevHp);
    const manaFlash = flash(this.mana,  this.prevMana);
    const dmgFlash  = flash(effDmg,     this.prevDmg);
    const defFlash  = flash(effDef,     this.prevDef);
    const xpFlash   = flash(this.xp,    this.prevXp);
    const lvlFlash  = flash(this.level, this.prevLevel);

    const equipLines = [this.equipped.weapon, this.equipped.armor, this.equipped.amulet]
      .filter((item): item is TreasureItemStats => item !== null)
      .map(item => esc(equipLine(item)))
      .join('\n');

    const boxStyle = `display:inline-block;border:1px solid #555;padding:3px 5px;width:30%;text-align:left;font-size:12px;vertical-align:top;box-sizing:border-box`;
    const itemBox = (key: string, label: string, effect: string, count: number) =>
      `<div style="${boxStyle}"><span style="color:#aaa">[${key}] ${esc(label)} ×${count}</span><br>` +
      `<span style="color:#777">${esc(effect)}</span></div>`;
    const bagHtml =
      `<div style="display:flex;justify-content:space-between;width:100%">` +
      itemBox('1', 'Heal',     '+20 HP',        this.hpPotions) +
      itemBox('2', 'Restore',  '+10 MANA',      this.manaPotions) +
      itemBox('3', 'Inscribe', 'Reveal letter', this.revealScrolls) +
      `</div>`;

    this.heroEl.innerHTML =
      `<div style="display:flex;align-items:baseline;gap:12px">` +
        `<span style="color:#aaa">Adventurer</span>` +
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
          `<div><span${xpFlash} style="color:${C_XP}">XP:  ${this.xp}/${this.level * XP_PER_LEVEL}</span></div>` +
        `</div>` +
      `</div>` +
      `\n` +
      (equipLines ? `<span style="color:${C_DIM}">${equipLines}</span>\n\n` : '') +
      bagHtml;

    this.prevHp              = this.hp;
    this.prevMana            = this.mana;
    this.prevDmg             = effDmg;
    this.prevDef             = effDef;
    this.prevXp              = this.xp;
    this.prevLevel           = this.level;
    this.prevCombatMonsterHp = this.combatMonsterHp;
  }

  private render(): void {
    const ended = this.gameOver || this.puzzleComplete;
    this.dungeon.render(this.display, this.playerPos, this.roomStates, ended);
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
      this.statusEl.innerHTML =
        `<span style="color:#44ff88;font-size:20px">PUZZLE COMPLETE</span><br><br>` +
        `<span style="color:#aaa">[SPACE] Restart</span>`;
      this.statusEl.classList.remove('hidden');
      this.cluesEl.innerHTML = '&nbsp;<br>&nbsp;';
      this.encounterEl.classList.add('hidden');
    } else {
      this.statusEl.classList.add('hidden');
      this.encounterEl.classList.remove('hidden');
      const clues = this.puzzle.getCluesAt(this.playerPos);
      const lines = clues.map(({ direction, clue }) => `${direction}: ${clue}`);
      while (lines.length < 2) lines.push('&nbsp;');
      this.cluesEl.innerHTML = lines.join('<br>');
    }

    if (!this.gameOver && !this.puzzleComplete) {
      const { x, y } = this.playerPos;
      const state = this.getRoomState(x, y);
      const style = ENCOUNTER_STYLE[state.encounter.kind];
      this.encounterEl.style.color = '';

      if (state.solvedLetter !== null) {
        const enc = state.encounter;
        const level = state.activatedLevel;
        let flavorLine: string;
        if (level === 0) {
          flavorLine = `An empty room.`;
        } else if (enc.kind === 'monster') {
          flavorLine = `Defeated.`;
        } else if (enc.kind === 'trap') {
          flavorLine = `Disarmed.`;
        } else {
          flavorLine = `Claimed.`;
        }
        if (level > 0) {
          const heading = formatEncounter(enc, level).slice(0, 1);
          this.encounterEl.innerHTML =
            `<span style="color:${style.color}">${esc(heading[0])}</span>\n\n` +
            `<span style="color:${C_DIM}">${esc(flavorLine)}</span>`;
        } else {
          this.encounterEl.innerHTML = `<span style="color:${C_DIM}">${esc(flavorLine)}</span>`;
        }
      } else {
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
