# Milestone 5: Encounter System

## Goal
Assign encounters to rooms and display encounter information when player enters.

## Context
- Three encounter types: Monster, Trap, Treasure
- Each room gets exactly one encounter, assigned during puzzle generation
- Encounters have descriptions and stats that scale with level (1-8)
- Pre-generated catalog of encounters with level-specific data
- Entering a room reveals encounter but doesn't trigger it

## Behavior Requirements

**Encounter Catalog:**
- Static data structure with encounter definitions
- Each encounter includes:
  - Type (monster/trap/treasure)
  - Name
  - Description
  - Stats per level 1-9 (HP, damage, rewards, etc.)
- Create catalog with variety (at least 3-5 of each type for MVP)

**Assignment:**
- During puzzle generation, assign random encounter to each room
- Distribution can be roughly even or weighted (designer preference)
- Store encounter reference with room data

**Display on Entry:**
- When player moves into room, show:
  - Encounter type and name
  - Current activated level
  - Description for that level
  - Relevant stats (e.g., "Level 2 Goblin - HP: 15, Damage: 3")
- Display in dedicated UI area (sidebar or message panel)
- Don't trigger encounter yet (that's Milestone 7)

## Sample Encounter Data Structure
See `../data/*`

Note the json structures differ slightly.

Usage notes for monsters:
Pick a random base, based on level, pick a random modifier (up to two). Stats are based on a calculation.
Level 1-2: Base type only (e.g., "Rat")
Level 3-5: Base type + first modifier (e.g., "Frenzied Rat")
Level 6-8: Base type + both modifiers (e.g., "Frenzied Armored Rat")
Modifiers randomly selected at generation
Final stats = (Base + Level × Growth) × Modifier1 × Modifier2
Final XP = (Base + Level × Growth) × XP_Mult1 × XP_Mult2

Example calculation for Level 6 Frenzied Armored Goblin:
HP = (12 + 6×3) × 1.0 × 1.4 = 30 × 1.4 = 42
Damage = (3 + 6×1) × 1.3 × 1.0 = 9 × 1.3 = ~12
XP = (10 + 6×3) × 1.2 × 1.3 = 28 × 1.56 = ~44

Usage notes for traps:
Works similarly to monsters.
Magical traps reward mana instead of XP

Usage notes for treasure:
3 types: Items, Consumables and Immediate.
Items: (Weapon, Armor or Amulet), stat bonuses scale with level
Level 3+ items can get first modifier
Level 6+ items can get second modifier (stat multipliers stack)
Consumables: Added to inventory, no level mods needed (or maybe quantity increases at level thresholds?)
Immediate effects: Applied instantly on room solve, no modifiers

NOTE: all data is purely for display during this milestone, no functionality.


## Completion Criteria
- [ ] Encounter catalog exists with multiple encounters per type (provided already)
- [ ] Each room assigned an encounter during generation
- [ ] Moving into room displays encounter info
- [ ] Display shows correct stats for room's activated level
- [ ] No encounters triggered yet (just information display)

## Unknowns/Questions for Designer
- Encounter distribution weights (equal mix or more monsters)?
