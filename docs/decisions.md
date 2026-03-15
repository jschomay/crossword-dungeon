# Design Decisions

## Room State Location: game.ts vs puzzle.ts

`puzzle.ts` is a stateless utility layer: ipuz parsing, word structure, potential level calculation. It has no concept of mutable game state. Room states (solved letter, activated level) live in `game.ts` as `Map<string, RoomState>`. `puzzle.ts` exposes `getWordNeighbors(coord)` to return coords sharing a word; `game.ts` filters for unsolved when propagating activation. Potential level stays pre-computed in `puzzle.ts` since it derives purely from puzzle structure and never changes.

## Movement Keys: Arrow Keys Only

WASD and hjkl movement bindings were removed because all 26 letters must be available for solving rooms (typing the answer letter). Arrow keys are the sole movement input. Roguelike vim-key movement is a nice-to-have but directly conflicts with the core crossword mechanic.

## Stat Flash: Predicate-Based vs Container-Class Approach

When animating stat changes (hero HP, monster HP bar), two approaches were considered:

**A (chosen): Predicate parameter** — `renderEncounterHtml` accepts an optional `flashLine?: (line: string) => boolean`. The caller passes a predicate (e.g. `line => line.startsWith('HP:')`) when a stat changes. `colorLine` adds `class="flash"` to matching spans. Simple to implement and trigger correctly.

**B (alternative): Container class toggle** — `colorLine` always emits semantic classes (`class="flash-hp"`, etc.) on every stat span. Flashing is controlled by toggling a parent class on the container element. Fully decoupled from line order or content — adding/reordering stats never breaks it. Downside: requires a `requestAnimationFrame` trick to re-trigger CSS animations on an already-present class.

Option A chosen for now as it's simpler. Option B is worth revisiting if the panel gains many dynamic stats or the predicate coupling becomes awkward.

## Player Movement: Room-to-Room vs Cell-by-Cell

Both approaches were prototyped. Cell-by-cell movement (one display character per keypress) was rejected because it required too many keypresses to navigate, felt slow, and gave no gameplay reason to visit corridor cells. Room-to-room movement (one keypress = jump to adjacent letter room) was kept as it matches the crossword structure and feels snappy.
