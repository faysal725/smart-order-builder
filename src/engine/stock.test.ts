import { describe, it, expect } from "vitest";
import { remainingStock, findShortages, formatShortages, blockedReason } from "./stock";
import type { Menu } from "./types";

const m: Menu = {
  basePrice: 0,
  groups: [
    {
      id: "g",
      name: "G",
      min: 0,
      max: 99,
      options: [
        { id: "egg2", name: "Egg2", price: 0, ingredients: { egg: 2 } },
        { id: "cheese", name: "Cheese", price: 0, ingredients: { cheese: 1 } },
        { id: "free", name: "Free", price: 0, ingredients: { sauce: 1 } }, // sauce not in stock = unlimited
      ],
    },
  ],
  rules: [],
  stock: { egg: 6, cheese: 2 },
};

describe("stock", () => {
  it("qty multiplies use", () => {
    const left = remainingStock(m, [{ qty: 2, options: { egg2: 1 } }]);
    expect(left.egg).toBe(2);
  });

  it("editing a line releases its own use", () => {
    const cart = [{ qty: 2, options: { egg2: 1 } }];
    expect(remainingStock(m, cart, 0).egg).toBe(6);
  });

  it("lists ALL shortages", () => {
    const s = findShortages(m, { egg2: 4, cheese: 3 }, 1, []);
    expect(formatShortages(s)).toBe("Short: 2 egg, 1 cheese");
  });

  it("untracked ingredient is unlimited", () => {
    expect(findShortages(m, { free: 50 }, 1, [])).toEqual([]);
  });

  it("blockedReason explains block", () => {
    expect(blockedReason(m, { egg2: 3 }, "egg2", 1, [])).toBe("Short: 2 egg");
    expect(blockedReason(m, { egg2: 1 }, "egg2", 1, [])).toBeNull();
  });

  it("two lines share one stock", () => {
    const cart = [{ qty: 1, options: { cheese: 2 } }];
    expect(blockedReason(m, {}, "cheese", 1, cart)).toBe("Short: 1 cheese");
  });
});