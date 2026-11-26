import { describe, it, expect } from "vitest";
import { priceCart } from "./pricing";
import { menu } from "../data/menu";
import type { CartLine } from "./types";

const A: CartLine = { qty: 1, options: { toast: 1, scrambled: 2, sausage: 1, ketchup: 1 } };
const B: CartLine = {
  qty: 1,
  options: { croissant: 1, omelette: 2, fried: 2, sausage: 1, bacon: 1, hashbrown: 1, mushroom: 1, hollandaise: 1 },
};
const C: CartLine = {
  qty: 1,
  options: { paratha: 1, fried: 2, tofu: 1, cheese: 2, beans: 1, mushroom: 1, chili: 1 },
};

const early = "2026-11-20T10:59:59+06:00";
const late = "2026-11-20T11:00:00+06:00";
const coupon = { couponCode: "MORNING15" };
const none = { couponCode: null };

describe("priceCart", () => {
  it("TC-05: unit prices A, B, C", () => {
    const r = priceCart([A, B, C], menu, none, early);
    expect(r.lines.map((l) => l.unitPrice)).toEqual([38000, 67950, 49000]);
  });

  it("TC-06: coupon valid at 10:59:59, C2 wins", () => {
    const cart = [B, { ...C, qty: 2 }];
    const r = priceCart(cart, menu, coupon, early);
    expect(r.subtotal).toBe(165950);
    expect(r.applied).toBe("C2");
    expect(r.discount).toBe(15000);
    expect(r.vat).toBe(7548);
    expect(r.payable).toBe(158500);
  });

  it("TC-07: coupon rejected at 11:00:00, C1 applies", () => {
    const cart = [B, { ...C, qty: 2 }];
    const r = priceCart(cart, menu, coupon, late);
    expect(r.applied).toBe("C1");
    expect(r.discount).toBe(10000);
    expect(r.payable).toBe(163700);
  });

  it("unknown option throws", () => {
    expect(() => priceCart([{ qty: 1, options: { nope: 1 } }], menu, none, early)).toThrow();
  });

  it("TC-10: edited B costs 643.50", () => {
    const sel = { ...B.options, omelette: 1, fried: 3 };
    const r = priceCart([{ qty: 1, options: sel }], menu, none, early);
    expect(r.lines[0].unitPrice).toBe(64350);
  });
});