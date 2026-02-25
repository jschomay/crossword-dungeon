This is a retro style javascript web based game combining roguelikes with crossword games.

This can draw heavily on exiting technical patterns in an existing game using the same roguelike engine found at ../edge-of-known-space/. Specifically, the full node.js project set up, the index.html, the lib dir (which holds the rotjs rogulike engine), and many of the files in src/ (which hold useful rotjs utilities and patterns, bootstrapping, and useful dev patterns). There are online docs at https://ondras.github.io/rot.js/manual/ if absolutely necessary, or ask a specific usage question.

Additionally, the crossword mechanics should be driven by the ipuz format and can reuse the library in ../visual-crossword-2, specifically the src/puzzle.ts and some utils in src/App.tsx.

Minimal unit testing where helpful to design mechanical interfaces of basic utils is good, but for general game play testing, direct the user to do manual testing.


The workflow will progress layer by layer of functionality in an agile style.

Output should be kept brief. Before making changes, succinctly outline the plan to get approval. Bring up any questions around missing or unclear context or potentially high impact trade-off decisions.

After work, suggest code worth adding tests for, and consider refactoring opportunities to suggest.
