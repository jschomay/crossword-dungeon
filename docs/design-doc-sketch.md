## Crossword Dungeon

A roguelike game combining crossword puzzle solving with RPG decisions.

Each solved room levels-up connected rooms, raising the stakes. Choose solve order wisely to survive to the end of the puzzle and come out stronger.

## Mechanics

A crossword is represented as a dungeon of connected rooms to navigate. Each room has:

- A `?` representing its letter in the word(s) it belongs to.
- A potential level equal to the number of other rooms it can see, shown as `.`'s (up to a maximum of 9). Room levels can be "activated," shown as `+`'s. 
- An RPG element in it (monster, trap, or treasure), discovered upon entering.

For example in the puzzle below, the top-most room has a level of 2 because it sees 2 other rooms (down). The `M` has a level of 3 because it sees 2 rooms to the left and 1 room down (2+1=3). 



      #####                                                                              
      #.. #                                                                              
      # @ #                                                                              
      #   #                                                                              
      ## ##                                                                              
       # #                                                                               
      ## ## ##### #####                                                                  
      #...###.. ###...#                                                                  
      #.?     ?     ? #                                                                  
      #   ###   ###   #                                                                  
      ## ## ##### ## ##                                                                  
       # #         # #                                                                   
      ## ##       ## ## #####                                                            
      #.. #       #.. ###.  #                                                            
      # ? #       # ?     ? #                                                            
      #   #       #   ###   #                                                            
      #####       ##### #####                                                            


The brave adventurer (`@`) can move from room to room. Entering a room shows the clues for the word(s) it intersects and describes the RPG element encountered at the room's current activated level. All rooms start at level 0.

The adventurer can "summon a rune" (AKA, guess a letter) to solve the room.

A failed guess may have consequence based on the room's RPG element and activated level, but does not change the map in any way.

A successful guess does the following:

- Potential consequence based on the room's RPG element and activated level (eg. turn based auto-combat)
- Gains a reward based on the room's RPG element and activated level
- Replaces the `?` with the guessed letter.
- "Locks in" the activated level the room was beat at (removing any potential `.`'s) to visually show the level it was beat at
- Activates all rooms it can see by changing one of their `.`'s into a `+`



For example the puzzle below shows the result after:

- The adventurer moved to the `A` room and guessed `A`. Since this was the first guess, the room was still at level 0, hence no `+`'s. The correct guess activated the rooms above and below it as well as the rooms to the right of it.
- The adventurer then moved to the `R` room and guessed `R`, locking in level 1 and activating the room to the right of it, but not the room to the left since it was already locked in.
- The adventurer then moved to the `M` room and locked in its level 2. The only non-locked room is below it, activating it.
- The adventured then moved down.



      #####                                                                              
      #+. #                                                                              
      # ? #                                                                              
      #   #                                                                              
      ## ##                                                                              
       # #                                                                               
      ## ## ##### #####                                                                  
      #   ###+  ###++ #                                                                  
      # A     R     M #                                                                  
      #   ###   ###   #                                                                  
      ## ## ##### ## ##                                                                  
       # #         # #                                                                   
      ## ##       ## ## #####                                                            
      #+. #       #+. ###.  #                                                            
      # ? #       # @     ? #                                                            
      #   #       #   ###   #                                                            
      #####       ##### #####                                                            



### RPG mechanics

The player has a level, XP (experience points), HP (hit points), mana, and an inventory of minimal starting items.
Each "rune summoned" costs 1 mana.
Fighting monsters reduce HP.
Failed traps reduce HP.
Solving a room raises XP.
Treasure rooms offer various rewards including mana, HP, and better items.
Enough XP levels-up, restoring HP and mana.

Fighting monsters is turn based. Summoning the right rune lets the player go first. Damage dealt is a combination of level, weapon, and shield.

Solving the full puzzle advances to a new, more challenging puzzle (more words).
Reaching 0 HP or 0 mana ends the run.

The player must carefully solve the rooms in an order that maximizes rewards and avoids leveling-up a monster or trap room beyond their ability to withstand it.


----

- reveal scroll not leveling up count
- restart gets new dungeon
- fill space
- experiment with denser/horizontal/vertical/shorter words gen
- filled in letters should be white
