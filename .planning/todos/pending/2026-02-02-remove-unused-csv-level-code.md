---
created: 2026-02-02T21:30
title: Remove unused CSV level generation code
area: game
files:
  - src/game.ts:3,44,77,83,1053
  - src/levels.ts
  - src/level-generator.ts
---

## Problem

After replacing CSV-based level generation with a simple generic floor (`createSimpleFloor`), there's still unused code remaining:

- `generateLevelFromCSV()` method (line 1053 in game.ts) - no longer called
- `Level` type import from `levels.js` (line 3) - no longer needed
- `levels` property in Game class (lines 44, 77, 83) - no longer used
- `levels.ts` file - may be completely unused now
- `level-generator.ts` file - may be completely unused now

This dead code adds maintenance burden and confusion.

## Solution

1. Remove `generateLevelFromCSV()` method from `game.ts`
2. Remove `Level` type import from `game.ts`
3. Remove `levels` property and constructor parameter from Game class
4. Check if `levels.ts` is used elsewhere, remove if not
5. Check if `level-generator.ts` is used elsewhere, remove if not
6. Update any references to `this.levels` in the codebase
7. Test that simple floor generation still works correctly
