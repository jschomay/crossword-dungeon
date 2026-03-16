# Milestone 7: Player Progression & Inventory

## Goal
Implement XP-based leveling, stat increases, and basic inventory system with usable items.

## Context
- Solving rooms grants XP
- Accumulating XP levels up player
- Leveling restores HP/mana and increases maximums
- Treasure encounters and loot drops add items to inventory
- Items can be used to restore HP/mana or provide other benefits
- Items usable anytime except during combat

## Behavior Requirements

**Leveling System:**
- Track total XP
- Define level thresholds (every 100 XP)
- On level up:
  - Increase player level
  - Restore HP to new max
  - Restore mana to new max
  - Increase max HP (suggest +10 per level)
  - Increase max mana (suggest +5 per level)
  - Show level up notification
- Leveling affects damage calculation

**Inventory System:**
- Track list of items in player inventory
- Items:
  - **Weapons**: Increase attack damage (equippable, modifier to damage calc)
  - **Shields/Armor**: Reduce damage taken (equippable, modifier to defense)
- Consumables:
  - **HP Potions**: Restore HP when used (consumable)
  - **Mana Potions**: Restore mana when used (consumable)
  - **Hint Scrolls**: Reveal a letter or give clue (consumable)

**Inventory UI:**
- Display current inventory
- Show equipped weapon/armor
- Allow player to use consumable items

**Item Usage:**
- Can be used anytime except during combat auto-resolution
- Consumables: Apply effect immediately, remove from inventory
- Equipment: Update equipped slot, apply stat modifiers

**Item Distribution:**
- Treasure rooms drop items
- Monster loot can include items

## Completion Criteria
- [ ] XP accumulates from solving rooms
- [ ] Player levels up at thresholds
- [ ] Level up increases stats and restores HP/mana
- [ ] Inventory tracks items
- [ ] Can view inventory
- [ ] Can use consumable items
- [ ] Can equip weapons/armor
- [ ] Equipment modifiers affect combat
- [ ] Items appear as rewards from encounters

## Unknowns/Questions for Designer
- Starting inventory items?
- Inventory size limit or unlimited?
