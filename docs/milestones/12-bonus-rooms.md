# Milestone 12: Bonus Rooms & Special Encounters

## Goal
Add variety and flavor to dungeons through special bonus rooms with unique mechanics, rewards, and continuity across levels.

## Context
- Bonus rooms provide strategic opportunities, lore, and variety beyond standard letter rooms
- Some rooms are locked and require conditions to unlock
- Some rooms contain NPCs with dialogue or trading mechanics
- Some rooms are hidden and require discovery
- Dragon treasure rooms are special-cased to spawn with dragon encounters
- All bonus rooms are capped at 1 instance per type per dungeon level

## Room Types & Mechanics

### Normal Encounter Spawning Changes
Normal encounters (monsters/traps/treasures in letter rooms) now have optional level restrictions:

**Configuration example:**
```json
{
  "name": "Encounter name",
  "min_level": 1,
  "max_level": 3
}
```
- `min_level`: Encounter appears in pool starting at this level (default: 1)
- `max_level`: Encounter removed from pool after this level (optional, no max if omitted)
- During room generation, only encounters valid for current dungeon level are in the selection pool

**Configurations**
```json
[
  {
    "type": "dragon",
    "min_level": 2
  },
  {
    "type": "rat",
    "max_level": 3
  },
]
```

### Bonus Room Generation
- After generating crossword and assigning normal encounters
- Loop through all bonus room types
- For each type valid at current dungeon level (based on min/max_level):
  - Roll 30% chance to spawn (except dragon treasure which is special)
  - If roll succeeds, attempt to place room
  - Find valid placement location based on room's requirements
  - Create room and connect to dungeon

### Dragon's Guarded Treasure
**Render:** `$` symbol
**Unlock condition:** Dragon monster in connected room must be defeated
**Spawn logic:**
- Automatically spawns for every dragon encounter in generated puzzle (not included in Bonus Room Generation loop)
- Dragon encounters can only be assigned to letter rooms where there's space to add a connected bonus room
- Requirements: Not at intersection, adjacent spaces don't already have bonus rooms
- If no valid space for treasure room, either swap dragon with adjacent room or re-roll dragon encounter for a different encounter.
- Prefer swapping over re-rolling.

**Room structure:**
- Single corridor connects only to dragon's letter room (locked until dragon defeated)
- Even if adjacent to other letter rooms, those don't get corridors to this room
- Defeating dragon unlocks the room and includes flavor text indicating the loot is available

**Contents:**
- Gold amount = 20 × dragon's level
- No other encounter, just gold
- Press space to loot
- After looting, mark room as "solved," hiding encounter panel and removing `$` symbol


### Fellow Adventurer (Simm)
**Render:** `&` symbol
**Unlock condition:** None (unlocked by default)
**Spawn logic:** Special, spawns every level

**Placement:** Any valid empty cell adjacent to letter rooms

**Interaction:**
- Encounter panel: "A particularly plucky fellow adventurer. Press space to talk."
- Press space: Display dialogue in status log
- Dialogue structure: [Greeting] + [1-2 condition-based content pieces]
- Press space again: Simm disappears (mark room as solved)

**Dialogue System:**

*Greetings (pick 1 randomly):*

Condition - 1st encounter / level 1:
- "Ah, another puzzle solver!"
- "Greetings, fellow adventurer!"
- "Oh! You surprised me, I don't run into many folks down here."

Condition - after 1st encounter / level > 1:
- "Hello again!"
- "We meet again."
- "Oh hi. How are you managing?"
- "You again."
- "Thought I'd see you again."
- "You made it."
- "Good to see you again."
- "You're still here."

*Content*

First encounter (MUST pick one when dungeon_level == 1):
- "I've been poking around these corridors for quite some time. I can't tell you how many puzzles I've solved! Maybe we'll cross paths again."
- "You must be new here. There's plenty of puzzles to solve. Plenty of danger too so watch your step. See you around."
- "That's strange, I thought I recognized you from somewhere... But I've been down here so long, everything starts to look the same. You'll see."
- "Glad you're here. We can compare notes and maybe we'll eventually find a way out."
- "The last adventurer I ran into down here... well... never mind. I'm sure you'll do great!"

Random flavor (any level):
- "How do you like the puzzles? At first they irked me, now they are all I think about."
- "Sometimes you'll find some good loot around here."
- "Nice to see you've made it past the all monsters and traps so far!"
- "We're getting deeper now! Must be close to an exit."
- "Have you made any progress on the magical seal barring the exit?"
- "Impressive! Not many make it this far."
- "You have a respectable level. I stopped counting mine a long time ago."
- "Have you fought a dragon yet? No joke, that."
- "Have you come across the slime blob yet?"
- "If I ever get out, I'm going to write down all of these puzzles in a big book and become famous."
- "Some say these halls used to be the foundations of a lost city."
- "This used to be a safe place. Then smugglers started hiding their loot here. Next thing you know, they built traps to keep it safe. Then the monsters showed up..."
- "You ever wonder who made all these clues? Some say it is the work of multiple cryptic craftsmen, but there's a theory that all these levels are the work of a single mad puzzle setter who just couldn't stop."

*Additional Content*

Player has item equipped (which hasn't previously been commented on):
- "That's a fine [random equipped item name] you've got there."
- "Good thing you've got that [random equipped item name]."
- "Keep upgrading your [random equipped item name]."
- "I see you got a new [random equipped item name]."

Player low HP (<20%):
- "You look a bit rough. Better find some health potion before your next fight!"
- "Are you doing alright? Be careful out there!"
- "Go buy some health potion before you do anything else."
- "Your heath is quite low. Take it slow. I'm hoping you'll be around for a while."

Player low MANA (<20%):
- "You may need to conserve your mana more."
- "Now might be a good time for a mana potion."
- "Your mana is low, maybe there's a shrine around here somewhere to boost it."

**Dialogue selection logic:**
1. Pick one greeting randomly
2. Select 1 random content
2. Select 1 random additional content (if conditions met)
4. Concatenate and display
5. Do not reuse any selected pieces.



### Trapped Adventurer
**Render:** `&` symbol (same as Simm but different color)
**Unlock condition:** All adjacent letter rooms must be solved
**Spawn logic:** 30% chance per level if valid

**Placement:** Empty cell adjacent to 1 or more letter rooms

**Interaction:**
- Encounter panel: "A trapped adventurer. Press space to talk."
- Locked state: "Locked: Solve all adjacent rooms"
- Once unlocked, press space for dialogue
- Dialogue: Flavor about struggling/being trapped, thanks for rescue
- Offers reward (random pick):
  - 30 gold
  - 1 health potion
  - 1 mana potion
  - 1 hint: Tells you one letter in the master boss puzzle and says not to forget it
- Room marked solved after continue

**Configuration:**
```json
{
  "type": "trapped_adventurer",
  "min_level": 2
}
```

### Trader
**Render:** `%` symbol
**Unlock condition:** None
**Spawn logic:** 30% chance per level if valid

**Placement:** Any valid empty cell adjacent to letter rooms

**Interaction:**
- Encounter panel describes trader
- If player has no items: "Come back when you have some items to trade!"
- If player has items: "Do you want to trade your [ITEM_A] for this [ITEM_B]. Press space to accept trade."
- Trade offer: Random item from player's inventory for a different item of 1 level lower with no mods
- Press space: Execute trade (remove old item, add new item), solves room

**Configuration:**
```json
{
  "type": "trader",
  "min_level": 3
}
```

### Hidden Treasure Room
**Render:** Initially invisible (no room shown) then `?`
**Unlock condition:** Player walks through hidden corridor
**Spawn logic:** 30% chance per level if valid

**Placement:** Empty cell adjacent to letter room, corridor marked with special character

**Discovery mechanism:**
- One wall of adjacent letter room shows `+` instead of `#` (crack indicator) where corridor would be
- Walking in that direction reveals the hidden room and adds normal corridor and shows a status message about finding a secret passage

**Contents (random pick):**
- 50 gold hidden loot
- Puzzle setter notes: List of 3 words as clues
  - 1 word is used in current puzzle
  - 2 words are unused (pulled from puzzle's removed words)
- 1 letter hint for master boss puzzle
- Press space to claim, note the list crumbles to dust in your hands (must remember) and mark room as solved

**Configuration:**
```json
{
  "type": "hidden_treasure",
  "min_level": 2
}
```

### Very Hidden Room
**Render:** Initially invisible with no indicator then `%`
**Unlock condition:** Player walks through unmarked corridor
**Spawn logic:** 30% chance per level if valid

**Placement:** Empty cell adjacent to letter room, no corridor indicator

**Discovery mechanism:**
- No wall crack indicator
- Room outline is subtly visible in background characters (if player looks closely)
- Walking in that direction reveals the room

**Contents:**
- Sorcerer NPC
- Encounter panel: "A mysterious sorcerer. Press space for their blessing."
- Offers permanent stat increase (random pick):
  - +10 max HP
  - +5 max mana
  - +3 damage
  - +2 defense
- One-time use, sorcerer disappears after (room is solved)

**Configuration:**
```json
{
  "type": "very_hidden_room",
  "min_level": 1
}
```

### Treasure Hunter
**Render:** `&` symbol
**Unlock condition:** None
**Spawn logic:** 30% chance per level if valid

**Placement:** Any valid empty cell

**Interaction:**
- Encounter panel: "A furtive treasure hunter hides in the shadows. Press space to talk."
- If no very hidden rooms exist on level: "Have you heard about the secret rooms? Sometimes you can find them if you look hard enough. I haven't found any on this level yet."
- If very hidden room exists: "Pssst! I found something! There's a secret room hidden  [direction] of the letter [X]." (gives exact location hint)

**Configuration:**
```json
{
  "type": "treasure_hunter",
  "min_level": 2
}
```

### Cursed Fountain
**Render:** `?` symbol
**Unlock condition:** None
**Spawn logic:** 30% chance per level if valid

**Placement:** Any valid empty cell adjacent to letter rooms

**Interaction:**
- Encounter panel: "A cursed fountain bubbling with dark energy. Press space to drink."
- Offers one random trade (selected from valid options player can afford):
  - +3 damage, -15 max HP (requires ≥15 max HP)
  - +15 max HP, -3 damage (requires ≥3 damage)
  - +10 max HP, -5 max mana (requires ≥5 max mana)
  - +5 max mana, -10 max HP (requires ≥10 max HP)
  - +5 damage, -5 defense (requires ≥5 defense)
  - +5 defense, -5 damage (requires ≥5 damage)
- Only show trades player can actually make (has enough of the stat being traded away)
- Press space: Apply trade permanently, show flavor text
- One-time use per fountain, solved on use

**Configuration:**
```json
{
  "type": "cursed_fountain",
  "min_level": 3
}
```

### Mimic Chest
**Render:** `$` symbol (looks identical to treasure chest)
**Unlock condition:** None
**Spawn logic:** 30% chance per level if valid

**Placement:** Any valid empty cell adjacent to letter rooms

**Interaction:**
- Encounter panel: Generic treasure description (e.g., "An old chest, covered in dust. Press space to open.")
- 50% chance to give 100 gold or be a trap for 50% damage and 50% mana drain
- Press space: Reward gold or Mimic reveals and attacks
- Takes damage like a trap
- Solved after interaction

**Configuration:**
```json
{
  "type": "mimic_chest",
  "min_level": 2
}
```

## Implementation Notes

### Bonus Room Placement Algorithm
Use existing bonus room mechanics as much as possible.

### Dragon Treasure Special Handling
- During normal encounter assignment, when dragon is selected for a room:
  - Check if room has space for adjacent bonus room
  - If yes: Assign dragon, flag room for dragon treasure
  - If no: Try swapping dragon with adjacent room's encounter
  - If swap fails: Skip dragon and select different monster
- After all normal encounters assigned, place dragon treasure rooms for all flagged dragons
- Edge case: multiple dragon rooms with overlapping adjacent treasure rooms. Make sure each dragon will have at least 1 free space for its treasure.
- Dragon treasure requires special corridor handling -- only connects to associated dragon room, even if adjacent to other rooms.

### Corridor Locking System
Use existing lock mechanics as much as possible.

### Bonus Room Rendering
Use existing patterns
- `+` in each corner
- Colored glow (like shop and boss room)
- Special "cracked" corridor to hidden rooms requires new handling
- Visual hint for very hidden room should use existing random background detail elements where walls of hidden room would be, replaced with rendered room when discovered

### Bonus Room Removal
- In order to prevent "second visit" handling, all bonus rooms have a one time use only
- Use existing "solved" state to remove encounter if possible
- Room character removed (`+`'s' in 4 corners stay)
- Player can move freely through the space

## Completion Criteria
- [ ] Normal encounters respect min_level and max_level configurations
- [ ] Bonus rooms generate with 30% chance per valid type per level
- [ ] Dragon treasure spawns automatically with every dragon (100% rate)
- [ ] Dragon room only spawns if valid adjacent space exists
- [ ] Dragon treasure locked until dragon defeated
- [ ] Trapped adventurer locked until adjacent rooms solved
- [ ] All bonus room types render with correct symbols
- [ ] Locked rooms unlock correctly
- [ ] Hidden rooms use wall crack indicator (`+`)
- [ ] Very hidden rooms have no indicator but subtle outline
- [ ] All NPC dialogues display correctly in status log
- [ ] Simm's dialogue system selects greeting + content
- [ ] Trader only offers trades if player has items
- [ ] Cursed fountain only offers trades player can afford
- [ ] All interactions use "press space" mechanic correctly
- [ ] All rooms set as solved after interaction correctly
