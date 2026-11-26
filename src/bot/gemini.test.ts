import { describe, it, expect, vi } from "vitest";
import { menu } from "../data/menu";
import { withPricing } from "../engine/stats";
import { askBot, BotError } from "./gemini";

const orders = withPricing(
  [{
    id: "ORD-1001", createdAt: "2026-11-20T09:15:00+06:00", paymentMethod: "card", couponCode: null,
    lines: [{ qty: 1, options: { toast: 1, fried: 2, sausage: 1 } }],
  }],
  menu,
);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const asFetch = (f: unknown) => f as typeof fetch;

describe("askBot", () => {
  it("model picks tool, OUR code computes, no raw orders sent", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json({ candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "getOrderCount", args: {} } }] } }] }))
      .mockResolvedValueOnce(json({ candidates: [{ content: { role: "model", parts: [{ text: "There is 1 order." }] } }] }));
    const text = await askBot("How many orders?", orders, menu, { apiKey: "k", fetchImpl: asFetch(f) });
    expect(text).toBe("There is 1 order.");
    const second = JSON.parse(f.mock.calls[1][1].body as string);
    expect(second.contents.at(-1).parts[0].functionResponse.response.result).toEqual({ count: 1 });
    expect(f.mock.calls[0][1].body as string).not.toContain("ORD-1001");
  });

  it("missing key", async () => {
    await expect(askBot("x", orders, menu, { apiKey: "" })).rejects.toMatchObject({ code: "NO_KEY" });
  });
  it("invalid key", async () => {
    const f = vi.fn().mockResolvedValue(json({ error: { message: "API key not valid" } }, 400));
    await expect(askBot("x", orders, menu, { apiKey: "k", fetchImpl: asFetch(f) })).rejects.toMatchObject({ code: "BAD_KEY" });
  });
  it("quota 429", async () => {
    const f = vi.fn().mockResolvedValue(json({}, 429));
    await expect(askBot("x", orders, menu, { apiKey: "k", fetchImpl: asFetch(f) })).rejects.toMatchObject({ code: "QUOTA" });
  });
  it("network error", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("fail"));
    const err = await askBot("x", orders, menu, { apiKey: "k", fetchImpl: asFetch(f) }).catch((e) => e);
    expect(err).toBeInstanceOf(BotError);
    expect(err.code).toBe("NETWORK");
  });
});