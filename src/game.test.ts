import { describe, it, expect } from 'vitest';
import { xpThreshold, shopPrice } from './game';

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

describe('shopPrice', () => {
  it('HP Potion (base 8): L1 buy1=8, buy2=10, buy3=12', () => {
    expect(shopPrice(8, 1, 0)).toBe(8);
    expect(shopPrice(8, 1, 1)).toBe(10);
    expect(shopPrice(8, 1, 2)).toBe(12);
  });
  it('HP Potion: L2 buy1=12, L3 buy1=16', () => {
    expect(shopPrice(8, 2, 0)).toBe(12);
    expect(shopPrice(8, 3, 0)).toBe(16);
  });
  it('Inscribe: L1 buy1=20, buy2=25, buy3=30', () => {
    expect(shopPrice(20, 1, 0)).toBe(20);
    expect(shopPrice(20, 1, 1)).toBe(25);
    expect(shopPrice(20, 1, 2)).toBe(30);
  });
  it('Inscribe: L2 buy1=30, L3 buy1=40', () => {
    expect(shopPrice(20, 2, 0)).toBe(30);
    expect(shopPrice(20, 3, 0)).toBe(40);
  });
  it('Intone: L1 buy1=30, buy2=38, buy3=45', () => {
    expect(shopPrice(30, 1, 0)).toBe(30);
    expect(shopPrice(30, 1, 1)).toBe(38);
    expect(shopPrice(30, 1, 2)).toBe(45);
  });
  it('Item: L1 buy1=200, buy2=250, buy3=300', () => {
    expect(shopPrice(200, 1, 0)).toBe(200);
    expect(shopPrice(200, 1, 1)).toBe(250);
    expect(shopPrice(200, 1, 2)).toBe(300);
  });
  it('Item: L2 buy1=300, L3 buy1=400', () => {
    expect(shopPrice(200, 2, 0)).toBe(300);
    expect(shopPrice(200, 3, 0)).toBe(400);
  });
});
