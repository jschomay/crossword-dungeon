# Crossword Dungeon — Architecture Reference

A self-reference doc for Claude (or anyone else) who needs to understand how things work before touching something.

---

## File Map

| File | Role |
|---|---|
| `main.ts` | Entry point; window load → `Game.create()` |
| `game.ts` | Core class; all player state, input, render loop, combat |
| `dungeon.ts` | Dungeon rendering, FOV, grid↔display coord math |
| `puzzle.ts` | ipuz loading, sparse word selection, potential level grid |
| `encounters.ts` | Encounter gen, stat computation, combat simulation, display |
| `extraRooms.ts` | Bonus room definitions, shop, boss, NPC, event handlers |
| `progression.ts` | Puzzle sequence, localStorage, URL overrides |
| `utils.ts` | Color helpers, HP bars, HTML escaping |
| `style.css` | 60/40 flex layout, animations, dungeon tilt |
| `audio.ts` | Howler.js audio: loads 4 MP3s, exports `initAudio`, `startAmbience`, `setMetallicTension`, `playMetallicSting`, `resetAudio` |

---

## Game Lifecycle

### Startup

```
window.load
  └─ main.ts: render title screen crossword (rot.js Display)
       ├─ Promise.all: Game.create() + initAudio()
       │   Game.create():
       │     ├─ new Game()
       │     ├─ await regenDungeon()  ← async: fetch puzzle, build dungeon
       │     ├─ register resize listener
       │     ├─ set playerPos to random room
       │     └─ apply dungeon tilt rotation
       ├─ show "Press [SPACE] to enter"
       └─ on SPACE:
            ├─ hide title, show #ui
            ├─ startAmbience()        ← satisfies autoplay policy
            └─ game.activate()
                 ├─ render()
                 ├─ show help if tutorial
                 └─ register keydown listener
```

`regenDungeon()` is async because it fetches the puzzle JSON. It:
1. Calls `consumeProgression()` to get the puzzle number + parity flip
2. Fetches `puzzles/N.json`
3. Builds sparse ipuz (selects words, trims grid)
4. Constructs `Puzzle` instance
5. Calls `initRoomStates()` — generates all encounters, pre-solves `dungeonLevel` random letters

### Level Transition

```
advancePuzzle()
  ├─ dungeonLevel++
  ├─ gold bonus
  ├─ reset shop counts
  └─ await regenDungeon()     ← re-fetches next puzzle from progression
```

`restart()` resets everything (player stats, level, arch puzzle) and calls `regenDungeon()`.

### Render Cycle

`render()` is called after every meaningful action. It is a **full redraw** (not diff):

```
render()
  ├─ dungeon.render(display, playerPos, roomStates, hidePlayer, camera)
  │   ├─ display.clear()
  │   ├─ draw background noise
  │   ├─ loop grid: drawRoom + corridors (writes to cellMap)
  │   ├─ torch FOV (brighten cells near player)
  │   └─ extra room glow FOV (colored glow per bonus room)
  ├─ renderHeroPanel()         ← HP/mana/XP bars, equipment, inventory
  └─ conditional panel:
       ├─ game over/won → show popup
       ├─ in bonus room (incomplete) → def.renderPanel()
       ├─ in letter room (incomplete) → encounter panel + clues
       └─ room completed → hide panels
```

**Incremental rendering** (exceptions to full redraw):
- Pulse animation: `setInterval` at 20ms, recolors expanding FOV cells only
- Combat animation: `setTimeout` per turn (700ms), updates combat HP bar in-place

---

## Room State

```typescript
RoomState {
  activatedLevel: number        // 0 (dark) → 8 (max); only increments
  solvedLetter: string | null   // set once, never changed
  completed: boolean            // interaction fully resolved
  encounter: Encounter          // generated once at dungeon start
  incorrectGuesses: string[]    // wrong letters tried
}
```

Key invariants:
- `activatedLevel` only ever goes up, capped by cell's `potentialLevel`
- `solvedLetter` is write-once
- Encounter stats are **not stored** — recomputed from `activatedLevel` each render

**Activation cascade**: when a room is solved, its word-neighbors increment `activatedLevel`. This creates the spreading reveal mechanic.

**Potential level** per cell = `(acrossWordLen - 1) + (downWordLen - 1)`, max 8.

---

## Encounter & Combat Flow

### Correct Guess

```
tryGuess(x, y, letter) → letter matches
  ├─ markRoomSolved(x, y, letter)
  │   ├─ set solvedLetter
  │   ├─ emitDungeonEvent({ type: 'room:solved', x, y })
  │   └─ increment word-neighbors' activatedLevel
  ├─ check if puzzle complete → emitDungeonEvent('puzzle:complete')
  ├─ handle encounter reward (XP, items, gold, mana)
  ├─ run pulse animation
  └─ show interaction popup (if treasure/monster resolved)
```

### Incorrect Guess

```
tryGuess(x, y, letter) → wrong
  ├─ add to incorrectGuesses
  ├─ mana cost
  ├─ if activatedLevel > 0: encounter attacks (damage/drain/side effects)
  ├─ check HP/mana game-over
  ├─ run pulse animation (red)
  └─ render()
```

### Combat (resolved when room solved)

Monster combat is animated turn-by-turn. `resolveCombat()` is a **pure function** that returns the full turn array upfront, then `runCombatAnimation()` plays it back:

```
resolveCombat(playerDmg, playerHp, monsterDmg, monsterHp, xp, ...)
  → CombatResult { turns[], won, manaOver, xpAwarded }

runCombatAnimation(result)
  ├─ show opening message
  └─ setTimeout per turn at 700ms
       ├─ update combatMonsterHp, hp, mana
       ├─ render() (flashes HP bar)
       └─ on final turn: apply results, XP/level-up, check puzzle complete
```

During combat: `combatRunning = true` blocks all input.

---

## UI Panels

### Layout

```
#ui  (flex row, 60/40, max-width 1200px centered)
  #main  (60%, top-aligned)
    #dungeon-level     ← "Dungeon 3" + hints (borderless, above canvas)
    #dungeon           ← rot.js canvas
    #clues             ← crossword letter hint
    #interaction-popup ← modal overlay (discovery / combat)
  #sidebar  (40%)
    #hero              ← player stats (two flex rows: HP/DMG/DEF, MANA/GOLD/XP), equipment, inventory
    #encounter         ← current room description OR bonus room panel
    #interaction-log   ← puzzle solved message
#help-overlay          ← modal help dialog
```

### Panel Lifecycle

**Hero panel** (`renderHeroPanel()`): rewritten on every `render()`. HP/mana bars use CSS `flash` class for blink animation.

**Encounter panel**: written when player is in a letter room. Shows encounter description, stats at current `activatedLevel`, incorrect guesses. Stat lines (HP/DMG/DEF or DRAIN) are grouped into a flex row by `renderEncounterHtml()`. Hidden when room is completed.

**Bonus room panel**: when player enters an extra room, `def.renderPanel(room, ctx)` returns HTML → written to `#encounter`. Each room type renders its own panel. Cleared when room is completed.

**Interaction popup** (`#interaction-popup`): modal overlay. Shows discovery messages, combat results, shop feedback. Blocks most input. Dismissed by SPACE. On dismiss: may mark room completed.

**Popup vs panel**:
- Panel = persistent sidebar content for current room
- Popup = transient overlay with a message to acknowledge

### Encounter Panel + Popup: Full State Machine

This is a common source of confusion. The encounter panel and popup are independent elements that interact through `state.completed` and `popupOpen`.

**`#encounter` panel visibility logic** (evaluated on every `render()`):

```
if (gameOver)           → openPopup(GAME OVER), hide clues, skip encounter panel
else if (in extra room):
  if completed          → hide encounter panel
  else                  → encounter panel = def.renderPanel()
  return early          ← clues always blank for extra rooms
else (letter room):
  show clues
  if completed          → hide encounter panel
  else                  → encounter panel = formatEncounter(...)
```

**Popup lifecycle for a letter-room guess:**

```
1. Player presses letter key
2. tryGuess() resolves encounter
   → showInteraction(lines) opens popup, sets popupOpen = true
   → render() called (encounter panel still visible; state.completed still false)
3. Player sees: popup overlay + encounter panel still showing behind it
   (combat popup overlays the sidebar with .popup-open class hiding the panel)
4. Player presses SPACE
5. dismissPopup():
   → popupOpen = false
   → hides popup element
   → if state.solvedLetter is set → state.completed = true
6. render() called again
   → encounter panel now hidden (completed = true)
```

**Key detail**: `state.completed` is set in `dismissPopup()`, NOT in `tryGuess()`. The encounter panel remains visible until the player explicitly dismisses the popup. This means:
- During combat animation: popup shows turn-by-turn, encounter panel visible behind it
- After dismissal: encounter panel disappears and stays gone for the rest of the level

**Combat popup special case**: when `combatRunning = true`, `showInteraction()` omits the `[SPACE] Continue` footer and adds `.popup-open` to the sidebar (visually hides the panel area). The popup auto-updates each turn. Only the final turn re-adds the `[SPACE]` footer.

**Extra room popup dismissal**: same flow, but `dismissPopup()` sets `extraRoom.completed = true` (not `state.completed`) — and only for non-shop, non-boss rooms. Shop and boss rooms are never auto-completed on popup dismiss.

---

## Extra Rooms (Bonus Rooms)

### Pattern

```
ExtraRoomDef (static — one per room type)
  ├─ buildState(ctx, available) → ExtraRoomState | null
  ├─ onEvent(room, event, ctx)  ← reacts to dungeon events
  ├─ renderPanel(room, ctx)     → HTML string
  └─ handleInput(room, key, ctx) → boolean (consumed?)

ExtraRoom (per-level instance)
  ├─ def: ExtraRoomDef
  ├─ pos: { x, y }
  └─ state: ExtraRoomState      ← mutable, per-run
```

`Game` holds `extraRooms: ExtraRoom[]`. Extra rooms are placed during `initRoomStates()`.

### Event System

```typescript
type DungeonEvent =
  | { type: 'level:start' }
  | { type: 'room:solved'; x: number; y: number }
  | { type: 'room:completed'; x: number; y: number }
  | { type: 'puzzle:complete' }
```

`emitDungeonEvent(event)` iterates all extra rooms and calls `def.onEvent()`. This is the **loose coupling** mechanism — bonus rooms don't hold references to Game.

**When events are emitted:**
- `level:start` — at end of `regenDungeon()` after all rooms initialized
- `room:solved` — in `markRoomSolved()`, after solvedLetter set
- `puzzle:complete` — after all rooms solved, before boss unlock
- `room:completed` — after interaction popup dismissed (rarely used by defs)

### RunContext

`RunContext` is the interface bonus rooms use to read/mutate game state without coupling to `Game` directly. Passed as `ctx` to all def methods.

Read-only: `dungeonLevel, gold, hp, maxHp, mana, maxMana, effectiveDamage, effectiveDefense, puzzleComplete, archPuzzle, puzzleWords, unusedPuzzleWords, equippedItemsFull`

Actions: `addGold(), takeDamage(), applyStatBonus(), advancePuzzle(), triggerVictory(), showInteraction(), render(), tradeEquippedItem()`

Shop: `renderShopPanel(), shopPurchase()`

Queries: `isRoomSolved(pos), getVeryHiddenRooms()`

---

## Input Handling

```
keydown → handleKey(e)
  ├─ Escape → close help
  ├─ ? → open help
  ├─ combatRunning || pulseRunning → ignore
  ├─ popupOpen:
  │   └─ SPACE → dismiss popup (or restart if game over/won)
  ├─ in completed bonus room → skip
  ├─ in active bonus room:
  │   └─ def.handleInput() → if consumed, return
  ├─ SPACE → toggle map view
  ├─ in letter room, not completed:
  │   ├─ 1-4 → useConsumable()
  │   └─ a-z → tryGuess()
  └─ arrows → movePlayer() or show locked-door message
```

**Input blocking flags:** `combatRunning`, `pulseRunning`, `popupOpen` — all checked at top of `handleKey`.

---

## Player State

All on `Game` instance:

| Group | Fields |
|---|---|
| Vitals | `hp`, `maxHp`, `mana`, `maxMana` |
| Combat | `dmg` (base), `baseDef`, `level`, `xp` |
| Resources | `gold`, `hpPotions`, `manaPotions`, `revealScrolls`, `intoneScrolls` |
| Equipment | `equipped: { weapon, armor, amulet }` |
| Progression | `dungeonLevel`, `gameOver`, `gameWon`, `puzzleComplete` |
| Run-wide | `archPuzzle`, `hasMetSimm`, `selectedWordKeys` |

**Effective stats** (computed, not stored):
- `effectiveDmg()` = base + weapon + amulet bonuses
- `effectiveDef()` = base + armor + amulet bonuses
- `effectiveMaxHp()`, `effectiveMaxMana()` = base + amulet bonuses

Equipping/unequipping must cap current HP/mana to new effective max.

**XP leveling**: threshold = `100 * 1.2^level / 10` (rounded). On level-up: `maxHp+10, maxMana+5, dmg+1, baseDef+1`.

---

## Arch Puzzle

The arch puzzle is a run-wide hangman word selected from the puzzle's words at dungeon level 1. It persists across `advancePuzzle()` but resets on `restart()`.

- Boss room (unlocks after `puzzle:complete`): handles guessing A–Z input
- Correct completion: `ctx.triggerVictory()` → game won
- Failure: fall to next level
- Letters can be granted as rewards from hidden/trapped rooms via `revealArchLetter()`

---

## Common Gotchas

1. **Stats are recomputed, not stored.** Don't cache `getMonsterStats()` output — it must be called with current `activatedLevel`.

2. **`render()` is always a full redraw.** Don't try to partially update the dungeon canvas — just call `render()`.

3. **Combat is async.** After `tryGuess()` triggers combat, control returns immediately. `combatRunning` blocks input until animation finishes. Don't assume game state is final after calling the guess handler.

4. **`emitDungeonEvent` order matters.** `room:solved` is emitted before `puzzle:complete`. Dragon treasure depends on this (checks if its dragon room is solved).

5. **Extra room input consumes before letter guessing.** Shop keys (1–6 in shop, a–z for boss) intercept before `tryGuess`. A bonus room def returning `true` from `handleInput` prevents the letter guess.

6. **`level:start` emitted at dungeon gen time, not on player entry.** All extra rooms initialize their state at dungeon creation. Don't assume player has done anything yet when `level:start` fires.

7. **Incorrect guesses in dark rooms (level 0) do no encounter damage.** Encounter only attacks if `activatedLevel > 0`.

8. **Parity flip** in puzzle selection means alternate runs use different room layouts from the same puzzle. `selectWords` uses `parity` to constrain which rows/cols are eligible for word alignment.
