# Milestone 8: Puzzle Generation & Sparsity

## Goal
Load full crossword puzzles and build up a sparse connected subgraph by selecting words incrementally, guaranteeing connectivity by construction.

## Context
- Start with a complete published ipuz puzzle (all words available as candidates)
- Build a subset of words up to a target count
- Connectivity is guaranteed — each added word must share a cell with the existing set
- Sparsity level determines difficulty (fewer words = sparser dungeon)

## Algorithm: Build-Up

1. Pick a random word from the full puzzle as the seed; add it to the selected set
2. Repeat until target word count reached:
   - Pick a random letter from the cells of the already-selected words
   - If that letter's intersecting word (the word crossing it in the other direction) is already selected, retry with a different letter
   - Add the intersecting word to the selected set
3. The resulting word set is always fully connected — no validation or backtracking needed

Connectivity is guaranteed because every new word is added by threading through a cell already in the selected set.

## Behavior Requirements
- Accept a target word count parameter
- Produce a valid sparse ipuz-compatible word/cell set from the source puzzle
- Generate varied dungeons from the same source with different random seeds

## Completion Criteria
- [ ] Build-up algorithm selects N connected words from full puzzle
- [ ] Resulting cell set renders correctly as a dungeon
- [ ] Clues and solution data preserved for selected words only
- [ ] Generates varied dungeons from same source with different random seeds
- [ ] Target word count is tunable (easy default: ~30–40% of total words)

## Unknowns/Questions for Designer
- Target word count or percentage for initial/easy dungeons?
- Should the seed word be random, or biased (e.g., longest, most central)?
