import { validateIpuz } from './puzzle';

const STORAGE_KEY = 'crossword_dungeon_progression';
const PUZZLE_COUNT = 30;
// Index 0 is reserved for the tutorial. Normal puzzles start at index 1.
const TUTORIAL_INDEX = 0;

// Session-only tutorial flag: true if ?puzzle=tutorial was in the URL on page load.
// completeTutorial() clears it in memory so the run continues normally after beating it,
// but reloading the page re-reads the URL param and starts tutorial again.
let sessionTutorial: boolean = typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('puzzle') === 'tutorial';

export function getOverridePuzzle(): string | null {
  const val = new URLSearchParams(window.location.search).get('puzzle');
  if (val === null) return null;
  if (val === 'debug') return val;
  // 'tutorial' is handled via sessionTutorial, not as a persistent override
  if (val === 'tutorial') return null;
  throw new Error(`Unknown puzzle override: "${val}"`);
}

export function getProgressionIndex(): number {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? parseInt(stored, 10) : TUTORIAL_INDEX;
}

function setProgressionIndex(index: number): void {
  localStorage.setItem(STORAGE_KEY, String(index));
}

/** True when the current session should load the tutorial puzzle. */
export function isTutorial(): boolean {
  if (sessionTutorial) return true;
  return getOverridePuzzle() === null && getProgressionIndex() === TUTORIAL_INDEX;
}

/** Call when the tutorial puzzle is solved. Clears session flag and bumps progression. */
export function completeTutorial(): void {
  sessionTutorial = false;
  if (getProgressionIndex() === TUTORIAL_INDEX) setProgressionIndex(1);
}

/** Returns { puzzleNumber (1-based), parityFlip } for current index, then bumps.
 *  Does not bump if a ?puzzle= override or tutorial is active. */
export function consumeProgression(): { puzzleNumber: number; parityFlip: boolean } {
  const index = getProgressionIndex();
  const normalIndex = Math.max(0, index - 1); // offset by 1 since index 0 is tutorial
  const puzzleNumber = (Math.floor(normalIndex / 2) % PUZZLE_COUNT) + 1;
  const parityFlip = normalIndex % 2 === 1;
  if (!getOverridePuzzle() && !isTutorial()) setProgressionIndex(index + 1);
  return { puzzleNumber, parityFlip };
}

export async function fetchPuzzle(puzzleNumber: number) {
  if (isTutorial()) {
    const res = await fetch('puzzles/tutorial.json');
    if (!res.ok) throw new Error(`Failed to load tutorial puzzle: ${res.status}`);
    return validateIpuz(await res.json());
  }
  const override = getOverridePuzzle();
  if (override) {
    const res = await fetch(`puzzles/${override}.json`);
    if (!res.ok) throw new Error(`Failed to load puzzle puzzles/${override}.json: ${res.status}`);
    return validateIpuz(await res.json());
  }
  const res = await fetch(`puzzles/${puzzleNumber}.json`);
  if (!res.ok) throw new Error(`Failed to load puzzle puzzles/${puzzleNumber}.json: ${res.status}`);
  return validateIpuz(await res.json());
}
