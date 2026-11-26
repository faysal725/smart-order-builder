import type { CartLine, LinePrice, Menu, Poisha, PriceBreakdown, Promos } from "./types";

// Group ids used by deals. Fixture may rename them. Change here only.
const EGGS_GROUP = "eggs";
const PROTEIN_GROUP = "protein";
const EXTRAS_GROUP = "extras";

const C1_MIN: Poisha = 120000; // 1,200 BDT
const C1_OFF: Poisha = 10000; // 100 BDT
const C2_CODE = "MORNING15";
const C2_RATE = 15;
const C2_CAP: Poisha = 15000; // 150 BDT
const VAT_RATE = 5;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const DHAKA_OFFSET_MS = 6 * HOUR_MS; // UTC+6, no DST
const C2_CUTOFF_MS = 11 * HOUR_MS; // strictly before 11:00

// Half-up integer division for n >= 0. No floats.
const divRound = (n: number, d: number) => Math.floor((2 * n + d) / (2 * d));
const pct = (amount: Poisha, rate: number) => divRound(amount * rate, 100);

function beforeCutoff(serverTime: Date | string | number): boolean {
  const t = new Date(serverTime).getTime();
  const msOfDay = (((t + DHAKA_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
  return msOfDay < C2_CUTOFF_MS;
}

function priceLine(
  line: CartLine,
  menu: Menu,
  info: Map<string, { price: Poisha; groupId: string }>,
): LinePrice {
  let unitSubtotal = menu.basePrice;
  const extraUnits: Poisha[] = [];
  let eggs = 0;
  let protein = 0;

  for (const [id, n] of Object.entries(line.options)) {
    if (n <= 0) continue;
    const opt = info.get(id);
    if (!opt) throw new Error(`Unknown option: ${id}`);
    unitSubtotal += opt.price * n;
    if (opt.groupId === EXTRAS_GROUP) for (let i = 0; i < n; i++) extraUnits.push(opt.price);
    if (opt.groupId === EGGS_GROUP) eggs += n;
    if (opt.groupId === PROTEIN_GROUP) protein += n;
  }

  // Step 2: every 3 extra units, cheapest unit free
  const freeCount = Math.floor(extraUnits.length / 3);
  const extrasDeal = extraUnits
    .sort((a, b) => a - b)
    .slice(0, freeCount)
    .reduce((sum, p) => sum + p, 0);
  const afterExtras = unitSubtotal - extrasDeal;

  // Step 3: 10% off the step-2 amount
  const combo = eggs >= 4 && protein >= 2 ? pct(afterExtras, 10) : 0;

  const unitPrice = afterExtras - combo;
  return {
    unitSubtotal,
    extrasDeal,
    combo,
    unitPrice,
    qty: line.qty,
    lineTotal: unitPrice * line.qty, // step 4
  };
}

export function priceCart(
  cart: CartLine[],
  menu: Menu,
  promos: Promos,
  serverTime: Date | string | number,
): PriceBreakdown {
  const info = new Map<string, { price: Poisha; groupId: string }>();
  for (const g of menu.groups)
    for (const o of g.options) info.set(o.id, { price: o.price, groupId: g.id });

  const lines = cart.map((l) => priceLine(l, menu, info));
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  // Step 5: only the larger applies. Tie -> C1.
  const c1 = subtotal >= C1_MIN ? C1_OFF : 0;
  const couponOk = promos.couponCode === C2_CODE && beforeCutoff(serverTime);
  const c2 = couponOk ? Math.min(pct(subtotal, C2_RATE), C2_CAP) : 0;

  let applied: "C1" | "C2" | null = null;
  let discount = 0;
  if (c1 > 0 && c1 >= c2) {
    applied = "C1";
    discount = c1;
  } else if (c2 > 0) {
    applied = "C2";
    discount = c2;
  }

  // Step 6
  const discountedSubtotal = subtotal - discount;
  const vat = pct(discountedSubtotal, VAT_RATE);
  const total = discountedSubtotal + vat;
  const payable = divRound(total, 100) * 100; // whole BDT, half-up

  return { lines, subtotal, c1, c2, applied, discount, discountedSubtotal, vat, total, payable };
}