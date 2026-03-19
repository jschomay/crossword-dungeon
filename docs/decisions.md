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

## Sparse Dungeon Generation: Odd Row/Col Constraint

When selecting a subset of words from a full crossword to form the dungeon, a naive build-up (add a word by threading through any shared cell) produces invalid sparse grids. The problem: if two parallel across words are both selected, any down word crossing both will appear in the sparse grid with only its intersection cells kept — creating a broken stub word rather than a valid entry.

**Solution (chosen): odd row/col constraint.** Across words are only eligible if they lie on an odd row (0-indexed); down words only if they lie on an odd column. Expansion only happens through intersection cells that are at an odd col (for across→down) or odd row (for down→across). This guarantees that any crossing word runs entirely along an odd row or col, so all of its own intersection points are also at valid odd positions — no word can ever be partially included. The constraint naturally prevents parallel words from sharing a crossing word's intermediate cells.

**Why it works:** In a standard crossword every word's interior cells lie strictly between its two endpoints. If both endpoints are at odd positions, the word itself lies on an odd row or col and is always fully selected as a unit. The even rows/cols are simply never entered, so their cells are always blacked out consistently.

## Sparse Dungeon Generation: Dead-End Seeds and Retry Strategy

When building a sparse dungeon via the frontier expansion algorithm, some seeds produce clusters that are smaller than the target word count. This happens when a seed word lands in a corner of the full puzzle where the only expandable crossing words are filtered out — most commonly because their clues reference other clue numbers (e.g. "See 65-Across") and are excluded from eligibility. The frontier exhausts before reaching the target.

**Solution (chosen): retry on short result.** `regenDungeon` calls `selectWords` in a loop until the returned set meets the target count. Since most seeds succeed, retries are rare and cheap.

**Why not fix the root cause:** Allowing cross-ref words into eligibility would require either displaying broken clues in-game or synthesizing replacement clues — more complexity than the retry approach warrants.

Both approaches were prototyped. Cell-by-cell movement (one display character per keypress) was rejected because it required too many keypresses to navigate, felt slow, and gave no gameplay reason to visit corridor cells. Room-to-room movement (one keypress = jump to adjacent letter room) was kept as it matches the crossword structure and feels snappy.
