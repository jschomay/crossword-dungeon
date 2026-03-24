# Milestone 10: Merchant Shops

## Goal
Add merchant shops to each dungeon level where players can spend gold on items, consumables, and equipment upgrades.

## Context
- One shop spawns per puzzle (dungeon level)
- Shop is a single-cell room connected to the puzzle grid
- Shops provide the main source of items and consumables (removed from treasure encounters)
- Players accumulate gold from treasure chests and level completion bonuses
- Shop inventory is level-scaled and partially randomized

## Behavior Requirements

**Shop Generation:**
- During puzzle generation, after word placement:
  - Select a random empty cell adjacent to any letter room
  - Create a 1-cell shop room at that location
  - Connect it to any adjacent letter rooms (doors/passages)
  - Mark with `%` symbol (draw % in all 9 room interior positions)
  - Shop "level" = current dungeon level number

**Shop Interaction:**
- Player can move into shop room like any other room
- Entering shop displays merchant interface with available items
- No encounter, no letter to guess, just commerce
- Player can browse and purchase if they have sufficient gold

**Shop Inventory:**
Shown in encounter panel. Each item has a [n] number before it for selection.

- **Always Available (Modest Price ~10 gold each):**
  - Health Potion 
  - Mana Potion 
  - Letter Reveal Scroll
  - Word Reveal Scroll

- **Random Item (High Price ~500 gold):**
  - One random equipment item from treasure catalog
  - Type: weapon, armor, or amulet
  - Stats based on current dungeon level
  - One-time purchase, then removed from shop (until next level)
  - Show warning if item will replace a currently equipped item

- **Random Modifier Upgrade (High Price ~500 gold):**
  - If player has at least one eligible item in inventory
  - Randomly select one item from player's equipped/inventory items
  - Randomly select one modifier from treasure modifiers
  - Offer to add modifier to that item
  - One-time purchase, then removed from shop

**Gold System:**
- Add gold to player state (starts at 0)
- Display current gold in UI near adventurer's XP

**Gold Sources:**
- **Treasure Chests:** Replace item/consumable treasures with gold
  - Level 1: ~20 gold
  - Level 8: ~110 gold
  - Formula: Base 20 + (Level × 11-12)
  - Gold added immediately to player total on room solve

- **Level Completion Bonus:**
  - When puzzle is completed, award: 100 × dungeon_level
  - Puzzle 1: 100 gold
  - Puzzle 5: 500 gold
  - Added before transitioning to next puzzle
  - Mention reward in puzzle complete text

**Purchase Mechanics:**
- Player presses number key to attempt to purchase that numbered item
- Number key does not have the usual effect (consume potion/scroll)
- Check if player has enough gold
- If yes: Deduct gold, add item to inventory or increase amount of corresponding potion/scroll and show "purchased" message
- If no: Show "insufficient gold" message
- Consumables can be purchased multiple times
- Items/modifiers removed from shop after purchase
- Pressing any lettered keys have no effect
- Remove the current y/n equip dialog for items

**Updated Treasure System:**
- Remove all item and consumable treasure types
- Keep only immediate effect treasures:
  - Healing Shrine (restore HP)
  - Mana Well (restore mana)
  - Experience Tome (grant XP)
- Remove:
  - Blessed Fountain (increase max HP)
  - Arcane Nexus (increase max mana)
- Add:
  - **Gold Chest** (grant gold, scales 20-110 by level)

## Completion Criteria
- [ ] Shop room spawns once per puzzle in valid location
- [ ] Shop marked with `%` and connected to adjacent rooms
- [ ] Player can enter shop and view inventory
- [ ] Consumables available for purchase at ~10 gold
- [ ] One random item available at ~500 gold
- [ ] One random modifier upgrade available at ~500 gold (if applicable)
- [ ] Gold system tracks player currency
- [ ] Gold chests award scaled amounts (20-110)
- [ ] Level completion awards 100 × level bonus
- [ ] Purchases deduct gold and add items to inventory
- [ ] Items/consumables removed from treasure encounter catalog
