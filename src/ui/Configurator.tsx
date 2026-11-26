import { blockedReason, findShortages, formatShortages } from "../engine/stock";
import { validateConfig } from "../engine/validate";
import type { CartLine, Menu, Selection } from "../engine/types";
import { bdt } from "./format";

interface Props {
  menu: Menu; // stock = total stock minus SOLD (reservations are in cartLines)
  selection: Selection;
  qty: number;
  cartLines: CartLine[];
  onSelection: (s: Selection) => void;
  onQty: (q: number) => void;
}

export function Configurator({ menu, selection, qty, cartLines, onSelection, onQty }: Props) {
  const change = (id: string, delta: number) => {
    const next = { ...selection, [id]: Math.max(0, (selection[id] ?? 0) + delta) };
    if (next[id] === 0) delete next[id];
    onSelection(next);
  };

  const violations = validateConfig(selection, menu.groups, menu.rules);
  const shortages = findShortages(menu, selection, qty, cartLines);

  return (
    <section>
      <h2>Build your breakfast</h2>

      {menu.groups.map((g) => (
        <fieldset key={g.id}>
          <legend>{g.name}</legend>
          {g.options.map((o) => {
            const count = selection[o.id] ?? 0;
            const reason = blockedReason(menu, selection, o.id, qty, cartLines);
            return (
              <div key={o.id}>
                <span>
                  {o.name} ({bdt(o.price)})
                </span>{" "}
                <button type="button" onClick={() => change(o.id, -1)} disabled={count === 0}>
                  -
                </button>
                <strong> {count} </strong>
                <button type="button" onClick={() => change(o.id, 1)} disabled={reason !== null}>
                  +
                </button>
                {reason && <small> Blocked. {reason}</small>}
              </div>
            );
          })}
        </fieldset>
      ))}

      <label>
        Quantity{" "}
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => onQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
        />
      </label>

      {violations.length > 0 && (
        <ul>
          {violations.map((v, i) => (
            <li key={i}>{v.message}</li>
          ))}
        </ul>
      )}
      {shortages.length > 0 && <p>{formatShortages(shortages)}</p>}
    </section>
  );
}