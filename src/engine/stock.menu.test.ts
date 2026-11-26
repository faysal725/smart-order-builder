import { describe, it, expect } from "vitest";
import { menu } from "../data/menu";
import { remainingStock, findShortages, formatShortages, blockedReason } from "./stock";
import type { CartLine } from "./types";

const B: CartLine = {
  qty: 1,
  options: { croissant: 1, omelette: 2, fried: 2, sausage: 1, bacon: 1, hashbrown: 1, mushroom: 1, hollandaise: 1 },
};
const C: CartLine = {
  qty: 1,
  options: { paratha: 1, fried: 2, tofu: 1, cheese: 2, beans: 1, mushroom: 1, chili: 1 },
};
const cart: CartLine[] = [B, { ...C, qty: 2 }];

describe("stock with real menu", () => {
  it("TC-08: egg 0, cheese 0, croissant 1, new egg item blocked", () => {
    const left = remainingStock(menu, cart);
    expect(left.egg).toBe(0);
    expect(left.cheese).toBe(0);
    expect(left.croissant).toBe(1);
    expect(blockedReason(menu, {}, "fried", 1, cart)).toBe("Short: 1 egg");
  });

  it("TC-09: edit B to omelette x3 + fried x1 blocked", () => {
    const sel = { ...B.options, omelette: 3, fried: 1 };
    const s = findShortages(menu, sel, 1, cart, 0);
    expect(formatShortages(s)).toBe("Short: 1 egg");
  });

  it("TC-10: edit B to omelette x1 + fried x3 allowed, egg left 1", () => {
    const sel = { ...B.options, omelette: 1, fried: 3 };
    expect(findShortages(menu, sel, 1, cart, 0)).toEqual([]);
    const edited: CartLine[] = [{ qty: 1, options: sel }, cart[1]];
    expect(remainingStock(menu, edited).egg).toBe(1);
  });

  it("TC-11: change C qty 2 to 3 blocked, all shortages listed", () => {
    const s = findShortages(menu, C.options, 3, cart, 1);
    expect(formatShortages(s)).toBe("Short: 2 egg, 2 cheese");
  });
});