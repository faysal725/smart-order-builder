import { describe, it, expect } from "vitest";
import { menu } from "../data/menu";
import {
  getAverageOrderValue, getCouponAppliedCount, getOrderCount, getOrdersOnDate,
  getRevenueByPayment, getTopOptions, getTotalRevenue, withPricing,
} from "./stats";
import type { Order } from "./types";

const seed: Order[] = [
  {
    id: "ORD-1001", createdAt: "2026-11-20T09:15:00+06:00", paymentMethod: "card", couponCode: "MORNING15",
    lines: [{ qty: 1, options: { toast: 1, scrambled: 2, sausage: 1, ketchup: 1 } }],
  },
  {
    id: "ORD-1002", createdAt: "2026-11-20T12:40:00+06:00", paymentMethod: "bkash", couponCode: null,
    lines: [{ qty: 1, options: { croissant: 1, omelette: 2, fried: 2, sausage: 1, bacon: 1, hashbrown: 1, mushroom: 1, hollandaise: 1 } }],
  },
  {
    id: "ORD-1003", createdAt: "2026-11-21T10:05:00+06:00", paymentMethod: "cash", couponCode: "MORNING15",
    lines: [
      { qty: 2, options: { paratha: 1, fried: 2, tofu: 1, cheese: 2, beans: 1, mushroom: 1, chili: 1 } },
      { qty: 1, options: { toast: 1, scrambled: 2, sausage: 1, ketchup: 1 } },
    ],
  },
];
const orders = withPricing(seed, menu);

describe("stats on seed orders", () => {
  it("prices each order at its own createdAt", () => {
    expect(orders.map((o) => o.pricing.payable)).toEqual([33900, 71300, 127100]);
  });
  it("count, revenue, average", () => {
    expect(getOrderCount(orders)).toBe(3);
    expect(getTotalRevenue(orders)).toBe(232300);
    expect(getAverageOrderValue(orders)).toBe(77433);
  });
  it("revenue by payment", () => {
    expect(getRevenueByPayment(orders)).toEqual({ card: 33900, bkash: 71300, cash: 127100 });
  });
  it("best-selling option by units (qty counted)", () => {
    expect(getTopOptions(orders, 1)).toEqual([{ optionId: "fried", units: 6 }]);
  });
  it("coupon counts only when it actually applied", () => {
    expect(getCouponAppliedCount(orders)).toBe(2);
  });
  it("orders on a date, and a date range", () => {
    expect(getOrdersOnDate(orders, "2026-11-20")).toBe(2);
    expect(getOrderCount(orders, { from: "2026-11-21" })).toBe(1);
  });
});