import { http, HttpResponse, delay } from "msw";
import { menu } from "../data/menu";
import { validateConfig } from "../engine/validate";
import { findShortages, formatShortages } from "../engine/stock";
import { priceCart } from "../engine/pricing";
import type { CartLine, PaymentMethod, Selection } from "../engine/types";
import {
  RESERVATION_MS, availableStock, db, dhakaIso, effectiveMenu, nextOrderId,
  purgeExpired, reservedLines, save, serverNow,
} from "./db";

// EVERY response carries serverTime. Client computes offset = serverTime - Date.now().
const reply = (body: object, init?: ResponseInit) =>
  HttpResponse.json({ serverTime: serverNow(), ...body }, init);

const view = (r: { id: string; line: CartLine; expiresAt: number }) => ({
  id: r.id, line: r.line, expiresAt: r.expiresAt,
});

export const handlers = [
  // Fixture served from the mock API
  http.get("/api/state", async () => {
    await delay(100);
    purgeExpired();
    return reply({
      menu,
      available: availableStock(),
      reservations: [...db.reservations.values()].map(view),
    });
  }),

  // Part C: async price preview. 200-1500ms latency, 15% random failure.
  http.post("/api/price", async ({ request }) => {
    const { requestId, cart, couponCode } = (await request.json()) as {
      requestId: number; cart: CartLine[]; couponCode: string | null;
    };
    await delay(200 + Math.random() * 1300);
    if (Math.random() < 0.15) return reply({ error: "PRICE_FAILED", requestId }, { status: 503 });
    const breakdown = priceCart(cart, menu, { couponCode }, serverNow());
    return reply({ requestId, breakdown });
  }),

  // Part D: reserve. Idempotent by key. All checks BEFORE any write = atomic.
  http.post("/api/reserve", async ({ request }) => {
    const { key, selection, qty } = (await request.json()) as {
      key: string; selection: Selection; qty: number;
    };
    await delay(150 + Math.random() * 350);
    purgeExpired();

    const existingId = db.keyIndex.get(key);
    const existing = existingId ? db.reservations.get(existingId) : undefined;
    if (existing) return reply({ reservation: view(existing), repeated: true });

    const violations = validateConfig(selection, menu.groups, menu.rules);
    if (violations.length) return reply({ error: "INVALID", violations }, { status: 422 });

    const shortages = findShortages(effectiveMenu(), selection, qty, reservedLines());
    if (shortages.length) {
      return reply({ error: "SHORT", message: formatShortages(shortages), shortages }, { status: 409 });
    }

    if (db.failNextReserve) {
      db.failNextReserve = false;
      return reply({ error: "RESERVE_FAILED" }, { status: 500 }); // nothing held
    }

    const now = serverNow();
    const id = crypto.randomUUID();
    const r = { id, key, line: { qty, options: selection }, createdAt: now, expiresAt: now + RESERVATION_MS };
    db.reservations.set(id, r);
    db.keyIndex.set(key, id);
    return reply({ reservation: view(r) });
  }),

  // Edit: one call swaps old allocation for new. Own stock counts as free.
  http.put("/api/reserve/:id", async ({ request, params }) => {
    const { selection, qty } = (await request.json()) as { selection: Selection; qty: number };
    await delay(150 + Math.random() * 350);
    purgeExpired();
    const id = String(params.id);
    const r = db.reservations.get(id);
    if (!r) return reply({ error: "EXPIRED" }, { status: 410 });

    const violations = validateConfig(selection, menu.groups, menu.rules);
    if (violations.length) return reply({ error: "INVALID", violations }, { status: 422 });

    const shortages = findShortages(effectiveMenu(), selection, qty, reservedLines(id));
    if (shortages.length) {
      return reply({ error: "SHORT", message: formatShortages(shortages), shortages }, { status: 409 });
    }
    r.line = { qty, options: selection }; // expiry time unchanged
    return reply({ reservation: view(r) });
  }),

  http.delete("/api/reserve/:id", async ({ params }) => {
    await delay(100);
    const r = db.reservations.get(String(params.id));
    if (r) {
      db.reservations.delete(r.id);
      db.keyIndex.delete(r.key);
    }
    return reply({ released: Boolean(r) });
  }),

  // Part E: checkout. Idempotent by key. Reserved stock becomes SOLD.
  http.post("/api/checkout", async ({ request }) => {
    const { key, paymentMethod, couponCode } = (await request.json()) as {
      key: string; paymentMethod: PaymentMethod; couponCode: string | null;
    };
    await delay(200 + Math.random() * 400);
    purgeExpired();

    const doneId = db.checkoutKeys[key];
    if (doneId) {
      const order = db.orders.find((o) => o.id === doneId);
      if (order) return reply({ order, repeated: true });
    }

    const held = [...db.reservations.values()];
    if (held.length === 0) return reply({ error: "EMPTY_CART" }, { status: 409 });

    const lines = held.map((r) => r.line);
    const now = serverNow();
    const pricing = priceCart(lines, menu, { couponCode }, now);

    const order = {
      id: nextOrderId(),
      createdAt: dhakaIso(now),
      paymentMethod,
      couponCode,
      lines,
      pricing,
    };

    // sold stock never released again (TC-16)
    for (const r of held) {
      for (const [optId, n] of Object.entries(r.line.options)) {
        const opt = menu.groups.flatMap((g) => g.options).find((o) => o.id === optId);
        if (!opt) continue;
        for (const [ing, per] of Object.entries(opt.ingredients)) {
          db.sold[ing] = (db.sold[ing] ?? 0) + per * n * r.line.qty;
        }
      }
      db.reservations.delete(r.id);
      db.keyIndex.delete(r.key);
    }
    db.orders.push(order);
    db.checkoutKeys[key] = order.id;
    save();
    return reply({ order });
  }),

  http.get("/api/orders", async () => {
    await delay(100);
    return reply({ orders: db.orders });
  }),
];