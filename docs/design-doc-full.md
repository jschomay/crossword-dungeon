# Crossword Dungeon - Complete Design Document

## Overview

A roguelike game that transforms crossword puzzles into tactical dungeon crawls. Players navigate a grid of interconnected rooms (letters), strategically choosing which words to solve while managing cascading difficulty through a unique level-activation system.

## Core Concept

Each letter in a crossword becomes a room in a dungeon. Solving rooms (guessing letters correctly) rewards the player but activates levels in connected rooms, raising their difficulty. Players must carefully plan their solve order to maximize rewards while avoiding powering up dangerous encounters beyond their capability to survive.

## Game Flow

### Run Structure
1. Player starts a new run with basic stats and minimal inventory
2. Game loads a random crossword puzzle from the ipuz library
3. Words are randomly removed to adjust sparsity (difficulty)
4. Player navigates and solves the puzzle
5. Upon completing all words, player advances to next puzzle with carried-over state
6. Run continues until player reaches 0 HP or 0 mana
7. Death = permadeath, start new run from beginning

### Puzzle Progression
- **Difficulty scaling**: Primarily through sparsity (number of words/intersections)
- **Early puzzles**: 3-5 short words, minimal intersections
- **Later puzzles**: Denser grids, longer words, more intersections
- **Additional scaling** (future): Word obscurity (puzzle difficulty level), stronger encounter types

## Map & Navigation

### Map Generation
- Source: Published ipuz format crossword puzzles
- Processing:
  - Randomly remove words to achieve target sparsity
  - Retain letters that intersect with remaining words
  - **Critical requirement**: Validate resulting graph is fully connected (no isolated word groups)
  - Black squares = impassable barriers between words

### Room Structure
Each room represents one letter and displays:
- `?` - Unsolved letter placeholder
- Letter - Once solved
- `.` - Potential level indicators (one per connected room it can see)
- `+` - Activated level indicators (locked in when room is solved)
- `@` - Player position

### Navigation
- Movement is discrete, room-to-room only
- Player can only move to orthogonally adjacent letter squares (cardinal directions)
- Black squares block movement
- Starting position: Random room in the puzzle

## Room Mechanics

### Level System

**Potential Level**
- Equals the number of other unsolved rooms the current room can "see"
- "Can see" = all other letters in the same word(s)
- Displayed as `.` symbols
- Maximum of 9 levels
- Example: Letter 'M' in "ARM" (across) that also intersects "MAT" (down) sees 2 rooms left + 2 rooms down = potential level 4

**Activated Level**
- When a room is solved, it activates one level in every other unsolved room it can see
- Potential `.` becomes activated `+` in those rooms
- Activated levels increase encounter difficulty
- When a room is solved, its own activated level is "locked in" and remaining potential levels (`.`) are removed

**Example Progression**
```
Initial state: Room has 4 potential levels
Display: ....

Two adjacent rooms get solved:
Display: ++..

Player solves this room at level 2:
Display: ++
(The two remaining potential dots are removed, locked at level 2)
```

### Encounters

Each room contains exactly one encounter, randomly assigned from a pre-generated catalog:
- **Monsters**: Combat encounters
- **Traps**: Skill checks that damage on failure
- **Treasure**: Rewards with no downside

### Room Interaction Flow

**Entering a Room**
- Shows crossword clue(s) for word(s) containing this letter (1-2 clues depending on intersection)
- Reveals encounter type and current activated level (e.g., "Level 2 Goblin")
- Shows encounter stats/description
- No automatic consequence - player can retreat

**Guessing a Letter (costs 1 mana)**

*Wrong Guess:*
- **Monster**: Takes one hit of damage from monster, monster vanishes
- **Trap**: Takes trap damage based on activated level, trap remains unsolved
- **Treasure**: No consequence except wasted mana
- Room remains unsolved, can retry later

*Correct Guess:*
- **Monster**: 
  - Auto-battle initiated
  - Player attacks first
  - Turn-based combat until player or monster reaches 0 HP
  - Damage based on player level + weapon + shield vs monster stats
  - Victory grants XP and possible loot
- **Trap**:
  - Successfully disarmed (no damage)
  - Grants XP and possible loot
- **Treasure**:
  - Grants rewards (items, potions, consumables)
  - Grants XP

*Upon Successful Solve (all encounter types):*
1. Room's `?` becomes the guessed letter
2. Room's activated level locks in (removes remaining `.` symbols)
3. Every other unsolved room this room can see gets one level activated (`.` → `+`)

## Player Systems

### Core Stats
- **HP (Hit Points)**: Health, reaching 0 = death/game over
- **Mana**: Resource for guessing letters (1 per guess)
- **XP (Experience)**: Accumulates from solving rooms
- **Level**: Character level, increases with XP

### Leveling Up
- Threshold-based (exact values TBD via playtesting)
- On level up:
  - HP restored to full
  - Mana restored to full
  - Max HP increases
  - Max Mana increases
  - Damage/defense scale up

### Inventory System
- Contains weapons, shields, armor
- Contains consumable items: HP potions, mana potions, spell scrolls, puzzle hints/reveals
- Inventory limit: TBD (possibly unlimited for MVP, cap added if hoarding becomes trivial)

### Item Usage
- Consumables can be activated anytime except during auto-battle
- Can use before entering a room, while in a room before guessing, or after combat
- MVP: Instant effects only (no time-based buffs/DoTs)

## Encounter Catalog

### Pre-generation
- Large static catalog of encounters per type
- Each encounter includes:
  - Name and description
  - Base stats
  - Stats/behavior for levels 0-9
  - Rewards per level

### Scaling by Level
- **Level 0**: Base encounter
- **Higher levels**: 
  - Increased HP/damage
  - Possible threshold unlocks (armor, spells, special abilities)
  - Better rewards
- Balance: Keep RPG complexity minimal, focus on puzzle-RPG tension

### Assignment
- Random draw from catalog when generating puzzle
- One encounter per room

## Victory & Progression

### Puzzle Completion
- All words solved = puzzle complete
- Immediate transition to next puzzle
- Optional: Single end-of-level bonus choice (future feature)
- Player state carries over: Level, XP, HP, mana, inventory

### Defeat
- HP reaches 0: Game over
- Mana reaches 0: Game over (cannot guess any more letters)
- Permadeath, start new run

## Technical Implementation Notes

### Puzzle Loading
- Random selection from ipuz puzzle library
- Word removal algorithm to achieve target sparsity
- **Graph connectivity validation**: Must ensure all remaining words form a single connected component
- Solution: Check connectivity after removal; if disconnected, retry removal or reconnect by adding back strategic words

### Rendering (rot.js)
- ASCII dungeon rendering from ipuz grid structure
- Account for doors/connections between rooms
- Dynamic calculation of potential levels (count unsolved neighbors in same word)
- Display activated levels (`+`) vs potential levels (`.`)
- Highlight player position (`@`)
- Show revealed letters vs unsolved (`?`)

### State Management
- Player state: Stats, inventory, position
- Room state: Letter (solved/unsolved), activated level, locked level, encounter, encounter status
- Puzzle state: Grid layout, word list, clue list

### Player Actions
- Movement: Room-to-room navigation
- Guess letter: Mana check → encounter resolution → room update → level activation cascade
- Use item: Inventory management, instant effect application
- View: Clues, stats, inventory

## Open Questions for Playtesting

- Starting HP/mana values
- XP thresholds for leveling
- Mana cost per guess (currently 1, might need adjustment)
- Inventory capacity limits
- Exact damage formulas for combat
- Level scaling curves for encounters
- Sparsity targets per puzzle tier
- End-of-level bonus system (if any)

## MVP Feature Scope

**In Scope:**
- Core puzzle-dungeon hybrid gameplay
- Basic RPG stats (HP, mana, XP, level)
- Three encounter types (monster, trap, treasure)
- Level activation cascade system
- Turn-based auto-combat
- Simple inventory and items
- Puzzle progression with state carryover
- Permadeath

**Out of Scope (Future):**
- Meta-progression between runs
- Seeded runs / leaderboards
- Time-based effects (buffs, DoTs, poison)
- Complex encounter mechanics
- Puzzle difficulty beyond sparsity (word obscurity, themed encounters)
- Save/load system
- Multiple character classes or builds

## Success Metrics

A successful MVP demonstrates:
1. Strategic depth in solve-order decisions
2. Meaningful tension between puzzle-solving and resource management
3. Emergent difficulty from the cascading level system
4. Replayability through randomized puzzles and encounters
5. Clear win/loss conditions with fair difficulty curve
