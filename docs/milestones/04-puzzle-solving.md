# Milestone 4: Guess Mechanics & Letter Solving

## Goal
Implement letter guessing with mana cost, correct/incorrect feedback, and puzzle solve tracking.

## Context
- Player guesses letters to solve rooms
- Each guess costs 1 mana
- Correct guess: Reveals letter, locks room level, triggers level cascade
- Incorrect guess: Costs mana, no other effect yet (consequences added in Milestone 7)
- Player must manage limited mana resource

## Behavior Requirements

**Player Stats:**
- Add mana to player state (starting value TBD, suggest 10 for testing)
- Display current/max mana in UI
- Check mana before allowing guess

**Guess Input:**
- When in a room, player can input a letter guess (keyboard)
- Validate: Must have ≥1 mana
- Validate: Room must not already be solved
- Letter input should be clear (prompt or always-ready input field)

**Guess Processing:**
- Deduct 1 mana
- Check guess against solution letter from ipuz
- If correct:
  - Reveal letter in room (replace `?`)
  - Mark room as solved
  - Lock in activated level (keep `+`, remove `.`)
  - Activate one level in each unsolved connected room
  - Show success feedback
- If incorrect:
  - Show failure feedback
  - Room stays unsolved
  - (Damage from encounters added in Milestone 7)

**Puzzle Completion:**
- Track how many rooms are solved vs total
- When all rooms solved: Show "Puzzle Complete" message
- If mana reaches 0: show "Game over! Press any key to restart"
- (Progression to next puzzle added in Milestone 9)

## Completion Criteria
- [ ] Player has mana stat displayed
- [ ] Can input letter guess when standing in room
- [ ] Guessing costs 1 mana
- [ ] Can't guess without mana
- [ ] Correct guess reveals letter and updates map
- [ ] Correct guess triggers level activation cascade
- [ ] Incorrect guess gives feedback but room stays unsolved
- [ ] Can track when puzzle is fully solved
- [ ] Clear visual feedback for correct vs incorrect
