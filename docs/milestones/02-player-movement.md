# Milestone 2: Player Movement

## Goal
Allow player to navigate room-to-room using keyboard input.

## Context
- Player represented by white `@` symbol
- Movement is discrete: room-to-room, not coordinate-by-coordinate
- Can only move to orthogonally adjacent letter rooms (up/down/left/right)
- Black squares and puzzle edges are impassable
- Player starts at random valid room

## Behavior Requirements
- Render player `@` at current position
- Accept keyboard input for movement (arrow keys or WASD or HJKL)
- On movement command:
  - Check if target position is a valid letter room
  - If valid, move player to that room
  - If invalid (wall/black square/edge), ignore command
- Update render to show new player position
- Clear old position (show the room's letter or `?` again)

## Movement Validation
- Only allow moves to adjacent cells that are part of the crossword (letter positions)
- No diagonal movement
- No movement through walls or off grid

## Completion Criteria
- [ ] Player `@` renders at starting position
- [ ] Arrow keys (or WASD) move player between rooms
- [ ] Movement respects crossword layout (can't move through walls)
- [ ] Player can traverse entire connected puzzle
- [ ] Visual feedback is immediate and clear
