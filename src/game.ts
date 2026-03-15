import * as ROT from '../lib/rotjs';
import { hpBar, esc, renderEncounterHtml, C_HP, C_MANA, C_DMG, C_XP, C_DIM } from './utils';
import demoJson from '../puzzles/demo.json';
import { validateIpuz } from './puzzle';
import Puzzle from './puzzle';
import Dungeon from './dungeon';
import {
  generateEncounter,
  formatEncounter,
  getMonsterStats,
  getTrapStats,
  resolveCombat,
  ENCOUNTER_STYLE,
  UNKNOWN_COLOR,
  type Encounter,
  type MonsterEncounter,
  type TrapEncounter,
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

const MAX_MANA = 10;
const BASE_HP = 50;
const BASE_DMG = 10;
const XP_PER_LEVEL = 30;


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
  private prevMana: number = MAX_MANA;
  private prevDmg: number = BASE_DMG;
  private prevXp: number = 0;
  private prevLevel: number = 1;
  private prevCombatMonsterHp: number | null = null;
  private roomStates: Map<string, RoomState> = new Map();
  private mana: number = MAX_MANA;
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
    this.mana = MAX_MANA;
    this.hp = BASE_HP;
    this.maxHp = BASE_HP;
    this.dmg = BASE_DMG;
    this.level = 1;
    this.xp = 0;
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

  private gainXp(amount: number): void {
    this.xp += amount;
    const xpNeeded = this.level * XP_PER_LEVEL;
    if (this.xp >= xpNeeded) {
      this.xp -= xpNeeded;
      this.level++;
      this.dmg += 2;
      this.maxHp += 10;
      this.hp = Math.min(this.hp + 10, this.maxHp);
    }
  }

  private clearLogs(): void {
    this.interactionLogEl.textContent = '';
  }

  private showInteraction(lines: string[]): void {
    this.interactionLogEl.textContent = lines.join('\n');
  }

  private solveRoom(x: number, y: number, letter: string): void {
    const state = this.getRoomState(x, y);
    state.solvedLetter = letter;
    const neighbors = this.puzzle.getWordNeighbors({ x, y });
    for (const nb of neighbors) {
      const nbState = this.getRoomState(nb.x, nb.y);
      if (nbState.solvedLetter !== null) continue;
      nbState.activatedLevel++;
    }
    if (this.countSolved() === this.totalRooms) {
      this.puzzleComplete = true;
    }
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
          const dmgTaken = stats.dmg;
          this.hp = Math.max(0, this.hp - dmgTaken);
          logLines.push(`The ${enc.baseName} strikes!`);
          logLines.push(`  -${dmgTaken} HP`);
        } else if (enc.kind === 'trap') {
          const stats = getTrapStats(enc as TrapEncounter, level);
          if (enc.damageType === 'hp') {
            const dmgTaken = stats.dmg;
            this.hp = Math.max(0, this.hp - dmgTaken);
            logLines.push(`The ${enc.baseName} triggers!`);
            logLines.push(`  -${dmgTaken} HP`);
          } else {
            const manaDrain = Math.min(this.mana, stats.dmg);
            this.mana = Math.max(0, this.mana - manaDrain);
            logLines.push(`The ${enc.baseName} drains your mana!`);
            logLines.push(`  -${manaDrain} mana`);
          }
        } else {
          // treasure — mana already spent above, no extra drain
          logLines.push(`You fumble with the treasure.`);
          logLines.push(`  -1 mana`);
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

    if (enc.kind === 'monster') {
      const stats = getMonsterStats(enc as MonsterEncounter, level);
      const result = resolveCombat(this.dmg, this.hp, stats.dmg, stats.hp, stats.xp);
      this.runCombatAnimation(x, y, letter, enc as MonsterEncounter, result);
      return;
    }

    // Trap or treasure — instant resolve
    const logLines: string[] = [];
    if (enc.kind === 'trap') {
      const stats = getTrapStats(enc as TrapEncounter, level);
      logLines.push(`You disarm the ${enc.baseName}!`);
      if (stats.rewardType === 'xp') {
        this.gainXp(stats.reward);
        logLines.push(`  +${stats.reward} XP`);
      } else {
        this.mana = Math.min(MAX_MANA, this.mana + stats.reward);
        logLines.push(`  +${stats.reward} mana`);
      }
    } else {
      logLines.push(`You claim the treasure: ${enc.baseName}!`);
      // Immediate treasures grant their effect; simplified for now
      if (enc.subKind === 'immediate') {
        const amount = enc.baseAmount + level * enc.amountGrowth;
        if (enc.effect === 'restore_hp') {
          this.hp = Math.min(this.maxHp, this.hp + amount);
          logLines.push(`  +${amount} HP`);
        } else if (enc.effect === 'restore_mana') {
          this.mana = Math.min(MAX_MANA, this.mana + amount);
          logLines.push(`  +${amount} mana`);
        } else if (enc.effect === 'grant_xp') {
          this.gainXp(amount);
          logLines.push(`  +${amount} XP`);
        } else if (enc.effect === 'increase_max_hp') {
          this.maxHp += amount;
          this.hp += amount;
          logLines.push(`  +${amount} max HP`);
        } else if (enc.effect === 'increase_max_mana') {
          logLines.push(`  Your mana reserves deepen.`);
        } else if (enc.effect === 'reveal_letter') {
          logLines.push(`  A letter is magically revealed.`);
        }
      }
    }

    this.solveRoom(x, y, letter);
    if (this.mana === 0 && !this.puzzleComplete) this.triggerManaGameOver();
    else this.showInteraction(logLines);
  }

  private runCombatAnimation(
    x: number, y: number, letter: string,
    enc: MonsterEncounter,
    result: ReturnType<typeof resolveCombat>,
  ): void {
    this.combatRunning = true;
    const { turns, playerWon, xpGained } = result;

    const firstPlayerTurn = turns.find(t => t.attacker === 'player');
    this.combatMonsterHp = firstPlayerTurn ? firstPlayerTurn.monsterHpAfter + firstPlayerTurn.dmg : 0;

    this.showInteraction([`You fight the ${enc.baseName}!`]);

    const showTurn = (idx: number) => {
      if (idx < turns.length) {
        const t = turns[idx];
        if (t.attacker === 'player') {
          this.combatMonsterHp = t.monsterHpAfter;
        } else {
          this.hp = t.playerHpAfter;
        }
        this.render();
        setTimeout(() => showTurn(idx + 1), 700);
      } else {
        this.combatMonsterHp = null;
        if (playerWon) {
          this.gainXp(xpGained);
          this.solveRoom(x, y, letter);
          this.combatRunning = false;
          this.showInteraction([`${enc.baseName} defeated.`, `  +${xpGained} XP`]);
          if (this.mana === 0 && !this.puzzleComplete) this.triggerManaGameOver();
          this.render();
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

  private render(): void {
    const ended = this.gameOver || this.puzzleComplete;
    this.dungeon.render(this.display, this.playerPos, this.roomStates, ended);

    // Hero panel
    const hpBarStr = hpBar(this.hp, this.maxHp);
    const manaBarStr = hpBar(this.mana, MAX_MANA);
    const hpFlash    = this.hp    !== this.prevHp    ? ' class="flash"' : '';
    const manaFlash  = this.mana  !== this.prevMana  ? ' class="flash"' : '';
    const dmgFlash   = this.dmg   !== this.prevDmg   ? ' class="flash"' : '';
    const xpFlash    = this.xp    !== this.prevXp    ? ' class="flash"' : '';
    const lvlFlash   = this.level !== this.prevLevel ? ' class="flash"' : '';
    this.heroEl.innerHTML =
      `<span style="color:#aaa">Adventurer</span>  <span${lvlFlash} style="color:#777">Lv.${this.level}</span>\n` +
      `\n` +
      `<span${hpFlash} style="color:${C_HP}">HP:   ${hpBarStr}</span>  <span style="color:#ccc">${this.hp}/${this.maxHp}</span>\n` +
      `<span${manaFlash} style="color:${C_MANA}">MANA: ${manaBarStr}</span>  <span style="color:#ccc">${this.mana}/${MAX_MANA}</span>\n` +
      `<span${dmgFlash} style="color:${C_DMG}">DMG:  ${this.dmg}</span>\n` +
      `<span${xpFlash} style="color:${C_XP}">XP:   ${this.xp}</span>`;

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

    this.prevHp              = this.hp;
    this.prevMana            = this.mana;
    this.prevDmg             = this.dmg;
    this.prevXp              = this.xp;
    this.prevLevel           = this.level;
    this.prevCombatMonsterHp = this.combatMonsterHp;
  }
}
