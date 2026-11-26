import { describe, it, expect, vi, afterEach, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePricePreview } from "./usePricePreview";
import { fetchPrice } from "../api";
import type { CartLine, PriceBreakdown } from "../engine/types";

vi.mock("../api", () => ({ fetchPrice: vi.fn() }));

const line = (qty: number): CartLine => ({ qty, options: { toast: 1 } });

afterEach(() => vi.useRealTimers());

describe("usePricePreview", () => {
  it("TC-12: older response never replaces newer", async () => {
    vi.useFakeTimers();
    const resolvers: Array<() => void> = [];
    (fetchPrice as Mock).mockImplementation(
      (id: number) =>
        new Promise((resolve) => {
          resolvers.push(() =>
            resolve({ requestId: id, breakdown: { payable: id * 100 } as PriceBreakdown }),
          );
        }),
    );

    const { result, rerender } = renderHook(({ c }) => usePricePreview(c, null), {
      initialProps: { c: [line(1)] },
    });
    await act(async () => { vi.advanceTimersByTime(300); }); // request id 1 sent
    rerender({ c: [line(2)] });
    await act(async () => { vi.advanceTimersByTime(300); }); // request id 2 sent

    await act(async () => { resolvers[1](); }); // newer answers first
    await act(async () => { resolvers[0](); }); // older answers late
    expect(result.current.breakdown?.payable).toBe(200);
  });

  it("failure keeps no price and exposes error for Retry", async () => {
    vi.useFakeTimers();
    (fetchPrice as Mock).mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => usePricePreview([line(1)], null));
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(result.current.status).toBe("error");
  });
});