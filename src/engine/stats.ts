import { priceCart } from "./pricing";
import type { Menu, Order, PaymentMethod, PriceBreakdown } from "./types";

export type PricedOrder = Order & { pricing: PriceBreakdown };

// Seed orders have no prices. Price them at their own createdAt.
export function withPricing(orders: Order[], menu: Menu): PricedOrder[] {
  return orders.map((o) => ({
    ...o,
    pricing: o.pricing ?? priceCart(o.lines, menu, { couponCode: o.couponCode }, o.createdAt),
  }));
}

export interface Range {
  from?: string; // YYYY-MM-DD, Dhaka date, inclusive
  to?: string;
}

// createdAt is already Dhaka time (+06:00). Slice the string. Never go through Date/UTC.
const dateOf = (o: Order) => o.createdAt.slice(0, 10);
const pick = (orders: PricedOrder[], r: Range = {}) =>
  orders.filter((o) => (!r.from || dateOf(o) >= r.from) && (!r.to || dateOf(o) <= r.to));

export const getOrderCount = (orders: PricedOrder[], r?: Range) => pick(orders, r).length;

export const getTotalRevenue = (orders: PricedOrder[], r?: Range) =>
  pick(orders, r).reduce((s, o) => s + o.pricing.payable, 0);

export function getRevenueByPayment(orders: PricedOrder[], r?: Range) {
  const out: Record<PaymentMethod, number> = { card: 0, bkash: 0, cash: 0 };
  for (const o of pick(orders, r)) out[o.paymentMethod] += o.pricing.payable;
  return out;
}

// Units = option count x line qty, summed over all orders. Tie -> id order.
export function getTopOptions(orders: PricedOrder[], limit = 1, r?: Range) {
  const units: Record<string, number> = {};
  for (const o of pick(orders, r))
    for (const line of o.lines)
      for (const [id, n] of Object.entries(line.options)) units[id] = (units[id] ?? 0) + n * line.qty;
  return Object.entries(units)
    .map(([optionId, u]) => ({ optionId, units: u }))
    .sort((a, b) => b.units - a.units || a.optionId.localeCompare(b.optionId))
    .slice(0, limit);
}

// Half-up integer division. No floats.
export function getAverageOrderValue(orders: PricedOrder[], r?: Range) {
  const n = getOrderCount(orders, r);
  if (n === 0) return 0;
  return Math.floor((2 * getTotalRevenue(orders, r) + n) / (2 * n));
}

// "Actually got the coupon" = C2 won, not just typed.
export const getCouponAppliedCount = (orders: PricedOrder[], r?: Range) =>
  pick(orders, r).filter((o) => o.pricing.applied === "C2").length;

export const getOrdersOnDate = (orders: PricedOrder[], date: string) =>
  orders.filter((o) => dateOf(o) === date).length;