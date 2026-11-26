import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPrice } from "../api";
import type { CartLine, PriceBreakdown } from "../engine/types";

interface PriceState {
  status: "idle" | "loading" | "ok" | "error";
  breakdown: PriceBreakdown | null;
  error: string | null;
}

export function usePricePreview(cart: CartLine[], couponCode: string | null) {
  const [state, setState] = useState<PriceState>({ status: "idle", breakdown: null, error: null });
  const [retryTick, setRetryTick] = useState(0);
  const latestId = useRef(0);
  const cartKey = JSON.stringify(cart);

  useEffect(() => {
    // Every change takes a new id. Any response with an older id is dropped.
    const id = ++latestId.current;

    if (cart.length === 0) {
      setState({ status: "idle", breakdown: null, error: null });
      return;
    }

    // Old price cleared on purpose: never show a price for a different configuration.
    setState({ status: "loading", breakdown: null, error: null });

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetchPrice(id, cart, couponCode, ctrl.signal);
        if (res.requestId !== latestId.current) return; // stale
        setState({ status: "ok", breakdown: res.breakdown, error: null });
      } catch (e) {
        if (id !== latestId.current) return; // stale or aborted
        const message = e instanceof Error ? e.message : "Price failed";
        // Configuration is untouched. UI shows Retry.
        setState({ status: "error", breakdown: null, error: message });
      }
    }, 300); // debounce 300 ms

    return () => {
      clearTimeout(timer);
      ctrl.abort(); // cancel in-flight request of the old configuration
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, couponCode, retryTick]);

  const retry = useCallback(() => setRetryTick((n) => n + 1), []);
  return { ...state, retry };
}