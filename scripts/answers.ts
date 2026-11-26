import { readFileSync } from "node:fs";
import { menu } from "../src/data/menu";
import { priceCart } from "../src/engine/pricing";
import { findShortages, formatShortages } from "../src/engine/stock";
import {
  getCouponAppliedCount, getRevenueByPayment, getTopOptions, getTotalRevenue, withPricing,
} from "../src/engine/stats";
import { validateConfig } from "../src/engine/validate";
import type { Group, Order, Selection } from "../src/engine/types";

const bdt = (p: number) => (p / 100).toFixed(2);
const head = (t: string) => console.log(`\n=== ${t} ===`);
const at = (time: string) => `2026-11-26T${time}+06:00`;

const A: Selection = { toast: 1, scrambled: 2, sausage: 1, ketchup: 1 };
const B: Selection = { croissant: 1, omelette: 2, fried: 2, sausage: 1, bacon: 1, hashbrown: 1, mushroom: 1, hollandaise: 1 };
const C: Selection = { paratha: 1, fried: 2, tofu: 1, cheese: 2, beans: 1, mushroom: 1, chili: 1 };

function show(label: string, r: ReturnType<typeof priceCart>) {
  console.log(
    `${label}: subtotal ${bdt(r.subtotal)} | C1 ${bdt(r.c1)} | C2 ${bdt(r.c2)} | applied ${r.applied ?? "none"} ` +
      `(-${bdt(r.discount)}) | after ${bdt(r.discountedSubtotal)} | VAT ${bdt(r.vat)} | total ${bdt(r.total)} | payable ${bdt(r.payable)}`,
  );
}

// ---- Q1: max C from empty cart
head("Q1 max item C from an empty cart");
let max = 0;
while (max < 1000 && findShortages(menu, C, max + 1, []).length === 0) max++;
console.log("max C:", max);
console.log(`first blocked at ${max + 1}:`, formatShortages(findShortages(menu, C, max + 1, [])));
console.log("C unit price:", bdt(priceCart([{ qty: 1, options: C }], menu, { couponCode: null }, at("12:00:00")).lines[0].unitPrice));

// ---- Q2: cheapest valid configuration (brute force, takes ~30s)
head("Q2 cheapest valid configuration");
function combos(g: Group): Selection[] {
  const ids = g.options.map((o) => o.id);
  const out: Selection[] = [];
  const rec = (i: number, left: number, cur: Selection) => {
    if (i === ids.length) {
      out.push({ ...cur });
      return;
    }
    for (let n = 0; n <= left; n++) {
      if (n) cur[ids[i]] = n;
      else delete cur[ids[i]];
      rec(i + 1, left - n, cur);
    }
    delete cur[ids[i]];
  };
  rec(0, g.max, {});
  return out.filter((s) => {
    const vals = Object.values(s);
    const total = vals.reduce((a, b) => a + b, 0);
    return (
      total >= g.min &&
      (!g.step || total % g.step === 0) &&
      (!g.maxDistinct || vals.length <= g.maxDistinct) &&
      (!g.maxPerOption || vals.every((n) => n <= g.maxPerOption!))
    );
  });
}
const perGroup = menu.groups.map(combos);
let best = Infinity;
let bestList: Selection[] = [];
let checked = 0;
(function walk(gi: number, sel: Selection) {
  if (gi === perGroup.length) {
    checked++;
    if (validateConfig(sel, menu.groups, menu.rules).length) return;
    const unit = priceCart([{ qty: 1, options: sel }], menu, { couponCode: null }, at("12:00:00")).lines[0].unitPrice;
    if (unit < best) {
      best = unit;
      bestList = [];
    }
    if (unit === best) bestList.push({ ...sel });
    return;
  }
  for (const c of perGroup[gi]) walk(gi + 1, { ...sel, ...c });
})(0, {});
console.log("combinations checked:", checked);
console.log("cheapest unit price:", bdt(best), "| ties:", bestList.length);
console.log("first:", JSON.stringify(bestList[0]));

// ---- Q3: A x3 at 10:59:59 and 11:30
head("Q3 cart A x3, coupon MORNING15");
for (const t of ["10:59:59", "11:30:00"]) {
  show(t, priceCart([{ qty: 3, options: A }], menu, { couponCode: "MORNING15" }, at(t)));
}

// ---- Q4 (my reading, VERIFY): cart after TC-10 = B edited + C x2
head("Q4 cart after TC-10 (B = omelette 1, fried 3; C x2)");
const edited = { ...B, omelette: 1, fried: 3 };
const afterTc10 = [{ qty: 1, options: edited }, { qty: 2, options: C }];
for (const t of ["10:59:59", "11:30:00"]) {
  show(t, priceCart(afterTc10, menu, { couponCode: "MORNING15" }, at(t)));
}

// ---- Seed orders
const seed = JSON.parse(readFileSync("src/data/orders.seed.json", "utf8")).orders as Order[];
const orders = withPricing(seed, menu);

head("Q5 payable of each seed order, total revenue");
for (const o of orders) {
  const p = o.pricing;
  console.log(
    `${o.id} ${o.createdAt} coupon=${o.couponCode ?? "-"} applied=${p.applied ?? "none"} ` +
      `subtotal ${bdt(p.subtotal)} discount ${bdt(p.discount)} VAT ${bdt(p.vat)} payable ${bdt(p.payable)}`,
  );
}
console.log("TOTAL revenue:", bdt(getTotalRevenue(orders)), `(${orders.length} orders)`);

head("Q6 best-selling options (units = line qty x option qty)");
for (const t of getTopOptions(orders, 20)) console.log(t.optionId.padEnd(12), t.units);

head("Q7 revenue by payment method");
for (const [m, v] of Object.entries(getRevenueByPayment(orders))) console.log(m.padEnd(6), bdt(v));

head("Q8 orders that actually got MORNING15");
console.log("count applied:", getCouponAppliedCount(orders));
for (const o of orders.filter((x) => x.couponCode && x.pricing.applied !== "C2")) {
  const p = o.pricing;
  console.log(
    `${o.id} had ${o.couponCode} but NOT applied | time ${o.createdAt.slice(11, 19)} | C1 ${bdt(p.c1)} vs C2 ${bdt(p.c2)} | applied ${p.applied ?? "none"}`,
  );
}