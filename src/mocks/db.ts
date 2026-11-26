import { menu } from "../data/menu";
import seed from "../data/orders.seed.json";
import { priceCart } from "../engine/pricing";
import { usageOf } from "../engine/stock";
import type { CartLine, IngredientId, Menu, Order } from "../engine/types";

export const SERVER_OFFSET_MS = 90_000; // server clock runs 90s ahead of browser
export const RESERVATION_MS = 5 * 60_000; // 5 minutes
const STORAGE_KEY = "sob.server.v1";

export interface Reservation {
  id: string;
  key: string; // idempotency key from client
  line: CartLine;
  createdAt: number; // server ms
  expiresAt: number; // server ms
}

interface Persisted {
  orders: Order[];
  sold: Record<IngredientId, number>;
  checkoutKeys: Record<string, string>; // idempotency key -> order id
}

// Seed has no prices. Price each order at its own createdAt (Dhaka time).
function priceSeed(): Order[] {
  return (seed.orders as unknown as Order[]).map((o) => ({
    ...o,
    pricing: priceCart(o.lines, menu, { couponCode: o.couponCode }, o.createdAt),
  }));
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Persisted;
  } catch {
    /* fall through to seed */
  }
  return { orders: priceSeed(), sold: {}, checkoutKeys: {} };
}

const persisted = load();

export const db = {
  orders: persisted.orders,
  sold: persisted.sold,
  checkoutKeys: persisted.checkoutKeys,
  reservations: new Map<string, Reservation>(),
  keyIndex: new Map<string, string>(), // idempotency key -> reservation id
  failNextReserve: false, // dev switch for TC-14: db.failNextReserve = true
};

export function save() {
  const data: Persisted = { orders: db.orders, sold: db.sold, checkoutKeys: db.checkoutKeys };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// persist the seed on first start
try {
  if (!localStorage.getItem(STORAGE_KEY)) save();
} catch {
  /* ignore */
}

export const serverNow = () => Date.now() + SERVER_OFFSET_MS;

// Expired reservations release stock by simply being removed.
export function purgeExpired() {
  const now = serverNow();
  for (const [id, r] of db.reservations) {
    if (r.expiresAt <= now) {
      db.reservations.delete(id);
      db.keyIndex.delete(r.key);
    }
  }
}

// Menu whose stock = original minus already SOLD stock.
export function effectiveMenu(): Menu {
  const stock: Record<IngredientId, number> = {};
  for (const [ing, total] of Object.entries(menu.stock)) {
    stock[ing] = total - (db.sold[ing] ?? 0);
  }
  return { ...menu, stock };
}

export function reservedLines(excludeId?: string): CartLine[] {
  return [...db.reservations.values()].filter((r) => r.id !== excludeId).map((r) => r.line);
}

export function availableStock() {
  const m = effectiveMenu();
  const used = usageOf(m, reservedLines());
  const left: Record<IngredientId, number> = {};
  for (const [ing, total] of Object.entries(m.stock)) left[ing] = total - (used[ing] ?? 0);
  return left;
}

export function nextOrderId(): string {
  const max = db.orders.reduce((m, o) => Math.max(m, Number(o.id.replace(/\D/g, ""))), 1000);
  return `ORD-${max + 1}`;
}

// Dhaka time, ISO with +06:00 (same shape as seed file)
export function dhakaIso(ms: number): string {
  return new Date(ms + 6 * 3_600_000).toISOString().replace(/\.\d{3}Z$/, "+06:00");
}