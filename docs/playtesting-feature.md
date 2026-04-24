# Playtesting Feature — Behind the Scenes

## Why

The impetus was a concrete bug: moving toward a locked room from the wrong side (no door there) was still showing a "locked" popup. I couldn't reproduce it, and Jeff couldn't easily describe the exact layout conditions. The game is browser-based with a rot.js canvas renderer — I had no way to see the dungeon, navigate it, or trigger specific situations.

Jeff asked: could I have an alternate text-based renderer so I could actually play the game myself?

## What Was Considered

The first instinct was a full CLI renderer — replace rot.js entirely with a terminal output layer. The problem: `game.ts` is tightly coupled to DOM elements (`getElementById`, `innerHTML`) and rot.js `Display`. Decoupling would have required refactoring the game itself, risking drift between the playtest harness and real behavior.

A vitest/jsdom approach was considered next — run the game inside the test environment with mocked rot.js. Cleaner, but still required significant mock surface.

The insight that unlocked it: **rot.js `Display` stores every drawn character in `display._data`** — a plain JS object keyed by `"x,y"`. The canvas rendering is a separate tick that never needs to fire. So we don't need to replace the renderer at all — we just read `_data` after each `render()` call and reconstruct the ASCII grid ourselves.

## The Approach That Worked

A small HTTP server (`scripts/playtest-server.ts`) that:

1. Stubs the minimal DOM/browser surface before importing game code — fake canvas, stateful `classList`, `localStorage`, `fetch` from disk
2. Imports and boots `Game.create()` normally via `tsx` (handles TypeScript + bundler-mode resolution)
3. Captures the `keydown` listener that `Game` registers on `window`
4. Serves three endpoints: `/state`, `/key?k=<key>`, `/dismiss`

Each request fires a synthetic key event, then reads `display._data` to render a 43×43 ASCII grid, plus strips HTML from the sidebar panel elements. Game logic is **completely untouched** — this is just another frontend.

Key stubs that needed to be correct (not just no-ops):
- `classList` must be stateful — the help overlay check `!classList.contains('hidden')` blocks all input if it always returns false
- `setInterval` must run its callback to completion — the pulse animation sets `pulseRunning = true` and only clears it inside the interval tick; a no-op leaves input permanently blocked after the first guess
- `interaction-popup` and `help-overlay` elements must start with `hidden` in their classList

## What It Looks Like

```
=== player @ grid(2,2)  Dungeon Level 3  [SPACE] Full map  [?] Help ===
;                                               [ ] [A]-[&]-[I]
   ::  ##### ##### #####                             |   |   |
       #   ###+ +###   #                        [?]-[?]-[T]-[?]
       # A     &     I #                         |   |   |   ‖
       #   ###+ +###   #                        [&]-[?]-[@]=[/]
   :~  ## ## ## ## ## ##
        # #   # #   # #
 ##### ## ## ## ## ## ##
 #   ###   ###   ###   #
 # ?     ?     T     ? #         '
 #   ###   ###   ###   #
 ## ## ## ## ## ## ## ##
  # #   # #   # #   #=#
 ## ## ## ## ## ## ## ##                  ~
 #+ +###   ###+ +###+ +#          ~
 # &     ?     @  =  / #
 #+ +###   ###+ +###+ +#
 ##### ##### ##### #####
--- HERO ---
AdventurerLv.1  HP: ██████████ 50/50  MANA: ██████████ 15/15  DMG:8  DEF:0  XP:0/120  GOLD:3000
[1] Heal ×2  [2] Restore ×2  [3] Inscribe ×3  [4] Intone ×3
--- ENCOUNTER ---
% Merchant  Lv.3  Wares and wonder, for the right price.
[1] Health Potion (+20 HP)  16 GOLD
[2] Mana Potion (+10 MANA)  16 GOLD
[3] Inscribe Scroll (reveal letter)  40 GOLD
[4] Intone Scroll (reveal word)  60 GOLD
--- CLUES ---
▲ ▼ MSN competitor
```

## The Compact Map

The full 43×43 grid is useful for wall/corridor sanity checks but hard to navigate by. The compact map (rendered to the right of the full grid) condenses the dungeon to one character per room:

```
[ ] [A]-[&]-[I]
     |   |   |
[?]-[?]-[T]-[?]
 |   |   |   ‖
[&]-[?]-[@]=[/]
```

`@` is me. `-` and `|` are open corridors. `=` and `‖` are locked. Solved rooms show their letter. Special rooms show their symbol (`/` = exit, `%` = shop, `&` = NPC/bonus, `$` = treasure). This is what I actually navigate by — I can see the whole dungeon topology at a glance and plan a route.

## How Cool Is This

The game is fully playable from the terminal across stateless HTTP calls. I start the server, get a snapshot, decide where to go, send a key, read the new state, repeat. The game doesn't know anything different is happening — it's running exactly as it would in the browser, same logic, same event flow, same state machine. I can reproduce specific bugs by navigating to exact room configurations, try edge cases like approaching locked doors from both sides, trigger combat, use the shop, and watch panel content change in real time.

The locked-door bug that started all this? Now I can walk right up to it.
