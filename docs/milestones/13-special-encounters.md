# Milestone 13: Special Encounters

## Goal
Add five unique encounter types with special mechanics that create new strategic challenges and variety.

## Context
- These encounters build on existing monster/trap patterns but add special behaviors
- Cage Trap: Locks player in room on wrong guess
- Slime Blob: Splits into adjacent rooms when defeated
- Thief: Steals gold and flees to other rooms when hit
- Thieving Modifier: New monster modifier that steals gold on wrong guess
- Dormant Sentinel: Powerful enemy that doesn't fight back for first 5 turns
- All use existing code patterns (combat, room solving, encounter assignment)

## Encounter Details

### Cage Trap
**Type:** Trap encounter
**Unlock condition:** Must solve room to escape

**Mechanics:**
- Functions like normal trap for correct guesses (disarm, award XP, solve room)
- Special behavior on wrong guess:
  - No damage
  - All exits from room lock (corridors become impassable)
  - Player cannot leave room until room is solved
  - Room remains unsolved after wrong guess
- Escaping the cage:
  - Option 1: Guess correctly (solves room, unlocks exits, awards XP)
  - Option 2: Use spell (solves room, unlocks exits, no reward per normal spell behavior)
- Repeated wrong guesses: Normal mana cost, stays locked
- Player can still access inventory, use potions, view stats while caged

**Visual/Text:**
- Encounter panel: "Each door has a heavy rusted portcullis."
- On wrong guess: "The portcullises slam down around you! You are trapped!"
- On escape (any method): "The iron bars dissolve into piles of rust, you are free."

**Configuration:**
```json
{
  "name": "Cage Trap",
  "type": "trap",
  "base_damage": 0,
  "damage_growth": 0,
  "base_xp": 10,
  "xp_growth": 3,
  "min_level": 2
}
```

---

### Slime Blob
**Type:** Monster encounter
**Special mechanic:** Splits into adjacent rooms when defeated in combat

**Base Stats:**
- HP: 20 base, standard growth per level
- Damage: Mid-range, standard growth
- Defense: 0 (no defense)
- XP: Standard monster XP per level

**Mechanics:**
- Combat works like normal monster
- On defeat in combat (not spell kill):
  - Room is solved (normal monster defeat behavior)
  - Award XP for this slime
  - Trigger split behavior
- Split behavior:
  - For each adjacent unsolved normal encounter room (monster/trap/treasure)
  - Replace that room's encounter with a new slime blob
  - New slime stats: HP = original slime's max HP / 2 (round up), Level 1, no mods
  - Original encounter is permanently lost
  - Post-combat status message: "The slime bursts! Smaller blobs ooze into adjacent rooms."
- Stop splitting when: Next generation HP would be < 1, or no adjacent valid rooms
- Each new slime is independent:
  - Can level up via cascade
  - Can gain mods at thresholds
  - Awards XP when defeated
  - Can split again if HP allows and has viable adjacent rooms to split into
- Spell kill: No split, normal spell behavior (room solved, no XP, no split)

**Visual/Text:**
- Encounter panel: "A quivering blob of translucent slime."
- On defeat with split: "The slime bursts! Smaller blobs ooze into adjacent rooms."
- On defeat without split: "The slime dissolves into a harmless puddle."

**Configuration:**
```json
{
  "name": "Slime Blob",
  "type": "monster",
  "base_hp": 20,
  "hp_growth": 3,
  "base_damage": 3,
  "damage_growth": 1,
  "base_defense": 0,
  "base_xp": 12,
  "xp_growth": 3,
  "min_level": 2
}
```

---

### Thief
**Type:** Special monster encounter
**Special mechanic:** Steals gold and teleports to treasure rooms when hit

**Base Stats:**
- HP: Low/mid (suggest 15 base, +2 per level)
- Damage: 0 (doesn't attack)
- Defense: 0
- XP: Standard monster XP

**Mechanics:**
- **Generation:** Max 1 thief per dungeon level, remove from encounter pool after selection
- Combat behavior:
  - Player attacks first (normal turn-based)
  - After first player hit, check thief HP:
    - If HP = 0: Thief defeated, award all stolen gold + XP, room solved
    - If HP > 0: Thief steals and flees
- Steal and flee:
  - Calculate gold stolen: 10 × thief's current level
  - Deduct from player gold (never go below 0, steal what player has)
  - Track total stolen gold for this thief
  - Mark current room as solved (reveal letter, normal completion)
  - Find random unsolved normal treasure room in current dungeon
  - Teleport thief to that room (permanently replace treasure encounter)
  - Thief carries over remaining HP to new location
  - Status message: "The thief grabs [X] gold and dashes away!"
- Thief can level up from cascade after teleport like normal (affects next steal amount)
- Teleport destination can be unrevealed `?` treasure room
- Chase continues until:
  - Player defeats thief: Reward all accumulated stolen gold + XP
  - No unsolved treasure rooms remain: Thief vanishes with gold (no reward, no message)
- Spell kill: Thief dies, no steal, no teleport, no gold reward, room solved

**Visual/Text:**
- Encounter panel: "A shifty thief in the shadows eyes your gold."
- On steal + flee: "The thief grabs [X] gold and dashes away!"
- On final defeat: "You recover [X] stolen gold."

**Configuration:**
```json
{
  "name": "Thief",
  "type": "monster",
  "base_hp": 15,
  "hp_growth": 2,
  "base_damage": 0,
  "damage_growth": 0,
  "base_defense": 0,
  "base_xp": 10,
  "xp_growth": 4,
  "min_level": 2,
  "max_per_level": 1
}
```

---

### Thieving Modifier
**Type:** Monster modifier (like Frenzied, Armored, etc.)
**Applies to:** Monsters only (not traps)

**Mechanics:**
- Works like existing mana drain modifier pattern
- Can appear at threshold levels (3 or 6)
- Cannot stack (only one thieving mod per monster)
- Appears in monster name: "Thieving Goblin", "Thieving Armored Dragon"
- On wrong guess and every monster hit:
  - Player takes normal damage from monster
  - Monster steals 10 gold (flat amount, doesn't scale)
  - Deduct from player gold (never go below 0)
- Gold is permanently lost (not recovered on monster defeat)

**Visual/Text:**
- Modifier description: "Steals gold"

**Configuration:**
```json
{
  "name": "Thieving",
  "description": "Steals gold",
  "hp_multiplier": 1.0,
  "damage_multiplier": 1.0,
  "xp_multiplier": 1.1,
  "special_effect": "steal_gold_on_wrong_guess",
  "steal_amount": 10
}
```

---

### Dormant Sentinel
**Type:** Special monster encounter
**Special mechanic:** Doesn't attack for first 5 combat turns

**Base Stats:**
- HP: 50 base, +10 per level
- Damage: 50 base, +20 per level (but 0 for first 5 turns)
- Defense: 0 base
- XP: 1.5 × starting HP (Level 1 = 75 XP, Level 2 = 90 XP, etc.)

**Mechanics:**
- **Generation:** Max 1 sentinel per dungeon level, remove from encounter pool after selection
- Combat behavior:
  - First 5 player turns: Sentinel damage = 0 (doesn't attack back)
  - Combat resolves normally (player attacks, sentinel doesn't respond)
  - After 5th player turn: 
    - Set sentinel damage to actual value (50 + (level - 1) × 20)
    - Display status message: "The sentinel awakens!"
  - From turn 6 onward: Normal turn-based combat (player hit, sentinel hit, repeat)
- If player kills sentinel before turn 6: Combat ends, no awakening message
- Can gain modifiers at threshold levels like normal monsters
- Spell kill: Normal spell behavior (room solved, no XP, no combat)

**Implementation note:**
- Combat system needs to support variable monster damage during combat
- Either: Skip sentinel turns for first 5, or set damage to 0 for first 5 turns then update

**Visual/Text:**
- Encounter panel: "An intimidating but inactive guard from the past."
- On awaken (after 5th turn): "The sentinel awakens!"
- Combat/defeat: Use default combat and defeat messages

**Configuration:**
```json
{
  "name": "Dormant Sentinel",
  "type": "monster",
  "base_hp": 50,
  "hp_growth": 10,
  "base_damage": 50,
  "damage_growth": 20,
  "base_defense": 0,
  "base_xp_multiplier": 1.5,
  "min_level": 3,
  "max_per_level": 1
}
```

---


## Completion Criteria
- [ ] Cage trap locks all exits on wrong guess
- [ ] Cage trap unlocks on correct guess or spell use
- [ ] Player cannot leave caged room until solved
- [ ] Slime blob splits into adjacent normal encounter rooms on defeat
- [ ] Split slimes have half HP (round up), level 1, no inherited mods
- [ ] Slime stops splitting when next gen HP would be < 1
- [ ] Each split slime awards XP when defeated
- [ ] Thief steals (10 × level) gold and teleports on first hit if HP > 0
- [ ] Thief only spawns once per level (max 1)
- [ ] Thief teleports to random unsolved treasure room
- [ ] Thief defeated awards all stolen gold
- [ ] Thief vanishes if no treasure rooms remain
- [ ] Thieving modifier steals 10 gold on wrong guess (monsters only)
- [ ] Thieving appears in monster name
- [ ] Dormant Sentinel doesn't attack for first 5 turns
- [ ] Sentinel awakens after 5 turns with status message
- [ ] Sentinel only spawns once per level (max 1)
- [ ] Sentinel awards 1.5× HP as XP
- [ ] All encounters respect min_level configurations
- [ ] All special behaviors integrate with existing combat/solve systems
