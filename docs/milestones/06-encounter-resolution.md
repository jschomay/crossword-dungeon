# Milestone 6: Combat & Encounter Consequences

## Goal
Implement encounter resolution for correct and incorrect guesses with combat, damage, and rewards.

## Context
- Guessing triggers the encounter for that room
- Wrong guess = encounter consequence, no solve
- Correct guess = encounter success, then solve + rewards
- Three encounter types have different behaviors
- Combat (monster encounters) is turn-based auto-combat (player doesn't choose actions)

## Behavior Requirements

**Player Stats Addition:**
- Add HP to player state (starting value TBD, suggest 50 for testing)
- Add DMG to player state (suggested 10 for now, items and level will affect it in future milesontes)
- Add level to player state (start at 1)
- Display current/max HP in UI
- Display current DMG in UI
- Death/game over when HP reaches 0 (same as mana at 0)
- Track and display incorrect guess "runes" on each encounter

**Encounter Resolution on Guess:**

*Wrong Guess:*
- **Monster**: Deal damage to player equal to monster DMG (one attack), room unsolved
- **Trap**: Deal trap damage to player, trap unsolved
- **Treasure**: No damage, just wasted mana, room unsolved

For each type, display flavor text about what happened and clearly show any stat diffs (probably in new pop-up UI element with space to continue ?)
Track and show incorrect guesses in encounter area (could be a list or a "story" of each attempt ?)

*Correct Guess (before solving):*
- **Monster**: 
  - Initiate auto-combat
  - Player attacks first dealing current DMG to monster's HP
  - If monster survives (HP > 0), monster attacks (damage = monster level data)
  - Repeat turns until player or monster reaches 0 HP (1 second delay each time so player can follow along in UI)
  - If player wins: Grant reward, solve room
  - If player dies: Game over
- **Trap**:
  - Successfully disarmed (no damage)
  - Grant reward
  - Solve room
- **Treasure**:
  - Grant rewards (purely flavor text for now for items and consumables, inventory will be added in a later milestone)
  - Solve room

For each type use the same pop-up UI with flavor text and space to continue (continue only after combat ends for monsters)

NOTE, for failures:  Move "Game over" UI to the same pop-over and change "continue" to "restart"

**Solved encounter display**

- Indicate room is solved/defeated
- Remove most content (keep level, name, description)
- Continue to show history of encounter including failed attempts and success flavor text


## Completion Criteria
- [ ] Player has HP, DMG and level stats
- [ ] Wrong guesses deal appropriate damage per encounter type
- [ ] Correct guesses trigger full encounter resolution
- [ ] Monster auto-combat runs turn-by-turn with damage calculation
- [ ] Combat log shows what's happening
- [ ] XP awarded on successful solves
- [ ] Player can die from taking too much damage
- [ ] Treasure grants informational rewards
