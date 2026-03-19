# Milestone 9: Puzzle Progression

## Goal
Implement transition between puzzles with state carryover and increasing difficulty.

## Context
- Completing all words in a puzzle advances to next puzzle
- Player stats, level, inventory carry over
- Difficulty increases through sparsity (more words/intersections)
- Each puzzle is a deeper "dungeon level" in roguelike progression

## Behavior Requirements

**Puzzle Completion Detection:**
- Already tracking from Milestone 6
- When last room solved, trigger end-of-puzzle sequence

**End of Puzzle:**
- Show "Puzzle Complete!" message
- Prompt to continue to next puzzle

**Next Puzzle Generation:**
- Increment difficulty/dungeon level counter
- Select new ipuz puzzle from library
- Apply increased sparsity target (more words than previous)
- Generate new puzzle
- Maintain player state:
  - Current HP (don't reset)
  - Current mana (don't reset)
  - Level
  - XP progress toward next level
  - Inventory
- Place player at random starting position in new puzzle

**Difficulty Scaling:**
First puzzle has 5 words, then increases by 2 each time.
Also, add puzzle level multipliers to all encounters (in addition to cell level multipliers).

## Completion Criteria
- [ ] Completing puzzle triggers progression sequence
- [ ] Player state persists to next puzzle
- [ ] New puzzle generates with increased difficulty
- [ ] Player spawns in new puzzle layout
- [ ] Difficulty ramps appropriately over multiple puzzles
- [ ] Can play through multiple consecutive puzzles

## Unknowns/Questions for Designer
- End-of-puzzle bonus choices (or skip for MVP)?
- Maximum puzzle difficulty / word count cap?
