# Design Decisions

## Player Movement: Room-to-Room vs Cell-by-Cell

Both approaches were prototyped. Cell-by-cell movement (one display character per keypress) was rejected because it required too many keypresses to navigate, felt slow, and gave no gameplay reason to visit corridor cells. Room-to-room movement (one keypress = jump to adjacent letter room) was kept as it matches the crossword structure and feels snappy.
