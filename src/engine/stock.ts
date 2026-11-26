import type { CartLine, IngredientId, Menu, Selection } from "./types";

export interface Shortage {
  ingredient: IngredientId;
  short: number; // how many units missing
}

function ingredientMap(menu: Menu) {
  const map = new Map<string, Record<IngredientId, number>>();
  for (const g of menu.groups) for (const o of g.options) map.set(o.id, o.ingredients);
  return map;
}

// Total ingredient use of a set of cart lines. qty multiplies everything.
export function usageOf(menu: Menu, lines: CartLine[]): Record<IngredientId, number> {
  const info = ingredientMap(menu);
  const used: Record<IngredientId, number> = {};
  for (const line of lines) {
    for (const [optId, n] of Object.entries(line.options)) {
      const ing = info.get(optId);
      if (!ing) throw new Error(`Unknown option: ${optId}`);
      for (const [ingId, per] of Object.entries(ing)) {
        used[ingId] = (used[ingId] ?? 0) + per * n * line.qty;
      }
    }
  }
  return used;
}

// Stock left after the cart. editingIndex = line being edited, its use is released.
export function remainingStock(
  menu: Menu,
  cart: CartLine[],
  editingIndex?: number,
): Record<IngredientId, number> {
  const others = cart.filter((_, i) => i !== editingIndex);
  const used = usageOf(menu, others);
  const left: Record<IngredientId, number> = {};
  for (const [ingId, total] of Object.entries(menu.stock)) {
    left[ingId] = total - (used[ingId] ?? 0);
  }
  return left;
}

// ALL shortages for this selection. Empty array = fits.
export function findShortages(
  menu: Menu,
  selection: Selection,
  qty: number,
  cart: CartLine[],
  editingIndex?: number,
): Shortage[] {
  const need = usageOf(menu, [{ qty, options: selection }]);
  const left = remainingStock(menu, cart, editingIndex);
  const shortages: Shortage[] = [];
  for (const ingId of Object.keys(menu.stock)) {
    const short = (need[ingId] ?? 0) - left[ingId];
    if (short > 0) shortages.push({ ingredient: ingId, short });
  }
  return shortages;
}

export function formatShortages(shortages: Shortage[]): string {
  return `Short: ${shortages.map((s) => `${s.short} ${s.ingredient}`).join(", ")}`;
}

// null = can add one more unit. string = why blocked (for the UI).
export function blockedReason(
  menu: Menu,
  selection: Selection,
  optionId: string,
  qty: number,
  cart: CartLine[],
  editingIndex?: number,
): string | null {
  const next = { ...selection, [optionId]: (selection[optionId] ?? 0) + 1 };
  const shortages = findShortages(menu, next, qty, cart, editingIndex);
  return shortages.length ? formatShortages(shortages) : null;
}