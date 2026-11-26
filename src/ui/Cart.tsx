import type { ReservationView } from "../api";

interface Props {
  active: ReservationView[];
  expired: ReservationView[];
  now: number; // SERVER time, never Date.now()
  names: Record<string, string>;
  onRemove: (r: ReservationView) => void;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const describe = (r: ReservationView, names: Record<string, string>) =>
  Object.entries(r.line.options)
    .map(([id, n]) => `${names[id] ?? id} x${n}`)
    .join(", ") + ` | qty ${r.line.qty}`;

export function Cart({ active, expired, now, names, onRemove }: Props) {
  return (
    <section>
      <h2>Cart ({active.length})</h2>
      <ul>
        {active.map((r) => (
          <li key={r.id}>
            {describe(r, names)} | expires in {mmss(r.expiresAt - now)}{" "}
            <button type="button" onClick={() => onRemove(r)}>
              Remove
            </button>
          </li>
        ))}
        {expired.map((r) => (
          <li key={r.id}>
            <s>{describe(r, names)}</s> | EXPIRED, stock released, read-only{" "}
            <button type="button" onClick={() => onRemove(r)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}