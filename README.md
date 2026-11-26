# Smart Order Builder

A "Build Your Breakfast" ordering app with a rules engine, shared ingredient stock, a pricing engine, timed reservations, JSON orders and a Gemini sales assistant. Frontend only: the backend is a mock server (MSW) in the browser.

- **Live:** TODO paste live URL
- **Repo:** TODO paste repo URL
- **Decisions:** [DECISIONS.md](./DECISIONS.md)
- **Computed answers (Q1 to Q8):** [ANSWERS.md](./ANSWERS.md)

## Stack

React 18+, TypeScript (strict), Vite, MSW (mock API), Vitest + React Testing Library, Gemini API (free tier, Flash model) with function calling.

## Run it

```bash
npm install
cp .env.example .env.local   # then put your Gemini key in .env.local
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with the mock API |
| `npm test` | All unit tests (Vitest) |
| `npm run build` | Type check and production build |
| `npm run answers` | Runs the engine to produce the ANSWERS.md numbers |

### Environment

`.env.example` holds the variable names only. Real keys go in `.env.local`, which is git-ignored.

```
VITE_GEMINI_API_KEY=
VITE_GEMINI_MODEL=gemini-3.5-flash
```

Restart `npm run dev` after changing env values. Vite embeds `VITE_` variables in the browser bundle, so use a throwaway key.

## Architecture

```
src/
  engine/        Pure TypeScript. No React, no network. Menu is always passed in.
    types.ts       Shared types
    validate.ts    Part A: validateConfig
    stock.ts       Part B: shared ingredient stock
    pricing.ts     Part C: priceCart
    stats.ts       Part F: order statistics
  data/
    menu.ts        Appendix A fixture
    orders.seed.json
  mocks/         MSW mock server
    db.ts          State: orders, sold stock, reservations, server clock
    handlers.ts    /api/state, /price, /reserve, /checkout, /orders
    browser.ts     Worker setup
  bot/
    tools.ts       Tool declarations and dispatcher for Gemini
    gemini.ts      REST client, function-calling loop, error mapping
  ui/              React components and hooks
  api.ts           Browser client for the mock API, server clock offset
scripts/answers.ts  Reproducible numbers for ANSWERS.md
```

Rule of thumb: everything that decides a number or a rule lives in `src/engine` as a pure function, so the mock server, the UI and the tests all share one implementation. The engine never imports the menu. It takes a menu argument, so a different fixture works without code changes.

## How each part works

**Rules engine (`validateConfig`).** Returns every violation, not just the first. Supports group min/max, step, maxDistinct, maxPerOption, `requires`, `excludes` and `overrideLimit`. An override replaces the group max, it does not stack. Rules are data in the menu, not code.

**Stock (`stock.ts`).** Option ingredients are multiplied by option count and line quantity. Stock is shared across all cart lines. When editing a line, its own use is released first, so only the net difference must fit. A blocked option reports every shortage at once, for example `Short: 2 egg, 2 cheese`. An ingredient missing from the stock list is unlimited.

**Pricing (`priceCart`).** Pure function `priceCart(cart, menu, promos, serverTime)`. All money is integer poisha, and percentage steps use integer half-up rounding, so no floats touch money. Order of steps:

1. Unit subtotal: base price plus options.
2. Extras deal: every 3 extra units, the cheapest unit is free.
3. Combo: 10% off the step-2 amount when eggs >= 4 and protein >= 2.
4. Line total, then cart subtotal.
5. One cart discount only, the larger of C1 (100 BDT off at 1,200 BDT or more) and C2 (`MORNING15`, 15%, capped at 150 BDT, strictly before 11:00 Dhaka time). Tie goes to C1.
6. VAT 5% on the discounted subtotal, payable rounded half-up to whole BDT.

The coupon cutoff uses the fixed UTC+6 offset, not the browser time zone.

**Async price preview.** 300 ms debounce, simulated latency of 200 to 1500 ms and 15% random failure on the mock `/price` endpoint. Each request carries an id, and in-flight requests of an older configuration are aborted. A late older response can never replace a newer price. On failure the configuration stays and a Retry button appears.

**Cart and reservations.** Add to cart sends an idempotency key, one key per draft, replaced only after success, so a triple click creates one item. The server checks everything before writing anything, so a failed reserve leaves no phantom hold. A reservation lives 5 minutes. The mock server clock runs 90 seconds ahead of the browser, and the countdown uses the offset learned from `serverTime` in every response, never `Date.now()` alone. An expired item releases its stock and becomes read-only.

**Checkout and orders.** Pay sends one idempotency key per attempt. The server creates the order id and timestamp, turns the reserved stock into sold stock (never released again) and empties the cart. Orders are stored as JSON in the mock store and survive a refresh. On first start the seed file is loaded and each seed order is priced at its own `createdAt`. `Download orders.json` exports seed and new orders in one file.

**Sales assistant.** The model only picks a tool and phrases the result. Seven pure functions in `stats.ts` compute every number: order count, total revenue, revenue by payment method, best-selling options, average order value, coupon-applied count and orders on a date. Raw orders are never sent to the model. Orders are fetched when the question is asked, so new checkouts show up without a reload. There is no customer tool and the system prompt says orders hold no customer data, so a question about a customer gets "I cannot know that from this data". Missing key, invalid key, quota (429) and network errors each have their own message.

## Tests

`npm test` runs the engine and hook tests.

| Acceptance tests | Where |
|---|---|
| TC-01 to TC-04 (rules) | `validate.test.ts` |
| TC-05 to TC-07 (pricing, coupon cutoff), TC-10 price | `pricing.test.ts` |
| TC-08 to TC-11 (stock, net difference) | `stock.menu.test.ts`, `stock.test.ts` |
| TC-12 (stale price response) | `usePricePreview.test.ts` |
| Seed statistics (TC-18, TC-19 logic) | `stats.test.ts` |
| Bot tool calls, key, quota and network errors (Gemini mocked) | `gemini.test.ts` |

Checked by hand in the browser: TC-13 to TC-17 (triple Add, failed reserve, expiry countdown, double Pay, refresh and download) and TC-20 (bot refuses to invent a customer). TODO: delete any of these you did not actually run.

## Trade-offs and known gaps

- **Price lock:** price is computed at checkout, not at Add to cart, because TC-06 and TC-07 need the same cart to price differently by server time (D2).
- **Seed orders and stock:** seed orders are past orders and do not consume stock.
- **Combo rule:** "eggs >= 4" counts option units in the Eggs group, not egg ingredients.
- **Sauce max:** Appendix A gives no sauce max, so it is set high and `maxDistinct 2` is the real limit.
- **Edit in the UI:** not built. The server `PUT /api/reserve/:id`, the net-difference stock rule and TC-09 / TC-10 are implemented and unit-tested, but the cart has no Edit button.
- **Part G (bonus):** not done. Reservations live in memory on the mock server, so a refresh empties the cart. Sold stock and orders persist.
- **TC-20:** a unit test cannot prove the model obeys the prompt. The guard is that no customer data and no customer tool exist.
- **Gemini key:** `VITE_` variables end up in the browser bundle. This is required by the brief, so use a task-only key.

## AI tools

TODO: one honest line, for example "Used Claude for scaffolding and reviews. I can explain every file."
