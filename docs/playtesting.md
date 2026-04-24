# Playtesting Guide (for Claude)

## Starting the server

```bash
npx tsx scripts/playtest-server.ts &
sleep 3
```

Run from the project root. The `&` runs it in the background. Wait 3 seconds before first request or it won't be ready. The server loads the `?puzzle=debug` puzzle at dungeon level 3.

## Interacting across turns

Each `Bash` call is stateless but the server process holds live game state. Interact via HTTP:

```bash
curl -s "http://localhost:3001/state"             # current snapshot, no action
curl -s "http://localhost:3001/key?k=ArrowUp"     # move (ArrowUp/Down/Left/Right)
curl -s "http://localhost:3001/key?k=a"           # guess letter a
curl -s "http://localhost:3001/key?k=1"           # use consumable 1-4
curl -s "http://localhost:3001/dismiss"           # dismiss popup (Space)
curl -s "http://localhost:3001/debug"             # show room connections from player pos
```

Every endpoint returns the full snapshot. Read it, decide next action, make another call.

## Shutting down

```bash
pkill -f playtest-server
```

## Reading the snapshot

Every response has this structure:

```
=== player @ grid(x,y)  Dungeon Level N ... ===
[full 43×43 grid]     [compact room map]
--- HERO ---
--- ENCOUNTER ---
--- CLUES ---
--- POPUP ---          ← only appears when popup is open
```

### Full grid (left side)
The raw rotjs display output. Useful for verifying wall/corridor layout matches the compact map. `@` is the player. `#` are walls. Spaces between rooms are corridors (open) or walls (blocked). `=` in a corridor gap means locked.

### Compact room map (right side, after column 48)
One character per room, corridors shown between them. This is what to navigate by.

**Room center characters:**
- `@` — you (player)
- `A-Z` — solved letter room (the crossword answer for that cell)
- `?` — unsolved letter room (dark, or hidden/very-hidden extra room)
- `*` — activated letter room, monster encounter
- `!` — activated letter room, trap encounter
- `$` — activated letter room, treasure encounter — also dragon treasure room
- `.` — activation dots inside a room (up to 8, one per activation level); colored by encounter kind
- `%` — shop, or other bonus room type
- `/` — exit room (locked until puzzle complete)
- `&` — Simm NPC or other special bonus room
- `[ ]` — very hidden room (no connections shown, appears as empty brackets)

**Corridor characters:**
- `-` — open horizontal corridor
- `|` — open vertical corridor
- `=` — locked horizontal corridor
- `‖` — locked vertical corridor
- ` ` (space) — no corridor (rooms not connected)

### HERO panel
HP, mana, DMG, DEF, XP, gold, and consumable counts. Always visible.

### ENCOUNTER panel
Hidden when the current room is completed. Content when visible:
- Letter room (unsolved/active): encounter description and stats
- Shop: shop inventory with prices
- Other special rooms: their panel content

### CLUES panel
Shows the across and/or down crossword clues for the current letter room. Empty for special rooms.

### POPUP
Only appears on status updates: using a consumable, hitting a locked door, combat results, room discoveries, etc. **Blocks all movement and input until dismissed.** Always dismiss with `/dismiss` before trying to move or act. If movement seems stuck, check whether a popup is open.

## Game mechanics to know

- **Crossword grid**: each room is a crossword cell. Rooms are connected to neighbors if both cells are valid (non-black) in the puzzle.
- **Activation**: dark rooms (`·`/`?`) become activated when a neighbor room is solved, revealing the encounter type.
- **Solving a room**: press a letter key (a-z) to guess the crossword answer. Correct = room solved, neighbors activate. Wrong = mana cost + encounter attacks if room is activated.
- **Boss room `/`**: locked until the whole puzzle is complete. Has locked corridors on both sides.
- **Consumables** (keys 1-4): Heal, Restore mana, Inscribe (reveal letter), Intone (reveal word). Using one opens a popup — dismiss before moving.
- **Combat**: resolves instantly in the harness (animation skipped). Final state is correct.

## Bug reproduction with fixtures

When a bug requires a specific dungeon layout that may not appear in normal play, use a hand-crafted fixture instead of hoping the generator produces the right configuration.

### How it works

The `/load` endpoint reads a JSON fixture from `tests/fixtures/<name>.json`, constructs a `Puzzle` and `Dungeon` directly from it, and injects the result into the live game instance — bypassing the puzzle generator entirely. The game runs normally from that point.

```bash
curl -s "http://localhost:3001/load?fixture=dragon-bug"
```

### Fixture format

```json
{
  "ipuz": {
    "version": "http://ipuz.org/v1",
    "kind": ["http://ipuz.org/crossword#1"],
    "dimensions": { "width": 3, "height": 2 },
    "puzzle": [["#", 1, "#"], ["#", 2, 3]],
    "solution": [
      ["#", "B", "#"],
      ["#", "C", "D"]
    ],
    "clues": {
      "Across": [[2, "Some clue"]],
      "Down": [[1, "Some clue"]]
    }
  },
  "playerPos": { "x": 2, "y": 1 },
  "roomStates": {
    "1,0": { "activatedLevel": 3, "solvedLetter": null, "completed": false, "incorrectGuesses": [] },
    "1,1": { "activatedLevel": 1, "solvedLetter": null, "completed": false, "incorrectGuesses": [] },
    "2,1": { "activatedLevel": 1, "solvedLetter": null, "completed": false, "incorrectGuesses": [] }
  },
  "extraRooms": [
    {
      "type": "dragon_treasure",
      "pos": { "x": 2, "y": 0 },
      "locked": true,
      "completed": false,
      "hidden": false,
      "veryHidden": false,
      "glowColor": "#ffaa00",
      "connectedTo": { "x": 1, "y": 0 },
      "state": { "dragonPos": { "x": 1, "y": 0 }, "goldAmount": 150, "looted": false }
    }
  ]
}
```

**Key points:**
- `solution` controls which grid positions are rooms (`#` = no room, any letter = room). Extra rooms are placed at positions that are `#` in the solution — the extra room overrides the black square.
- `roomStates` keys are `"x,y"`. Any room in the solution grid that isn't in `roomStates` won't be interactable. `encounter` is optional — one will be generated if omitted.
- `extraRooms` fields: `type`, `pos`, `locked`, `completed`, `hidden`, `veryHidden`, `glowColor` are required. `connectedTo` restricts corridor drawing to one neighbor (used for dragon treasure). `state` shape depends on room type.
- Player `activatedLevel > 0` means the encounter type is visible. `activatedLevel = 0` means dark/unknown.

### Designing for a specific bug

Think about the minimal grid that forces the condition. For the locked-door-from-wrong-side bug, the key constraint was: a locked extra room with `connectedTo` pointing away from the player's starting position. A 3×2 grid with the player below the extra room was enough to reproduce it in two moves.

Keep fixtures small — the smaller the grid, the easier it is to navigate to the bug in a few keystrokes.

## Things that will trip you up

- **One curl at a time.** If you chain multiple curl calls in one Bash command, a popup opened by the first call will silently swallow subsequent key inputs — the keys are ignored while popup is open and you won't know why movement stopped working. Always check the full snapshot after each action before sending the next one.
- **Never use grep, head, or tail on curl output.** Read the full snapshot every time — the popup, encounter text, clues, hero stats, and map all matter together and give context you'll miss if you truncate. If something seems off, the answer is usually visible somewhere in the full output.
- **Popup blocks all input.** If a key press has no effect, check for a `--- POPUP ---` section and dismiss first. This includes movement — ArrowUp while a popup is open does nothing.
- **Random start position.** Player spawns at a random room each server start. Check `player @ grid(x,y)` and the compact map to orient yourself before acting.
- **Server must be killed and restarted to reset game state.** There's no `/restart` endpoint — just `pkill -f playtest-server` and start fresh.
- **Debug endpoint is useful.** `/debug` shows `hasRoom`, `connected`, `locked` for all four neighbors of the current player position. Use it when movement behaves unexpectedly.
