# Milestone 1: Puzzle Rendering

## Goal
Display a static crossword puzzle as an ASCII dungeon using rot.js rendering engine.

## Context
- Crossword puzzles are in ipuz format (JSON structure with grid, clues, solution)
- Each filled cell becomes a "room" in the dungeon
- Black/empty cells are impassable barriers
- Rooms show `?` for unsolved letters
- Use existing rot.js framework for ASCII rendering
- Use existing custom crossword library for ipuz parsing

## Behavior Requirements
- Parse ipuz format into renderable grid structure
- Convert crossword grid coordinates to dungeon layout
- Render rooms as connected spaces with doors/walls between them
- Show `?` placeholder in each unsolved room
- Grid should be centered/positioned readably on screen

## Visual Style
Each letter in a word becomes a "room." Connected letters in a word have a "hallway" connecting their rooms.

Example:

      #####                                                                              
      #   #                                                                              
      # ? #                                                                              
      #   #                                                                              
      ## ##                                                                              
       # #                                                                               
      ## ## ##### #####                                                                  
      #   ###   ###   #                                                                  
      # ?     ?     ? #                                                                  
      #   ###   ###   #                                                                  
      ## ## ##### ## ##                                                                  
       # #         # #                                                                   
      ## ##       ## ## #####                                                            
      #   #       #   ###   #                                                            
      # ? #       # ?     ? #                                                            
      #   #       #   ###   #                                                            
      #####       ##### #####                                                            

## Completion Criteria
- [ ] Can load an ipuz puzzle file
- [ ] Puzzle renders as ASCII dungeon layout
- [ ] All letter positions show as rooms with `?`
- [ ] Layout is readable and matches crossword structure

## IPUZ specifics
Ipuz has a defined format which can be found at https://libipuz.org/ipuz-spec.html (this link is very comprehensive, our needs are only a subset of what they define). The provided ipuz must be valid, otherwise throw an error.

## Data

Use the ipuz found at `puzzles/demo.json`.
