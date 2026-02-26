# Milestone 3: Room States & Level Display

## Goal
Calculate and display activated levels for each room, updating dynamically as rooms are solved.

## Context
- Each room has a "potential level" based on other unsolved rooms in the same word(s) (already done)
- Potential levels shown as `.` symbols (max 8)
- When a room is solved, it activates one level in all connected unsolved rooms (`.` → `+`)
- When solving a room, its activated levels lock in and remaining potential levels disappear
- This is the core difficulty cascade mechanic

## Behavior Requirements

**Level Activation:**
- Track activated level value per room and show as `+` instead of `.`
- When room is solved:
  - Lock in current activated level count
  - Remove remaining potential `.` symbols
  - For each unsolved room in same word(s), update one `.` to `+`
- Once a room is solved, it can't be solved or changed again

**Visual Display:**
- Show combination of `+` and `.` in each room
- Example: Room with 5 potential, 2 activated = `++...`
- After solving at level 2 = `++` (dots removed)

**Temporary Solve Mechanism:**
- For testing, allow designer to mark rooms as "solved" (a-z keys)
- Reveal the pressed letter
- Trigger level activation cascade
- Update all connected room displays

## Completion Criteria
- [ ] Each room displays correct potential level count as `.`
- [ ] Can manually solve rooms for testing
- [ ] Solving a room activates levels (`+`) in connected unsolved rooms
- [ ] Solved rooms lock in activated level, remove potential levels
- [ ] Level displays update correctly after each solve
- [ ] Maximum level display is 8 (potential or activated)
