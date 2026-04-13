import { describe, it, expect } from 'vitest';
import { xpThreshold } from './game';

describe('xpThreshold', () => {
  it('level 1 → 120', () => expect(xpThreshold(1)).toBe(120));
  it('level 2 → 140', () => expect(xpThreshold(2)).toBe(140));
  it('level 3 → 170', () => expect(xpThreshold(3)).toBe(170));
  it('level 4 → 210', () => expect(xpThreshold(4)).toBe(210));
  it('level 5 → 250', () => expect(xpThreshold(5)).toBe(250));
  it('increases monotonically', () => {
    for (let l = 1; l < 10; l++) {
      expect(xpThreshold(l + 1)).toBeGreaterThan(xpThreshold(l));
    }
  });
});
