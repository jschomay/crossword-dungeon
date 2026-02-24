# Milestone 1.5: Potential Level Display

## Goal
Calculate and display the potential level for each room as visual indicators, laying groundwork for the activated level system.

## Context
- Each room has a "potential level" = count of other rooms in the same word(s)
- This represents the maximum difficulty the room could reach
- Displayed as small blue dots around the `?` in each room
- Maximum of 9 dots per room
- This milestone only shows potential (static calculation), not activated levels yet

## Behavior Requirements

**Potential Level Calculation:**
- For each room, identify all words it belongs to (across and/or down)
- Count total rooms in those words (excluding self)
- This count = potential level (cap at 9)
- Calculate this once during puzzle generation

**Visual Display:**
- Render small blue dots (`.`) around the `?` in each room
- Number of dots = potential level
- Example: Room in 5-letter word = 4 dots, room at intersection of 3-letter and 4-letter = 5 dots

Ex for level 4 room:

    #####
    #...##
    #.?  
    #   ##
    ## ##
     # # 

**State Architecture Note (based on future milestone features):**
- Store potential level as static value per room
- Reserve space in room data structure for future "activated level" counter
- Design rendering to accommodate showing both potential (`.`) and activated (`+`) indicators together later
- When room is solved, this potential level display will be replaced with locked-in level

## Completion Criteria
- [ ] Each room calculates correct potential level (good candidate for a test)
- [ ] Blue dots render in each room around the ? matching potential level
- [ ] Maximum 9 dots displayed per room
- [ ] Room data structure ready to add activated level tracking later

## Implementation Notes
See the visual crossword App.ts code for helper utils on getting words from an ipuz coord. You can bring appropriate utils into the Ipuz class. You likely want to use pure functions instead of the stateful class propeties.
