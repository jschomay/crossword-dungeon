#!/usr/bin/env node
// Usage: node scripts/fetch-wapo-puzzle.js 2026/03/15

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const date = process.argv[2];
if (!date || !/^\d{4}\/\d{2}\/\d{2}$/.test(date)) {
  console.error('Usage: node scripts/fetch-wapo-puzzle.js YYYY/MM/DD');
  process.exit(1);
}

const url = `https://games-service-prod.site.aws.wapo.pub/crossword/levels/daily/${date}`;
console.log(`Fetching ${url}...`);

const res = await fetch(url);
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${res.statusText}`);
  process.exit(1);
}

const data = await res.json();
const { width, cells, words, title, creator, copyright } = data;
const height = Math.ceil(cells.length / width);

// Build 2D puzzle (cell numbers / "#") and solution (letters / "#")
const puzzle = Array.from({ length: height }, () => Array(width).fill(null));
const solution = Array.from({ length: height }, () => Array(width).fill(null));

cells.forEach((cell, i) => {
  const row = Math.floor(i / width);
  const col = i % width;
  if (cell.type === 'locked') {
    puzzle[row][col] = '#';
    solution[row][col] = '#';
  } else {
    puzzle[row][col] = cell.number ? parseInt(cell.number, 10) : null;
    solution[row][col] = cell.answer ?? null;
  }
});

// Build clues from words array
// Clue number = the `number` field of the first cell in the word
const clues = { Across: [], Down: [] };

for (const word of words) {
  const firstCell = cells[word.indexes[0]];
  if (!firstCell?.number) continue; // skip if no number (shouldn't happen)
  const num = parseInt(firstCell.number, 10);
  const dir = word.direction === 'across' ? 'Across' : 'Down';
  clues[dir].push([num, word.clue]);
}

clues.Across.sort((a, b) => a[0] - b[0]);
clues.Down.sort((a, b) => a[0] - b[0]);

const ipuz = {
  version: 'http://ipuz.org/v1',
  kind: ['http://ipuz.org/crossword#1'],
  title: title ?? '',
  author: creator ?? '',
  copyright: copyright ?? '',
  dimensions: { width, height },
  puzzle,
  solution,
  clues,
};

const slug = date.replace(/\//g, '-');
const outPath = join(__dirname, '..', 'puzzles', `wapo-${slug}.json`);
writeFileSync(outPath, JSON.stringify(ipuz, null, 2));
console.log(`Saved to puzzles/wapo-${slug}.json`);
