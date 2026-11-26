import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError, checkout, fetchOrders, fetchState, release, reserve, serverNow,
  type ReservationView, type StateResponse,
} from "./api";
import { usageOf } from "./engine/stock";
import { validateConfig } from "./engine/validate";
import type { CartLine, Menu, Order, PaymentMethod, Selection } from "./engine/types";
import { Cart } from "./ui/Cart";
import { Configurator } from "./ui/Configurator";
import { PricePanel } from "./ui/PricePanel";
import { bdt } from "./ui/format";
import { usePricePreview } from "./ui/usePricePreview";

const MESSAGES: Record<string, string> = {
  RESERVE_FAILED: "Could not reserve stock. Nothing was held. Your selection is kept, try again.",
  NETWORK: "Network error. Your selection is kept, try again.",
  EXPIRED: "This reservation expired.",
  INVALID: "This configuration breaks the rules shown above. Fix it and try again.",
  EMPTY_CART: "Cart is empty. Nothing to pay.",
};
const errText = (e: unknown, fallback: string) =>
  e instanceof ApiError ? (MESSAGES[e.code] ?? e.message) : fallback;

export default function App() {
  const [data, setData] = useState<StateResponse | null>(null);
  const [expired, setExpired] = useState<ReservationView[]>([]);
  const [selection, setSelection] = useState<Selection>({});
  const [qty, setQty] = useState(1);
  const [coupon, setCoupon] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("card");
  const [pending, setPending] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [now, setNow] = useState(() => serverNow());

  // ONE key per draft, ONE per Pay attempt. Reused on every click, replaced only after success.
  const draftKey = useRef(crypto.randomUUID());
  const payKey = useRef(crypto.randomUUID());
  const pendingRef = useRef(false);
  const payingRef = useRef(false);
  const lastRes = useRef<ReservationView[]>([]); // active items as of last refresh

  const refresh = useCallback(async () => {
    const next = await fetchState();
    const ids = new Set(next.reservations.map((r) => r.id));
    const t = serverNow(); // offset updated by the response above
    // Item missing from server AND past its expiry = expired. Keep it, read-only (D3).
    const gone = lastRes.current.filter((r) => !ids.has(r.id) && r.expiresAt <= t);
    setExpired((prev) => [
      ...prev.filter((p) => !ids.has(p.id)),
      ...gone.filter((g) => !prev.some((p) => p.id === g.id)),
    ]);
    lastRes.current = [...next.reservations];
    setData(next);
  }, []);

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    const poll = setInterval(() => refresh().catch(() => {}), 10_000);
    return () => clearInterval(poll);
  }, [refresh]);

  // Countdown ticks on SERVER time
  useEffect(() => {
    const tick = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(tick);
  }, []);

  const reservations = useMemo(() => data?.reservations ?? [], [data]);
  const active = useMemo(() => reservations.filter((r) => r.expiresAt > now), [reservations, now]);
  const lapsed = useMemo(() => reservations.filter((r) => r.expiresAt <= now), [reservations, now]);

  // An item just ran out: ask the server so stock shows as released
  const lapsedCount = lapsed.length;
  useEffect(() => {
    if (lapsedCount > 0) refresh().catch(() => {});
  }, [lapsedCount, refresh]);

  const cartLines: CartLine[] = useMemo(() => reservations.map((r) => r.line), [reservations]);
  const activeLines: CartLine[] = useMemo(() => active.map((r) => r.line), [active]);

  // Server `available` already minus reservations. Add them back so
  // blockedReason can subtract the cart itself (net-difference rule).
  const menu: Menu | null = useMemo(() => {
    if (!data) return null;
    const reservedUse = usageOf(data.menu, cartLines);
    const stock: Record<string, number> = {};
    for (const ing of Object.keys(data.menu.stock)) {
      stock[ing] = (data.available[ing] ?? 0) + (reservedUse[ing] ?? 0);
    }
    return { ...data.menu, stock };
  }, [data, cartLines]);

  const names = useMemo(
    () =>
      Object.fromEntries(
        (data?.menu.groups ?? []).flatMap((g) => g.options.map((o) => [o.id, o.name])),
      ),
    [data],
  );

  const clean = useMemo(
    () => Object.fromEntries(Object.entries(selection).filter(([, n]) => n > 0)),
    [selection],
  );
  const draftCart: CartLine[] = Object.keys(clean).length ? [{ qty, options: clean }] : [];
  const couponValue = coupon.trim() || null;
  const draftPrice = usePricePreview(draftCart, couponValue);
  const cartPrice = usePricePreview(activeLines, couponValue);

  async function addToCart() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await reserve(draftKey.current, clean, qty);
      await refresh();
      setSelection({});
      setQty(1);
      draftKey.current = crypto.randomUUID();
    } catch (e) {
      setError(errText(e, "Add to cart failed")); // configuration is KEPT
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function remove(r: ReservationView) {
    lastRes.current = lastRes.current.filter((x) => x.id !== r.id);
    setExpired((prev) => prev.filter((x) => x.id !== r.id));
    await release(r.id).catch(() => {}); // already released if expired. Harmless.
    await refresh();
  }

  async function pay() {
    if (payingRef.current) return; // double click guard
    payingRef.current = true;
    setPaying(true);
    setError(null);
    try {
      const { order } = await checkout(payKey.current, payment, couponValue);
      setLastOrder(order);
      payKey.current = crypto.randomUUID(); // next order, new key
      await refresh();
    } catch (e) {
      setError(errText(e, "Payment failed. Nothing was charged. Try again."));
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  }

  async function downloadOrders() {
    try {
      const { orders } = await fetchOrders();
      const file = { schemaVersion: 1, currency: "BDT", orders }; // same shape as seed
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "orders.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errText(e, "Download failed"));
    }
  }

  if (!data || !menu) return <p>{error ?? "Loading..."}</p>;

  const violations = validateConfig(clean, data.menu.groups, data.menu.rules);
  const shownExpired = [...expired, ...lapsed.filter((l) => !expired.some((x) => x.id === l.id))];

  return (
    <main>
      <h1>Smart Order Builder</h1>
      <Configurator
        menu={menu}
        selection={clean}
        qty={qty}
        cartLines={cartLines}
        onSelection={setSelection}
        onQty={setQty}
      />

      <label>
        Coupon{" "}
        <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="MORNING15" />
      </label>
      <h3>This configuration</h3>
      <PricePanel {...draftPrice} />

      <button
        type="button"
        onClick={addToCart}
        disabled={pending || draftCart.length === 0 || violations.length > 0}
      >
        {pending ? "Adding..." : "Add to cart"}
      </button>
      {error && <p role="alert">{error}</p>}

      <Cart active={active} expired={shownExpired} now={now} names={names} onRemove={remove} />

      <h3>Cart total</h3>
      <PricePanel {...cartPrice} />
      <label>
        Payment{" "}
        <select value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
          <option value="card">card</option>
          <option value="bkash">bkash</option>
          <option value="cash">cash</option>
        </select>
      </label>{" "}
      <button type="button" onClick={pay} disabled={paying || active.length === 0}>
        {paying ? "Paying..." : "Pay"}
      </button>

      {lastOrder && (
        <p>
          Order {lastOrder.id} placed. Payable {bdt(lastOrder.pricing?.payable ?? 0)}. Coupon:{" "}
          {lastOrder.couponCode ?? "none"} / applied: {lastOrder.pricing?.applied ?? "none"}
        </p>
      )}

      <p>
        <button type="button" onClick={downloadOrders}>
          Download orders.json
        </button>
      </p>
    </main>
  );
}