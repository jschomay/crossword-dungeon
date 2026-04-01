# Milestone 11: Boss Room & Arch Puzzle

## Goal
Implement a persistent hangman-style boss puzzle that carries across all dungeon levels, where solving it wins the game and failing sends you to the next level.

## Context
- One arch puzzle persists for the entire run (generated at run start)
- After completing each dungeon level's crossword, the boss room unlocks
- Player can attempt to guess letters in the arch puzzle
- Correct guesses persist across all future boss attempts in this run
- First wrong guess = boss attempt failed, proceed to next dungeon level
- Completing the arch puzzle = win the game, escape the dungeon

## Behavior Requirements

**Arch Puzzle Generation (at run start):**
- Load first puzzle from ipuz library
- Identify all words in the puzzle NOT used during puzzle level generation
- From unused words, select one of median length
- Store the word and its clue
- Track guessed letters (starts empty)

**Boss Room Appearance:**
- Randomly generate adjacent to any dungeon room (like shop)
- Rooms starts locked
- After all words in current dungeon level solved room unlocks
- Glows red (like how shop glows teal)
- Has + in corners (like shop)
- Has _ in middle
- Locked rooms have a = in their corridor
- Show status info flavor text about sound of room unlocking on puzzle solve

**Boss Puzzle Interface (boss encounter panel):**
- Title like other encounter panels
- Flavor text like "You see a way out, but the door is locked by a magic spell"
- Show instructions
- Display hangman-style word with blanks: `_ _ E _ _ _`
- Show already-guessed letters (correct guesses filled in)
- Show the clue
- Show already guessed letters
- Allow player to guess one letter at a time

**Guess Processing:**
- Player inputs a letter guess
- Normal letter input (room solving) does not apply
- Check if letter already guessed (if yes, warn)
- Check if letter is in the word:
  - **Correct**: Fill in ALL occurrences of that letter
  - **Wrong**: Boss attempt immediately fails, load next puzzle
- Show status info flavor text

**Boss Attempt Success:**
- All letters filled in = puzzle solved
- Display victory screen: "You utter the magic spell, the door unlocks and you escape!"
- Show run statistics
- End run (no death, just victory)
- Option to start new run

**Boss Attempt Failure:**
- Wrong guess triggers failure
- Display like "A trap door opens and you fall to a deeper level!"
- Proceed to next dungeon level

**Next Boss Attempt:**
- When next level's crossword completes, boss room appears again
- Same arch puzzle, same filled-in letters from previous attempts
- Player can try again with more information revealed
- Does not persist across runs


