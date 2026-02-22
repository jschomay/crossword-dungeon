# Technical design

Web-based game relying on the rot.js roguelike ascii game engine.

## Existing libraries and prior art

rot.js - framework providing rendering and utilities.

previous rot.js game with existing code for common patterns like entity state, FOV effects, etc.

custom crossword library for working with ipuz format crosswords.

## Components

### The crossword puzzle

Use ipuz formats from old published puzzles. Randomly remove words from it to make it sparse from adjusted difficulty and dungeon design. When removing words, leave letters that intersect with other words.

### RPG elements

Pre-generate large number of encounters per type (trap, monster, treasure). Include description, stats, reward per level for 0-9.
Store in static catalog to pull from randomly and assign to puzzle rooms.

### Rendering

Render ipuz cells in ascii dungeon shapes. Account for doors between rooms. Calculate potential level to render.
Show room RPG element on enter. Show clues on enter.

### Player actions

Basic adventurer movement (room to room rather than each ascii coordinate). Rune summoning system with mana impact. Auto-battle and consequences/rewards with item effects. Show outcomes. Update room level states.
Also allow player to activate consumable items.
