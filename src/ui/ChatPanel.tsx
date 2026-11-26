import { useState } from "react";
import { fetchOrders } from "../api";
import { askBot, BotError } from "../bot/gemini";
import { withPricing } from "../engine/stats";
import type { Menu } from "../engine/types";

interface Msg {
  from: "you" | "bot";
  text: string;
  error?: boolean;
}

export function ChatPanel({ menu }: { menu: Menu }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setMsgs((m) => [...m, { from: "you", text: q }]);
    try {
      const { orders } = await fetchOrders(); // fresh, includes new checkouts
      const answer = await askBot(q, withPricing(orders, menu), menu);
      setMsgs((m) => [...m, { from: "bot", text: answer }]);
    } catch (e) {
      const text = e instanceof BotError ? e.message : "Something went wrong. Try again.";
      setMsgs((m) => [...m, { from: "bot", text, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Sales assistant</h2>
      <ul>
        {msgs.map((m, i) => (
          <li key={i} role={m.error ? "alert" : undefined}>
            <strong>{m.from === "you" ? "You" : "Bot"}:</strong> {m.text}
          </li>
        ))}
      </ul>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
        placeholder="How many orders?"
      />{" "}
      <button type="button" onClick={send} disabled={busy || !input.trim()}>
        {busy ? "Thinking..." : "Ask"}
      </button>
    </section>
  );
}