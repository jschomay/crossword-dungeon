import * as ROT from '../lib/rotjs';
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
  resolutionLog: string[];
};

function roomKey(x: number, y: number): string {
  return `${x},${y}`;
}

const MAX_MANA = 10;
const BASE_HP = 50;
const BASE_DMG = 10;
const XP_PER_LEVEL = 30;

function hpBar(current: number, max: number, width: number = 10): string {
  const filled = Math.round((current / max) * width);
  const empty = width - filled;
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

export default class Game {
  display: ROT.Display;
  private puzzle: Puzzle;
  private dungeon: Dungeon;
  private playerPos: { x: number; y: number };
  private statsEl: HTMLElement;
  private cluesEl: HTMLElement;
  private encounterEl: HTMLElement;
  private dungeonEl: HTMLElement;
  private overlayEl: HTMLElement;
  private overlayContentEl: HTMLElement;
  private roomStates: Map<string, RoomState> = new Map();
  private mana: number = MAX_MANA;
  private hp: number = BASE_HP;
  private maxHp: number = BASE_HP;
  private dmg: number = BASE_DMG;
  private level: number = 1;
  private xp: number = 0;
  private gameOver: boolean = false;
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

    this.statsEl = document.getElementById('stats')!;
    this.cluesEl = document.getElementById('clues')!;
    this.encounterEl = document.getElementById('encounter')!;
    this.overlayEl = document.getElementById('resolution-overlay')!;
    this.overlayContentEl = document.getElementById('resolution-content')!;

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
        resolutionLog: [],
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
    this.playerPos = ROT.RNG.getItem(this.puzzle.getRooms())!;
    this.applyTilt();
    this.hideOverlay();
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

  private overlayIsRestart: boolean = false;

  private showOverlay(lines: string[], isRestart: boolean = false): void {
    this.overlayIsRestart = isRestart;
    const footer = isRestart ? '\n  [SPACE] Restart' : '\n  [SPACE] Continue';
    this.overlayContentEl.textContent = lines.join('\n') + footer;
    this.overlayEl.classList.remove('hidden');
  }

  private hideOverlay(): void {
    this.overlayEl.classList.add('hidden');
  }

  private handleOverlaySpace(): void {
    if (this.overlayIsRestart) {
      this.restart();
    } else {
      this.hideOverlay();
      this.render();
    }
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
    this.showOverlay(['', '  *** GAME OVER ***', '', '  You have been slain.', ''], true);
  }

  private triggerManaGameOver(): void {
    this.gameOver = true;
    this.showOverlay(['', '  *** OUT OF MANA ***', '', '  You have no mana left.', ''], true);
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
        logLines.push(`Nothing stirs. The shadows remain.`);
      } else {
        logLines.push(`You cast the '${letter}' rune... but nothing happens.`);
        logLines.push(enc.baseDescription);
        logLines.push('');

        if (enc.kind === 'monster') {
          const stats = getMonsterStats(enc as MonsterEncounter, level);
          const dmgTaken = stats.dmg;
          this.hp = Math.max(0, this.hp - dmgTaken);
          logLines.push(`The ${enc.baseName} strikes back!`);
          logLines.push(`  -${dmgTaken} HP  (${this.hp}/${this.maxHp} remaining)`);
        } else if (enc.kind === 'trap') {
          const stats = getTrapStats(enc as TrapEncounter, level);
          if (enc.damageType === 'hp') {
            const dmgTaken = stats.dmg;
            this.hp = Math.max(0, this.hp - dmgTaken);
            logLines.push(`The ${enc.baseName} triggers!`);
            logLines.push(`  -${dmgTaken} HP  (${this.hp}/${this.maxHp} remaining)`);
          } else {
            const manaDrain = Math.min(this.mana, stats.dmg);
            this.mana = Math.max(0, this.mana - manaDrain);
            logLines.push(`The ${enc.baseName} drains your mana!`);
            logLines.push(`  -${manaDrain} mana  (${this.mana}/${MAX_MANA} remaining)`);
          }
        } else {
          // treasure — mana already spent above, no extra drain
          logLines.push(`You fumble with the treasure.`);
          logLines.push(`  -1 mana  (${this.mana}/${MAX_MANA} remaining)`);
        }
      }

      state.resolutionLog.push(...logLines);

      if (this.hp <= 0) {
        this.triggerGameOver();
        return;
      }
      if (this.mana === 0 && !this.puzzleComplete) {
        this.triggerManaGameOver();
        return;
      }

      this.showOverlay(logLines);
      return;
    }

    // --- Correct guess ---
    if (level === 0) {
      // Dark room solved: no encounter, just reveal + neighbors stir
      const AWAKEN_LINES = [
        'The rune glows. Light seeps through the cracks.',
        'Something shifts in the rooms beyond.',
        'Nearby chambers stir at the light.',
      ];
      this.solveRoom(x, y, letter);
      const logLines = [
        `You inscribe the '${letter}' rune. The room illuminates.`,
        '',
        ...AWAKEN_LINES,
      ];
      state.resolutionLog.push(...logLines);
      if (this.mana === 0 && !this.puzzleComplete) this.triggerManaGameOver();
      else this.showOverlay(logLines);
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
        logLines.push(`  +${stats.reward} XP  (total: ${this.xp} XP)`);
      } else {
        this.mana = Math.min(MAX_MANA, this.mana + stats.reward);
        logLines.push(`  +${stats.reward} mana  (${this.mana}/${MAX_MANA})`);
      }
    } else {
      logLines.push(`You claim the treasure: ${enc.baseName}!`);
      // Immediate treasures grant their effect; simplified for now
      if (enc.subKind === 'immediate') {
        const amount = enc.baseAmount + level * enc.amountGrowth;
        if (enc.effect === 'restore_hp') {
          this.hp = Math.min(this.maxHp, this.hp + amount);
          logLines.push(`  +${amount} HP  (${this.hp}/${this.maxHp})`);
        } else if (enc.effect === 'restore_mana') {
          this.mana = Math.min(MAX_MANA, this.mana + amount);
          logLines.push(`  +${amount} mana  (${this.mana}/${MAX_MANA})`);
        } else if (enc.effect === 'grant_xp') {
          this.gainXp(amount);
          logLines.push(`  +${amount} XP`);
        } else {
          logLines.push(`  Effect: ${enc.effect} (${amount})`);
        }
      }
    }

    state.resolutionLog.push(...logLines);
    this.solveRoom(x, y, letter);
    if (this.mana === 0 && !this.puzzleComplete) this.triggerManaGameOver();
    else this.showOverlay(logLines);
  }

  private runCombatAnimation(
    x: number, y: number, letter: string,
    enc: MonsterEncounter,
    result: ReturnType<typeof resolveCombat>,
  ): void {
    this.combatRunning = true;
    const { turns, playerWon, xpGained } = result;
    const displayLines: string[] = [`Combat: You vs ${enc.baseName}`, ''];

    // Show overlay immediately with first turn
    const showTurn = (idx: number) => {
      if (idx < turns.length) {
        const t = turns[idx];
        if (t.attacker === 'player') {
          displayLines.push(`You strike for ${t.dmg} dmg!  Monster HP: ${t.monsterHpAfter}`);
        } else {
          displayLines.push(`${enc.baseName} hits for ${t.dmg}!  Your HP: ${t.playerHpAfter}`);
        }
        this.showOverlay([...displayLines, '', '...']);
        setTimeout(() => showTurn(idx + 1), 700);
      } else {
        // Combat concluded
        displayLines.push('');
        const state = this.getRoomState(x, y);
        if (playerWon) {
          displayLines.push(`Victory! ${enc.baseName} defeated.`);
          displayLines.push(`  +${xpGained} XP`);
          this.gainXp(xpGained);
          state.resolutionLog.push(...displayLines);
          this.solveRoom(x, y, letter);
          this.combatRunning = false;
          if (this.mana === 0 && !this.puzzleComplete) this.triggerManaGameOver();
          else this.showOverlay(displayLines);
          this.render();
        } else {
          this.hp = 0;
          displayLines.push(`You have been defeated by ${enc.baseName}!`);
          state.resolutionLog.push(...displayLines);
          this.combatRunning = false;
          this.gameOver = true;
          this.showOverlay([...displayLines, '', '  *** GAME OVER ***'], true);
          this.render();
        }
      }
    };

    showTurn(0);
  }

  private handleKey(e: KeyboardEvent): void {
    if (this.combatRunning) return;

    if (!this.overlayEl.classList.contains('hidden')) {
      if (e.key === ' ') this.handleOverlaySpace();
      return;
    }

    if (this.gameOver || this.puzzleComplete) {
      if (e.key === ' ') this.restart();
      return;
    }

    if (/^[a-z]$/.test(e.key)) {
      const { x, y } = this.playerPos;
      if (this.dungeon.hasRoom(x, y)) {
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
      this.playerPos = { x: nx, y: ny };
      this.render();
    }
  }

  private render(): void {
    const ended = this.gameOver || this.puzzleComplete;
    this.dungeon.render(this.display, this.playerPos, this.roomStates, ended);

    // Stats bar: HP + mana
    const hpBarStr = hpBar(this.hp, this.maxHp);
    const hpColor = this.hp > this.maxHp * 0.3 ? '#ff6666' : '#ff2222';
    const manaFilled = '<span style="color:#00ffff">ᛗ</span>'.repeat(this.mana);
    const manaEmpty = '<span style="color:#555">ᛗ</span>'.repeat(MAX_MANA - this.mana);
    this.statsEl.innerHTML =
      `<span style="color:${hpColor}">HP: ${hpBarStr}</span>  ${this.hp}/${this.maxHp}` +
      `    <span style="color:#aaa">DMG: ${this.dmg}    Lv.${this.level}    XP: ${this.xp}</span>` +
      `<br>Mana: ${manaFilled}${manaEmpty}`;

    if (this.gameOver) {
      this.cluesEl.innerHTML = 'Game over!<br>Press space to restart.';
      this.encounterEl.innerHTML = '';
    } else if (this.puzzleComplete) {
      this.cluesEl.innerHTML = 'Puzzle complete!<br>Press space to restart.';
      this.encounterEl.innerHTML = '';
    } else {
      const clues = this.puzzle.getCluesAt(this.playerPos);
      const lines = clues.map(({ direction, clue }) => `${direction}: ${clue}`);
      while (lines.length < 2) lines.push('&nbsp;');
      this.cluesEl.innerHTML = lines.join('<br>');

      const { x, y } = this.playerPos;
      const state = this.getRoomState(x, y);
      const style = ENCOUNTER_STYLE[state.encounter.kind];

      if (state.solvedLetter !== null) {
        // Solved room: header + single flavor line
        const enc = state.encounter;
        const level = state.activatedLevel;
        const headerLines = level > 0 ? formatEncounter(enc, level).slice(0, 1) : [];
        let flavorLine: string;
        if (level === 0) {
          flavorLine = `The room is quiet. Light filters through.`;
        } else if (enc.kind === 'monster') {
          flavorLine = `You slew the ${enc.baseName}.`;
        } else if (enc.kind === 'trap') {
          flavorLine = `You disarmed the ${enc.baseName}.`;
        } else {
          flavorLine = `You claimed the ${enc.baseName}.`;
        }
        this.encounterEl.style.color = level > 0 ? style.color : UNKNOWN_COLOR;
        this.encounterEl.textContent = [...headerLines, ...(headerLines.length ? [''] : []), flavorLine].join('\n');
      } else {
        const encLines = formatEncounter(state.encounter, state.activatedLevel);
        // Append incorrect guess attempts at the bottom
        const guesses = state.incorrectGuesses;
        const guessLine = guesses.length > 0
          ? `\nRunes tried: ${guesses.join(' ')}`
          : '';
        this.encounterEl.style.color = state.activatedLevel > 0 ? style.color : UNKNOWN_COLOR;
        this.encounterEl.textContent = encLines.join('\n') + guessLine;
      }
    }
  }
}
