import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, fetchState, release, reserve, type StateResponse } from "./api";
import { usageOf } from "./engine/stock";
import { validateConfig } from "./engine/validate";
import type { CartLine, Menu, Selection } from "./engine/types";
import { Configurator } from "./ui/Configurator";
import { PricePanel } from "./ui/PricePanel";
import { usePricePreview } from "./ui/usePricePreview";

// Server codes -> words for the user. Unknown code falls back to the server text.
const MESSAGES: Record<string, string> = {
  RESERVE_FAILED: "Could not reserve stock. Nothing was held. Your selection is kept, try again.",
  NETWORK: "Network error. Your selection is kept, try again.",
  EXPIRED: "This reservation expired.",
  INVALID: "This configuration breaks the rules shown above. Fix it and try again.",
};

export default function App() {
  const [data, setData] = useState<StateResponse | null>(null);
  const [selection, setSelection] = useState<Selection>({});
  const [qty, setQty] = useState(1);
  const [coupon, setCoupon] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ONE key per draft. Reused on every click. Replaced only after success.
  const draftKey = useRef(crypto.randomUUID());
  const pendingRef = useRef(false); // blocks double click before React re-renders

  const refresh = useCallback(async () => setData(await fetchState()), []);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);

  const cartLines: CartLine[] = useMemo(
    () => data?.reservations?.map((r) => r.line) ?? [],
    [data],
  );

  // Server `available` already minus reservations. Add them back, so
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

  const clean = useMemo(
    () => Object.fromEntries(Object.entries(selection).filter(([, n]) => n > 0)),
    [selection],
  );
  const draftCart: CartLine[] = Object.keys(clean).length ? [{ qty, options: clean }] : [];
  const price = usePricePreview(draftCart, coupon.trim() || null);

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
      draftKey.current = crypto.randomUUID(); // new draft, new key
    } catch (e) {
      // configuration is KEPT on failure. Same key, so Retry cannot double-add.
      setError(e instanceof ApiError ? (MESSAGES[e.code] ?? e.message) : "Add to cart failed");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function remove(id: string) {
    await release(id);
    await refresh();
  }

  if (!data || !menu) return <p>{error ?? "Loading..."}</p>;

  const violations = validateConfig(clean, data.menu.groups, data.menu.rules);

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
      <PricePanel {...price} />

      <button
        type="button"
        onClick={addToCart}
        disabled={pending || draftCart.length === 0 || violations.length > 0}
      >
        {pending ? "Adding..." : "Add to cart"}
      </button>
      {error && <p role="alert">{error}</p>}

      <h2>Cart ({data.reservations.length})</h2>
      <ul>
        {data.reservations.map((r) => (
          <li key={r.id}>
            {Object.entries(r.line.options).map(([k, n]) => `${k} x${n}`).join(", ")} | qty {r.line.qty}{" "}
            <button type="button" onClick={() => remove(r.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}