import {
  getAverageOrderValue, getCouponAppliedCount, getOrderCount, getOrdersOnDate,
  getRevenueByPayment, getTopOptions, getTotalRevenue, type PricedOrder, type Range,
} from "../engine/stats";
import type { Menu } from "../engine/types";

const money = (poisha: number) => ({ poisha, bdt: (poisha / 100).toFixed(2) });

const range = {
  from: { type: "string", description: "Optional start date YYYY-MM-DD, inclusive" },
  to: { type: "string", description: "Optional end date YYYY-MM-DD, inclusive" },
};
const rangeParams = { type: "object", properties: range };

export const toolDeclarations = [
  { name: "getOrderCount", description: "Number of orders, optionally in a date range.", parameters: rangeParams },
  { name: "getTotalRevenue", description: "Total revenue (payable) of orders, optionally in a date range.", parameters: rangeParams },
  { name: "getRevenueByPayment", description: "Revenue split by payment method: card, bkash, cash.", parameters: rangeParams },
  {
    name: "getTopOptions",
    description: "Best-selling menu options by units sold.",
    parameters: { type: "object", properties: { ...range, limit: { type: "integer", description: "How many options. Default 1." } } },
  },
  { name: "getAverageOrderValue", description: "Average payable per order.", parameters: rangeParams },
  { name: "getCouponAppliedCount", description: "How many orders actually received the MORNING15 coupon discount.", parameters: rangeParams },
  {
    name: "getOrdersOnDate",
    description: "Number of orders on one date.",
    parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"] },
  },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function executeTool(
  name: string,
  args: Record<string, unknown> = {},
  orders: PricedOrder[],
  menu: Menu,
): unknown {
  const from = typeof args.from === "string" ? args.from : undefined;
  const to = typeof args.to === "string" ? args.to : undefined;
  if ((from && !DATE.test(from)) || (to && !DATE.test(to))) return { error: "Dates must be YYYY-MM-DD." };
  const r: Range = { from, to };

  switch (name) {
    case "getOrderCount":
      return { count: getOrderCount(orders, r) };
    case "getTotalRevenue":
      return { revenue: money(getTotalRevenue(orders, r)) };
    case "getRevenueByPayment": {
      const p = getRevenueByPayment(orders, r);
      return { card: money(p.card), bkash: money(p.bkash), cash: money(p.cash) };
    }
    case "getTopOptions": {
      const limit = Math.max(1, Math.min(10, Math.floor(Number(args.limit) || 1)));
      const names = new Map(menu.groups.flatMap((g) => g.options.map((o) => [o.id, o.name] as const)));
      return {
        top: getTopOptions(orders, limit, r).map((t) => ({ ...t, name: names.get(t.optionId) ?? t.optionId })),
      };
    }
    case "getAverageOrderValue":
      return { average: money(getAverageOrderValue(orders, r)) };
    case "getCouponAppliedCount":
      return { count: getCouponAppliedCount(orders, r) };
    case "getOrdersOnDate": {
      const date = String(args.date ?? "");
      if (!DATE.test(date)) return { error: "date must be YYYY-MM-DD." };
      return { date, count: getOrdersOnDate(orders, date) };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}