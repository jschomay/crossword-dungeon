import { validateIpuz } from './puzzle';

const STORAGE_KEY = 'crossword_dungeon_progression';
const PUZZLE_COUNT = 30;

export function getOverridePuzzle(): string | null {
  const val = new URLSearchParams(window.location.search).get('puzzle');
  return val ? val.replace(/[^a-z0-9-]/gi, '') || null : null;
}

export function getProgressionIndex(): number {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? parseInt(stored, 10) : 0;
}

function setProgressionIndex(index: number): void {
  localStorage.setItem(STORAGE_KEY, String(index));
}

/** Returns { puzzleNumber (1-based), parityFlip } for current index, then bumps.
 *  Does not bump if a ?puzzle= override is active. */
export function consumeProgression(): { puzzleNumber: number; parityFlip: boolean } {
  const index = getProgressionIndex();
  const puzzleNumber = (Math.floor(index / 2) % PUZZLE_COUNT) + 1;
  const parityFlip = index % 2 === 1;
  if (!getOverridePuzzle()) setProgressionIndex(index + 1);
  return { puzzleNumber, parityFlip };
}

export async function fetchPuzzle(puzzleNumber: number) {
  const override = getOverridePuzzle();
  const path = override ? `puzzles/${override}.json` : `puzzles/${puzzleNumber}.json`;
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load puzzle ${path}: ${res.status}`);
  return validateIpuz(await res.json());
}
